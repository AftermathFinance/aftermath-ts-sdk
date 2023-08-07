import {
	Ed25519Keypair,
	RawSigner,
} from "@mysten/sui.js";
import { fromB64 } from "@mysten/bcs";
import PriorityQueue from "priority-queue-typescript";
import { OrderCasted } from "../src/types";
import { AftermathApi } from "../src/general/providers";

export const adminPrivateKey = "AFHMjegm2IwuiLemXb6o7XvuDL7xn1JTHc66CZefYY+B";
export const user1PrivateKey = "AOzplQlAK2Uznvog7xmcMtlFC+DfuJx3axo9lfyI876G";
export const user2PrivateKey = "AI1I9i3mk2e1kAjPnB7fKiqquxc1OjjAkkpQPIk9Id5Q";
export const user3PrivateKey = "AIUAgL5jYMzf0JPCmc263Ou6tH5Z/HuAdtWFFUiz8Zc0";
export const user4PrivateKey = "AAu4ySMvq2wygxl/Ze6AGgkYfxg+rzUElj7UxxI6NHBI";
export const ASK = true;
export const BID = false;
export const LOT_SIZE = BigInt(1000000);
export const TICK_SIZE = BigInt(1000);
export const ONE_B9 = BigInt(1_000_000_000); // 9 decimal places
export const ONE_F18 = BigInt(1_000_000_000_000_000_000); // 18 decimal places
export const MARKET_ID0 = BigInt(0);
export const MARKET_ID1 = BigInt(1);

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
	oracle_price = oracle_price / ONE_B9; // convert f18 to b9 (assuming the former is positive)
	return oracle_price / tick_size / (ONE_B9 / lot_size);
};

export const checkPQ = (
	pq: PriorityQueue<OrderCasted>,
	side: boolean
): boolean => {
	if (side == ASK) return checkPQAsk(pq);
	else return checkPQBid(pq);
};

export const checkPQAsk = (
	pq: PriorityQueue<OrderCasted>
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
	pq: PriorityQueue<OrderCasted>
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
