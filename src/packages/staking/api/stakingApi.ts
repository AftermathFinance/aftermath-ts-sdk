import { DelegatedStake, EventId, ObjectId, SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { StakingApiHelpers } from "./stakingApiHelpers";
import {
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeRequestWithdrawDelegationEvent,
	StakeStakeEventAccumulation,
} from "../stakingTypes";
import { Helpers } from "../../../general/utils/helpers";
import { Balance, SerializedTransaction } from "../../../types";
import {
	StakingCancelDelegationRequestEventOnChain,
	StakingRequestAddDelegationEventOnChain,
	StakingRequestWithdrawDelegationEventOnChain,
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
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchDelegatedStakePositions = async (
		address: SuiAddress
	): Promise<DelegatedStake[]> => {
		return this.Provider.provider.getStakes({
			owner: address,
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchRequestAddDelegationEvents = async (
		cursor?: EventId,
		limit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakingRequestAddDelegationEventOnChain,
			StakeRequestAddDelegationEvent
		>(
			{
				MoveEventType: this.Helpers.eventTypes.requestAddDelegation,
			},
			Casting.staking.requestAddDelegationEventFromOnChain,
			cursor,
			limit
		);

	public fetchRequestWithdrawDelegationEvents = async (
		cursor?: EventId,
		limit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakingRequestWithdrawDelegationEventOnChain,
			StakeRequestWithdrawDelegationEvent
		>(
			{
				MoveEventType:
					this.Helpers.eventTypes.requestWithdrawDelegation,
			},
			Casting.staking.requestWithdrawDelegationEventFromOnChain,
			cursor,
			limit
		);

	public fetchCancelDelegationRequestEvents = async (
		cursor?: EventId,
		limit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakingCancelDelegationRequestEventOnChain,
			StakeCancelDelegationRequestEvent
		>(
			{
				MoveEventType: this.Helpers.eventTypes.cancelDelegationRequest,
			},
			Casting.staking.cancelDelegationRequestEventFromOnChain,
			cursor,
			limit
		);

	/////////////////////////////////////////////////////////////////////
	//// Staked SUI Objects
	/////////////////////////////////////////////////////////////////////

	// public fetchStakedSuiObjects = async (
	// 	stakedSuiIds: ObjectId[]
	// ): Promise<StakedSui[]> => {
	// 	return this.Provider.Objects().fetchCastObjectBatch(
	// 		stakedSuiIds,
	// 		SuiApiCasting.stakedSuiFromSuiObjectResponse
	// 	);
	// };

	// public fetchStakedSuiObjectsOwnedByAddress = async (
	// 	walletAddress: SuiAddress
	// ): Promise<StakedSui[]> => {
	// 	return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
	// 		walletAddress,
	// 		Staking.constants.objectTypes.stakedSuiType,
	// 		SuiApiCasting.stakedSuiFromSuiObjectResponse
	// 	);
	// };

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchRequestAddDelegationTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		validator: SuiAddress
	): Promise<SerializedTransaction> => {
		const tx = await this.Helpers.fetchBuildRequestAddDelegationTransaction(
			walletAddress,
			amount,
			validator
		);
		return tx.serialize();
	};

	public fetchRequestWithdrawDelegationTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		stakedSui: ObjectId,
		delegation: ObjectId
	): Promise<SerializedTransaction> => {
		const tx =
			await this.Helpers.fetchBuildCancelOrRequestWithdrawDelegationTransaction(
				walletAddress,
				amount,
				stakedSui,
				delegation
			);
		return tx.serialize();
	};

	public fetchCancelDelegationRequestTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		stakedSui: ObjectId
	): Promise<SerializedTransaction> => {
		const tx =
			await this.Helpers.fetchBuildCancelOrRequestWithdrawDelegationTransaction(
				walletAddress,
				amount,
				stakedSui
			);
		return tx.serialize();
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// TODO: fetch top stakers and tvl in this single function ? (no need to calc TVL twice)
	public fetchTopStakers = async () => {
		let stakersAccumulation: Record<
			SuiAddress,
			StakeStakeEventAccumulation
		> = {};

		// TODO: should keep fetching stakes until there are none left - is this the same as undefined limit ?
		const stakesWithCursor = await this.fetchRequestAddDelegationEvents();
		const stakes = stakesWithCursor.events;

		for (const stake of stakes) {
			if (stake.issuer in stakersAccumulation) {
				const stakerAccumulation = stakersAccumulation[stake.issuer];

				const totalAmountStaked =
					stakerAccumulation.totalAmountStaked + stake.amount;

				const curLatestStakeTimestamp =
					stakerAccumulation.latestStakeTimestamp;
				const latestStakeTimestamp =
					stake.timestamp > curLatestStakeTimestamp
						? stake.timestamp
						: curLatestStakeTimestamp;

				const curFirstStakeTimestamp =
					stakerAccumulation.firstStakeTimestamp;
				const firstStakeTimestamp =
					stake.timestamp < curFirstStakeTimestamp
						? stake.timestamp
						: curFirstStakeTimestamp;

				const curLargestStake = stakerAccumulation.largestStake;
				const largestStake =
					stake.amount > curLargestStake
						? stake.amount
						: curLargestStake;

				stakersAccumulation[stake.issuer] = {
					...stakerAccumulation,
					totalAmountStaked,
					latestStakeTimestamp,
					firstStakeTimestamp,
					largestStake,
				};
			} else {
				stakersAccumulation[stake.issuer] = {
					staker: stake.issuer,
					totalAmountStaked: stake.amount,
					latestStakeTimestamp: stake.timestamp,
					firstStakeTimestamp: stake.timestamp,
					largestStake: stake.amount,
				};
			}
		}

		// TODO: move this to promise.all above ? (can do this fetching async)
		const unstakesWithCursor =
			await this.fetchRequestWithdrawDelegationEvents();
		const unstakes = unstakesWithCursor.events;

		for (const unstake of unstakes) {
			if (!(unstake.issuer in stakersAccumulation)) continue;

			const stakerAccumulation = stakersAccumulation[unstake.issuer];
			const totalAmountStaked =
				stakerAccumulation.totalAmountStaked - unstake.amount;

			stakersAccumulation[unstake.issuer] = {
				...stakerAccumulation,
				totalAmountStaked,
			};
		}

		const topStakers = Object.values(stakersAccumulation).sort((a, b) =>
			Number(b.totalAmountStaked - a.totalAmountStaked)
		);
		const stakeTvl = Helpers.sumBigInt(
			topStakers.map((staker) => staker.totalAmountStaked)
		);
		return {
			topStakers,
			stakeTvl,
		};
	};
}
