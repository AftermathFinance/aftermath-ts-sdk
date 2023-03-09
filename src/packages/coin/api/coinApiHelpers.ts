import {
	GetObjectDataResponse,
	getObjectId,
	ObjectId,
	SignableTransaction,
	SuiAddress,
} from "@mysten/sui.js";
import {
	AnyObjectType,
	Balance,
	CoinDecimal,
	CoinType,
	GasBudget,
} from "../../../types";
import { Helpers } from "../../../general/utils/helpers";
import { Coin } from "../coin";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { CoinApi } from "./coinApi";
import { CastingApiHelpers } from "../../../general/api/castingApiHelpers";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Sui } from "../../sui/sui";

export class CoinApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		modules: {
			pay: {
				name: "pay",
				functions: {
					join: {
						name: "join",
						defaultGasBudget: 1000,
					},
					joinVec: {
						name: "join_vec",
						defaultGasBudget: 2000,
					},
					split: {
						name: "split",
						defaultGasBudget: 1000,
					},
					splitVec: {
						name: "split_vec",
						defaultGasBudget: 2000,
					},
					zero: {
						name: "zero",
						defaultGasBudget: 1000,
					},
					joinVecAndSplit: {
						name: "join_vec_and_split",
						defaultGasBudget: 2000,
					},
				},
			},
			coin: {
				name: "coin",
			},
		},
		eventNames: {
			currencyCreated: "CurrencyCreated",
		},
		eventTypes: {
			currencyCreated: CoinApiHelpers.currencyCreatedEventType(),
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(protected readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual = async (
		walletAddress: SuiAddress,
		coinType: CoinType,
		coinAmount: Balance
	): Promise<GetObjectDataResponse[]> => {
		const response = (
			await this.Provider.provider.selectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				coinAmount,
				Helpers.stripLeadingZeroesFromType(coinType)
			)
		).filter(
			// Safe check to avoid coins with value 0
			(getObjectDataResponse) => Coin.getBalance(getObjectDataResponse)
		);

		if (response.length === 0)
			throw new Error("wallet does not have coins of sufficient balance");
		return response;
	};

	// TODO: use this everywhere in sdk ! (instead of just router)
	public fetchCoinJoinAndSplitWithExactAmountTransactions = async (
		walletAddress: SuiAddress,
		coin: CoinType,
		coinAmount: Balance
	): Promise<{
		coinObjectId: ObjectId;
		joinAndSplitTransactions: SignableTransaction[];
	}> => {
		// i. obtain object ids of coin to swap from
		const response =
			await this.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				coin,
				coinAmount
			);

		const coinObjectId = getObjectId(response[0]);

		// ii. the user doesn't have a coin of type `coin` with exact
		// value of `balance`, so we need to create it
		const joinAndSplitTransactions =
			this.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				coin,
				coinAmount
			);

		return {
			coinObjectId,
			joinAndSplitTransactions,
		};
	};

	public fetchCoinDecimals = async (coin: CoinType) => {
		const coinMetadata = await new CoinApi(this.Provider).fetchCoinMetadata(
			coin
		);
		const decimals = coinMetadata?.decimals;
		if (decimals === undefined)
			throw Error("unable to obtain decimals for coin: " + coin);

		return decimals as CoinDecimal;
	};

	// TODO: use this everywhere in backend calls
	// TODO: handle coins where there is no coin metadata on chain
	public fetchCoinDecimalsNormalizeBalance = async (
		coin: CoinType,
		amount: number
	) => {
		const decimals = await this.fetchCoinDecimals(coin);
		return Coin.normalizeBalance(amount, decimals);
	};

	public fetchCoinDecimalsApplyToBalance = async (
		coin: CoinType,
		balance: Balance
	) => {
		const decimals = await this.fetchCoinDecimals(coin);
		return Coin.balanceWithDecimals(balance, decimals);
	};

	public fetchCoinsToDecimals = async (coins: CoinType[]) => {
		let allDecimals: number[] = [];
		for (const coin of coins) {
			const decimals = await this.fetchCoinDecimals(coin);
			allDecimals.push(decimals);
		}

		const coinsToDecimals: Record<CoinType, CoinDecimal> =
			allDecimals.reduce((acc, decimals, index) => {
				return { ...acc, [coins[index]]: decimals };
			}, {});
		return coinsToDecimals;
	};

	public fetchNormalizeCoinAmounts = async (
		coins: CoinType[],
		amounts: number[]
	) => {
		const normalizedAmounts = await Promise.all(
			coins.map(
				async (coin, index) =>
					await this.fetchCoinDecimalsNormalizeBalance(
						coin,
						amounts[index]
					)
			)
		);

		return normalizedAmounts;
	};

	public async fetchCoinsToDecimalsAndPrices(coins: CoinType[]): Promise<
		Record<
			CoinType,
			{
				decimals: CoinDecimal;
				price: number;
			}
		>
	> {
		const [coinsToPrices, coinsToDecimals] = await Promise.all([
			this.Provider.Prices.fetchCoinsToPrice(coins),
			this.fetchCoinsToDecimals(coins),
		]);

		const coinsToDecimalsAndPrices = Object.keys(coinsToPrices).reduce(
			(acc, coin) => {
				return {
					...acc,
					[coin]: {
						decimals: coinsToDecimals[coin],
						price:
							coinsToPrices[coin] < 0 ? 0 : coinsToPrices[coin],
					},
				};
			},
			{}
		);

		return coinsToDecimalsAndPrices;
	}

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static formatCoinTypesForMoveCall = (coins: CoinType[]) =>
		coins.map((coin) =>
			CastingApiHelpers.u8VectorFromString(coin.slice(2))
		); // slice to remove 0x

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	/*
        @assumes: the combined balance of `coin` + `coinsToJoin` is at least `amount`.
        @returns: undefined if `Coin.getBalance(coin)` returns undefined, an array of 
        `SignableTransactions` otherwise.
    */
	public coinJoinAndSplitWithExactAmountTransactions = (
		coin: GetObjectDataResponse,
		coinsToJoin: GetObjectDataResponse[],
		coinType: CoinType,
		amount: Balance
	): SignableTransaction[] => {
		const coinBalance = Coin.getBalance(coin);
		if (!coinBalance)
			throw new Error("wallet does not have balance of coin");
		// there are now four scenarios:
		//    i. the user has a coin of type `coinType` with balance equal to `amount`.
		if (coinBalance === amount) return [];

		const coinId = getObjectId(coin);
		//   ii. the user has a coin of type `coinType` with balance greater than `amount`
		//       and needs to remove `coinBalance` - `amount` from the coin.
		if (coinBalance > amount)
			return [
				this.coinSplitTransaction(
					coinId,
					coinType,
					coinBalance - amount
				),
			];

		const joinedBalance = coinBalance + Coin.totalBalance(coinsToJoin);
		const coinIdsToJoin = coinsToJoin.map((getObjectDataResponse) =>
			getObjectId(getObjectDataResponse)
		);
		//  iii. the user has multiple coins of type `coinType` that sum to `amount`, so
		//       these coins need to be joined.
		if (joinedBalance === amount)
			return [
				this.coinJoinVecTransaction(coinId, coinIdsToJoin, coinType),
			];

		//   iv. the user has multiple coins of type `coinType` whose sum is greater than
		//       `amount`, so these coins need to be joined and `joinedBalance` - `amount`
		//       needs to be removed from the coin.
		return [
			this.coinJoinVecAndSplitTransaction(
				coinId,
				coinIdsToJoin,
				coinType,
				joinedBalance - amount
			),
		];
	};

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	protected coinJoinVecTransaction = (
		coin: ObjectId,
		coins: ObjectId[],
		coinType: CoinType,
		gasBudget: GasBudget = CoinApiHelpers.constants.modules.pay.functions
			.joinVec.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: Sui.constants.addresses.suiPackageId,
				module: CoinApiHelpers.constants.modules.pay.name,
				function:
					CoinApiHelpers.constants.modules.pay.functions.joinVec.name,
				typeArguments: [coinType],
				arguments: [coin, coins],
				gasBudget: gasBudget,
			},
		};
	};

	protected coinSplitTransaction = (
		coin: ObjectId,
		coinType: CoinType,
		amount: Balance,
		gasBudget: GasBudget = CoinApiHelpers.constants.modules.pay.functions
			.split.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: Sui.constants.addresses.suiPackageId,
				module: CoinApiHelpers.constants.modules.pay.name,
				function:
					CoinApiHelpers.constants.modules.pay.functions.split.name,
				typeArguments: [coinType],
				arguments: [coin, amount.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected coinJoinVecAndSplitTransaction = (
		coin: ObjectId,
		coins: ObjectId[],
		coinType: CoinType,
		amount: Balance,
		gasBudget: GasBudget = CoinApiHelpers.constants.modules.pay.functions
			.joinVecAndSplit.defaultGasBudget
	): SignableTransaction => {
		const utiliesPackageId =
			this.Provider.addresses.utilies?.packages.utilities;
		if (!utiliesPackageId) throw new Error("utilies package id is unset");

		return {
			kind: "moveCall",
			data: {
				packageObjectId: utiliesPackageId,
				module: CoinApiHelpers.constants.modules.pay.name,
				function:
					CoinApiHelpers.constants.modules.pay.functions
						.joinVecAndSplit.name,
				typeArguments: [coinType],
				arguments: [coin, coins, amount.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	private static currencyCreatedEventType(): AnyObjectType {
		return EventsApiHelpers.createEventType(
			Sui.constants.addresses.suiPackageId,
			CoinApiHelpers.constants.modules.coin.name,
			CoinApiHelpers.constants.eventNames.currencyCreated
		);
	}
}
