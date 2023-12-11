import { PerpetualsOrderId, PerpetualsOrderSide } from "../../../types";
const BN = require("bn.js");

export class PerpetualsOrderUtils {
	// Return order_id given price, counter and side
	public static orderId = (
		price: bigint,
		counter: bigint,
		side: PerpetualsOrderSide
	): PerpetualsOrderId => {
		if (Boolean(side)) return this.orderIdAsk(price, counter);
		else return this.orderIdBid(price, counter);
	};

	// Return order_id for ask order, given price, counter
	// (price << 64) | counter
	private static orderIdAsk = (
		price: bigint,
		counter: bigint
	): PerpetualsOrderId => {
		let priceBn = new BN(price);
		let counterBn = new BN(counter);
		return BigInt(priceBn.shln(64).or(counterBn).toString());
	};

	// Return order_id for bid order, given price, counter and side
	// ((price ^ 0xffff_ffff_ffff_ffff) << 64) | counter
	private static orderIdBid = (
		price: bigint,
		counter: bigint
	): PerpetualsOrderId => {
		let priceBn = new BN(price);
		let counterBn = new BN(counter);
		let mask_bn = new BN(`ffffffffffffffff`, 16);
		return BigInt(priceBn.xor(mask_bn).shln(64).or(counterBn).toString());
	};

	// Return price of given `order_id`, (works for ask or bid)
	public static price = (
		orderId: PerpetualsOrderId,
		side: PerpetualsOrderSide
	): bigint => {
		if (side === PerpetualsOrderSide.Ask) return this.priceAsk(orderId);
		else return this.priceBid(orderId);
	};

	// Returns price of a given ask `order_id`.
	private static priceAsk = (orderId: PerpetualsOrderId): bigint => {
		let orderIdBn = new BN(orderId);
		return BigInt(orderIdBn.shrn(64).toString());
	};

	// Returns price of a given bid `order_id`.
	private static priceBid = (orderId: PerpetualsOrderId): bigint => {
		let orderIdBn = new BN(orderId);
		let mask_bn = new BN(`ffffffffffffffff`, 16);
		return BigInt(orderIdBn.shrn(64).xor(mask_bn).toString());
	};

	public static counter = (orderId: PerpetualsOrderId): bigint => {
		let orderIdBn = new BN(orderId);
		let mask_bn = new BN(`0000000000000000ffffffffffffffff`, 16);
		return BigInt(orderIdBn.and(mask_bn).toString());
	};
}
