import {
	type AftermathApiType,
	jest,
	makeApi,
	OWNER,
	WalletApi,
} from "@test/general/fixtures/services.js";

describe("WalletApi", () => {
	it("normalizes coin types and returns exact bigint balances", async () => {
		const getBalance = jest
			.fn()
			.mockResolvedValue({ balance: { balance: "9007199254740993123" } });
		const api = makeApi({ getBalance });

		await expect(
			new WalletApi(api).fetchCoinBalance({
				walletAddress: OWNER,
				coin: "0x2::sui::SUI",
			})
		).resolves.toBe(9007199254740993123n);
		expect(getBalance).toHaveBeenCalledWith({
			owner: OWNER,
			coinType: "0x2::sui::SUI",
		});
	});

	it("pages all coin balances and normalizes returned coin keys", async () => {
		const listBalances = jest
			.fn()
			.mockResolvedValueOnce({
				balances: [{ coinType: "0x2::sui::SUI", balance: "1000000000" }],
				cursor: "balance-cursor",
				hasNextPage: true,
			})
			.mockResolvedValueOnce({
				balances: [{ coinType: "0xabc::coin::COIN", balance: "7" }],
				cursor: null,
				hasNextPage: false,
			});
		const api = makeApi({ listBalances });

		await expect(
			new WalletApi(api).fetchAllCoinBalances({ walletAddress: OWNER })
		).resolves.toEqual({
			"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI":
				1000000000n,
			"0x0000000000000000000000000000000000000000000000000000000000000abc::coin::COIN":
				7n,
		});
		expect(listBalances).toHaveBeenNthCalledWith(1, {
			owner: OWNER,
			cursor: undefined,
		});
		expect(listBalances).toHaveBeenNthCalledWith(2, {
			owner: OWNER,
			cursor: "balance-cursor",
		});
	});

	it("routes wallet transaction history through Transactions with the wallet filter", async () => {
		const fetchTransactionsWithCursor = jest.fn().mockResolvedValue({
			transactions: [{ digest: "tx-1" }],
			nextCursor: null,
		});
		const api = {
			Transactions: () => ({ fetchTransactionsWithCursor }),
		} as unknown as AftermathApiType;

		await expect(
			new WalletApi(api).fetchPastTransactions({
				walletAddress: OWNER,
				cursor: "cursor-1",
				limit: 8,
			})
		).resolves.toEqual({
			transactions: [{ digest: "tx-1" }],
			nextCursor: null,
		});
		expect(fetchTransactionsWithCursor).toHaveBeenCalledWith({
			query: { filter: { FromAddress: OWNER } },
			cursor: "cursor-1",
			limit: 8,
		});
	});
});
