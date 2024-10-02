import {
	TransactionArgument,
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { Coin } from "../coin";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinDecimal,
	CoinMetadaWithInfo,
	CoinType,
	CoinsToDecimals,
	ObjectId,
	ServiceCoinData,
	SuiAddress,
} from "../../../types";
import { Helpers } from "../../../general/utils/helpers";
import { Pools } from "../../pools/pools";
import { Casting } from "../../../general/utils";
import { CoinStruct, PaginatedCoins } from "@mysten/sui/client";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { CoinGeckoApiHelpers } from "../../../general/prices/coingecko/coinGeckoApiHelpers";
import { CoinGeckoChain } from "../../../general/prices/coingecko/coinGeckoTypes";
// import { ethers, Networkish } from "ethers";

export class CoinApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		private readonly Provider: AftermathApi,
		private readonly coinGeckoApiKey?: string // private readonly infuraConfig?: { // 	network: Networkish; // 	projectId: string;
	) // 	projectSecret: string;
	// }
	{}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchCoinMetadata = this.Provider.withCache({
		key: "fetchCoinMetadata",
		expirationSeconds: -1,
		callback: async (inputs: {
			coin: CoinType;
		}): Promise<CoinMetadaWithInfo> => {
			const { coin } = inputs;

			if (Helpers.isValidType(coin)) {
				// sui coin
				try {
					const coinMetadata =
						await this.Provider.provider.getCoinMetadata({
							coinType: Helpers.stripLeadingZeroesFromType(coin),
						});
					if (coinMetadata === null)
						throw new Error("coin metadata is null");

					return {
						...coinMetadata,
						isGenerated: false,
					};
				} catch (error) {
					try {
						return this.createLpCoinMetadata({ lpCoinType: coin });
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
							.map((word) =>
								Helpers.capitalizeOnlyFirstLetter(word)
							)
							.join(" "),
						decimals: Coin.constants.defaultCoinDecimals.sui,
						iconUrl: null,
						isGenerated: true,
					};
				}
			} else {
				// non sui coin
				const { coinType, chain } = Helpers.splitNonSuiCoinType(coin);

				if (chain === "solana") {
					// svm
					return this.fetchSvmCoinMetadata({
						coinType,
					});
				} else {
					// evm
					return this.fetchEvmCoinMetadata({
						coinType,
						chain,
					});
				}
			}
		},
	});

	public fetchCoinsToDecimals = this.Provider.withCache({
		key: "fetchCoinsToDecimals",
		expirationSeconds: -1,
		callback: async (inputs: {
			coins: CoinType[];
		}): Promise<CoinsToDecimals> => {
			const { coins } = inputs;

			const allDecimals = await Promise.all(
				coins.map(
					async (coin) =>
						(
							await this.fetchCoinMetadata({ coin })
						).decimals
				)
			);

			const coinsToDecimals: Record<CoinType, CoinDecimal> =
				allDecimals.reduce((acc, decimals, index) => {
					return { ...acc, [coins[index]]: decimals };
				}, {});
			return coinsToDecimals;
		},
	});

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchCoinWithAmountTx = async (inputs: {
		tx: Transaction | TransactionBlock;
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
		isSponsoredTx?: boolean;
	}): Promise<TransactionObjectArgument> => {
		const { tx, walletAddress, coinType, coinAmount, isSponsoredTx } =
			inputs;

		tx.setSender(walletAddress);

		const coinData = await this.fetchAllCoins(inputs);
		return CoinApi.coinWithAmountTx({
			tx,
			coinData,
			coinAmount,
			coinType,
			isSponsoredTx,
		});
	};

	public fetchCoinsWithAmountTx = async (inputs: {
		tx: Transaction;
		walletAddress: SuiAddress;
		coinTypes: CoinType[];
		coinAmounts: Balance[];
		isSponsoredTx?: boolean;
	}): Promise<TransactionObjectArgument[]> => {
		const { tx, walletAddress, coinTypes, coinAmounts, isSponsoredTx } =
			inputs;

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

		let coinArgs: TransactionObjectArgument[] = [];
		for (const [index, coinData] of allCoinsData.entries()) {
			const coinArg = CoinApi.coinWithAmountTx({
				tx,
				coinData,
				coinAmount: coinAmounts[index],
				coinType: coinTypes[index],
				isSponsoredTx,
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

			// const coinData = paginatedCoins.data.filter(
			// 	(data) => BigInt(data.balance) > BigInt(0)
			// );
			const coinData = paginatedCoins.data;
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

			const poolObjectId = await PoolsApi.fetchPoolObjectIdForLpCoinType(
				inputs
			);
			if (!poolObjectId) throw new Error("invalid lp coin type");

			const pool = await PoolsApi.fetchPool({ objectId: poolObjectId });

			const coinSymbols = Object.keys(pool.coins).map(
				(coin) => new Coin(coin).coinTypeSymbol
			);
			// const coinSymbols = (
			// 	await Promise.all(
			// 		Object.keys(pool.coins).map((coin) =>
			// 			this.Provider.Coin().fetchCoinMetadata({
			// 				coin,
			// 			})
			// 		)
			// 	)
			// ).map((metadata) => metadata.symbol);

			const coinsString = `${coinSymbols.reduce(
				(acc, symbol, index) =>
					acc + symbol + (index >= coinSymbols.length - 1 ? "" : "/"),
				""
			)}`;

			return {
				symbol: `${coinsString} afLP`,
				id: null,
				description: `Aftermath LP Coin for ${coinsString} Pool`,
				name: `${coinsString} LP`,
				decimals: pool.lpCoinDecimals,
				iconUrl: null,
				isGenerated: true,
			};
		} catch (e) {
			return {
				symbol: "afLP",
				id: null,
				description: "Aftermath Finance LP",
				name: "LP",
				decimals: Pools.constants.defaults.lpCoinDecimals,
				iconUrl: null,
				isGenerated: true,
			};
		}
	};

	private fetchEvmCoinMetadata = this.Provider.withCache({
		key: "fetchEvmCoinMetadata",
		expirationSeconds: -1,
		callback: async (inputs: {
			coinType: CoinType;
			chain: Exclude<CoinGeckoChain, "sui">;
		}): Promise<CoinMetadaWithInfo> => {
			// NOTE: do leading 0s need to be handled ?
			const { coinType, chain } = inputs;

			try {
				if (!this.coinGeckoApiKey)
					throw new Error("no coinGeckoApiKey provided");

				// const ERC20_ABI = [
				// 	"function name() view returns (string)",
				// 	"function symbol() view returns (string)",
				// 	"function decimals() view returns (uint8)",
				// ];
				// const infuraProvider = new ethers.InfuraProvider(
				// 	// TODO: add more conversions, move to helpers ?
				// 	chain === "ethereum"
				// 		? "mainnet"
				// 		: chain === "bsc"
				// 		? "bnb"
				// 		: // : chain === "polygon"
				// 		  // ? "matic"
				// 		  chain,
				// 	this.infuraConfig?.projectId,
				// 	this.infuraConfig?.projectSecret
				// );
				// const contract = new ethers.Contract(
				// 	coinType,
				// 	ERC20_ABI,
				// 	infuraProvider
				// );

				const coingeckoApi = new CoinGeckoApiHelpers(
					this.Provider,
					this.coinGeckoApiKey
					// {}
				);

				let coinMetadata = await coingeckoApi.fetchCoinMetadata(inputs);

				// let decimals = coinMetadata?.decimals;
				// if (decimals === undefined || decimals < 0) {
				// 	decimals = (await contract.decimals()) as CoinDecimal;
				// }

				// if (!coinMetadata) {
				// 	const [name, symbol]: [string, string] = await Promise.all([
				// 		contract.name(),
				// 		contract.symbol(),
				// 	]);
				// 	coinMetadata = {
				// 		symbol,
				// 		name,
				// 		description: `${name} (${chain})`,
				// 		decimals,
				// 	};
				// }

				return {
					// id: null,
					// iconUrl: null,
					// NOTE: should this be shortened ?
					symbol: coinType,
					name: coinType,
					description: `${coinType} (${chain})`,
					decimals: Coin.constants.defaultCoinDecimals.evm,
					// isGenerated: true,
					iconUrl: null,
					...(coinMetadata ?? {}),
					// decimals,
					id: null,
					isGenerated: false,
				};
			} catch (error) {
				console.error(error);
				return {
					id: null,
					iconUrl: null,
					// NOTE: should this be shortened ?
					symbol: coinType,
					name: coinType,
					description: `${coinType} (${chain})`,
					decimals: Coin.constants.defaultCoinDecimals.evm,
					isGenerated: true,
				};
			}
		},
	});

	private fetchSvmCoinMetadata = this.Provider.withCache({
		key: "fetchSvmCoinMetadata",
		expirationSeconds: -1,
		callback: async (inputs: {
			coinType: CoinType;
		}): Promise<CoinMetadaWithInfo> => {
			// NOTE: do leading 0s need to be handled ?
			const { coinType } = inputs;

			const fallbackCoinMetadata = {
				// NOTE: should this be shortened ?
				symbol: coinType,
				name: coinType,
				description: `${coinType} (solana)`,
				decimals: Coin.constants.defaultCoinDecimals.svm,
			};

			try {
				if (!this.coinGeckoApiKey)
					throw new Error("no coinGeckoApiKey provided");

				// TODO: handle missing coingecko data

				const coingeckoApi = new CoinGeckoApiHelpers(
					this.Provider,
					this.coinGeckoApiKey
					// {}
				);

				const coinMetadata = await coingeckoApi.fetchCoinMetadata({
					coinType,
					chain: "solana",
				});

				return {
					iconUrl: null,
					...(coinMetadata ?? fallbackCoinMetadata),
					id: null,
					isGenerated: !coinMetadata,
				};
			} catch (error) {
				console.error(error);
				return {
					id: null,
					iconUrl: null,
					...fallbackCoinMetadata,
					isGenerated: true,
				};
			}
		},
	});

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	private static coinWithAmountTx = (inputs: {
		tx: Transaction | TransactionBlock;
		coinData: CoinStruct[];
		coinAmount: Balance;
		coinType: CoinType;
		isSponsoredTx?: boolean;
	}): TransactionObjectArgument => {
		const { tx, coinData, coinAmount, coinType, isSponsoredTx } = inputs;

		const isSuiCoin = Coin.isSuiCoin(coinData[0].coinType);

		const totalCoinBalance = Helpers.sumBigInt(
			coinData.map((data) => BigInt(data.balance))
		);
		if (totalCoinBalance < coinAmount)
			throw new Error("wallet does not have coins of sufficient balance");

		if (!isSponsoredTx && isSuiCoin) {
			tx.setGasPayment(
				coinData.map((obj) => {
					return {
						...obj,
						objectId: obj.coinObjectId,
					};
				})
			);

			return tx.splitCoins(tx.gas, [coinAmount]);
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
			// tx.mergeCoins(tx.object(mergedCoinObjectId), [
			// 	...coinObjectIds.slice(1).map((coinId) => tx.object(coinId)),
			// ]);

			// TODO: fix this (v1)

			tx.add({
				$kind: "MergeCoins",
				MergeCoins: {
					destination: tx.object(mergedCoinObjectId),
					sources: [
						...coinObjectIds
							.slice(1)
							.map((coinId) => tx.object(coinId)),
					],
				},
			});
		}

		// return tx.add({
		// 	kind: "SplitCoins",
		// 	coin: tx.object(mergedCoinObjectId),
		// 	amounts: [tx.pure(coinAmount)],
		// });
		return TransactionsApiHelpers.splitCoinTx({
			tx,
			coinId: mergedCoinObjectId,
			amount: coinAmount,
			coinType,
		});
	};
}
