import { Helpers } from "../../..";
import {
	RouterCompleteTradeRoute,
	RouterServicePath,
	RouterServicePaths,
	RouterTradeEvent,
	RouterTradeRoute,
} from "../routerTypes";
import { RouterTradeEventOnChain } from "./routerApiCastingTypes";

export class RouterApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	public static routerTradeEventFromOnChain = (
		eventOnChain: RouterTradeEventOnChain
	): RouterTradeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			trader: fields.swapper,
			coinInType: fields.type_in,
			coinInAmount: BigInt(fields.amount_in),
			coinOutType: fields.type_out,
			coinOutAmount: BigInt(fields.amount_out),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static routerCompleteTradeRouteFromServicePaths = (
		paths: RouterServicePaths
	): RouterCompleteTradeRoute => {
		const routes: RouterTradeRoute[] = paths.data.map((path) => ({
			paths: path.path.data.map((hop) => ({
				protocolName: hop.protocol,
				pool: hop.pool_id,
				coinIn: {
					type: hop.input,
					amount: BigInt(Math.floor(hop.input_amount)),
				},
				coinOut: {
					type: hop.output,
					amount: BigInt(Math.floor(hop.output_amount)),
				},
			})),
			coinIn: {
				type: path.path.data[0].input,
				amount: BigInt(Math.floor(path.path.data[0].input_amount)),
			},
			coinOut: {
				type: path.path.data[path.path.data.length - 1].output,
				amount: BigInt(
					Math.floor(
						path.path.data[path.path.data.length - 1].output_amount
					)
				),
			},
		}));
		return {
			routes,
			coinIn: {
				type: routes[0].coinIn.type,
				amount: Helpers.sumBigInt(
					routes.map((route) => route.coinIn.amount)
				),
			},
			coinOut: {
				type: routes[routes.length - 1].coinOut.type,
				amount: Helpers.sumBigInt(
					routes.map((route) => route.coinOut.amount)
				),
			},
		};
	};

	public static routerServicePathsFromCompleteTradeRoute = (
		completeTradeRoute: RouterCompleteTradeRoute
	): RouterServicePaths => {
		const data: RouterServicePath[] = completeTradeRoute.routes.map(
			(route) => ({
				amount: Number(route.coinIn.amount),
				path: {
					data: route.paths.map((path) => ({
						protocol: path.protocolName,
						pool_id:
							typeof path.pool === "string"
								? path.pool
								: (() => {
										throw new Error(
											"pool within path is object, but expected string"
										);
								  })(),
						input: path.coinIn.type,
						output: path.coinOut.type,
						input_amount: Number(path.coinIn.amount),
						output_amount: Number(path.coinOut.amount),
					})),
				},
			})
		);
		return { data };
	};
}
