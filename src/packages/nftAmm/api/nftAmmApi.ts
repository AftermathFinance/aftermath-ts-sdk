import {
	Transaction,
	type TransactionArgument,
	type TransactionObjectArgument,
} from "@mysten/sui/transactions";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import { Casting, Helpers } from "../../../general/utils";
import type {
	Balance,
	CoinType,
	DynamicFieldObjectsWithCursor,
	Nft,
	NftAmmAddresses,
	ObjectId,
	Slippage,
	SuiAddress,
} from "../../../types";
import { Coin } from "../../coin/coin";
import { Pools } from "../../pools/pools";
import type { NftAmmMarket } from "../nftAmmMarket";
import type {
	NftAmmInterfaceGenericTypes,
	NftAmmMarketObject,
} from "../nftAmmTypes";
import { NftAmmApiCasting } from "./nftAmmApiCasting";

/**
 * Low-level NFT AMM API and transaction-builder methods.
 *
 * Object methods use the configured `AftermathApi` for on-chain reads. Builder
 * methods either create a new unsigned transaction or append one Move call to
 * a caller-owned transaction. No method signs or executes a transaction.
 */
export class NftAmmApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			actions: "actions",
			market: "market",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	/** Package and shared-object addresses required by NFT AMM Move calls. */
	public readonly addresses: NftAmmAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an NFT AMM API bound to an `AftermathApi` provider.
	 *
	 * @param api - Provider containing the network client and NFT AMM addresses.
	 * @throws `Error` when `api.addresses.nftAmm` is not configured.
	 */
	constructor(private readonly api: AftermathApi) {
		const addresses = this.api.addresses.nftAmm;
		if (!addresses) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.addresses = addresses;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches one page of NFTs from an NFT AMM market's dynamic-field table.
	 *
	 * The method lists fields under `marketTableObjectId`, uses the optional
	 * object-ID cursor and numeric page limit, and resolves the field object IDs
	 * through the NFT API. A `null` `nextCursor` means that no later page exists.
	 *
	 * @param inputs - The table parent object ID, optional previous-page cursor, and page size.
	 * @returns The resolved NFTs and the next dynamic-field cursor.
	 * @throws Errors from dynamic-field listing or NFT object resolution.
	 */
	public fetchNftsInMarketTable = async (inputs: {
		marketTableObjectId: ObjectId;
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<Nft>> => {
		return await this.api
			.DynamicFields()
			.fetchCastDynamicFieldsOfTypeWithCursor({
				...inputs,
				parentObjectId: inputs.marketTableObjectId,
				objectsFromObjectIds: (objectIds) =>
					this.api.Nfts().fetchNfts({ objectIds }),
			});
	};

	/**
	 * Fetches and casts one NFT AMM market object by ID.
	 *
	 * The response is converted by `NftAmmApiCasting.marketObjectFromSuiObject`.
	 * The current caster expects the nested pool and supply data to contain type
	 * information that is not available in every response, so casting errors are
	 * propagated instead of being replaced with guessed type arguments.
	 *
	 * @param inputs - The market's on-chain object ID.
	 * @returns The cast market object, including pool and coin type data.
	 * @throws Errors from the object client or the market caster.
	 */
	public fetchMarket = async (inputs: {
		objectId: ObjectId;
	}): Promise<NftAmmMarketObject> => {
		return this.api.Objects().fetchCastObject({
			...inputs,
			objectFromSuiObjectResponse: NftAmmApiCasting.marketObjectFromSuiObject,
		});
	};

	/**
	 * Fetches and casts a batch of NFT AMM market objects by ID.
	 *
	 * @param inputs - The market object IDs to fetch.
	 * @returns The cast market objects returned by the object client.
	 * @throws Errors from the object client or the market caster.
	 */
	public fetchMarkets = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<NftAmmMarketObject[]> => {
		return this.api.Objects().fetchCastObjectBatch({
			...inputs,
			objectFromSuiObjectResponse: NftAmmApiCasting.marketObjectFromSuiObject,
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	/**
	 * Builds an unsigned NFT AMM buy transaction.
	 *
	 * This method creates a new `Transaction`, sets `walletAddress` as its
	 * sender, calculates the required asset-coin amount from the NFT count, and
	 * selects that coin from the wallet through `Coin.fetchCoinWithAmountTx`.
	 * It then appends the `interface::buy` call with `withTransfer: true`.
	 * `slippage` is a decimal fraction such as `0.01` for 1%; the Move call
	 * receives the fixed-point complement `1 - slippage`.
	 *
	 * @param inputs - Market facade, sender address, NFT IDs to buy, slippage, and optional referrer.
	 * @returns An unsigned transaction with the sender set to `walletAddress`.
	 * @throws Errors from quote calculation, coin selection, the configured provider, or the Sui transaction builder.
	 */
	public fetchBuildBuyTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<Transaction> => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const expectedAssetCoinAmountIn = market.getBuyAssetCoinAmountIn({
			nftsCount: inputs.nftObjectIds.length,
			referral: inputs.referrer !== undefined,
		});

		const assetCoin = await this.api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: marketObject.assetCoinType,
			coinAmount: expectedAssetCoinAmountIn,
		});

		this.buyTx({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			assetCoin,
			expectedAssetCoinAmountIn,
			withTransfer: true,
		});

		return tx;
	};

	/**
	 * Builds an unsigned NFT AMM sell transaction.
	 *
	 * This method creates a new `Transaction`, sets `walletAddress` as its sender,
	 * estimates the asset-coin output from the number of NFT IDs, and appends the
	 * `interface::sell` call with `withTransfer: true`. It does not fetch the NFT
	 * objects first. The sender must own the supplied NFT IDs when the transaction
	 * executes.
	 *
	 * @param inputs - Market facade, sender address, NFT IDs to sell, slippage, and optional referrer.
	 * @returns An unsigned transaction with the sender set to `walletAddress`.
	 * @throws Errors from quote calculation or the Sui transaction builder.
	 */
	public fetchBuildSellTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<Transaction> => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const expectedAssetCoinAmountOut = market.getSellAssetCoinAmountOut({
			nftsCount: inputs.nftObjectIds.length,
			referral: inputs.referrer !== undefined,
		});

		this.sellTx({
			...inputs,
			tx,
			nfts: inputs.nftObjectIds,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedAssetCoinAmountOut,
			withTransfer: true,
		});

		return tx;
	};

	/**
	 * Builds an unsigned NFT AMM deposit transaction.
	 *
	 * The method creates a transaction with `walletAddress` as sender, calculates
	 * the pool LP ratio, converts that ratio to an 18-decimal fixed-point bigint,
	 * selects the requested asset-coin amount from the wallet, and appends the
	 * `interface::deposit` call with `withTransfer: true`.
	 *
	 * @param inputs - Market facade, sender address, asset amount, NFT IDs, slippage, and optional referrer.
	 * @returns An unsigned transaction with the sender set to `walletAddress`.
	 * @throws Errors from quote calculation, coin selection, the configured provider, or the Sui transaction builder.
	 */
	public fetchBuildDepositTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		assetCoinAmountIn: Balance;
		nfts: (ObjectId | TransactionArgument)[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<Transaction> => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const { lpRatio } = market.getDepositLpCoinAmountOut({
			assetCoinAmountIn: inputs.assetCoinAmountIn,
			referral: inputs.referrer !== undefined,
		});

		// // TODO: move this somewhere else and into its own func
		const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

		const assetCoin = await this.api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: marketObject.assetCoinType,
			coinAmount: inputs.assetCoinAmountIn,
		});

		this.depositTx({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedLpRatio,
			assetCoin,
			withTransfer: true,
		});

		return tx;
	};

	/**
	 * Builds an unsigned NFT AMM withdrawal transaction.
	 *
	 * The method creates a transaction with `walletAddress` as sender, estimates
	 * the fractionalized-coin output, converts the non-zero output to the minimum
	 * asset-coin amount used by the Move call, selects the LP coin amount from the
	 * wallet, and appends the `interface::withdraw` call with `withTransfer: true`.
	 *
	 * @param inputs - Market facade, sender address, LP amount, NFT IDs, slippage, and optional referrer.
	 * @returns An unsigned transaction with the sender set to `walletAddress`.
	 * @throws Errors from quote calculation, coin selection, the configured provider, or the Sui transaction builder.
	 */
	public fetchBuildWithdrawTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		lpCoinAmount: Balance;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<Transaction> => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const fractionalizedCoinAmountOut =
			market.getWithdrawFractionalizedCoinAmountOut({
				lpCoinAmount: inputs.lpCoinAmount,
				referral: inputs.referrer !== undefined,
			});

		const { balances: coinAmountsOut } = Coin.coinsAndBalancesOverZero({
			[marketObject.fractionalizedCoinType]: fractionalizedCoinAmountOut,
		});
		const expectedAssetCoinAmountOut = coinAmountsOut[0];

		const lpCoin = await this.api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: marketObject.lpCoinType,
			coinAmount: inputs.lpCoinAmount,
		});

		this.addWithdrawCommandToTransaction({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedAssetCoinAmountOut,
			lpCoin,
			withTransfer: true,
		});

		return tx;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	/**
	 * Appends an NFT AMM buy Move call to an existing transaction.
	 *
	 * This local builder does not create a transaction, set its sender, select
	 * coins, or sign. `withTransfer: true` targets `interface::buy`; otherwise it
	 * targets `actions::buy`, allowing the caller to compose the returned Move
	 * values. The slippage value is encoded as the fixed-point complement
	 * `1 - inputs.slippage`.
	 *
	 * @param inputs - Transaction, market object ID, asset coin argument, NFT IDs, expected asset input, type tuple, slippage, and transfer mode.
	 * @returns The `TransactionArgument` returned by `tx.moveCall`.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public buyTx = (inputs: {
		tx: Transaction;
		marketObjectId: ObjectId;
		assetCoin: ObjectId | TransactionArgument;
		nftObjectIds: ObjectId[];
		expectedAssetCoinAmountIn: Balance;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, assetCoin, genericTypes, nftObjectIds } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"buy"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				typeof assetCoin === "string" ? tx.object(assetCoin) : assetCoin,
				tx.makeMoveVec({
					elements: nftObjectIds.map((id) => tx.object(id)),
					type: "ID",
				}),
				tx.pure.u64(inputs.expectedAssetCoinAmountIn.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage)),
			],
		});
	};

	/**
	 * Appends an NFT AMM sell Move call to an existing transaction.
	 *
	 * This local builder accepts either object IDs or existing transaction object
	 * arguments in `nfts`. `withTransfer: true` targets `interface::sell`;
	 * otherwise it targets `actions::sell`. The caller must provide NFT objects
	 * owned or otherwise usable by the transaction sender.
	 *
	 * @param inputs - Transaction, market object ID, NFT arguments, expected asset output, type tuple, slippage, and transfer mode.
	 * @returns The `TransactionArgument` returned by `tx.moveCall`.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public sellTx = (inputs: {
		tx: Transaction;
		marketObjectId: ObjectId;
		nfts: (ObjectId | TransactionArgument)[];
		expectedAssetCoinAmountOut: Balance;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, genericTypes, nfts } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"sell"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				tx.makeMoveVec({
					elements: Helpers.isArrayOfStrings(nfts)
						? nfts.map((nft) => tx.object(nft))
						: (nfts as TransactionObjectArgument[]),
					type: genericTypes[3],
				}),
				tx.pure.u64(inputs.expectedAssetCoinAmountOut.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage)),
			],
		});
	};

	/**
	 * Appends an NFT AMM deposit Move call to an existing transaction.
	 *
	 * The `expectedLpRatio` argument is an 18-decimal fixed-point bigint. The
	 * builder accepts asset and NFT inputs as object IDs or transaction arguments,
	 * and selects `interface::deposit` when `withTransfer` is true, otherwise
	 * `actions::deposit`.
	 *
	 * @param inputs - Transaction, market object ID, asset coin argument, NFT arguments, fixed LP ratio, type tuple, slippage, and transfer mode.
	 * @returns The `TransactionArgument` returned by `tx.moveCall`.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public depositTx = (inputs: {
		tx: Transaction;
		marketObjectId: ObjectId;
		assetCoin: ObjectId | TransactionArgument;
		nfts: (ObjectId | TransactionArgument)[];
		expectedLpRatio: bigint;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, assetCoin, genericTypes, nfts } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"deposit"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				typeof assetCoin === "string" ? tx.object(assetCoin) : assetCoin,
				tx.makeMoveVec({
					elements: Helpers.isArrayOfStrings(nfts)
						? nfts.map((nft) => tx.object(nft))
						: (nfts as TransactionObjectArgument[]),
					type: genericTypes[3],
				}),
				tx.pure.u64(inputs.expectedLpRatio.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage)),
			],
		});
	};

	/**
	 * Appends an NFT AMM withdrawal Move call to an existing transaction.
	 *
	 * This local builder accepts an LP coin object ID or transaction argument and
	 * NFT object IDs. `withTransfer: true` targets `interface::withdraw`;
	 * otherwise it targets `actions::withdraw`. The expected asset output is a
	 * raw balance in the asset coin's smallest unit.
	 *
	 * @param inputs - Transaction, market object ID, LP coin argument, NFT IDs, expected asset output, type tuple, slippage, and transfer mode.
	 * @returns The `TransactionArgument` returned by `tx.moveCall`.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public addWithdrawCommandToTransaction = (inputs: {
		tx: Transaction;
		marketObjectId: ObjectId;
		lpCoin: ObjectId | TransactionArgument;
		nftObjectIds: ObjectId[];
		expectedAssetCoinAmountOut: Balance;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, lpCoin, genericTypes, nftObjectIds } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"withdraw"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				typeof lpCoin === "string" ? tx.object(lpCoin) : lpCoin,
				tx.makeMoveVec({
					elements: nftObjectIds.map((id) => tx.object(id)),
					type: "ID",
				}),
				tx.pure.u64(inputs.expectedAssetCoinAmountOut.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage)),
			],
		});
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static genericTypesForMarket = (inputs: {
		market: NftAmmMarket;
	}): [
		lpCoinType: CoinType,
		fractionalizedCoinType: CoinType,
		assetCoinType: CoinType,
		nftType: CoinType,
	] => {
		const marketObject = inputs.market.market;
		return [
			marketObject.lpCoinType,
			marketObject.fractionalizedCoinType,
			marketObject.assetCoinType,
			marketObject.nftType,
		];
	};
}
