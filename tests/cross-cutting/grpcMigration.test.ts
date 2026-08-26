/**
 * Regression tests for the `SuiJsonRpcClient` -> `SuiGrpcClient` migration.
 *
 * These target the **response-shape mappings**, which is where a wrong port
 * hides: none of `res.data`->`res.objects`, `nextCursor`->`cursor`,
 * array->paginated, `totalBalance`->`balance.balance`, tuple->BCS, or the
 * `$kind` union produces a typecheck or lint failure when botched.
 *
 * The mocks below deliberately return **only** the gRPC shape. A mapping that
 * still reads a JSON-RPC field therefore reads `undefined` and the assertion
 * fails, rather than passing vacuously.
 *
 * ## Running
 *
 * ```sh
 * bun test tests/grpcMigration.test.ts
 * ```
 *
 * `bun run test` (jest) cannot execute these: jest's CommonJS transform chokes
 * on `@mysten/sui`'s ESM-only `.mjs` entrypoints, which already breaks every
 * suite in this directory on `perps-v2` (2 suites failed, 0 tests run) —
 * independently of this migration. `bun test` handles ESM natively. The file is
 * named so jest will pick it up once that infrastructure is fixed.
 */

import { Transaction } from "@mysten/sui/transactions";
// @dev: imported through the package barrel, not by deep path — the helper
// modules form an import cycle that only resolves in barrel order.
import { type AftermathApi, AftermathApi as Api, GrpcCasting } from "@sdk";

const {
	dynamicFields: DynamicFieldsApiHelpers,
	events: EventsApiHelpers,
	inspections: InspectionsApiHelpers,
	objects: ObjectsApiHelpers,
	transactions: TransactionsApiHelpers,
	wallet: WalletApi,
	coin: CoinApi,
	sui: SuiApiHelpers,
} = Api.helpers;

// =============================================================================
//  Helpers
// =============================================================================

type AnyFn = (...args: never[]) => unknown;

/**
 * Builds a fake `AftermathApi` carrying only the two clients.
 *
 * `jsonRpcClient` is **optional** on the real class, so `requireJsonRpcClient`
 * is mirrored here rather than left off — a helper that reaches for JSON-RPC
 * must fail the same way it would in production.
 */
const mockApi = (inputs: {
	client?: Record<string, AnyFn>;
	jsonRpcClient?: Record<string, AnyFn>;
}): AftermathApi => {
	const jsonRpcClient = inputs.jsonRpcClient ?? {};
	return {
		client: inputs.client ?? {},
		jsonRpcClient,
		addresses: {},
		requireJsonRpcClient: (methodName: string) => {
			if (!jsonRpcClient) {
				throw new Error(`${methodName} requires a \`SuiJsonRpcClient\``);
			}
			return jsonRpcClient;
		},
	} as unknown as AftermathApi;
};

const owner = {
	$kind: "AddressOwner",
	AddressOwner: "0x5",
} as never;

const grpcCoin = (objectId: string, balance: string) => ({
	objectId,
	version: "1",
	digest: `digest-${objectId}`,
	owner,
	type: "0x2::coin::Coin<0x2::sui::SUI>",
	balance,
});

const successStatus = { success: true, error: null } as never;

const gasUsed = {
	computationCost: "1000000",
	storageCost: "2000000",
	storageRebate: "990000",
	nonRefundableStorageFee: "10000",
};

// =============================================================================
//  GrpcCasting — the pure reshapes
// =============================================================================

describe("GrpcCasting.coinStructFromGrpcCoin", () => {
	it("maps objectId -> coinObjectId and unwraps Coin<T> into coinType", () => {
		const struct = GrpcCasting.coinStructFromGrpcCoin(
			grpcCoin("0xabc", "123") as never
		);

		// gRPC has no `coinObjectId`; reading it means the mapping ran.
		expect(struct.coinObjectId).toBe("0xabc");
		expect(struct.balance).toBe("123");
		// `type` is the wrapper `0x2::coin::Coin<T>`; `coinType` must be `T`.
		expect(struct.coinType).toBe("0x2::sui::SUI");
	});

	it("leaves a non-generic type untouched", () => {
		expect(
			GrpcCasting.coinStructFromGrpcCoin({
				...grpcCoin("0x1", "1"),
				type: "0x2::sui::SUI",
			} as never).coinType
		).toBe("0x2::sui::SUI");
	});
});

describe("GrpcCasting.dynamicFieldInfoFromGrpcEntry", () => {
	it("maps fieldId -> objectId and valueType -> objectType", () => {
		const info = GrpcCasting.dynamicFieldInfoFromGrpcEntry({
			$kind: "DynamicField",
			fieldId: "0xfield",
			type: "0x2::dynamic_field::Field<u64,0x3::inner::Inner>",
			name: { type: "u64", bcs: new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0]) },
			valueType: "0x3::inner::Inner",
		} as never);

		// gRPC has neither `objectId` nor `objectType`.
		expect(info.objectId).toBe("0xfield");
		expect(info.objectType).toBe("0x3::inner::Inner");
		expect(info.type).toBe("DynamicField");
		expect(info.bcsName).toBe("AgAAAAAAAAA=");
	});
});

describe("GrpcCasting.suiObjectResponseFromGrpcObjectBcs", () => {
	it("base64-encodes gRPC's `content` bytes into data.bcs.bcsBytes", () => {
		const res = GrpcCasting.suiObjectResponseFromGrpcObjectBcs({
			objectId: "0x5",
			version: "9",
			digest: "d",
			owner,
			type: "0x3::sui_system::SuiSystemState",
			content: new Uint8Array([1, 2, 3]),
		} as never);

		const bcs = res.data?.bcs;
		if (!(bcs && "bcsBytes" in bcs)) {
			throw new Error("no bcsBytes on the reshaped response");
		}
		// `Casting.castObjectBcs` calls `bcsType.fromBase64` on exactly this.
		expect(bcs.bcsBytes).toBe("AQID");
		expect(res.data?.objectId).toBe("0x5");
	});
});

describe("GrpcCasting.transactionFromResult", () => {
	it("reads the Transaction arm", () => {
		expect(
			GrpcCasting.transactionFromResult({
				$kind: "Transaction",
				Transaction: { digest: "ok" },
			} as never).digest
		).toBe("ok");
	});

	it("reads the FailedTransaction arm — a failed simulation still has effects", () => {
		expect(
			GrpcCasting.transactionFromResult({
				$kind: "FailedTransaction",
				FailedTransaction: { digest: "failed" },
			} as never).digest
		).toBe("failed");
	});
});

// =============================================================================
//  WalletApi
// =============================================================================

describe("WalletApi.fetchCoinBalance", () => {
	it("reads balance.balance, not the JSON-RPC totalBalance", async () => {
		const api = mockApi({
			client: {
				getBalance: async () => ({
					balance: {
						coinType: "0x2::sui::SUI",
						balance: "777",
						coinBalance: "777",
						addressBalance: "0",
					},
				}),
			},
		});

		expect(
			await new WalletApi(api).fetchCoinBalance({
				walletAddress: "0x5",
				coin: "0x2::sui::SUI",
			})
		).toBe(BigInt(777));
	});
});

describe("WalletApi.fetchAllCoinBalances", () => {
	it("pages listBalances to exhaustion (getAllBalances returned everything at once)", async () => {
		const pages = [
			{
				balances: [{ coinType: "0x2::sui::SUI", balance: "1" }],
				hasNextPage: true,
				cursor: "c1",
			},
			{
				balances: [{ coinType: "0xa::a::A", balance: "2" }],
				hasNextPage: true,
				cursor: "c2",
			},
			{
				balances: [{ coinType: "0xb::b::B", balance: "3" }],
				hasNextPage: false,
				cursor: null,
			},
		];
		const cursors: (string | null | undefined)[] = [];
		let call = 0;
		const api = mockApi({
			client: {
				listBalances: async (input: never) => {
					cursors.push((input as { cursor?: string | null }).cursor);
					return pages[call++];
				},
			},
		});

		const balances = await new WalletApi(api).fetchAllCoinBalances({
			walletAddress: "0x5",
		});

		// All three pages, not just the first.
		expect(Object.keys(balances)).toHaveLength(3);
		expect(call).toBe(3);
		// `res.cursor` (not `res.nextCursor`) has to drive the next page.
		expect(cursors).toEqual([undefined, "c1", "c2"]);
		// Keys are zero-padded, as `getAllBalances` produced.
		expect(
			balances[
				"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
			]
		).toBe(BigInt(1));
		expect(
			balances[
				"0x000000000000000000000000000000000000000000000000000000000000000a::a::A"
			]
		).toBe(BigInt(2));
	});

	it("stops when hasNextPage is false even if a cursor is present", async () => {
		let call = 0;
		const api = mockApi({
			client: {
				listBalances: async () => {
					call++;
					return {
						balances: [{ coinType: "0x2::sui::SUI", balance: "1" }],
						hasNextPage: false,
						cursor: "not-null",
					};
				},
			},
		});

		await new WalletApi(api).fetchAllCoinBalances({ walletAddress: "0x5" });
		expect(call).toBe(1);
	});
});

// =============================================================================
//  CoinApi
// =============================================================================

describe("CoinApi.fetchAllCoins", () => {
	it("reads res.objects / res.cursor and pages", async () => {
		const pages = [
			{
				objects: [grpcCoin("0x02", "10")],
				hasNextPage: true,
				cursor: "c1",
			},
			{
				objects: [grpcCoin("0x01", "20")],
				hasNextPage: false,
				cursor: null,
			},
		];
		let call = 0;
		const cursors: unknown[] = [];
		const api = mockApi({
			client: {
				listCoins: async (input: never) => {
					cursors.push((input as { cursor?: unknown }).cursor);
					return pages[call++];
				},
			},
		});

		const coins = await new CoinApi(api).fetchAllCoins({
			walletAddress: "0x5",
			coinType: "0x2::sui::SUI",
		});

		expect(call).toBe(2);
		expect(cursors).toEqual([undefined, "c1"]);
		expect(coins).toHaveLength(2);
		// Sorted ascending by coinObjectId, as before — proving the reshape ran
		// (the sort reads `coinObjectId`, which only the adapter produces).
		expect(coins.map((c) => c.coinObjectId)).toEqual(["0x01", "0x02"]);
	});
});

describe("CoinApi.fetchCoinWithAmountTx", () => {
	it("non-sponsored: sources via the CoinWithBalance intent, never listCoins", async () => {
		let listCoinsCalls = 0;
		const api = mockApi({
			client: {
				getBalance: async () => ({
					balance: {
						coinType: "0x2::sui::SUI",
						balance: "5000",
						coinBalance: "0",
						addressBalance: "5000",
					},
				}),
				listCoins: async () => {
					listCoinsCalls++;
					return { objects: [], hasNextPage: false, cursor: null };
				},
			},
		});

		const tx = new Transaction();
		const arg = await new CoinApi(api).fetchCoinWithAmountTx({
			tx,
			walletAddress: "0x5",
			coinType: "0x2::sui::SUI",
			coinAmount: BigInt(1000),
		});

		// Accumulator-only balance is spendable, and no coin pagination ran.
		expect(arg).toBeDefined();
		expect(listCoinsCalls).toBe(0);
	});

	it("non-sponsored: throws the canonical error when total balance is short", async () => {
		const api = mockApi({
			client: {
				getBalance: async () => ({
					balance: {
						coinType: "0x2::sui::SUI",
						balance: "10",
						coinBalance: "10",
						addressBalance: "0",
					},
				}),
			},
		});

		await expect(
			new CoinApi(api).fetchCoinWithAmountTx({
				tx: new Transaction(),
				walletAddress: "0x5",
				coinType: "0x2::sui::SUI",
				coinAmount: BigInt(1000),
			})
		).rejects.toThrow("wallet does not have coins of sufficient balance");
	});

	it("sponsored: stays on owned-coin selection (listCoins), no intent", async () => {
		let listCoinsCalls = 0;
		const api = mockApi({
			client: {
				listCoins: async () => {
					listCoinsCalls++;
					return {
						objects: [grpcCoin("0x01", "5000")],
						hasNextPage: false,
						cursor: null,
					};
				},
			},
		});

		const arg = await new CoinApi(api).fetchCoinWithAmountTx({
			tx: new Transaction(),
			walletAddress: "0x5",
			coinType: "0x2::sui::SUI",
			coinAmount: BigInt(1000),
			isSponsoredTx: true,
		});

		expect(arg).toBeDefined();
		expect(listCoinsCalls).toBe(1);
	});
});

describe("CoinApi.fetchCoinsWithAtLeastAmount", () => {
	it("accumulates across pages until the requested amount is covered", async () => {
		const pages = [
			{ objects: [grpcCoin("0x01", "5")], hasNextPage: true, cursor: "c1" },
			{ objects: [grpcCoin("0x02", "7")], hasNextPage: false, cursor: null },
		];
		let call = 0;
		const api = mockApi({
			client: { listCoins: async () => pages[call++] },
		});

		const coins = await new CoinApi(api).fetchCoinsWithAtLeastAmount({
			walletAddress: "0x5",
			coinType: "0x2::sui::SUI",
			coinAmount: BigInt(10),
		});

		// Largest first, and enough of them to reach 10.
		expect(coins.map((c) => c.balance)).toEqual(["7", "5"]);
	});

	it("stops paging as soon as fetched coins cover the amount", async () => {
		let call = 0;
		const api = mockApi({
			client: {
				listCoins: async () => {
					call++;
					return {
						objects: [grpcCoin(`0x${call}`, "100")],
						hasNextPage: true,
						cursor: `c${call}`,
					};
				},
			},
		});

		const coins = await new CoinApi(api).fetchCoinsWithAtLeastAmount({
			walletAddress: "0x5",
			coinType: "0x2::sui::SUI",
			coinAmount: BigInt(100),
		});

		// Page 1 already covers the amount — no further fetches.
		expect(call).toBe(1);
		expect(coins.map((c) => c.balance)).toEqual(["100"]);
	});

	it("gives up on coin-dust wallets instead of paging forever", async () => {
		let call = 0;
		const api = mockApi({
			client: {
				listCoins: async () => {
					call++;
					return {
						objects: [grpcCoin(`0x${call}`, "1")],
						hasNextPage: true,
						cursor: `c${call}`,
					};
				},
			},
		});

		await expect(
			new CoinApi(api).fetchCoinsWithAtLeastAmount({
				walletAddress: "0x5",
				coinType: "0x2::sui::SUI",
				coinAmount: BigInt(1_000_000),
			})
		).rejects.toThrow("wallet balance is spread across too many coin objects");
		expect(call).toBe(50);
	});

	it("throws when the wallet cannot cover the amount", async () => {
		const api = mockApi({
			client: {
				listCoins: async () => ({
					objects: [grpcCoin("0x01", "1")],
					hasNextPage: false,
					cursor: null,
				}),
			},
		});

		await expect(
			new CoinApi(api).fetchCoinsWithAtLeastAmount({
				walletAddress: "0x5",
				coinType: "0x2::sui::SUI",
				coinAmount: BigInt(1000),
			})
		).rejects.toThrow("wallet does not have coins of sufficient balance");
	});
});

// =============================================================================
//  TransactionsApiHelpers
// =============================================================================

describe("TransactionsApiHelpers.fetchSetGasBudgetForTx", () => {
	const clientFor = (result: unknown) => ({
		simulateTransaction: async () => result,
		getReferenceGasPrice: async () => ({ referenceGasPrice: "1000" }),
	});

	/**
	 * `fetchSetGasBudgetForTx` calls `tx.build({ client })`, whose resolver hits
	 * the network unless gas is already fully specified. Pre-specify it so the
	 * test exercises only the response mapping; the helper overwrites both the
	 * budget and the price from the simulation anyway.
	 */
	const preResolvedTx = () => {
		const tx = new Transaction();
		tx.setSender("0x5");
		tx.setGasPrice(BigInt(1));
		tx.setGasBudget(BigInt(1));
		tx.setGasPayment([
			{
				objectId: `0x${"1".repeat(64)}`,
				version: "1",
				digest: "11111111111111111111111111111111",
			},
		]);
		return tx;
	};

	it("reads gas out of the Transaction arm and nests referenceGasPrice", async () => {
		const api = mockApi({
			client: clientFor({
				$kind: "Transaction",
				Transaction: { status: successStatus, effects: { gasUsed } },
			}) as never,
		});

		const out = await new TransactionsApiHelpers(api).fetchSetGasBudgetForTx({
			tx: preResolvedTx(),
		});

		// (1000000 + 2000000) * 1.1
		expect(out.getData().gasData.budget).toBe("3300000");
		// A bare string would stringify as "[object Object]" and BigInt would throw.
		expect(out.getData().gasData.price).toBe("1000");
	});

	it("reads gas out of the FailedTransaction arm too", async () => {
		const api = mockApi({
			client: clientFor({
				$kind: "FailedTransaction",
				FailedTransaction: {
					status: { success: false, error: { message: "MoveAbort" } },
					effects: { gasUsed },
				},
			}) as never,
		});

		const out = await new TransactionsApiHelpers(api).fetchSetGasBudgetForTx({
			tx: preResolvedTx(),
		});

		// Reading only `result.Transaction` would throw on `undefined.effects`
		// and the fee would be lost exactly when the caller needs it.
		expect(out.getData().gasData.budget).toBe("3300000");
	});
});

// =============================================================================
//  ObjectsApiHelpers
// =============================================================================

describe("ObjectsApiHelpers.fetchDoesObjectExist", () => {
	it("is true when getObject resolves", async () => {
		const api = mockApi({
			client: { getObject: async () => ({ object: { objectId: "0x5" } }) },
		});
		expect(await new ObjectsApiHelpers(api).fetchDoesObjectExist("0x5")).toBe(
			true
		);
	});

	it("is false when getObject throws — gRPC does not return { error }", async () => {
		const api = mockApi({
			client: {
				getObject: async () => {
					throw new Error("Object 0xdead not found");
				},
			},
		});
		expect(
			await new ObjectsApiHelpers(api).fetchDoesObjectExist("0xdead")
		).toBe(false);
	});

	it("passes objectId, not the JSON-RPC `id`", async () => {
		const seen: unknown[] = [];
		const api = mockApi({
			client: {
				getObject: async (input: never) => {
					seen.push(input);
					return { object: {} };
				},
			},
		});
		await new ObjectsApiHelpers(api).fetchDoesObjectExist("0x5");
		expect(seen[0]).toEqual({ objectId: "0x5" });
	});
});

describe("ObjectsApiHelpers.fetchObjectBcs", () => {
	it("requests include.content and base64s the bytes", async () => {
		const seen: unknown[] = [];
		const api = mockApi({
			client: {
				getObject: async (input: never) => {
					seen.push(input);
					return {
						object: {
							objectId: "0x5",
							version: "1",
							digest: "d",
							owner,
							type: "0x3::sui_system::SuiSystemState",
							content: new Uint8Array([1, 2, 3]),
						},
					};
				},
			},
		});

		const res = await new ObjectsApiHelpers(api).fetchObjectBcs("0x5");
		expect(seen[0]).toEqual({ objectId: "0x5", include: { content: true } });
		const bcs = res.data?.bcs;
		if (!(bcs && "bcsBytes" in bcs)) {
			throw new Error("no bcsBytes");
		}
		expect(bcs.bcsBytes).toBe("AQID");
	});
});

// =============================================================================
//  InspectionsApiHelpers
// =============================================================================

describe("InspectionsApiHelpers.fetchAllBytesFromTx", () => {
	const simulation = {
		$kind: "Transaction",
		Transaction: {
			status: successStatus,
			effects: { gasUsed },
			events: [],
		},
		commandResults: [
			{
				returnValues: [
					{ bcs: new Uint8Array([208, 179, 218, 191, 6, 0, 0, 0]) },
				],
				mutatedReferences: [],
			},
		],
	};

	it("reads commandResults[i].returnValues[j].bcs, not JSON-RPC tuples", async () => {
		const api = mockApi({
			client: { simulateTransaction: async () => simulation },
		});
		const tx = new Transaction();
		tx.moveCall({ target: "0x2::foo::bar" });

		const out = await new InspectionsApiHelpers(api).fetchAllBytesFromTx({
			tx,
		});
		expect(out.allBytes).toEqual([[[208, 179, 218, 191, 6, 0, 0, 0]]]);
	});

	it("requests commandResults inside `include` and disables checks", async () => {
		const seen: Record<string, unknown>[] = [];
		const api = mockApi({
			client: {
				simulateTransaction: async (input: never) => {
					seen.push(input as Record<string, unknown>);
					return simulation;
				},
			},
		});
		const tx = new Transaction();
		tx.moveCall({ target: "0x2::foo::bar" });
		await new InspectionsApiHelpers(api).fetchAllBytesFromTx({ tx });

		// `commandResults` as a sibling of `include` is silently ignored by the
		// node — verified live: the response came back with `commandResults`
		// undefined.
		expect(seen[0].include).toEqual({
			effects: true,
			events: true,
			commandResults: true,
		});
		expect(seen[0].checksEnabled).toBe(false);
	});

	it("does not mutate the caller's transaction when applying the sender", async () => {
		const api = mockApi({
			client: { simulateTransaction: async () => simulation },
		});
		const tx = new Transaction();
		tx.moveCall({ target: "0x2::foo::bar" });

		await new InspectionsApiHelpers(api).fetchAllBytesFromTx({ tx });

		// `devInspectTransactionBlock` took the sender as a separate option; gRPC
		// reads it off the transaction. A caller that later executes this same
		// transaction must not inherit the dev-inspect signer.
		expect(tx.getData().sender).toBeFalsy();
	});

	it("throws with the gRPC status error message on failure", async () => {
		const api = mockApi({
			client: {
				simulateTransaction: async () => ({
					$kind: "FailedTransaction",
					FailedTransaction: {
						// gRPC uses `{ success, error }`, not `{ status: "failure" }`.
						status: { success: false, error: { message: "MoveAbort(7)" } },
						effects: { gasUsed },
						events: [],
					},
					commandResults: [],
				}),
			},
		});
		const tx = new Transaction();
		tx.moveCall({ target: "0x2::foo::bar" });

		await expect(
			new InspectionsApiHelpers(api).fetchAllBytesFromTx({ tx })
		).rejects.toThrow("MoveAbort(7)");
	});
});

// =============================================================================
//  DynamicFieldsApiHelpers
// =============================================================================

describe("DynamicFieldsApiHelpers.fetchDynamicFieldsOfTypeWithCursor", () => {
	const entry = (fieldId: string, valueType: string) => ({
		$kind: "DynamicField",
		fieldId,
		type: `0x2::dynamic_field::Field<u64,${valueType}>`,
		name: { type: "u64", bcs: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]) },
		valueType,
	});

	it("maps entries and reads res.cursor", async () => {
		const api = mockApi({
			client: {
				listDynamicFields: async () => ({
					dynamicFields: [entry("0xf1", "0x3::a::A")],
					hasNextPage: false,
					cursor: null,
				}),
			},
		});

		const res = await new DynamicFieldsApiHelpers(
			api
		).fetchDynamicFieldsOfTypeWithCursor({ parentObjectId: "0x5" });

		expect(res.dynamicFields.map((f) => f.objectId)).toEqual(["0xf1"]);
		expect(res.dynamicFields[0].objectType).toBe("0x3::a::A");
		expect(res.nextCursor).toBeNull();
	});

	it("still filters by dynamicFieldType after the reshape", async () => {
		const api = mockApi({
			client: {
				listDynamicFields: async () => ({
					dynamicFields: [
						entry("0xf1", "0x3::a::A"),
						entry("0xf2", "0x3::b::B"),
					],
					hasNextPage: false,
					cursor: null,
				}),
			},
		});

		const res = await new DynamicFieldsApiHelpers(
			api
		).fetchDynamicFieldsOfTypeWithCursor({
			parentObjectId: "0x5",
			dynamicFieldType: "0x3::b::B",
		});

		expect(res.dynamicFields.map((f) => f.objectId)).toEqual(["0xf2"]);
	});

	it("forwards the parent id as parentId and passes the cursor through", async () => {
		const seen: Record<string, unknown>[] = [];
		const api = mockApi({
			client: {
				listDynamicFields: async (input: never) => {
					seen.push(input as Record<string, unknown>);
					return { dynamicFields: [], hasNextPage: false, cursor: null };
				},
			},
		});

		await new DynamicFieldsApiHelpers(api).fetchDynamicFieldsOfTypeWithCursor({
			parentObjectId: "0x5",
			cursor: "0xcur",
			limit: 7,
		});

		expect(seen[0]).toEqual({ parentId: "0x5", cursor: "0xcur", limit: 7 });
	});
});

// =============================================================================
//  Endpoint split — guards the remaining JSON-RPC surface from drifting
// =============================================================================

describe("client routing", () => {
	/**
	 * Every helper below is documented on `AftermathApi.jsonRpcClient` as
	 * remaining JSON-RPC surface. If one of them is later ported, this test
	 * fails and the documentation has to be updated with it. Equally, if a
	 * *gRPC* helper is accidentally routed back through `jsonRpcClient`, the
	 * matching assertion above (which only stubs `client`) fails.
	 */
	const throwing = (name: string) => () => {
		throw new Error(`unexpected call to client.${name}`);
	};

	// @dev: these four were the tripwires plan 247 left behind for exactly this
	// port ("if one of them is later ported, this test fails"). Plan 251 ported
	// them, so they are inverted: `jsonRpcClient` now throws, which is the
	// stronger direction — it fails if a helper is ever routed *back* onto
	// JSON-RPC as well as if it never left.
	const throwingJsonRpc = (names: string[]) =>
		Object.fromEntries(names.map((n) => [n, throwing(`jsonRpcClient.${n}`)]));

	it("fetchObjectGeneral goes through the gRPC client", async () => {
		let hit = false;
		const api = mockApi({
			client: {
				getObject: async () => {
					hit = true;
					return { object: { objectId: "0x5", json: {} } };
				},
			},
			jsonRpcClient: throwingJsonRpc(["getObject"]),
		});
		await new ObjectsApiHelpers(api).fetchObjectGeneral({ objectId: "0x5" });
		expect(hit).toBe(true);
	});

	it("fetchObjectBatch goes through the gRPC client and drops Error entries", async () => {
		let hit = false;
		const api = mockApi({
			client: {
				getObjects: async () => {
					hit = true;
					// gRPC's per-object error arm, which `multiGetObjects` had no
					// equivalent for. The Error must not reach a caster.
					return {
						objects: [
							{ objectId: "0x5", json: {} },
							new Error("Object 0x6 not found"),
						],
					};
				},
			},
			jsonRpcClient: throwingJsonRpc(["multiGetObjects"]),
		});
		const objects = await new ObjectsApiHelpers(api).fetchObjectBatch({
			objectIds: ["0x5", "0x6"],
		});
		expect(hit).toBe(true);
		expect(objects).toHaveLength(1);
		expect(objects[0].objectId).toBe("0x5");
		expect(objects.some((o) => o instanceof Error)).toBe(false);
	});

	it("fetchOwnedObjects goes through the gRPC client and paginates on `cursor`", async () => {
		const pages = [
			{ objects: [{ objectId: "0x5" }], hasNextPage: true, cursor: "c1" },
			{ objects: [{ objectId: "0x6" }], hasNextPage: false, cursor: null },
		];
		const seenCursors: (string | null | undefined)[] = [];
		let call = 0;
		const api = mockApi({
			client: {
				listOwnedObjects: async (opts: { cursor?: string | null }) => {
					seenCursors.push(opts.cursor);
					return pages[call++];
				},
			},
			jsonRpcClient: throwingJsonRpc(["getOwnedObjects"]),
		});
		const objects = await new ObjectsApiHelpers(api).fetchOwnedObjects({
			walletAddress: "0x5",
		});
		// Reading `nextCursor` instead of `cursor` would silently stop after the
		// first page rather than error.
		expect(objects.map((o) => o.objectId)).toEqual(["0x5", "0x6"]);
		expect(seenCursors).toEqual([undefined, "c1"]);
	});

	it("fetchOwnedObjects requests the json view, and display only when asked", async () => {
		const includes: unknown[] = [];
		const api = mockApi({
			client: {
				listOwnedObjects: async (opts: { include?: unknown }) => {
					includes.push(opts.include);
					return { objects: [], hasNextPage: false, cursor: null };
				},
			},
		});
		const helpers = new ObjectsApiHelpers(api);
		await helpers.fetchOwnedObjects({ walletAddress: "0x5" });
		await helpers.fetchOwnedObjects({
			walletAddress: "0x5",
			withDisplay: true,
		});
		// gRPC returns `json`/`display` as undefined unless asked, so a dropped
		// flag is a silently empty field rather than an error.
		expect(includes).toEqual([
			{ json: true, display: false },
			{ json: true, display: true },
		]);
	});

	it("fetchDynamicFieldObject goes through gRPC getDynamicObjectField", async () => {
		let hit = false;
		const api = mockApi({
			client: {
				// @dev: NOT `getDynamicField` — that returns `{ type, bcs }` only,
				// with no `json` view and no `objectId`, so it cannot feed a caster.
				getDynamicField: throwing("getDynamicField"),
			},
			jsonRpcClient: throwingJsonRpc(["getDynamicFieldObject"]),
		});
		// `getDynamicObjectField` lives on `client.core`, not the client root.
		(api.client as unknown as { core: Record<string, unknown> }).core = {
			getDynamicObjectField: async () => {
				hit = true;
				return { object: { objectId: "0x5", json: {} } };
			},
		};
		await new DynamicFieldsApiHelpers(api).fetchDynamicFieldObject({
			parentId: "0x5",
			name: { type: "u64", bcs: new Uint8Array([1]) },
		});
		expect(hit).toBe(true);
	});

	it("fetchTransactionsWithCursor goes through jsonRpcClient", async () => {
		let hit = false;
		const api = mockApi({
			jsonRpcClient: {
				queryTransactionBlocks: async () => {
					hit = true;
					return { data: [], nextCursor: null };
				},
			},
		});
		await new TransactionsApiHelpers(api).fetchTransactionsWithCursor({
			query: {},
		});
		expect(hit).toBe(true);
	});
});

// =============================================================================
//  The optional JSON-RPC client
// =============================================================================

/**
 * `AftermathApi`'s third constructor argument is optional: JSON-RPC is a legacy
 * add-on for three helpers, not a structural dependency. These tests use the
 * **real** class rather than `mockApi`, since the behaviour under test is the
 * constructor and `requireJsonRpcClient` themselves.
 */
describe("optional jsonRpcClient", () => {
	const grpcClient = {} as never;
	const addresses = {} as never;

	it("constructs without a jsonRpcClient", () => {
		const api = new Api(grpcClient, addresses);
		expect(api.jsonRpcClient).toBeUndefined();
		// The gRPC surface must be unaffected by its absence. (Helpers that
		// validate `addresses` are excluded — that is a separate concern, and
		// `addresses` is deliberately empty here.)
		expect(api.Objects()).toBeDefined();
		expect(api.DynamicFields()).toBeDefined();
	});

	it("returns the client when one was provided", () => {
		const jsonRpcClient = { queryEvents: async () => ({}) } as never;
		const api = new Api(grpcClient, addresses, jsonRpcClient);
		expect(api.requireJsonRpcClient("Events().fetchCastEventsWithCursor")).toBe(
			jsonRpcClient
		);
	});

	it("throws naming the calling method when absent", () => {
		const api = new Api(grpcClient, addresses);
		expect(() => api.requireJsonRpcClient("Sui().fetchSystemState")).toThrow(
			"Sui().fetchSystemState requires a `SuiJsonRpcClient`"
		);
	});

	/**
	 * Each of the three legacy helpers must surface the throw rather than
	 * degrading to an empty result — a silent `[]` from a history or events read
	 * is indistinguishable from "no data" at the call site.
	 */
	it.each([
		[
			"Events().fetchCastEventsWithCursor",
			() =>
				new EventsApiHelpers(
					new Api(grpcClient, addresses)
				).fetchCastEventsWithCursor({
					query: {} as never,
					eventFromEventOnChain: (e: unknown) => e,
				}),
		],
		[
			"Transactions().fetchTransactionsWithCursor",
			() =>
				new TransactionsApiHelpers(
					new Api(grpcClient, addresses)
				).fetchTransactionsWithCursor({ query: {} }),
		],
		[
			"Sui().fetchSystemState",
			() =>
				new SuiApiHelpers(new Api(grpcClient, addresses)).fetchSystemState(),
		],
	])("%s throws when no jsonRpcClient was provided", async (name, call) => {
		// @dev: asserting on the method name proves the error identifies the
		// *caller*, which is the whole point of threading it through.
		await expect(call()).rejects.toThrow(`${name} requires`);
	});
});
