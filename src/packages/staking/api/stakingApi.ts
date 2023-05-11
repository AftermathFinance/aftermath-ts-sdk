import {
	DelegatedStake,
	SuiAddress,
	SuiValidatorSummary,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { StakingApiHelpers } from "./stakingApiHelpers";
import { StakingPosition } from "../stakingTypes";
import { Balance, SerializedTransaction } from "../../../types";
import { Casting } from "../../../general/utils";

export class StakingApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new StakingApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchDelegatedStakes = async (
		address: SuiAddress
	): Promise<DelegatedStake[]> => {
		return this.Provider.provider.getStakes({
			owner: address,
		});
	};

	public fetchActiveValidators = async (): Promise<SuiValidatorSummary[]> => {
		return (await this.Provider.Sui().fetchSystemState()).activeValidators;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchStakeTransaction = async (inputs: {
		walletAddress: SuiAddress;
		suiStakeAmount: Balance;
		validatorAddress: SuiAddress;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildStakeTransaction({
				...inputs,
			})
		);
	};

	public fetchUnstakeTransaction = async (inputs: {
		walletAddress: SuiAddress;
		afSuiUnstakeAmount: Balance;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildUnstakeTransaction({
				...inputs,
			})
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Positions
	/////////////////////////////////////////////////////////////////////

	public fetchAllPositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakingPosition[]> => {
		const [stakes, unstakes] = await Promise.all([
			this.Helpers.fetchAllStakePositions(inputs),
			this.Helpers.fetchAllUnstakePositions(inputs),
		]);

		const positions = [...stakes, ...unstakes];

		return positions.sort(
			(a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSuiTvl = async (): Promise<Balance> => {
		const tx = new TransactionBlock();
		this.Helpers.addGetStakedSuiTvlCommandToTransaction({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchAfSuiExchangeRate = async (): Promise<number> => {
		const [suiTvl, afSuiSupply] = await Promise.all([
			this.fetchSuiTvl(),
			this.Helpers.fetchAfSuiSupply(),
		]);
		return suiTvl <= BigInt(0) || afSuiSupply <= BigInt(0)
			? 1
			: Number(afSuiSupply) / Number(suiTvl);
	};
}
