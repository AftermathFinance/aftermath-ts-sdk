import {
	Casting,
	FixedUtils,
	GrpcCasting,
	Helpers,
	IFixedUtils,
} from "@test/general/fixtures/core.js";

describe("Cross-cutting exported behavior", () => {
	it("Helpers.addLeadingZeroesToType is used by Casting addressFromBytes correctly", () => {
		const bytes = new Array(32).fill(0xab);
		const addr = Casting.addressFromBytes(bytes);
		expect(Helpers.addLeadingZeroesToType(addr)).toBe(addr); // already padded
		expect(Helpers.stripLeadingZeroesFromType(addr)).toBe(
			"0xabababababababababababababababababababababababababababababababab"
		);
	});
	it("GrpcCasting.bytesFieldToNumbers + Helpers.parseJsonWithBigint interplay not broken", () => {
		const numbers = GrpcCasting.bytesFieldToNumbers("CQk=");
		expect(numbers).toEqual([9, 9]);
		// ensure parseJsonWithBigint doesn't interfere
		const json = JSON.stringify({ v: "123n" });
		expect(Helpers.parseJsonWithBigint(json).v).toBe(123n);
	});
	it("FixedUtils complement used in pool math edge", () => {
		// ensure complement behaves for 0-1 range used in pools
		expect(FixedUtils.complement(0.7)).toBeCloseTo(0.3);
		expect(FixedUtils.complement(1.2)).toBe(0);
	});
	it("IFixedUtils and Casting integration via bigIntFromBytes", () => {
		const bytes = [0xff, 0x00, 0x01];
		const asBig = Casting.bigIntFromBytes([...bytes]);
		const asIFixed = IFixedUtils.iFixedFromBytes([...bytes]);
		expect(asBig).toBe(asIFixed);
	});
});
