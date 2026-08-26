import {
	DynamicGas,
	installFetch,
	jest,
	requestBody,
	type Transaction,
} from "@test/general/fixtures/services.js";

describe("Caller-backed general services", () => {
	it("DynamicGas posts v2 JSON and the coin preference to its service prefix", async () => {
		const calls = installFetch({
			txBytes: "updated-tx",
			sponsoredSignature: "sig",
		});
		const tx = {
			toJSON: jest.fn(() => Promise.resolve("serialized-tx")),
		} as unknown as Transaction;
		const dynamicGas = new DynamicGas({ baseUrl: "https://sdk.test" });

		await expect(
			dynamicGas.getUseDynamicGasForTx({
				tx,
				walletAddress: "0xwallet",
				gasCoinType: "0x2::sui::SUI",
			})
		).resolves.toEqual({ txBytes: "updated-tx", sponsoredSignature: "sig" });

		expect(tx.toJSON).toHaveBeenCalledTimes(1);
		expect(calls[0]?.input).toBe("https://sdk.test/api/dynamic-gas");
		expect(requestBody(calls)).toEqual({
			serializedTx: "serialized-tx",
			walletAddress: "0xwallet",
			gasCoinType: "0x2::sui::SUI",
		});
	});
});
