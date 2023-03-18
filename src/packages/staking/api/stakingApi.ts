import { EventId, ObjectId, SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { StakingApiHelpers } from "./stakingApiHelpers";
import {
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeRequestWithdrawDelegationEvent,
	StakeStakeEventAccumulation,
} from "../stakingTypes";
import { Helpers } from "../../../general/utils/helpers";
import { Balance, Delegation, StakedSui } from "../../../types";
import { SuiApiCasting } from "../../sui/api/suiApiCasting";
import {
	StakingCancelDelegationRequestEventOnChain,
	StakingRequestAddDelegationEventOnChain,
	StakingRequestWithdrawDelegationEventOnChain,
} from "./stakingApiCastingTypes";
import { StakingApiCasting } from "./stakingApiCasting";

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

	public fetchStakeValidators = async () => {
		const validatorMetadatas = await this.Provider.provider.getValidators();

		const validators = validatorMetadatas.map(
			StakingApiCasting.stakeValidatorFromValidatorMetadata
		);

		return validators;
	};

	public fetchDelegatedStakePositions = async (address: SuiAddress) => {
		const delegatedStakes = await this.Provider.provider.getDelegatedStakes(
			address
		);
		const delegatedStakePositions = delegatedStakes.map(
			StakingApiCasting.delegatedStakePositionFromDelegatedStake
		);
		return delegatedStakePositions;
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchRequestAddDelegationEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakingRequestAddDelegationEventOnChain,
			StakeRequestAddDelegationEvent
		>(
			{
				MoveEventType: this.Helpers.eventTypes.requestAddDelegation,
			},
			StakingApiCasting.requestAddDelegationEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchRequestWithdrawDelegationEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakingRequestWithdrawDelegationEventOnChain,
			StakeRequestWithdrawDelegationEvent
		>(
			{
				MoveEventType:
					this.Helpers.eventTypes.requestWithdrawDelegation,
			},
			StakingApiCasting.requestWithdrawDelegationEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchCancelDelegationRequestEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakingCancelDelegationRequestEventOnChain,
			StakeCancelDelegationRequestEvent
		>(
			{
				MoveEventType: this.Helpers.eventTypes.cancelDelegationRequest,
			},
			StakingApiCasting.cancelDelegationRequestEventFromOnChain,
			cursor,
			eventLimit
		);

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Delegation Objects
	/////////////////////////////////////////////////////////////////////

	public fetchDelegationObjects = async (
		delegationIds: ObjectId[]
	): Promise<Delegation[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<Delegation>(
			delegationIds,
			SuiApiCasting.delegationFromSuiObjectResponse
		);
	};

	public fetchDelegationObjectsOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<Delegation[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			walletAddress,
			SuiApiCasting.isDelegation,
			this.fetchDelegationObjects
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Staked SUI Objects
	/////////////////////////////////////////////////////////////////////

	public fetchStakedSuiObjects = async (
		stakedSuiIds: ObjectId[]
	): Promise<StakedSui[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<StakedSui>(
			stakedSuiIds,
			SuiApiCasting.stakedSuiFromSuiObjectResponse
		);
	};

	public fetchStakedSuiObjectsOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedSui[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			walletAddress,
			SuiApiCasting.isStakedSui,
			this.fetchStakedSuiObjects
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchRequestAddDelegationTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		validator: SuiAddress
	) =>
		this.Helpers.fetchBuildRequestAddDelegationTransactions(
			walletAddress,
			amount,
			validator
		);

	public fetchRequestWithdrawDelegationTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		stakedSui: ObjectId,
		delegation: ObjectId
	) =>
		this.Helpers.fetchCancelOrRequestWithdrawDelegationTransactions(
			walletAddress,
			amount,
			stakedSui,
			delegation
		);

	public fetchCancelDelegationRequestTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		stakedSui: ObjectId
	) =>
		this.Helpers.fetchCancelOrRequestWithdrawDelegationTransactions(
			walletAddress,
			amount,
			stakedSui
		);

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// TODO: fetch top stakers and tvl in this single function ? (no need to calc TVL twice)
	public fetchTopStakers = async () => {
		let stakersAccumulation: Record<
			SuiAddress,
			StakeStakeEventAccumulation
		> = {};

		// TODO: should keep fetching stakes until there are none left - is this the same as undefined eventLimit ?
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
