import {
	EventId,
	ObjectId,
	SignableTransaction,
	SuiAddress,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { CapysApiCasting } from "./capysApiCasting";
import { CapysApiHelpers } from "./capysApiHelpers";
import {
	BreedCapysEvent,
	CapyAttribute,
	CapyBornEvent,
	CapyObject,
	CapyStats,
	CapyVaultObject,
	StakeCapyEvent,
	StakedCapyReceiptObject,
	StakedCapyReceiptWithCapyObject,
	UnstakeCapyEvent,
} from "../capysTypes";
import {
	BreedCapyEventOnChain,
	CapyBornEventOnChain,
	StakeCapyEventOnChain,
	UnstakeCapyEventOnChain,
} from "./capysApiCastingTypes";
import { CastingApiHelpers } from "../../../general/api/castingApiHelpers";
import { AmountInCoinAndUsd, CoinDecimal } from "../../coin/coinTypes";
import { Coin } from "../../coin/coin";
import { Helpers } from "../../../general/utils/helpers";
import { ObjectsApiHelpers } from "../../../general/api/objectsApiHelpers";
import { Capys } from "../capys";
import { Balance, DynamicFieldObjectsWithCursor } from "../../../types";

export class CapysApi extends CapysApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(Provider: AftermathApi) {
		super(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchStakedCapyFeesEarnedIndividual = async (
		stakingReceiptId: ObjectId
	) => {
		const moveCallTransaction =
			this.capyFeesEarnedIndividualMoveCall(stakingReceiptId);
		const bytes =
			await this.Provider.Inspections.fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return CastingApiHelpers.bigIntFromBytes(bytes);
	};

	public fetchCapyFeesEarnedGlobal = async () => {
		const moveCallTransaction = this.capyFeesEarnedGlobalMoveCall();
		const bytes =
			await this.Provider.Inspections.fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return CastingApiHelpers.bigIntFromBytes(bytes);
	};

	public fetchIsCapyPackageOnChain = () =>
		this.Provider.Objects.fetchDoesObjectExist(
			this.addresses.packages.capy
		);

	public fetchCapysStakedInCapyVaultWithAttributes = async (
		attributes: CapyAttribute[],
		limit: number,
		cursor?: ObjectId,
		limitStepSize: number = 500
	) => {
		const isComplete = (capys: CapyObject[]) => {
			return (
				this.filterCapysWithAttributes(capys, attributes).length >=
				limit
			);
		};

		const capysWithCursor =
			await this.Provider.DynamicFields.fetchDynamicFieldsUntil(
				this.fetchCapysStakedInCapyVault,
				isComplete,
				cursor,
				limitStepSize
			);

		const filteredCapys = this.filterCapysWithAttributes(
			capysWithCursor.dynamicFieldObjects,
			attributes
		);
		const resizedCapysWithCursor: DynamicFieldObjectsWithCursor<CapyObject> =
			{
				nextCursor:
					capysWithCursor.nextCursor ?? limit < filteredCapys.length
						? filteredCapys[limit].objectId
						: capysWithCursor.nextCursor,
				dynamicFieldObjects: filteredCapys.slice(0, limit),
			};
		return resizedCapysWithCursor;
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchCapyCapyBornEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events.fetchCastEventsWithCursor<
			CapyBornEventOnChain,
			CapyBornEvent
		>(
			{
				MoveEvent: this.eventTypes.capyBorn,
			},
			CapysApiCasting.capyBornEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchCapyBreedCapyEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events.fetchCastEventsWithCursor<
			BreedCapyEventOnChain,
			BreedCapysEvent
		>(
			{
				MoveEvent: this.eventTypes.breedCapys,
			},
			CapysApiCasting.breedCapyEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchCapyStakeCapyEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events.fetchCastEventsWithCursor<
			StakeCapyEventOnChain,
			StakeCapyEvent
		>(
			{
				MoveEvent: this.eventTypes.stakeCapy,
			},
			CapysApiCasting.stakeCapyEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchCapyUnstakeCapyEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events.fetchCastEventsWithCursor<
			UnstakeCapyEventOnChain,
			UnstakeCapyEvent
		>(
			{
				MoveEvent: this.eventTypes.unstakeCapy,
			},
			CapysApiCasting.unstakeCapyEventFromOnChain,
			cursor,
			eventLimit
		);

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Capy Objects
	/////////////////////////////////////////////////////////////////////

	public fetchCapyBatch = async (
		capyIds: ObjectId[]
	): Promise<CapyObject[]> => {
		return this.Provider.Objects.fetchFilterAndCastObjectBatch<CapyObject>(
			capyIds,
			ObjectsApiHelpers.objectExists,
			CapysApiCasting.capyObjectFromGetObjectDataResponse
		);
	};

	public fetchCapysOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<CapyObject[]> => {
		return await this.Provider.Objects.fetchFilterAndCastObjectsOwnedByAddress(
			walletAddress,
			this.isCapyObjectType,
			this.fetchCapyBatch
		);
	};

	public fetchStakedCapyBatch = async (
		capyIds: ObjectId[]
	): Promise<CapyObject[]> => {
		return this.Provider.Objects.fetchCastObjectBatch<CapyObject>(
			capyIds,
			CapysApiCasting.capyObjectFromGetObjectDataResponse
		);
	};

	public fetchCapysStakedByAddress = async (
		walletAddress: SuiAddress
	): Promise<CapyObject[]> => {
		// i. obtain all owned StakingReceipt
		const capyIdsStakedByAddress = (
			await this.fetchStakedCapyReceiptObjectsOwnedByAddress(
				walletAddress
			)
		).map((capyStakingReceipt) => capyStakingReceipt.capyId);

		// ii. obtain a Capy object from each Capy ObjectId
		const stakedCapys = await this.fetchStakedCapyBatch(
			capyIdsStakedByAddress
		);

		return stakedCapys;
	};

	public fetchCapyVault = async (
		capyVaultId: ObjectId
	): Promise<CapyVaultObject> => {
		return this.Provider.Objects.fetchCastObject<CapyVaultObject>(
			capyVaultId,
			CapysApiCasting.capyVaultObjectFromGetObjectDataResponse
		);
	};

	public fetchCapysStakedInCapyVault = async (
		cursor?: ObjectId,
		limit?: number
	) => {
		const capyVaultId = this.addresses.objects.capyVault;
		const capyType = this.objectTypes.capyObjectType;

		return await this.Provider.DynamicFields.fetchCastDynamicFieldsOfTypeWithCursor(
			capyVaultId,
			this.fetchCapyBatch,
			capyType,
			cursor,
			limit
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Staked Capy Receipt Objects
	/////////////////////////////////////////////////////////////////////

	public fetchStakedCapyReceiptObject = async (
		capyStakingReceipt: ObjectId
	): Promise<StakedCapyReceiptObject> => {
		return this.Provider.Objects.fetchCastObject<StakedCapyReceiptObject>(
			capyStakingReceipt,
			CapysApiCasting.stakedCapyReceiptObjectFromGetObjectDataResponse
		);
	};

	public fetchStakedCapyReceiptObjects = async (
		capyStakingReceipts: ObjectId[]
	): Promise<StakedCapyReceiptObject[]> => {
		return this.Provider.Objects.fetchCastObjectBatch<StakedCapyReceiptObject>(
			capyStakingReceipts,
			CapysApiCasting.stakedCapyReceiptObjectFromGetObjectDataResponse
		);
	};

	public fetchStakedCapyReceiptObjectsOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedCapyReceiptObject[]> => {
		return await this.Provider.Objects.fetchFilterAndCastObjectsOwnedByAddress(
			walletAddress,
			this.isStakedCapyReceiptObjectType,
			this.fetchStakedCapyReceiptObjects
		);
	};

	public fetchStakedCapyReceiptWithCapyObjectsOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedCapyReceiptWithCapyObject[]> => {
		// i. obtain all owned StakingReceipt
		const stakingReceipts =
			await this.fetchStakedCapyReceiptObjectsOwnedByAddress(
				walletAddress
			);

		// ii. obtain all Capy Object Ids
		const capyIdsStakedByAddress = stakingReceipts.map(
			(capyStakingReceipt) => capyStakingReceipt.capyId
		);

		// iii. obtain a Capy object from each Capy ObjectId
		let indexStakedCapys: { [key: ObjectId]: CapyObject } = {};
		(await this.fetchStakedCapyBatch(capyIdsStakedByAddress)).forEach(
			(stakedCapy) => {
				indexStakedCapys[stakedCapy.objectId] = stakedCapy;
			}
		);

		// iv. construct a StakingReceiptWithCapy object from each StakingReceipt <> Capy pair
		const capyStakingReceiptsWithCapy = stakingReceipts.map(
			(stakingReceipt) => {
				return {
					objectId: stakingReceipt.objectId,
					capy: indexStakedCapys[stakingReceipt.capyId],
					unlockEpoch: stakingReceipt.unlockEpoch,
				} as StakedCapyReceiptWithCapyObject;
			}
		);

		return capyStakingReceiptsWithCapy;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Capy Staking
	/////////////////////////////////////////////////////////////////////

	public fetchCapyStakeCapyTransactions = (
		capyId: ObjectId
	): SignableTransaction => this.capyStakeCapyTransaction(capyId);

	public fetchCapyUnstakeCapyTransactions = (
		stakingReceiptId: ObjectId
	): SignableTransaction => this.capyUnstakeCapyTransaction(stakingReceiptId);

	public fetchCapyWithdrawFeesTransactions = (
		stakingReceiptId: ObjectId
	): SignableTransaction =>
		this.capyWithdrawFeesTransaction(stakingReceiptId);

	public fetchCapyWithdrawFeesAmountTransactions = (
		stakingReceiptId: ObjectId,
		amount: Balance
	): SignableTransaction =>
		this.capyWithdrawFeesAmountTransaction(stakingReceiptId, amount);

	public fetchCapyTransferTransactions = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress
	): SignableTransaction =>
		this.capyTransferTransaction(stakingReceiptId, recipient);

	/////////////////////////////////////////////////////////////////////
	//// Capy Breeding
	/////////////////////////////////////////////////////////////////////

	public fetchCapyBreedTransactions = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	) => {
		const [parentOneIsOwned, parentTwoIsOwned] = await Promise.all([
			this.Provider.Objects.fetchIsObjectOwnedByAddress(
				parentOneId,
				walletAddress
			),
			this.Provider.Objects.fetchIsObjectOwnedByAddress(
				parentTwoId,
				walletAddress
			),
		]);
		const transactions = await this.fetchCapyBuildBreedTransactions(
			walletAddress,
			parentOneId,
			parentOneIsOwned,
			parentTwoId,
			parentTwoIsOwned
		);
		return transactions;
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// TODO: make this function not exported from sdk (only internal use)
	// NOTE: this calculation will be  incorrect if feeCoinType is different for each fee
	public calcCapyBreedingFees = (
		breedCapyEvents: BreedCapysEvent[],
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	): AmountInCoinAndUsd => {
		const breedingFeesInFeeCoin = Helpers.sum(
			breedCapyEvents.map((event) =>
				Coin.balanceWithDecimals(
					event.feeCoinWithBalance.balance,
					feeCoinDecimals
				)
			)
		);

		const breedingFeesUsd = feeCoinPrice * breedingFeesInFeeCoin;
		return {
			amount: breedingFeesInFeeCoin,
			amountUsd: breedingFeesUsd,
		};
	};

	public fetchCapyStats = async (): Promise<CapyStats> => {
		const breedCapyEventsWithinTime =
			await this.Provider.Events.fetchEventsWithinTime(
				this.fetchCapyBreedCapyEvents,
				"hour",
				24
			);

		const feeCoin =
			breedCapyEventsWithinTime.length === 0
				? Capys.constants.breedingFees.coinType
				: breedCapyEventsWithinTime[0].feeCoinWithBalance.coin;
		const feeCoinDecimals = (
			await this.Provider.Coin.fetchCoinMetadata(feeCoin)
		).decimals;
		const feeCoinPrice = await this.Provider.Prices.fetchPrice(feeCoin);

		const breedingFeesDaily = this.calcCapyBreedingFees(
			breedCapyEventsWithinTime,
			feeCoinDecimals,
			feeCoinPrice
		);

		const capyVault = await this.fetchCapyVault(
			this.addresses.objects.capyVault
		);

		const { bredCapys, stakedCapys, breedingFeesGlobal } =
			await this.fetchCapyVaultStats(
				capyVault,
				feeCoinDecimals,
				feeCoinPrice
			);

		return {
			bredCapys,
			stakedCapys,
			breedingFeeCoin: feeCoin,
			breedingFeesGlobal,
			breedingFeesDaily,
			breedingVolumeDaily: breedCapyEventsWithinTime.length,
		};
	};
}
