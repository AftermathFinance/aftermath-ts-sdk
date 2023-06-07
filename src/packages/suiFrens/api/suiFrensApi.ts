import {
	ObjectId,
	SuiAddress,
	SuiObjectInfo,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { SuiFrensApiCasting } from "./suiFrensApiCasting";
import {
	BreedSuiFrensEvent,
	SuiFrenBornEvent,
	StakedSuiFrenFeesEarned,
	SuiFrenObject,
	SuiFrenStats,
	SuiFrenVaultObject,
	StakeSuiFrenEvent,
	StakedSuiFrenReceiptObject,
	StakedSuiFrenReceiptWithSuiFrenObject,
	UnstakeSuiFrenEvent,
	SuiFrenAttributes,
} from "../suiFrensTypes";
import {
	BreedSuiFrenEventOnChain,
	SuiFrenBornEventOnChain,
	StakeSuiFrenEventOnChain,
	UnstakeSuiFrenEventOnChain,
} from "./suiFrensApiCastingTypes";
import { AmountInCoinAndUsd, CoinDecimal } from "../../coin/coinTypes";
import { Coin } from "../../coin/coin";
import { Helpers } from "../../../general/utils/helpers";
import { SuiFrens } from "../suiFrens";
import {
	AnyObjectType,
	Balance,
	SuiFrensAddresses,
	DynamicFieldObjectsWithCursor,
	DynamicFieldsInputs,
	EventsInputs,
	SerializedTransaction,
} from "../../../types";
import { Casting } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";

export class SuiFrensApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		suiFren: {
			modules: {
				suiFren: {
					moduleName: "suiFren",
				},
			},
		},

		suiFrenVault: {
			modules: {
				interface: {
					moduleName: "interface",
					functions: {
						stakeSuiFren: {
							name: "stake_suiFren",
						},
						unstakeSuiFren: {
							name: "unstake_suiFren",
						},
						withdrawFees: {
							name: "withdraw_fees",
						},
						withdrawFeesAmount: {
							name: "withdraw_fees_amount",
						},
						breedAndKeep: {
							name: "breed_and_keep",
						},
						breedWithStakedAndKeep: {
							name: "breed_with_staked_and_keep",
						},
						breedStakedWithStakedAndKeep: {
							name: "breed_staked_with_staked_and_keep",
						},
						transfer: {
							name: "transfer",
						},
					},
				},
				suiFrenVault: {
					moduleName: "suiFren_vault",
					functions: {
						feesEarnedIndividual: {
							name: "fees_earned_individual",
						},
						feesEarnedGlobal: {
							name: "fees_earned_global",
						},
					},
				},
			},
		},

		eventNames: {
			suiFrenBorn: "SuiFrenBorn",
			breedSuiFren: "BreedSuiFrenEvent",
			stakeSuiFren: "StakeSuiFrenEvent",
			unstakeSuiFren: "UnstakeSuiFrenEvent",
			withdrawFees: "WithdrawFeesEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: SuiFrensAddresses;

	public readonly objectTypes: {
		suiFrenObjectType: AnyObjectType;
		stakedSuiFrenReceiptObjectType: AnyObjectType;
	};

	public readonly eventTypes: {
		suiFrenBorn: AnyObjectType;
		breedSuiFrens: AnyObjectType;
		stakeSuiFren: AnyObjectType;
		unstakeSuiFren: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.suiFrens;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;

		this.objectTypes = {
			suiFrenObjectType: `${addresses.packages.suiFrens}::suiFren::SuiFren`,
			stakedSuiFrenReceiptObjectType: `${addresses.packages.suiFrensVault}::suiFren_vault::StakingReceipt`,
		};

		this.eventTypes = {
			suiFrenBorn: this.suiFrenBornEventType(),
			breedSuiFrens: this.breedSuiFrensEventType(),
			stakeSuiFren: this.stakeSuiFrenEventType(),
			unstakeSuiFren: this.unstakeSuiFrenEventType(),
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchStakedSuiFrenFeesEarned = async (
		stakedSuiFrenReceiptObjectId: ObjectId
	): Promise<StakedSuiFrenFeesEarned> => {
		const [suiFrenFeesEarnedIndividual, suiFrenFeesEarnedGlobal] =
			await Promise.all([
				this.fetchStakedSuiFrenFeesEarnedIndividual(
					stakedSuiFrenReceiptObjectId
				),
				this.fetchStakedSuiFrenFeesEarnedGlobal(),
			]);

		return {
			individualFees: suiFrenFeesEarnedIndividual,
			globalFees: suiFrenFeesEarnedGlobal,
		};
	};

	public fetchIsSuiFrenPackageOnChain = () =>
		this.Provider.Objects().fetchDoesObjectExist(
			this.addresses.packages.suiFrens
		);

	public fetchSuiFrensStakedInSuiFrenVaultWithAttributes = async (inputs: {
		attributes: Partial<SuiFrenAttributes>;
		limit: number;
		limitStepSize?: number;
		cursor?: ObjectId;
	}) => {
		const { limit, attributes } = inputs;

		const isComplete = (suiFrens: SuiFrenObject[]) => {
			return (
				this.filterSuiFrensWithAttributes(suiFrens, attributes)
					.length >= limit
			);
		};

		const suiFrensWithCursor =
			await this.Provider.DynamicFields().fetchDynamicFieldsUntil({
				...inputs,
				fetchFunc: this.fetchSuiFrensStakedInSuiFrenVault,
				isComplete,
			});

		const filteredSuiFrens = this.filterSuiFrensWithAttributes(
			suiFrensWithCursor.dynamicFieldObjects,
			attributes
		);
		const resizedSuiFrensWithCursor: DynamicFieldObjectsWithCursor<SuiFrenObject> =
			{
				nextCursor:
					suiFrensWithCursor.nextCursor ??
					limit < filteredSuiFrens.length
						? filteredSuiFrens[limit].objectId
						: suiFrensWithCursor.nextCursor,
				dynamicFieldObjects: filteredSuiFrens.slice(0, limit),
			};
		return resizedSuiFrensWithCursor;
	};

	public fetchStakedSuiFrenFeesEarnedIndividual = async (
		stakingReceiptId: ObjectId
	) => {
		const tx =
			this.suiFrenFeesEarnedIndividualDevInspectTransaction(
				stakingReceiptId
			);
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchStakedSuiFrenFeesEarnedGlobal = async () => {
		const tx = this.suiFrenFeesEarnedGlobalDevInspectTransaction();
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public suiFrenFeesEarnedIndividualDevInspectTransaction = (
		stakingReceiptId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.suiFrenVault
					.moduleName,

				SuiFrensApi.constants.suiFrenVault.modules.suiFrenVault
					.functions.feesEarnedIndividual.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(stakingReceiptId),
			],
		});

		return tx;
	};

	public suiFrenFeesEarnedGlobalDevInspectTransaction =
		(): TransactionBlock => {
			const tx = new TransactionBlock();

			tx.moveCall({
				target: Helpers.transactions.createTxTarget(
					this.addresses.packages.suiFrensVault,
					SuiFrensApi.constants.suiFrenVault.modules.suiFrenVault
						.moduleName,
					SuiFrensApi.constants.suiFrenVault.modules.suiFrenVault
						.functions.feesEarnedGlobal.name
				),
				typeArguments: [],
				arguments: [tx.object(this.addresses.objects.suiFrensVault)],
			});

			return tx;
		};

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchSuiFrenBornEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			SuiFrenBornEventOnChain,
			SuiFrenBornEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.suiFrenBorn,
			},
			eventFromEventOnChain:
				SuiFrensApiCasting.suiFrenBornEventFromOnChain,
		});

	public fetchBreedSuiFrensEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			BreedSuiFrenEventOnChain,
			BreedSuiFrensEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.breedSuiFrens,
			},
			eventFromEventOnChain:
				SuiFrensApiCasting.breedSuiFrensEventFromOnChain,
		});

	public fetchStakeSuiFrenEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakeSuiFrenEventOnChain,
			StakeSuiFrenEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.stakeSuiFren,
			},
			eventFromEventOnChain:
				SuiFrensApiCasting.stakeSuiFrenEventFromOnChain,
		});

	public fetchUnstakeSuiFrenEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeSuiFrenEventOnChain,
			UnstakeSuiFrenEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.unstakeSuiFren,
			},
			eventFromEventOnChain:
				SuiFrensApiCasting.unstakeSuiFrenEventFromOnChain,
		});

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  SuiFren Objects
	// =========================================================================

	public fetchSuiFrens = async (
		suiFrenIds: ObjectId[]
	): Promise<SuiFrenObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<SuiFrenObject>({
			objectIds: suiFrenIds,
			objectFromSuiObjectResponse:
				SuiFrensApiCasting.suiFrenObjectFromSuiObjectResponse,
		});
	};

	public fetchSuiFrensOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<SuiFrenObject[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			{
				walletAddress,
				objectType: this.objectTypes.suiFrenObjectType,
				objectFromSuiObjectResponse:
					SuiFrensApiCasting.suiFrenObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedSuiFrens = async (
		suiFrenIds: ObjectId[]
	): Promise<SuiFrenObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<SuiFrenObject>({
			objectIds: suiFrenIds,
			objectFromSuiObjectResponse:
				SuiFrensApiCasting.suiFrenObjectFromSuiObjectResponse,
		});
	};

	public fetchStakedSuiFrensOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<SuiFrenObject[]> => {
		// i. obtain all owned StakingReceipt
		const suiFrenIdsStakedByAddress = (
			await this.fetchStakedSuiFrenReceiptOwnedByAddress(walletAddress)
		).map((suiFrenStakingReceipt) => suiFrenStakingReceipt.suiFrenId);

		// ii. obtain a SuiFren object from each SuiFren ObjectId
		const stakedSuiFrens = await this.fetchStakedSuiFrens(
			suiFrenIdsStakedByAddress
		);

		return stakedSuiFrens;
	};

	public fetchSuiFrenVault = async (
		suiFrenVaultId: ObjectId
	): Promise<SuiFrenVaultObject> => {
		return this.Provider.Objects().fetchCastObject<SuiFrenVaultObject>({
			objectId: suiFrenVaultId,
			objectFromSuiObjectResponse:
				SuiFrensApiCasting.suiFrenVaultObjectFromSuiObjectResponse,
		});
	};

	public fetchSuiFrensStakedInSuiFrenVault = async (
		inputs: DynamicFieldsInputs
	) => {
		const suiFrenVaultId = this.addresses.objects.suiFrensVault;
		const suiFrenType = this.objectTypes.suiFrenObjectType;

		return await this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				...inputs,
				parentObjectId: suiFrenVaultId,
				objectsFromObjectIds: this.fetchSuiFrens,
				dynamicFieldType: suiFrenType,
			}
		);
	};

	// =========================================================================
	//  Staked SuiFren Receipt Objects
	// =========================================================================

	public fetchStakedSuiFrenReceipt = async (
		suiFrenStakingReceipt: ObjectId
	): Promise<StakedSuiFrenReceiptObject> => {
		return this.Provider.Objects().fetchCastObject<StakedSuiFrenReceiptObject>(
			{
				objectId: suiFrenStakingReceipt,
				objectFromSuiObjectResponse:
					SuiFrensApiCasting.stakedSuiFrenReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedSuiFrenReceipts = async (
		suiFrenStakingReceipts: ObjectId[]
	): Promise<StakedSuiFrenReceiptObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<StakedSuiFrenReceiptObject>(
			{
				objectIds: suiFrenStakingReceipts,
				objectFromSuiObjectResponse:
					SuiFrensApiCasting.stakedSuiFrenReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedSuiFrenReceiptOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedSuiFrenReceiptObject[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			{
				walletAddress,
				objectType: this.objectTypes.stakedSuiFrenReceiptObjectType,
				objectFromSuiObjectResponse:
					SuiFrensApiCasting.stakedSuiFrenReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedSuiFrenReceiptWithSuiFrensOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedSuiFrenReceiptWithSuiFrenObject[]> => {
		// i. obtain all owned StakingReceipt
		const stakingReceipts =
			await this.fetchStakedSuiFrenReceiptOwnedByAddress(walletAddress);

		// ii. obtain all SuiFren Object Ids
		const suiFrenIdsStakedByAddress = stakingReceipts.map(
			(suiFrenStakingReceipt) => suiFrenStakingReceipt.suiFrenId
		);

		// iii. obtain a SuiFren object from each SuiFren ObjectId
		let indexStakedSuiFrens: { [key: ObjectId]: SuiFrenObject } = {};
		(await this.fetchStakedSuiFrens(suiFrenIdsStakedByAddress)).forEach(
			(stakedSuiFren) => {
				indexStakedSuiFrens[stakedSuiFren.objectId] = stakedSuiFren;
			}
		);

		// iv. construct a StakingReceiptWithSuiFren object from each StakingReceipt <> SuiFren pair
		const suiFrenStakingReceiptsWithSuiFren = stakingReceipts.map(
			(stakingReceipt) => {
				return {
					objectId: stakingReceipt.objectId,
					suiFren: indexStakedSuiFrens[stakingReceipt.suiFrenId],
					unlockEpoch: stakingReceipt.unlockEpoch,
				};
			}
		);

		return suiFrenStakingReceiptsWithSuiFren;
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  SuiFren Staking
	// =========================================================================

	public fetchStakeSuiFrenTransaction = (
		suiFrenId: ObjectId
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTx(
			this.suiFrenStakeSuiFrenTransaction(suiFrenId)
		);

	public fetchUnstakeSuiFrenTransaction = (
		stakingReceiptId: ObjectId
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTx(
			this.suiFrenUnstakeSuiFrenTransaction(stakingReceiptId)
		);

	public fetchWithdrawStakedSuiFrenFeesTransaction = (
		stakingReceiptId: ObjectId
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTx(
			this.suiFrenWithdrawFeesTransaction(stakingReceiptId)
		);

	public fetchWithdrawStakedSuiFrenFeesAmountTransaction = (
		stakingReceiptId: ObjectId,
		amount: Balance
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTx(
			this.suiFrenWithdrawFeesAmountTransaction(stakingReceiptId, amount)
		);

	public fetchSuiFrenTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTx(
			this.suiFrenTransferTransaction(stakingReceiptId, recipient)
		);

	// =========================================================================
	//  Breeding Transactions
	// =========================================================================

	public fetchBreedSuiFrensTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<SerializedTransaction> => {
		const [parentOneIsOwned, parentTwoIsOwned] = await Promise.all([
			this.Provider.Objects().fetchIsObjectOwnedByAddress({
				objectId: parentOneId,
				walletAddress,
			}),
			this.Provider.Objects().fetchIsObjectOwnedByAddress({
				objectId: parentTwoId,
				walletAddress,
			}),
		]);

		const transaction = await this.fetchSuiFrenBuildBreedTransaction(
			walletAddress,
			parentOneId,
			parentOneIsOwned,
			parentTwoId,
			parentTwoIsOwned
		);

		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTx(
			transaction
		);
	};

	public fetchSuiFrenBuildBreedTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentOneIsOwned: boolean,
		parentTwoId: ObjectId,
		parentTwoIsOwned: boolean
	): Promise<TransactionBlock> => {
		if (parentOneIsOwned && parentTwoIsOwned) {
			// i. both suiFrens are owned
			return this.fetchBuildBreedAndKeepTransaction(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (parentOneIsOwned && !parentTwoIsOwned) {
			// iia. one of the SuiFrens is owned and the other is staked
			return this.fetchBuildBreedWithStakedAndKeepTransaction(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (!parentOneIsOwned && parentTwoIsOwned) {
			// iib. one of the SuiFren's is owned and the other is staked
			return this.fetchBuildBreedWithStakedAndKeepTransaction(
				walletAddress,
				parentTwoId,
				parentOneId
			);
		} else {
			// iii. both SuiFrens are staked
			return this.fetchBuildBreedStakedWithStakedAndKeepTransaction(
				walletAddress,
				parentTwoId,
				parentOneId
			);
		}
	};

	public fetchBuildBreedWithStakedAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const feeCoinType = SuiFrens.constants.breedingFees.coinType;
		const feeCoinAmount =
			SuiFrens.constants.breedingFees.amounts.breedWithStakedAndKeep;

		const coinArg = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: feeCoinType,
			coinAmount: feeCoinAmount,
		});

		const finalTx = this.addStakeBreedWithStakedAndKeepCommandToTransaction(
			tx,
			coinArg,
			parentOneId,
			parentTwoId
		);

		return finalTx;
	};

	public fetchBuildBreedStakedWithStakedAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const feeCoinType = SuiFrens.constants.breedingFees.coinType;
		const feeCoinAmount =
			SuiFrens.constants.breedingFees.amounts
				.breedStakedWithStakedAndKeep;

		const coinArg = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: feeCoinType,
			coinAmount: feeCoinAmount,
		});

		const finalTx = this.addStakeBreedWithStakedAndKeepCommandToTransaction(
			tx,
			coinArg,
			parentOneId,
			parentTwoId
		);

		return finalTx;
	};

	public fetchBuildBreedAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const feeCoinType = SuiFrens.constants.breedingFees.coinType;
		const feeCoinAmount =
			SuiFrens.constants.breedingFees.amounts.breedAndKeep;

		const coinArg = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: feeCoinType,
			coinAmount: feeCoinAmount,
		});

		const finalTx = this.addStakeBreedAndKeepCommandToTransaction(
			tx,
			coinArg,
			parentOneId,
			parentTwoId
		);

		return finalTx;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Breeding Transaction
	// =========================================================================

	public addStakeBreedAndKeepCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId | TransactionArgument,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.breedAndKeep.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(this.addresses.objects.suiFrensRegistry),
				typeof coinId === "string" ? tx.object(coinId) : coinId,
				tx.object(parentOneId),
				tx.object(parentTwoId),
			],
		});

		return tx;
	};

	public addStakeBreedWithStakedAndKeepCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId | TransactionArgument,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.breedWithStakedAndKeep.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(this.addresses.objects.suiFrensRegistry),
				typeof coinId === "string" ? tx.object(coinId) : coinId,
				tx.object(parentOneId),
				tx.object(parentTwoId),
			],
		});

		return tx;
	};

	public addStakeBreedStakedWithStakedAndKeepCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.breedStakedWithStakedAndKeep.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(this.addresses.objects.suiFrensRegistry),
				tx.object(coinId),
				tx.object(parentOneId),
				tx.object(parentTwoId),
			],
		});

		return tx;
	};

	// =========================================================================
	//  Staking Transaction Commands
	// =========================================================================

	public suiFrenStakeSuiFrenTransaction = (
		suiFrenId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.stakeSuiFren.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(suiFrenId),
			],
		});

		return tx;
	};

	public suiFrenUnstakeSuiFrenTransaction = (
		stakingReceiptId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,

				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,

				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.unstakeSuiFren.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(stakingReceiptId),
			],
		});

		return tx;
	};

	public suiFrenTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.transfer.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(stakingReceiptId),
				tx.pure(recipient),
			],
		});

		return tx;
	};

	// =========================================================================
	//  Fee Transaction Commands
	// =========================================================================

	public suiFrenWithdrawFeesTransaction = (
		stakingReceiptId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.withdrawFees.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(stakingReceiptId),
			],
		});

		return tx;
	};

	public suiFrenWithdrawFeesAmountTransaction = (
		stakingReceiptId: ObjectId,
		amount: Balance
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
				SuiFrensApi.constants.suiFrenVault.modules.interface.functions
					.withdrawFeesAmount.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault),
				tx.object(stakingReceiptId),
				tx.pure(amount.toString()),
			],
		});

		return tx;
	};

	// =========================================================================
	//  Stats
	// =========================================================================

	// TODO: make this function not exported from sdk (only internal use)
	// NOTE: this calculation will be  incorrect if feeCoinType is different for each fee
	public calcSuiFrenBreedingFees = (
		breedSuiFrenEvents: BreedSuiFrensEvent[],
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	): AmountInCoinAndUsd => {
		const breedingFeesInFeeCoin = Helpers.sum(
			breedSuiFrenEvents.map((event) =>
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

	public fetchSuiFrenStats = async (): Promise<SuiFrenStats> => {
		const breedSuiFrenEventsWithinTime =
			await this.Provider.Events().fetchEventsWithinTime({
				fetchEventsFunc: this.fetchBreedSuiFrensEvents,
				timeUnit: "hour",
				time: 24,
			});

		const feeCoin =
			breedSuiFrenEventsWithinTime.length === 0
				? SuiFrens.constants.breedingFees.coinType
				: breedSuiFrenEventsWithinTime[0].feeCoinWithBalance.coin;
		const feeCoinDecimals = (
			await this.Provider.Coin().fetchCoinMetadata(feeCoin)
		).decimals;
		const feeCoinPrice = await this.Provider.Prices().fetchPrice(feeCoin);

		const breedingFeesDaily = this.calcSuiFrenBreedingFees(
			breedSuiFrenEventsWithinTime,
			feeCoinDecimals,
			feeCoinPrice
		);

		const suiFrenVault = await this.fetchSuiFrenVault(
			this.addresses.objects.suiFrensVault
		);

		const { bredSuiFrens, stakedSuiFrens, breedingFeesGlobal } =
			await this.fetchSuiFrenVaultStats(
				suiFrenVault,
				feeCoinDecimals,
				feeCoinPrice
			);

		return {
			bredSuiFrens,
			stakedSuiFrens,
			breedingFeeCoin: feeCoin,
			breedingFeesGlobal,
			breedingFeesDaily,
			breedingVolumeDaily: breedSuiFrenEventsWithinTime.length,
		};
	};

	public fetchSuiFrenVaultStats = async (
		suiFrenVault: SuiFrenVaultObject,
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	) => {
		const globalFeesWithDecimals = Coin.balanceWithDecimals(
			suiFrenVault.globalFees,
			feeCoinDecimals
		);
		const globalFeesUsd = feeCoinPrice * globalFeesWithDecimals;
		const breedingFeesGlobal = {
			amount: globalFeesWithDecimals,
			amountUsd: globalFeesUsd,
		} as AmountInCoinAndUsd;

		return {
			bredSuiFrens: suiFrenVault.bredSuiFrens,
			stakedSuiFrens: suiFrenVault.stakedSuiFrens,
			breedingFeesGlobal,
		};
	};

	// =========================================================================
	//  SuiFren Attribute Filtering
	// =========================================================================

	public filterSuiFrensWithAttributes = (
		suiFrens: SuiFrenObject[],
		attributes: Partial<SuiFrenAttributes>
	) =>
		suiFrens.filter((suiFren) =>
			Object.entries(attributes).every(([key1, val1]) =>
				Object.entries(suiFren.attributes).some(
					([key2, val2]) => key1 === key2 && val1 === val2
				)
			)
		);

	// =========================================================================
	//  Helpers
	// =========================================================================

	public isStakedSuiFrenReceiptObjectType = (
		suiObjectInfo: SuiObjectInfo
	): boolean =>
		suiObjectInfo.type === this.objectTypes.stakedSuiFrenReceiptObjectType;

	public isSuiFrenObjectType = (suiObjectInfo: SuiObjectInfo): boolean =>
		suiObjectInfo.type === this.objectTypes.suiFrenObjectType;

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private suiFrenBornEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrens,
			SuiFrensApi.constants.suiFren.modules.suiFren.moduleName,
			SuiFrensApi.constants.eventNames.suiFrenBorn
		);

	private breedSuiFrensEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
			SuiFrensApi.constants.eventNames.breedSuiFren
		);

	private stakeSuiFrenEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
			SuiFrensApi.constants.eventNames.stakeSuiFren
		);

	private unstakeSuiFrenEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
			SuiFrensApi.constants.eventNames.unstakeSuiFren
		);
}
