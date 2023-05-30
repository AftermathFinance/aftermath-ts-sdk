import { PerpetualsOrderCasted } from "../../../types";

export const compareBidOrders = (
	insertedOrder: PerpetualsOrderCasted,
	comparableOrder: PerpetualsOrderCasted
): number => {
	if (insertedOrder.price < comparableOrder.price) return 1;
	else if (insertedOrder.price > comparableOrder.price) return -1;
	else if (insertedOrder.counter > comparableOrder.counter) return 1;
	else return -1;
};

export const compareAskOrders = (
	insertedOrder: PerpetualsOrderCasted,
	comparableOrder: PerpetualsOrderCasted
): number => {
	if (insertedOrder.price > comparableOrder.price) return 1;
	else if (insertedOrder.price < comparableOrder.price) return -1;
	else if (insertedOrder.counter > comparableOrder.counter) return 1;
	else return -1;
};
