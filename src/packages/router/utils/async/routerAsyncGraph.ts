import { Helpers } from "../../../../general/utils";
import {
	Balance,
	RouterAsyncTradeResults,
	RouterCompleteTradeRoute,
	RouterTradeRoute,
} from "../../../../types";

/////////////////////////////////////////////////////////////////////
//// Class
/////////////////////////////////////////////////////////////////////

export class RouterAsyncGraph {
	/////////////////////////////////////////////////////////////////////
	//// Public Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Graph Creation
	/////////////////////////////////////////////////////////////////////

	public static createFinalCompleteRoute(inputs: {
		tradeResults: RouterAsyncTradeResults;
		coinInAmounts: Balance[];
		synchronousCompleteRoutes?: RouterCompleteTradeRoute[];
	}): RouterCompleteTradeRoute {
		const asyncCompleteRoutes = this.completeRoutesFromTradeResults(inputs);
		const completeRoutes = inputs.synchronousCompleteRoutes
			? [...asyncCompleteRoutes, inputs.synchronousCompleteRoutes]
			: [...asyncCompleteRoutes];

		const chosenCompleteRoutes = this.splitTradeBetweenRoutes({
			...inputs,
			completeRoutes,
		});

		const finalCompleteRoute = this.singleCompleteRouteFromMany({
			completeRoutes: chosenCompleteRoutes,
		});

		return finalCompleteRoute;
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private static splitTradeBetweenRoutes = (inputs: {
		completeRoutes: RouterCompleteTradeRoute[][];
		coinInAmounts: Balance[];
	}): RouterCompleteTradeRoute[] => {
		const { completeRoutes, coinInAmounts } = inputs;

		let chosenRouteIndexes: number[] = Array(coinInAmounts.length).fill(-1);

		for (const _ of coinInAmounts) {
			const incrementalAmountsOut = completeRoutes.map((route, index) => {
				const prevChosenIndex = chosenRouteIndexes[index];

				const prevAmountOut =
					prevChosenIndex < 0
						? BigInt(0)
						: route[prevChosenIndex].coinOut.amount;

				const currentAmountOut =
					route[prevChosenIndex + 1].coinOut.amount;

				const incrementalAmountOut = currentAmountOut - prevAmountOut;

				return incrementalAmountOut;
			});

			const maxIndex = Helpers.indexOfMax(incrementalAmountsOut);

			chosenRouteIndexes[maxIndex] += 1;
		}

		const selectedCompleteRoutes = chosenRouteIndexes
			.map((chosenIndex, routeIndex) =>
				chosenIndex >= 0
					? completeRoutes[routeIndex][chosenIndex]
					: undefined
			)
			.filter(
				(route) => route !== undefined
			) as RouterCompleteTradeRoute[];

		return selectedCompleteRoutes;
	};

	private static singleCompleteRouteFromMany = (inputs: {
		completeRoutes: RouterCompleteTradeRoute[];
	}): RouterCompleteTradeRoute => {
		const { completeRoutes } = inputs;

		let routes: RouterTradeRoute[] = [];
		let coinInAmount = BigInt(0);
		let coinOutAmount = BigInt(0);
		for (const completeRoute of completeRoutes) {
			routes = [...routes, ...completeRoute.routes];

			coinInAmount += completeRoute.coinIn.amount;
			coinOutAmount += completeRoute.coinOut.amount;
		}

		const spotPrice = completeRoutes.reduce(
			(acc, cur) =>
				acc +
				(Number(cur.coinIn.amount) / Number(coinInAmount)) *
					cur.spotPrice,
			0
		);

		return {
			routes,
			spotPrice,
			coinIn: {
				type: completeRoutes[0].coinIn.type,
				amount: coinInAmount,
				tradeFee: BigInt(0),
			},
			coinOut: {
				type: completeRoutes[0].coinOut.type,
				amount: coinInAmount,
				tradeFee: BigInt(0),
			},
		};
	};

	private static completeRoutesFromTradeResults = (inputs: {
		tradeResults: RouterAsyncTradeResults;
	}): RouterCompleteTradeRoute[][] => {
		const { tradeResults } = inputs;

		const completeRoutes: RouterCompleteTradeRoute[][] =
			tradeResults.results.map((result) => {
				const routes: RouterTradeRoute[] = result.amountsOut.map(
					(amountOut, amountOutIndex) => {
						const path = {
							pool: result.pool,
							protocolName: result.protocol,
							coinIn: {
								type: tradeResults.coinInType,
								amount: tradeResults.coinInAmounts[
									amountOutIndex
								],
								tradeFee: BigInt(0),
							},
							coinOut: {
								type: tradeResults.coinOutType,
								amount: amountOut,
								tradeFee: BigInt(0),
							},
							spotPrice:
								Number(tradeResults.coinInAmounts[0]) /
								Number(result.amountsOut[0]),
						};

						return {
							...path,
							paths: [path],
						};
					}
				);

				const completeRoutes: RouterCompleteTradeRoute[] = routes.map(
					(route) => {
						return {
							routes: [route],
							...route,
						};
					}
				);

				return completeRoutes;
			});

		return completeRoutes;
	};
}
