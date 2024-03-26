import { AftermathApi } from "../../../general/providers/aftermathApi";
import { NftAmmMarketData } from "../nftAmmTypes";
import { NftAmmApiCasting } from "./nftAmmApiCasting";
import { NftAmmMarket } from "../nftAmmMarket";
import {
	AfNftAddresses,
	Balance,
	CoinType,
	DynamicFieldObjectsWithCursor,
	FractionalNftsAddresses,
	Nft,
	NftAmmAddresses,
	ObjectId,
	PoolsAddresses,
	Slippage,
	SuiAddress,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../../coin/coin";
import { Pools } from "../../pools/pools";
import {
	TransactionArgument,
	TransactionBlock,
	TransactionArgument,
} from "@mysten/sui.js/transactions";

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

	public fetchNftsInMarketTable = async (inputs: {
		marketTableObjectId: ObjectId;
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<Nft>> => {
		return await this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				...inputs,
				parentObjectId: inputs.marketTableObjectId,
				objectsFromObjectIds: (objectIds) =>
					this.Provider.Nfts().fetchNfts({ objectIds }),
			}
		);
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
		market?: NftAmmMarket;
		walletAddress: SuiAddress;
		nftIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { slippage, referrer, nftIds } = inputs;

		const market =
			inputs.market ?? new NftAmmMarket(await this.fetchAfEggMarket());

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
		// convert fCoin -> (nfts + transferRequests)
		const [nfts, transferRequests] =
			this.Provider.FractionalNfts().withdrawFromKioskStorageTx({
				tx,
				nftIds,
				fractionalCoinId,
				nftType: market.nftType(),
				fractionalCoinType: market.fractionalCoinType(),
				nftVaultId: market.market.vault.objectId,
			});

		for (const [index, nftId] of nfts.entries()) {
			// create new kiosk to store nfts
			const [kioskId, kioskOwnerCapId] = this.Provider.Nfts().kioskNewTx({
				tx,
			});
			// lock nft in user's kiosk
			this.Provider.Nfts().kioskLockTx({
				tx,
				kioskId,
				kioskOwnerCapId,
				nftId,
				nftType: market.nftType(),
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});
			// pay royalty (using zero coin)
			const zeroSuiCoinId = this.Provider.Coin().zeroTx({
				tx,
				coinType: Coin.constants.suiCoinType,
			});
			this.Provider.AfNft().payRoyaltyRuleTx({
				tx,
				suiCoinId: zeroSuiCoinId,
				nftType: market.nftType(),
				transferRequestId: transferRequests[index],
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});
			// prove nft is in a kiosk (user's)
			this.Provider.AfNft().proveRuleTx({
				tx,
				kioskId,
				nftType: market.nftType(),
				transferRequestId: transferRequests[index],
			});
			// complete transfer
			this.Provider.Nfts().kioskConfirmRequestTx({
				tx,
				nftType: market.nftType(),
				transferRequestId: transferRequests[index],
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});
		}

		return tx;
	};

	public fetchBuildSellAfEggsTx = async (inputs: {
		market?: NftAmmMarket;
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
			inputs.market ?? new NftAmmMarket(await this.fetchAfEggMarket());

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		let nftArgs: TransactionArgument[] = [];
		let transferRequestArgs: TransactionArgument[] = [];
		for (const [index, nftId] of nftIds.entries()) {
			const kioskId = kioskIds[index];

			const purchaseCapId =
				this.Provider.Nfts().kioskListWithPurchaseCapTx({
					tx,
					nftId,
					kioskId,
					nftType: market.nftType(),
					kioskOwnerCapId: kioskOwnerCapIds[index],
					minPrice: BigInt(0),
				});

			const zeroSuiCoinId = this.Provider.Coin().zeroTx({
				tx,
				coinType: Coin.constants.suiCoinType,
			});
			const [nft, transferRequest] =
				this.Provider.Nfts().kioskPurchaseWithCapTx({
					tx,
					kioskId,
					purchaseCapId,
					nftType: market.nftType(),
					coinId: zeroSuiCoinId,
				});

			nftArgs.push(nft);
			transferRequestArgs.push(transferRequest);
		}

		// convert fCoin -> (nfts + transferRequests)
		const fractionalCoinId =
			this.Provider.FractionalNfts().depositIntoKioskStorageTx({
				tx,
				nftIds: nftArgs,
				withTransfer: false,
				nftType: market.nftType(),
				fractionalCoinType: market.fractionalCoinType(),
				nftVaultId: market.market.vault.objectId,
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});

		for (const [
			index,
			transferRequestId,
		] of transferRequestArgs.entries()) {
			// pay royalty (using zero coin)
			const zeroSuiCoinId = this.Provider.Coin().zeroTx({
				tx,
				coinType: Coin.constants.suiCoinType,
			});
			this.Provider.AfNft().payRoyaltyRuleTx({
				tx,
				transferRequestId,
				suiCoinId: zeroSuiCoinId,
				nftType: market.nftType(),
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});
			// prove nft is in a kiosk (user's)
			this.Provider.AfNft().proveRuleTx({
				tx,
				kioskId: TODO,
				transferRequestId,
				nftType: market.nftType(),
			});
			// complete transfer
			this.Provider.Nfts().kioskConfirmRequestTx({
				tx,
				transferRequestId,
				nftType: market.nftType(),
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});
		}

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
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		afSuiAmount: Balance;
		nfts: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const { lpRatio } = market.getDepositLpCoinAmountOut({
			afSuiAmount: inputs.afSuiAmount,
			referral: inputs.referrer !== undefined,
		});

		// // TODO: move this somewhere else and into its own func
		const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

		const afSuiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: market.afSuiCoinType(),
			coinAmount: inputs.afSuiAmount,
		});

		this.depositTx({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedLpRatio,
			afSuiCoin,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildWithdrawAfEggsTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		lpCoinAmount: Balance;
		nftIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const fractionalizedCoinAmountOut =
			market.getWithdrawFractionalizedCoinAmountOut({
				lpCoinAmount: inputs.lpCoinAmount,
				referral: inputs.referrer !== undefined,
			});

		const { balances: coinAmountsOut } = Coin.coinsAndBalancesOverZero({
			[market.fractionalCoinType()]: fractionalizedCoinAmountOut,
		});
		const expectedAfSuiAmountOut = coinAmountsOut[0];

		const lpCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: marketObject.lpCoinType,
			coinAmount: inputs.lpCoinAmount,
		});

		this.Provider.Pools().this.addWithdrawCommandToTransaction({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedAfSuiAmountOut,
			lpCoin,
			withTransfer: true,
		});

		return tx;
	};

	// public fetchBuildBuyTx = async (inputs: {
	// 	market: NftAmmMarket;
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
	// 	market: NftAmmMarket;
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
	// 	market: NftAmmMarket;
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
	// 	market: NftAmmMarket;
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
