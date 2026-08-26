import { type PerpetualsOrderId, PerpetualsOrderSide } from "../../../types";
import { Perpetuals } from "..";

const MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);
const MASK_128 = (BigInt(1) << BigInt(128)) - BigInt(1);
const ASK_THRESHOLD = BigInt(1) << BigInt(127);

/**
 * Encodes and decodes perpetuals order IDs.
 *
 * An order ID stores a fixed-point price in the high bits and a counter in
 * the low bits. Ask IDs store the price directly. Bid IDs store the 64-bit
 * price complement, which lets {@link isAsk} distinguish the side from the
 * highest bit.
 */
export class PerpetualsOrderUtils {
	/**
	 * Encodes a fixed-point order price, counter, and side as an order ID.
	 *
	 * @param price - Fixed-point price integer, usually scaled by `1e9`.
	 * @param counter - Per-market order counter stored in the low bits.
	 * @param side - `PerpetualsOrderSide.Ask` or `PerpetualsOrderSide.Bid`.
	 * @returns The encoded order ID as a `bigint`.
	 */
	public static orderId = (
		price: bigint,
		counter: bigint,
		side: PerpetualsOrderSide
	): PerpetualsOrderId => {
		if (side) {
			return this.orderIdAsk(price, counter);
		}
		return this.orderIdBid(price, counter);
	};

	// Return order_id for ask order, given price, counter
	// (price << 64) | counter
	private static orderIdAsk = (
		price: bigint,
		counter: bigint
	): PerpetualsOrderId => {
		return (price << BigInt(64)) | counter;
	};

	// Return order_id for bid order, given price, counter and side
	// ((price ^ 0xffff_ffff_ffff_ffff) << 64) | counter
	private static orderIdBid = (
		price: bigint,
		counter: bigint
	): PerpetualsOrderId => {
		return ((price ^ MASK_64) << BigInt(64)) | counter;
	};

	/**
	 * Extracts the fixed-point price from an encoded order ID.
	 *
	 * @param orderId - Encoded perpetuals order ID.
	 * @returns The original fixed-point price integer as a `bigint`.
	 */
	public static price = (orderId: PerpetualsOrderId): bigint => {
		const side = Perpetuals.orderIdToSide(orderId);
		if (side === PerpetualsOrderSide.Ask) {
			return this.priceAsk(orderId);
		}
		return this.priceBid(orderId);
	};

	// Returns price of a given ask `order_id`.
	private static priceAsk = (orderId: PerpetualsOrderId): bigint => {
		return orderId >> BigInt(64);
	};

	// Returns price of a given bid `order_id`.
	private static priceBid = (orderId: PerpetualsOrderId): bigint => {
		return (orderId >> BigInt(64)) ^ MASK_64;
	};

	/**
	 * Extracts the low-bit counter from an encoded order ID.
	 *
	 * @param orderId - Encoded perpetuals order ID.
	 * @returns The counter portion as a `bigint`.
	 */
	public static counter = (orderId: PerpetualsOrderId): bigint => {
		return orderId & MASK_128;
	};

	/**
	 * Determines whether an encoded order ID represents an ask order.
	 *
	 * @param orderId - Encoded perpetuals order ID.
	 * @returns `true` when the ID is below the protocol's `2^127` ask threshold.
	 */
	public static isAsk = (orderId: PerpetualsOrderId): boolean => {
		return orderId < ASK_THRESHOLD;
	};
}
