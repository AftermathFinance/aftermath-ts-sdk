import {
	Connection,
	getObjectFields,
	JsonRpcProvider,
	ObjectId,
	RawSigner,
	SuiObjectChange,
	SuiObjectChangeCreated,
	TransactionBlock,
} from "@mysten/sui.js";
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
	BRANCH_MIN,
	BRANCH_MAX,
	LEAF_MIN,
	LEAF_MAX,
	BRANCHES_MERGE_MAX,
	LEAVES_MERGE_MAX,
	MARKET_ID0,
	ONE_F18,
	fromOraclePriceToOrderbookPrice,
	getSigner,
	ONE_B9,
	createAndFetchAccountCap,
} from "./utils";

import { getConfigs } from "./testConfig";
import {
	Perpetuals,
	PerpetualsAccount,
	PerpetualsMarket,
	Sui,
} from "../src/packages";
import { IFixedUtils } from "../src/general/utils/iFixedUtils";
import { PerpetualsOrderUtils } from "../src/packages/perpetuals/utils";

describe("Perpetuals Tests", () => {
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
		// tx = await aftermathApi.Perpetuals().fetchInitializeForCollateralTx({
		// 	walletAddress: await admin.getAddress(),
		// 	coinType: usdcType,
		// });
		// await admin.signAndExecuteTransactionBlock({
		// 	transactionBlock: tx,
		// 	requestType,
		// });

		console.log("AccountManager");
		console.log(
			await aftermathApi
				.Perpetuals()
				.fetchAccountManager({ coinType: usdcType })
		);

		console.log("MarketManager");
		console.log(
			await aftermathApi
				.Perpetuals()
				.fetchMarketManager({ coinType: usdcType })
		);

		let onchainTime = getObjectFields(
			await aftermathApi
				.Objects()
				.fetchObject({ objectId: Sui.constants.addresses.suiClockId })
		)?.timestamp_ms;
		console.log(`Time onchain vs TS:\n${onchainTime}, ${Date.now()}`);

		// Transfer and transfer back admin_capability
		console.log("Transfer admin cap");
		tx = await aftermathApi.Perpetuals().buildTransferAdminCapTx({
			walletAddress: await admin.getAddress(),
			targetAddress: await user1.getAddress(),
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		tx = await aftermathApi.Perpetuals().buildTransferAdminCapTx({
			walletAddress: await user1.getAddress(),
			targetAddress: await admin.getAddress(),
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// Create price feed for "BTC" perpetual (BTC/USD oracle price feed)
		console.log("Create BTC price feed");
		tx = await aftermathApi.Oracle().buildDevCreatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// Update price for "BTC" to 10000$ in fixed representation
		console.log("Update BTC price feed");
		tx = await aftermathApi.Oracle().buildDevUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			price: initialOraclePrice,
			timestamp: 0,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// Add insurance fund
		console.log("Add insurance fund");
		tx = await aftermathApi.Perpetuals().buildAddInsuranceFundTx({
			walletAddress: await admin.getAddress(),
			coinType: usdcType,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		//Create perpetuals market for BTC/USD with USDC as collateral
		console.log("Create market");
		tx = await aftermathApi.Perpetuals().buildCreateMarketTx({
			walletAddress: await admin.getAddress(),
			coinType: usdcType,
			marketId: MARKET_ID0,
			marginRatioInitial: BigInt(100000000000000000),
			marginRatioMaintenance: BigInt(50000000000000000),
			baseAssetSymbol: "BTC",
			fundingFrequencyMs: BigInt(60000), // 1 min
			fundingPeriodMs: BigInt(86400000),
			premiumTwapFrequencyMs: BigInt(5000),
			premiumTwapPeriodMs: BigInt(60000),
			spreadTwapFrequencyMs: BigInt(5000),
			spreadTwapPeriodMs: BigInt(60000),
			makerFee: BigInt(0),
			takerFee: BigInt(0),
			liquidationFee: BigInt(0),
			forceCancelFee: BigInt(0),
			insuranceFundFee: BigInt(0),
			insuranceFundId: BigInt(0),
			lotSize: LOT_SIZE,
			tickSize: TICK_SIZE,
			branchMin: BRANCH_MIN,
			branchMax: BRANCH_MAX,
			leafMin: LEAF_MIN,
			leafMax: LEAF_MAX,
			branchesMergeMax: BRANCHES_MERGE_MAX,
			leavesMergeMax: LEAVES_MERGE_MAX,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log(
			await aftermathApi
				.Perpetuals()
				.fetchMarketState({ coinType: usdcType, marketId: MARKET_ID0 })
		);

		console.log(
			await aftermathApi
				.Perpetuals()
				.fetchMarketParams({ coinType: usdcType, marketId: MARKET_ID0 })
		);

		// All users gets 10000 USDC
		console.log("Mint USDC for User1");
		let tenThousandB9 = BigInt(10000) * ONE_B9;
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Mint USDC for User2");
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Mint USDC for User3");
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user3.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Mint USDC for User4");
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user4.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// All users create an account
		console.log("Create Account for User1");
		let user1AccountCap = await createAndFetchAccountCap(
			user1,
			aftermathApi,
			usdcType
		);

		console.log("Create Account for User2");
		let user2AccountCap = await createAndFetchAccountCap(
			user2,
			aftermathApi,
			usdcType
		);

		console.log("Create Account for User3");
		let user3AccountCap = await createAndFetchAccountCap(
			user3,
			aftermathApi,
			usdcType
		);

		console.log("Create Account for User4");
		let user4AccountCap = await createAndFetchAccountCap(
			user4,
			aftermathApi,
			usdcType
		);

		// All users deposit 10000 USDC
		console.log("Deposit USDC for User1");
		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			amount: tenThousandB9,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Deposit USDC for User2");
		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			amount: tenThousandB9,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Deposit USDC for User3");
		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			amount: tenThousandB9,
		});
		await user3.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Deposit USDC for User4");
		tx = await aftermathApi.Perpetuals().fetchDepositCollateralTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			amount: tenThousandB9,
		});
		await user4.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// User1 places limit ask for 1 BTC at price 10000
		// User1 cancels limit ask
		// User1 places limit bid for 10 BTC at price 10000
		// User2 places market ask for 10 BTC at price 10000
		// User3 places limit orders for 1 BTC lot around price 9400
		// Admin sets index price BTC/USDC=9400$
		// User4 liquidates 5862 lots of alice's BTC position
		// User3 cancels all pending orders
		console.log("Place order to cancel");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(1),
			price: initialOrderbookPrice,
			orderType: BigInt(0),
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Cancel single order");
		tx = await aftermathApi.Perpetuals().buildCancelOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			orderId: PerpetualsOrderUtils.orderId(
				initialOrderbookPrice,
				BigInt(1),
				ASK
			),
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place actual order");
		let orderSize = BigInt(10000);
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: orderSize,
			price: initialOrderbookPrice,
			orderType: BigInt(0),
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place market order");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: orderSize,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place limit orders for book price");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: BigInt(1),
			price: finalOrderbookPrice - BigInt(1),
			orderType: BigInt(0),
		});
		await user3.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(1),
			price: finalOrderbookPrice + BigInt(1),
			orderType: BigInt(0),
		});
		await user3.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Update oracle price");
		tx = await aftermathApi.Oracle().buildDevUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			price: finalOraclePrice,
			timestamp: 0,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// `sizes` computed with `compute_size_to_liquidate_isolated` in
		// `perpetuals/scripts/liquidation.py`
		console.log("Liquidate");
		tx = await aftermathApi.Perpetuals().buildLiquidateTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			liqeeAccountId: BigInt(0), // user1 account id
			sizes: [BigInt(5745)],
		});
		await user4.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Cancel book price orders");
		let [user3Asks, user3Bids] = await aftermathApi
			.Perpetuals()
			.fetchPositionOrderIds({
				coinType: usdcType,
				accountId: BigInt(2),
				marketId: MARKET_ID0,
			});
		for (const orderId of user3Asks) {
			tx = await aftermathApi.Perpetuals().buildCancelOrderTx({
				walletAddress: await user3.getAddress(),
				coinType: usdcType,
				accountCapId: user3AccountCap,
				marketId: MARKET_ID0,
				side: ASK,
				orderId,
			});
			await user3.signAndExecuteTransactionBlock({
				transactionBlock: tx,
				requestType,
			});
		}
		for (const orderId of user3Bids) {
			tx = await aftermathApi.Perpetuals().buildCancelOrderTx({
				walletAddress: await user3.getAddress(),
				coinType: usdcType,
				accountCapId: user3AccountCap,
				marketId: MARKET_ID0,
				side: BID,
				orderId,
			});
			await user3.signAndExecuteTransactionBlock({
				transactionBlock: tx,
				requestType,
			});
		}

		// User4 places limit bid for 4255 BTC lots at price 9400
		// User1 closes his position by market-buying user4's bid
		// User2 places limit ask for 10 BTC at price 9400
		// User4 closes his position (matched against user2, closing the circle)
		console.log("Place limit order");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: BigInt(4255),
			price: finalOrderbookPrice,
			orderType: BigInt(0),
		});
		await user4.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place market order");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(4255),
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place limit order");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			marketId: MARKET_ID0,
			side: BID,
			size: orderSize,
			price: finalOrderbookPrice,
			orderType: BigInt(0),
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place market order");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			marketId: MARKET_ID0,
			side: ASK,
			size: orderSize,
		});
		await user4.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		const mktParams = await aftermathApi
			.Perpetuals()
			.fetchMarketParams({ coinType: usdcType, marketId: MARKET_ID0 });
		let mktState = await aftermathApi
			.Perpetuals()
			.fetchMarketState({ coinType: usdcType, marketId: MARKET_ID0 });
		console.log(`Curr state:`, mktState);
		console.log(`Curr params:`, mktParams);
		const market = new PerpetualsMarket(BigInt(0), mktParams, mktState);

		const sleepTime = market.timeUntilNextFundingMs() + 2000;
		console.log(`Sleep ${sleepTime}ms until next funding`);
		await new Promise((f) => setTimeout(f, sleepTime));

		mktState = await aftermathApi
			.Perpetuals()
			.fetchMarketState({ coinType: usdcType, marketId: MARKET_ID0 });
		const estRate = market.estimatedFundingRate({
			indexPrice: IFixedUtils.numberFromIFixed(finalOraclePrice),
		});
		console.log(`Estimated funding rate: ${estRate * 100}%`);
		onchainTime = getObjectFields(
			await aftermathApi
				.Objects()
				.fetchObject({ objectId: Sui.constants.addresses.suiClockId })
		)?.timestamp_ms;
		console.log(
			"Last upd ms",
			mktState.fundingLastUpdMs,
			"onchain time",
			onchainTime
		);
		console.log("Update funding");
		tx = await aftermathApi.Perpetuals().buildUpdateFundingTx({
			walletAddress: await admin.getAddress(),
			coinType: usdcType,
			marketId: MARKET_ID0,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// User1 withdraw collateral 2000 USDC
		// User2 withdraw collateral 2000 USDC
		// User3 withdraw collateral 10000 USDC
		// User4 withdraw collateral 2000 USDC

		console.log("Withdraw collateral for User1");
		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: user1AccountCap,
			amount: BigInt(2000_000000000),
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Withdraw collateral for User2");
		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: user2AccountCap,
			amount: BigInt(2000_000000000),
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Withdraw collateral for User3");
		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountCapId: user3AccountCap,
			amount: tenThousandB9,
		});
		await user3.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Withdraw collateral for User4");
		tx = await aftermathApi.Perpetuals().fetchWithdrawCollateralTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			accountCapId: user4AccountCap,
			amount: BigInt(2000_000000000),
		});
		await user4.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});
	}, 50000000);
});
