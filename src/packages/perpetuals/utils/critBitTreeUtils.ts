import { Balance } from "../../../types";

export class CritBitTreeUtils {
	/// `u64` bitmask with all bits set
	private static readonly HI_64 = BigInt("18446744073709551615");
	/// Positions to bitshift for operating on first 64 bits
	private static readonly FIRST_64 = BigInt(64);
	public static readonly ASK = true;
	public static readonly BID = false;

	// Return price of given `order_id`, (works for ask or bid)
	public static readonly price = (orderId: bigint): bigint => {
		return orderId >> this.FIRST_64;
	};

	/// Return counter of an ask having `order_id`
	public static readonly counterAsk = (orderId: bigint): bigint => {
		return orderId & this.HI_64;
	};

	/// Return counter of a bid having `order_id`
	public static readonly counterBid = (orderId: bigint): bigint => {
		return (orderId & this.HI_64) ^ this.HI_64;
	};

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
	private static orderIdAsk = (price: Balance, counter: bigint): bigint => {
		return (price << this.FIRST_64) | counter;
	};

	/// Return order_id for bid order, given price, counter and side
	private static orderIdBid = (price: Balance, counter: bigint): bigint => {
		return (price << this.FIRST_64) | (counter ^ this.HI_64);
	};
}
