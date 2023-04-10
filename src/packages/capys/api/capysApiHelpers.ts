import {
	ObjectId,
	SuiAddress,
	SuiObjectInfo,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AmountInCoinAndUsd,
	AnyObjectType,
	Balance,
	CapyAttribute,
	CapyObject,
	CapyVaultObject,
	CapysAddresses,
	CoinDecimal,
	GasBudget,
} from "../../../types";
import { Capys } from "../capys";
import { Coin } from "../../coin/coin";
import { Casting } from "../../../general/utils/casting";
import { Helpers } from "../../../general/utils/helpers";

export class CapysApiHelpers {
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
							defaultGasBudget: 100000000,
						},
						unstakeCapy: {
							name: "unstake_capy",
							defaultGasBudget: 100000000,
						},
						withdrawFees: {
							name: "withdraw_fees",
							defaultGasBudget: 100000000,
						},
						withdrawFeesAmount: {
							name: "withdraw_fees_amount",
							defaultGasBudget: 100000000,
						},
						breedAndKeep: {
							name: "breed_and_keep",
							defaultGasBudget: 100000000,
						},
						breedWithStakedAndKeep: {
							name: "breed_with_staked_and_keep",
							defaultGasBudget: 100000000,
						},
						breedStakedWithStakedAndKeep: {
							name: "breed_staked_with_staked_and_keep",
							defaultGasBudget: 100000000,
						},
						transfer: {
							name: "transfer",
							defaultGasBudget: 100000000,
						},
					},
				},
				capyVault: {
					moduleName: "capy_vault",
					functions: {
						feesEarnedIndividual: {
							name: "fees_earned_individual",
							defaultGasBudget: 100000000,
						},
						feesEarnedGlobal: {
							name: "fees_earned_global",
							defaultGasBudget: 100000000,
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

		this.Provider = Provider;
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
	//// Dev Inspects
	/////////////////////////////////////////////////////////////////////

	public capyFeesEarnedIndividualDevInspectTransaction = (
		stakingReceiptId: ObjectId
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.capyVault
					.moduleName,

				CapysApiHelpers.constants.capyVault.modules.capyVault.functions
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
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.capyVault
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.capyVault.functions
					.feesEarnedGlobal.name
			),
			typeArguments: [],
			arguments: [tx.object(this.addresses.objects.capyVault)],
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Breeding Transaction
	/////////////////////////////////////////////////////////////////////

	public addStakeBreedAndKeepCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId | TransactionArgument,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedAndKeep.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.interface.functions
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
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public addStakeBreedWithStakedAndKeepCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId | TransactionArgument,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedWithStakedAndKeep.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.interface.functions
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
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public addStakeBreedStakedWithStakedAndKeepCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedStakedWithStakedAndKeep.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.interface.functions
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
		tx.setGasBudget(gasBudget);

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Staking Transaction
	/////////////////////////////////////////////////////////////////////

	public capyStakeCapyTransaction = (
		capyId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.stakeCapy.defaultGasBudget
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.interface.functions
					.stakeCapy.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(capyId),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public capyUnstakeCapyTransaction = (
		stakingReceiptId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.unstakeCapy.defaultGasBudget
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,

				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,

				CapysApiHelpers.constants.capyVault.modules.interface.functions
					.unstakeCapy.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public capyTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.transfer.defaultGasBudget
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.interface.functions
					.transfer.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
				tx.pure(recipient),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Fee Transaction
	/////////////////////////////////////////////////////////////////////

	public capyWithdrawFeesTransaction = (
		stakingReceiptId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.withdrawFees.defaultGasBudget
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.interface.functions
					.withdrawFees.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public capyWithdrawFeesAmountTransaction = (
		stakingReceiptId: ObjectId,
		amount: Balance,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.withdrawFeesAmount.defaultGasBudget
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.capyVault,
				CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				CapysApiHelpers.constants.capyVault.modules.interface.functions
					.withdrawFeesAmount.name
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.capyVault),
				tx.object(stakingReceiptId),
				tx.pure(amount.toString()),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Breeding Transactions
	/////////////////////////////////////////////////////////////////////

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

		const { coinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const finalTx = this.addStakeBreedWithStakedAndKeepCommandToTransaction(
			txWithCoinWithAmount,
			coinArgument,
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

		const { coinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const finalTx = this.addStakeBreedWithStakedAndKeepCommandToTransaction(
			txWithCoinWithAmount,
			coinArgument,
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

		const { coinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const finalTx = this.addStakeBreedAndKeepCommandToTransaction(
			txWithCoinWithAmount,
			coinArgument,
			parentOneId,
			parentTwoId
		);

		return finalTx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Staked Capy Fees
	/////////////////////////////////////////////////////////////////////

	public fetchStakedCapyFeesEarnedIndividual = async (
		stakingReceiptId: ObjectId
	) => {
		const tx =
			this.capyFeesEarnedIndividualDevInspectTransaction(
				stakingReceiptId
			);
		const bytes =
			await this.Provider.Inspections().fetchBytesFromTransaction(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchStakedCapyFeesEarnedGlobal = async () => {
		const tx = this.capyFeesEarnedGlobalDevInspectTransaction();
		const bytes =
			await this.Provider.Inspections().fetchBytesFromTransaction(tx);
		return Casting.bigIntFromBytes(bytes);
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

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
			CapysApiHelpers.constants.capy.modules.capy.moduleName,
			CapysApiHelpers.constants.eventNames.capyBorn
		);

	private breedCapysEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.capyVault,
			CapysApiHelpers.constants.capyVault.modules.interface.moduleName,
			CapysApiHelpers.constants.eventNames.breedCapy
		);

	private stakeCapyEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.capyVault,
			CapysApiHelpers.constants.capyVault.modules.interface.moduleName,
			CapysApiHelpers.constants.eventNames.stakeCapy
		);

	private unstakeCapyEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.capyVault,
			CapysApiHelpers.constants.capyVault.modules.interface.moduleName,
			CapysApiHelpers.constants.eventNames.unstakeCapy
		);
}
