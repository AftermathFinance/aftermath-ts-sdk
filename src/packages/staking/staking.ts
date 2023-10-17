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
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { SuiValidatorSummary, ValidatorsApy } from "@mysten/sui.js/client";
import { Casting } from "../../general/utils";

export class Staking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		fees: {
			protocolUnstake: 0.05, // 5%
			defaultValidator: 0, // 0%
			maxValidator: 0.05, // 5%
		},
		bounds: {
			minStake: BigInt("1000000000"), // 1 SUI
			minUnstake: BigInt("1000000000"), // 1 afSUI
		},
		defaultValidatorFee: 0, // 0%
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	public async getValidatorApys(): Promise<ValidatorsApy> {
		return this.fetchApi("validator-apys");
	}

	public async getValidatorConfigs(): Promise<ValidatorConfigObject[]> {
		return this.fetchApi("validator-configs");
	}

	public async getStakingPositions(
		inputs: ApiStakingPositionsBody
	): Promise<StakingPosition[]> {
		return this.fetchApi("staking-positions", inputs);
	}

	public async getDelegatedStakes(
		inputs: ApiDelegatedStakesBody
	): Promise<SuiDelegatedStake[]> {
		return this.fetchApi("delegated-stakes", inputs);
	}

	public async getValidatorOperationCaps(
		inputs: ApiValidatorOperationCapsBody
	): Promise<ValidatorOperationCapObject[]> {
		return this.fetchApi("validator-operation-caps", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getStakeTransaction(inputs: ApiStakeBody) {
		return this.fetchApiTransaction<ApiStakeBody>(
			"transactions/stake",
			inputs
		);
	}

	public async getUnstakeTransaction(inputs: ApiUnstakeBody) {
		return this.fetchApiTransaction<ApiUnstakeBody>(
			"transactions/unstake",
			inputs
		);
	}

	public async getStakeStakedSuiTransaction(inputs: ApiStakeStakedSuiBody) {
		return this.fetchApiTransaction<ApiStakeStakedSuiBody>(
			"transactions/stake-staked-sui",
			inputs
		);
	}

	public async getUpdateValidatorFeeTransaction(
		inputs: ApiUpdateValidatorFeeBody
	) {
		return this.fetchApiTransaction<ApiUpdateValidatorFeeBody>(
			"transactions/update-validator-fee",
			inputs
		);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getSuiTvl(): Promise<Balance> {
		return this.fetchApi("sui-tvl");
	}

	public async getAfSuiToSuiExchangeRate(): Promise<number> {
		return this.fetchApi("afsui-exchange-rate");
	}

	public async getStakedSuiVaultState(): Promise<StakedSuiVaultStateObject> {
		return this.fetchApi("staked-sui-vault-state");
	}

	public async getApy(): Promise<number> {
		return this.fetchApi("apy");
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

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

			let atomic_fee_delta =
				stakedSuiVaultState.maxAtomicUnstakeFee -
				stakedSuiVaultState.minAtomicUnstakeFee;

			return Casting.bigIntToFixedNumber(
				stakedSuiVaultState.maxAtomicUnstakeFee -
					(atomic_fee_delta *
						stakedSuiVaultState.atomicUnstakeSuiReserves) /
						stakedSuiVaultState.atomicUnstakeSuiReservesTargetValue
			);
		}
	}
}
