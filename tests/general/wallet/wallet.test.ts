import {
	installFetch,
	requestBody,
	Wallet,
} from "@test/general/fixtures/services.js";

describe("Caller-backed general services", () => {
	it("Wallet sends the wallet address on balance and history requests and preserves bigint precision", async () => {
		const wallet = new Wallet("0xwallet", { baseUrl: "https://sdk.test" });

		const balancesCalls = installFetch(["1000000000000000001n", "2n"]);
		await expect(
			wallet.getBalances({
				coins: ["0x2::sui::SUI", "0xabc::coin::COIN"],
			})
		).resolves.toEqual([1000000000000000001n, 2n]);
		expect(balancesCalls[0]?.input).toBe(
			"https://sdk.test/api/wallet/coin-balances"
		);
		expect(requestBody(balancesCalls)).toEqual({
			coins: ["0x2::sui::SUI", "0xabc::coin::COIN"],
			walletAddress: "0xwallet",
		});

		const allBalancesCalls = installFetch({
			"0x2::sui::SUI": "9007199254740993123n",
		});
		await expect(wallet.getAllBalances()).resolves.toEqual({
			"0x2::sui::SUI": 9007199254740993123n,
		});
		expect(allBalancesCalls[0]?.input).toBe(
			"https://sdk.test/api/wallet/all-coin-balances"
		);
		expect(requestBody(allBalancesCalls)).toEqual({
			walletAddress: "0xwallet",
		});

		const history = {
			transactions: [{ digest: "tx-1", balanceChanges: [] }],
			nextCursor: "tx-cursor-2",
		};
		const historyCalls = installFetch(history);
		await expect(
			wallet.getPastTransactions({ cursor: "tx-cursor-1", limit: 17 })
		).resolves.toEqual(history);
		expect(historyCalls[0]?.input).toBe(
			"https://sdk.test/api/wallet/past-transactions"
		);
		expect(requestBody(historyCalls)).toEqual({
			cursor: "tx-cursor-1",
			limit: 17,
			walletAddress: "0xwallet",
		});
	});

	it("Wallet single-balance lookup returns the first requested balance", async () => {
		const calls = installFetch(["42n"]);
		const wallet = new Wallet("0xwallet", { baseUrl: "https://sdk.test" });

		await expect(wallet.getBalance({ coin: "0x2::sui::SUI" })).resolves.toBe(
			42n
		);
		expect(requestBody(calls)).toEqual({
			coins: ["0x2::sui::SUI"],
			walletAddress: "0xwallet",
		});
	});
});
