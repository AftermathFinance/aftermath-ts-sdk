import {
	ApiStakeBody,
	ApiUnstakeBody,
	SuiNetwork,
	ApiStakingPositionsBody,
	StakingPosition,
	ApiStakingEventsBody,
	Balance,
	Url,
	UnstakeEvent,
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
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { SuiValidatorSummary, ValidatorsApy } from "@mysten/sui/client";
import { Casting } from "../../general/utils";
import { AftermathApi } from "../../general/providers";

/**
 * The Staking class provides an interface for interacting with the Staking contract.
 */
export class Staking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Constants related to staking.
	 */
	public static readonly constants = {
		fees: {
			protocolUnstake: 0.05, // 5%
			defaultValidator: 0, // 0%
			maxValidator: 0.05, // 5%
		},
		bounds: {
			minStake: BigInt("1000000000"), // 1 SUI
			minUnstake: BigInt("1000000000"), // 1 afSUI
			/**
			 * Max fee percentage that third parties can charge on staking/unstaking transactions
			 */
			maxExternalFeePercentage: 0.5, // 50%
		},
		defaultValidatorFee: 0, // 0%
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of the Staking class.
	 * @param network - The network to use for interacting with the Staking contract.
	 */
	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches the list of active validators.
	 * @returns A Promise that resolves to an array of `SuiValidatorSummary` objects.
	 */
	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	/**
	 * Fetches the APYs for all validators.
	 * @returns A Promise that resolves to a `ValidatorsApy` object.
	 */
	public async getValidatorApys(): Promise<ValidatorsApy> {
		return this.fetchApi("validator-apys");
	}

	/**
	 * Fetches the configuration for all validators.
	 * @returns A Promise that resolves to an array of `ValidatorConfigObject` objects.
	 */
	public async getValidatorConfigs(): Promise<ValidatorConfigObject[]> {
		return this.fetchApi("validator-configs");
	}

	/**
	 * Fetches the staking positions for a given account.
	 * @param inputs - An object containing the account address and optional pagination parameters.
	 * @returns A Promise that resolves to an array of `StakingPosition` objects.
	 */
	public async getStakingPositions(
		inputs: ApiStakingPositionsBody
	): Promise<StakingPosition[]> {
		return this.fetchApi("staking-positions", inputs);
	}

	/**
	 * Fetches the delegated stakes for a given validator.
	 * @param inputs - An object containing the validator address and optional pagination parameters.
	 * @returns A Promise that resolves to an array of `SuiDelegatedStake` objects.
	 */
	public async getDelegatedStakes(
		inputs: ApiDelegatedStakesBody
	): Promise<SuiDelegatedStake[]> {
		return this.fetchApi("delegated-stakes", inputs);
	}

	/**
	 * Fetches the operation caps for a given validator.
	 * @param inputs - An object containing the validator address and optional pagination parameters.
	 * @returns A Promise that resolves to an array of `ValidatorOperationCapObject` objects.
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
	 * Fetches the transaction object for staking SUI.
	 * @param inputs - An object containing the staker address and the amount of SUI to stake.
	 * @returns A Promise that resolves to a transaction object.
	 */
	public async getStakeTransaction(inputs: ApiStakeBody) {
		return this.useProvider().fetchBuildStakeTx(inputs);
	}

	/**
	 * Fetches the transaction object for unstaking SUI.
	 * @param inputs - An object containing the staker address and the amount of SUI to unstake.
	 * @returns A Promise that resolves to a transaction object.
	 */
	public async getUnstakeTransaction(inputs: ApiUnstakeBody) {
		return this.useProvider().fetchBuildUnstakeTx(inputs);
	}

	/**
	 * Fetches the transaction object for staking stakedSUI.
	 * @param inputs - An object containing the staker address and the amount of stakedSUI to stake.
	 * @returns A Promise that resolves to a transaction object.
	 */
	public async getStakeStakedSuiTransaction(inputs: ApiStakeStakedSuiBody) {
		return this.useProvider().fetchBuildStakeStakedSuiTx(inputs);
	}

	/**
	 * Fetches the transaction object for updating a validator's fee.
	 * @param inputs - An object containing the validator address and the new fee percentage.
	 * @returns A Promise that resolves to a transaction object.
	 */
	public getUpdateValidatorFeeTransaction(inputs: ApiUpdateValidatorFeeBody) {
		return this.useProvider().buildUpdateValidatorFeeTx(inputs);
	}

	public getCrankAfSuiTransaction(inputs: { walletAddress: SuiAddress }) {
		return this.useProvider().buildEpochWasChangedTx(inputs);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetches the total value locked in SUI.
	 * @returns A Promise that resolves to a `Balance` object.
	 */
	public async getSuiTvl(): Promise<Balance> {
		return this.fetchApi("sui-tvl");
	}

	/**
	 * Fetches the exchange rate between afSUI and SUI.
	 * @returns A Promise that resolves to a number.
	 */
	public async getAfSuiToSuiExchangeRate(): Promise<number> {
		return this.fetchApi("afsui-exchange-rate");
	}

	/**
	 * Fetches the state of the stakedSUI vault.
	 * @returns A Promise that resolves to a `StakedSuiVaultStateObject` object.
	 */
	public async getStakedSuiVaultState(): Promise<StakedSuiVaultStateObject> {
		return this.fetchApi("staked-sui-vault-state");
	}

	/**
	 * Fetches the current APY for staking SUI.
	 * @returns A Promise that resolves to a number.
	 */
	public async getApy(): Promise<number> {
		return this.fetchApi("apy");
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates the atomic unstake fee for a given stakedSUI vault state.
	 * @param inputs - An object containing the stakedSUI vault state.
	 * @returns A `Percentage` object representing the atomic unstake fee.
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
			//  value receive the minimum fee.

			return Casting.bigIntToFixedNumber(
				stakedSuiVaultState.minAtomicUnstakeFee
			);
		} else {
			// Atomic unstakes that shift the `atomic_unstake_sui_reserves` below the desired target value
			//  receive a variable fee dependent on the distance from the target the unstake brings the
			//  `atomic_unstake_sui_reserves` to:
			//      e.g. fee = max_fee - ((max_fee - min_fee) * liquidity_after / target_liquidity_value)

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

	private useProvider = () => {
		const provider = this.Provider?.Staking();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
