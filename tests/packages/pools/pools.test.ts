import {
	describe,
	expect,
	it,
	ONE_FIXED,
	Pools,
} from "@test/packages/pools/fixtures.js";

describe("Pools pure public helpers", () => {
	it("exposes stable protocol constants and fee arithmetic", () => {
		expect(Pools.constants.bounds.maxCoinsInPool).toBe(8);
		expect(Pools.constants.feePercentages.totalProtocol).toBe(0.000_05);
		expect(Pools.getAmountWithProtocolFees({ amount: 1_000_000n })).toBe(
			999_950n
		);
		expect(
			Pools.getAmountWithProtocolFees({
				amount: 1_000_000n,
				withReferral: true,
			})
		).toBe(999_951n);
		expect(Pools.getAmountWithProtocolFees({ amount: 0n })).toBe(0n);
		expect(Pools.getAmountWithoutProtocolFees({ amount: 999_950n })).toBe(
			1_000_000n
		);
		expect(
			Pools.getAmountWithoutProtocolFees({
				amount: 999_951n,
				withReferral: true,
			})
		).toBe(999_999n);
	});

	it("normalizes slippage and formats/checks LP coin types", () => {
		expect(Pools.normalizeInvertSlippage(0.01)).toBe(990_000_000_000_000_000n);
		expect(Pools.normalizeInvertSlippage(0)).toBe(ONE_FIXED);
		expect(Pools.normalizeInvertSlippage(0.5)).toBe(500_000_000_000_000_000n);
		expect(Pools.displayLpCoinType("0x1::af_lp::AF_LP_BTC_ETH")).toBe(
			"Btc Eth LP"
		);
		expect(
			Pools.isPossibleLpCoinType({ lpCoinType: "0x1::af_lp::AF_LP_BTC_ETH" })
		).toBe(true);
		expect(Pools.isPossibleLpCoinType({ lpCoinType: "0x2::sui::SUI" })).toBe(
			false
		);
		expect(Pools.isPossibleLpCoinType({ lpCoinType: "0x1::af_lp" })).toBe(
			false
		);
	});
});
