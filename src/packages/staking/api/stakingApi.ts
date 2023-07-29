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
	StakeRequestEventOnChain,
	UnstakeEventOnChain,
} from "./stakingApiCastingTypes";
import { Sui } from "../../sui";
import { Fixed } from "../../../general/utils/fixed";
import { StakingApiCasting } from "./stakingApiCasting";

export class StakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			actions: "actions",
			events: "events",
			stakedSuiVault: "staked_sui_vault",
		},
		eventNames: {
			stakeRequest: "StakeSucceededEvent",
			unstake: "UnstakedEvent",
			afSuiMinted: "AFSUIWasMintedToStakerAccountEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: StakingAddresses;

	public readonly eventTypes: {
		stakeRequest: AnyObjectType;
		unstake: AnyObjectType;
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
			unstake: this.unstakeEventType(),
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
				StakingApi.constants.moduleNames.interface,
				"request_stake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.objects.referralVault), // ReferralVault
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
				StakingApi.constants.moduleNames.interface,
				"request_unstake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.objects.referralVault), // ReferralVault
				tx.object(this.addresses.objects.treasury), // Treasury
				typeof afSuiCoin === "string"
					? tx.object(afSuiCoin)
					: afSuiCoin,
			],
		});
	};

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

		const unstakeEvents = await (
			await this.Provider.Events().fetchAllEvents({
				fetchEventsFunc: (eventsInputs) =>
					this.fetchUnstakeEvents({
						...eventsInputs,
						walletAddress,
					}),
			})
		).filter((event) => event.staker === inputs.walletAddress);

		return unstakeEvents;
	};

	public fetchAllStakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakePosition[]> => {
		const { walletAddress } = inputs;

		const [mintedEvents, requestEvents] = await Promise.all([
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
				(mint) => mint.suiId === request.suiId
			);
			if (foundMintIndex >= 0)
				return {
					...mintedEvents[foundMintIndex],
					state: "AFSUI_MINTED",
					validatorAddress: request.validatorAddress,
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
		this.totalSuiAmountTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchAfSuiToSuiExchangeRate = async (): Promise<number> => {
		const tx = new TransactionBlock();
		this.afsuiToSuiExchangeRateTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		const exchangeRate = Casting.bigIntFromBytes(bytes);
		return Fixed.directCast(exchangeRate);
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

	public fetchUnstakeEvents = async (inputs: UserEventsInputs) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeEventOnChain,
			UnstakeEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.unstake,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: Casting.staking.unstakeEventFromOnChain,
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

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

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

		if (inputs.event.type.includes(this.constants.eventNames.stakeRequest))
			position = {
				...(inputs.event as StakeRequestEvent),
				state: "REQUEST",
				afSuiMintAmount: undefined,
				epoch: foundStakePosition.epoch,
			};

		if (!position) return inputs.stakePositions;

		let newStakePositions = [...inputs.stakePositions];
		newStakePositions[foundPositionIndex] = position;

		return newStakePositions;
	};
}
