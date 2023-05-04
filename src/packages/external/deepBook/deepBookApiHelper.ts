import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
	bcs,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
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
			custodian: "custodian",
			wrapper: "deepbook",
		},
		poolCreationFeeInSui: BigInt("1_000_000_000_00"), // 100 SUI
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: {
		deepBook: DeepBookAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	public readonly objectTypes: {
		accountCap: AnyObjectType;
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
		this.objectTypes = {
			accountCap: `${deepBook.packages.clob}::${DeepBookApiHelpers.constants.moduleNames.custodian}::AccountCap`,
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
							baseCoinType:
								"0x" + eventOnChain.parsedJson.base_asset.name,
							quoteCoinType:
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

	/////////////////////////////////////////////////////////////////////
	//// Trading Transaction Commands
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
				this.addresses.deepBook.packages.wrapper,
				DeepBookApiHelpers.constants.moduleNames.wrapper,
				"swap_exact_base_for_quote_ktc"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(inputs.poolObjectId),
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
				this.addresses.deepBook.packages.wrapper,
				DeepBookApiHelpers.constants.moduleNames.wrapper,
				"swap_exact_quote_for_base"
			),
			typeArguments: [inputs.coinOutType, inputs.coinInType],
			arguments: [
				tx.object(inputs.poolObjectId),
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

	/////////////////////////////////////////////////////////////////////
	//// Pool Setup Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public createPoolTx = (inputs: {
		tx: TransactionBlock;
		tickSize: bigint;
		lotSize: bigint;
		suiFeeCoinId: ObjectId | TransactionArgument;
		baseCoinType: CoinType;
		quoteCoinType: CoinType;
	}) => {
		const { tx, suiFeeCoinId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"create_pool"
			),
			typeArguments: [inputs.baseCoinType, inputs.quoteCoinType],
			arguments: [
				tx.pure(inputs.tickSize, "u64"),
				tx.pure(inputs.lotSize, "u64"),
				typeof suiFeeCoinId === "string"
					? tx.object(suiFeeCoinId)
					: suiFeeCoinId,
			],
		});
	};

	public createAccountTx = (inputs: {
		tx: TransactionBlock;
	}) /* AccountCap */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"create_account"
			),
			typeArguments: [],
			arguments: [],
		});
	};

	public depositBaseTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		baseCoinId: ObjectId | TransactionArgument;
		accountCapId: ObjectId | TransactionArgument;
		baseCoinType: CoinType;
		quoteCoinType: CoinType;
	}) => {
		const { tx, baseCoinId, accountCapId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"deposit_base"
			),
			typeArguments: [inputs.baseCoinType, inputs.quoteCoinType],
			arguments: [
				tx.object(inputs.poolObjectId),
				typeof baseCoinId === "string"
					? tx.object(baseCoinId)
					: baseCoinId,
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
			],
		});
	};

	public depositQuoteTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		quoteCoinId: ObjectId | TransactionArgument;
		accountCapId: ObjectId | TransactionArgument;
		baseCoinType: CoinType;
		quoteCoinType: CoinType;
	}) => {
		const { tx, quoteCoinId, accountCapId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"deposit_base"
			),
			typeArguments: [inputs.baseCoinType, inputs.quoteCoinType],
			arguments: [
				tx.object(inputs.poolObjectId),
				typeof quoteCoinId === "string"
					? tx.object(quoteCoinId)
					: quoteCoinId,
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
			],
		});
	};

	public placeLimitOrderTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		accountCapId: ObjectId | TransactionArgument;
		price: bigint;
		quantity: Balance;
		isBidOrder: boolean;
		baseCoinType: CoinType;
		quoteCoinType: CoinType;
	}) => {
		const { tx, accountCapId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"place_limit_order"
			),
			typeArguments: [inputs.baseCoinType, inputs.quoteCoinType],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.pure(inputs.price, "u64"),
				tx.pure(inputs.quantity, "u64"),
				tx.pure(inputs.isBidOrder, "bool"),
				tx.pure(Casting.u64MaxBigInt.toString(), "u64"), // expire_timestamp
				tx.pure(Casting.zeroBigInt, "u64"), // restriction (0 = NO_RESTRICTION)
				tx.object(Sui.constants.addresses.suiClockId),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
			],
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Command Wrappers
	/////////////////////////////////////////////////////////////////////

	public addGetBookPricesAndDepthCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		pool: PartialDeepBookPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (vector<u64> (prices), vector<u64> (depths)) */ => {
		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
			baseCoinType: inputs.pool.baseCoinType,
			quoteCoinType: inputs.pool.quoteCoinType,
		};

		if (
			Helpers.stripLeadingZeroesFromType(inputs.coinInType) ===
			Helpers.stripLeadingZeroesFromType(inputs.pool.baseCoinType)
		) {
			return this.addGetAsksCommandToTransaction(commandInputs);
		}

		return this.addGetBidsCommandToTransaction(commandInputs);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public buildCreateAccountTx = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const [accountCap] = this.createAccountTx({ tx });

		tx.transferObjects([accountCap], tx.pure(inputs.walletAddress));

		return tx;
	};

	public fetchBuildDepositBaseAndQuoteTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: PartialDeepBookPoolObject;
		baseCoinAmount: Balance;
		quoteCoinAmount: Balance;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const accountCapId = await this.fetchOwnedAccountCapObjectId(inputs);

		const { coinArguments, txWithCoinsWithAmount: newTx } =
			await this.Provider.Coin().Helpers.fetchAddCoinsWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				[inputs.pool.baseCoinType, inputs.pool.quoteCoinType],
				[inputs.baseCoinAmount, inputs.quoteCoinAmount]
			);

		const baseCoinId = coinArguments[0];
		const quoteCoinId = coinArguments[1];

		const commandInputs = {
			...inputs,
			tx: newTx,
			poolObjectId: inputs.pool.objectId,
			baseCoinType: inputs.pool.baseCoinType,
			quoteCoinType: inputs.pool.quoteCoinType,
			baseCoinId,
			quoteCoinId,
			accountCapId,
		};

		this.depositBaseTx(commandInputs);
		this.depositQuoteTx(commandInputs);

		return tx;
	};

	public fetchBuildPlaceLimitOrderTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: PartialDeepBookPoolObject;
		price: bigint;
		quantity: Balance;
		isBidOrder: boolean;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const accountCapId = await this.fetchOwnedAccountCapObjectId(inputs);

		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
			baseCoinType: inputs.pool.baseCoinType,
			quoteCoinType: inputs.pool.quoteCoinType,
			accountCapId,
			tx,
		};

		this.placeLimitOrderTx(commandInputs);

		return tx;
	};

	public fetchBuildCreatePoolTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: PartialDeepBookPoolObject;
		tickSize: bigint;
		lotSize: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const accountCapId = await this.fetchOwnedAccountCapObjectId(inputs);

		const { coinArgument, txWithCoinWithAmount: newTx } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				Coin.constants.suiCoinType,
				DeepBookApiHelpers.constants.poolCreationFeeInSui
			);

		const commandInputs = {
			...inputs,
			tx: newTx,
			poolObjectId: inputs.pool.objectId,
			baseCoinType: inputs.pool.baseCoinType,
			quoteCoinType: inputs.pool.quoteCoinType,
			accountCapId,
			suiFeeCoinId: coinArgument,
		};

		this.createPoolTx(commandInputs);

		return tx;
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
				Helpers.stripLeadingZeroesFromType(inputs.pool.baseCoinType)
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
				coinInType: pool.baseCoinType,
				coinOutType: pool.quoteCoinType,
			}),
			this.fetchBookState({
				pool,
				coinInType: pool.quoteCoinType,
				coinOutType: pool.baseCoinType,
			}),
		]);

		return {
			...pool,
			bids,
			asks,
		};
	};

	public fetchOwnedAccountCapObjectId = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<ObjectId> => {
		// TODO: handle multiple accounts ?
		const accountCaps =
			await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress(
				inputs.walletAddress,
				this.objectTypes.accountCap
			);
		if (accountCaps.length <= 0)
			throw new Error("unable to find account cap owned by address");

		const accountCapId = accountCaps[0].data?.objectId;
		if (!accountCapId)
			throw new Error("unable to find account cap owned by address");

		return accountCapId;
	};
}
