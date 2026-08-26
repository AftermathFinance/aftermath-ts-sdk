/**
 * The dynamic gas service requires the v2 JSON shape (`gasData`, `commands`)
 * and rejects the v1 `blockData` shape (`gasConfig`, `transactions`) that the
 * deprecated `Transaction.serialize()` emits.
 *
 * This is per-endpoint, not global: `Router.addTransactionForCompleteTradeRoute`
 * still sends v1, because the service behind it still reads that shape.
 *
 * ## Running
 *
 * ```sh
 * bun test tests/serializedTxFormat.test.ts
 * ```
 */

import { Transaction } from "@mysten/sui/transactions";
import { DynamicGas } from "../src/general/dynamicGas/dynamicGas";

const SENDER =
	"0x0000000000000000000000000000000000000000000000000000000000000abc";

const buildTx = (): Transaction => {
	const tx = new Transaction();
	tx.setSender(SENDER);
	tx.setGasBudget(BigInt(50_000_000));
	const coin = tx.splitCoins(tx.gas, [BigInt(1000)]);
	tx.transferObjects([coin], SENDER);
	return tx;
};

/**
 * Captures the body handed to `fetchApi` instead of making a request. Callers
 * that re-parse the response get `response`, which must therefore be a real
 * serialized transaction.
 */
const captureBody = (
	caller: object,
	response: unknown = {}
): (() => Record<string, unknown>) => {
	let captured: Record<string, unknown> = {};
	(caller as { fetchApi: unknown }).fetchApi = (
		_route: string,
		body: Record<string, unknown>
	) => {
		captured = body;
		return Promise.resolve(response);
	};
	return () => captured;
};

const expectV2 = (serializedTx: unknown) => {
	expect(typeof serializedTx).toBe("string");
	const json = JSON.parse(serializedTx as string);
	expect(Object.keys(json)).toContain("gasData");
	expect(Object.keys(json)).toContain("commands");
	// The v1 shape names these `gasConfig` / `transactions`.
	expect(Object.keys(json)).not.toContain("gasConfig");
	expect(Object.keys(json)).not.toContain("transactions");
};

describe("DynamicGas.getUseDynamicGasForTx", () => {
	it("sends the transaction as v2 JSON", async () => {
		const dynamicGas = new DynamicGas();
		const body = captureBody(dynamicGas);

		await dynamicGas.getUseDynamicGasForTx({
			tx: buildTx(),
			walletAddress: SENDER,
			gasCoinType: "0x2::sui::SUI",
		});

		expectV2(body().serializedTx);
	});
});
