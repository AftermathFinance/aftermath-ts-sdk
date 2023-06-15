import {
	ObjectId,
	SuiAddress,
	SuiObjectInfo,
	TransactionArgument,
	TransactionBlock,
	bcs,
	getObjectFields,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { SuiFrensApiCasting } from "./suiFrensApiCasting";
import {
	MixSuiFrensEvent,
	SuiFrenBornEvent,
	SuiFrenObject,
	SuiFrenStats,
	SuiFrenVaultObject,
	StakeSuiFrenEvent,
	StakedSuiFrenMetadataObject,
	UnstakeSuiFrenEvent,
	SuiFrenAttributes,
} from "../suiFrensTypes";
import {
	MixSuiFrenEventOnChain,
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
import { SupportOption } from "prettier";

export class SuiFrensApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			capyLabs: "capy_labs",
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
						mixAndKeep: {
							name: "mix_and_keep",
						},
						mixWithStakedAndKeep: {
							name: "mix_with_staked_and_keep",
						},
						mixStakedWithStakedAndKeep: {
							name: "mix_staked_with_staked_and_keep",
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
			mixSuiFren: "MixSuiFrenEvent",
			stakeSuiFren: "StakeSuiFrenEvent",
			unstakeSuiFren: "UnstakeSuiFrenEvent",
			withdrawFees: "WithdrawFeesEvent",
		},

		dynamicFieldKeys: {
			mixLimit: "MixLimitKey",
			lastEpochMixed: "LastEpochMixedKey",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: SuiFrensAddresses;

	public readonly objectTypes: {
		suiFren: AnyObjectType;
		capy: AnyObjectType;
		stakedSuiFrenReceipt: AnyObjectType;
	};

	public readonly eventTypes: {
		suiFrenBorn: AnyObjectType;
		mixSuiFrens: AnyObjectType;
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
			suiFren: `${addresses.packages.suiFrens}::suifrens::SuiFren`,
			capy: `${addresses.packages.suiFrens}::capy::Capy`,
			stakedSuiFrenReceipt: `${addresses.packages.suiFrensVault}::suiFren_vault::StakingReceipt`,
		};

		this.eventTypes = {
			suiFrenBorn: this.suiFrenBornEventType(),
			mixSuiFrens: this.mixSuiFrensEventType(),
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

	public fetchMixingLimit = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		const tx = new TransactionBlock();

		this.mixingLimitTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		const unwrapped = Casting.unwrapDeserializedOption(
			bcs.de("Option<u8>", new Uint8Array(bytes))
		);
		return unwrapped === undefined ? undefined : BigInt(unwrapped);
	};

	public fetchLastEpochMixed = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		const tx = new TransactionBlock();

		this.lastEpochMixedTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		const unwrapped = Casting.unwrapDeserializedOption(
			bcs.de("Option<u64>", new Uint8Array(bytes))
		);
		return unwrapped === undefined ? undefined : BigInt(unwrapped);
	};

	public fetchStakedSuiFrenFeesEarned = async (
		stakedSuiFrenReceiptObjectId: ObjectId
	): Promise<{}> => {
		// StakedSuiFrenFeesEarned
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

	public fetchStakedSuiFrensDynamicFieldsWithFilters = async (inputs: {
		attributes: Partial<SuiFrenAttributes>;
		sortBy?: SupportOption;
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
				fetchFunc: this.fetchStakedSuiFrensDynamicFields,
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
			eventFromEventOnChain: Casting.suiFrens.suiFrenBornEventFromOnChain,
		});

	public fetchMixSuiFrensEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			MixSuiFrenEventOnChain,
			MixSuiFrensEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.mixSuiFrens,
			},
			eventFromEventOnChain: Casting.suiFrens.mixSuiFrensEventFromOnChain,
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
				Casting.suiFrens.stakeSuiFrenEventFromOnChain,
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
				Casting.suiFrens.unstakeSuiFrenEventFromOnChain,
		});

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  CapyLabsApp Object
	// =========================================================================

	public fetchCapyLabsApp = async () => {
		return this.Provider.Objects().fetchCastObject({
			objectId: this.addresses.objects.capyLabsApp,
			objectFromSuiObjectResponse:
				Casting.suiFrens.capyLabsAppObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  SuiFren Objects
	// =========================================================================

	public fetchSuiFrens = async (
		suiFrenIds: ObjectId[]
	): Promise<SuiFrenObject[]> => {
		const partialSuiFrens =
			await this.Provider.Objects().fetchCastObjectBatch({
				objectIds: suiFrenIds,
				objectFromSuiObjectResponse:
					Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
				options: {
					showDisplay: true,
					showType: true,
				},
			});

		return this.fetchCompletePartialSuiFrenObjects(partialSuiFrens);
	};

	public fetchSuiFrensOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<SuiFrenObject[]> => {
		const partialSuiFrens =
			await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.suiFren,
				objectFromSuiObjectResponse:
					Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
				withDisplay: true,
			});

		return this.fetchCompletePartialSuiFrenObjects(partialSuiFrens);
	};

	public fetchStakedSuiFrens = async (
		suiFrenIds: ObjectId[]
	): Promise<SuiFrenObject[]> => {
		const partialSuiFrens =
			await this.Provider.Objects().fetchCastObjectBatch({
				objectIds: suiFrenIds,
				objectFromSuiObjectResponse:
					Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
				options: {
					showDisplay: true,
					showType: true,
				},
			});

		return this.fetchCompletePartialSuiFrenObjects(partialSuiFrens);
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
				Casting.suiFrens.suiFrenVaultObjectFromSuiObjectResponse,
		});
	};

	public fetchStakedSuiFrensDynamicFields = async (
		inputs: DynamicFieldsInputs
	) => {
		const suiFrenVaultId = this.addresses.objects.suiFrensVault;
		const suiFrenType = this.objectTypes.suiFren;

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
	): Promise<StakedSuiFrenMetadataObject> => {
		return this.Provider.Objects().fetchCastObject<StakedSuiFrenMetadataObject>(
			{
				objectId: suiFrenStakingReceipt,
				objectFromSuiObjectResponse:
					Casting.suiFrens
						.stakedSuiFrenReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedSuiFrenReceipts = async (
		suiFrenStakingReceipts: ObjectId[]
	): Promise<StakedSuiFrenMetadataObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<StakedSuiFrenMetadataObject>(
			{
				objectIds: suiFrenStakingReceipts,
				objectFromSuiObjectResponse:
					Casting.suiFrens
						.stakedSuiFrenReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedSuiFrenReceiptOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedSuiFrenMetadataObject[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			{
				walletAddress,
				objectType: this.objectTypes.stakedSuiFrenReceipt,
				objectFromSuiObjectResponse:
					Casting.suiFrens
						.stakedSuiFrenReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedSuiFrenReceiptWithSuiFrensOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<{}[]> => {
		// StakedSuiFrenReceiptWithSuiFrenObject
		throw new Error("TODO");

		// i. obtain all owned StakingReceipt
		// const stakingReceipts =
		// 	await this.fetchStakedSuiFrenReceiptOwnedByAddress(walletAddress);

		// // ii. obtain all SuiFren Object Ids
		// const suiFrenIdsStakedByAddress = stakingReceipts.map(
		// 	(suiFrenStakingReceipt) => suiFrenStakingReceipt.suiFrenId
		// );

		// // iii. obtain a SuiFren object from each SuiFren ObjectId
		// let indexStakedSuiFrens: { [key: ObjectId]: SuiFrenObject } = {};
		// (await this.fetchStakedSuiFrens(suiFrenIdsStakedByAddress)).forEach(
		// 	(stakedSuiFren) => {
		// 		indexStakedSuiFrens[stakedSuiFren.objectId] = stakedSuiFren;
		// 	}
		// );

		// // iv. construct a StakingReceiptWithSuiFren object from each StakingReceipt <> SuiFren pair
		// const suiFrenStakingReceiptsWithSuiFren = stakingReceipts.map(
		// 	(stakingReceipt) => {
		// 		return {
		// 			objectType: stakingReceipt.objectType,
		// 			objectId: stakingReceipt.objectId,
		// 			suiFren: indexStakedSuiFrens[stakingReceipt.suiFrenId],
		// 			unlockEpoch: stakingReceipt.unlockEpoch,
		// 		};
		// 	}
		// );

		// return suiFrenStakingReceiptsWithSuiFren;
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
	//  Mixing Transactions
	// =========================================================================

	public fetchMixSuiFrensTransaction = async (
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

		const transaction = await this.fetchSuiFrenBuildMixTransaction(
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

	public fetchSuiFrenBuildMixTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentOneIsOwned: boolean,
		parentTwoId: ObjectId,
		parentTwoIsOwned: boolean
	): Promise<TransactionBlock> => {
		if (parentOneIsOwned && parentTwoIsOwned) {
			// i. both suiFrens are owned
			return this.fetchBuildMixAndKeepTransaction(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (parentOneIsOwned && !parentTwoIsOwned) {
			// iia. one of the SuiFrens is owned and the other is staked
			return this.fetchBuildMixWithStakedAndKeepTransaction(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (!parentOneIsOwned && parentTwoIsOwned) {
			// iib. one of the SuiFren's is owned and the other is staked
			return this.fetchBuildMixWithStakedAndKeepTransaction(
				walletAddress,
				parentTwoId,
				parentOneId
			);
		} else {
			// iii. both SuiFrens are staked
			return this.fetchBuildMixStakedWithStakedAndKeepTransaction(
				walletAddress,
				parentTwoId,
				parentOneId
			);
		}
	};

	public fetchBuildMixWithStakedAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const feeCoinType = SuiFrens.constants.mixingFeeCoinType;
		const feeCoinAmount = BigInt(0);

		const coinArg = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: feeCoinType,
			coinAmount: feeCoinAmount,
		});

		const finalTx = this.addStakeMixWithStakedAndKeepCommandToTransaction(
			tx,
			coinArg,
			parentOneId,
			parentTwoId
		);

		return finalTx;
	};

	public fetchBuildMixStakedWithStakedAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const feeCoinType = SuiFrens.constants.mixingFeeCoinType;
		const feeCoinAmount = BigInt(0);

		const coinArg = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: feeCoinType,
			coinAmount: feeCoinAmount,
		});

		const finalTx = this.addStakeMixWithStakedAndKeepCommandToTransaction(
			tx,
			coinArg,
			parentOneId,
			parentTwoId
		);

		return finalTx;
	};

	public fetchBuildMixAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const feeCoinType = SuiFrens.constants.mixingFeeCoinType;
		const feeCoinAmount = BigInt(0);

		const coinArg = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: feeCoinType,
			coinAmount: feeCoinAmount,
		});

		const finalTx = this.addStakeMixAndKeepCommandToTransaction(
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
	//  Inspections
	// =========================================================================

	public mixingLimitTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}) /* Option<u8> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrens,
				SuiFrensApi.constants.moduleNames.capyLabs,
				"mixing_limit"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(inputs.suiFrenId), // SuiFren
			],
		});
	};

	public lastEpochMixedTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}) /* Option<u64> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrens,
				SuiFrensApi.constants.moduleNames.capyLabs,
				"last_epoch_mixed"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(inputs.suiFrenId), // SuiFren
			],
		});
	};

	// =========================================================================
	//  Mixing Transaction
	// =========================================================================

	public addStakeMixAndKeepCommandToTransaction = (
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
					.mixAndKeep.name
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

	public addStakeMixWithStakedAndKeepCommandToTransaction = (
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
					.mixWithStakedAndKeep.name
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

	public addStakeMixStakedWithStakedAndKeepCommandToTransaction = (
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
					.mixStakedWithStakedAndKeep.name
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
	public calcSuiFrenMixingFees = (
		mixSuiFrenEvents: MixSuiFrensEvent[],
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	): AmountInCoinAndUsd => {
		const mixingFeesInFeeCoin = Helpers.sum(
			mixSuiFrenEvents.map((event) =>
				Coin.balanceWithDecimals(
					event.feeCoinWithBalance.balance,
					feeCoinDecimals
				)
			)
		);

		const mixingFeesUsd = feeCoinPrice * mixingFeesInFeeCoin;
		return {
			amount: mixingFeesInFeeCoin,
			amountUsd: mixingFeesUsd,
		};
	};

	public fetchSuiFrenStats = async (): Promise<SuiFrenStats> => {
		throw new Error("TODO");

		// const mixSuiFrenEventsWithinTime =
		// 	await this.Provider.Events().fetchEventsWithinTime({
		// 		fetchEventsFunc: this.fetchMixSuiFrensEvents,
		// 		timeUnit: "hour",
		// 		time: 24,
		// 	});

		// const feeCoin =
		// 	mixSuiFrenEventsWithinTime.length === 0
		// 		? SuiFrens.constants.mixingFeeCoinType
		// 		: mixSuiFrenEventsWithinTime[0].feeCoinWithBalance.coin;
		// const feeCoinDecimals = (
		// 	await this.Provider.Coin().fetchCoinMetadata(feeCoin)
		// ).decimals;
		// const feeCoinPrice = await this.Provider.Prices().fetchPrice(feeCoin);

		// const mixingFeesDaily = this.calcSuiFrenMixingFees(
		// 	mixSuiFrenEventsWithinTime,
		// 	feeCoinDecimals,
		// 	feeCoinPrice
		// );

		// const suiFrenVault = await this.fetchSuiFrenVault(
		// 	this.addresses.objects.suiFrensVault
		// );

		// const { bredSuiFrens, stakedSuiFrens, mixingFeesGlobal } =
		// 	await this.fetchSuiFrenVaultStats(
		// 		suiFrenVault,
		// 		feeCoinDecimals,
		// 		feeCoinPrice
		// 	);

		// return {
		// 	totalMixes: bredSuiFrens,
		// 	totalStaked: stakedSuiFrens,
		// 	mixingFeeCoin: feeCoin,
		// 	mixingFeesGlobal,
		// 	mixingFees24hr: mixingFeesDaily.amount,
		// 	mixingVolume24hr: mixSuiFrenEventsWithinTime.length,
		// };
	};

	public fetchSuiFrenVaultStats = async (
		suiFrenVault: SuiFrenVaultObject,
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	) => {
		throw new Error("TODO");

		// const globalFeesWithDecimals = Coin.balanceWithDecimals(
		// 	suiFrenVault.globalFees,
		// 	feeCoinDecimals
		// );
		// const globalFeesUsd = feeCoinPrice * globalFeesWithDecimals;
		// const mixingFeesGlobal = {
		// 	amount: globalFeesWithDecimals,
		// 	amountUsd: globalFeesUsd,
		// } as AmountInCoinAndUsd;

		// return {
		// 	bredSuiFrens: suiFrenVault.bredSuiFrens,
		// 	stakedSuiFrens: suiFrenVault.stakedSuiFrens,
		// 	mixingFeesGlobal,
		// };
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
	): boolean => suiObjectInfo.type === this.objectTypes.stakedSuiFrenReceipt;

	public isSuiFrenObjectType = (suiObjectInfo: SuiObjectInfo): boolean =>
		suiObjectInfo.type === this.objectTypes.suiFren;

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private fetchCompletePartialSuiFrenObjects = async (
		partialSuiFrens: Omit<SuiFrenObject, "mixLimit" | "lastEpochMixed">[]
	): Promise<SuiFrenObject[]> => {
		return Promise.all(
			partialSuiFrens.map((suiFren) =>
				this.fetchCompletePartialSuiFrenObject(suiFren)
			)
		);
	};

	private fetchCompletePartialSuiFrenObject = async (
		partialSuiFren: Omit<SuiFrenObject, "mixLimit" | "lastEpochMixed">
	): Promise<SuiFrenObject> => {
		const suiFrenId = partialSuiFren.objectId;
		// TODO: move inner coin type func to general func in helpers
		const suiFrenType = Coin.getInnerCoinType(partialSuiFren.objectType);
		const [mixLimit, lastEpochMixed] = await Promise.all([
			this.fetchMixingLimit({ suiFrenId, suiFrenType }),
			this.fetchLastEpochMixed({ suiFrenId, suiFrenType }),
		]);

		return {
			...partialSuiFren,
			mixLimit,
			lastEpochMixed,
		};
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private suiFrenBornEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrens,
			SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
			// SuiFrensApi.constants.suiFren.modules.suiFren.moduleName,
			SuiFrensApi.constants.eventNames.suiFrenBorn
		);

	private mixSuiFrensEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.suiFrenVault.modules.interface.moduleName,
			SuiFrensApi.constants.eventNames.mixSuiFren
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
