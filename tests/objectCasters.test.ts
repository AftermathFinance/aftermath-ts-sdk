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

import daoCapGrpc from "./fixtures/objects/daoFeePoolOwnerCap.grpc.json";
import daoCapJsonRpc from "./fixtures/objects/daoFeePoolOwnerCap.jsonrpc.json";
import farmsAdminV1Grpc from "./fixtures/objects/farmsOneTimeAdminCapV1.grpc.json";
import farmsAdminV1JsonRpc from "./fixtures/objects/farmsOneTimeAdminCapV1.jsonrpc.json";
import farmsAdminV2Grpc from "./fixtures/objects/farmsOneTimeAdminCapV2.grpc.json";
import farmsAdminV2JsonRpc from "./fixtures/objects/farmsOneTimeAdminCapV2.jsonrpc.json";
import farmsOwnerV1Grpc from "./fixtures/objects/farmsOwnerCapV1.grpc.json";
import farmsOwnerV1JsonRpc from "./fixtures/objects/farmsOwnerCapV1.jsonrpc.json";
import farmsOwnerV2Grpc from "./fixtures/objects/farmsOwnerCapV2.grpc.json";
import farmsOwnerV2JsonRpc from "./fixtures/objects/farmsOwnerCapV2.jsonrpc.json";
import farmsPosV1Grpc from "./fixtures/objects/farmsStakedPositionV1.grpc.json";
import farmsPosV1JsonRpc from "./fixtures/objects/farmsStakedPositionV1.jsonrpc.json";
import farmsPosV2Grpc from "./fixtures/objects/farmsStakedPositionV2.grpc.json";
import farmsPosV2JsonRpc from "./fixtures/objects/farmsStakedPositionV2.jsonrpc.json";
import kioskCapGrpc from "./fixtures/objects/kioskOwnerCap.grpc.json";
import kioskCapJsonRpc from "./fixtures/objects/kioskOwnerCap.jsonrpc.json";
import nftGrpc from "./fixtures/objects/nftWithDisplay.grpc.json";
import nftJsonRpc from "./fixtures/objects/nftWithDisplay.jsonrpc.json";
import personalKioskGrpc from "./fixtures/objects/personalKioskCap.grpc.json";
import personalKioskJsonRpc from "./fixtures/objects/personalKioskCap.jsonrpc.json";
import poolGrpc from "./fixtures/objects/pool.grpc.json";
import poolJsonRpc from "./fixtures/objects/pool.jsonrpc.json";
import vaultStateGrpc from "./fixtures/objects/stakedSuiVaultState.grpc.json";
import vaultStateJsonRpc from "./fixtures/objects/stakedSuiVaultState.jsonrpc.json";
import validatorCapGrpc from "./fixtures/objects/validatorOperationCap.grpc.json";
import validatorCapJsonRpc from "./fixtures/objects/validatorOperationCap.jsonrpc.json";
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

// =============================================================================
//  Every remaining Tier 1 caster: both protocols must agree
// =============================================================================

/**
 * The core invariant of the port, applied to every Tier 1 caster that holds it:
 * feeding the gRPC `json` view and JSON-RPC's `content.fields` through the same
 * caster yields the **identical** domain object.
 *
 * The two casters excluded here are covered in the divergence section below;
 * their outputs differ, and that difference is a finding, not a passing test.
 */
const agreeingCasters: [string, unknown, unknown, (v: SuiObjectView) => unknown][] =
	[
		[
			"pools.daoFeePoolOwnerCapObjectFromSuiObjectResponse",
			daoCapGrpc,
			daoCapJsonRpc,
			Casting.pools.daoFeePoolOwnerCapObjectFromSuiObjectResponse,
		],
		[
			"staking.validatorOperationCapObjectFromSuiObjectResponse",
			validatorCapGrpc,
			validatorCapJsonRpc,
			Casting.staking.validatorOperationCapObjectFromSuiObjectResponse,
		],
		[
			"farms.partialStakedPositionObjectFromSuiObjectResponseV1",
			farmsPosV1Grpc,
			farmsPosV1JsonRpc,
			Casting.farms.partialStakedPositionObjectFromSuiObjectResponseV1,
		],
		[
			"farms.partialStakedPositionObjectFromSuiObjectResponseV2",
			farmsPosV2Grpc,
			farmsPosV2JsonRpc,
			Casting.farms.partialStakedPositionObjectFromSuiObjectResponseV2,
		],
		[
			"farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV1",
			farmsOwnerV1Grpc,
			farmsOwnerV1JsonRpc,
			Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV1,
		],
		[
			"farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV2",
			farmsOwnerV2Grpc,
			farmsOwnerV2JsonRpc,
			Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV2,
		],
		[
			"nfts.kioskOwnerCapFromSuiObject",
			kioskCapGrpc,
			kioskCapJsonRpc,
			Casting.nfts.kioskOwnerCapFromSuiObject,
		],
		[
			"nfts.kioskOwnerCapFromPersonalKioskCapSuiObject",
			personalKioskGrpc,
			personalKioskJsonRpc,
			Casting.nfts.kioskOwnerCapFromPersonalKioskCapSuiObject,
		],
		[
			"nfts.nftFromSuiObject",
			nftGrpc,
			nftJsonRpc,
			Casting.nfts.nftFromSuiObject,
		],
	];

describe("every Tier 1 caster agrees across protocols", () => {
	for (const [label, grpc, jsonRpc, cast] of agreeingCasters) {
		it(label, () => {
			const fromGrpc = cast(grpcView(grpc));
			const fromJsonRpc = cast(jsonRpcAsView(jsonRpc));
			expect(fromGrpc).toEqual(fromJsonRpc);
			// Guard against a caster that "agrees" by returning nothing useful.
			expect(Object.keys(fromGrpc as object).length).toBeGreaterThan(0);
		});
	}
});

// =============================================================================
//  Named cases the port had to get right
// =============================================================================

describe("farms V2 owner cap", () => {
	it("survives `UID` flattening and reads `for` off the bare struct", () => {
		const cap = Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV2(
			grpcView(farmsOwnerV2Grpc)
		);
		expect(cap.stakingPoolId).toBe(
			"0xc84fbaa8cda83c695d35ecc7d738c3cd4a2bd144998aed4d0a5e70d7fb841093"
		);
		// gRPC really did flatten the cap's own UID to a bare string.
		expect(typeof (farmsOwnerV2Grpc.json as Record<string, any>).id).toBe(
			"string"
		);
		expect(
			typeof (farmsOwnerV2JsonRpc as Record<string, any>).data.content.fields.id
		).toBe("object");
	});
});

describe("farms V2 one-time admin cap", () => {
	it("unwraps the nested `cap` struct to read `for`", () => {
		const cap =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2(
				grpcView(farmsAdminV2Grpc)
			);
		expect(cap.stakingPoolId).toBe(
			"0xea8c7ef2269f99b35b7b6ae47dadc428fad9198fdf3efa442547be2a619a7c1e"
		);
		// The nested cap is bare under gRPC and enveloped under JSON-RPC, so a
		// caster that skipped `unwrapStructField` would read `undefined` here.
		expect(
			(farmsAdminV2Grpc.json as Record<string, any>).cap.fields
		).toBeUndefined();
		expect(
			(farmsAdminV2JsonRpc as Record<string, any>).data.content.fields.cap.fields
				.for
		).toBe("0xea8c7ef2269f99b35b7b6ae47dadc428fad9198fdf3efa442547be2a619a7c1e");
	});
});

describe("personal kiosk cap", () => {
	it("unwraps the nested `cap` struct to read `for`", () => {
		const cap = Casting.nfts.kioskOwnerCapFromPersonalKioskCapSuiObject(
			grpcView(personalKioskGrpc)
		);
		expect(cap.kioskObjectId).toBe(
			"0x96bdb5344fac122b8f4b45a6315ba0219a5a53ae0fdc5ce5b45539b83826d5a0"
		);
		expect(
			(personalKioskGrpc.json as Record<string, any>).cap.fields
		).toBeUndefined();
	});
});

describe("nftFromSuiObject", () => {
	it("still populates display from the gRPC `Display` output", () => {
		const nft = Casting.nfts.nftFromSuiObject(grpcView(nftGrpc));
		expect(nft.display.suggested.name).toBe("THE SUDOZ #3115");
		expect(nft.display.suggested.imageUrl).toContain("ipfs");
		expect(Object.keys(nft.display.other).length).toBeGreaterThan(0);
		// The suggested keys must have been *moved* out of `other`.
		expect(nft.display.other.name).toBeUndefined();
		expect(nft.display.other.image_url).toBeUndefined();
	});

	it("drops non-string Display v2 values rather than stringifying them", () => {
		const nft = Casting.nfts.nftFromSuiObject(grpcView(nftGrpc));
		for (const value of Object.values(nft.display.other)) {
			expect(typeof value).toBe("string");
		}
	});
});

// =============================================================================
//  ⚠️ FINDING: `objectType` is NOT protocol-invariant for generic types
// =============================================================================

/**
 * Plan 251 asserted (from a single pool probe) that an object's `type` is
 * "identical on both protocols — proven", and built `getObjectType` on that.
 * **It is not true in general**, and these two casters' *returned* `objectType`
 * therefore changes when the transport changes:
 *
 * - gRPC fully zero-pads every address, **including inside generic parameters**
 *   (`OneTimeAdminCap<0x0000…0002::sui::SUI>`); JSON-RPC echoes the node's
 *   abbreviated form (`OneTimeAdminCap<0x2::sui::SUI>`).
 * - gRPC emits no space after a generic's comma; JSON-RPC emits `, `.
 *
 * `Helpers.addLeadingZeroesToType` does not close the gap because it only
 * normalises the *outer* address — and it separately strips `0x` from the first
 * generic parameter (visible on every fixture here, pool included), which is a
 * pre-existing bug this port merely makes observable.
 *
 * Types with **no** generic parameters are unaffected: `kioskOwnerCap` comes back
 * as `0x2::kiosk::KioskOwnerCap` over JSON-RPC and fully padded over gRPC, and
 * `addLeadingZeroesToType` maps both to the same string — hence it sits in the
 * agreeing set above.
 *
 * These tests pin the measured divergence so it cannot be lost, and so that any
 * future fix to `addLeadingZeroesToType` fails here and forces a deliberate
 * decision about the output change.
 */
describe("FINDING: generic `objectType` differs across protocols", () => {
	it("farms V1 one-time admin cap: only `objectType` differs", () => {
		const fromGrpc =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV1(
				grpcView(farmsAdminV1Grpc)
			);
		const fromJsonRpc =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV1(
				jsonRpcAsView(farmsAdminV1JsonRpc)
			);

		// Everything the caster reads out of the *fields* agrees.
		expect(fromGrpc.objectId).toBe(fromJsonRpc.objectId);
		expect(fromGrpc.stakingPoolId).toBe(fromJsonRpc.stakingPoolId);

		// The type does not.
		expect(fromGrpc.objectType).not.toBe(fromJsonRpc.objectType);
		expect(fromGrpc.objectType).toContain(
			"OneTimeAdminCap<0000000000000000000000000000000000000000000000000000000000000002::sui::SUI>"
		);
		expect(fromJsonRpc.objectType).toContain("OneTimeAdminCap<2::sui::SUI>");

		// …and the divergence is purely address zero-padding: the two raw type
		// strings the nodes served are equal once padding is normalised away, so
		// this is a formatting difference, not a semantic one.
		const canonical = (t: string) =>
			t.replaceAll(" ", "").replaceAll(/0x0*/g, "0x");
		expect(canonical(farmsAdminV1Grpc.type)).toBe(
			canonical((farmsAdminV1JsonRpc as Record<string, any>).data.type)
		);
	});

	it("farms V2 one-time admin cap: only `objectType` differs, by comma spacing", () => {
		const fromGrpc =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2(
				grpcView(farmsAdminV2Grpc)
			);
		const fromJsonRpc =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2(
				jsonRpcAsView(farmsAdminV2JsonRpc)
			);

		expect(fromGrpc.objectId).toBe(fromJsonRpc.objectId);
		expect(fromGrpc.stakingPoolId).toBe(fromJsonRpc.stakingPoolId);

		expect(fromGrpc.objectType).not.toBe(fromJsonRpc.objectType);
		expect(fromGrpc.objectType).toContain("ADMIN>,0x84dcea");
		expect(fromJsonRpc.objectType).toContain("ADMIN>, 0x84dcea");
		expect(fromGrpc.objectType.replaceAll(" ", "")).toBe(
			fromJsonRpc.objectType.replaceAll(" ", "")
		);
	});

	it("a non-generic type IS protocol-invariant after normalisation", () => {
		// The counter-example that bounds the finding.
		expect(kioskCapGrpc.type).not.toBe(
			(kioskCapJsonRpc as Record<string, any>).data.type
		);
		expect(
			Casting.nfts.kioskOwnerCapFromSuiObject(grpcView(kioskCapGrpc)).objectType
		).toBe(
			Casting.nfts.kioskOwnerCapFromSuiObject(jsonRpcAsView(kioskCapJsonRpc))
				.objectType
		);
	});
});
