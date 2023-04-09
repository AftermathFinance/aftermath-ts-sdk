import { Aftermath } from "../../../general/providers";
import { Balance } from "../../../types";
import { CoinType } from "../../coin/coinTypes";
import { Router } from "../router";

const tradeAmounts = {
	max: BigInt(9_223_372_036_854_775_807),
	extraLarge: BigInt(100000000000000000),
	large: BigInt(10000000000000),
	medium: BigInt(1000000000),
	small: BigInt(10000),
};

const runMe = async () => {
	const AftermathSdk = new Aftermath("LOCAL");
	const pools = await AftermathSdk.Pools().getAllPools();
	const router = await AftermathSdk.Router();

	const supportedCoins = await router.getSupportedCoins();

	const coinIn =
		supportedCoins.find((coin) => coin.toLowerCase().includes("wheth")) ??
		"";
	const coinOut =
		supportedCoins.find((coin) => coin.toLowerCase().includes("whbtc")) ??
		"";
	const coinInAmount = tradeAmounts.medium;

	console.log("START");
	console.log("\n");

	try {
		// await runRoute(router, coinIn, coinInAmount, coinOut, 1);
		const coinOutAmount = await runRoute(
			router,
			coinIn,
			coinInAmount,
			coinOut,
			5,
			false
		);
		// await runRoute(router, coinIn, coinOutAmount, coinOut, 5, true);
		// await runRoute(router, coinIn, coinInAmount, coinOut, 3);
		// await runRoute(router, coinIn, coinInAmount, coinOut, 4);
		// await runRoute(router, coinIn, coinInAmount, coinOut, 5);
		// await runRoute(router, coinIn, coinInAmount, coinOut, 6);
		// await runRoute(router, coinIn, coinInAmount, coinOut, 7);
	} catch (e) {
		console.error(e);
	}

	console.log("END");
};

const runRoute = async (
	router: Router,
	coinIn: CoinType,
	coinInAmount: Balance,
	coinOut: CoinType,
	maxRouteLength: number,
	isGivenAmountOut: boolean
): Promise<Balance> => {
	const start = performance.now();

	const completeRoute = isGivenAmountOut
		? await router.getCompleteTradeRouteGivenAmountOut(
				{ coinIn, coinOut, coinInAmount }
				// maxRouteLength
		  )
		: await router.getCompleteTradeRouteGivenAmountIn(
				{ coinIn, coinInAmount, coinOut }
				// maxRouteLength
		  );

	const end = performance.now();

	const stableCoinPercentLoss =
		(Number(completeRoute.coinIn.amount - completeRoute.coinOut.amount) /
			Number(completeRoute.coinIn.amount)) *
		100;

	console.log("Max Route Length:", maxRouteLength);
	console.log("Routes Used:", completeRoute.routes.length);

	// for (const route of completeRoute.routes) {
	// 	console.log("\n");
	// 	console.log(
	// 		route.paths.map((path) => {
	// 			return {
	// 				pool: path.poolObjectId,
	// 				coinIn: path.coinIn,
	// 				coinInAmount: path.coinIn.amount,
	// 				coinOut: path.coinOut,
	// 				coinOutAmount: path.coinOut.amount,
	// 			};
	// 		})
	// 	);
	// }

	console.log("Coin In Amount:", completeRoute.coinIn.amount);
	console.log("Coin Out Amount:", completeRoute.coinOut.amount);
	console.log(
		"Stable Coin Loss:",
		completeRoute.coinIn.amount - completeRoute.coinOut.amount,
		`${stableCoinPercentLoss.toFixed(2)}%`
	);
	console.log("Execution time:", end - start, "ms");
	console.log("\n");

	return completeRoute.coinOut.amount;
};

runMe();
