import { Balance } from "../../../types";

/// `u64` bitmask with all bits set
const HI_64 = BigInt("18446744073709551615");
/// Positions to bitshift for operating on first 64 bits
const FIRST_64 = BigInt(64);
export const ASK = true;
export const BID = false;

// Return price of given `order_id`, (works for ask or bid)
export const price = (orderId: bigint): bigint => {
	return orderId >> FIRST_64;
};

/// Return counter of an ask having `order_id`
export const counterAsk = (orderId: bigint): bigint => {
	return orderId & HI_64;
};

/// Return counter of a bid having `order_id`
export const counterBid = (orderId: bigint): bigint => {
	return (orderId & HI_64) ^ HI_64;
};

/// Return order_id given price, counter and side
export const orderId = (price: bigint, counter: bigint, side: boolean): bigint => {
	if (side == ASK) return orderIdAsk(price, counter);
	else return orderIdBid(price, counter);
};

/// Return order_id for ask order, given price, counter
const orderIdAsk = (price: Balance, counter: bigint): bigint => {
	return (price << FIRST_64) | counter;
};

/// Return order_id for bid order, given price, counter and side
const orderIdBid = (price: Balance, counter: bigint): bigint => {
	return ((price << FIRST_64) | (counter ^ HI_64));
};
