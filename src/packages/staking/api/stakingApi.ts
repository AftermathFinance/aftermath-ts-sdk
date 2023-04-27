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
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchStakeRequestEvents = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: EventId;
		limit?: number;
	}) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakeRequestEventOnChain,
			StakeRequestEvent
		>(
			{
				And: [
					{
						MoveEventType: this.Helpers.eventTypes.stakeRequest,
					},
					{
						Sender: inputs.walletAddress,
					},
				],
			},
			Casting.staking.stakeRequestEventFromOnChain,
			inputs.cursor,
			inputs.limit
		);

	public fetchUnstakeRequestEvents = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: EventId;
		limit?: number;
	}) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeRequestEventOnChain,
			UnstakeRequestEvent
		>(
			{
				And: [
					{
						MoveEventType: this.Helpers.eventTypes.unstakeRequest,
					},
					{
						Sender: inputs.walletAddress,
					},
				],
			},
			Casting.staking.unstakeRequestEventFromOnChain,
			inputs.cursor,
			inputs.limit
		);

	public fetchStakeSuccessEvents = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: EventId;
		limit?: number;
	}) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakeSuccessEventOnChain,
			StakeSuccessEvent
		>(
			{
				And: [
					{
						MoveEventType: this.Helpers.eventTypes.stakeSuccess,
					},
					{
						Sender: inputs.walletAddress,
					},
				],
			},
			Casting.staking.stakeSuccessEventFromOnChain,
			inputs.cursor,
			inputs.limit
		);

	public fetchUnstakeSuccessEvents = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: EventId;
		limit?: number;
	}) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeSuccessEventOnChain,
			UnstakeSuccessEvent
		>(
			{
				And: [
					{
						MoveEventType: this.Helpers.eventTypes.unstakeSuccess,
					},
					{
						Sender: inputs.walletAddress,
					},
				],
			},
			Casting.staking.unstakeSuccessEventFromOnChain,
			inputs.cursor,
			inputs.limit
		);

	public fetchStakeFailedEvents = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: EventId;
		limit?: number;
	}) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakeFailedEventOnChain,
			StakeFailedEvent
		>(
			{
				And: [
					{
						MoveEventType: this.Helpers.eventTypes.stakeFailed,
					},
					{
						Sender: inputs.walletAddress,
					},
				],
			},
			Casting.staking.stakeFailedEventFromOnChain,
			inputs.cursor,
			inputs.limit
		);

	public fetchAfSuiMintedEvents = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: EventId;
		limit?: number;
	}) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			AfSuiMintedEventOnChain,
			AfSuiMintedEvent
		>(
			{
				And: [
					{
						MoveEventType: this.Helpers.eventTypes.afSuiMinted,
					},
					{
						Sender: inputs.walletAddress,
					},
				],
			},
			Casting.staking.afSuiMintedEventFromOnChain,
			inputs.cursor,
			inputs.limit
		);

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

	public fetchAllUnstakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const [successEvents, requestEvents] = await Promise.all([
			// unstake success
			this.Provider.Events().fetchAllEvents((cursor, limit) =>
				this.fetchUnstakeSuccessEvents({
					cursor,
					limit,
					walletAddress,
				})
			),
			// unstake request
			this.Provider.Events().fetchAllEvents((cursor, limit) =>
				this.fetchUnstakeRequestEvents({
					cursor,
					limit,
					walletAddress,
				})
			),
		]);

		const mergedEvents: (UnstakeSuccessEvent | UnstakeRequestEvent)[] =
			requestEvents.map((request) => {
				const foundIndex = successEvents.findIndex(
					(success) =>
						success.afSuiWrapperId === request.afSuiWrapperId
				);
				if (foundIndex >= 0) return successEvents[foundIndex];

				return request;
			});

		return mergedEvents.sort(
			(a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
		);
	};

	public fetchAllStakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const [mintedEvents, successEvents, failedEvents, requestEvents] =
			await Promise.all([
				// afSui mint
				this.Provider.Events().fetchAllEvents((cursor, limit) =>
					this.fetchAfSuiMintedEvents({
						cursor,
						limit,
						walletAddress,
					})
				),
				// stake success
				this.Provider.Events().fetchAllEvents((cursor, limit) =>
					this.fetchStakeSuccessEvents({
						cursor,
						limit,
						walletAddress,
					})
				),
				// stake fail
				this.Provider.Events().fetchAllEvents((cursor, limit) =>
					this.fetchStakeFailedEvents({
						cursor,
						limit,
						walletAddress,
					})
				),
				// stake request
				this.Provider.Events().fetchAllEvents((cursor, limit) =>
					this.fetchStakeRequestEvents({
						cursor,
						limit,
						walletAddress,
					})
				),
			]);

		const mergedEvents: (
			| AfSuiMintedEvent
			| StakeSuccessEvent
			| StakeFailedEvent
			| StakeRequestEvent
		)[] = requestEvents.map((request) => {
			const foundMintIndex = mintedEvents.findIndex(
				(mint) => mint.suiWrapperId === request.suiWrapperId
			);
			if (foundMintIndex >= 0) return mintedEvents[foundMintIndex];

			const foundSuccessIndex = successEvents.findIndex(
				(mint) => mint.suiWrapperId === request.suiWrapperId
			);
			if (foundSuccessIndex >= 0) return successEvents[foundSuccessIndex];

			const foundFailedIndex = failedEvents.findIndex(
				(mint) => mint.suiWrapperId === request.suiWrapperId
			);
			if (foundFailedIndex >= 0) return failedEvents[foundFailedIndex];

			return request;
		});

		return mergedEvents.sort(
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
