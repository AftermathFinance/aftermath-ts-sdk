import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { Coin } from "../coin";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinMetadaWithInfo,
	CoinType,
	ObjectId,
	SuiAddress,
} from "../../../types";
import { Helpers } from "../../../general/utils/helpers";
import { Pools } from "../../pools/pools";
import { Casting } from "../../../general/utils";
import { CoinStruct, PaginatedCoins } from "@mysten/sui.js/client";

export class CoinApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchCoinMetadata = async (
		coin: CoinType
	): Promise<CoinMetadaWithInfo> => {
		try {
			const coinMetadata = await this.Provider.provider.getCoinMetadata({
				coinType: Helpers.stripLeadingZeroesFromType(coin),
			});
			if (coinMetadata === null) throw new Error("coin metadata is null");

			return {
				...coinMetadata,
				isGenerated: false,
			};
		} catch (error) {
			try {
				const lpCoinType = coin;

				await this.Provider.Pools().fetchPoolObjectIdForLpCoinType({
					lpCoinType,
				});
				return this.createLpCoinMetadata({ lpCoinType });
			} catch (e) {}

			const maxSymbolLength = 10;
			const maxPackageNameLength = 24;

			const coinClass = new Coin(coin);
			const symbol = coinClass.coinTypeSymbol
				.toUpperCase()
				.slice(0, maxSymbolLength);
			const packageName = coinClass.coinTypePackageName.slice(
				0,
				maxPackageNameLength
			);
			return {
				symbol,
				id: null,
				description: `${symbol} (${packageName})`,
				name: symbol
					.split("_")
					.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
					.join(" "),
				decimals: 9,
				iconUrl: null,
				isGenerated: true,
			};
		}
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchCoinWithAmountTx = async (inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
	}): Promise<TransactionArgument> => {
		const { tx, walletAddress, coinType, coinAmount } = inputs;

		tx.setSender(walletAddress);

		const coinData = await this.fetchAllCoins(inputs);
		return CoinApi.coinWithAmountTx({
			tx,
			coinData,
			coinAmount,
			coinType,
		});
	};

	public fetchCoinsWithAmountTx = async (inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		coinTypes: CoinType[];
		coinAmounts: Balance[];
	}): Promise<TransactionArgument[]> => {
		const { tx, walletAddress, coinTypes, coinAmounts } = inputs;

		tx.setSender(walletAddress);

		const allCoinsData = await Promise.all(
			coinTypes.map(async (coinType, index) =>
				this.fetchAllCoins({
					...inputs,
					// coinAmount: coinAmounts[index],
					coinType,
				})
			)
		);

		let coinArgs: TransactionArgument[] = [];
		for (const [index, coinData] of allCoinsData.entries()) {
			const coinArg = CoinApi.coinWithAmountTx({
				tx,
				coinData,
				coinAmount: coinAmounts[index],
				coinType: coinTypes[index],
			});

			coinArgs = [...coinArgs, coinArg];
		}

		return coinArgs;
	};

	// fetchCoinsUntilAmountReachedOrEnd
	public fetchAllCoins = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		// coinAmount: Balance;
	}): Promise<CoinStruct[]> => {
		let allCoinData: CoinStruct[] = [];
		let cursor: string | undefined = undefined;
		do {
			const paginatedCoins: PaginatedCoins =
				await this.Provider.provider.getCoins({
					...inputs,
					owner: inputs.walletAddress,
					cursor,
				});

			const coinData = paginatedCoins.data.filter(
				(data) => BigInt(data.balance) > BigInt(0)
			);
			allCoinData = [...allCoinData, ...coinData];

			// const totalAmount = Helpers.sumBigInt(
			// 	allCoinData.map((data) => BigInt(data.balance))
			// );
			// if (totalAmount >= inputs.coinAmount) return allCoinData;

			if (
				paginatedCoins.data.length === 0 ||
				!paginatedCoins.hasNextPage ||
				!paginatedCoins.nextCursor
			)
				return allCoinData.sort((b, a) =>
					Number(BigInt(b.coinObjectId) - BigInt(a.coinObjectId))
				);

			cursor = paginatedCoins.nextCursor;
		} while (true);
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static formatCoinTypesForMoveCall = (coins: CoinType[]) =>
		coins.map((coin) => Casting.u8VectorFromString(coin.slice(2))); // slice to remove 0x

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	// NOTE: this is temporary until LP coin metadata issue is solved on Sui
	private createLpCoinMetadata = async (inputs: {
		lpCoinType: CoinType;
	}): Promise<CoinMetadaWithInfo> => {
		try {
			const PoolsApi = this.Provider.Pools();

			// TODO: find the best way to do all of this using cached server data
			const poolObjectId = await PoolsApi.fetchPoolObjectIdForLpCoinType(
				inputs
			);
			const pool = await PoolsApi.fetchPool({ objectId: poolObjectId });

			const maxCoinSymbolLength = 5;
			const notPrettyCoinSymbol =
				pool.name.length > maxCoinSymbolLength
					? pool.name.toUpperCase().slice(0, maxCoinSymbolLength)
					: pool.name.toUpperCase();
			const coinSymbol =
				notPrettyCoinSymbol.slice(-1) === "_"
					? notPrettyCoinSymbol.slice(0, -1)
					: notPrettyCoinSymbol;

			const coinName = pool.name
				.split(" ")
				.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
				.join(" ");

			const coinDescription =
				await PoolsApi.createLpCoinMetadataDescription({
					poolName: pool.name,
					coinTypes: Object.keys(pool.coins),
				});

			return {
				symbol: `AF_LP_${coinSymbol}`,
				id: null,
				description: coinDescription,
				name: `Af Lp ${coinName}`,
				// TODO: fetch this
				decimals: Pools.constants.defaults.lpCoinDecimals,
				iconUrl: null,
				isGenerated: true,
			};
		} catch (e) {
			return {
				symbol: "AF_LP",
				id: null,
				description: "Aftermath Finance LP",
				name: "Af Lp",
				decimals: Pools.constants.defaults.lpCoinDecimals,
				iconUrl: null,
				isGenerated: true,
			};
		}
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	private static coinWithAmountTx = (inputs: {
		tx: TransactionBlock;
		coinData: CoinStruct[];
		coinAmount: Balance;
		coinType: CoinType;
	}): TransactionArgument => {
		const { tx, coinData, coinAmount, coinType } = inputs;

		const isSuiCoin = Coin.isSuiCoin(coinData[0].coinType);

		const totalCoinBalance = Helpers.sumBigInt(
			coinData.map((data) => BigInt(data.balance))
		);
		if (totalCoinBalance < coinAmount)
			throw new Error("wallet does not have coins of sufficient balance");

		if (isSuiCoin) {
			tx.setGasPayment(
				coinData.map((obj) => {
					return {
						...obj,
						objectId: obj.coinObjectId,
					};
				})
			);

			return tx.splitCoins(tx.gas, [tx.pure(coinAmount)]);
			// return Helpers.transactions.splitCoinsTx({
			// 	tx,
			// 	coinId: tx.gas,
			// 	amounts: [coinAmount],
			// 	coinType,
			// });
		}

		const coinObjectIds = coinData.map((data) => data.coinObjectId);
		const mergedCoinObjectId: ObjectId = coinObjectIds[0];

		if (coinObjectIds.length > 1) {
			tx.add({
				kind: "MergeCoins",
				destination: tx.object(mergedCoinObjectId),
				sources: [
					...coinObjectIds
						.slice(1)
						.map((coinId) => tx.object(coinId)),
				],
			});
		}

		// return tx.add({
		// 	kind: "SplitCoins",
		// 	coin: tx.object(mergedCoinObjectId),
		// 	amounts: [tx.pure(coinAmount)],
		// });
		return Helpers.transactions.splitCoinsTx({
			tx,
			coinId: mergedCoinObjectId,
			amounts: [coinAmount],
			coinType,
		});
	};
}
