import { AftermathApi } from "../../../general/providers/aftermathApi";
import { NftAmmApiCasting } from "./nftAmmApiCasting";
import {
	AfNftAddresses,
	Balance,
	CoinType,
	DynamicFieldObjectsWithCursor,
	FractionalNftsAddresses,
	Nft,
	NftAmmAddresses,
	NftAmmMarketData,
	ObjectId,
	PoolsAddresses,
	Slippage,
	SuiAddress,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../../coin/coin";
import { Pools } from "../../pools/pools";
import {
	TransactionBlock,
	TransactionArgument,
} from "@mysten/sui.js/transactions";
import { AfEggNftAmmMarket } from "../afEggNftAmmMarket";

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

	public readonly addresses: {
		nftAmm: NftAmmAddresses;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const nftAmm = Provider.addresses.nftAmm;

		if (!nftAmm)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			nftAmm,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchNftsInMarketWithCursor = async (inputs: {
		kioskId: ObjectId;
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<Nft>> => {
		return this.Provider.Nfts().fetchNftsInKioskWithCursor({
			kioskObjectId: inputs.kioskId,
		});
	};

	public fetchAfEggMarket = async (): Promise<NftAmmMarketData> => {
		const [pool, vault] = await Promise.all([
			this.Provider.Pools().fetchPool({
				objectId: this.addresses.nftAmm.objects.afEgg.poolId,
			}),
			this.Provider.FractionalNfts().fetchNftVault({
				objectId: this.addresses.nftAmm.objects.afEgg.vaultId,
			}),
		]);
		return {
			pool,
			vault,
		};
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildBuyAfEggsTx = async (inputs: {
		market?: AfEggNftAmmMarket;
		walletAddress: SuiAddress;
		nftIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { slippage, referrer, nftIds } = inputs;

		const market =
			inputs.market ??
			new AfEggNftAmmMarket(await this.fetchAfEggMarket());

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const afSuiAmountIn = market.getBuyAfSuiAmountIn({
			nftsCount: inputs.nftIds.length,
			referral: referrer !== undefined,
		});
		const afSuiCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: market.afSuiCoinType(),
			coinAmount: afSuiAmountIn,
		});

		// swap afSUI -> fCoin
		const fractionalCoinId = this.Provider.Pools().tradeTx({
			tx,
			slippage,
			expectedCoinOutAmount:
				BigInt(inputs.nftIds.length) * market.fractionsAmount(),
			coinInId: afSuiCoinId,
			coinInType: market.afSuiCoinType(),
			coinOutType: market.fractionalCoinType(),
			lpCoinType: market.lpCoinType(),
			poolId: market.pool.pool.objectId,
			withTransfer: false,
		});

		const kioskOwnerCapIds =
			this.Provider.FractionalNfts().withdrawAfEggsTx({
				...inputs,
				tx,
				fractionalCoinId,
				fractionalCoinType: market.fractionalCoinType(),
				nftType: market.nftType(),
			});
		tx.transferObjects(kioskOwnerCapIds, tx.pure(inputs.walletAddress));

		return tx;
	};

	public fetchBuildSellAfEggsTx = async (inputs: {
		market?: AfEggNftAmmMarket;
		walletAddress: SuiAddress;
		nftIds: ObjectId[];
		kioskIds: ObjectId[];
		kioskOwnerCapIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { slippage, referrer, nftIds, kioskIds, kioskOwnerCapIds } =
			inputs;

		const market =
			inputs.market ??
			new AfEggNftAmmMarket(await this.fetchAfEggMarket());

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// fractionalize eggs
		const fractionalCoinId = this.Provider.FractionalNfts().depositAfEggsTx(
			{
				...inputs,
				tx,
				nftType: market.nftType(),
				fractionalCoinType: market.fractionalCoinType(),
			}
		);

		// swap fCoin -> afSUI
		const expectedAfSuiAmountOut = market.getSellAfSuiAmountOut({
			nftsCount: nftIds.length,
			referral: inputs.referrer !== undefined,
		});
		this.Provider.Pools().tradeTx({
			tx,
			slippage,
			expectedCoinOutAmount: expectedAfSuiAmountOut,
			coinInId: fractionalCoinId,
			coinInType: market.fractionalCoinType(),
			coinOutType: market.afSuiCoinType(),
			lpCoinType: market.lpCoinType(),
			poolId: market.pool.pool.objectId,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildDepositAfEggsTx = async (inputs: {
		market: AfEggNftAmmMarket;
		walletAddress: SuiAddress;
		nftIds: ObjectId[];
		kioskIds: ObjectId[];
		kioskOwnerCapIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { referrer, slippage } = inputs;

		const market =
			inputs.market ??
			new AfEggNftAmmMarket(await this.fetchAfEggMarket());

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// fractionalize eggs
		const fractionalCoinId = this.Provider.FractionalNfts().depositAfEggsTx(
			{
				...inputs,
				tx,
				nftType: market.nftType(),
				fractionalCoinType: market.fractionalCoinType(),
			}
		);

		// deposit fractional coin
		const { lpRatio } = market.getDepositNftsLpAmountOut({
			nftsCount: inputs.nftIds.length,
			referral: inputs.referrer !== undefined,
		});
		// TODO: move this somewhere else and into its own func
		const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);
		this.Provider.Pools().multiCoinDepositTx({
			tx,
			expectedLpRatio,
			slippage,
			coinIds: [fractionalCoinId],
			coinTypes: [market.fractionalCoinType()],
			poolId: market.pool.pool.objectId,
			lpCoinType: market.lpCoinType(),
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildWithdrawAfEggsTx = async (inputs: {
		market: AfEggNftAmmMarket;
		walletAddress: SuiAddress;
		lpCoinAmount: Balance;
		nftIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { referrer } = inputs;

		const market =
			inputs.market ??
			new AfEggNftAmmMarket(await this.fetchAfEggMarket());

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// get lp coin with amount
		const lpCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: market.lpCoinType(),
			coinAmount: inputs.lpCoinAmount,
		});

		// withdraw fractional coin
		const fractionalCoinAmountOut =
			market.getWithdrawFractionalCoinAmountOut({
				lpCoinAmountOut: inputs.lpCoinAmount,
				referral: inputs.referrer !== undefined,
			});
		const [fractionalCoinId] = this.Provider.Pools().multiCoinWithdrawTx({
			...inputs,
			tx,
			lpCoinId,
			coinTypes: [market.fractionalCoinType()],
			expectedAmountsOut: [fractionalCoinAmountOut],
			lpCoinType: market.lpCoinType(),
			poolId: market.pool.pool.objectId,
			withTransfer: false,
		});

		// convert fractional coin to eggs
		const kioskOwnerCapIds =
			this.Provider.FractionalNfts().withdrawAfEggsTx({
				...inputs,
				tx,
				fractionalCoinId,
				nftType: market.nftType(),
				fractionalCoinType: market.fractionalCoinType(),
			});
		tx.transferObjects(kioskOwnerCapIds, tx.pure(inputs.walletAddress));

		return tx;
	};

	// public fetchBuildBuyTx = async (inputs: {
	// 	market: AfEggNftAmmMarket;
	// 	walletAddress: SuiAddress;
	// 	nftIds: ObjectId[];
	// 	slippage: Slippage;
	// 	referrer?: SuiAddress;
	// }): Promise<TransactionBlock> => {
	// 	const tx = new TransactionBlock();
	// 	tx.setSender(inputs.walletAddress);

	// 	const { market } = inputs;
	// 	const marketObject = market.market;

	// 	const expectedAfSuiAmount = market.getBuyAfSuiAmountIn({
	// 		nftsCount: inputs.nftIds.length,
	// 		referral: inputs.referrer !== undefined,
	// 	});

	// 	const afSuiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
	// 		tx,
	// 		walletAddress: inputs.walletAddress,
	// 		coinType: market.afSuiCoinType(),
	// 		coinAmount: expectedAfSuiAmount,
	// 	});

	// 	this.buyTx({
	// 		tx,
	// 		...inputs,
	// 		marketObjectId: marketObject.objectId,
	// 		genericTypes: NftAmmApi.genericTypesForMarket({ market }),
	// 		afSuiCoin,
	// 		expectedAfSuiAmount,
	// 		withTransfer: true,
	// 	});

	// 	return tx;
	// };

	// public fetchBuildSellTx = async (inputs: {
	// 	market: AfEggNftAmmMarket;
	// 	walletAddress: SuiAddress;
	// 	nftIds: ObjectId[];
	// 	slippage: Slippage;
	// 	referrer?: SuiAddress;
	// }): Promise<TransactionBlock> => {
	// 	const tx = new TransactionBlock();
	// 	tx.setSender(inputs.walletAddress);

	// 	const { market } = inputs;
	// 	const marketObject = market.market;

	// 	const expectedAfSuiAmountOut = market.getSellAfSuiAmountOut({
	// 		nftsCount: inputs.nftIds.length,
	// 		referral: inputs.referrer !== undefined,
	// 	});

	// 	this.sellTx({
	// 		...inputs,
	// 		tx,
	// 		nfts: inputs.nftIds,
	// 		marketObjectId: marketObject.objectId,
	// 		genericTypes: NftAmmApi.genericTypesForMarket({ market }),
	// 		expectedAfSuiAmountOut,
	// 		withTransfer: true,
	// 	});

	// 	return tx;
	// };

	// public fetchBuildDepositTx = async (inputs: {
	// 	market: AfEggNftAmmMarket;
	// 	walletAddress: SuiAddress;
	// 	afSuiAmount: Balance;
	// 	nfts: (ObjectId | TransactionArgument)[];
	// 	slippage: Slippage;
	// 	referrer?: SuiAddress;
	// }): Promise<TransactionBlock> => {
	// 	const tx = new TransactionBlock();
	// 	tx.setSender(inputs.walletAddress);

	// 	const { market } = inputs;
	// 	const marketObject = market.market;

	// 	const { lpRatio } = market.getDepositLpCoinAmountOut({
	// 		afSuiAmount: inputs.afSuiAmount,
	// 		referral: inputs.referrer !== undefined,
	// 	});

	// 	// // TODO: move this somewhere else and into its own func
	// 	const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

	// 	const afSuiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
	// 		tx,
	// 		walletAddress: inputs.walletAddress,
	// 		coinType: market.afSuiCoinType(),
	// 		coinAmount: inputs.afSuiAmount,
	// 	});

	// 	this.depositTx({
	// 		tx,
	// 		...inputs,
	// 		marketObjectId: marketObject.objectId,
	// 		genericTypes: NftAmmApi.genericTypesForMarket({ market }),
	// 		expectedLpRatio,
	// 		afSuiCoin,
	// 		withTransfer: true,
	// 	});

	// 	return tx;
	// };

	// public fetchBuildWithdrawTx = async (inputs: {
	// 	market: AfEggNftAmmMarket;
	// 	walletAddress: SuiAddress;
	// 	lpCoinAmount: Balance;
	// 	nftIds: ObjectId[];
	// 	slippage: Slippage;
	// 	referrer?: SuiAddress;
	// }): Promise<TransactionBlock> => {
	// 	const tx = new TransactionBlock();
	// 	tx.setSender(inputs.walletAddress);

	// 	const { market } = inputs;
	// 	const marketObject = market.market;

	// 	const fractionalizedCoinAmountOut =
	// 		market.getWithdrawFractionalizedCoinAmountOut({
	// 			lpCoinAmount: inputs.lpCoinAmount,
	// 			referral: inputs.referrer !== undefined,
	// 		});

	// 	const { balances: coinAmountsOut } = Coin.coinsAndBalancesOverZero({
	// 		[market.fractionalCoinType()]: fractionalizedCoinAmountOut,
	// 	});
	// 	const expectedAfSuiAmountOut = coinAmountsOut[0];

	// 	const lpCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
	// 		tx,
	// 		walletAddress: inputs.walletAddress,
	// 		coinType: marketObject.lpCoinType,
	// 		coinAmount: inputs.lpCoinAmount,
	// 	});

	// 	this.Provider.Pools().this.addWithdrawCommandToTransaction({
	// 		tx,
	// 		...inputs,
	// 		marketObjectId: marketObject.objectId,
	// 		genericTypes: NftAmmApi.genericTypesForMarket({ market }),
	// 		expectedAfSuiAmountOut,
	// 		lpCoin,
	// 		withTransfer: true,
	// 	});

	// 	return tx;
	// };
}
