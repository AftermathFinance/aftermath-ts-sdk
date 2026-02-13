import {
	ApiStakeBody,
	ApiUnstakeBody,
	ApiStakingPositionsBody,
	StakingPosition,
	Balance,
	ValidatorConfigObject,
	ApiStakeStakedSuiBody,
	ApiDelegatedStakesBody,
	SuiDelegatedStake,
	ApiValidatorOperationCapsBody,
	ValidatorOperationCapObject,
	ApiUpdateValidatorFeeBody,
	Percentage,
	StakedSuiVaultStateObject,
	SuiAddress,
	StakingApyDataPoint,
	StakingApyTimeframeKey,
	CallerConfig,
} from "../../types.ts";
import { Caller } from "../../general/utils/caller.ts";
import { SuiValidatorSummary, ValidatorsApy } from "@mysten/sui/client";
import { Casting } from "../../general/utils/index.ts";
import { AftermathApi } from "../../general/providers/index.ts";

/**
 * The `Staking` class provides methods for interacting with Aftermath's
 * staking and unstaking systems for SUI. This includes fetching validator
 * information, creating stake and unstake transactions, and retrieving
 * relevant staking statistics such as TVL and APY.
 *
 * @example
 * ```typescript
 * // Instantiate Staking
 * const sdk = new Aftermath("MAINNET");
 * await sdk.init();
 * const staking = sdk.Staking();
 *
 * // Get active validators
 * const validators = await staking.getActiveValidators();
 *
 * // Create a transaction for staking SUI
 * const stakeTx = await staking.getStakeTransaction({
 *   walletAddress: "0x...",
 *   suiStakeAmount: BigInt("1000000000"),
 *   validatorAddress: "0x..."
 * });
 * ```
 */
export class Staking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Contains constants for staking, including protocol fees, default validator
	 * fee, and staking/unstaking bounds. Also defines the maximum external fee
	 * percentage allowed for third-party fees.
	 */
	public static readonly constants = {
		/**
		 * Configuration for fees related to staking and unstaking operations.
		 */
		fees: {
			/**
			 * Protocol unstake fee (5%).
			 */
			protocolUnstake: 0.05,
			/**
			 * Default validator fee (0%).
			 */
			defaultValidator: 0,
			/**
			 * Maximum validator fee (5%).
			 */
			maxValidator: 0.05,
		},
		/**
		 * Configuration for minimum stake/unstake amounts, and maximum external fee
		 * percentage allowed.
		 */
		bounds: {
			/**
			 * Minimum SUI that can be staked. 1 SUI = 10^9 MIST.
			 */
			minStake: BigInt("1000000000"), // 1 SUI
			/**
			 * Minimum afSUI that can be unstaked. 1 afSUI = 10^9 MIST (mirroring SUI decimals).
			 */
			minUnstake: BigInt("1000000000"), // 1 afSUI
			/**
			 * Maximum external fee percentage that third parties can add on top
			 * of protocol fees for staking or unstaking transactions.
			 * @remarks 0.5 = 50%
			 */
			maxExternalFeePercentage: 0.5,
		},
		/**
		 * The default validator fee (0%).
		 */
		defaultValidatorFee: 0,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of the `Staking` class for interacting with Aftermath
	 * staking contracts.
	 *
	 * @param config - Optional configuration containing the Sui network and/or access token.
	 * @param Provider - Optional instance of `AftermathApi` for building transactions.
	 */
	constructor(
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches the list of currently active validators on the Sui network.
	 *
	 * @returns A promise that resolves to an array of `SuiValidatorSummary` objects,
	 * each describing a validator's on-chain metadata.
	 *
	 * @example
	 * ```typescript
	 * const validators = await staking.getActiveValidators();
	 * console.log(validators);
	 * ```
	 */
	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	/**
	 * Fetches the current APYs for all validators, aggregated by the indexer.
	 *
	 * @returns A promise that resolves to a `ValidatorsApy` object, containing
	 * APY data indexed by validator addresses.
	 *
	 * @example
	 * ```typescript
	 * const validatorApys = await staking.getValidatorApys();
	 * console.log(validatorApys);
	 * ```
	 */
	public async getValidatorApys(): Promise<ValidatorsApy> {
		return this.fetchApi("validator-apys");
	}

	/**
	 * Fetches the configuration details for each validator, including fees and
	 * operation caps.
	 *
	 * @returns A promise that resolves to an array of `ValidatorConfigObject`s.
	 *
	 * @example
	 * ```typescript
	 * const configs = await staking.getValidatorConfigs();
	 * console.log(configs);
	 * ```
	 */
	public async getValidatorConfigs(): Promise<ValidatorConfigObject[]> {
		return this.fetchApi("validator-configs");
	}

	/**
	 * Retrieves a list of staking positions for the specified account.
	 *
	 * @param inputs - Contains the `walletAddress` to query, plus optional cursor
	 * and limit for pagination.
	 * @returns A promise that resolves to an array of `StakingPosition` objects
	 * reflecting the user's active or pending stakes.
	 *
	 * @example
	 * ```typescript
	 * const positions = await staking.getStakingPositions({
	 *   walletAddress: "0x...",
	 *   cursor: 0,
	 *   limit: 10
	 * });
	 * console.log(positions);
	 * ```
	 */
	public async getStakingPositions(
		inputs: ApiStakingPositionsBody
	): Promise<StakingPosition[]> {
		return this.fetchApi("staking-positions", inputs);
	}

	/**
	 * Fetches all delegated stakes for a specific wallet address. Delegated
	 * stakes typically represent user funds staked to one or more validators.
	 *
	 * @param inputs - Contains the `walletAddress` for which to fetch delegated stakes.
	 * @returns A promise resolving to an array of `SuiDelegatedStake` objects.
	 *
	 * @example
	 * ```typescript
	 * const delegatedStakes = await staking.getDelegatedStakes({
	 *   walletAddress: "0x..."
	 * });
	 * console.log(delegatedStakes);
	 * ```
	 */
	public async getDelegatedStakes(
		inputs: ApiDelegatedStakesBody
	): Promise<SuiDelegatedStake[]> {
		return this.fetchApi("delegated-stakes", inputs);
	}

	/**
	 * Retrieves validator operation caps for a specified address. Operation caps
	 * typically govern who is authorized to adjust validator fees and settings.
	 *
	 * @param inputs - Contains the `walletAddress` for which to fetch validator
	 * operation caps, plus optional pagination.
	 * @returns A promise resolving to an array of `ValidatorOperationCapObject`s.
	 *
	 * @example
	 * ```typescript
	 * const caps = await staking.getValidatorOperationCaps({
	 *   walletAddress: "0x...",
	 *   cursor: 0,
	 *   limit: 5
	 * });
	 * console.log(caps);
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
	 * Builds or fetches a staking transaction object, which can then be signed
	 * and submitted to the network.
	 *
	 * @param inputs - Includes the `walletAddress`, the amount of SUI to stake, and
	 * the validator address to stake with. Optionally includes a `referrer`, `externalFee`,
	 * and a sponsored transaction flag.
	 * @returns A promise resolving to a transaction that can be signed and executed.
	 *
	 * @example
	 * ```typescript
	 * const stakeTx = await staking.getStakeTransaction({
	 *   walletAddress: "0x...",
	 *   suiStakeAmount: BigInt("1000000000"), // 1 SUI
	 *   validatorAddress: "0x..."
	 * });
	 * // sign and execute this transaction using your preferred Sui wallet
	 * ```
	 */
	public async getStakeTransaction(inputs: ApiStakeBody) {
		return this.useProvider().fetchBuildStakeTx(inputs);
	}

	/**
	 * Builds or fetches an unstaking transaction object, allowing a user to
	 * convert their afSUI back into SUI (either atomically or via partial
	 * liquidity).
	 *
	 * @param inputs - Contains the `walletAddress`, the afSUI amount to unstake,
	 * and whether it's an atomic operation. Optionally includes a `referrer`,
	 * `externalFee`, and a sponsored transaction flag.
	 * @returns A promise resolving to a transaction that can be signed and executed.
	 *
	 * @example
	 * ```typescript
	 * const unstakeTx = await staking.getUnstakeTransaction({
	 *   walletAddress: "0x...",
	 *   afSuiUnstakeAmount: BigInt("1000000000"), // 1 afSUI
	 *   isAtomic: true
	 * });
	 * // sign and execute this transaction to receive SUI
	 * ```
	 */
	public async getUnstakeTransaction(inputs: ApiUnstakeBody) {
		return this.useProvider().fetchBuildUnstakeTx(inputs);
	}

	/**
	 * Builds or fetches a transaction to stake an existing stakedSUI object
	 * (e.g., re-staking funds that were already staked under a different
	 * validator).
	 *
	 * @param inputs - Contains the `walletAddress`, an array of `stakedSuiIds`
	 * to be re-staked, and the new `validatorAddress`. Optionally includes
	 * a `referrer` and a sponsored transaction flag.
	 * @returns A promise resolving to a transaction object that can be signed
	 * and executed.
	 *
	 * @example
	 * ```typescript
	 * const stakeStakedTx = await staking.getStakeStakedSuiTransaction({
	 *   walletAddress: "0x...",
	 *   stakedSuiIds: ["0x<stakedSuiId1>", "0x<stakedSuiId2>"],
	 *   validatorAddress: "0x..."
	 * });
	 * // sign and execute this transaction
	 * ```
	 */
	public async getStakeStakedSuiTransaction(inputs: ApiStakeStakedSuiBody) {
		return this.useProvider().fetchBuildStakeStakedSuiTx(inputs);
	}

	/**
	 * Builds or fetches a transaction to update the validator fee for a
	 * validator in which the user has operation cap privileges.
	 *
	 * @param inputs - Contains the `walletAddress`, `validatorOperationCapId`,
	 * and `newFeePercentage`. Optionally includes a sponsored transaction flag.
	 * @returns A transaction object that can be signed and executed to
	 * update the validator's fee on-chain.
	 *
	 * @example
	 * ```typescript
	 * const updateFeeTx = await staking.getUpdateValidatorFeeTransaction({
	 *   walletAddress: "0x...",
	 *   validatorOperationCapId: "0x...",
	 *   newFeePercentage: 0.01,
	 *   isSponsoredTx: false
	 * });
	 * // sign and execute to update the validator fee
	 * ```
	 */
	public getUpdateValidatorFeeTransaction(inputs: ApiUpdateValidatorFeeBody) {
		return this.useProvider().buildUpdateValidatorFeeTx(inputs);
	}

	/**
	 * Builds a "crank" transaction to update the epoch for afSUI. This can
	 * trigger certain internal processes within the Aftermath protocol,
	 * such as distributing rewards or rebalancing.
	 *
	 * @param inputs - Contains the `walletAddress` to sign the transaction.
	 * @returns A transaction object that can be signed and submitted to
	 * trigger an epoch update.
	 *
	 * @example
	 * ```typescript
	 * const crankTx = await staking.getCrankAfSuiTransaction({
	 *   walletAddress: "0x..."
	 * });
	 * // sign and execute transaction
	 * ```
	 */
	public getCrankAfSuiTransaction(inputs: { walletAddress: SuiAddress }) {
		return this.useProvider().buildEpochWasChangedTx(inputs);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Retrieves the total value locked (TVL) in SUI across the Aftermath
	 * staking systems.
	 *
	 * @returns A promise that resolves to a `Balance` representing the total
	 * staked SUI in the protocol.
	 *
	 * @example
	 * ```typescript
	 * const tvl = await staking.getSuiTvl();
	 * console.log("Total value locked in SUI:", tvl);
	 * ```
	 */
	public async getSuiTvl(): Promise<Balance> {
		return this.fetchApi("sui-tvl");
	}

	/**
	 * Retrieves the current exchange rate between afSUI and SUI. This rate
	 * is used to determine how much SUI a single afSUI token is worth.
	 *
	 * @returns A promise that resolves to a `number` representing the
	 * afSUI-to-SUI rate.
	 *
	 * @example
	 * ```typescript
	 * const rate = await staking.getAfSuiToSuiExchangeRate();
	 * console.log("1 afSUI =", rate, "SUI");
	 * ```
	 */
	public async getAfSuiToSuiExchangeRate(): Promise<number> {
		return this.fetchApi("afsui-exchange-rate");
	}

	/**
	 * Retrieves the stakedSui vault state from the protocol, which holds
	 * important values for calculating fees, reserves, and total active
	 * stake.
	 *
	 * @returns A promise that resolves to a `StakedSuiVaultStateObject`,
	 * containing details like atomic unstake reserves, fees, and total SUI.
	 *
	 * @example
	 * ```typescript
	 * const vaultState = await staking.getStakedSuiVaultState();
	 * console.log("Vault State:", vaultState);
	 * ```
	 */
	public async getStakedSuiVaultState(): Promise<StakedSuiVaultStateObject> {
		return this.fetchApi("staked-sui-vault-state");
	}

	/**
	 * Retrieves the current APY (Annual Percentage Yield) for staking SUI
	 * through Aftermath.
	 *
	 * @returns A promise that resolves to a `number` representing the APY.
	 *
	 * @example
	 * ```typescript
	 * const apy = await staking.getApy();
	 * console.log("Current staking APY:", apy);
	 * ```
	 */
	public async getApy(): Promise<number> {
		return this.fetchApi("apy");
	}

	/**
	 * Retrieves historical APY data points over a specified timeframe.
	 *
	 * @param inputs - Contains a `timeframe` key, such as `"1W"`, `"1M"`, `"1Y"`, etc.
	 * @returns A promise resolving to an array of `StakingApyDataPoint` objects,
	 * each containing a timestamp and an APY value.
	 *
	 * @example
	 * ```typescript
	 * const historicalApy = await staking.getHistoricalApy({ timeframe: "1M" });
	 * console.log(historicalApy); // e.g. [{ timestamp: 1686000000, apy: 0.045 }, ...]
	 * ```
	 */
	public async getHistoricalApy(inputs: {
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
	 * Calculates the atomic unstake fee based on the current vault state. If
	 * the `atomicUnstakeSuiReserves` remain above the target, the minimum fee
	 * applies; otherwise, the fee adjusts proportionally up to the maximum
	 * possible fee.
	 *
	 * @param inputs - Contains the `stakedSuiVaultState`, which holds data on
	 * liquidity reserves, target values, and min/max fees.
	 * @returns A `Percentage` representing the resulting fee (0.01 = 1%).
	 *
	 * @example
	 * ```typescript
	 * const vaultState = await staking.getStakedSuiVaultState();
	 * const fee = Staking.calcAtomicUnstakeFee({ stakedSuiVaultState: vaultState });
	 * console.log("Current atomic unstake fee:", fee);
	 * ```
	 */
	public static calcAtomicUnstakeFee(inputs: {
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
		} else {
			// Atomic unstakes that bring the `atomic_unstake_sui_reserves` below the desired target
			// incur a variable fee:
			//   fee = max_fee - ((max_fee - min_fee) * liquidity_after / target_liquidity_value)

			const atomicFeeDelta =
				stakedSuiVaultState.maxAtomicUnstakeFee -
				stakedSuiVaultState.minAtomicUnstakeFee;

			return Casting.bigIntToFixedNumber(
				stakedSuiVaultState.maxAtomicUnstakeFee -
					(atomicFeeDelta *
						stakedSuiVaultState.atomicUnstakeSuiReserves) /
						stakedSuiVaultState.atomicUnstakeSuiReservesTargetValue
			);
		}
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Returns a provider instance for building transactions. Throws an error
	 * if `Provider` is not defined.
	 *
	 * @returns An instance of `AftermathApi.Staking`.
	 * @throws Will throw if the `Provider` is undefined.
	 */
	private useProvider = () => {
		const provider = this.Provider?.Staking();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
