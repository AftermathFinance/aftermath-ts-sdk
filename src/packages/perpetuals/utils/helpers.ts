import { AnyObjectType } from "../../../types";

export const isMarketManagerParamsKeyType = (type: AnyObjectType) =>
	type.includes("Params");

export const isMarketManagerStateKeyType = (type: AnyObjectType) =>
	type.includes("State");

export const isMarketManagerOrderbookKeyType = (type: AnyObjectType) =>
	type.includes("Orderbook");
