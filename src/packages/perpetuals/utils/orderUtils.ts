import { Balance } from "../../../types";

export class OrderUtils {
	/// Positions to bitshift for operating on first 64 bits
	private static readonly FIRST_64 = BigInt(64);
	public static readonly ASK = true;
	public static readonly BID = false;

	/// Return order_id given price, counter and side
	public static readonly orderId = (
		price: bigint,
		counter: bigint,
		side: boolean
	): bigint => {
		if (side === this.ASK) return this.orderIdAsk(price, counter);
		else return this.orderIdBid(price, counter);
	};

	/// Return order_id for ask order, given price, counter
	private static readonly orderIdAsk = (
		price: Balance,
		counter: bigint
	): bigint => {
		return (price << this.FIRST_64) | counter;
	};

	/// Return order_id for bid order, given price, counter and side
	private static readonly orderIdBid = (
		price: Balance,
		counter: bigint
	): bigint => {
		return (
			((price ^ BigInt(0xffff_ffff_ffff_ffff)) << this.FIRST_64) | counter
		);
	};

	// Return price of given `order_id`, (works for ask or bid)
	public static readonly price = (orderId: bigint, side: boolean): bigint => {
		if (side === this.ASK) return this.priceAsk(orderId);
		else return this.priceBid(orderId);
	};

	/// Returns price of a given ask `order_id`.
	private static readonly priceAsk = (orderId: bigint): bigint => {
		return orderId >> this.FIRST_64;
	};

	/// Returns price of a given bid `order_id`.
	private static readonly priceBid = (orderId: bigint): bigint => {
		return (orderId >> this.FIRST_64) ^ BigInt(0xffff_ffff_ffff_ffff);
	};

	public static readonly counter = (orderId: bigint): bigint => {
		return orderId & BigInt(0x0000_0000_0000_0000_ffff_ffff_ffff_ffff);
	};
}
