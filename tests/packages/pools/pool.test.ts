import {
	A,
	B,
	type CoinType,
	describe,
	expect,
	installFetch,
	it,
	LP,
	makeAddresses,
	makePool,
	makeProvider,
	ONE_FIXED,
	POOL_ID,
	Pool,
	requestUrl,
	statsFixture,
	WALLET,
} from "@test/packages/pools/fixtures.js";

describe("Pool HTTP, calculations, getters, and delegation", () => {
	it("fetches scoped analytics/events, caches stats, and paginates", async () => {
		const pool = new Pool(makePool(), { baseUrl: "https://sdk.test" });
		let calls = installFetch(statsFixture);
		const returnedStats = await pool.getStats();
		expect(returnedStats).toEqual(statsFixture);
		expect(pool.stats).toBe(returnedStats);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools/0x5/stats");

		const points = [{ time: 1_700_000_000_000, value: 12.5 }];
		calls = installFetch(points);
		await expect(pool.getVolumeData({ timeframe: "1D" })).resolves.toEqual(
			points
		);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/0x5/volume/1D"
		);

		calls = installFetch(points);
		await expect(pool.getFeeData({ timeframe: "1M" })).resolves.toEqual(points);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/0x5/fees/1M"
		);

		calls = installFetch(12.5);
		await expect(pool.getVolume24hrs()).resolves.toBe(12.5);

		const event = { poolId: POOL_ID, depositor: WALLET, lpMinted: 5n };
		calls = installFetch([event, event]);
		await expect(
			pool.getInteractionEvents({ walletAddress: WALLET, cursor: 2, limit: 2 })
		).resolves.toEqual({ events: [event, event], nextCursor: 4 });
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/0x5/interaction-events-by-user"
		);
	});

	it("returns sorted coin views and DAO metadata", () => {
		const noDaoPool = new Pool(makePool());
		expect(noDaoPool.coins()).toEqual([A, B]);
		expect(noDaoPool.poolCoins().map((coin) => coin.balance)).toEqual([
			1_000_000n,
			1_000_000n,
		]);
		expect(noDaoPool.poolCoinEntries().map(([type]) => type)).toEqual([A, B]);
		expect(noDaoPool.daoFeePercentage()).toBeUndefined();
		expect(noDaoPool.daoFeeRecipient()).toBeUndefined();

		const daoPool = new Pool(makePool({ daoFee: true }));
		expect(daoPool.daoFeePercentage()).toBe(0.01);
		expect(daoPool.daoFeeRecipient()).toBe("0x7");
		daoPool.setStats(statsFixture);
		expect(daoPool.stats).toBe(statsFixture);
	});

	it("applies decimal scaling and guards unsafe trade sizes", () => {
		const pool = new Pool(
			makePool({
				coinA: { tradeFeeIn: 10_000_000_000_000_000n },
			})
		);
		expect(pool.getSpotPrice({ coinInType: A, coinOutType: B })).toBeCloseTo(
			1,
			12
		);
		expect(
			pool.getTradeAmountOut({
				coinInType: A,
				coinInAmount: 10_000n,
				coinOutType: B,
			})
		).toBeGreaterThan(0n);
		expect(
			pool.getTradeAmountIn({
				coinInType: A,
				coinOutAmount: 10_000n,
				coinOutType: B,
			})
		).toBeGreaterThan(0n);

		expect(() =>
			pool.getTradeAmountOut({
				coinInType: A,
				coinInAmount: 300_000n,
				coinOutType: B,
			})
		).toThrow("coinInAmountWithFees / coinInPoolBalance");
		expect(() =>
			pool.getTradeAmountIn({
				coinInType: A,
				coinOutAmount: 300_000n,
				coinOutType: B,
			})
		).toThrow("coinOutAmount / coinOutPoolBalance");

		const disabled = new Pool(makePool({ coinA: { tradeFeeIn: ONE_FIXED } }));
		expect(() =>
			disabled.getTradeAmountOut({
				coinInType: A,
				coinInAmount: 1n,
				coinOutType: B,
			})
		).toThrow("coinOutAmount <= 0");
	});

	it("calculates withdrawals, LP ratios, and DAO-fee floors", () => {
		const pool = new Pool(makePool({ daoFee: true }));
		expect(pool.getAllCoinWithdrawLpRatio({ lpCoinAmountIn: 100_000n })).toBe(
			0.1
		);
		expect(pool.getMultiCoinWithdrawLpRatio({ lpCoinAmountIn: 100_000n })).toBe(
			0.9
		);
		expect(pool.getAllCoinWithdrawAmountsOut({ lpRatio: 0.1 })).toEqual({
			[A]: 99_000n,
			[B]: 99_000n,
		});
		expect(() => pool.getAllCoinWithdrawAmountsOut({ lpRatio: 1 })).toThrow(
			"lpRatio >= 1"
		);

		const paddedA = `0x${"0".repeat(63)}1` as CoinType;
		const paddedB = `0x${"0".repeat(63)}2` as CoinType;
		const paddedPool = makePool({ daoFee: true });
		paddedPool.coins = {
			[paddedA]: paddedPool.coins[A]!,
			[paddedB]: paddedPool.coins[B]!,
		};
		const padded = new Pool(paddedPool);
		const simple = padded.getWithdrawAmountsOutSimple({
			lpCoinAmountIn: 10_000n,
			coinTypesOut: [paddedA],
		});
		expect(simple[paddedA]).toBeGreaterThan(0n);
		expect(Object.keys(simple)).toEqual([paddedA, paddedB]);

		const deposit = pool.getDepositLpAmountOut({
			amountsIn: { [A]: 10_000n, [B]: 10_000n },
		});
		expect(deposit.lpRatio).toBeGreaterThan(0);
		expect(deposit.lpRatio).toBeLessThan(1);
		expect(deposit.lpAmountOut).toBeGreaterThan(0n);
	});

	it("delegates transaction requests with the Pool instance and preserves errors", async () => {
		const calls: Array<{ method: string; input: Record<string, unknown> }> = [];
		const mockPoolsApi = {
			fetchBuildDepositTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "deposit", input });
				return "deposit-tx";
			},
			fetchBuildWithdrawTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "withdraw", input });
				return "withdraw-tx";
			},
			fetchBuildAllCoinWithdrawTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "all", input });
				return "all-tx";
			},
			fetchBuildTradeTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "trade", input });
				return "trade-tx";
			},
			buildDaoFeePoolUpdateFeeBpsTx: (input: Record<string, unknown>) => {
				calls.push({ method: "fee-bps", input });
				return "fee-bps-tx";
			},
			buildDaoFeePoolUpdateFeeRecipientTx: (input: Record<string, unknown>) => {
				calls.push({ method: "fee-recipient", input });
				return "fee-recipient-tx";
			},
		};
		const provider = makeProvider(makeAddresses(), {
			Pools: () => mockPoolsApi,
		});
		const pool = new Pool(makePool({ daoFee: true }), {}, provider);

		await pool.getDepositTransaction({
			walletAddress: WALLET,
			amountsIn: { [A]: 1n },
			slippage: 0.01,
		});
		await pool.getWithdrawTransaction({
			walletAddress: WALLET,
			amountsOutDirection: { [A]: 1n },
			lpCoinAmount: 2n,
			slippage: 0.02,
		});
		await pool.getAllCoinWithdrawTransaction({
			walletAddress: WALLET,
			lpCoinAmount: 3n,
		});
		await pool.getTradeTransaction({
			walletAddress: WALLET,
			coinInType: A,
			coinInAmount: 4n,
			coinOutType: B,
			slippage: 0.03,
			referrer: "0x8",
		});
		await pool.getUpdateDaoFeeTransaction({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x9",
			newFeePercentage: 0.01,
		});
		await pool.getUpdateDaoFeeRecipientTransaction({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x9",
			newFeeRecipient: "0x8",
		});

		expect(calls.map(({ method }) => method)).toEqual([
			"deposit",
			"withdraw",
			"all",
			"trade",
			"fee-bps",
			"fee-recipient",
		]);
		expect(calls[0]?.input.pool).toBe(pool);
		expect(calls[4]?.input).toMatchObject({
			daoFeePoolId: "0x6",
			lpCoinType: LP,
			newFeeBps: 100n,
		});
		expect(calls[5]?.input.newFeeRecipient).toBe(`0x${"0".repeat(63)}8`);

		const missingApi = new Pool(makePool());
		await expect(
			missingApi.getTradeTransaction({
				walletAddress: WALLET,
				coinInType: A,
				coinInAmount: 1n,
				coinOutType: B,
				slippage: 0.01,
			})
		).rejects.toThrow("missing AftermathApi instance");
		await expect(
			new Pool(makePool()).getUpdateDaoFeeTransaction({
				walletAddress: WALLET,
				daoFeePoolOwnerCapId: "0x9",
				newFeePercentage: 0.01,
			})
		).rejects.toThrow("this pool has no DAO fee");
	});
});
