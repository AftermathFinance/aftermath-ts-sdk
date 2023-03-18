import {
	MoveCallCommand,
	ObjectId,
	SuiAddress,
	SuiObjectInfo,
	Transaction,
	getObjectId,
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
							defaultGasBudget: 10000,
						},
						unstakeCapy: {
							name: "unstake_capy",
							defaultGasBudget: 10000,
						},
						withdrawFees: {
							name: "withdraw_fees",
							defaultGasBudget: 10000,
						},
						withdrawFeesAmount: {
							name: "withdraw_fees_amount",
							defaultGasBudget: 10000,
						},
						breedAndKeep: {
							name: "breed_and_keep",
							defaultGasBudget: 10000,
						},
						breedWithStakedAndKeep: {
							name: "breed_with_staked_and_keep",
							defaultGasBudget: 10000,
						},
						breedStakedWithStakedAndKeep: {
							name: "breed_staked_with_staked_and_keep",
							defaultGasBudget: 10000,
						},
						transfer: {
							name: "transfer",
							defaultGasBudget: 10000,
						},
					},
				},
				capyVault: {
					moduleName: "capy_vault",
					functions: {
						feesEarnedIndividual: {
							name: "fees_earned_individual",
							defaultGasBudget: 10000,
						},
						feesEarnedGlobal: {
							name: "fees_earned_global",
							defaultGasBudget: 10000,
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
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	public capyFeesEarnedIndividualMoveCall = (
		stakingReceiptId: ObjectId
	): MoveCallTransaction => {
		return {
			packageObjectId: this.addresses.packages.capyVault,
			module: CapysApiHelpers.constants.capyVault.modules.capyVault
				.moduleName,
			function:
				CapysApiHelpers.constants.capyVault.modules.capyVault.functions
					.feesEarnedIndividual.name,
			typeArguments: [],
			arguments: [this.addresses.objects.capyVault, stakingReceiptId],
		};
	};

	public capyFeesEarnedGlobalMoveCall = (): MoveCallTransaction => {
		return {
			packageObjectId: this.addresses.packages.capyVault,
			module: CapysApiHelpers.constants.capyVault.modules.capyVault
				.moduleName,
			function:
				CapysApiHelpers.constants.capyVault.modules.capyVault.functions
					.feesEarnedGlobal.name,
			typeArguments: [],
			arguments: [this.addresses.objects.capyVault],
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Breeding Transaction
	/////////////////////////////////////////////////////////////////////

	public addStakeBreedAndKeepCommandToTransaction = (
		tx: Transaction,
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedAndKeep.defaultGasBudget
	): Transaction => {
		tx.add({
			kind: "MoveCall",
			target: Helpers.createTransactionTarget(
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
				tx.object(coinId),
				tx.object(parentOneId),
				tx.object(parentTwoId),
			],
			// gasBudget: gasBudget,
		});
		return tx;
	};

	public addStakeBreedWithStakedAndKeepCommandToTransaction = (
		tx: Transaction,
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedWithStakedAndKeep.defaultGasBudget
	): Transaction => {
		tx.add({
			kind: "MoveCall",
			target: Helpers.createTransactionTarget(
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
				tx.object(coinId),
				tx.object(parentOneId),
				tx.object(parentTwoId),
			],
			// gasBudget: gasBudget,
		});
		return tx;
	};

	public stakeBreedStakedWithStakedAndKeepTransaction = (
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedStakedWithStakedAndKeep.defaultGasBudget
	): Transaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.breedStakedWithStakedAndKeep.name,
				typeArguments: [],
				arguments: [
					this.addresses.objects.capyVault,
					this.addresses.objects.capyRegistry,
					coinId,
					parentOneId,
					parentTwoId,
				],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Staking Transaction
	/////////////////////////////////////////////////////////////////////

	public capyStakeCapyTransaction = (
		capyId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.stakeCapy.defaultGasBudget
	): Transaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.stakeCapy.name,
				typeArguments: [],
				arguments: [this.addresses.objects.capyVault, capyId],
				gasBudget: gasBudget,
			},
		};
	};

	public capyUnstakeCapyTransaction = (
		stakingReceiptId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.unstakeCapy.defaultGasBudget
	): Transaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.unstakeCapy.name,
				typeArguments: [],
				arguments: [this.addresses.objects.capyVault, stakingReceiptId],
				gasBudget: gasBudget,
			},
		};
	};

	public capyTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.transfer.defaultGasBudget
	): Transaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.transfer.name,
				typeArguments: [],
				arguments: [
					this.addresses.objects.capyVault,
					stakingReceiptId,
					recipient,
				],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Fee Transaction
	/////////////////////////////////////////////////////////////////////

	public capyWithdrawFeesTransaction = (
		stakingReceiptId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.withdrawFees.defaultGasBudget
	): Transaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.withdrawFees.name,
				typeArguments: [],
				arguments: [this.addresses.objects.capyVault, stakingReceiptId],
				gasBudget: gasBudget,
			},
		};
	};

	public addCapyWithdrawFeesAmountCommandToTransaction = (
		tx: Transaction,
		stakingReceiptId: ObjectId,
		amount: Balance,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.withdrawFeesAmount.defaultGasBudget
	): Transaction => {
		tx.add({
			kind: "MoveCall",
			target: Helpers.createTransactionTarget(
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
			// gasBudget: gasBudget,
		});

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
	): Promise<Transaction> => {
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
	): Promise<Transaction[]> => {
		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount =
			Capys.constants.breedingFees.amounts.breedWithStakedAndKeep;

		// i. obtain object ids of Coin to pay breeding fee with
		const response =
			await this.Provider.Coin().Helpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const coinId = getObjectId(response[0]);

		let transaction: Transaction[] = [];
		// ii. the user doesn't have a `Coin<SUI>` with exact value of `feeCoinAmount`,
		// so we need to create it.
		transaction.push(
			...this.Provider.Coin().Helpers.coinJoinAndSplitWithExactAmountTransaction(
				response[0],
				response.slice(1),
				feeCoinType,
				feeCoinAmount
			)
		);

		// iii. breed the two capy's together
		transaction.push(
			this.stakeBreedWithStakedAndKeepTransaction(
				coinId,
				parentOneId,
				parentTwoId
			)
		);

		return transaction;
	};

	public fetchBuildBreedStakedWithStakedAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<Transaction> => {
		const tx = new Transaction();

		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount =
			Capys.constants.breedingFees.amounts.breedStakedWithStakedAndKeep;

		const { mergedCoinObjectId, transaction } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const finalTransaction =
			this.addStakeBreedWithStakedAndKeepCommandToTransaction(
				transaction,
				mergedCoinObjectId,
				parentOneId,
				parentTwoId
			);

		return finalTransaction;
	};

	public fetchBuildBreedAndKeepTransaction = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<Transaction> => {
		const tx = new Transaction();

		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount = Capys.constants.breedingFees.amounts.breedAndKeep;

		const { mergedCoinObjectId, transaction } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const finalTransaction = this.addStakeBreedAndKeepCommandToTransaction(
			transaction,
			mergedCoinObjectId,
			parentOneId,
			parentTwoId
		);

		return finalTransaction;
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
		const moveCallTransaction =
			this.capyFeesEarnedIndividualMoveCall(stakingReceiptId);
		const bytes =
			await this.Provider.Inspections().fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchStakedCapyFeesEarnedGlobal = async () => {
		const moveCallTransaction = this.capyFeesEarnedGlobalMoveCall();
		const bytes =
			await this.Provider.Inspections().fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
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
