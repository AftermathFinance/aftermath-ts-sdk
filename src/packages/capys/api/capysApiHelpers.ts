import {
	MoveCallTransaction,
	ObjectId,
	SignableTransaction,
	SuiAddress,
	SuiObjectInfo,
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
import { CastingApiHelpers } from "../../../general/api/castingApiHelpers";

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

	constructor(protected readonly Provider: AftermathApi) {
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
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	protected capyFeesEarnedIndividualMoveCall = (
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

	protected capyFeesEarnedGlobalMoveCall = (): MoveCallTransaction => {
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
	//// Breeding Transactions
	/////////////////////////////////////////////////////////////////////

	protected stakeBreedAndKeepTransaction = (
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedAndKeep.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.breedAndKeep.name,
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

	protected stakeBreedWithStakedAndKeepTransaction = (
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedWithStakedAndKeep.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.breedWithStakedAndKeep.name,
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

	protected stakeBreedStakedWithStakedAndKeepTransaction = (
		coinId: ObjectId,
		parentOneId: ObjectId,
		parentTwoId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.breedStakedWithStakedAndKeep.defaultGasBudget
	): SignableTransaction => {
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
	//// Staking Transactions
	/////////////////////////////////////////////////////////////////////

	protected capyStakeCapyTransaction = (
		capyId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.stakeCapy.defaultGasBudget
	): SignableTransaction => {
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

	protected capyUnstakeCapyTransaction = (
		stakingReceiptId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.unstakeCapy.defaultGasBudget
	): SignableTransaction => {
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

	protected capyTransferTransaction = (
		stakingReceiptId: ObjectId,
		recipient: SuiAddress,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.transfer.defaultGasBudget
	): SignableTransaction => {
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
	//// Fee Transactions
	/////////////////////////////////////////////////////////////////////

	protected capyWithdrawFeesTransaction = (
		stakingReceiptId: ObjectId,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.withdrawFees.defaultGasBudget
	): SignableTransaction => {
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

	protected capyWithdrawFeesAmountTransaction = (
		stakingReceiptId: ObjectId,
		amount: Balance,
		gasBudget: GasBudget = CapysApiHelpers.constants.capyVault.modules
			.interface.functions.withdrawFeesAmount.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.capyVault,
				module: CapysApiHelpers.constants.capyVault.modules.interface
					.moduleName,
				function:
					CapysApiHelpers.constants.capyVault.modules.interface
						.functions.withdrawFeesAmount.name,
				typeArguments: [],
				arguments: [
					this.addresses.objects.capyVault,
					stakingReceiptId,
					amount.toString(),
				],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Breeding Transactions
	/////////////////////////////////////////////////////////////////////

	protected fetchCapyBuildBreedTransactions = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentOneIsOwned: boolean,
		parentTwoId: ObjectId,
		parentTwoIsOwned: boolean
	) => {
		if (parentOneIsOwned && parentTwoIsOwned) {
			// i. both capys are owned
			return this.fetchBuildBreedAndKeepTransactions(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (parentOneIsOwned && !parentTwoIsOwned) {
			// iia. one of the Capys is owned and the other is staked
			return this.fetchBuildBreedWithStakedAndKeepTransactions(
				walletAddress,
				parentOneId,
				parentTwoId
			);
		} else if (!parentOneIsOwned && parentTwoIsOwned) {
			// iib. one of the Capy's is owned and the other is staked
			return this.fetchBuildBreedWithStakedAndKeepTransactions(
				walletAddress,
				parentTwoId,
				parentOneId
			);
		} else {
			// iii. both Capys are staked
			return this.fetchBuildBreedStakedWithStakedAndKeepTransactions(
				walletAddress,
				parentTwoId,
				parentOneId
			);
		}
	};

	protected fetchBuildBreedWithStakedAndKeepTransactions = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<SignableTransaction[]> => {
		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount =
			Capys.constants.breedingFees.amounts.breedWithStakedAndKeep;

		// i. obtain object ids of Coin to pay breeding fee with
		const response =
			await this.Provider.Coin.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const coinId = getObjectId(response[0]);

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a `Coin<SUI>` with exact value of `feeCoinAmount`,
		// so we need to create it.
		transactions.push(
			...this.Provider.Coin.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				feeCoinType,
				feeCoinAmount
			)
		);

		// iii. breed the two capy's together
		transactions.push(
			this.stakeBreedWithStakedAndKeepTransaction(
				coinId,
				parentOneId,
				parentTwoId
			)
		);

		return transactions;
	};

	protected fetchBuildBreedStakedWithStakedAndKeepTransactions = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<SignableTransaction[]> => {
		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount =
			Capys.constants.breedingFees.amounts.breedStakedWithStakedAndKeep;

		// i. obtain object ids of Coin to pay breeding fee with
		const response =
			await this.Provider.Coin.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const coinId = getObjectId(response[0]);

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a `Coin<SUI>` with exact value of `feeCoinAmount`,
		// so we need to create it.
		transactions.push(
			...this.Provider.Coin.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				feeCoinType,
				feeCoinAmount
			)
		);

		// iii. breed the two capy's together
		transactions.push(
			this.stakeBreedStakedWithStakedAndKeepTransaction(
				coinId,
				parentOneId,
				parentTwoId
			)
		);

		return transactions;
	};

	protected fetchBuildBreedAndKeepTransactions = async (
		walletAddress: SuiAddress,
		parentOneId: ObjectId,
		parentTwoId: ObjectId
	): Promise<SignableTransaction[]> => {
		const feeCoinType = Capys.constants.breedingFees.coinType;
		const feeCoinAmount = Capys.constants.breedingFees.amounts.breedAndKeep;

		// i. obtain object ids of Coin to pay breeding fee with
		const response =
			await this.Provider.Coin.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				feeCoinType,
				feeCoinAmount
			);

		const coinId = getObjectId(response[0]);

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a `Coin<SUI>` with exact value of `feeCoinAmount`,
		// so we need to create it.
		transactions.push(
			...this.Provider.Coin.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				feeCoinType,
				feeCoinAmount
			)
		);

		// iii. breed the two capy's together
		transactions.push(
			this.stakeBreedAndKeepTransaction(coinId, parentOneId, parentTwoId)
		);

		return transactions;
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Staked Capy Fees
	/////////////////////////////////////////////////////////////////////

	protected fetchStakedCapyFeesEarnedIndividual = async (
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

	protected fetchStakedCapyFeesEarnedGlobal = async () => {
		const moveCallTransaction = this.capyFeesEarnedGlobalMoveCall();
		const bytes =
			await this.Provider.Inspections.fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return CastingApiHelpers.bigIntFromBytes(bytes);
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	protected fetchCapyVaultStats = async (
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

	protected filterCapysWithAttributes = (
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

	protected isStakedCapyReceiptObjectType = (
		suiObjectInfo: SuiObjectInfo
	): boolean =>
		suiObjectInfo.type === this.objectTypes.stakedCapyReceiptObjectType;

	protected isCapyObjectType = (suiObjectInfo: SuiObjectInfo): boolean =>
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
