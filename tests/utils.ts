import {
	Ed25519Keypair,
	getObjectId,
	JsonRpcProvider,
	ObjectId,
	RawSigner,
	Signer,
} from "@mysten/sui.js";
import { fromB64 } from "@mysten/bcs";
import PriorityQueue from "priority-queue-typescript";
import { PerpetualsOrderCasted } from "../src/types";
import { Aftermath, AftermathApi } from "../src/general/providers";

export const user1PrivateKey = "AFN+bYPrQaSnOtC0Jbo6C+EZQ8INYpcOfGvYEBLOv4La";
export const user2PrivateKey = "AHMEXsGDQDUrGA0Q9pyBbwZn7ZdwRQJ1N66AY8BuWcuA";
export const user3PrivateKey = "AOaWqbhk0ot+0mvHlmPixkNH1NbX+qc9QNGKHe5QD8hL";
export const user4PrivateKey = "AGc10rcDgxkE1USHaLoDrwvoObCRhMvl1agEb6a5ShVY";
export const adminPrivateKey = "AE6Ug8sqXgD7osbbb3SwrE7ELWbA825f47Le7BdeTB07";
export const ASK = true;
export const BID = false;
export const LOT_SIZE = BigInt(1000000);
export const TICK_SIZE = BigInt(1000);
export const ONE_B9 = BigInt(1_000_000_000); // 9 decimal places
export const ACCOUNT_ID = BigInt(0);
export const MARKET_ID_1 = BigInt(0);
export const MARKET_ID_2 = BigInt(1);

export const getSigner = (
	private_key: string,
	providerApi: AftermathApi
): RawSigner => {
	const decoded_array_buffer = fromB64(private_key); // UInt8Array
	const decoded_array = Array.from(decoded_array_buffer);
	decoded_array.shift(); // shift the scheme flag byte which should be 0 since it is ed25519
	const seed = Uint8Array.from(decoded_array);
	const keypair = Ed25519Keypair.fromSecretKey(seed);
	return new RawSigner(keypair, providerApi.provider);
};

export const fromOraclePriceToOrderbookPrice = (
	oracle_price: bigint,
	lot_size: bigint,
	tick_size: bigint
): bigint => {
	return oracle_price / tick_size / (ONE_B9 / lot_size);
};

export const checkPQ = (
	pq: PriorityQueue<PerpetualsOrderCasted>,
	side: boolean
): boolean => {
	if (side == ASK) return checkPQAsk(pq);
	else return checkPQBid(pq);
};

export const checkPQAsk = (
	pq: PriorityQueue<PerpetualsOrderCasted>
): boolean => {
	let currentOrder = pq.poll()!;
	while (pq.size() !== 0) {
		let nextOrder = pq.poll()!;
		if (currentOrder.price > nextOrder.price) return false;
		else if (
			currentOrder.counter > nextOrder.counter &&
			currentOrder.price === nextOrder.price
		)
			return false;
		currentOrder = nextOrder;
	}
	return true;
};

export const checkPQBid = (
	pq: PriorityQueue<PerpetualsOrderCasted>
): boolean => {
	let currentOrder = pq.poll()!;
	while (pq.size() !== 0) {
		let nextOrder = pq.poll()!;
		if (currentOrder.price < nextOrder.price) return false;
		else if (
			currentOrder.counter > nextOrder.counter &&
			currentOrder.price === nextOrder.price
		)
			return false;
		currentOrder = nextOrder;
	}
	return true;
};
