import { Balance, Helpers } from "../../..";
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

	public static routerServicePathsFromCompleteTradeRoute = (
		completeTradeRoute: RouterCompleteTradeRoute
	): RouterServicePaths => {
		const data: RouterServicePath[] = completeTradeRoute.routes.map(
			(route) => ({
				amount: Number(route.coinIn.amount),
				path: {
					data: route.paths.map((path) => ({
						pool: path.pool,
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
