import { GrpcCasting } from "@test/general/fixtures/core.js";

describe("GrpcCasting", () => {
	describe("coinStructFromGrpcCoin", () => {
		it("reshapes gRPC Coin to CoinStruct", () => {
			const coin: any = {
				type: "0x2::coin::Coin<0x2::sui::SUI>",
				objectId: "0xabc",
				version: "5",
				digest: "digest123",
				balance: "1000",
			};
			const res = GrpcCasting.coinStructFromGrpcCoin(coin);
			expect(res.coinType).toBe("0x2::sui::SUI");
			expect(res.coinObjectId).toBe("0xabc");
			expect(res.version).toBe("5");
			expect(res.digest).toBe("digest123");
			expect(res.balance).toBe("1000");
			expect(res.previousTransaction).toBe("");
		});
		it("extracts inner type and handles non-generic", () => {
			const coin1: any = {
				type: "0x2::coin::Coin<0xabc::foo::BAR>",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			expect(GrpcCasting.coinStructFromGrpcCoin(coin1).coinType).toBe(
				"0xabc::foo::BAR"
			);
			const coin2: any = {
				type: "0x2::sui::SUI",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			expect(GrpcCasting.coinStructFromGrpcCoin(coin2).coinType).toBe(
				"0x2::sui::SUI"
			);
		});
		it("handles nested generics via last > extraction", () => {
			const coin: any = {
				type: "0x2::coin::Coin<0x1::a::B<0x2::sui::SUI>>",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			// extracts from first < to last > => 0x1::a::B<0x2::sui::SUI>
			expect(GrpcCasting.coinStructFromGrpcCoin(coin).coinType).toBe(
				"0x1::a::B<0x2::sui::SUI>"
			);
		});
		it("zero-padded is caller's responsibility – still returns inner", () => {
			const coin: any = {
				type: "0x2::coin::Coin<0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI>",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			expect(GrpcCasting.coinStructFromGrpcCoin(coin).coinType).toBe(
				"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
			);
		});
	});

	describe("dynamicFieldInfoFromGrpcEntry", () => {
		it("maps fields correctly and base64-encodes name.bcs", () => {
			const bcsBytes = new Uint8Array([1, 2, 3]);
			const entry: any = {
				fieldId: "0xfield",
				valueType: "0x2::table::Field",
				$kind: "DynamicField",
				name: { type: "0x2::object::ID", bcs: bcsBytes },
			};
			const res = GrpcCasting.dynamicFieldInfoFromGrpcEntry(entry);
			expect(res.objectId).toBe("0xfield");
			expect(res.objectType).toBe("0x2::table::Field");
			expect(res.type).toBe("DynamicField");
			expect(res.bcsName).toBe("AQID");
			expect(res.bcsEncoding).toBe("base64");
			expect(res.name.type).toBe("0x2::object::ID");
			expect(res.name.value).toBe("AQID");
		});
		it("handles DynamicObject kind", () => {
			const entry: any = {
				fieldId: "0x1",
				valueType: "0x1::foo::Bar",
				$kind: "DynamicObject",
				name: { type: "address", bcs: new Uint8Array([0]) },
			};
			expect(GrpcCasting.dynamicFieldInfoFromGrpcEntry(entry).type).toBe(
				"DynamicObject"
			);
		});
	});

	describe("suiObjectResponseFromGrpcObjectBcs", () => {
		it("builds SuiObjectResponse with BCS bytes", () => {
			const content = new Uint8Array([9, 9]);
			const obj: any = {
				objectId: "0x123",
				version: "1",
				digest: "dig",
				type: "0x2::foo::Bar",
				owner: { AddressOwner: "0xabc" },
				content,
			};
			const res = GrpcCasting.suiObjectResponseFromGrpcObjectBcs(obj);
			expect(res.data?.objectId).toBe("0x123");
			expect(res.data?.version).toBe("1");
			expect(res.data?.digest).toBe("dig");
			expect(res.data?.type).toBe("0x2::foo::Bar");
			expect((res.data as any).bcs.bcsBytes).toBe("CQk=");
			expect((res.data as any).bcs.dataType).toBe("moveObject");
			expect((res.data as any).bcs.type).toBe("0x2::foo::Bar");
		});
		it("base64 round-trips", () => {
			const bytes = new Uint8Array([1, 2, 3, 255]);
			const obj: any = {
				objectId: "0x1",
				version: "2",
				digest: "d",
				type: "0x1::a::B",
				owner: null,
				content: bytes,
			};
			const res = GrpcCasting.suiObjectResponseFromGrpcObjectBcs(obj);
			expect(
				Uint8Array.from(Buffer.from((res.data as any).bcs.bcsBytes, "base64"))
			).toEqual(bytes);
		});
	});

	describe("displayFieldsResponseFromGrpcDisplay", () => {
		it("maps output to data", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: { name: "a", url: "https://x" },
					errors: null,
				} as any)
			).toEqual({ data: { name: "a", url: "https://x" }, error: null });
		});
		it("drops non-string values", () => {
			const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
				output: { name: "a", count: 3, obj: { a: 1 }, nil: null } as any,
				errors: null,
			});
			expect(res.data).toEqual({ name: "a" });
			expect(JSON.stringify(res.data)).not.toContain("[object Object]");
		});
		it("keeps output when individual field errored", () => {
			const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
				output: { name: "x" } as any,
				errors: { image_url: "fail" } as any,
			});
			expect(res.data).toEqual({ name: "x" });
			expect(res.error).toBeNull();
		});
		it("reports whole-object error when output null", () => {
			const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
				output: null as any,
				errors: { f: "msg", g: "msg2" } as any,
			});
			expect(res.data).toBeNull();
			expect(res.error).toEqual({
				code: "displayError",
				error: "f: msg; g: msg2",
			});
		});
		it("returns null error when both null", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: null as any,
					errors: null,
				} as any)
			).toEqual({ data: null, error: null });
		});
		it("handles null and undefined display", () => {
			expect(GrpcCasting.displayFieldsResponseFromGrpcDisplay(null)).toEqual({
				data: null,
				error: null,
			});
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay(undefined)
			).toEqual({ data: null, error: null });
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: undefined,
				} as any)
			).toEqual({ data: null, error: null });
		});
		it("handles display with undefined errors", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: null as any,
					errors: undefined as any,
				})
			).toEqual({ data: null, error: null });
		});
		it("handles empty output object", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: {} as any,
					errors: null,
				} as any)
			).toEqual({ data: {}, error: null });
		});
	});

	describe("bytesFieldToNumbers", () => {
		it("base64-decodes gRPC form", () => {
			expect(GrpcCasting.bytesFieldToNumbers("CQk=")).toEqual([9, 9]);
			expect(GrpcCasting.bytesFieldToNumbers("CQYI")).toEqual([9, 6, 8]);
			expect(GrpcCasting.bytesFieldToNumbers("")).toEqual([]);
			expect(GrpcCasting.bytesFieldToNumbers("AQ==")).toEqual([1]);
		});
		it("passes number[] through", () => {
			expect(GrpcCasting.bytesFieldToNumbers([9, 9])).toEqual([9, 9]);
			expect(GrpcCasting.bytesFieldToNumbers([])).toEqual([]);
		});
		it("accepts Uint8Array", () => {
			expect(
				GrpcCasting.bytesFieldToNumbers(new Uint8Array([6, 8, 9]))
			).toEqual([6, 8, 9]);
			expect(GrpcCasting.bytesFieldToNumbers(new Uint8Array([]))).toEqual([]);
		});
		it("round-trip check for NaN hazard", () => {
			const grpc = "CQk=";
			expect(Number(grpc[0])).toBeNaN();
			expect(Number(GrpcCasting.bytesFieldToNumbers(grpc)[0])).toBe(9);
		});
		it("decodes arbitrary base64", () => {
			const bytes = [0, 1, 255, 128];
			expect(GrpcCasting.bytesFieldToNumbers("AAH/gA==")).toEqual(bytes);
			expect(() => GrpcCasting.bytesFieldToNumbers("not-base64")).toThrow();
		});
	});

	describe("unwrapStructField", () => {
		it("returns bare gRPC struct unchanged", () => {
			const grpc = { value: "100" };
			expect(GrpcCasting.unwrapStructField(grpc)).toEqual({ value: "100" });
		});
		it("unwraps JSON-RPC envelope", () => {
			expect(
				GrpcCasting.unwrapStructField<{ value: string }>({
					type: "0x2::a::B",
					fields: { value: "1" },
				} as unknown as {
					fields: { value: string };
				})
			).toEqual({ value: "1" });
		});
		it("is idempotent", () => {
			const once = GrpcCasting.unwrapStructField({
				fields: { size: "3" },
			} as any);
			expect(GrpcCasting.unwrapStructField(once as any)).toEqual({ size: "3" });
		});
		it("does not unwrap when fields undefined", () => {
			interface T {
				fields: undefined;
				size: string;
			}
			expect(
				GrpcCasting.unwrapStructField<T>({
					fields: undefined,
					size: "1",
				} as any)
			).toEqual({ fields: undefined, size: "1" });
		});
		it("passes null and primitives", () => {
			expect(GrpcCasting.unwrapStructField(null as any)).toBeNull();
			expect(GrpcCasting.unwrapStructField("0x5" as any)).toBe("0x5");
			expect(GrpcCasting.unwrapStructField(123 as any)).toBe(123);
			expect(GrpcCasting.unwrapStructField(undefined as any)).toBeUndefined();
		});
		it("does not unwrap object without fields key", () => {
			expect(GrpcCasting.unwrapStructField({ value: "1" } as any)).toEqual({
				value: "1",
			});
		});
	});

	describe("unwrapUid", () => {
		const id =
			"0x0235f7d73eb5974bf9cbf518763d60893f0942a7f0deb76fb30eae9147926c48";
		it("returns flattened string", () => {
			expect(GrpcCasting.unwrapUid(id)).toBe(id);
		});
		it("reads {id}", () => {
			expect(GrpcCasting.unwrapUid({ id } as any)).toBe(id);
		});
		it("reads doubly nested", () => {
			expect(GrpcCasting.unwrapUid({ id: { id } } as any)).toBe(id);
		});
		it("handles non-string id recursively", () => {
			// if value is object with id that is not string, it will attempt recursion
			// but our implementation will fallback to value if not string/id
			expect(GrpcCasting.unwrapUid({ id: "0xabc" } as any)).toBe("0xabc");
		});
	});

	describe("transactionFromResult", () => {
		it("returns Transaction when $kind Transaction", () => {
			const tx = { digest: "d" } as any;
			const result: any = { $kind: "Transaction", Transaction: tx };
			expect(GrpcCasting.transactionFromResult(result)).toBe(tx);
		});
		it("returns FailedTransaction when failed", () => {
			const tx = { digest: "failed" } as any;
			const result: any = { $kind: "FailedTransaction", FailedTransaction: tx };
			expect(GrpcCasting.transactionFromResult(result)).toBe(tx);
		});
		it("handles Transaction with effects", () => {
			const success: any = {
				$kind: "Transaction",
				Transaction: { effects: { status: "success" } },
			};
			expect(
				(GrpcCasting.transactionFromResult(success) as any).effects.status
			).toBe("success");
			const failed: any = {
				$kind: "FailedTransaction",
				FailedTransaction: { effects: { status: "failure" } },
			};
			expect(
				(GrpcCasting.transactionFromResult(failed) as any).effects.status
			).toBe("failure");
		});
	});

	describe("bytesFromBase64", () => {
		it("decodes base64", () => {
			expect(GrpcCasting.bytesFromBase64("AQID")).toEqual(
				new Uint8Array([1, 2, 3])
			);
			expect(GrpcCasting.bytesFromBase64("")).toEqual(new Uint8Array([]));
		});
		it("decodes a fixed binary fixture", () => {
			const bytes = new Uint8Array([255, 0, 127]);
			expect(GrpcCasting.bytesFromBase64("/wB/")).toEqual(bytes);
		});
	});
});
