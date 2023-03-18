import { EventId, ObjectId, SuiAddress, Transaction } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { CapysApiCasting } from "./capysApiCasting";
import { CapysApiHelpers } from "./capysApiHelpers";
import {
	BreedCapysEvent,
	CapyAttribute,
	CapyBornEvent,
	StakedCapyFeesEarned,
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
import { AmountInCoinAndUsd, CoinDecimal } from "../../coin/coinTypes";
import { Coin } from "../../coin/coin";
import { Helpers } from "../../../general/utils/helpers";
import { ObjectsApiHelpers } from "../../../general/api/objectsApiHelpers";
import { Capys } from "../capys";
import {
	Balance,
	DynamicFieldObjectsWithCursor,
	SerializedTransaction,
} from "../../../types";

export class CapysApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new CapysApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchStakedCapyFeesEarned = async (
		stakedCapyReceiptObjectId: ObjectId
	): Promise<StakedCapyFeesEarned> => {
		const [capyFeesEarnedIndividual, capyFeesEarnedGlobal] =
			await Promise.all([
				this.Helpers.fetchStakedCapyFeesEarnedIndividual(
					stakedCapyReceiptObjectId
				),
				this.Helpers.fetchStakedCapyFeesEarnedGlobal(),
			]);

		return {
			individualFees: capyFeesEarnedIndividual,
			globalFees: capyFeesEarnedGlobal,
		};
	};

	public fetchIsCapyPackageOnChain = () =>
		this.Provider.Objects().fetchDoesObjectExist(
			this.Helpers.addresses.packages.capy
		);

	public fetchCapysStakedInCapyVaultWithAttributes = async (
		attributes: CapyAttribute[],
		limit: number,
		cursor?: ObjectId,
		limitStepSize: number = 500
	) => {
		const isComplete = (capys: CapyObject[]) => {
			return (
				this.Helpers.filterCapysWithAttributes(capys, attributes)
					.length >= limit
			);
		};

		const capysWithCursor =
			await this.Provider.DynamicFields().fetchDynamicFieldsUntil(
				this.fetchCapysStakedInCapyVault,
				isComplete,
				cursor,
				limitStepSize
			);

		const filteredCapys = this.Helpers.filterCapysWithAttributes(
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

	public fetchCapyBornEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			CapyBornEventOnChain,
			CapyBornEvent
		>(
			{
				MoveEvent: this.Helpers.eventTypes.capyBorn,
			},
			CapysApiCasting.capyBornEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchBreedCapysEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			BreedCapyEventOnChain,
			BreedCapysEvent
		>(
			{
				MoveEvent: this.Helpers.eventTypes.breedCapys,
			},
			CapysApiCasting.breedCapysEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchStakeCapyEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakeCapyEventOnChain,
			StakeCapyEvent
		>(
			{
				MoveEvent: this.Helpers.eventTypes.stakeCapy,
			},
			CapysApiCasting.stakeCapyEventFromOnChain,
			cursor,
			eventLimit
		);

	public fetchUnstakeCapyEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeCapyEventOnChain,
			UnstakeCapyEvent
		>(
			{
				MoveEvent: this.Helpers.eventTypes.unstakeCapy,
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

	public fetchCapys = async (capyIds: ObjectId[]): Promise<CapyObject[]> => {
		return this.Provider.Objects().fetchFilterAndCastObjectBatch<CapyObject>(
			capyIds,
			ObjectsApiHelpers.objectExists,
			CapysApiCasting.capyObjectFromSuiObjectResponse
		);
	};

	public fetchCapysOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<CapyObject[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			walletAddress,
			this.Helpers.isCapyObjectType,
			this.fetchCapys
		);
	};

	public fetchStakedCapys = async (
		capyIds: ObjectId[]
	): Promise<CapyObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<CapyObject>(
			capyIds,
			CapysApiCasting.capyObjectFromSuiObjectResponse
		);
	};

	public fetchStakedCapysOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<CapyObject[]> => {
		// i. obtain all owned StakingReceipt
		const capyIdsStakedByAddress = (
			await this.fetchStakedCapyReceiptOwnedByAddress(walletAddress)
		).map((capyStakingReceipt) => capyStakingReceipt.capyId);

		// ii. obtain a Capy object from each Capy ObjectId
		const stakedCapys = await this.fetchStakedCapys(capyIdsStakedByAddress);

		return stakedCapys;
	};

	public fetchCapyVault = async (
		capyVaultId: ObjectId
	): Promise<CapyVaultObject> => {
		return this.Provider.Objects().fetchCastObject<CapyVaultObject>(
			capyVaultId,
			CapysApiCasting.capyVaultObjectFromSuiObjectResponse
		);
	};

	public fetchCapysStakedInCapyVault = async (
		cursor?: ObjectId,
		limit?: number
	) => {
		const capyVaultId = this.Helpers.addresses.objects.capyVault;
		const capyType = this.Helpers.objectTypes.capyObjectType;

		return await this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			capyVaultId,
			this.fetchCapys,
			capyType,
			cursor,
			limit
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Staked Capy Receipt Objects
	/////////////////////////////////////////////////////////////////////

	public fetchStakedCapyReceipt = async (
		capyStakingReceipt: ObjectId
	): Promise<StakedCapyReceiptObject> => {
		return this.Provider.Objects().fetchCastObject<StakedCapyReceiptObject>(
			capyStakingReceipt,
			CapysApiCasting.stakedCapyReceiptObjectFromSuiObjectResponse
		);
	};

	public fetchStakedCapyReceipts = async (
		capyStakingReceipts: ObjectId[]
	): Promise<StakedCapyReceiptObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<StakedCapyReceiptObject>(
			capyStakingReceipts,
			CapysApiCasting.stakedCapyReceiptObjectFromSuiObjectResponse
		);
	};

	public fetchStakedCapyReceiptOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedCapyReceiptObject[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			walletAddress,
			this.Helpers.isStakedCapyReceiptObjectType,
			this.fetchStakedCapyReceipts
		);
	};

	public fetchStakedCapyReceiptWithCapysOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedCapyReceiptWithCapyObject[]> => {
		// i. obtain all owned StakingReceipt
		const stakingReceipts = await this.fetchStakedCapyReceiptOwnedByAddress(
			walletAddress
		);

		// ii. obtain all Capy Object Ids
		const capyIdsStakedByAddress = stakingReceipts.map(
			(capyStakingReceipt) => capyStakingReceipt.capyId
		);

		// iii. obtain a Capy object from each Capy ObjectId
		let indexStakedCapys: { [key: ObjectId]: CapyObject } = {};
		(await this.fetchStakedCapys(capyIdsStakedByAddress)).forEach(
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

	public fetchStakeCapyTransaction = (
		capyId: ObjectId
	): SerializedTransaction =>
		this.Helpers.capyStakeCapyTransaction(capyId).serialize();

	public fetchUnstakeCapyTransaction = (
		stakingReceiptId: ObjectId
	): SerializedTransaction =>
		this.Helpers.capyUnstakeCapyTransaction(stakingReceiptId).serialize();

	public fetchWithdrawStakedCapyFeesTransaction = (
		stakingReceiptId: ObjectId
	): SerializedTransaction =>
		this.Helpers.capyWithdrawFeesTransaction(stakingReceiptId).serialize();

	public fetchWithdrawStakedCapyFeesAmountTransaction = (
		stakingReceiptId: ObjectId,
		amount: Balance
	): SerializedTransaction =>
		this.Helpers.capyWithdrawFeesAmountTransaction(
			stakingReceiptId,
			amount
		).serialize();

	public fetchCapyTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress
	): SerializedTransaction =>
		this.Helpers.capyTransferTransaction(
			stakingReceiptId,
			recipient
		).serialize();

	/////////////////////////////////////////////////////////////////////
	//// Capy Breeding
	/////////////////////////////////////////////////////////////////////

	public fetchBreedCapysTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<SerializedTransaction> => {
		const [parentOneIsOwned, parentTwoIsOwned] = await Promise.all([
			this.Provider.Objects().fetchIsObjectOwnedByAddress(
				parentOneId,
				walletAddress
			),
			this.Provider.Objects().fetchIsObjectOwnedByAddress(
				parentTwoId,
				walletAddress
			),
		]);

		const transaction = await this.Helpers.fetchCapyBuildBreedTransaction(
			walletAddress,
			parentOneId,
			parentOneIsOwned,
			parentTwoId,
			parentTwoIsOwned
		);

		return transaction.serialize();
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
			await this.Provider.Events().fetchEventsWithinTime(
				this.fetchBreedCapysEvents,
				"hour",
				24
			);

		const feeCoin =
			breedCapyEventsWithinTime.length === 0
				? Capys.constants.breedingFees.coinType
				: breedCapyEventsWithinTime[0].feeCoinWithBalance.coin;
		const feeCoinDecimals = (
			await this.Provider.Coin().fetchCoinMetadata(feeCoin)
		).decimals;
		const feeCoinPrice = await this.Provider.Prices().fetchPrice(feeCoin);

		const breedingFeesDaily = this.calcCapyBreedingFees(
			breedCapyEventsWithinTime,
			feeCoinDecimals,
			feeCoinPrice
		);

		const capyVault = await this.fetchCapyVault(
			this.Helpers.addresses.objects.capyVault
		);

		const { bredCapys, stakedCapys, breedingFeesGlobal } =
			await this.Helpers.fetchCapyVaultStats(
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
