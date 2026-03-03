import { type PerpetualsOrderId, PerpetualsOrderSide } from "../../../types";
import { Perpetuals } from "..";

const MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);
const MASK_128 = (BigInt(1) << BigInt(128)) - BigInt(1);
const ASK_THRESHOLD = BigInt(1) << BigInt(127);

export class PerpetualsOrderUtils {
  // Return order_id given price, counter and side
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

  // Return price of given `order_id`, (works for ask or bid)
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

  public static counter = (orderId: PerpetualsOrderId): bigint => {
    return orderId & MASK_128;
  };

  public static isAsk = (orderId: PerpetualsOrderId): boolean => {
    return orderId < ASK_THRESHOLD;
  };
}
