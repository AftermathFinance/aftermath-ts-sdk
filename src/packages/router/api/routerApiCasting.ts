import { Balance, Helpers } from "../../..";
import {
	RouterCompleteTradeRoute,
	RouterProtocolName,
	RouterServicePath,
	RouterServicePaths,
	RouterTradeEvent,
	RouterTradeRoute,
} from "../routerTypes";
import {
	RouterServiceProtocol,
	RouterTradeEventOnChain,
} from "./routerApiCastingTypes";

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
	): Omit<RouterCompleteTradeRoute, "netTradeFeePercentage"> => {
		const routes: RouterTradeRoute[] = paths.paths.map((path) => ({
			// TODO: add spot price
			portion: BigInt(path.portion),
			paths: path.path.data.map((hop) => ({
				protocolName: hop.protocol.protocol,
				poolId: hop.pool,
				poolMetadata: {
					protocol: hop.protocol,
					tbData: hop.tb_data,
				},
				coinIn: {
					type: hop.input,
					amount: BigInt(hop.input_amount),
					tradeFee: BigInt(hop.swap_fee.input_fee_amount),
				},
				coinOut: {
					type: hop.output,
					amount: BigInt(hop.output_amount),
					tradeFee: BigInt(hop.swap_fee.output_fee_amount),
				},
				spotPrice:
					Number(BigInt(hop.input_amount)) /
					Number(BigInt(hop.output_amount)),
			})),
			coinIn: {
				type: path.path.data[0].input,
				amount: BigInt(path.path.data[0].input_amount),
				tradeFee: BigInt(path.path.data[0].swap_fee.input_fee_amount),
			},
			coinOut: {
				type: path.path.data[path.path.data.length - 1].output,
				amount: BigInt(
					path.path.data[path.path.data.length - 1].output_amount
				),
				tradeFee: BigInt(
					path.path.data[path.path.data.length - 1].swap_fee
						.output_fee_amount
				),
			},
			spotPrice:
				Number(BigInt(path.path.data[0].input_amount)) /
				Number(
					BigInt(
						path.path.data[path.path.data.length - 1].output_amount
					)
				),
		}));
		return {
			routes,
			coinIn: {
				type: routes[0].coinIn.type,
				amount: BigInt(paths.amount_in),
				tradeFee: BigInt(paths.protocol_fee.input_fee_amount),
			},
			coinOut: {
				type: routes[routes.length - 1].coinOut.type,
				amount: BigInt(paths.amount_out),
				tradeFee: BigInt(paths.protocol_fee.output_fee_amount),
			},
			spotPrice: Number(paths.amount_in) / Number(paths.amount_out),
		};
	};

	public static routerServicePathsFromCompleteTradeRoute = (
		completeTradeRoute: RouterCompleteTradeRoute
	): RouterServicePaths => {
		const paths: RouterServicePath[] = completeTradeRoute.routes.map(
			(route) => ({
				portion: route.portion.toString(),
				path: {
					data: route.paths.map((path) => ({
						pool: path.poolId,
						protocol: path.poolMetadata.protocol,
						tb_data: path.poolMetadata.tbData,
						input: path.coinIn.type,
						output: path.coinOut.type,
						input_amount: path.coinIn.amount.toString(),
						output_amount: path.coinOut.amount.toString(),
						acceptable_price_impact: true,
						swap_fee: {
							input_fee_amount: path.coinIn.tradeFee.toString(),
							output_fee_amount: path.coinOut.tradeFee.toString(),
						},
					})),
				},
			})
		);
		return {
			paths,
			amount_in: completeTradeRoute.coinIn.amount.toString(),
			amount_out: completeTradeRoute.coinOut.amount.toString(),
			acceptable_price_impact: true,
			protocol_fee: {
				input_fee_amount: completeTradeRoute.coinIn.tradeFee.toString(),
				output_fee_amount:
					completeTradeRoute.coinOut.tradeFee.toString(),
			},
		};
	};

	public static routerProtocolNameToRouterServiceProtocol = (
		routerProtocolName: RouterProtocolName
	): RouterServiceProtocol => {
		if (routerProtocolName === "Aftermath") {
			return {
				protocol: routerProtocolName,
				pool_type: "Any",
				extension: "Any",
			};
		} else if (
			routerProtocolName === "Kriya" ||
			routerProtocolName === "SuiSwap" ||
			routerProtocolName === "BlueMove"
		) {
			return {
				protocol: routerProtocolName,
				pool_type: "Any",
			};
		}
		return {
			protocol: routerProtocolName,
		};
	};
}
