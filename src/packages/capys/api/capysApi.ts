import {
	EventId,
	ObjectId,
	SuiAddress,
	SuiObjectInfo,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { CapysApiCasting } from "./capysApiCasting";
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
import { Capys } from "../capys";
import {
	AnyObjectType,
	Balance,
	CapysAddresses,
	DynamicFieldObjectsWithCursor,
	DynamicFieldsInputs,
	EventsInputs,
	SerializedTransaction,
} from "../../../types";
import { Casting } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";

export class CapysApi {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		capy: {
			modules: {
				capy: {
					moduleName: "capy",
				},
			},
		},

		capyVault: {
			modules: {
				interface: {
					moduleName: "interface",
					functions: {
						stakeCapy: {
							name: "stake_capy",
						},
						unstakeCapy: {
							name: "unstake_capy",
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
				capyVault: {
					moduleName: "capy_vault",
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
			capyBorn: "CapyBorn",
			breedCapy: "BreedCapyEvent",
			stakeCapy: "StakeCapyEvent",
			unstakeCapy: "UnstakeCapyEvent",
			withdrawFees: "WithdrawFeesEvent",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: CapysAddresses;

	public readonly objectTypes: {
		capyObjectType: AnyObjectType;
		stakedCapyReceiptObjectType: AnyObjectType;
	};

	public readonly eventTypes: {
		capyBorn: AnyObjectType;
		breedCapys: AnyObjectType;
		stakeCapy: AnyObjectType;
		unstakeCapy: AnyObjectType;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.capys;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;

		this.objectTypes = {
			capyObjectType: `${addresses.packages.capy}::capy::Capy`,
			stakedCapyReceiptObjectType: `${addresses.packages.capyVault}::capy_vault::StakingReceipt`,
		};

		this.eventTypes = {
			capyBorn: this.capyBornEventType(),
			breedCapys: this.breedCapysEventType(),
			stakeCapy: this.stakeCapyEventType(),
			unstakeCapy: this.unstakeCapyEventType(),
		};
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
				this.fetchStakedCapyFeesEarnedIndividual(
					stakedCapyReceiptObjectId
				),
				this.fetchStakedCapyFeesEarnedGlobal(),
			]);

		return {
			individualFees: capyFeesEarnedIndividual,
			globalFees: capyFeesEarnedGlobal,
		};
	};

	public fetchIsCapyPackageOnChain = () =>
		this.Provider.Objects().fetchDoesObjectExist(
			this.addresses.packages.capy
		);

	public fetchCapysStakedInCapyVaultWithAttributes = async (inputs: {
		attributes: CapyAttribute[];
		limitStepSize: number;
		cursor?: ObjectId;
		limit: number;
	}) => {
		const { limit, attributes } = inputs;

		const isComplete = (capys: CapyObject[]) => {
			return (
				this.filterCapysWithAttributes(capys, attributes).length >=
				limit
			);
		};

		const capysWithCursor =
			await this.Provider.DynamicFields().fetchDynamicFieldsUntil({
				...inputs,
				fetchFunc: this.fetchCapysStakedInCapyVault,
				isComplete,
			});

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

	public fetchStakedCapyFeesEarnedIndividual = async (
		stakingReceiptId: ObjectId
	) => {
		const tx =
			this.capyFeesEarnedIndividualDevInspectTransaction(
				stakingReceiptId
			);
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchStakedCapyFeesEarnedGlobal = async () => {
		const tx = this.capyFeesEarnedGlobalDevInspectTransaction();
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public capyFeesEarnedIndividualDevInspectTransaction = (
		stakingReceiptId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.capyVault.moduleName,

				CapysApi.constants.capyVault.modules.capyVault.functions
					.feesEarnedIndividual.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
			],
		});

		return tx;
	};

	public capyFeesEarnedGlobalDevInspectTransaction = (): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.capyVault.moduleName,
				CapysApi.constants.capyVault.modules.capyVault.functions
					.feesEarnedGlobal.name
			),
			typeArguments: [],
			arguments: [tx.object(this.addresses.objects.capyVault)],
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchCapyBornEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			CapyBornEventOnChain,
			CapyBornEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.capyBorn,
			},
			eventFromEventOnChain: CapysApiCasting.capyBornEventFromOnChain,
		});

	public fetchBreedCapysEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			BreedCapyEventOnChain,
			BreedCapysEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.breedCapys,
			},
			eventFromEventOnChain: CapysApiCasting.breedCapysEventFromOnChain,
		});

	public fetchStakeCapyEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			StakeCapyEventOnChain,
			StakeCapyEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.stakeCapy,
			},
			eventFromEventOnChain: CapysApiCasting.stakeCapyEventFromOnChain,
		});

	public fetchUnstakeCapyEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeCapyEventOnChain,
			UnstakeCapyEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.unstakeCapy,
			},
			eventFromEventOnChain: CapysApiCasting.unstakeCapyEventFromOnChain,
		});

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Capy Objects
	/////////////////////////////////////////////////////////////////////

	public fetchCapys = async (capyIds: ObjectId[]): Promise<CapyObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<CapyObject>({
			objectIds: capyIds,
			objectFromSuiObjectResponse:
				CapysApiCasting.capyObjectFromSuiObjectResponse,
		});
	};

	public fetchCapysOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<CapyObject[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			{
				walletAddress,
				objectType: this.objectTypes.capyObjectType,
				objectFromSuiObjectResponse:
					CapysApiCasting.capyObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedCapys = async (
		capyIds: ObjectId[]
	): Promise<CapyObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<CapyObject>({
			objectIds: capyIds,
			objectFromSuiObjectResponse:
				CapysApiCasting.capyObjectFromSuiObjectResponse,
		});
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
		return this.Provider.Objects().fetchCastObject<CapyVaultObject>({
			objectId: capyVaultId,
			objectFromSuiObjectResponse:
				CapysApiCasting.capyVaultObjectFromSuiObjectResponse,
		});
	};

	public fetchCapysStakedInCapyVault = async (
		inputs: DynamicFieldsInputs
	) => {
		const capyVaultId = this.addresses.objects.capyVault;
		const capyType = this.objectTypes.capyObjectType;

		return await this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				...inputs,
				parentObjectId: capyVaultId,
				objectsFromObjectIds: this.fetchCapys,
				dynamicFieldType: capyType,
			}
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Staked Capy Receipt Objects
	/////////////////////////////////////////////////////////////////////

	public fetchStakedCapyReceipt = async (
		capyStakingReceipt: ObjectId
	): Promise<StakedCapyReceiptObject> => {
		return this.Provider.Objects().fetchCastObject<StakedCapyReceiptObject>(
			{
				objectId: capyStakingReceipt,
				objectFromSuiObjectResponse:
					CapysApiCasting.stakedCapyReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedCapyReceipts = async (
		capyStakingReceipts: ObjectId[]
	): Promise<StakedCapyReceiptObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch<StakedCapyReceiptObject>(
			{
				objectIds: capyStakingReceipts,
				objectFromSuiObjectResponse:
					CapysApiCasting.stakedCapyReceiptObjectFromSuiObjectResponse,
			}
		);
	};

	public fetchStakedCapyReceiptOwnedByAddress = async (
		walletAddress: SuiAddress
	): Promise<StakedCapyReceiptObject[]> => {
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			{
				walletAddress,
				objectType: this.objectTypes.stakedCapyReceiptObjectType,
				objectFromSuiObjectResponse:
					CapysApiCasting.stakedCapyReceiptObjectFromSuiObjectResponse,
			}
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
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.capyStakeCapyTransaction(capyId)
		);

	public fetchUnstakeCapyTransaction = (
		stakingReceiptId: ObjectId
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.capyUnstakeCapyTransaction(stakingReceiptId)
		);

	public fetchWithdrawStakedCapyFeesTransaction = (
		stakingReceiptId: ObjectId
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.capyWithdrawFeesTransaction(stakingReceiptId)
		);

	public fetchWithdrawStakedCapyFeesAmountTransaction = (
		stakingReceiptId: ObjectId,
		amount: Balance
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.capyWithdrawFeesAmountTransaction(stakingReceiptId, amount)
		);

	public fetchCapyTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress
	): Promise<SerializedTransaction> =>
		this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.capyTransferTransaction(stakingReceiptId, recipient)
		);

	/////////////////////////////////////////////////////////////////////
	//// Breeding Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchBreedCapysTransaction = async (
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

		const transaction = await this.fetchCapyBuildBreedTransaction(
			walletAddress,
			parentOneId,
			parentOneIsOwned,
			parentTwoId,
			parentTwoIsOwned
		);

		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			transaction
		);
	};

	public fetchCapyBuildBreedTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentOneIsOwned: boolean,
		parentTwoId: ObjectId,
		parentTwoIsOwned: boolean
	): Promise<TransactionBlock> => {
		if (parentOneIsOwned && parentTwoIsOwned) {
			// i. both capys are owned
			return this.fetchBuildBreedAndKeepTransaction(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (parentOneIsOwned && !parentTwoIsOwned) {
			// iia. one of the Capys is owned and the other is staked
			return this.fetchBuildBreedWithStakedAndKeepTransaction(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (!parentOneIsOwned && parentTwoIsOwned) {
			// iib. one of the Capy's is owned and the other is staked
			return this.fetchBuildBreedWithStakedAndKeepTransaction(
				walletAddress,
				parentTwoId,
				parentOneId
			);
		} else {
			// iii. both Capys are staked
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

		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount =
			Capys.constants.breedingFees.amounts.breedWithStakedAndKeep;

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

		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount =
			Capys.constants.breedingFees.amounts.breedStakedWithStakedAndKeep;

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

		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount = Capys.constants.breedingFees.amounts.breedAndKeep;

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

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Breeding Transaction
	/////////////////////////////////////////////////////////////////////

	public addStakeBreedAndKeepCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId | TransactionArgument,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.interface.moduleName,
				CapysApi.constants.capyVault.modules.interface.functions
					.breedAndKeep.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(this.addresses.objects.capyRegistry),
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
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.interface.moduleName,
				CapysApi.constants.capyVault.modules.interface.functions
					.breedWithStakedAndKeep.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(this.addresses.objects.capyRegistry),
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
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.interface.moduleName,
				CapysApi.constants.capyVault.modules.interface.functions
					.breedStakedWithStakedAndKeep.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(this.addresses.objects.capyRegistry),
				tx.object(coinId),
				tx.object(parentOneId),
				tx.object(parentTwoId),
			],
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Staking Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public capyStakeCapyTransaction = (capyId: ObjectId): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.interface.moduleName,
				CapysApi.constants.capyVault.modules.interface.functions
					.stakeCapy.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(capyId),
			],
		});

		return tx;
	};

	public capyUnstakeCapyTransaction = (
		stakingReceiptId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,

				CapysApi.constants.capyVault.modules.interface.moduleName,

				CapysApi.constants.capyVault.modules.interface.functions
					.unstakeCapy.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
			],
		});

		return tx;
	};

	public capyTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.interface.moduleName,
				CapysApi.constants.capyVault.modules.interface.functions
					.transfer.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
				tx.pure(recipient),
			],
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Fee Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public capyWithdrawFeesTransaction = (
		stakingReceiptId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.interface.moduleName,
				CapysApi.constants.capyVault.modules.interface.functions
					.withdrawFees.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
			],
		});

		return tx;
	};

	public capyWithdrawFeesAmountTransaction = (
		stakingReceiptId: ObjectId,
		amount: Balance
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApi.constants.capyVault.modules.interface.moduleName,
				CapysApi.constants.capyVault.modules.interface.functions
					.withdrawFeesAmount.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
				tx.pure(amount.toString()),
			],
		});

		return tx;
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
			await this.Provider.Events().fetchEventsWithinTime({
				fetchEventsFunc: this.fetchBreedCapysEvents,
				timeUnit: "hour",
				time: 24,
			});

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

	public fetchCapyVaultStats = async (
		capyVault: CapyVaultObject,
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	) => {
		const globalFeesWithDecimals = Coin.balanceWithDecimals(
			capyVault.globalFees,
			feeCoinDecimals
		);
		const globalFeesUsd = feeCoinPrice * globalFeesWithDecimals;
		const breedingFeesGlobal = {
			amount: globalFeesWithDecimals,
			amountUsd: globalFeesUsd,
		} as AmountInCoinAndUsd;

		return {
			bredCapys: capyVault.bredCapys,
			stakedCapys: capyVault.stakedCapys,
			breedingFeesGlobal,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Capy Attribute Filtering
	/////////////////////////////////////////////////////////////////////

	public filterCapysWithAttributes = (
		capys: CapyObject[],
		attributes: CapyAttribute[]
	) =>
		capys.filter((capy) =>
			attributes.every((attribute) =>
				capy.fields.attributes.some(
					(capyAttribute) =>
						capyAttribute.name === attribute.name &&
						capyAttribute.value === attribute.value
				)
			)
		);

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public isStakedCapyReceiptObjectType = (
		suiObjectInfo: SuiObjectInfo
	): boolean =>
		suiObjectInfo.type === this.objectTypes.stakedCapyReceiptObjectType;

	public isCapyObjectType = (suiObjectInfo: SuiObjectInfo): boolean =>
		suiObjectInfo.type === this.objectTypes.capyObjectType;

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	private capyBornEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.capy,
			CapysApi.constants.capy.modules.capy.moduleName,
			CapysApi.constants.eventNames.capyBorn
		);

	private breedCapysEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.capyVault,
			CapysApi.constants.capyVault.modules.interface.moduleName,
			CapysApi.constants.eventNames.breedCapy
		);

	private stakeCapyEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.capyVault,
			CapysApi.constants.capyVault.modules.interface.moduleName,
			CapysApi.constants.eventNames.stakeCapy
		);

	private unstakeCapyEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.capyVault,
			CapysApi.constants.capyVault.modules.interface.moduleName,
			CapysApi.constants.eventNames.unstakeCapy
		);
}
