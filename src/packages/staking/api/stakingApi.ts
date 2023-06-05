import {
	DelegatedStake,
	ObjectId,
	SuiAddress,
	SuiValidatorSummary,
	TransactionArgument,
	TransactionBlock,
	ValidatorsApy,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AfSuiMintedEvent,
	StakeEvent,
	StakeFailedEvent,
	StakePosition,
	StakeRequestEvent,
	StakeSuccessEvent,
	StakingPosition,
	UnstakeEvent,
	UnstakePosition,
	UnstakeRequestEvent,
	UnstakeSuccessEvent,
	isStakeEvent,
	isStakePosition,
	isUnstakeEvent,
	isUnstakePosition,
} from "../stakingTypes";
import {
	AnyObjectType,
	Balance,
	CoinType,
	StakingAddresses,
	UserEventsInputs,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import {
	AfSuiMintedEventOnChain,
	StakeFailedEventOnChain,
	StakeRequestEventOnChain,
	StakeSuccessEventOnChain,
	UnstakeRequestEventOnChain,
	UnstakeSuccessEventOnChain,
} from "./stakingApiCastingTypes";

export class StakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		modules: {
			interface: "interface",
			actions: "actions",
			staking: "staking",
		},
		eventNames: {
			stakeRequest: "StakeWasRequestedEvent",
			unstakeRequest: "WithdrawWasRequestedEvent",
			stakeSuccess: "StakeSucceededEvent",
			unstakeSuccess: "WithdrawSucceededEvent",
			stakeFailed: "StakeWasFailedSUIReturnedEvent",
			afSuiMinted: "AFSUIWasMintedToStakerAccountEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: StakingAddresses;

	public readonly eventTypes: {
		stakeRequest: AnyObjectType;
		unstakeRequest: AnyObjectType;
		stakeSuccess: AnyObjectType;
		unstakeSuccess: AnyObjectType;
		stakeFailed: AnyObjectType;
		afSuiMinted: AnyObjectType;
	};

	public readonly coinTypes: {
		afSui: CoinType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.staking;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;

		this.coinTypes = {
			afSui: `${addresses.packages.afsui}::afsui::AFSUI`,
		};

		this.eventTypes = {
			stakeRequest: this.stakeRequestEventType(),
			unstakeRequest: this.unstakeRequestEventType(),
			stakeSuccess: this.stakeSuccessEventType(),
			unstakeSuccess: this.unstakeSuccessEventType(),
			stakeFailed: this.stakeFailedEventType(),
			afSuiMinted: this.afSuiMintedEventType(),
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchDelegatedStakes = async (inputs: {
		address: SuiAddress;
	}): Promise<DelegatedStake[]> => {
		return this.Provider.provider.getStakes({
			owner: inputs.address,
		});
	};

	public fetchActiveValidators = async (): Promise<SuiValidatorSummary[]> => {
		return (await this.Provider.Sui().fetchSystemState()).activeValidators;
	};

	public fetchValidatorApys = async (): Promise<ValidatorsApy> => {
		return await this.Provider.provider.getValidatorsApy();
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildStakeTx = async (inputs: {
		walletAddress: SuiAddress;
		suiStakeAmount: Balance;
		validatorAddress: SuiAddress;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const suiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: Coin.constants.suiCoinType,
			coinAmount: inputs.suiStakeAmount,
		});

		this.stakeTx({
			tx,
			...inputs,
			suiCoin,
		});

		return tx;
	};

	public fetchBuildUnstakeTx = async (inputs: {
		walletAddress: SuiAddress;
		afSuiUnstakeAmount: Balance;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const afSuiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: this.coinTypes.afSui,
			coinAmount: inputs.afSuiUnstakeAmount,
		});

		this.unstakeTx({
			tx,
			...inputs,
			afSuiCoin,
		});

		return tx;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public stakeTx = (inputs: {
		tx: TransactionBlock;
		suiCoin: ObjectId | TransactionArgument;
		validatorAddress: SuiAddress;
	}) => {
		const { tx, suiCoin } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.modules.interface,
				"request_add_stake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.staking),
				typeof suiCoin === "string" ? tx.object(suiCoin) : suiCoin,
				tx.pure(inputs.validatorAddress, "address"),
			],
		});
	};

	public unstakeTx = (inputs: {
		tx: TransactionBlock;
		afSuiCoin: ObjectId | TransactionArgument;
	}) => {
		const { tx, afSuiCoin } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.modules.interface,
				"request_unstake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.staking),
				typeof afSuiCoin === "string"
					? tx.object(afSuiCoin)
					: afSuiCoin,
			],
		});
	};

	public getAfSuiSupplyTx = (inputs: { tx: TransactionBlock }) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.modules.staking,
				"afsui_supply"
			),
			typeArguments: [],
			arguments: [tx.object(this.addresses.objects.staking)],
		});
	};

	public getStakedSuiTvlTx = (inputs: { tx: TransactionBlock }) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.modules.staking,
				"total_sui_amount"
			),
			typeArguments: [],
			arguments: [tx.object(this.addresses.objects.staking)],
		});
	};

	// =========================================================================
	//  Positions
	// =========================================================================

	public fetchAllPositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakingPosition[]> => {
		const [stakes, unstakes] = await Promise.all([
			this.fetchAllStakePositions(inputs),
			this.fetchAllUnstakePositions(inputs),
		]);

		const positions = [...stakes, ...unstakes];

		return positions.sort(
			(a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
		);
	};

	public fetchAllUnstakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<UnstakePosition[]> => {
		const { walletAddress } = inputs;

		const [successEvents, requestEvents] = await Promise.all([
			// unstake success
			(
				await this.Provider.Events().fetchAllEvents({
					fetchEventsFunc: (eventsInputs) =>
						this.fetchUnstakeSuccessEvents({
							...eventsInputs,
							walletAddress,
						}),
				})
			).filter((event) => event.staker === inputs.walletAddress),
			// unstake request
			(
				await this.Provider.Events().fetchAllEvents({
					fetchEventsFunc: (eventsInputs) =>
						this.fetchUnstakeRequestEvents({
							...eventsInputs,
							walletAddress,
						}),
				})
			).filter((event) => event.staker === inputs.walletAddress),
		]);

		const positions: UnstakePosition[] = requestEvents.map((request) => {
			const foundIndex = successEvents.findIndex(
				(success) => success.afSuiWrapperId === request.afSuiWrapperId
			);
			if (foundIndex >= 0)
				return {
					...successEvents[foundIndex],
					state: "SUCCESS",
					epoch: request.epoch,
				};

			return {
				state: "REQUEST",
				...request,
			};
		});

		return positions;
	};

	public fetchAllStakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakePosition[]> => {
		const { walletAddress } = inputs;

		const [mintedEvents, successEvents, failedEvents, requestEvents] =
			await Promise.all([
				// afSui mint
				(
					await this.Provider.Events().fetchAllEvents({
						fetchEventsFunc: (eventsInputs) =>
							this.fetchAfSuiMintedEvents({
								...eventsInputs,
								walletAddress,
							}),
					})
				).filter((event) => event.staker === inputs.walletAddress),
				// stake success
				(
					await this.Provider.Events().fetchAllEvents({
						fetchEventsFunc: (eventsInputs) =>
							this.fetchStakeSuccessEvents({
								...eventsInputs,
								walletAddress,
							}),
					})
				).filter((event) => event.staker === inputs.walletAddress),
				// stake fail
				(
					await this.Provider.Events().fetchAllEvents({
						fetchEventsFunc: (eventsInputs) =>
							this.fetchStakeFailedEvents({
								...eventsInputs,
								walletAddress,
							}),
					})
				).filter((event) => event.staker === inputs.walletAddress),
				// stake request
				(
					await this.Provider.Events().fetchAllEvents({
						fetchEventsFunc: (eventsInput) =>
							this.fetchStakeRequestEvents({
								...eventsInput,
								walletAddress,
							}),
					})
				).filter((event) => event.staker === inputs.walletAddress),
			]);

		const positions: StakePosition[] = requestEvents.map((request) => {
			const foundMintIndex = mintedEvents.findIndex(
				(mint) => mint.suiWrapperId === request.suiWrapperId
			);
			if (foundMintIndex >= 0)
				return {
					...mintedEvents[foundMintIndex],
					state: "AFSUI_MINTED",
					validatorAddress: request.validatorAddress,
					epoch: request.epoch,
				};

			const foundSuccessIndex = successEvents.findIndex(
				(mint) => mint.suiWrapperId === request.suiWrapperId
			);
			if (foundSuccessIndex >= 0)
				return {
					...successEvents[foundSuccessIndex],
					state: "SUCCESS",
					afSuiMintAmount: undefined,
					epoch: request.epoch,
				};

			const foundFailedIndex = failedEvents.findIndex(
				(mint) => mint.suiWrapperId === request.suiWrapperId
			);
			if (foundFailedIndex >= 0)
				return {
					...failedEvents[foundFailedIndex],
					state: "FAILED",
					afSuiMintAmount: undefined,
					epoch: request.epoch,
				};

			return {
				state: "REQUEST",
				afSuiMintAmount: undefined,
				...request,
			};
		});

		return positions;
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchSuiTvl = async (): Promise<Balance> => {
		const tx = new TransactionBlock();
		this.getStakedSuiTvlTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchAfSuiExchangeRate = async (): Promise<number> => {
		const [suiTvl, afSuiSupply] = await Promise.all([
			this.fetchSuiTvl(),
			this.fetchAfSuiSupply(),
		]);
		return suiTvl <= BigInt(0) || afSuiSupply <= BigInt(0)
			? 1
			: Number(afSuiSupply) / Number(suiTvl);
	};

	// =========================================================================
	//  Events
	// =========================================================================

	// TODO: add and filtering once available
	public fetchStakeRequestEvents = async (inputs: UserEventsInputs) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			StakeRequestEventOnChain,
			StakeRequestEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.stakeRequest,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: Casting.staking.stakeRequestEventFromOnChain,
		});
	};

	public fetchUnstakeRequestEvents = async (inputs: UserEventsInputs) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeRequestEventOnChain,
			UnstakeRequestEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.unstakeRequest,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain:
				Casting.staking.unstakeRequestEventFromOnChain,
		});
	};

	public fetchStakeSuccessEvents = async (inputs: UserEventsInputs) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			StakeSuccessEventOnChain,
			StakeSuccessEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.stakeSuccess,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: Casting.staking.stakeSuccessEventFromOnChain,
		});
	};

	public fetchUnstakeSuccessEvents = async (inputs: UserEventsInputs) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeSuccessEventOnChain,
			UnstakeSuccessEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.unstakeSuccess,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain:
				Casting.staking.unstakeSuccessEventFromOnChain,
		});
	};

	public fetchStakeFailedEvents = async (inputs: UserEventsInputs) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			StakeFailedEventOnChain,
			StakeFailedEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.stakeFailed,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: Casting.staking.stakeFailedEventFromOnChain,
		});
	};

	public fetchAfSuiMintedEvents = async (inputs: UserEventsInputs) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			AfSuiMintedEventOnChain,
			AfSuiMintedEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.afSuiMinted,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: Casting.staking.afSuiMintedEventFromOnChain,
		});
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	public liquidStakingApy = (inputs: {
		delegatedStakes: DelegatedStake[];
		validatorApys: ValidatorsApy;
	}): number => {
		const { delegatedStakes, validatorApys } = inputs;

		const totalStakeAmount = Helpers.sumBigInt(
			delegatedStakes.map((stake) =>
				Helpers.sumBigInt(
					stake.stakes.map((innerStake) =>
						BigInt(innerStake.principal)
					)
				)
			)
		);

		const weightedAverageApy = delegatedStakes.reduce((acc, stake) => {
			const apy = validatorApys.apys.find(
				(apy) => apy.address === stake.validatorAddress
			)?.apy;
			if (apy === undefined) return acc;

			const weight =
				Number(
					Helpers.sumBigInt(
						stake.stakes.map((innerStake) =>
							BigInt(innerStake.principal)
						)
					)
				) / Number(totalStakeAmount);

			const weightedApy = apy * weight;
			return acc + weightedApy;
		}, 0);

		return weightedAverageApy;
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private stakeRequestEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.modules.actions,
			StakingApi.constants.eventNames.stakeRequest
		);

	private unstakeRequestEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.modules.actions,
			StakingApi.constants.eventNames.unstakeRequest
		);

	private stakeFailedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.modules.actions,
			StakingApi.constants.eventNames.stakeFailed
		);

	private stakeSuccessEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.modules.actions,
			StakingApi.constants.eventNames.stakeSuccess
		);

	private unstakeSuccessEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.modules.actions,
			StakingApi.constants.eventNames.unstakeSuccess
		);

	private afSuiMintedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.modules.actions,
			StakingApi.constants.eventNames.afSuiMinted
		);

	// =========================================================================
	//  Staking Positions Updating
	// =========================================================================

	// NOTE: should these functions be on FE only ?

	public static updateStakingPositionsFromEvent = (inputs: {
		stakingPositions: StakingPosition[];
		event: StakeEvent | UnstakeEvent;
	}): StakingPosition[] => {
		const positions = inputs.stakingPositions;
		const event = inputs.event;

		let newPositions: StakingPosition[] = [];

		const unstakePositions = positions.filter(isUnstakePosition);
		const newUnstakes = isUnstakeEvent(event)
			? this.updateUnstakePositionsFromEvent({
					event,
					unstakePositions,
			  })
			: unstakePositions;

		const stakePositions = positions.filter(isStakePosition);
		const newStakes = isStakeEvent(event)
			? this.updateStakePositionsFromEvent({
					event,
					stakePositions,
			  })
			: stakePositions;

		newPositions = [...newUnstakes, ...newStakes];

		return newPositions.sort(
			(a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
		);
	};

	private static updateStakePositionsFromEvent = (inputs: {
		stakePositions: StakePosition[];
		event: StakeEvent;
	}): StakePosition[] => {
		const foundPositionIndex = inputs.stakePositions.findIndex(
			(pos) => pos.suiWrapperId === inputs.event.suiWrapperId
		);
		if (foundPositionIndex < 0) {
			if (
				inputs.event.type.includes(
					this.constants.eventNames.stakeRequest
				)
			)
				return [
					{
						...(inputs.event as StakeRequestEvent),
						state: "REQUEST",
						afSuiMintAmount: undefined,
					},
					...inputs.stakePositions,
				];

			return inputs.stakePositions;
		}

		const foundStakePosition = inputs.stakePositions[foundPositionIndex];

		let position: StakePosition | undefined = undefined;
		if (inputs.event.type.includes(this.constants.eventNames.afSuiMinted))
			position = {
				...(inputs.event as AfSuiMintedEvent),
				state: "AFSUI_MINTED",
				validatorAddress: foundStakePosition.validatorAddress,
				epoch: foundStakePosition.epoch,
			};

		if (inputs.event.type.includes(this.constants.eventNames.stakeSuccess))
			position = {
				...(inputs.event as StakeSuccessEvent),
				state: "SUCCESS",
				afSuiMintAmount: undefined,
				epoch: foundStakePosition.epoch,
			};

		if (inputs.event.type.includes(this.constants.eventNames.stakeFailed))
			position = {
				...(inputs.event as StakeFailedEvent),
				state: "FAILED",
				afSuiMintAmount: undefined,
				epoch: foundStakePosition.epoch,
			};

		if (!position) return inputs.stakePositions;

		let newStakePositions = [...inputs.stakePositions];
		newStakePositions[foundPositionIndex] = position;

		return newStakePositions;
	};

	private static updateUnstakePositionsFromEvent = (inputs: {
		unstakePositions: UnstakePosition[];
		event: UnstakeEvent;
	}): UnstakePosition[] => {
		const foundPositionIndex = inputs.unstakePositions.findIndex(
			(pos) => pos.afSuiWrapperId === inputs.event.afSuiWrapperId
		);
		if (foundPositionIndex < 0) {
			if (
				inputs.event.type.includes(
					this.constants.eventNames.unstakeRequest
				)
			)
				return [
					{
						...(inputs.event as UnstakeRequestEvent),
						state: "REQUEST",
					},
					...inputs.unstakePositions,
				];

			return inputs.unstakePositions;
		}

		const foundPosition = inputs.unstakePositions[foundPositionIndex];

		let position: UnstakePosition | undefined = undefined;
		if (
			inputs.event.type.includes(this.constants.eventNames.unstakeSuccess)
		)
			position = {
				...(inputs.event as UnstakeSuccessEvent),
				state: "SUCCESS",
				epoch: foundPosition.epoch,
			};

		if (!position) return inputs.unstakePositions;

		let newPositions = [...inputs.unstakePositions];
		newPositions[foundPositionIndex] = position;

		return newPositions;
	};

	public fetchAfSuiSupply = async (): Promise<Balance> => {
		const tx = new TransactionBlock();
		this.getAfSuiSupplyTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};
}
