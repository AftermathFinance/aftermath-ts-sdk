// import { Aftermath } from "../../../../general/providers";
// import { Helpers } from "../../../../general/utils/helpers";
// import { Balance, PoolObject } from "../../../../types";
// import { CoinType } from "../../../coin/coinTypes";
// import { Pool } from "../../../pools";
// import { Router } from "../../router";

// const tradeAmounts = {
// 	max: BigInt(9_223_372_036_854_775_807),
// 	extraLarge: BigInt(100000000000000000),
// 	large: BigInt(10000000000000),
// 	medium: BigInt(1000000000),
// 	small: BigInt(10000),
// };

// const runMe = async () => {
// 	const sdk = new Aftermath("LOCAL");
// 	const router = sdk.Router();

// 	const supportedCoins = Object.keys(await router.getSupportedCoinPaths());

// 	// PRODUCTOIN: add asserts for coins not in pool or same coin trades
// 	const coinIn =
// 		supportedCoins.find((coin) => coin.toLowerCase().includes("afsui")) ??
// 		"";
// 	const coinOut =
// 		supportedCoins.find((coin) => coin.toLowerCase().includes("::af::")) ??
// 		"";
// 	const coinInAmount = BigInt(223447384370);

// 	console.log("START");
// 	console.log("\n");
// 	try {
// 		// await runRoute(router, coinIn, coinInAmount, coinOut, 1);
// 		const coinOutAmount = await runRoute(
// 			router,
// 			coinIn,
// 			coinInAmount,
// 			coinOut,
// 			5,
// 			false
// 		);

// 		await runRoute(router, coinIn, coinOutAmount, coinOut, 5, true);

// 		// const pool = await sdk.Pools().getPool({
// 		// 	objectId:
// 		// 		"0x5dbf77deddfc68f446b96b2a17b7160faf4a015544df9ab3db81bf7b5ffc0570",
// 		// });
// 		// const pool = new Pool(
// 		// 	Helpers.parseJsonWithBigint(
// 		// 		`{"objectId":"0xbc8bdb27d73b28f9ba9cd1b56e256f21bf9584d1e80ccc460a24e46bd4078950","lpCoinType":"0xef7ba1db7f5604bee5f86cf444c3636d6e5d711fbba280954fa9d2f654ef7db7::af_lp_eth::AF_LP_ETH","name":"ETH Pool","creator":"0x4b02b9b45f2a9597363fbaacb2fd6e7fb8ed9329bb6f716631b5717048908ace","lpCoinSupply":"3675123799120n","illiquidLpCoinSupply":"1000n","flatness":"0n","coins":{"0xfa9a96ded27547caf042ae0cde633b1699a8da7344e5e0bee2d0fd00556086df::af::AF":{"weight":"250000000000000000n","balance":"1000000000000000n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xfa9a96ded27547caf042ae0cde633b1699a8da7344e5e0bee2d0fd00556086df::afsui::AFSUI":{"weight":"250000000000000000n","balance":"876843564864654n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xfa9a96ded27547caf042ae0cde633b1699a8da7344e5e0bee2d0fd00556086df::lzeth::LZETH":{"weight":"250000000000000000n","balance":"45612457575n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xfa9a96ded27547caf042ae0cde633b1699a8da7344e5e0bee2d0fd00556086df::wheth::WHETH":{"weight":"250000000000000000n","balance":"4561233457n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"}}}`
// 		// 	) as unknown as PoolObject
// 		// );
// 		// const amountOut = pool.getTradeAmountOut({
// 		// 	coinInType:
// 		// 		"0xfa9a96ded27547caf042ae0cde633b1699a8da7344e5e0bee2d0fd00556086df::axlusdc::AXLUSDC",
// 		// 	coinOutType:
// 		// 		"0xfa9a96ded27547caf042ae0cde633b1699a8da7344e5e0bee2d0fd00556086df::afsui::AFSUI",
// 		// 	coinInAmount: BigInt(5000000),
// 		// });
// 		// console.log("amountOut", amountOut);
// 		// await runRoute(router, coinIn, coinOutAmount, coinOut, 5, true);
// 		// await runRoute(router, coinIn, coinInAmount, coinOut, 3);
// 		// await runRoute(router, coinIn, coinInAmount, coinOut, 4);
// 		// await runRoute(router, coinIn, coinInAmount, coinOut, 5);
// 		// await runRoute(router, coinIn, coinInAmount, coinOut, 6);
// 		// await runRoute(router, coinIn, coinInAmount, coinOut, 7);
// 	} catch (e) {
// 		console.error(e);
// 	}

// 	console.log("END");
// };

// const runRoute = async (
// 	router: Router,
// 	coinIn: CoinType,
// 	coinInAmount: Balance,
// 	coinOut: CoinType,
// 	maxRouteLength: number,
// 	isGivenAmountOut: boolean
// ): Promise<Balance> => {
// 	const start = performance.now();

// 	const completeRoute = isGivenAmountOut
// 		? await router.getCompleteTradeRouteGivenAmountOut(
// 				{
// 					coinInType: coinIn,
// 					coinOutType: coinOut,
// 					coinOutAmount: coinInAmount,
// 				}
// 				// maxRouteLength
// 		  )
// 		: await router.getCompleteTradeRouteGivenAmountIn(
// 				{ coinInType: coinIn, coinInAmount, coinOutType: coinOut }
// 				// maxRouteLength
// 		  );

// 	console.log({ coinIn, coinInAmount, coinOut });

// 	const end = performance.now();

// 	const stableCoinPercentLoss =
// 		(Number(completeRoute.coinIn.amount - completeRoute.coinOut.amount) /
// 			Number(completeRoute.coinIn.amount)) *
// 		100;

// 	console.log("Max Route Length:", maxRouteLength);
// 	console.log("Routes Used:", completeRoute.routes.length);

// 	// for (const route of completeRoute.routes) {
// 	// 	console.log("\n");
// 	// 	console.log(
// 	// 		route.paths.map((path) => {
// 	// 			return {
// 	// 				pool: path.poolObjectId,
// 	// 				coinIn: path.coinIn,
// 	// 				coinInAmount: path.coinIn.amount,
// 	// 				coinOut: path.coinOut,
// 	// 				coinOutAmount: path.coinOut.amount,
// 	// 			};
// 	// 		})
// 	// 	);
// 	// }

// 	console.log("Coin In Amount:", completeRoute.coinIn.amount);
// 	console.log("Coin Out Amount:", completeRoute.coinOut.amount);
// 	console.log(
// 		"Stable Coin Loss:",
// 		completeRoute.coinIn.amount - completeRoute.coinOut.amount,
// 		`${stableCoinPercentLoss.toFixed(2)}%`
// 	);
// 	console.log("Execution time:", end - start, "ms");
// 	console.log("\n");

// 	return completeRoute.coinOut.amount;
// };

// runMe();
