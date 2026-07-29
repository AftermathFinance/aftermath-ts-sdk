/**
 * Characterization tests for the object-content casters (plan 251).
 *
 * Every one of these casters reads `Helpers.getObjectFields`, which returns
 * `Record<string, any>`. **The compiler cannot see a single field-read mistake
 * in them.** A missed `unwrapStructField` / `bytesFieldToNumbers` / `unwrapUid`
 * produces `undefined` or `NaN` in a domain object, not a build failure. These
 * fixtures are the only guard, so they assert the *whole* output object rather
 * than spot-checking fields.
 *
 * The fixtures are real mainnet objects captured by `tests/fixtures/capture.mjs`
 * in both protocols' shapes. Each caster is driven **twice** — once from the
 * gRPC `json` view (what the SDK reads now) and once from JSON-RPC's
 * `content.fields` (what it read before) — and both must produce the identical
 * domain object. That is a direct proof the port is behaviour-preserving, and
 * it is also what makes the field-shape primitives' totality load-bearing.
 *
 * ## Running
 *
 * ```sh
 * bun test tests/objectCasters.test.ts
 * ```
 *
 * `bun run test` (jest) cannot execute these — see the header of
 * `tests/grpcMigration.test.ts`.
 */

import poolGrpc from "./fixtures/objects/pool.grpc.json";
import poolJsonRpc from "./fixtures/objects/pool.jsonrpc.json";
import vaultStateGrpc from "./fixtures/objects/stakedSuiVaultState.grpc.json";
import vaultStateJsonRpc from "./fixtures/objects/stakedSuiVaultState.jsonrpc.json";
import { Casting, type SuiObjectView } from "../src";

// =============================================================================
//  Fixture plumbing
// =============================================================================

/** A captured `.grpc.json` fixture, as the casters now receive it. */
const grpcView = (fixture: unknown): SuiObjectView =>
	fixture as unknown as SuiObjectView;

/**
 * Presents a captured `.jsonrpc.json` fixture through the gRPC object view,
 * **keeping JSON-RPC's field shapes** (`{ type, fields }` envelopes, number
 * arrays for `vector<u8>`, nested `UID`s).
 *
 * This is what makes each caster's pair of tests meaningful: the caster is fed
 * the *old* field shapes through the *new* container, and must produce the
 * identical domain object. A missing `unwrapStructField` /
 * `bytesFieldToNumbers` / `unwrapUid` breaks one of the two, so neither test can
 * pass vacuously — and it proves the port is behaviour-preserving rather than
 * merely internally consistent.
 */
const jsonRpcAsView = (fixture: unknown): SuiObjectView => {
	const data = (fixture as { data: Record<string, any> }).data;
	return {
		objectId: data.objectId,
		version: data.version,
		digest: data.digest,
		owner: data.owner,
		type: data.type,
		json: data.content?.fields ?? null,
		display: data.display
			? { output: data.display.data ?? null, errors: null }
			: null,
	} as unknown as SuiObjectView;
};

// =============================================================================
//  Pools
// =============================================================================

const expectedPool = {
	objectType:
		"0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c::pool::Pool<46557efacefd91391c44bce37ffd8b78aa485353c5f4515771c2bc254c24c1af::af_lp::AF_LP>",
	objectId:
		"0x0235f7d73eb5974bf9cbf518763d60893f0942a7f0deb76fb30eae9147926c48",
	lpCoinType:
		"0x46557efacefd91391c44bce37ffd8b78aa485353c5f4515771c2bc254c24c1af::af_lp::AF_LP",
	name: "KINGCOBRA_NOTBAT",
	creator: "0xb2ca950477950c78494624d3d0af81272b08dcbe27bc0d9abb605b9c7e070bbe",
	lpCoinSupply: 100_000_009_899_506_000n,
	illiquidLpCoinSupply: 1000n,
	flatness: 0n,
	lpCoinDecimals: 9,
	coins: {
		"0xd1fc206d1fdd71c6da714ec8be4fd10a0896b95be2f2af36a9d4e2dcb8492a29::kingcobra::KINGCOBRA":
			{
				weight: 500_000_000_000_000_000n,
				balance: 16_090_948_578_616_763n,
				tradeFeeIn: 10_000_000_000_000_000n,
				tradeFeeOut: 0n,
				depositFee: 0n,
				withdrawFee: 0n,
				normalizedBalance: 16_090_948_578_616_763_000_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
				decimals: 9,
			},
		"0xf9433456cb60bbc276e8790b643ed24fec9f128fc2486926b7d1afbf83c04b60::notbat::NOTBAT":
			{
				weight: 500_000_000_000_000_000n,
				balance: 624_222_584_743_764_199n,
				tradeFeeIn: 10_000_000_000_000_000n,
				tradeFeeOut: 0n,
				depositFee: 0n,
				withdrawFee: 0n,
				normalizedBalance: 624_222_584_743_764_199_000_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
				decimals: 9,
			},
	},
};

describe("PoolsApiCasting.poolObjectFromSuiObject", () => {
	it("casts the gRPC json view", () => {
		expect(
			Casting.pools.poolObjectFromSuiObject(grpcView(poolGrpc))
		).toEqual(expectedPool);
	});

	it("casts JSON-RPC's field shapes to the identical object", () => {
		expect(
			Casting.pools.poolObjectFromSuiObject(jsonRpcAsView(poolJsonRpc))
		).toEqual(expectedPool);
	});

	it("resolves `lpCoinType` to the `Pool<L>` type argument", () => {
		// gRPC drops the nested `Supply<L>` struct's `type`, which is where this
		// used to come from. `L` is recoverable from the pool's own type.
		const pool = Casting.pools.poolObjectFromSuiObject(grpcView(poolGrpc));
		expect(pool.lpCoinType).toBe(expectedPool.lpCoinType);
		expect(poolGrpc.type).toContain(pool.lpCoinType);
		// The old source of truth is genuinely absent from the gRPC fixture, so
		// this cannot be passing by still reading it.
		expect(
			(poolGrpc.json as Record<string, any>).lp_supply.type
		).toBeUndefined();
	});

	it("yields real numbers for `decimals`, never NaN", () => {
		// gRPC base64-encodes `coin_decimals` ("CQk="), so indexing it without
		// decoding gives Number("C") === NaN — silently, with no throw.
		const pool = Casting.pools.poolObjectFromSuiObject(grpcView(poolGrpc));
		const decimals = Object.values(pool.coins).map((c) => c.decimals);
		expect(decimals).toEqual([9, 9]);
		for (const d of decimals) {
			expect(Number.isNaN(d)).toBe(false);
			expect(Number.isInteger(d)).toBe(true);
		}
	});

	it("reads `lp_supply` out of its struct envelope without losing precision", () => {
		const pool = Casting.pools.poolObjectFromSuiObject(grpcView(poolGrpc));
		expect(pool.lpCoinSupply).toBe(100_000_009_899_506_000n);
		// A u64 that survived as a string; had gRPC returned a JSON number this
		// would have been rounded.
		expect(
			Object.values(pool.coins).map((c) => c.normalizedBalance)
		).toEqual([
			16_090_948_578_616_763_000_000_000_000_000_000n,
			624_222_584_743_764_199_000_000_000_000_000_000n,
		]);
	});
});

// =============================================================================
//  Staking
// =============================================================================

const expectedVaultState = {
	objectId:
		"0x55486449e41d89cfbdb20e005c1c5c1007858ad5b4d5d7c047d2b3b592fe8791",
	objectType:
		"0x7f6ce7ade63857c4fd16ef7783fed2dfc4d7fb7e40615abdb653030b76aef0c6::staked_sui_vault_state::StakedSuiVaultStateV1",
	atomicUnstakeSuiReservesTargetValue: 10_000_000_000_000n,
	atomicUnstakeSuiReserves: 1_024_602_126_415n,
	minAtomicUnstakeFee: 1_000_000_000_000_000n,
	maxAtomicUnstakeFee: 10_000_000_000_000_000n,
	totalSuiAmount: 3_181_263_324_106_625n,
	totalRewardsAmount: 202_307_393_509_923n,
	activeEpoch: 1203n,
};

describe("StakingApiCasting.stakedSuiVaultStateObjectFromSuiObjectResponse", () => {
	it("casts the gRPC json view", () => {
		expect(
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				grpcView(vaultStateGrpc)
			)
		).toEqual(expectedVaultState);
	});

	it("casts JSON-RPC's field shapes to the identical object", () => {
		expect(
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				jsonRpcAsView(vaultStateJsonRpc)
			)
		).toEqual(expectedVaultState);
	});

	it("reads the doubly-nested `atomic_unstake_protocol_fee` values", () => {
		// The deepest read in the SDK:
		// protocol_config -> atomic_unstake_protocol_fee -> min_fee/max_fee.
		// Under JSON-RPC that is two `.fields` hops; under gRPC it is none.
		const state =
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				grpcView(vaultStateGrpc)
			);
		expect(state.minAtomicUnstakeFee).toBe(1_000_000_000_000_000n);
		expect(state.maxAtomicUnstakeFee).toBe(10_000_000_000_000_000n);
		// Both fixtures must actually carry them at their respective depths, or
		// these assertions would be vacuous.
		expect(
			(vaultStateGrpc.json as Record<string, any>).protocol_config
				.atomic_unstake_protocol_fee.min_fee
		).toBe("1000000000000000");
		expect(
			(vaultStateJsonRpc as Record<string, any>).data.content.fields
				.protocol_config.fields.atomic_unstake_protocol_fee.fields.min_fee
		).toBe("1000000000000000");
		// …and the gRPC fixture must NOT have the JSON-RPC envelope, so a caster
		// that still read `.fields` could not pass.
		expect(
			(vaultStateGrpc.json as Record<string, any>).protocol_config.fields
		).toBeUndefined();
	});

	it("reads the singly-nested `protocol_config` values", () => {
		const state =
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				grpcView(vaultStateGrpc)
			);
		expect(state.atomicUnstakeSuiReservesTargetValue).toBe(10_000_000_000_000n);
	});
});

// =============================================================================
//  Fixture sanity — the three shape differences are actually present
// =============================================================================

describe("fixtures exhibit the shape differences the port must absorb", () => {
	it("T1: nested structs lose `type`/`fields` under gRPC", () => {
		const grpcSupply = (poolGrpc.json as Record<string, any>).lp_supply;
		const jsonSupply = (poolJsonRpc as Record<string, any>).data.content.fields
			.lp_supply;
		expect(grpcSupply).toEqual({ value: "100000009899506000" });
		expect(jsonSupply.fields).toEqual({ value: "100000009899506000" });
		expect(jsonSupply.type).toContain("0x2::balance::Supply<");
		expect(grpcSupply.type).toBeUndefined();
	});

	it("T2: `vector<u8>` is base64 under gRPC and a number array under JSON-RPC", () => {
		expect((poolGrpc.json as Record<string, any>).coin_decimals).toBe("CQk=");
		expect(
			(poolJsonRpc as Record<string, any>).data.content.fields.coin_decimals
		).toEqual([9, 9]);
	});

	it("T3: `UID` flattens to a bare string under gRPC", () => {
		expect(typeof (poolGrpc.json as Record<string, any>).id).toBe("string");
		expect(
			typeof (poolJsonRpc as Record<string, any>).data.content.fields.id
		).toBe("object");
	});

	it("u64 stays a decimal string on both protocols", () => {
		// If this ever fails, precision above 2^53 is at risk and every
		// `BigInt(...)` in the casters needs re-examining.
		const grpcBalances = (poolGrpc.json as Record<string, any>)
			.normalized_balances;
		const jsonBalances = (poolJsonRpc as Record<string, any>).data.content
			.fields.normalized_balances;
		expect(grpcBalances).toEqual(jsonBalances);
		for (const b of grpcBalances) {
			expect(typeof b).toBe("string");
		}
	});

	it("the object type is identical across protocols", () => {
		expect(poolGrpc.type).toBe(
			(poolJsonRpc as Record<string, any>).data.type
		);
		expect(vaultStateGrpc.type).toBe(
			(vaultStateJsonRpc as Record<string, any>).data.type
		);
	});
});
