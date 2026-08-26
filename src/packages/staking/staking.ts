import type { SuiValidatorSummary, ValidatorsApy } from "@mysten/sui/jsonRpc";
import type { AftermathApi } from "../../general/providers";
import { Casting } from "../../general/utils";
import { Caller } from "../../general/utils/caller";
import type {
	ApiDelegatedStakesBody,
	ApiStakeBody,
	ApiStakeStakedSuiBody,
	ApiStakingPositionsBody,
	ApiUnstakeBody,
	ApiUpdateValidatorFeeBody,
	ApiValidatorOperationCapsBody,
	Balance,
	CallerConfig,
	Percentage,
	StakedSuiVaultStateObject,
	StakingApyDataPoint,
	StakingApyTimeframeKey,
	StakingPosition,
	SuiAddress,
	SuiDelegatedStake,
	ValidatorConfigObject,
	ValidatorOperationCapObject,
} from "../../types";

/**
 * Provides the high-level Aftermath API for liquid staking and unstaking SUI
 * for afSUI.
 *
 * Read methods send requests to the configured Aftermath API. Transaction
 * methods require an `AftermathApi` instance, which `Aftermath.create()` wires
 * for you. The methods build transactions but do not sign or execute them.
 * `Balance` values are `bigint`s in the token's smallest unit. SUI and afSUI
 * use 9-decimal units, so `1_000_000_000n` represents one token. Percentage
 * values are decimal ratios, so `0.01` represents 1%.
 *
 * @example
 * ```typescript
 * import { Aftermath } from "aftermath-ts-sdk";
 *
 * const aftermath = await Aftermath.create({ network: "MAINNET" });
 * const staking = aftermath.Staking();
 * const apy = await staking.getApy();
 * console.log(`APY: ${apy * 100}%`);
 * ```
 */
export class Staking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Reference values used by the high-level staking API.
	 *
	 * Fees and percentages are decimal ratios. Amount bounds are raw token units:
	 * `1_000_000_000n` is one SUI or one afSUI. The transaction builders reject an
	 * external fee that is zero, negative, or greater than or equal to the
	 * configured maximum.
	 */
	public static readonly constants = {
		/**
		 * Reference fee ratios for protocol and validator fees.
		 */
		fees: {
			/**
			 * Reference protocol unstake fee ratio. `0.05` represents 5%.
			 */
			protocolUnstake: 0.05,
			/**
			 * Default validator fee ratio. `0` represents 0%.
			 */
			defaultValidator: 0,
			/**
			 * Maximum validator fee ratio exposed by the SDK. `0.05` represents 5%.
			 */
			maxValidator: 0.05,
		},
		/**
		 * Minimum amounts and the upper bound for an external fee.
		 */
		bounds: {
			/**
			 * Minimum SUI amount accepted by the staking flow, in MIST.
			 * `1_000_000_000n` is 1 SUI.
			 */
			minStake: BigInt("1000000000"), // 1 SUI
			/**
			 * Minimum afSUI amount accepted by the unstaking flow, in afSUI's
			 * smallest unit. `1_000_000_000n` is 1 afSUI.
			 */
			minUnstake: BigInt("1000000000"), // 1 afSUI
			/**
			 * Maximum external fee ratio for a third-party fee recipient. The
			 * builders accept values strictly below `0.5`, which represents 50%.
			 */
			maxExternalFeePercentage: 0.5,
		},
		/**
		 * Default validator fee ratio. `0` represents 0%.
		 */
		defaultValidatorFee: 0,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a staking provider without making a network request.
	 *
	 * Read methods need a `config` with either a network or a custom API host.
	 * Transaction methods also need `api`; they throw
	 * `Error("missing AftermathApi instance")` when it is omitted.
	 *
	 * @param config - Network, custom API host, API endpoint, or access token for
	 * HTTP-backed methods.
	 * @param api - Low-level `AftermathApi` used by transaction methods. Pass the
	 * provider returned by `Aftermath.create()` when you use those methods.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const apy = await staking.getApy();
	 * ```
	 */
	constructor(
		config?: CallerConfig,
		/** Low-level provider required by transaction-building methods. */
		public readonly api?: AftermathApi
	) {
		super(config, "staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches the validators that the Sui network currently reports as active.
	 * This method performs HTTP I/O through the configured Aftermath API.
	 *
	 * @returns A promise for `SuiValidatorSummary` records with the validator
	 * address and the on-chain metadata returned by the endpoint.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const validators = await staking.getActiveValidators();
	 * ```
	 */
	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	/**
	 * Fetches the current APY for each validator from the Aftermath API.
	 * This method performs HTTP I/O and returns the response keyed by validator
	 * address.
	 *
	 * APY values are decimal ratios. For example, `0.04` represents 4%.
	 *
	 * @returns A promise for a `ValidatorsApy` map keyed by validator address.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const validatorApys = await staking.getValidatorApys();
	 * const validatorApy = validatorApys[
	 *   "0x0000000000000000000000000000000000000000000000000000000000000001"
	 * ];
	 * ```
	 */
	public async getValidatorApys(): Promise<ValidatorsApy> {
		return this.fetchApi("validator-apys");
	}

	/**
	 * Fetches the configured validator records, including each validator's fee
	 * ratio and operation-cap object ID.
	 *
	 * This method performs HTTP I/O through the configured Aftermath API. The
	 * returned fee uses the SDK's decimal-ratio convention, so `0.01` means 1%.
	 *
	 * @returns A promise for `ValidatorConfigObject` records.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const configs = await staking.getValidatorConfigs();
	 * ```
	 */
	public async getValidatorConfigs(): Promise<ValidatorConfigObject[]> {
		return this.fetchApi("validator-configs");
	}

	/**
	 * Retrieves the Aftermath staking and unstaking positions for one wallet.
	 * This method performs a POST request through the configured Aftermath API.
	 *
	 * `cursor` and `limit` are numeric endpoint pagination parameters. The method
	 * returns the current page as an array and does not return a separate next
	 * cursor. Each position contains either a stake record or an unstake record.
	 *
	 * @param inputs - Wallet address and optional numeric pagination values.
	 * @returns A promise for the requested page of `StakingPosition` records.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const positions = await staking.getStakingPositions({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 *   cursor: 0,
	 *   limit: 10,
	 * });
	 * ```
	 */
	public async getStakingPositions(
		inputs: ApiStakingPositionsBody
	): Promise<StakingPosition[]> {
		return this.fetchApi("staking-positions", inputs);
	}

	/**
	 * Fetches native Sui delegated stakes for one wallet.
	 *
	 * These records describe Sui `StakedSui` delegations, not Aftermath
	 * `StakingPosition` records. Amounts are raw SUI balances, and epoch values
	 * are `bigint`s.
	 *
	 * @param inputs - The wallet address that owns the delegated stakes.
	 * @returns A promise for `SuiDelegatedStake` records.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const delegatedStakes = await staking.getDelegatedStakes({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 * });
	 * ```
	 */
	public async getDelegatedStakes(
		inputs: ApiDelegatedStakesBody
	): Promise<SuiDelegatedStake[]> {
		return this.fetchApi("delegated-stakes", inputs);
	}

	/**
	 * Retrieves validator operation-cap objects owned by one wallet.
	 *
	 * An operation cap authorizes a validator-fee update for the validator named
	 * by the cap. This endpoint accepts only a wallet address; its input type has
	 * no cursor or limit fields.
	 *
	 * @param inputs - The wallet address that owns the operation caps.
	 * @returns A promise for `ValidatorOperationCapObject` records.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const caps = await staking.getValidatorOperationCaps({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 * });
	 * ```
	 */
	public async getValidatorOperationCaps(
		inputs: ApiValidatorOperationCapsBody
	): Promise<ValidatorOperationCapObject[]> {
		return this.fetchApi("validator-operation-caps", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds a transaction that converts SUI into afSUI and sends the afSUI to
	 * the wallet.
	 *
	 * The low-level staking provider selects the wallet's SUI coin, optionally
	 * records a referrer, optionally transfers an external fee, and adds the
	 * liquid-staking Move call. The returned transaction is unsigned and is not
	 * submitted. `suiStakeAmount` is a raw SUI balance in MIST, so
	 * `1_000_000_000n` represents 1 SUI.
	 *
	 * @param inputs - Wallet owner and sender, raw SUI amount, active validator
	 * address, and optional referral, external-fee, and sponsorship settings.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws `Error` when `api` is missing or `externalFee.feePercentage` is not
	 * greater than 0 and less than `0.5`.
	 * @throws Errors from the coin-selection client when the wallet cannot supply
	 * the requested amount. The Sui transaction may also fail with a Move error such as an inactive
	 * validator or an amount below the minimum staking threshold.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const aftermath = await Aftermath.create({ network: "MAINNET" });
	 * const stakeTx = await aftermath.Staking().getStakeTransaction({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 *   suiStakeAmount: 1_000_000_000n,
	 *   validatorAddress: "0x0000000000000000000000000000000000000000000000000000000000000004",
	 * });
	 * // Sign and execute `stakeTx` with your wallet.
	 * ```
	 */
	public async getStakeTransaction(inputs: ApiStakeBody) {
		return this.stakingApi().fetchBuildStakeTx(inputs);
	}

	/**
	 * Builds a transaction that converts afSUI back into SUI.
	 *
	 * The low-level provider selects the wallet's afSUI coin and adds an
	 * external-fee transfer when requested. With `isAtomic: true`, the
	 * transaction calls the immediate unstake entry point and transfers returned
	 * SUI to the wallet. With `isAtomic: false`, it creates a pending unstake
	 * request that the protocol processes at the next epoch boundary.
	 * `afSuiUnstakeAmount` is a raw afSUI balance, so `1_000_000_000n` represents
	 * 1 afSUI.
	 *
	 * @param inputs - Wallet owner and sender, raw afSUI amount, atomic or queued
	 * mode, and optional referral and external-fee settings. The accepted
	 * `isSponsoredTx` field is not forwarded by the current afSUI coin selector.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws `Error` when `api` is missing or `externalFee.feePercentage` is not
	 * greater than 0 and less than `0.5`.
	 * @throws `AftermathTransportError` when afSUI coin selection fails. An
	 * atomic transaction can also fail with the Move error `Insufficient Sui
	 * Reserves` when the vault cannot satisfy the request.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const aftermath = await Aftermath.create({ network: "MAINNET" });
	 * const unstakeTx = await aftermath.Staking().getUnstakeTransaction({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 *   afSuiUnstakeAmount: 1_000_000_000n,
	 *   isAtomic: false,
	 * });
	 * // Sign and execute `unstakeTx` to create the pending request.
	 * ```
	 *
	 */
	public async getUnstakeTransaction(inputs: ApiUnstakeBody) {
		return this.stakingApi().fetchBuildUnstakeTx(inputs);
	}

	/**
	 * Builds a transaction that restakes existing native `StakedSui` objects for
	 * afSUI under a validator.
	 *
	 * The transaction creates a Move vector from `stakedSuiIds`, optionally
	 * records a referrer, calls the restake entry point, and transfers the
	 * returned afSUI to the wallet. This input does not support an external fee.
	 * The returned transaction is unsigned and is not submitted.
	 *
	 * @param inputs - Wallet owner and sender, native `StakedSui` object IDs,
	 * destination validator and optional referral. The accepted `isSponsoredTx`
	 * field is not used by this object-vector builder.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws `Error` when `api` is missing. The Sui transaction may fail with a
	 * Move error for an inactive validator or an empty object vector.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const aftermath = await Aftermath.create({ network: "MAINNET" });
	 * const stakeStakedTx = await aftermath.Staking().getStakeStakedSuiTransaction({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 *   stakedSuiIds: [
	 *     "0x0000000000000000000000000000000000000000000000000000000000000002",
	 *   ],
	 *   validatorAddress: "0x0000000000000000000000000000000000000000000000000000000000000004",
	 * });
	 * // Sign and execute `stakeStakedTx` with your wallet.
	 * ```
	 */
	public async getStakeStakedSuiTransaction(inputs: ApiStakeStakedSuiBody) {
		return this.stakingApi().fetchBuildStakeStakedSuiTx(inputs);
	}

	/**
	 * Builds a transaction that updates a validator's fee using an operation cap.
	 *
	 * The new fee is encoded as an 18-decimal fixed-point value before the Move
	 * call. The cap must authorize the validator named by the cap. The returned
	 * promise contains an unsigned transaction and does not submit it.
	 *
	 * @param inputs - Wallet sender, validator operation-cap object ID, decimal
	 * fee ratio. `0.01` means 1%. The accepted `isSponsoredTx` field is not used
	 * because this builder creates a local transaction without coin selection.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws `Error` when `api` is missing. The Sui transaction may fail with a
	 * Move error for an invalid cap, validator, or fee above the configured maximum.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const aftermath = await Aftermath.create({ network: "MAINNET" });
	 * const updateFeeTx = await aftermath.Staking().getUpdateValidatorFeeTransaction({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 *   validatorOperationCapId: "0x0000000000000000000000000000000000000000000000000000000000000002",
	 *   newFeePercentage: 0.01,
	 * });
	 * // Sign and execute `updateFeeTx` to update the on-chain fee.
	 * ```
	 */
	public getUpdateValidatorFeeTransaction(inputs: ApiUpdateValidatorFeeBody) {
		return this.stakingApi().buildUpdateValidatorFeeTx(inputs);
	}

	/**
	 * Builds a crank transaction that calls the afSUI epoch-update entry point.
	 *
	 * The protocol uses this call to process epoch-related staking and unstaking
	 * state. The method only builds the transaction; it does not execute it.
	 *
	 * @param inputs - Wallet address that will sign and send the transaction.
	 * @returns An unsigned `Transaction` ready for signing.
	 * @throws `Error` when `api` is missing. The Sui transaction may fail if the
	 * protocol's epoch-processing preconditions are not met.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const aftermath = await Aftermath.create({ network: "MAINNET" });
	 * const crankTx = aftermath.Staking().getCrankAfSuiTransaction({
	 *   walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 * });
	 * // Sign and execute `crankTx` with your wallet.
	 * ```
	 */
	public getCrankAfSuiTransaction(inputs: {
		/** Wallet address that signs and sends the crank transaction. */
		walletAddress: SuiAddress;
	}) {
		return this.stakingApi().buildEpochWasChangedTx(inputs);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Retrieves the total SUI value locked in Aftermath's liquid-staking vault.
	 *
	 * The returned `Balance` is a raw SUI amount in MIST. This method performs
	 * HTTP I/O through the configured Aftermath API.
	 *
	 * @returns A promise for the TVL as a raw SUI `Balance`.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const tvlMist = await staking.getSuiTvl();
	 * console.log("TVL in MIST:", tvlMist);
	 * ```
	 */
	public async getSuiTvl(): Promise<Balance> {
		return this.fetchApi("sui-tvl");
	}

	/**
	 * Retrieves the current afSUI-to-SUI exchange rate.
	 *
	 * The numeric result is the amount of SUI represented by 1 afSUI. It is a
	 * decimal ratio, so `1.05` means 1 afSUI represents 1.05 SUI. This method
	 * performs HTTP I/O through the configured Aftermath API.
	 *
	 * @returns A promise for the current afSUI-to-SUI rate.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const rate = await staking.getAfSuiToSuiExchangeRate();
	 * console.log(`1 afSUI = ${rate} SUI`);
	 * ```
	 */
	public async getAfSuiToSuiExchangeRate(): Promise<number> {
		return this.fetchApi("afsui-exchange-rate");
	}

	/**
	 * Retrieves the normalized stakedSui vault state used for reserve and fee
	 * calculations.
	 *
	 * Balance fields are raw SUI or afSUI amounts in their smallest units. Fee
	 * fields are 18-decimal fixed-point `bigint`s, where
	 * `1_000_000_000_000_000_000n` represents 100%. `activeEpoch` is a protocol
	 * epoch number. This method performs HTTP I/O through the configured
	 * Aftermath API.
	 *
	 * @returns A promise for the normalized `StakedSuiVaultStateObject`.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const vaultState = await staking.getStakedSuiVaultState();
	 * const minimumFee = Number(vaultState.minAtomicUnstakeFee) / 1e18;
	 * ```
	 */
	public async getStakedSuiVaultState(): Promise<StakedSuiVaultStateObject> {
		return this.fetchApi("staked-sui-vault-state");
	}

	/**
	 * Retrieves the current Aftermath staking APY.
	 *
	 * The result is a decimal ratio, not a whole-number percentage. For example,
	 * `0.045` represents 4.5%. This method performs HTTP I/O through the
	 * configured Aftermath API.
	 *
	 * @returns A promise for the current APY ratio.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const apy = await staking.getApy();
	 * console.log(`Current staking APY: ${apy * 100}%`);
	 * ```
	 */
	public async getApy(): Promise<number> {
		return this.fetchApi("apy");
	}

	/**
	 * Retrieves historical APY data points for a supported timeframe.
	 *
	 * APY values are decimal ratios. The timestamp is the numeric value returned
	 * by the endpoint through the `Timestamp` type; that type does not distinguish
	 * seconds from milliseconds.
	 *
	 * @param inputs - A supported timeframe key: `"1W"`, `"1M"`, `"3M"`, `"6M"`,
	 * `"1Y"`, or `"ALL"`.
	 * @returns A promise for the APY data points returned by the endpoint.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const staking = new Staking({ network: "MAINNET" });
	 * const historicalApy = await staking.getHistoricalApy({ timeframe: "1M" });
	 * ```
	 */
	public async getHistoricalApy(inputs: {
		/** Timeframe selector accepted by the historical-APY endpoint. */
		timeframe: StakingApyTimeframeKey;
	}): Promise<StakingApyDataPoint[]> {
		return this.fetchApi("historical-apy", inputs);
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates the current atomic-unstake fee from a vault state.
	 *
	 * When reserves are at or above the target, the method returns the minimum
	 * fee. Below the target, it interpolates between the maximum and minimum
	 * fixed-point fees using the current reserve value. This is a local
	 * calculation and performs no network I/O.
	 *
	 * @param inputs - Vault state containing raw reserve balances and 18-decimal
	 * fixed-point minimum and maximum fee values.
	 * @returns The fee as a decimal `Percentage`; `0.01` represents 1%.
	 *
	 * @example
	 * ```typescript
	 * import { Staking } from "aftermath-ts-sdk";
	 *
	 * const vaultState = await new Staking({ network: "MAINNET" })
	 *   .getStakedSuiVaultState();
	 * const fee = Staking.calcAtomicUnstakeFee({ stakedSuiVaultState: vaultState });
	 * console.log(`Current atomic unstake fee: ${fee * 100}%`);
	 * ```
	 */
	public static calcAtomicUnstakeFee(inputs: {
		/** Vault state used for the reserve threshold and fee interpolation. */
		stakedSuiVaultState: StakedSuiVaultStateObject;
	}): Percentage {
		const { stakedSuiVaultState } = inputs;

		// iia. Calculate the `atomic_unstake_fee`.
		if (
			stakedSuiVaultState.atomicUnstakeSuiReserves >=
			stakedSuiVaultState.atomicUnstakeSuiReservesTargetValue
		) {
			// Atomic unstakes that keep the `atomic_unstake_sui_reserves` larger than the desired target
			// value receive the minimum fee.

			return Casting.bigIntToFixedNumber(
				stakedSuiVaultState.minAtomicUnstakeFee
			);
		}
		// Atomic unstakes that bring the `atomic_unstake_sui_reserves` below the desired target
		// incur a variable fee:
		//   fee = max_fee - ((max_fee - min_fee) * liquidity_after / target_liquidity_value)

		const atomicFeeDelta =
			stakedSuiVaultState.maxAtomicUnstakeFee -
			stakedSuiVaultState.minAtomicUnstakeFee;

		return Casting.bigIntToFixedNumber(
			stakedSuiVaultState.maxAtomicUnstakeFee -
				(atomicFeeDelta * stakedSuiVaultState.atomicUnstakeSuiReserves) /
					stakedSuiVaultState.atomicUnstakeSuiReservesTargetValue
		);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Returns a provider instance for building transactions. Throws an error
	 * if `api` is not defined.
	 *
	 * @returns An instance of `AftermathApi.Staking`.
	 * @throws Will throw if the `api` is undefined.
	 */
	private readonly stakingApi = () => {
		const staking = this.api?.Staking();
		if (!staking) {
			throw new Error("missing AftermathApi instance");
		}
		return staking;
	};
}
