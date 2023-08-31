import { Balance } from "../../../types";

/// Positions to bitshift for operating on first 64 bits
const FIRST_64 = BigInt(64);
export const ASK = true;
export const BID = false;

/// Return order_id given price, counter and side
export const orderId = (
	price: bigint,
	counter: bigint,
	side: boolean
): bigint => {
	if (side == ASK) return orderIdAsk(price, counter);
	else return orderIdBid(price, counter);
};

/// Return order_id for ask order, given price, counter
const orderIdAsk = (price: Balance, counter: bigint): bigint => {
	return (price << FIRST_64) | counter;
};

/// Return order_id for bid order, given price, counter and side
const orderIdBid = (price: Balance, counter: bigint): bigint => {
	return ((price ^ BigInt(0xffff_ffff_ffff_ffff)) << FIRST_64) | counter;
};

// Return price of given `order_id`, (works for ask or bid)
export const price = (orderId: bigint, side: boolean): bigint => {
	if (side == ASK) return priceAsk(orderId);
	else return priceBid(orderId);
};

/// Returns price of a given ask `order_id`.
const priceAsk = (orderId: bigint): bigint => {
	return orderId >> FIRST_64;
};

/// Returns price of a given bid `order_id`.
const priceBid = (orderId: bigint): bigint => {
	return (orderId >> FIRST_64) ^ BigInt(0xffff_ffff_ffff_ffff);
};

export const counter = (orderId: bigint): bigint => {
	return orderId & BigInt(0x0000_0000_0000_0000_ffff_ffff_ffff_ffff);
};
