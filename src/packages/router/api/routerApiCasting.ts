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
			// TODO: add spot price
			paths: path.path.data.map((hop) => ({
				protocolName: hop.protocol,
				pool: hop.pool,
				coinIn: {
					type: hop.input,
					amount: BigInt(Math.round(hop.input_amount)),
					tradeFee: BigInt(Math.round(hop.swap_fee.input_fee_amount)),
				},
				coinOut: {
					type: hop.output,
					amount: BigInt(Math.round(hop.output_amount)),
					tradeFee: BigInt(
						Math.round(hop.swap_fee.output_fee_amount)
					),
				},
				spotPrice:
					Number(BigInt(Math.round(hop.input_amount))) /
					Number(BigInt(Math.round(hop.output_amount))),
			})),
			coinIn: {
				type: path.path.data[0].input,
				amount: BigInt(Math.round(path.path.data[0].input_amount)),
				tradeFee: BigInt(
					Math.round(path.path.data[0].swap_fee.input_fee_amount)
				),
			},
			coinOut: {
				type: path.path.data[path.path.data.length - 1].output,
				amount: BigInt(
					Math.round(
						path.path.data[path.path.data.length - 1].output_amount
					)
				),
				tradeFee: BigInt(
					Math.round(
						path.path.data[path.path.data.length - 1].swap_fee
							.output_fee_amount
					)
				),
			},
			spotPrice:
				Number(BigInt(Math.round(path.path.data[0].input_amount))) /
				Number(
					BigInt(
						Math.round(
							path.path.data[path.path.data.length - 1]
								.output_amount
						)
					)
				),
		}));

		const coinInAmount = Helpers.sumBigInt(
			routes.map((route) => route.coinIn.amount)
		);
		const coinOutAmount = Helpers.sumBigInt(
			routes.map((route) => route.coinOut.amount)
		);

		return {
			routes,
			coinIn: {
				type: routes[0].coinIn.type,
				amount: coinInAmount,
				tradeFee: BigInt(
					Math.round(paths.protocol_fee.input_fee_amount)
				),
			},
			coinOut: {
				type: routes[routes.length - 1].coinOut.type,
				amount: coinOutAmount,
				tradeFee: BigInt(
					Math.round(paths.protocol_fee.output_fee_amount)
				),
			},
			spotPrice: Number(coinInAmount) / Number(coinInAmount),
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
						pool: path.pool.tb_data,
						input: path.coinIn.type,
						output: path.coinOut.type,
						input_amount: Number(path.coinIn.amount),
						output_amount: Number(path.coinOut.amount),
						swap_fee: {
							input_fee_amount: Number(path.coinIn.tradeFee),
							output_fee_amount: Number(path.coinOut.tradeFee),
						},
					})),
				},
			})
		);
		return {
			data,
			protocol_fee: {
				input_fee_amount: Number(completeTradeRoute.coinIn.tradeFee),
				output_fee_amount: Number(completeTradeRoute.coinOut.tradeFee),
			},
		};
	};
}
