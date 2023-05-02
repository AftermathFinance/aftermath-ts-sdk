import {
	ObjectId,
	TransactionArgument,
	TransactionBlock,
	bcs,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	Byte,
	CoinType,
	DeepBookAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import { Sui } from "../../sui";
import { EventOnChain } from "../../../general/types/castingTypes";
import {
	DeepBookPoolObject,
	DeepBookPriceRange,
	PartialDeepBookPoolObject,
} from "./deepBookTypes";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import { Casting, Helpers } from "../../../general/utils";

export class DeepBookApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			clob: "clob",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: {
		deepBook: DeepBookAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const deepBook = this.Provider.addresses.externalRouter?.deepBook;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!deepBook || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = {
			deepBook,
			pools,
			referralVault,
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPartialPools = async (): Promise<
		PartialDeepBookPoolObject[]
	> => {
		const objectIds = await this.Provider.Events().fetchAllEvents(
			(cursor, limit) =>
				this.Provider.Events().fetchCastEventsWithCursor<
					EventOnChain<{
						pool_id: ObjectId;
						base_asset: {
							name: string;
						};
						quote_asset: {
							name: string;
						};
					}>,
					PartialDeepBookPoolObject
				>(
					{
						MoveEventType: EventsApiHelpers.createEventType(
							this.addresses.deepBook.packages.clob,
							DeepBookApiHelpers.constants.moduleNames.clob,
							"PoolCreated"
						),
					},
					(eventOnChain) => {
						return {
							objectId: eventOnChain.parsedJson.pool_id,
							baseCoin:
								"0x" + eventOnChain.parsedJson.base_asset.name,
							quoteCoin:
								"0x" + eventOnChain.parsedJson.quote_asset.name,
						};
					},
					cursor,
					limit
				)
		);

		return objectIds;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public addTradeBaseToQuoteCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (Coin<BaseAsset>, Coin<QuoteAsset>, u64 (amountFilled), u64 (amountOut)) */ => {
		const { tx, coinInId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"swap_exact_base_for_quote"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public addTradeQuoteToBaseCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (Coin<QuoteAsset>, Coin<BaseAsset>, u64 (amountFilled), u64 (amountOut)) */ => {
		const { tx, coinInId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"swap_exact_quote_for_base"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public addGetAsksCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		baseCoinType: CoinType;
		quoteCoinType: CoinType;
	}) /* (vector<u64> (prices), vector<u64> (depths)) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"get_level2_book_status_ask_side"
			),
			typeArguments: [inputs.baseCoinType, inputs.quoteCoinType],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.pure(Casting.zeroBigInt.toString(), "u64"), // price_low
				tx.pure(Casting.u64MaxBigInt.toString(), "u64"), // price_high
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public addGetBidsCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		baseCoinType: CoinType;
		quoteCoinType: CoinType;
	}) /* (vector<u64> (prices), vector<u64> (depths)) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"get_level2_book_status_bid_side"
			),
			typeArguments: [inputs.baseCoinType, inputs.quoteCoinType],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.pure(Casting.zeroBigInt.toString(), "u64"), // price_low
				tx.pure(Casting.u64MaxBigInt.toString(), "u64"), // price_high
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public addGetBookPricesAndDepthCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		pool: PartialDeepBookPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (vector<u64> (prices), vector<u64> (depths)) */ => {
		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
			baseCoinType: inputs.pool.baseCoin,
			quoteCoinType: inputs.pool.quoteCoin,
		};

		if (
			Helpers.stripLeadingZeroesFromType(inputs.coinInType) ===
			Helpers.stripLeadingZeroesFromType(inputs.pool.baseCoin)
		) {
			return this.addGetAsksCommandToTransaction(commandInputs);
		}

		return this.addGetBidsCommandToTransaction(commandInputs);
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchBookState = async (inputs: {
		pool: PartialDeepBookPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
	}): Promise<DeepBookPriceRange[]> => {
		const tx = new TransactionBlock();
		this.addGetBookPricesAndDepthCommandToTransaction({
			...inputs,
			tx,
		});

		let prices: Byte[];
		let depths: Byte[];
		try {
			[prices, depths] =
				await this.Provider.Inspections().fetchOutputsBytesFromTransaction(
					{
						tx,
					}
				);
		} catch (e) {
			// dev inspect may fail due to empty tree on orderbook (no bids or asks)
			prices = [];
			depths = [];
		}

		// TODO: move these to casting
		const bookPricesU64 = (
			bcs.de("vector<u64>", new Uint8Array(prices)) as string[]
		).map((val) => BigInt(val));

		const bookDepths = (
			bcs.de("vector<u64>", new Uint8Array(depths)) as string[]
		).map((val) => BigInt(val));

		// TOOD: move decimal to constants
		// TODO: move balance with decimals to generic function in casting file
		const bookPrices = bookPricesU64.map((price) => {
			const priceWithDecimals = Coin.balanceWithDecimals(price, 9);

			if (
				Helpers.stripLeadingZeroesFromType(inputs.coinInType) ===
				Helpers.stripLeadingZeroesFromType(inputs.pool.baseCoin)
			) {
				return priceWithDecimals;
			}

			return 1 / priceWithDecimals;
		});

		return bookPrices.map((price, index) => {
			return {
				price,
				depth: bookDepths[index],
			};
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchCreateCompletePoolObjectFromPartial = async (inputs: {
		pool: PartialDeepBookPoolObject;
	}): Promise<DeepBookPoolObject> => {
		const { pool } = inputs;

		const [bids, asks] = await Promise.all([
			this.fetchBookState({
				pool,
				coinInType: pool.baseCoin,
				coinOutType: pool.quoteCoin,
			}),
			this.fetchBookState({
				pool,
				coinInType: pool.quoteCoin,
				coinOutType: pool.baseCoin,
			}),
		]);

		return {
			...pool,
			bids,
			asks,
		};
	};
}
