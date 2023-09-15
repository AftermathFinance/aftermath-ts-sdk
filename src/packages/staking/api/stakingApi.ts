import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	StakeEvent,
	StakePosition,
	StakeRequestEvent,
	StakingPosition,
	UnstakePosition,
	UnstakeEvent,
	isStakePosition,
	isUnstakePosition,
	isStakeEvent,
	isUnstakeEvent,
	ValidatorConfigObject,
	ApiStakeStakedSuiBody,
	ApiUnstakeBody,
	ApiStakeBody,
	ApiDelegatedStakesBody,
	SuiDelegatedStake,
} from "../stakingTypes";
import {
	AnyObjectType,
	ApiIndexerEventsBody,
	ApiIndexerUserEventsBody,
	Balance,
	CoinType,
	ObjectId,
	StakingAddresses,
	SuiAddress,
	UserEventsInputs,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import {
	AfSuiMintedEventOnChain,
	StakeRequestEventOnChain,
	UnstakeEventOnChain,
} from "./stakingApiCastingTypes";
import { Sui } from "../../sui";
import { Fixed } from "../../../general/utils/fixed";
import { StakingApiCasting } from "./stakingApiCasting";
import { DelegatedStake, ValidatorsApy } from "@mysten/sui.js/dist/cjs/client";

export class StakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			actions: "actions",
			events: "events",
			stakedSuiVault: "staked_sui_vault",
		},
		eventNames: {
			staked: "StakedEvent",
			unstaked: "UnstakedEvent",
			unstakeRequested: "UnstakeRequestedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: StakingAddresses;

	public readonly eventTypes: {
		staked: AnyObjectType;
		unstakeRequested: AnyObjectType;
		unstaked: AnyObjectType;
	};

	public readonly coinTypes: {
		afSui: CoinType;
	};

	public readonly objectTypes: {
		unverifiedValidatorOperationCap: AnyObjectType;
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

		this.eventTypes = {
			staked: this.stakedEventType(),
			unstakeRequested: this.unstakeRequestedEventType(),
			unstaked: this.unstakedEventType(),
		};

		this.coinTypes = {
			afSui: `${addresses.packages.afsui}::afsui::AFSUI`,
		};

		this.objectTypes = {
			unverifiedValidatorOperationCap: `${addresses.packages.lsd}::validator::UnverifiedValidatorOperationCap`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchDelegatedStakes = async (
		inputs: ApiDelegatedStakesBody
	): Promise<SuiDelegatedStake[]> => {
		const rawStakes = await this.Provider.provider.getStakes({
			owner: inputs.walletAddress,
		});

		const stakes = rawStakes.reduce((acc, stakeData) => {
			const stakesToAdd: SuiDelegatedStake[] = stakeData.stakes.map(
				(stake) => ({
					...stake,
					stakedSuiId: Helpers.addLeadingZeroesToType(
						stake.stakedSuiId
					),
					stakeRequestEpoch: BigInt(stake.stakeRequestEpoch),
					stakeActiveEpoch: BigInt(stake.stakeActiveEpoch),
					principal: BigInt(stake.principal),
					estimatedReward:
						stake.estimatedReward !== undefined
							? BigInt(stake.estimatedReward)
							: stake.estimatedReward,
					stakingPool: Helpers.addLeadingZeroesToType(
						stakeData.stakingPool
					),
					validatorAddress: Helpers.addLeadingZeroesToType(
						stakeData.validatorAddress
					),
				})
			);
			return [...acc, ...stakesToAdd];
		}, [] as SuiDelegatedStake[]);

		stakes.sort((a, b) =>
			Number(b.stakeRequestEpoch - a.stakeRequestEpoch)
		);

		return stakes;
	};

	public fetchValidatorApys = async (): Promise<ValidatorsApy> => {
		const apyData = await this.Provider.provider.getValidatorsApy();

		const apys = apyData.apys.map((apy) => ({
			...apy,
			address: Helpers.addLeadingZeroesToType(apy.address),
		}));

		return { ...apyData, apys };
	};

	public fetchValidatorConfigs = async (): Promise<
		ValidatorConfigObject[]
	> => {
		return this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType({
			parentObjectId: this.addresses.objects.validatorConfigsTable,
			objectsFromObjectIds: (objectIds) =>
				this.Provider.Objects().fetchCastObjectBatch({
					objectIds,
					objectFromSuiObjectResponse:
						StakingApiCasting.validatorConfigObjectFromSuiObjectResponse,
				}),
		});
	};

	public fetchOwnedValidatorOperationCaps = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<ValidatorOperationCapObject[]> => {
		const { walletAddress } = inputs;

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.unverifiedValidatorOperationCap,
			objectFromSuiObjectResponse:
				Casting.staking
					.validatorOperationCapObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Staking Transaction Commands
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
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_stake_and_keep"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(this.addresses.objects.referralVault), // ReferralVault
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
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_unstake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				typeof afSuiCoin === "string"
					? tx.object(afSuiCoin)
					: afSuiCoin,
			],
		});
	};

	public requestStakeStakedSuiVecTx = (inputs: {
		tx: TransactionBlock;
		stakedSuiIds: ObjectId[];
		validatorAddress: SuiAddress;
	}) => {
		const { tx, stakedSuiIds } = inputs;

		const stakedSuiIdsVec = tx.makeMoveVec({
			objects: stakedSuiIds.map((id) => tx.object(id)),
		});

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_stake_staked_sui_vec_and_keep"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.objects.referralVault), // ReferralVault
				stakedSuiIdsVec,
				tx.pure(inputs.validatorAddress, "address"),
			],
		});
	};

	// =========================================================================
	//  Inspection Transaction Commands
	// =========================================================================

	public afsuiToSuiExchangeRateTx = (inputs: {
		tx: TransactionBlock;
	}) /* (U128) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"afsui_to_sui_exchange_rate"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
			],
		});
	};

	public totalSuiAmountTx = (inputs: { tx: TransactionBlock }) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"total_sui_amount"
			),
			typeArguments: [],
			arguments: [tx.object(this.addresses.objects.stakedSuiVault)],
		});
	};

	// =========================================================================
	//  Validator Transaction Commands
	// =========================================================================

	public updateValidatorFeeTx = (inputs: {
		tx: TransactionBlock;
		validatorOperationCapId: ObjectId;
		newFee: bigint;
	}) => {
		const { tx, validatorOperationCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"update_validator_fee"
			),
			typeArguments: [],
			arguments: [
				typeof validatorOperationCapId === "string"
					? tx.object(validatorOperationCapId)
					: validatorOperationCapId, // UnverifiedValidatorOperationCap
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.pure(inputs.newFee, "u64"),
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildStakeTx = async (
		inputs: ApiStakeBody
	): Promise<TransactionBlock> => {
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

	public fetchBuildUnstakeTx = async (
		inputs: ApiUnstakeBody
	): Promise<TransactionBlock> => {
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

	public fetchBuildStakeStakedSuiTx = async (
		inputs: ApiStakeStakedSuiBody
	): Promise<TransactionBlock> => {
		const { referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		this.requestStakeStakedSuiVecTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public buildUpdateValidatorFeeTx = async (
		inputs: ApiUpdateValidatorFeeBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.updateValidatorFeeTx({
			...inputs,
			tx,
			newFee: Casting.numberToFixedBigInt(inputs.newFeePercentage),
		});

		return tx;
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

	public fetchAllStakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakePosition[]> => {
		const { walletAddress } = inputs;

<<<<<<< HEAD
		const stakedEvents = (
			await this.fetchStakedEvents({
				cursor: 0,
				limit: 100,
				walletAddress,
			})
		).events;

		return stakedEvents;
	};

	public fetchAllUnstakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<UnstakePosition[]> => {
		const { walletAddress } = inputs;

		const cursor = 0;
		const limit = 100;
		const [unstakedEvents, requestedEvents] = await Promise.all([
			// unstaked
			(
					cursor,
					limit,
					walletAddress,
				})
			).events,
			// unstake requested
			(
				await this.fetchUnstakeRequestedEvents({
					cursor,
					limit,
					walletAddress,
				})
			).events,
		]);

		const positions: UnstakePosition[] = requestedEvents.map((request) => {
			const foundMintIndex = unstakedEvents.findIndex(
				(mint) => mint.afSuiId === request.afSuiId
			);
			if (foundMintIndex >= 0)
				return {
					...unstakedEvents[foundMintIndex],
					state: "SUI_MINTED",
=======
		const eventsInputs: ApiIndexerEventsBody = {
			cursor: 0,
			limit: 100,
		};
		const [mintedEvents, requestEvents] = await Promise.all([
			// afSui mint
			(
				await this.fetchAfSuiMintedEvents({
					...eventsInputs,
					walletAddress,
				})
			).events,
			// stake request
			(
				await this.fetchStakeRequestEvents({
					...eventsInputs,
					walletAddress,
				})
			).events,
		]);

	};

	public fetchAfSuiToSuiExchangeRate = async (): Promise<number> => {
		const tx = new TransactionBlock();
		this.afsuiToSuiExchangeRateTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		const exchangeRate = Fixed.directCast(Casting.bigIntFromBytes(bytes));
		return exchangeRate <= 0 ? 1 : exchangeRate;
	};

	// =========================================================================
	//  Events
	// =========================================================================

<<<<<<< HEAD
	public async fetchStakedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/${walletAddress}/events/staked`,
=======
	public async fetchStakeRequestEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/events/staked/${walletAddress}`,
>>>>>>> main
			{
				cursor,
				limit,
			},
<<<<<<< HEAD
			Casting.staking.stakedEventFromOnChain
		);
	}

	public async fetchUnstakedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/${walletAddress}/events/unstaked`,
=======
			Casting.staking.stakeRequestEventFromIndexerOnChain
		);
	}

	public async fetchUnstakeEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/events/unstaked/${walletAddress}`,
>>>>>>> main
			{
				cursor,
				limit,
			},
<<<<<<< HEAD
			Casting.staking.unstakedEventFromOnChain
		);
	}

	public async fetchUnstakeRequestedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/${walletAddress}/events/unstake-requested`,
=======
			Casting.staking.unstakeEventFromIndexerOnChain
		);
	}

	public async fetchAfSuiMintedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/events/afsui_minted/${walletAddress}`,
>>>>>>> main
			{
				cursor,
				limit,
			},
<<<<<<< HEAD
			Casting.staking.unstakeRequestedEventFromOnChain
=======
			Casting.staking.afSuiMintedEventFromIndexerOnChain
>>>>>>> main
		);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	// TODO: use this function
	public liquidStakingApy = (inputs: {
		delegatedStakes: DelegatedStake[];
		validatorApys: ValidatorsApy;
	}): number => {
		throw new Error("TODO");

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

		// TODO: use bifilter
		const unstakePositions = positions.filter(isUnstakePosition);
		const newUnstakes = isUnstakeEvent(event)
			? [...unstakePositions, event]
			: unstakePositions;

		const stakePositions = positions.filter(isStakePosition);
		const newStakes = isStakeEvent(event)
			? [...stakePositions, event]
			: stakePositions;

		newPositions = [...newUnstakes, ...newStakes];

		return newPositions.sort(
			(a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
		);
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

<<<<<<< HEAD
	private stakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.staked
=======
	private stakeRequestEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.stakeRequest
		);

	private unstakeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstake
		);

	private afSuiMintedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.afSuiMinted
		);

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Stake Event Processing
	// =========================================================================

	private static updateStakePositionsFromEvent = (inputs: {
		stakePositions: StakePosition[];
		event: StakeEvent;
	}): StakePosition[] => {
		const foundPositionIndex = inputs.stakePositions.findIndex(
			(pos) => pos.suiId === inputs.event.suiId
>>>>>>> main
		);

	private unstakeRequestedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstaked
		);

	private unstakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.lsd,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstakeRequested
		);

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

<<<<<<< HEAD
	// =========================================================================
	//  Unstake Event Processing
	// =========================================================================

	private static updateUnstakePositionsFromEvent = (inputs: {
		unstakePositions: UnstakePosition[];
		event: UnstakeEvent;
	}): UnstakePosition[] => {
		const foundPositionIndex = inputs.unstakePositions.findIndex(
			(pos) => pos.afSuiId === inputs.event.afSuiId
		);
		if (foundPositionIndex < 0) {
			if (
				inputs.event.type.includes(
					this.constants.eventNames.unstakeRequested
				)
			)
				return [
					{
						...(inputs.event as UnstakeRequestedEvent),
						state: "REQUEST",
					},
					...inputs.unstakePositions,
				];

			return inputs.unstakePositions;
		}

		const foundStakePosition = inputs.unstakePositions[foundPositionIndex];

		let position: UnstakePosition | undefined = undefined;
		if (inputs.event.type.includes(this.constants.eventNames.unstaked))
			position = {
				...(inputs.event as UnstakedEvent),
				state: "SUI_MINTED",
				epoch: foundStakePosition.epoch,
			};

		if (
			inputs.event.type.includes(
				this.constants.eventNames.unstakeRequested
			)
		)
			position = {
				...(inputs.event as UnstakeRequestedEvent),
				state: "REQUEST",
				epoch: foundStakePosition.epoch,
			};

		if (!position) return inputs.unstakePositions;

		let newStakePositions = [...inputs.unstakePositions];
=======
		if (inputs.event.type.includes(this.constants.eventNames.stakeRequest))
			position = {
				...(inputs.event as StakeRequestEvent),
				state: "REQUEST",
				afSuiMintAmount: undefined,
				epoch: foundStakePosition.epoch,
			};

		if (!position) return inputs.stakePositions;

		let newStakePositions = [...inputs.stakePositions];
>>>>>>> main
		newStakePositions[foundPositionIndex] = position;

		return newStakePositions;
	};
}
