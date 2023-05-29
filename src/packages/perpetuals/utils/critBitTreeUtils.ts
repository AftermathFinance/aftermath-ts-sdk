import { Balance } from "../../../types";
import BN from "bn.js";

/// `u64` bitmask with all bits set
const HI_64 = new BN("18446744073709551615");
/// Positions to bitshift for operating on first 64 bits
const FIRST_64 = 64;
export const ASK = true;
export const BID = false;

// Return price of given `order_id`, (works for ask or bid)
export const price = (orderId: BN): Balance => {
	return BigInt(orderId.shrn(FIRST_64).toString());
};

/// Return counter of an ask having `order_id`
export const counterAsk = (orderId: BN): bigint => {
	return BigInt(orderId.and(HI_64).toString());
};

/// Return counter of a bid having `order_id`
export const counterBid = (orderId: BN): bigint => {
	return BigInt(orderId.and(HI_64).xor(HI_64).toString());
};

/// Return order_id given price, counter and side
export const orderId = (price: Balance, counter: bigint, side: boolean): BN => {
	if (side == ASK) return orderIdAsk(price, counter);
	else return orderIdBid(price, counter);
};

/// Return order_id for ask order, given price, counter
const orderIdAsk = (price: Balance, counter: bigint): BN => {
	const orderIdStr = ((price << BigInt(FIRST_64)) | counter).toString();
	return new BN(orderIdStr);
};

/// Return order_id for bid order, given price, counter and side
const orderIdBid = (price: Balance, counter: bigint): BN => {
	const orderIdStr = (
		(price << BigInt(FIRST_64)) |
		(counter ^ BigInt(HI_64.toString()))
	).toString();
	return new BN(orderIdStr);
};
