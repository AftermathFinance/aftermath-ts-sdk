/**
 * Unit tests for the three Move-field shape primitives that carry the
 * JSON-RPC -> gRPC object-content port (plan 251).
 *
 * Each primitive is fed **both** protocols' shapes, because each is required to
 * be *total*: a caster that has been ported must still work when handed a
 * JSON-RPC-shaped fixture, otherwise the port cannot be rolled out
 * incrementally and the characterization fixtures in
 * `tests/objectCasters.test.ts` could not be swapped one file at a time.
 *
 * ## Running
 *
 * ```sh
 * bun test tests/grpcCasting.test.ts
 * ```
 *
 * `bun run test` (jest) cannot execute these — see the header of
 * `tests/grpcMigration.test.ts`.
 */

import { GrpcCasting } from "../src";

// =============================================================================
//  bytesFieldToNumbers  (T2: vector<u8>)
// =============================================================================

describe("GrpcCasting.bytesFieldToNumbers", () => {
	it("base64-decodes the gRPC form", () => {
		// The exact value measured on mainnet pool
		// 0x0235f7d7…c48's `coin_decimals`, whose JSON-RPC form was [9, 9].
		expect(GrpcCasting.bytesFieldToNumbers("CQk=")).toEqual([9, 9]);
	});

	it("passes the JSON-RPC number array through unchanged", () => {
		expect(GrpcCasting.bytesFieldToNumbers([9, 9])).toEqual([9, 9]);
	});

	it("accepts a Uint8Array", () => {
		expect(GrpcCasting.bytesFieldToNumbers(new Uint8Array([6, 8, 9]))).toEqual([
			6, 8, 9,
		]);
	});

	it("round-trips a decimals vector that would otherwise NaN", () => {
		// This is the actual hazard: indexing the base64 string yields "C", and
		// `Number("C")` is NaN — silently, with no throw.
		const grpc = "CQk=";
		expect(Number(grpc[0])).toBeNaN();
		expect(Number(GrpcCasting.bytesFieldToNumbers(grpc)[0])).toBe(9);
	});

	it("handles an empty vector on both shapes", () => {
		expect(GrpcCasting.bytesFieldToNumbers("")).toEqual([]);
		expect(GrpcCasting.bytesFieldToNumbers([])).toEqual([]);
	});

	it("decodes decimals wider than one byte-pair", () => {
		// [9, 6, 8] -> base64 of 0x09,0x06,0x08
		expect(GrpcCasting.bytesFieldToNumbers("CQYI")).toEqual([9, 6, 8]);
	});
});

// =============================================================================
//  unwrapStructField  (T1: nested struct { type, fields })
// =============================================================================

describe("GrpcCasting.unwrapStructField", () => {
	it("returns the bare gRPC struct unchanged", () => {
		const grpc = { value: "100000009899506000" };
		expect(GrpcCasting.unwrapStructField(grpc)).toEqual({
			value: "100000009899506000",
		});
	});

	it("unwraps the JSON-RPC `fields` envelope", () => {
		const jsonRpc = {
			type: "0x2::balance::Supply<0x4655::af_lp::AF_LP>",
			fields: { value: "100000009899506000" },
		};
		expect(GrpcCasting.unwrapStructField(jsonRpc)).toEqual({
			value: "100000009899506000",
		});
	});

	it("is idempotent, so applying it at every nesting level is safe", () => {
		const once = GrpcCasting.unwrapStructField({ fields: { size: "3" } });
		expect(GrpcCasting.unwrapStructField(once)).toEqual({ size: "3" });
	});

	it("does not unwrap a struct whose own Move field is named `fields`", () => {
		// Guard against over-eager unwrapping: only an *envelope* has `fields`
		// as its content, and gRPC never emits one, so an undefined `fields`
		// must not be returned in place of the struct.
		//
		// @dev: the type argument is explicit because inference would otherwise
		// resolve `T | { fields: T }` to the *envelope* arm with `T = undefined`,
		// making `size` an excess property.
		type FieldsNamedFields = { fields: undefined; size: string };
		expect(
			GrpcCasting.unwrapStructField<FieldsNamedFields>({
				fields: undefined,
				size: "1",
			})
		).toEqual({ fields: undefined, size: "1" });
	});

	it("passes null and primitives through rather than throwing", () => {
		expect(GrpcCasting.unwrapStructField(null)).toBeNull();
		expect(GrpcCasting.unwrapStructField("0x5")).toBe("0x5");
	});
});

// =============================================================================
//  unwrapUid  (T3: UID)
// =============================================================================

describe("GrpcCasting.unwrapUid", () => {
	const id =
		"0x0235f7d73eb5974bf9cbf518763d60893f0942a7f0deb76fb30eae9147926c48";

	it("returns the flattened gRPC string unchanged", () => {
		expect(GrpcCasting.unwrapUid(id)).toBe(id);
	});

	it("reads JSON-RPC's `{ id }`", () => {
		expect(GrpcCasting.unwrapUid({ id })).toBe(id);
	});

	it("reads JSON-RPC's doubly-nested `{ id: { id } }`", () => {
		expect(GrpcCasting.unwrapUid({ id: { id } })).toBe(id);
	});
});

// =============================================================================
//  displayFieldsResponseFromGrpcDisplay
// =============================================================================

describe("GrpcCasting.displayFieldsResponseFromGrpcDisplay", () => {
	it("maps `output` onto `data`", () => {
		expect(
			GrpcCasting.displayFieldsResponseFromGrpcDisplay({
				output: { name: "Fren #1", image_url: "https://x/y.png" },
				errors: null,
			})
		).toEqual({
			data: { name: "Fren #1", image_url: "https://x/y.png" },
			error: null,
		});
	});

	it("drops non-string Display v2 values instead of stringifying them", () => {
		const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
			output: { name: "Fren", attributes: { a: 1 }, count: 3 },
			errors: null,
		});
		expect(res.data).toEqual({ name: "Fren" });
		expect(JSON.stringify(res.data)).not.toContain("[object Object]");
	});

	it("keeps `output` when only individual fields errored", () => {
		// A per-field failure must not blank out the whole NFT display.
		const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
			output: { name: "Fren" },
			errors: { image_url: "template failed" },
		});
		expect(res.data).toEqual({ name: "Fren" });
		expect(res.error).toBeNull();
	});

	it("reports a whole-object error only when there is no output", () => {
		const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
			output: null,
			errors: { image_url: "template failed" },
		});
		expect(res.data).toBeNull();
		expect(res.error).toEqual({
			code: "displayError",
			error: "image_url: template failed",
		});
	});

	it("handles an object with no Display template at all", () => {
		// gRPC returns `display: null` for a type without a Display template,
		// and `undefined` when `include.display` was not requested.
		expect(GrpcCasting.displayFieldsResponseFromGrpcDisplay(null)).toEqual({
			data: null,
			error: null,
		});
		expect(GrpcCasting.displayFieldsResponseFromGrpcDisplay(undefined)).toEqual({
			data: null,
			error: null,
		});
	});
});
