import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterCompleteTradeRoute,
	Slippage,
	RouterProtocolName,
	PoolsAddresses,
	CoinsToBalance,
	CoinType,
} from "../../../types";
import {
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { KriyaApi } from "../../external/kriya/kriyaApi";
import {
	ManagementProtocolName,
	ManagementWithdrawLpInfo,
} from "../managementTypes";
import { ManagementApiWithdrawInterface } from "./utils/interfaces/managementApiWithdrawInterface";
import { Pool } from "../..";
import { Casting } from "../../../general/utils";

export class ManagementApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private readonly protocolNamesToApi: Record<
		ManagementProtocolName,
		() => ManagementApiWithdrawInterface<any>
	> = {
		Kriya: () => new KriyaApi(this.Provider),
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		pools: PoolsAddresses;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		private readonly Provider: AftermathApi,
		public readonly protocols: RouterProtocolName[]
	) {
		const pools = Provider.addresses.pools;

		if (!pools)
			throw new Error(
				// TODO: make this error message a const somewhere
				// or make this api constructor pattern into helper func
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			pools,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async fetchTransferLpsTx(inputs: {
		lpInfos: ManagementWithdrawLpInfo[];
		pools: Pool[];
		walletAddress: SuiAddress;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> {
		const { lpInfos, pools, slippage, referrer } = inputs;

		// initialize tx
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		// set/update referrer
		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// withdraw coins for each lp
		for (const [index, lpInfo] of lpInfos.entries()) {
			const pool = pools[index];

			// get api class for lp
			const protocolApi = this.protocolNamesToApi[lpInfo.protocol]();

			// withdraw coins, burn lp
			const withdrawnCoins = protocolApi.withdrawTx({
				tx,
				lpInfo,
			});

			// set deposit tx inputs
			let coinTypes: CoinType[] = [];
			let coinIds: TransactionArgument[] = [];
			for (const [coinIndex, coinArg] of withdrawnCoins.entries()) {
				const coinType = lpInfo.withdrawCoinTypes[coinIndex];

				if (!(coinType in pool.pool.coins)) {
					tx.transferObjects(
						[coinArg],
						tx.pure(inputs.walletAddress)
					);
					continue;
				}

				coinTypes.push(coinType);
				coinIds.push(coinArg);
			}

			// calc deposit estimations
			const { lpRatio } = pool.getDepositLpAmountOut({
				amountsIn,
				referral: referrer !== undefined,
			});
			const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

			// deposit withdrawn coins
			this.Provider.Pools().multiCoinDepositTx({
				tx,
				poolId: pool.pool.objectId,
				lpCoinType: pool.pool.lpCoinType,
				coinIds,
				coinTypes,
				expectedLpRatio,
				slippage,
				withTransfer: true,
			});
		}

		return tx;
	}

	// public async fetchTransferLpsTx(inputs: {
	// 	lpInfos: ManagementWithdrawLpInfo[];
	// 	pool: Pool;
	// 	walletAddress: SuiAddress;
	// 	slippage: Slippage;
	// 	referrer?: SuiAddress;
	// }): Promise<TransactionBlock> {
	// 	const { lpInfos, pool, slippage, referrer } = inputs;

	// 	// initialize tx
	// 	const tx = new TransactionBlock();
	// 	tx.setSender(inputs.walletAddress);

	// 	// set/update referrer
	// 	if (referrer)
	// 		this.Provider.ReferralVault().updateReferrerTx({
	// 			tx,
	// 			referrer,
	// 		});

	// 	// withdraw coins for each lp
	// 	let allWithdrawnCoins: Record<CoinType, TransactionArgument[]> = {};
	// 	for (const lpInfo of lpInfos) {
	// 		// get api class for lp
	// 		const protocolApi = this.protocolNamesToApi[lpInfo.protocol]();

	// 		// withdraw coins, burn lp
	// 		const withdrawnCoins = protocolApi.withdrawTx({
	// 			tx,
	// 			lpInfo,
	// 		});

	// 		// add withdrawn coin args to object
	// 		for (const [index, coinArg] of withdrawnCoins.entries()) {
	// 			const coinType = lpInfo.withdrawCoinTypes[index];

	// 			if (coinType in allWithdrawnCoins) {
	// 				allWithdrawnCoins[coinType].push(coinArg);
	// 				continue;
	// 			}

	// 			allWithdrawnCoins[coinType] = [coinArg];
	// 		}
	// 	}

	// 	// initialize empty deposit tx inputs
	// 	let amountsIn: CoinsToBalance = {};
	// 	let coinIds: TransactionArgument[] = [];
	// 	let coinTypes: CoinType[] = [];

	// 	// set deposit tx inputs
	// 	for (const [coinType, coinArgs] of Object.entries(allWithdrawnCoins)) {
	// 		// merge coins if needed
	// 		const coinId = coinArgs[0];
	// 		if (coinArgs.length > 1)
	// 			tx.mergeCoins(coinArgs[0], coinArgs.slice(1));

	// 		// add coin arg or transfer if not in pool
	// 		if (!(coinType in pool.pool.coins)) {
	// 			tx.transferObjects([coinId], tx.pure(inputs.walletAddress));
	// 			continue;
	// 		}
	// 		coinIds.push(coinId);

	// 		// add coin type
	// 		coinTypes.push(coinType);

	// 		// add amount
	// 		// TODO: handle estimation
	// 	}

	// 	// calc deposit estimations
	// 	const { lpRatio } = pool.getDepositLpAmountOut({
	// 		amountsIn,
	// 		referral: referrer !== undefined,
	// 	});
	// 	const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

	// 	// deposit withdrawn coins
	// 	this.Provider.Pools().multiCoinDepositTx({
	// 		tx,
	// 		poolId: pool.pool.objectId,
	// 		lpCoinType: pool.pool.lpCoinType,
	// 		coinIds,
	// 		coinTypes,
	// 		expectedLpRatio,
	// 		slippage,
	// 		withTransfer: true,
	// 	});

	// 	return tx;
	// }
}
