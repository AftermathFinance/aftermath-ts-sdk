import { Connection, JsonRpcProvider, ObjectId, RawSigner, SuiObjectChange, SuiObjectChangeCreated, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../src/general/providers";
import {
	ASK,
	BID,
	adminPrivateKey,
	user1PrivateKey,
	user2PrivateKey,
	user3PrivateKey,
	user4PrivateKey,
	LOT_SIZE,
	TICK_SIZE,
	MARKET_ID0,
	ONE_F18,
	fromOraclePriceToOrderbookPrice,
	getSigner,
	ONE_B9,
} from "./utils";

import { getConfigs } from "./testConfig";
import { orderId } from "../src/packages/perpetuals/utils/critBitTreeUtils";

// =========================================================================
// TEST CASE FLOW
// =========================================================================
describe("Perpetuals Tests", () => {
	// test("Deserialize Account", async () => {
	// 	const connection = new Connection({
	// 		fullnode: "http://127.0.0.1:9000",
	// 	});
	// 	const provider = new JsonRpcProvider(connection);
	// 	const [perpetualsConfig, faucetConfig, oracleConfig] = getConfigs();
	// 	const aftermathApi = new AftermathApi(provider, {
	// 		perpetuals: perpetualsConfig,
	// 		faucet: faucetConfig,
	// 		oracle: oracleConfig,
	// 	});

	// 	const usdcType = faucetConfig.packages.faucet + "::usdc::USDC";
	// 	let account = await aftermathApi.Perpetuals().fetchAccount(
	// 		usdcType,
	// 		BigInt(2),
	// 	);
	// 	console.log(account);

	// 	const [asks, bids] = await aftermathApi.Perpetuals().fetchPositionOrderIds(
	// 		usdcType,
	// 		BigInt(2),
	// 		MARKET_ID0,
	// 	);
	// 	console.log(asks, bids);
	// }, 5000000);

	test("All entry functions", async () => {
		const connection = new Connection({
			fullnode: "http://127.0.0.1:9000",
		});
		const provider = new JsonRpcProvider(connection);
		const [perpetualsConfig, faucetConfig, oracleConfig] = getConfigs();
		const aftermathApi = new AftermathApi(provider, {
			perpetuals: perpetualsConfig,
			faucet: faucetConfig,
			oracle: oracleConfig,
		});

		const usdcType = faucetConfig.packages.faucet + "::usdc::USDC";
		const initialOraclePrice = BigInt(10000) * ONE_F18;
		const initialOrderbookPrice = fromOraclePriceToOrderbookPrice(
			initialOraclePrice,
			LOT_SIZE,
			TICK_SIZE
		);
		const finalOraclePrice = BigInt(9400) * ONE_F18;
		const finalOrderbookPrice = fromOraclePriceToOrderbookPrice(
			finalOraclePrice,
			LOT_SIZE,
			TICK_SIZE
		);

		// Create package provider
		let admin = getSigner(adminPrivateKey, aftermathApi);
		let user1 = getSigner(user1PrivateKey, aftermathApi);
		let user2 = getSigner(user2PrivateKey, aftermathApi);
		let user3 = getSigner(user3PrivateKey, aftermathApi);
		let user4 = getSigner(user4PrivateKey, aftermathApi);

		let tx: TransactionBlock;
		const requestType = "WaitForLocalExecution";

		// Publish + initialization for USDC has been done with rust-sdk
		// Create perpetuals main objects
		// let tx = await aftermathApi
		// 	.Perpetuals()
		// 	.fetchInitializeForCollateralTx({
		// 		walletAddress: await admin.getAddress(),
		// 		coinType: usdcType,
		// 	});
		// await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("AccountManager");
		console.log(await aftermathApi.Perpetuals().fetchAccountManager(usdcType));

		console.log("MarketManager");
		console.log(await aftermathApi.Perpetuals().fetchMarketManager(usdcType));

		// Transfer and transfer back admin_capability
		console.log("Transfer admin cap");
		tx = await aftermathApi
			.Perpetuals()
			.fetchTransferAdminCapTx({
				walletAddress: await admin.getAddress(),
				targetAddress: await user1.getAddress(),
			});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Perpetuals().fetchTransferAdminCapTx({
			walletAddress: await user1.getAddress(),
			targetAddress: await admin.getAddress(),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// Create price feed for "BTC" perpetual (BTC/USD oracle price feed)
		console.log("Create BTC price feed");
		tx = await aftermathApi.Oracle().fetchDevCreatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// Update price for "BTC" to 10000$ in fixed representation
		console.log("Update BTC price feed");
		tx = await aftermathApi.Oracle().fetchDevUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			price: initialOraclePrice,
			timestamp: 0,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// Add insurance fund
		console.log("Add insurance fund");
		tx = await aftermathApi.Perpetuals().fetchAddInsuranceFundTx({
			walletAddress: await admin.getAddress(),
			coinType: usdcType,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		//Create perpetuals market for BTC/USD with USDC as collateral
		console.log("Create market");
		tx = await aftermathApi.Perpetuals().fetchCreateMarketTx({
			walletAddress: await admin.getAddress(),
			coinType: usdcType,
			marketId: MARKET_ID0,
			marginRatioInitial: BigInt(100000000000000000),
			marginRatioMaintenance: BigInt(50000000000000000),
			baseAssetSymbol: "BTC",
			fundingFrequencyMs: BigInt(3600000),
			fundingPeriodMs: BigInt(86400000),
			twapPeriodMs: BigInt(60000),
			makerFee: BigInt(0),
			takerFee: BigInt(0),
			liquidationFee: BigInt(0),
			forceCancelFee: BigInt(0),
			insuranceFundFee: BigInt(0),
			insuranceFundId: BigInt(0),
			lotSize: LOT_SIZE,
			tickSize: TICK_SIZE,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Update funding");
		tx = await aftermathApi
			.Perpetuals()
			.fetchUpdateFundingTx({
				walletAddress: await admin.getAddress(),
				coinType: usdcType,
				marketId: MARKET_ID0,
			});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// All users gets 10000 USDC
		let tenThousandB9 = BigInt(10000) * ONE_B9;
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// All users create an account
		let user1AccountCap = await createAndFetchAccountCap(user1, aftermathApi, usdcType);
		let user2AccountCap = await createAndFetchAccountCap(user2, aftermathApi, usdcType);
		let user3AccountCap = await createAndFetchAccountCap(user3, aftermathApi, usdcType);
		let user4AccountCap = await createAndFetchAccountCap(user4, aftermathApi, usdcType);

		// All users deposit 10000 USDC
		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			coinAmount: tenThousandB9,
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			coinAmount: tenThousandB9,
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			coinAmount: tenThousandB9,
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			coinAmount: tenThousandB9,
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// User1 places limit ask for 1 BTC at price 10000
		// User1 cancels limit ask
		// User1 places limit bid for 10 BTC at price 10000
		// User2 places market ask for 10 BTC at price 10000
		// User3 places limit orders for 1 BTC lot around price 9400
		// Admin sets index price BTC/USDC=9400$
		// User4 liquidates 5862 lots of alice's BTC position
		// User3 cancels all pending orders
		console.log("Place order to cancel");
		tx = await aftermathApi.Perpetuals().fetchPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(1),
			price: initialOrderbookPrice,
			orderType: BigInt(0),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Cancel single order");
		tx = await aftermathApi.Perpetuals().fetchCancelOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			orderId: orderId(initialOrderbookPrice, BigInt(0), ASK),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Place actual order");
		let orderSize = BigInt(10000);
		tx = await aftermathApi.Perpetuals().fetchPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: orderSize,
			price: initialOrderbookPrice,
			orderType: BigInt(0),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Place market order");
		tx = await aftermathApi.Perpetuals().fetchPlaceMarketOrderTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: orderSize,
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Place limit orders for book price");
		tx = await aftermathApi.Perpetuals().fetchPlaceLimitOrderTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: BigInt(1),
			price: finalOrderbookPrice - BigInt(1),
			orderType: BigInt(0),
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });
		tx = await aftermathApi.Perpetuals().fetchPlaceLimitOrderTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(1),
			price: finalOrderbookPrice + BigInt(1),
			orderType: BigInt(0),
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Update oracle price");
		tx = await aftermathApi.Oracle().fetchDevUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			price: finalOraclePrice,
			timestamp: 0,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// `sizes` computed with `compute_size_to_liquidate_isolated` in
		// `perpetuals/scripts/liquidation.py`
		console.log("Liquidate");
		tx = await aftermathApi.Perpetuals().fetchLiquidateTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			liqeeAccountId: BigInt(0), // user1 account id
			sizes: [BigInt(5745)],
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Cancel book price orders");
		let [user3Asks, user3Bids] = await aftermathApi
			.Perpetuals()
			.fetchPositionOrderIds(usdcType, BigInt(2), MARKET_ID0);
		for (const orderId of user3Asks) {
			tx = await aftermathApi.Perpetuals().fetchCancelOrderTx({
				walletAddress: await user3.getAddress(),
				coinType: usdcType,
				accountCapId: user3AccountCap,
				marketId: MARKET_ID0,
				side: ASK,
				orderId,
			});
			await user3.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });
		}
		for (const orderId of user3Bids) {
			tx = await aftermathApi.Perpetuals().fetchCancelOrderTx({
				walletAddress: await user3.getAddress(),
				coinType: usdcType,
				accountCapId: user3AccountCap,
				marketId: MARKET_ID0,
				side: BID,
				orderId,
			});
			await user3.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });
		}

		// User4 places limit bid for 4255 BTC lots at price 9400
		// User1 closes his position by market-buying user4's bid
		// User2 places limit ask for 10 BTC at price 9400
		// User4 closes his position (matched against user2, closing the circle)
		console.log("Place limit order");
		tx = await aftermathApi.Perpetuals().fetchPlaceLimitOrderTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: BigInt(4255),
			price: finalOrderbookPrice,
			orderType: BigInt(0),
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Place market order");
		tx = await aftermathApi.Perpetuals().fetchPlaceMarketOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(4255),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Place limit order");
		tx = await aftermathApi.Perpetuals().fetchPlaceLimitOrderTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: orderSize,
			price: finalOrderbookPrice,
			orderType: BigInt(0),
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		console.log("Place market order");
		tx = await aftermathApi.Perpetuals().fetchPlaceMarketOrderTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: orderSize,
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		// User1 withdraw collateral 2000 USDC
		// User2 withdraw collateral 2000 USDC
		// User3 withdraw collateral 10000 USDC
		// User4 withdraw collateral 2000 USDC

		console.log("Withdraw collaterals");
		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			amount: BigInt(2000_000000000),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			amount: BigInt(2000_000000000),
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			amount: tenThousandB9,
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });

		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			amount: BigInt(2000_000000000),
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx, requestType });
	}, 50000000);
});

async function createAndFetchAccountCap(
	signer: RawSigner,
	aftermathApi: AftermathApi,
	coinType: string
): Promise<ObjectId> {
	let tx = await aftermathApi.Perpetuals().fetchCreateAccountTx({
		walletAddress: await signer.getAddress(),
		coinType,
	});
	let response = await signer.signAndExecuteTransactionBlock({
		transactionBlock: tx, requestType: "WaitForLocalExecution",
		options: { showObjectChanges: true },
	});
	let change = response.objectChanges?.find(isAccountCapCreated) as SuiObjectChangeCreated;
	return change.objectId;
}

function isAccountCapCreated(change: SuiObjectChange): boolean {
	return change.type === "created" && change.objectType.includes("AccountCap");
}
