import {
	AMM,
	describe,
	EVENTS,
	type EventOnChain,
	expect,
	it,
	LP,
	ONE_FIXED,
	POOL_ID,
	PoolsApiCasting,
	type SuiObjectView,
	WALLET,
} from "@test/packages/pools/fixtures.js";

describe("PoolsApiCasting", () => {
	function event<Fields>(parsedJson: Fields): EventOnChain<Fields> {
		return {
			id: { txDigest: "digest", eventSeq: "0" },
			packageId: EVENTS,
			transactionModule: "events",
			sender: WALLET,
			type: `${EVENTS}::events::Event`,
			parsedJson,
			bcs: "",
			timestampMs: "1700000000000",
		};
	}

	it("casts a gRPC-shaped pool without losing bigint precision or decimals", () => {
		const view = {
			objectId: POOL_ID,
			type: `${AMM}::pool::Pool<${LP.slice(2)}>`,
			json: {
				coin_decimals: "AQI=",
				creator: WALLET,
				decimal_scalars: [ONE_FIXED.toString(), ONE_FIXED.toString()],
				fees_deposit: ["0", "0"],
				fees_swap_in: ["1", "2"],
				fees_swap_out: ["3", "4"],
				fees_withdraw: ["5", "6"],
				flatness: "0",
				id: POOL_ID,
				illiquid_lp_supply: "7",
				lp_decimals: 9,
				lp_supply: { value: "9007199254740993" },
				name: "casted",
				normalized_balances: ["1000000000000000000", "2000000000000000000"],
				type_names: ["1::coin::A", "2::coin::B"],
				weights: ["500000000000000000", "500000000000000000"],
			},
		} as unknown as SuiObjectView;
		const result = PoolsApiCasting.poolObjectFromSuiObject(view);
		expect(result.lpCoinType).toBe(`0x${"0".repeat(63)}3::af_lp::AF_LP_A_B`);
		expect(result.lpCoinSupply).toBe(9007199254740993n);
		expect(result.illiquidLpCoinSupply).toBe(7n);
		expect(Object.values(result.coins).map((coin) => coin.decimals)).toEqual([
			1, 2,
		]);
		expect(Object.values(result.coins).map((coin) => coin.balance)).toEqual([
			1n,
			2n,
		]);
		expect(Object.values(result.coins)[0]?.normalizedBalance).toBe(
			1_000_000_000_000_000_000n
		);
	});

	it("casts owner caps and all pool event variants, including large amounts", () => {
		const cap = PoolsApiCasting.daoFeePoolOwnerCapObjectFromSuiObjectResponse({
			objectId: "0x42",
			type: `${EVENTS}::pool::OwnerCap`,
			json: { dao_fee_pool_id: "0x43" },
		} as unknown as SuiObjectView);
		expect(cap).toEqual({
			objectId: `0x${"0".repeat(62)}42`,
			objectType: `${EVENTS}::pool::OwnerCap`,
			daoFeePoolId: `0x${"0".repeat(62)}43`,
		});

		const trade = PoolsApiCasting.poolTradeEventFromOnChain(
			event({
				pool_id: POOL_ID,
				issuer: WALLET,
				types_in: ["1::coin::A"],
				amounts_in: ["18446744073709551615"],
				types_out: ["2::coin::B"],
				amounts_out: ["9"],
			}) as never
		);
		expect(trade).toMatchObject({
			poolId: POOL_ID,
			trader: WALLET,
			amountsIn: [18_446_744_073_709_551_615n],
			amountsOut: [9n],
			timestamp: 1_700_000_000_000,
			txnDigest: "digest",
		});
		expect(trade.typesIn[0]).toBe(`0x${"0".repeat(63)}1::coin::A`);

		const deposit = PoolsApiCasting.poolDepositEventFromOnChain(
			event({
				pool_id: POOL_ID,
				issuer: WALLET,
				types: ["1::coin::A"],
				deposits: ["10"],
				lp_coins_minted: "11",
			}) as never
		);
		expect(deposit).toMatchObject({
			poolId: POOL_ID,
			depositor: WALLET,
			deposits: [10n],
			lpMinted: 11n,
		});

		const withdraw = PoolsApiCasting.poolWithdrawEventFromOnChain(
			event({
				pool_id: POOL_ID,
				issuer: WALLET,
				types: ["2::coin::B"],
				withdrawn: ["12"],
				lp_coins_burned: "13",
			}) as never
		);
		expect(withdraw).toMatchObject({
			poolId: POOL_ID,
			withdrawer: WALLET,
			withdrawn: [12n],
			lpBurned: 13n,
		});
		const created = PoolsApiCasting.poolObjectIdfromPoolCreateEventOnChain(
			event({ pool_id: POOL_ID }) as never
		);
		expect(created).toBe(POOL_ID);
	});

	it("keeps the current undefined timestamp edge explicit", () => {
		const input = event({
			pool_id: POOL_ID,
			issuer: WALLET,
			types_in: [],
			amounts_in: [],
			types_out: [],
			amounts_out: [],
		});
		input.timestampMs = undefined;
		const result = PoolsApiCasting.poolTradeEventFromOnChain(input);
		expect(Number.isNaN(result.timestamp)).toBe(true);
	});
});
