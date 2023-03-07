import {
	GetObjectDataResponse,
	MoveCallTransaction,
	ObjectId,
	SignableTransaction,
	SuiAddress,
	getObjectId,
} from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Balance, CoinType, GasBudget, PoolsAddresses } from "../../../types";
import { CoinApiHelpers } from "../../coin/api/coinApiHelpers";

export class PoolsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		modules: {
			pools: "interface",
			math: "math",
			events: "events",
		},
		functions: {
			swap: {
				name: "swap",
				defaultGasBudget: 10000,
			},
			deposit: {
				name: "deposit_X_coins",
				defaultGasBudget: 20000,
			},
			withdraw: {
				name: "withdraw_X_coins",
				defaultGasBudget: 20000,
			},
			// publish 30000
		},
		eventNames: {
			swap: "SwapEvent",
			deposit: "DepositEvent",
			withdraw: "WithdrawEvent",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public poolsAddresses: PoolsAddresses;

	private coinApiHelpers: CoinApiHelpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(protected readonly rpcProvider: AftermathApi) {
		const poolsAddresses = this.rpcProvider.addresses.pools;
		if (!poolsAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.rpcProvider = rpcProvider;
		this.poolsAddresses = poolsAddresses;

		this.coinApiHelpers = new CoinApiHelpers(this.rpcProvider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	// TODO: change all swap naming to trade
	public tradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.poolsAddresses.packages.cmmm,
			PoolsApiHelpers.constants.modules.events,
			PoolsApiHelpers.constants.eventNames.swap
		);

	public depositEventType = () =>
		EventsApiHelpers.createEventType(
			this.poolsAddresses.packages.cmmm,
			PoolsApiHelpers.constants.modules.events,
			PoolsApiHelpers.constants.eventNames.deposit
		);

	public withdrawEventType = () =>
		EventsApiHelpers.createEventType(
			this.poolsAddresses.packages.cmmm,
			PoolsApiHelpers.constants.modules.events,
			PoolsApiHelpers.constants.eventNames.withdraw
		);

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	protected spotPriceMoveCall = (
		poolId: ObjectId,
		coinInType: CoinType,
		coinOutType: CoinType,
		lpCoinType: CoinType
	): MoveCallTransaction => {
		return {
			packageObjectId: this.poolsAddresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "calc_spot_price",
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [poolId],
		};
	};

	protected tradeAmountOutMoveCall = (
		poolId: ObjectId,
		coinInType: CoinType,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		coinInAmount: bigint
	): MoveCallTransaction => {
		return {
			packageObjectId: this.poolsAddresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "calc_swap_amount_out",
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [poolId, coinInAmount.toString()],
		};
	};

	protected depositLpMintAmountMoveCall = (
		poolId: ObjectId,
		lpCoinType: CoinType,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): MoveCallTransaction => {
		return {
			packageObjectId: this.poolsAddresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "dev_inspect_calc_deposit_lp_mint_amount_u8",
			typeArguments: [lpCoinType],
			arguments: [
				poolId,
				CoinApiHelpers.formatCoinTypesForMoveCall(coinTypes),
				coinAmounts.map((amount) => amount.toString()),
			],
		};
	};

	protected withdrawAmountOutMoveCall = (
		poolId: ObjectId,
		lpCoinType: CoinType,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): MoveCallTransaction => {
		return {
			packageObjectId: this.poolsAddresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "dev_inspect_calc_withdraw_amount_out_u8",
			typeArguments: [lpCoinType],
			arguments: [
				poolId,
				CoinApiHelpers.formatCoinTypesForMoveCall(coinTypes),
				coinAmounts.map((amount) => amount.toString()),
			],
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	protected tradeTransaction = (
		poolId: ObjectId,
		coinInId: ObjectId,
		coinInType: CoinType,
		coinOutMin: Balance,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.swap
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.poolsAddresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: "swap",
				typeArguments: [lpCoinType, coinInType, coinOutType],
				arguments: [poolId, coinInId, coinOutMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected singleCoinDepositTransaction = (
		poolId: ObjectId,
		coinId: ObjectId,
		coinType: CoinType,
		lpMintMin: Balance,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.deposit
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.poolsAddresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: "single_coin_deposit",
				typeArguments: [lpCoinType, coinType],
				arguments: [poolId, coinId, lpMintMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected multiCoinDepositTransaction = (
		poolId: ObjectId,
		coinIds: ObjectId[],
		coinTypes: CoinType[],
		lpMintMin: Balance,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.deposit
			.defaultGasBudget
	): SignableTransaction => {
		const poolSize = coinTypes.length;
		if (poolSize != coinIds.length)
			throw new Error(
				`invalid coinIds size: ${coinIds.length} != ${poolSize}`
			);

		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.poolsAddresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: `deposit_${poolSize}_coins`,
				typeArguments: [lpCoinType, ...coinTypes],
				arguments: [poolId, ...coinIds, lpMintMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected singleCoinWithdrawTransaction = (
		poolId: ObjectId,
		lpCoinId: ObjectId,
		lpCoinType: CoinType,
		amountOutMin: Balance,
		coinOutType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.withdraw
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.poolsAddresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: "single_coin_withdraw",
				typeArguments: [lpCoinType, coinOutType],
				arguments: [poolId, lpCoinId, amountOutMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected multiCoinWithdrawTransaction = (
		poolId: ObjectId,
		lpCoinId: ObjectId,
		lpCoinType: CoinType,
		amountsOutMin: Balance[],
		coinsOutType: CoinType[],
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.withdraw
			.defaultGasBudget
	): SignableTransaction => {
		const poolSize = coinsOutType.length;
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.poolsAddresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: `withdraw_${poolSize}_coins`,
				typeArguments: [lpCoinType, ...coinsOutType],
				arguments: [
					poolId,
					lpCoinId,
					amountsOutMin.map((amountOutMin) =>
						amountOutMin.toString()
					),
				],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	// TODO: abstract i and ii into a new function that can also be called by swap/deposit/withdraw.

	protected buildTradeTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		fromCoinType: CoinType,
		fromCoinAmount: Balance,
		toCoinType: CoinType
	): Promise<SignableTransaction[]> => {
		// i. obtain object ids of coin to swap from
		const response =
			await this.coinApiHelpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				fromCoinType,
				fromCoinAmount
			);

		const coinInId = getObjectId(response[0]);

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a coin of type `fromCoinType` with exact
		// value of `fromCoinAmount`, so we need to create it
		const joinAndSplitTransactions =
			this.coinApiHelpers.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				fromCoinType,
				fromCoinAmount
			);

		transactions.push(...joinAndSplitTransactions);

		// iii. trade `coinInId` to for coins of type `toCoinType`
		transactions.push(
			this.tradeTransaction(
				poolObjectId,
				coinInId,
				fromCoinType,
				BigInt(0), // TODO: calc slippage amount
				toCoinType,
				poolLpType
			)
		);

		return transactions;
	};

	protected buildDepositTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): Promise<SignableTransaction[]> => {
		// i. obtain object ids of `coinTypes` to deposit
		const responses = (
			await Promise.all(
				coinTypes.map((coinType, index) =>
					this.coinApiHelpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
						walletAddress,
						coinType,
						coinAmounts[index]
					)
				)
			)
		)
			// safe check as responses is guaranteed to not contain undefined
			.filter(
				(response): response is GetObjectDataResponse[] => !!response
			);

		let allCoinIds: ObjectId[] = [];
		let allCoinIdsToJoin: [ObjectId[]] = [[]];

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a coin of type `coinType` with exact
		// value of `coinAmount`, so we need to create it
		responses.forEach((response, index) => {
			const joinAndSplitTransactions =
				this.coinApiHelpers.coinJoinAndSplitWithExactAmountTransactions(
					response[0],
					response.slice(1),
					coinTypes[index],
					coinAmounts[index]
				);
			if (!joinAndSplitTransactions) return;
			transactions.push(...joinAndSplitTransactions);

			const [coinId, ...coinIdsToJoin] = response.map(
				(getObjectDataResponse) => getObjectId(getObjectDataResponse)
			);
			allCoinIds.push(coinId);
			allCoinIdsToJoin.push(coinIdsToJoin);
		});

		// iii. deposit `allCoinIds` into `pool.objectId`
		transactions.push(
			this.multiCoinDepositTransaction(
				poolObjectId,
				allCoinIds,
				coinTypes,
				BigInt(0), // TODO: calc slippage amount
				poolLpType
			)
		);

		return transactions;
	};

	protected buildWithdrawTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		lpCoinAmount: Balance,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): Promise<SignableTransaction[]> => {
		// i. obtain object ids of `lpCoinType` to burn
		const response =
			await this.coinApiHelpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				poolLpType,
				lpCoinAmount
			);

		const lpCoinInId = getObjectId(response[0]);

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a coin of type `fromCoinType` with exact
		// value of `fromCoinAmount`, so we need to create it
		const joinAndSplitTransactions =
			this.coinApiHelpers.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				poolLpType,
				lpCoinAmount
			);

		transactions.push(...joinAndSplitTransactions);

		// iii. burn `lpCoinInId` and withdraw a pro-rata amount of the Pool's underlying coins.
		transactions.push(
			this.multiCoinWithdrawTransaction(
				poolObjectId,
				lpCoinInId,
				poolLpType,
				coinAmounts, // TODO: calc slippage amount
				coinTypes
			)
		);

		return transactions;
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////
}
