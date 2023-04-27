import {
	DelegatedStake,
	EventId,
	SuiAddress,
	SuiValidatorSummary,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { StakingApiHelpers } from "./stakingApiHelpers";
import {
	StakeFailedEvent,
	StakeRequestEvent,
	UnstakeRequestEvent,
	StakeSuccessEvent,
	UnstakeSuccessEvent,
	AfSuiMintedEvent,
	StakePosition,
	UnstakePosition,
} from "../stakingTypes";
import { Helpers } from "../../../general/utils/helpers";
import { Balance, SerializedTransaction } from "../../../types";
import {
	AfSuiMintedEventOnChain,
	StakeFailedEventOnChain,
	StakeRequestEventOnChain,
	StakeSuccessEventOnChain,
	UnstakeRequestEventOnChain,
	UnstakeSuccessEventOnChain,
} from "./stakingApiCastingTypes";
import { Casting } from "../../../general/utils/casting";

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
	}): Promise<(StakePosition | UnstakePosition)[]> => {
		const [stakes, unstakes] = await Promise.all([
			this.Helpers.fetchAllStakePositions(inputs),
			this.Helpers.fetchAllUnstakePositions(inputs),
		]);

		const positions = [...stakes, ...unstakes];

		return positions.sort(
			(a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// TODO: calc some stats such as tvl, etc.

	// // TODO: fetch top stakers and tvl in this single function ? (no need to calc TVL twice)
	// public fetchTopStakers = async () => {
	// 	let stakersAccumulation: Record<
	// 		SuiAddress,
	// 		StakingStakeEventAccumulation
	// 	> = {};

	// 	// TODO: should keep fetching stakes until there are none left - is this the same as undefined limit ?
	// 	const stakesWithCursor = await this.fetchStakeEvents();
	// 	const stakes = stakesWithCursor.events;

	// 	for (const stake of stakes) {
	// 		if (stake.issuer in stakersAccumulation) {
	// 			const stakerAccumulation = stakersAccumulation[stake.issuer];

	// 			const totalAmountStaked =
	// 				stakerAccumulation.totalAmountStaked + stake.amount;

	// 			if (!stake.timestamp) continue;

	// 			const curLatestStakeTimestamp =
	// 				stakerAccumulation.latestStakeTimestamp ?? 0;
	// 			const latestStakeTimestamp =
	// 				stake.timestamp > curLatestStakeTimestamp
	// 					? stake.timestamp
	// 					: curLatestStakeTimestamp;

	// 			const curFirstStakeTimestamp =
	// 				stakerAccumulation.firstStakeTimestamp ?? 0;
	// 			const firstStakeTimestamp =
	// 				stake.timestamp < curFirstStakeTimestamp
	// 					? stake.timestamp
	// 					: curFirstStakeTimestamp;

	// 			const curLargestStake = stakerAccumulation.largestStake;
	// 			const largestStake =
	// 				stake.amount > curLargestStake
	// 					? stake.amount
	// 					: curLargestStake;

	// 			stakersAccumulation[stake.issuer] = {
	// 				...stakerAccumulation,
	// 				totalAmountStaked,
	// 				latestStakeTimestamp,
	// 				firstStakeTimestamp,
	// 				largestStake,
	// 			};
	// 		} else {
	// 			stakersAccumulation[stake.issuer] = {
	// 				staker: stake.issuer,
	// 				totalAmountStaked: stake.amount,
	// 				latestStakeTimestamp: stake.timestamp,
	// 				firstStakeTimestamp: stake.timestamp,
	// 				largestStake: stake.amount,
	// 			};
	// 		}
	// 	}

	// 	// TODO: move this to promise.all above ? (can do this fetching async)
	// 	const unstakesWithCursor = await this.fetchUnstakeEvents();
	// 	const unstakes = unstakesWithCursor.events;

	// 	for (const unstake of unstakes) {
	// 		if (!(unstake.issuer in stakersAccumulation)) continue;

	// 		const stakerAccumulation = stakersAccumulation[unstake.issuer];
	// 		const totalAmountStaked =
	// 			stakerAccumulation.totalAmountStaked - unstake.amount;

	// 		stakersAccumulation[unstake.issuer] = {
	// 			...stakerAccumulation,
	// 			totalAmountStaked,
	// 		};
	// 	}

	// 	const topStakers = Object.values(stakersAccumulation).sort((a, b) =>
	// 		Number(b.totalAmountStaked - a.totalAmountStaked)
	// 	);
	// 	const stakeTvl = Helpers.sumBigInt(
	// 		topStakers.map((staker) => staker.totalAmountStaked)
	// 	);
	// 	return {
	// 		topStakers,
	// 		stakeTvl,
	// 	};
	// };
}
