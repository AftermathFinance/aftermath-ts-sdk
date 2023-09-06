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
	getPerpetualsAccount,
	printAccountMetrics,
	getPerpetualsMarket,
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

	test("Account Margin", async () => {
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
		const perpetuals = new Perpetuals(connection.fullnode);

		const usdcType = faucetConfig.packages.faucet + "::usdc::USDC";
		const initialOraclePrice = BigInt(10000) * ONE_F18;
		const initialOrderbookPrice = fromOraclePriceToOrderbookPrice(
			initialOraclePrice,
			LOT_SIZE,
			TICK_SIZE
		);
		const finalOraclePrice = BigInt(9600) * ONE_F18;
		const finalOrderbookPrice = fromOraclePriceToOrderbookPrice(
			finalOraclePrice,
			LOT_SIZE,
			TICK_SIZE
		);

		let onchainTime = getObjectFields(
			await aftermathApi
				.Objects()
				.fetchObject({ objectId: Sui.constants.addresses.suiClockId })
		)?.timestamp_ms;
		console.log(`Time onchain vs TS:\n${onchainTime}, ${Date.now()}`);

		// Create package provider
		let admin = getSigner(adminPrivateKey, aftermathApi);
		let user1 = getSigner(user1PrivateKey, aftermathApi);
		let user2 = getSigner(user2PrivateKey, aftermathApi);
		// let user3 = getSigner(user3PrivateKey, aftermathApi);
		// let user4 = getSigner(user4PrivateKey, aftermathApi);

		let tx: TransactionBlock;
		const requestType = "WaitForLocalExecution";

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

		let market = await getPerpetualsMarket(
			aftermathApi,
			MARKET_ID0,
			usdcType
		);
		console.log(market);

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

		console.log("Fetch user1 account");
		let accountUser1 = await getPerpetualsAccount(
			aftermathApi,
			await user1.getAddress(),
			BigInt(0),
			usdcType
		);

		console.log("Fetch user2 account");
		let accountUser2 = await getPerpetualsAccount(
			aftermathApi,
			await user2.getAddress(),
			BigInt(1),
			usdcType
		);

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

		// Update price for "BTC" to finalOraclePrice in fixed representation
		console.log("Update BTC price feed");
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

		accountUser1 = await getPerpetualsAccount(
			aftermathApi,
			await user1.getAddress(),
			BigInt(0),
			usdcType
		);

		printAccountMetrics(
			accountUser1,
			[market],
			[IFixedUtils.numberFromIFixed(finalOraclePrice)],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);

		accountUser2 = await getPerpetualsAccount(
			aftermathApi,
			await user2.getAddress(),
			BigInt(1),
			usdcType
		);

		printAccountMetrics(
			accountUser2,
			[market],
			[IFixedUtils.numberFromIFixed(finalOraclePrice)],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);

		console.log("Place order to take profits");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountCapId: accountUser2.accountCap.objectId,
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

		console.log("Place market order to close position");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountCapId: accountUser1.accountCap.objectId,
			marketId: MARKET_ID0,
			side: ASK,
			size: orderSize,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Fetch user1 account");
		accountUser1 = await getPerpetualsAccount(
			aftermathApi,
			await user1.getAddress(),
			BigInt(0),
			usdcType
		);

		printAccountMetrics(
			accountUser1,
			[market],
			[IFixedUtils.numberFromIFixed(finalOraclePrice)],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);

		console.log("Fetch user2 account");
		accountUser2 = await getPerpetualsAccount(
			aftermathApi,
			await user2.getAddress(),
			BigInt(1),
			usdcType
		);

		printAccountMetrics(
			accountUser2,
			[market],
			[IFixedUtils.numberFromIFixed(finalOraclePrice)],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);
	}, 5000000);
});
