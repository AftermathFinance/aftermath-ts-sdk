import {
	Ed25519Keypair,
	Helpers,
	jest,
	Secp256k1Keypair,
	Secp256r1Keypair,
} from "@test/general/fixtures/core.js";

describe("Helpers", () => {
	describe("stripLeadingZeroesFromType / addLeadingZeroesToType", () => {
		it("strips leading zeroes after 0x", () => {
			expect(Helpers.stripLeadingZeroesFromType("0x0000123")).toBe("0x123");
			expect(
				Helpers.stripLeadingZeroesFromType(
					"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
				)
			).toBe("0x2::sui::SUI");
			expect(Helpers.stripLeadingZeroesFromType("0x2::sui::SUI")).toBe(
				"0x2::sui::SUI"
			);
		});
		it("strips generics inner padding? (uses replaceAll /x0+/g)", () => {
			// replaceAll /x0+/g will also strip from generic inner "0x0002" -> "0x2"
			expect(
				Helpers.stripLeadingZeroesFromType("0x0002::a::B<0x0003::c::D>")
			).toBe("0x2::a::B<0x3::c::D>");
		});
		it("addLeadingZeroes pads to 64", () => {
			expect(Helpers.addLeadingZeroesToType("0x2")).toBe(
				`0x${"0".repeat(63)}2`
			);
			expect(Helpers.addLeadingZeroesToType("0x123")).toBe(
				`0x${"0".repeat(61)}123`
			);
			expect(Helpers.addLeadingZeroesToType(`0x${"a".repeat(64)}`)).toBe(
				`0x${"a".repeat(64)}`
			);
		});
		it("addLeading preserves suffix after ::", () => {
			expect(Helpers.addLeadingZeroesToType("0x2::sui::SUI")).toBe(
				`0x${"0".repeat(63)}2::sui::SUI`
			);
			// note: implementation strips 0x from first generic param (pre-existing bug, see objectCasters.test.ts FINDING)
			expect(Helpers.addLeadingZeroesToType("0x2::a::B<0x1::c::D>")).toBe(
				`0x${"0".repeat(63)}2::a::B<1::c::D>`
			);
			// multiple :: segments
			expect(Helpers.addLeadingZeroesToType("0x1::a::b::c")).toBe(
				`0x${"0".repeat(63)}1::a::b::c`
			);
		});
		it("throws when too long", () => {
			expect(() =>
				Helpers.addLeadingZeroesToType(`0x${"a".repeat(65)}`)
			).toThrow("invalid type length");
			expect(() =>
				Helpers.addLeadingZeroesToType(`0x${"a".repeat(64)}::mod`)
			).not.toThrow(); // 64 is ok
		});
		it("handles 0x without suffix correctly", () => {
			expect(Helpers.addLeadingZeroesToType("0x0")).toBe(`0x${"0".repeat(64)}`);
		});
		it("round-trip strip/add for short address", () => {
			const _orig = "0x2::coin::Coin<0x2::sui::SUI>";
			const padded = Helpers.addLeadingZeroesToType("0x2");
			expect(Helpers.stripLeadingZeroesFromType(padded)).toBe("0x2");
			// stripping padded generic inner may have side effects but outer works
			expect(
				Helpers.addLeadingZeroesToType(
					Helpers.stripLeadingZeroesFromType(padded)
				)
			).toBe(padded);
		});
	});

	describe("splitNonSuiCoinType", () => {
		it("defaults to sui when no colon", () => {
			expect(Helpers.splitNonSuiCoinType("0x2::sui::SUI")).toEqual({
				chain: "sui",
				coinType: "0x2::sui::SUI",
			});
			expect(Helpers.splitNonSuiCoinType("abc")).toEqual({
				chain: "sui",
				coinType: "abc",
			});
		});
		it("splits bsc etc", () => {
			// implementation destructures as [chain, coinType] = coin.split(":") so only second segment retained
			expect(Helpers.splitNonSuiCoinType("bsc:0x123::coin::COIN")).toEqual({
				chain: "bsc",
				coinType: "0x123",
			});
			// with extra colon, only first split is used (destructuring)
			expect(Helpers.splitNonSuiCoinType("eth:0xabc:def")).toEqual({
				chain: "eth",
				coinType: "0xabc",
			});
		});
		it("handles chain with empty coinType -> defaults to sui", () => {
			// uncastChain truthy but coinType falsy => returns sui
			expect(Helpers.splitNonSuiCoinType("bsc:")).toEqual({
				chain: "sui",
				coinType: "bsc:",
			});
		});
	});

	describe("isNumber", () => {
		it("validates numeric strings via regex", () => {
			expect(Helpers.isNumber("123")).toBe(true);
			expect(Helpers.isNumber("0.123")).toBe(true);
			expect(Helpers.isNumber(".123")).toBe(true);
			expect(Helpers.isNumber("123.")).toBe(true);
			expect(Helpers.isNumber("")).toBe(true); // regex allows empty due to *
			expect(Helpers.isNumber("abc")).toBe(false);
			expect(Helpers.isNumber("-123")).toBe(false);
			expect(Helpers.isNumber("1.2.3")).toBe(false);
			expect(Helpers.isNumber("12a")).toBe(false);
		});
	});

	describe("sum / sumBigInt", () => {
		it("sums numbers", () => {
			expect(Helpers.sum([1, 2, 3])).toBe(6);
			expect(Helpers.sum([])).toBe(0);
			expect(Helpers.sum([0.1, 0.2])).toBeCloseTo(0.3);
		});
		it("sums bigints", () => {
			expect(Helpers.sumBigInt([1n, 2n, 3n])).toBe(6n);
			expect(Helpers.sumBigInt([])).toBe(0n);
			expect(Helpers.sumBigInt([10n, -5n])).toBe(5n);
		});
	});

	describe("closeEnough / closeEnoughBigInt / veryCloseInt", () => {
		it("closeEnough within tolerance", () => {
			expect(Helpers.closeEnough(100, 101, 0.02)).toBe(true); // diff 1 <= 2.02
			expect(Helpers.closeEnough(100, 110, 0.05)).toBe(false);
			expect(Helpers.closeEnough(0, 0, 0.1)).toBe(true);
			expect(Helpers.closeEnough(0, 1, 0.1)).toBe(false); // max 1 => 0.1, diff 1 >0.1
		});
		it("closeEnoughBigInt delegates to closeEnough via Number", () => {
			expect(Helpers.closeEnoughBigInt(100n, 101n, 0.02)).toBe(true);
			expect(Helpers.closeEnoughBigInt(100n, 200n, 0.1)).toBe(false);
		});
		it("veryCloseInt checks floor diff <=1", () => {
			expect(Helpers.veryCloseInt(1000, 1001, 10)).toBe(true); // floor 100 vs 100 => diff0
			expect(Helpers.veryCloseInt(1000, 1020, 10)).toBe(false); // 100 vs 102 diff2
			expect(Helpers.veryCloseInt(0, 0, 1)).toBe(true);
			// with fixedOne scaling
			expect(Helpers.veryCloseInt(1.5e18, 1.6e18, 1e18)).toBe(true); // both floor 1
			expect(Helpers.veryCloseInt(1e18, 3e18, 1e18)).toBe(false); // 1 vs 3 diff2
		});
	});

	describe("blendedOperations", () => {
		it("mulNNN", () => expect(Helpers.blendedOperations.mulNNN(2, 3)).toBe(6));
		it("mulNNB", () => expect(Helpers.blendedOperations.mulNNB(2, 3)).toBe(6n));
		it("mulNBN", () =>
			expect(Helpers.blendedOperations.mulNBN(2, 10n)).toBe(20));
		it("mulNBB", () =>
			expect(Helpers.blendedOperations.mulNBB(2.5, 10n)).toBe(25n));
		it("mulBBN", () =>
			expect(Helpers.blendedOperations.mulBBN(2n, 3n)).toBe(6));
		it("mulBBB", () =>
			expect(Helpers.blendedOperations.mulBBB(2n, 3n)).toBe(6n));
		it("floor behavior for mulNNB/NBB", () => {
			expect(Helpers.blendedOperations.mulNNB(0.5, 3)).toBe(1n); // floor 1.5 =>1
			expect(Helpers.blendedOperations.mulNBB(0.6, 5n)).toBe(3n); // floor 3
		});
	});

	describe("maxBigInt / minBigInt / absBigInt", () => {
		it("max", () => {
			expect(Helpers.maxBigInt(1n, 5n, 3n)).toBe(5n);
			expect(Helpers.maxBigInt(-1n, -5n)).toBe(-1n);
			expect(Helpers.maxBigInt(0n)).toBe(0n);
		});
		it("min", () => {
			expect(Helpers.minBigInt(1n, 5n, 3n)).toBe(1n);
			expect(Helpers.minBigInt(-1n, -5n)).toBe(-5n);
		});
		it("abs", () => {
			expect(Helpers.absBigInt(5n)).toBe(5n);
			expect(Helpers.absBigInt(-5n)).toBe(5n);
			expect(Helpers.absBigInt(0n)).toBe(0n);
		});
		it("throws on empty? reduce without initial will throw", () => {
			expect(() => (Helpers as any).maxBigInt()).toThrow();
			expect(() => (Helpers as any).minBigInt()).toThrow();
		});
	});

	describe("capitalizeOnlyFirstLetter", () => {
		it("capitalizes", () => {
			expect(Helpers.capitalizeOnlyFirstLetter("HELLO")).toBe("Hello");
			expect(Helpers.capitalizeOnlyFirstLetter("hello")).toBe("Hello");
			expect(Helpers.capitalizeOnlyFirstLetter("h")).toBe("H");
			expect(Helpers.capitalizeOnlyFirstLetter("")).toBe("");
			expect(Helpers.capitalizeOnlyFirstLetter("aBC")).toBe("Abc");
		});
	});

	describe("parseJsonWithBigint", () => {
		it("converts bigint strings and null->undefined", () => {
			const parsed = Helpers.parseJsonWithBigint(
				'{"a":"123n","b":null,"c":"hello"}'
			);
			expect(parsed.a).toBe(123n);
			expect(parsed.b).toBeUndefined();
			expect(parsed.c).toBe("hello");
		});
		it("handles negative bigint strings", () => {
			expect(Helpers.parseJsonWithBigint('{"v":"-123n"}').v).toBe(-123n);
		});
		it("handles nested and arrays", () => {
			const parsed = Helpers.parseJsonWithBigint('{"arr":["1n", null, "2n"]}');
			expect(parsed.arr).toEqual([1n, undefined, 2n]);
		});
		it("unsafeStringNumberConversion converts numeric strings", () => {
			const parsed = Helpers.parseJsonWithBigint('{"a":"123"}', true);
			expect(parsed.a).toBe(123n);
			// without unsafe, stays string
			expect(Helpers.parseJsonWithBigint('{"a":"123"}').a).toBe("123");
		});
		it("does not convert non-bigint suffixed strings", () => {
			expect(Helpers.parseJsonWithBigint('{"a":"123"}').a).toBe("123");
			expect(Helpers.parseJsonWithBigint('{"a":"12.3n"}').a).toBe("12.3n"); // regex is -?\d+n so decimal not match
		});
		it("converts top-level null to undefined? JSON.parse top null -> null then reviver?", () => {
			// parse "null" directly
			expect(Helpers.parseJsonWithBigint("null")).toBeUndefined();
		});
	});

	describe("deepCopy", () => {
		it("copies null", () => expect(Helpers.deepCopy(null)).toBeNull());
		it("copies date", () => {
			const d = new Date(123_456);
			const cp = Helpers.deepCopy(d);
			expect(cp.getTime()).toBe(d.getTime());
			expect(cp).not.toBe(d);
		});
		it("copies array deeply", () => {
			const arr = [1, { a: 2 }];
			const cp = Helpers.deepCopy(arr);
			expect(cp).toEqual(arr);
			expect(cp).not.toBe(arr);
			expect(cp[1]).not.toBe(arr[1]);
			(cp[1] as any).a = 99;
			expect((arr[1] as any).a).toBe(2);
		});
		it("copies object deeply", () => {
			const obj = { a: { b: 1 }, c: [1, 2] };
			const cp = Helpers.deepCopy(obj);
			expect(cp).toEqual(obj);
			cp.a.b = 99;
			expect(obj.a.b).toBe(1);
		});
		it("returns primitives as-is", () => {
			expect(Helpers.deepCopy(123)).toBe(123);
			expect(Helpers.deepCopy("abc")).toBe("abc");
			expect(Helpers.deepCopy(undefined)).toBeUndefined();
		});
	});

	describe("indexOfMax", () => {
		it("finds index of max", () => {
			expect(Helpers.indexOfMax([1, 5, 3])).toBe(1);
			expect(Helpers.indexOfMax([5])).toBe(0);
			expect(Helpers.indexOfMax([])).toBe(-1);
			expect(Helpers.indexOfMax([1n, 10n, 2n])).toBe(1);
			expect(Helpers.indexOfMax(["a", "z", "m"])).toBe(1);
			expect(Helpers.indexOfMax([new Date(1), new Date(5), new Date(3)])).toBe(
				1
			);
		});
		it("returns first max on ties", () => {
			expect(Helpers.indexOfMax([5, 5, 3])).toBe(0);
		});
	});

	describe("uniqueArray", () => {
		it("unique primitives", () => {
			expect(Helpers.uniqueArray([1, 2, 2, 3])).toEqual([1, 2, 3]);
			expect(Helpers.uniqueArray([])).toEqual([]);
			expect(Helpers.uniqueArray(["a", "a", "b"])).toEqual(["a", "b"]);
		});
		it("unique objects via JSON stringify", () => {
			expect(Helpers.uniqueArray([{ a: 1 }, { a: 1 }, { a: 2 }])).toEqual([
				{ a: 1 },
				{ a: 2 },
			]);
			// order preserved first occurrence
			expect(Helpers.uniqueArray([{ b: 2 }, { a: 1 }, { b: 2 }])).toEqual([
				{ b: 2 },
				{ a: 1 },
			]);
		});
		it("handles mixed but first element object triggers object path", () => {
			// if first is object, all go through uniqueObjectArray path
			const arr: any[] = [{ a: 1 }, 1, 1, { a: 1 }];
			expect(Helpers.uniqueArray(arr)).toEqual([{ a: 1 }, 1]);
		});
	});

	describe("sleep / createUid", () => {
		it("sleep schedules the requested delay", async () => {
			const originalSetTimeout = globalThis.setTimeout;
			let requestedDelay: number | undefined;
			globalThis.setTimeout = ((
				callback: (...args: unknown[]) => void,
				delay?: number
			) => {
				requestedDelay = delay;
				callback();
				return 0 as unknown as ReturnType<typeof setTimeout>;
			}) as typeof setTimeout;

			try {
				await Helpers.sleep(5);
				expect(requestedDelay).toBe(5);
			} finally {
				globalThis.setTimeout = originalSetTimeout;
			}
		});
		it("createUid combines deterministic timestamp and random components", () => {
			jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
			jest.spyOn(Math, "random").mockReturnValue(0.5);
			expect(Helpers.createUid()).toBe("loyw3v28i");
		});
	});

	describe("bifilter / bifilterAsync", () => {
		it("bifilter splits correctly", () => {
			const [evens, odds] = Helpers.bifilter([1, 2, 3, 4], (n) => n % 2 === 0);
			expect(evens).toEqual([2, 4]);
			expect(odds).toEqual([1, 3]);
		});
		it("bifilter provides index and array", () => {
			const [a, b] = Helpers.bifilter([10, 20, 30], (_, idx) => idx % 2 === 0);
			expect(a).toEqual([10, 30]);
			expect(b).toEqual([20]);
		});
		it("bifilterAsync", async () => {
			const [evens, odds] = await Helpers.bifilterAsync(
				[1, 2, 3],
				async (n) => n % 2 === 0
			);
			expect(evens).toEqual([2]);
			expect(odds).toEqual([1, 3]);
		});
		it("bifilter empty", () => {
			expect(Helpers.bifilter([], () => true)).toEqual([[], []]);
		});
	});

	describe("filterObject", () => {
		it("filters entries", () => {
			expect(
				Helpers.filterObject({ a: 1, b: 2, c: 3 }, (_k, v) => v > 1)
			).toEqual({ b: 2, c: 3 });
			expect(Helpers.filterObject({ a: 1, b: 2 }, (k) => k === "a")).toEqual({
				a: 1,
			});
			expect(Helpers.filterObject({}, () => true)).toEqual({});
		});
	});

	describe("applySlippage / applySlippageBigInt", () => {
		it("applySlippage reduces amount", () => {
			expect(Helpers.applySlippage(100, 1)).toBe(99);
			expect(Helpers.applySlippage(200, 50)).toBe(100);
			expect(Helpers.applySlippage(100, 0)).toBe(100);
			expect(Helpers.applySlippage(100, 100)).toBe(0);
		});
		it("applySlippageBigInt", () => {
			expect(Helpers.applySlippageBigInt(100n, 1)).toBe(99n);
			expect(Helpers.applySlippageBigInt(100n, 0)).toBe(100n);
			expect(Helpers.applySlippageBigInt(1000n, 10)).toBe(900n);
			// slippage is percent integer, 1 =>1%
			expect(Helpers.applySlippageBigInt(100n, 100)).toBe(0n);
		});
	});

	describe("zip", () => {
		it("zips equal lengths", () => {
			expect(Helpers.zip([1, 2], ["a", "b"])).toEqual([
				[1, "a"],
				[2, "b"],
			]);
		});
		it("truncates to min length", () => {
			expect(Helpers.zip([1, 2, 3], ["a"])).toEqual([[1, "a"]]);
			expect(Helpers.zip([], [1, 2])).toEqual([]);
		});
	});

	describe("removeCircularReferences", () => {
		it("copies non-circular", () => {
			expect(Helpers.removeCircularReferences({ a: 1, b: { c: 2 } })).toEqual({
				a: 1,
				b: { c: 2 },
			});
			expect(Helpers.removeCircularReferences([1, 2, 3])).toEqual([1, 2, 3]);
			expect(Helpers.removeCircularReferences(123)).toBe(123);
			expect(Helpers.removeCircularReferences(null as any)).toBeNull();
			expect(
				Helpers.removeCircularReferences(undefined as any)
			).toBeUndefined();
		});
		it("replaces circular with undefined", () => {
			const obj: any = { a: 1 };
			obj.self = obj;
			const cleaned: any = Helpers.removeCircularReferences(obj);
			expect(cleaned.a).toBe(1);
			expect(cleaned.self).toBeUndefined();
		});
		it("handles nested circular in array", () => {
			const arr: any[] = [1];
			arr.push(arr);
			const cleaned: any = Helpers.removeCircularReferences(arr);
			expect(cleaned[0]).toBe(1);
			expect(cleaned[1]).toBeUndefined();
		});
		it("handles duplicate reference (second occurrence considered circular)", () => {
			const shared = { x: 1 };
			const obj = { a: shared, b: shared };
			const cleaned: any = Helpers.removeCircularReferences(obj);
			// second occurrence will be already seen, so undefined
			expect(cleaned.a).toEqual({ x: 1 });
			expect(cleaned.b).toBeUndefined();
		});
	});

	describe("isArrayOfStrings / isValidType / isValidHex", () => {
		it("isArrayOfStrings", () => {
			expect(Helpers.isArrayOfStrings(["a", "b"])).toBe(true);
			expect(Helpers.isArrayOfStrings([])).toBe(true);
			expect(Helpers.isArrayOfStrings(["a", 1 as any])).toBe(false);
			expect(Helpers.isArrayOfStrings("a" as any)).toBe(false);
			expect(Helpers.isArrayOfStrings(null as any)).toBe(false);
		});
		it("isValidType", () => {
			expect(Helpers.isValidType("0x2::sui::SUI")).toBe(true);
			expect(Helpers.isValidType(" 0x2::sui::SUI ")).toBe(true); // trim
			expect(Helpers.isValidType("0x2::sui")).toBe(false); // lastIndex <6
			expect(Helpers.isValidType("0x::sui::SUI")).toBe(false); // index :: <3
			expect(Helpers.isValidType("2::sui::SUI")).toBe(false);
			expect(Helpers.isValidType("0x2::sui::SUI:")).toBe(false);
			expect(Helpers.isValidType("")).toBe(false);
			expect(Helpers.isValidType("0x123")).toBe(false);
		});
		it("isValidHex", () => {
			expect(Helpers.isValidHex("0xABC")).toBe(true);
			expect(Helpers.isValidHex("0xabc123")).toBe(true);
			expect(Helpers.isValidHex("abc")).toBe(true);
			expect(Helpers.isValidHex("0xGHI")).toBe(false);
			expect(Helpers.isValidHex("")).toBe(false);
			expect(Helpers.isValidHex("0x")).toBe(false);
		});
	});

	describe("getObjectType / getObjectId / getObjectFields / getObjectDisplay", () => {
		const baseView: any = {
			objectId: "0x2",
			type: "0x2::sui::SUI",
			json: { a: 1 },
			display: { output: { name: "x" }, errors: null },
		};
		it("getObjectType normalizes and throws", () => {
			expect(Helpers.getObjectType(baseView)).toBe(
				`0x${"0".repeat(63)}2::sui::SUI`
			);
			expect(() => Helpers.getObjectType({ objectId: "0x1" } as any)).toThrow(
				"no object type"
			);
			expect(() => Helpers.getObjectType({} as any)).toThrow();
		});
		it("getObjectId normalizes and throws", () => {
			expect(
				Helpers.getObjectId({ objectId: "0xabc", type: "0x2::x::X" } as any)
			).toBe(`0x${"0".repeat(61)}abc`);
			expect(() => Helpers.getObjectId({ type: "0x1" } as any)).toThrow(
				"no object id"
			);
		});
		it("getObjectFields returns json and throws", () => {
			expect(Helpers.getObjectFields(baseView)).toEqual({ a: 1 });
			expect(() => Helpers.getObjectFields({ objectId: "0x1" } as any)).toThrow(
				"no object fields"
			);
			expect(() =>
				Helpers.getObjectFields({ json: null, objectId: "0x1" } as any)
			).toThrow();
		});
		it("getObjectDisplay returns reshaped and throws when undefined", () => {
			expect(Helpers.getObjectDisplay(baseView)).toEqual({
				data: { name: "x" },
				error: null,
			});
			expect(() =>
				Helpers.getObjectDisplay({ objectId: "0x1" } as any)
			).toThrow("no object display");
			expect(() =>
				Helpers.getObjectDisplay({ display: undefined, objectId: "0x1" } as any)
			).toThrow();
			// null display => data null
			expect(
				Helpers.getObjectDisplay({ display: null, objectId: "0x1" } as any)
			).toEqual({ data: null, error: null });
		});
	});

	describe("addTxObject", () => {
		it("calls tx.object when string, returns as-is when object", () => {
			const tx: any = {
				object: jest.fn((id) => ({ $kind: "Input", id })),
			};
			const arg = { $kind: "Input" } as any;
			expect(Helpers.addTxObject(tx, "0x123")).toEqual({
				$kind: "Input",
				id: "0x123",
			});
			expect(tx.object).toHaveBeenCalledWith("0x123");
			expect(Helpers.addTxObject(tx, arg)).toBe(arg);
		});
	});

	describe("isValidSuiAddress", () => {
		it("validates padded addresses", () => {
			expect(Helpers.isValidSuiAddress("0x2")).toBe(true);
			expect(Helpers.isValidSuiAddress(`0x${"0".repeat(64)}`)).toBe(true);
			expect(Helpers.isValidSuiAddress(`0x${"a".repeat(64)}`)).toBe(true);
			expect(Helpers.isValidSuiAddress("0x123")).toBe(true); // padded will be valid
			expect(Helpers.isValidSuiAddress("0x")).toBe(false);
			expect(Helpers.isValidSuiAddress("2")).toBe(false);
			expect(Helpers.isValidSuiAddress("")).toBe(false);
			expect(Helpers.isValidSuiAddress(`0x${"g".repeat(64)}`)).toBe(false);
			// too long => addLeading throws => invalid
			expect(Helpers.isValidSuiAddress(`0x${"a".repeat(65)}`)).toBe(false);
		});
	});

	describe("parseMoveErrorMessage", () => {
		const sample = `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("orderbook") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 3005) in command 2`;
		it("parses valid MoveAbort", () => {
			const parsed = Helpers.parseMoveErrorMessage({ errorMessage: sample });
			expect(parsed).toBeDefined();
			expect(parsed?.errorCode).toBe(3005);
			expect(parsed?.module).toBe("orderbook");
			// address is already 64 hex chars, so addLeadingZeroes pads to 64 (no extra zeros)
			expect(parsed?.packageId).toBe(
				"0x8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b"
			);
			// package should be zero-padded to 64
			expect(parsed?.packageId.length).toBe(66);
			expect(parsed?.packageId.startsWith("0x")).toBe(true);
		});
		it("returns undefined when not MoveAbort", () => {
			expect(
				Helpers.parseMoveErrorMessage({ errorMessage: "some other error" })
			).toBeUndefined();
			expect(
				Helpers.parseMoveErrorMessage({ errorMessage: "" })
			).toBeUndefined();
		});
		it("case-insensitive moveabort", () => {
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage:
						'moveabort (... address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("foo") }, 1) in command 0',
				})
			).toBeDefined();
		});
		it("returns undefined when malformed code/package/module", () => {
			// missing code (no numeric after last comma)
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("foo") }, function: 1 }, ) in command 0`,
				})
			).toBeUndefined();
			// missing package yields zero address (not undefined) – verify actual behavior is defined
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: , name: Identifier("foo") }, function: 1 }, 1) in command 0`,
				})
			).toBeDefined();
			// truly missing module identifier without closing -> undefined
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("foo") }, function: 1 } in command 0`,
				})
			).toBeUndefined();
			// empty module string is falsy -> undefined per implementation
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("") }, function: 1 }, 1) in command 0`,
				})
			).toBeUndefined();
		});
		it("handles uppercase hex package", () => {
			const msg = sample.replace(
				"8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b",
				"8D8946C2A433E2BF795414498D9F7B32E04ACA8DBF35A20257542DC51406242B"
			);
			const parsed = Helpers.parseMoveErrorMessage({ errorMessage: msg });
			expect(parsed?.packageId).toBeDefined();
		});
	});

	describe("translateMoveErrorMessage", () => {
		const pkg = `0x${"0".repeat(63)}2`;
		const moveErrors: any = {
			[pkg]: {
				orderbook: { 3005: "orderbook error 3005" },
				ANY: { 1: "any error 1", 3005: "any fallback 3005" },
			},
		};
		const sample = `MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("orderbook") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 3005) in command 2`;
		const sampleAny = `MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("unknown_mod") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 1) in command 2`;
		it("translates specific module", () => {
			const res = Helpers.translateMoveErrorMessage({
				errorMessage: sample,
				moveErrors,
			});
			expect(res?.error).toBe("orderbook error 3005");
			expect(res?.module).toBe("orderbook");
		});
		it("falls back to ANY", () => {
			const res = Helpers.translateMoveErrorMessage({
				errorMessage: sampleAny,
				moveErrors,
			});
			expect(res?.error).toBe("any error 1");
		});
		it("returns undefined when not in table", () => {
			expect(
				Helpers.translateMoveErrorMessage({
					errorMessage: "not moveabort",
					moveErrors,
				})
			).toBeUndefined();
			const unknownPkgMsg = sample.replace(
				"0000000000000000000000000000000000000000000000000000000000000002",
				"0000000000000000000000000000000000000000000000000000000000000003"
			);
			expect(
				Helpers.translateMoveErrorMessage({
					errorMessage: unknownPkgMsg,
					moveErrors,
				})
			).toBeUndefined();
			// unknown code even in ANY
			const unknownCode = sampleAny.replace(
				", 1) in command",
				", 999) in command"
			);
			expect(
				Helpers.translateMoveErrorMessage({
					errorMessage: unknownCode,
					moveErrors,
				})
			).toBeUndefined();
		});
		it("prefers specific over ANY", () => {
			const specificAndAny = `MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("orderbook") }, function: 11 }, 1) in command 2`;
			// orderbook has no 1, but ANY has 1 => should fallback to ANY (since specific missing)
			// now add specific 1 to orderbook to test prefer
			moveErrors[pkg].orderbook[1] = "specific 1";
			const res = Helpers.translateMoveErrorMessage({
				errorMessage: specificAndAny,
				moveErrors,
			});
			expect(res?.error).toBe("specific 1");
			moveErrors[pkg].orderbook[1] = undefined;
		});
	});

	describe("keypairFromPrivateKey", () => {
		it("constructs Ed25519", () => {
			const kp = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
			const secret = kp.getSecretKey();
			const decoded = Helpers.keypairFromPrivateKey(secret);
			expect(decoded.getPublicKey().toSuiAddress()).toBe(
				kp.getPublicKey().toSuiAddress()
			);
		});
		it("constructs Secp256k1 and Secp256r1", () => {
			const kp1 = Secp256k1Keypair.fromSecretKey(new Uint8Array(32).fill(8));
			const sec1 = Helpers.keypairFromPrivateKey(kp1.getSecretKey());
			expect(sec1.getPublicKey().toSuiAddress()).toBe(
				kp1.getPublicKey().toSuiAddress()
			);

			const kp2 = Secp256r1Keypair.fromSecretKey(new Uint8Array(32).fill(9));
			const sec2 = Helpers.keypairFromPrivateKey(kp2.getSecretKey());
			expect(sec2.getPublicKey().toSuiAddress()).toBe(
				kp2.getPublicKey().toSuiAddress()
			);
		});
		it("throws on invalid private key", () => {
			expect(() => Helpers.keypairFromPrivateKey("invalid")).toThrow();
			expect(() => Helpers.keypairFromPrivateKey("0x123")).toThrow();
		});
	});
});
