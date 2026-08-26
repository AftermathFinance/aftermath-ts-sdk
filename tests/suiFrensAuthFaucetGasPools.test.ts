import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import type { ConfigAddresses } from "../src/general/types/configTypes";
import type { SuiObjectView } from "../src/general/utils/grpcCasting";
import type {
	ApiAddSuiFrenAccessoryBody,
	ApiMixSuiFrensBody,
	StakedSuiFrenInfo,
	SuiFrenObject,
} from "../src/packages/suiFrens/suiFrensTypes";

// Load the public graph first. Several SDK modules share runtime references
// through the barrel exports; evaluating the same graph from individual
// package leaves can re-enter `Casting` while it is still initializing under
// Jest's native ESM loader.
const { Auth, Faucet, GasPools, SuiFren, StakedSuiFren, SuiFrens } =
	await import("../src");
await import("../src/general/utils/helpers");
const { FaucetApi } = await import("../src/packages/faucet/api/faucetApi");
const { FaucetApiCasting } = await import(
	"../src/packages/faucet/api/faucetApiCasting"
);
const { SuiFrensApi } = await import(
	"../src/packages/suiFrens/api/suiFrensApi"
);
const { SuiFrensApiCasting } = await import(
	"../src/packages/suiFrens/api/suiFrensApiCasting"
);

type AftermathApiType =
	import("../src/general/providers/aftermathApi").AftermathApi;

type JsonRecord = Record<string, unknown>;

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const API_BASE_URL = "https://sdk.test/";
const WALLET = "0x1";
const OTHER_WALLET = "0x2";
const OBJECT_ONE = "0x10";
const OBJECT_TWO = "0x11";
const OBJECT_THREE = "0x12";
const PAYMENT_COIN = "0x20";
const SUI_TYPE = "0x2::sui::SUI";
const SUI_FREN_TYPE = "0x9::suifrens::SuiFren<0x2::sui::SUI>";
const ACCESSORY_TYPE = "hat";

const FULL_ONE = `0x${"1".padStart(64, "0")}`;
const FULL_TWO = `0x${"2".padStart(64, "0")}`;
const FULL_NINE = `0x${"9".padStart(64, "0")}`;
const FULL_TEN = `0x${"10".padStart(64, "0")}`;
const FULL_ELEVEN = `0x${"11".padStart(64, "0")}`;
const FULL_TWELVE = `0x${"12".padStart(64, "0")}`;
const FULL_SUI = `${FULL_TWO}::sui::SUI`;
const HEX_PREFIX_REGEX = /^0x/;

const ADDRESSES = {
	suiFrens: {
		packages: {
			suiFrens: "0x9",
			suiFrensBullshark: "0x8",
			accessories: "0x10",
			suiFrensVault: "0x11",
			suiFrensVaultCapyLabsExtension: "0x12",
		},
		objects: {
			capyLabsApp: "0x21",
			suiFrensVault: "0x22",
			suiFrensVaultStateV1: "0x23",
			suiFrensVaultStateV1MetadataTable: "0x24",
			suiFrensVaultCapyLabsExtension: "0x25",
		},
	},
	faucet: {
		packages: {
			faucet: "0x31",
			suiFrensGenesisWrapper: "0x32",
		},
		objects: {
			faucet: "0x33",
			config: "0x34",
			suiFrensMint: "0x35",
		},
	},
} as const;

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
	jest.useRealTimers();
});

function wireJson(value: unknown): string {
	return JSON.stringify(value, (_key, currentValue) =>
		typeof currentValue === "bigint" ? `${currentValue}n` : currentValue
	);
}

function installJsonFetch(
	payload: unknown,
	status = 200,
	headers: Record<string, string> = {}
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(
			new Response(wireJson(payload), {
				status,
				headers: { "Content-Type": "application/json", ...headers },
			})
		);
	}) as typeof fetch;
	return calls;
}

function installJsonFetchSequence(
	payloads: readonly unknown[],
	status = 200,
	headers: Record<string, string> = {}
): FetchCall[] {
	if (payloads.length === 0) {
		throw new Error("expected at least one response payload");
	}

	const calls: FetchCall[] = [];
	let payloadIndex = 0;
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		const payload = payloads[Math.min(payloadIndex++, payloads.length - 1)];
		return Promise.resolve(
			new Response(wireJson(payload), {
				status,
				headers: { "Content-Type": "application/json", ...headers },
			})
		);
	}) as typeof fetch;
	return calls;
}

function installRejectingFetch(
	error = new Error("offline sentinel")
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.reject(error);
	}) as typeof fetch;
	return calls;
}

function requestBody(call: FetchCall): JsonRecord {
	if (typeof call.init?.body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(call.init.body) as JsonRecord;
}

function requestUrl(call: FetchCall): string {
	return String(call.input);
}

function fullType(type: string): string {
	const [address, ...suffix] = type.split("::");
	return `0x${address.replace(HEX_PREFIX_REGEX, "").padStart(64, "0")}::${suffix.join("::")}`;
}

function objectView(
	options: {
		objectId?: string;
		type?: string;
		json?: JsonRecord;
		display?: JsonRecord | null;
	} = {}
): SuiObjectView {
	return {
		objectId: options.objectId ?? OBJECT_ONE,
		version: "7",
		digest: "digest-1",
		owner: { AddressOwner: WALLET },
		type: options.type ?? SUI_FREN_TYPE,
		json: options.json ?? {},
		display: options.display ?? { output: {}, errors: null },
	} as unknown as SuiObjectView;
}

function makeSuiFren(overrides: Partial<SuiFrenObject> = {}): SuiFrenObject {
	return {
		objectId: OBJECT_ONE,
		objectType: SUI_FREN_TYPE,
		generation: 2n,
		birthdate: Date.UTC(2020, 0, 15, 12),
		cohort: 4n,
		genes: [1n, 2n, 3n],
		attributes: {
			skin: "stripes",
			main: "6FBBEE",
			secondary: "CF9696",
			expression: "bigSmile",
			ears: "ear1",
		},
		birthLocation: "Capy City",
		mixLimit: 5n,
		lastEpochMixed: 9n,
		display: {
			link: "https://example.test/suifren/1",
			imageUrl: "https://example.test/suifren/1.png",
			description: "A deterministic SuiFren fixture",
			projectUrl: "https://example.test",
		},
		...overrides,
	};
}

function makeMetadata(overrides: Partial<StakedSuiFrenInfo["metadata"]> = {}) {
	return {
		objectId: "0x30",
		objectType: `${FULL_ELEVEN}::vault_state::StakedSuiFrenMetadataV1`,
		suiFrenId: OBJECT_ONE,
		collectedFees: 700n,
		autoStakeFees: true,
		mixFee: 300_000_000n,
		feeIncrementPerMix: 10_000_000n,
		minRemainingMixesToKeep: 2n,
		...overrides,
	};
}

function makeStakedInfo(
	overrides: Partial<StakedSuiFrenInfo> = {}
): StakedSuiFrenInfo {
	return {
		suiFren: makeSuiFren(),
		metadata: makeMetadata(),
		...overrides,
	};
}

function makeEvent(parsedJson: JsonRecord, type = "0x11::events::Event") {
	return {
		id: { txDigest: "digest-event", eventSeq: "0" },
		packageId: "0x11",
		transactionModule: "events",
		sender: WALLET,
		type,
		parsedJson,
		bcs: "",
		timestampMs: "1700000000123",
	};
}

function fakeApi(
	overrides: Record<string, unknown> = {},
	addresses: ConfigAddresses = ADDRESSES
): AftermathApiType {
	return {
		addresses,
		...overrides,
	} as unknown as AftermathApiType;
}

function moveCalls(tx: Transaction): JsonRecord[] {
	return (tx.getData().commands as JsonRecord[]).flatMap((command) =>
		command.$kind === "MoveCall" && typeof command.MoveCall === "object"
			? [command.MoveCall as JsonRecord]
			: []
	);
}

function commands(tx: Transaction): JsonRecord[] {
	return tx.getData().commands as JsonRecord[];
}

function moveCall(tx: Transaction): JsonRecord {
	const call = moveCalls(tx)[0];
	if (!call) {
		throw new Error("expected a MoveCall");
	}
	return call;
}

function asyncMock<T = unknown>() {
	return jest.fn<(...args: unknown[]) => Promise<T>>();
}

function protocolApi(overrides: Record<string, unknown> = {}) {
	const inspections = {
		fetchAllBytesFromTxOutput: asyncMock<unknown>(),
		fetchFirstBytesFromTxOutput: asyncMock<unknown>(),
	};
	const events = {
		fetchCastEventsWithCursor: asyncMock<unknown>().mockResolvedValue({
			events: [],
			nextCursor: null,
		}),
		fetchEventsWithinTime: asyncMock<unknown[]>().mockResolvedValue([]),
	};
	const objects = {
		fetchCastObject: asyncMock<unknown>(),
		fetchCastObjectBatch: asyncMock<unknown[]>(),
		fetchCastObjectsOwnedByAddressOfType: asyncMock<unknown[]>(),
	};
	const dynamicFields = {
		fetchCastDynamicFieldsOfTypeWithCursor: asyncMock<unknown>(),
		fetchCastAllDynamicFieldsOfType: asyncMock<unknown[]>(),
		fetchDynamicFieldsUntil: asyncMock<unknown>(),
	};
	const coin = {
		fetchCoinWithAmountTx: asyncMock<unknown>().mockImplementation((args) =>
			Promise.resolve((args as { tx: Transaction }).tx.object(PAYMENT_COIN))
		),
	};
	const api = fakeApi({
		Inspections: () => inspections,
		Events: () => events,
		Objects: () => objects,
		DynamicFields: () => dynamicFields,
		Coin: () => coin,
		Nfts: () => ({
			fetchOwnedKioskOwnerCaps: asyncMock<unknown[]>().mockResolvedValue([]),
		}),
		...overrides,
	});
	return { api, inspections, events, objects, dynamicFields, coin };
}

describe("SuiFrensApiCasting", () => {
	it("casts CapyLabs app fields and preserves bigint precision", () => {
		const result = SuiFrensApiCasting.capyLabsAppObjectFromSuiObjectResponse(
			objectView({
				type: "0x21::capy_labs::CapyLabsApp",
				json: {
					mixing_limit: "255",
					cool_down_period: "12",
					mixing_price: "9000000000",
					profits: "123456789012345678901234567890",
				},
			})
		);

		expect(result).toEqual({
			objectType: fullType("0x21::capy_labs::CapyLabsApp"),
			objectId: FULL_TEN,
			mixingLimit: 255n,
			coolDownPeriodEpochs: 12n,
			mixingPrice: 9000000000n,
			suiProfits: 123456789012345678901234567890n,
		});
	});

	it("casts a complete SuiFren from gRPC fields and display output", () => {
		const result = SuiFrensApiCasting.partialSuiFrenObjectFromSuiObjectResponse(
			objectView({
				json: {
					generation: "2",
					birthdate: "1579096800000",
					cohort: "4",
					genes: ["1", "9007199254740993"],
					attributes: ["stripes", "6FBBEE", "CF9696", "bigSmile", "ear1"],
					birth_location: "Capy City",
				},
				display: {
					output: {
						link: "https://example.test/link",
						image_url: "https://example.test/image.png",
						description: "description",
						project_url: "https://example.test",
					},
					errors: null,
				},
			})
		);

		expect(result).toEqual({
			objectType: `${FULL_NINE}::suifrens::SuiFren<2::sui::SUI>`,
			objectId: FULL_TEN,
			generation: 2n,
			birthdate: 1_579_096_800_000,
			cohort: 4n,
			genes: [1n, 9007199254740993n],
			attributes: {
				skin: "stripes",
				main: "6FBBEE",
				secondary: "CF9696",
				expression: "bigSmile",
				ears: "ear1",
			},
			birthLocation: "Capy City",
			display: {
				link: "https://example.test/link",
				imageUrl: "https://example.test/image.png",
				description: "description",
				projectUrl: "https://example.test",
			},
		});
	});

	it("casts metadata, including the testnet image rewrite used by staked objects", () => {
		const input = objectView({
			objectId: "0x40",
			json: {
				suifren_id: OBJECT_ONE,
				suifren_type: SUI_FREN_TYPE,
				collected_fees: "700",
				auto_stake_fees: true,
				mix_fee: "300000000",
				fee_increment_per_mix: "10000000",
				min_remaining_mixes_to_keep: "2",
				last_epoch_mixed: "8",
				generation: "2",
				birthdate: "1579096800000",
				cohort: "4",
				genes: ["1"],
				birth_location: "Capy City",
				attributes: ["stripes", "6FBBEE", "CF9696", "bigSmile", "ear1"],
			},
			display: {
				output: {
					link: "link",
					image_url: "https://mainnet.example/image.png",
					description: "description",
					project_url: "project",
				},
				errors: null,
			},
		});

		expect(
			SuiFrensApiCasting.stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse(
				input
			)
		).toEqual({
			objectType: `${FULL_NINE}::suifrens::SuiFren<2::sui::SUI>`,
			objectId: `0x${"40".padStart(64, "0")}`,
			suiFrenId: FULL_TEN,
			collectedFees: 700n,
			autoStakeFees: true,
			mixFee: 300000000n,
			feeIncrementPerMix: 10000000n,
			minRemainingMixesToKeep: 2n,
		});

		expect(
			SuiFrensApiCasting.partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse(
				input
			).display.imageUrl
		).toBe("https://testnet.example/image.png");
	});

	it("casts combined metadata, position, vault state, and accessory objects", () => {
		const metadataView = objectView({
			json: {
				suifren_id: OBJECT_ONE,
				suifren_type: SUI_FREN_TYPE,
				collected_fees: "1",
				auto_stake_fees: false,
				mix_fee: "2",
				fee_increment_per_mix: "3",
				min_remaining_mixes_to_keep: "4",
				generation: "5",
				birthdate: "6",
				cohort: "7",
				genes: ["8"],
				birth_location: "9",
				attributes: ["cheetah", "6FBBEE", "CF9696", "bigSmile", "ear1"],
			},
			display: {
				output: {
					link: "link",
					image_url: "https://mainnet.example/image.png",
					description: "description",
					project_url: "project",
				},
				errors: null,
			},
		});
		const combined =
			SuiFrensApiCasting.partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse(
				metadataView
			);

		expect(combined.stakedSuiFrenMetadata.suiFrenId).toBe(FULL_TEN);
		expect(combined.partialSuiFren.objectId).toBe(FULL_TEN);
		expect(combined.partialSuiFren.attributes.skin).toBe("cheetah");

		expect(
			SuiFrensApiCasting.stakedSuiFrenPositionFromSuiObjectResponse(
				objectView({
					objectId: "0x41",
					json: { suifren_id: OBJECT_TWO },
				})
			)
		).toEqual({
			objectType: `${FULL_NINE}::suifrens::SuiFren<2::sui::SUI>`,
			objectId: `0x${"41".padStart(64, "0")}`,
			suiFrenId: FULL_ELEVEN,
		});

		expect(
			SuiFrensApiCasting.suiFrenVaultStateV1ObjectFromSuiObjectResponse(
				objectView({
					objectId: "0x42",
					type: "0x11::vault_state::VaultState",
					json: {
						suifrens_metadata: { fields: { size: "19" } },
						mixed: "27",
					},
				})
			)
		).toEqual({
			objectType: `${FULL_ELEVEN}::vault_state::VaultState`,
			objectId: `0x${"42".padStart(64, "0")}`,
			stakedSuiFrens: 19n,
			totalMixes: 27n,
		});

		expect(
			SuiFrensApiCasting.accessoryObjectFromSuiObjectResponse(
				objectView({
					objectId: "0x43",
					type: "0x10::accessories::Accessory",
					json: { name: "Top Hat", type: ACCESSORY_TYPE },
					display: { output: { image_url: "https://example.test/hat.png" } },
				})
			)
		).toEqual({
			objectType: `${fullType("0x10::accessories::Accessory")}`,
			objectId: `0x${"43".padStart(64, "0")}`,
			name: "Top Hat",
			type: ACCESSORY_TYPE,
			imageUrl: "https://example.test/hat.png",
		});
	});

	it("casts every SuiFren event with padded ids and bigint fees", () => {
		const base = makeEvent({
			issuer: WALLET,
			suifren_id: OBJECT_ONE,
			parent_one_id: OBJECT_TWO,
			parent_two_id: OBJECT_THREE,
			fee: "12345678901234567890",
			fees: "98765432109876543210",
		});

		expect(
			SuiFrensApiCasting.harvestSuiFrenFeesEventFromOnChain(base as never)
		).toEqual({
			harvester: FULL_ONE,
			fees: 98765432109876543210n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
		expect(
			SuiFrensApiCasting.mixSuiFrensEventFromOnChain(base as never)
		).toEqual({
			mixer: FULL_ONE,
			parentOneId: FULL_ELEVEN,
			parentTwoId: FULL_TWELVE,
			childId: FULL_TEN,
			fee: 12345678901234567890n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
		expect(
			SuiFrensApiCasting.stakeSuiFrenEventFromOnChain(base as never)
		).toEqual({
			staker: FULL_ONE,
			suiFrenId: `0x${"10".padStart(64, "0")}`,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
		expect(
			SuiFrensApiCasting.unstakeSuiFrenEventFromOnChain(base as never)
		).toEqual({
			unstaker: FULL_ONE,
			suiFrenId: `0x${"10".padStart(64, "0")}`,
			fees: 98765432109876543210n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
	});
});

describe("SuiFrensApi", () => {
	it("constructs object and event type metadata and rejects incomplete addresses", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);

		expect(suifrensApi.objectTypes).toEqual({
			suiFren: "0x9::suifrens::SuiFren",
			capy: "0x9::capy::Capy",
			bullshark: "0x8::bullshark::Bullshark",
			suiFrenAccessory: "0x10::accessories::Accessory",
			stakedSuiFrenPosition: "0x11::staked_position::StakedPosition",
			stakedSuiFrenMetadataV1: "0x11::vault_state::StakedSuiFrenMetadataV1",
		});
		expect(suifrensApi.eventTypes).toEqual({
			harvestSuiFrenFees: "0x11::events::HarvestedFeesEvent",
			mixSuiFrens: "0x11::events::MixedSuiFrenEvent",
			stakeSuiFren: "0x11::events::StakedSuiFrenEvent",
			unstakeSuiFren: "0x11::events::UnstakedSuiFrenEvent",
		});
		expect(() => new SuiFrensApi(fakeApi({ addresses: {} }))).toThrow(
			"not all required addresses have been set in provider"
		);
	});

	it("routes event queries with the correct Move event type and preserves pagination", async () => {
		const { api, events } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const inputs = {
			cursor: { txDigest: "cursor-digest", eventSeq: "3" },
			limit: 4,
		};

		await suifrensApi.fetchHarvestSuiFrenFeesEvents(inputs);
		await suifrensApi.fetchMixSuiFrensEvents(inputs);
		await suifrensApi.fetchStakeSuiFrenEvents(inputs);
		await suifrensApi.fetchUnstakeSuiFrenEvents(inputs);

		expect(events.fetchCastEventsWithCursor).toHaveBeenCalledTimes(4);
		expect(
			events.fetchCastEventsWithCursor.mock.calls.map(
				(call: unknown[]) => call[0] as JsonRecord
			)
		).toEqual([
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.harvestSuiFrenFees },
			}),
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.mixSuiFrens },
			}),
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.stakeSuiFren },
			}),
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.unstakeSuiFren },
			}),
		]);
	});

	it("routes object and accessory reads with exact ids, types, and display requirements", async () => {
		const { api, objects, dynamicFields } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		objects.fetchCastObject.mockResolvedValue({ objectId: "capy" });
		objects.fetchCastObjectBatch.mockResolvedValue([]);
		objects.fetchCastObjectsOwnedByAddressOfType.mockResolvedValue([]);
		dynamicFields.fetchCastAllDynamicFieldsOfType.mockResolvedValue([]);

		await suifrensApi.fetchCapyLabsApp();
		await suifrensApi.fetchSuiFrenVaultStateV1Object();
		await suifrensApi.fetchSuiFrens({ suiFrenIds: [OBJECT_ONE, OBJECT_TWO] });
		await suifrensApi.fetchAccessories({ objectIds: [OBJECT_THREE] });
		await suifrensApi.fetchOwnedAccessories({ walletAddress: WALLET });
		await suifrensApi.fetchAccessoriesForSuiFren({ suiFrenId: OBJECT_ONE });

		expect(objects.fetchCastObject.mock.calls[0]?.[0]).toEqual({
			objectId: "0x21",
			objectFromSuiObjectResponse: expect.any(Function),
		});
		expect(objects.fetchCastObject.mock.calls[1]?.[0]).toEqual({
			objectId: "0x23",
			objectFromSuiObjectResponse: expect.any(Function),
		});
		expect(objects.fetchCastObjectBatch.mock.calls[0]?.[0]).toEqual({
			objectIds: [OBJECT_ONE, OBJECT_TWO],
			objectFromSuiObjectResponse: expect.any(Function),
			withDisplay: true,
		});
		expect(objects.fetchCastObjectBatch.mock.calls[1]?.[0]).toEqual({
			objectIds: [OBJECT_THREE],
			objectFromSuiObjectResponse: expect.any(Function),
			withDisplay: true,
		});
		expect(
			objects.fetchCastObjectsOwnedByAddressOfType.mock.calls[0]?.[0]
		).toEqual({
			walletAddress: WALLET,
			objectType: suifrensApi.objectTypes.suiFrenAccessory,
			objectFromSuiObjectResponse: expect.any(Function),
			withDisplay: true,
		});
		expect(
			dynamicFields.fetchCastAllDynamicFieldsOfType.mock.calls[0]?.[0]
		).toEqual(
			expect.objectContaining({
				parentObjectId: OBJECT_ONE,
				dynamicFieldType: suifrensApi.objectTypes.suiFrenAccessory,
			})
		);
	});

	it("decodes inspection output, including optional values and bullshark short-circuits", async () => {
		const { api, inspections } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		inspections.fetchFirstBytesFromTxOutput
			.mockResolvedValueOnce(bcs.option(bcs.u8()).serialize(7).toBytes())
			.mockResolvedValueOnce(
				bcs.option(bcs.u64()).serialize(9007199254740993n).toBytes()
			)
			.mockResolvedValueOnce(
				bcs.vector(bcs.Address).serialize([FULL_ONE, FULL_TWO]).toBytes()
			);

		expect(
			await suifrensApi.fetchMixingLimit({
				suiFrenId: OBJECT_ONE,
				suiFrenType: SUI_FREN_TYPE,
			})
		).toBe(7n);
		expect(
			await suifrensApi.fetchLastEpochMixed({
				suiFrenId: OBJECT_ONE,
				suiFrenType: SUI_FREN_TYPE,
			})
		).toBe(9007199254740993n);
		expect(
			await suifrensApi.fetchStakedSuiFrenMetadataIds({
				suiFrenIds: [OBJECT_ONE, OBJECT_TWO],
			})
		).toEqual([FULL_ONE, FULL_TWO]);
		expect(
			await suifrensApi.fetchMixingLimit({
				suiFrenId: OBJECT_ONE,
				suiFrenType: suifrensApi.objectTypes.bullshark,
			})
		).toBeUndefined();
		expect(inspections.fetchFirstBytesFromTxOutput).toHaveBeenCalledTimes(3);
	});

	it("decodes aligned vectors from the multi-object inspection", async () => {
		const { api, inspections } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		inspections.fetchAllBytesFromTxOutput.mockResolvedValue([
			bcs.vector(bcs.option(bcs.u8())).serialize([7, null]).toBytes(),
			bcs.vector(bcs.option(bcs.u64())).serialize([99n, 100n]).toBytes(),
		]);

		expect(
			await suifrensApi.fetchMixingLimitsAndLastEpochMixeds({
				suiFrenIds: [OBJECT_ONE, OBJECT_TWO],
				suiFrenType: SUI_FREN_TYPE,
			})
		).toEqual([
			{ mixLimit: 7n, lastEpochMixed: 99n },
			{ mixLimit: undefined, lastEpochMixed: 100n },
		]);
	});

	it("completes a partial SuiFren through per-object inspection calls", async () => {
		const { api, objects, inspections } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		objects.fetchCastObjectBatch.mockResolvedValue([
			makeSuiFren({ objectId: OBJECT_ONE }),
		]);
		inspections.fetchFirstBytesFromTxOutput
			.mockResolvedValueOnce(bcs.option(bcs.u8()).serialize(4).toBytes())
			.mockResolvedValueOnce(bcs.option(bcs.u64()).serialize(99n).toBytes());

		const result = await suifrensApi.fetchSuiFrens({
			suiFrenIds: [OBJECT_ONE],
		});

		expect(result.map((item) => [item.objectId, item.mixLimit])).toEqual([
			[OBJECT_ONE, 4n],
		]);
		expect(result[0]?.lastEpochMixed).toBe(99n);
		expect(inspections.fetchFirstBytesFromTxOutput).toHaveBeenCalledTimes(2);
	});

	it("filters staked dynamic fields case-insensitively and advances the cursor after the limit", async () => {
		const { api, dynamicFields } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const infos = [
			makeStakedInfo({
				suiFren: makeSuiFren({ objectId: OBJECT_ONE }),
			}),
			makeStakedInfo({
				suiFren: makeSuiFren({
					objectId: OBJECT_TWO,
					attributes: { ...makeSuiFren().attributes, skin: "cheetah" },
				}),
			}),
			makeStakedInfo({
				suiFren: makeSuiFren({ objectId: OBJECT_THREE }),
			}),
		];
		dynamicFields.fetchDynamicFieldsUntil.mockResolvedValue({
			dynamicFieldObjects: infos,
			nextCursor: "server-cursor",
		});

		const result =
			await suifrensApi.fetchStakedSuiFrensDynamicFieldsWithFilters({
				attributes: { Skin: "STRIPES" } as never,
				limit: 1,
				cursor: "client-cursor",
			});

		expect(
			result.dynamicFieldObjects.map((item) => item.suiFren.objectId)
		).toEqual([OBJECT_ONE]);
		expect(result.nextCursor).toBe(OBJECT_THREE);
		expect(dynamicFields.fetchDynamicFieldsUntil).toHaveBeenCalledWith(
			expect.objectContaining({
				attributes: { Skin: "STRIPES" },
				limit: 1,
				cursor: "client-cursor",
			})
		);
	});

	it("builds every public SuiFren transaction command with the expected Move target", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const cases: Array<{
			name: string;
			build: (tx: Transaction) => unknown;
			module: string;
			package: string;
			args: number;
		}> = [
			{
				name: "metadata inspection",
				build: (tx) =>
					suifrensApi.devInspectMetadataObjectIdMulTx({
						tx,
						suiFrenIds: [OBJECT_ONE],
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 2,
			},
			{
				name: "mixing limits inspection",
				build: (tx) =>
					suifrensApi.devInspectMixLimitAndLastEpochMixedMulTx({
						tx,
						suiFrenIds: [OBJECT_ONE],
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 3,
			},
			{
				name: "mix owned",
				build: (tx) =>
					suifrensApi.mixAndKeepTx({
						tx,
						parentOneId: OBJECT_ONE,
						parentTwoId: OBJECT_TWO,
						suiPaymentCoinId: PAYMENT_COIN,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 7,
			},
			{
				name: "mix with staked",
				build: (tx) =>
					suifrensApi.mixWithStakedAndKeepTx({
						tx,
						nonStakedParentId: OBJECT_ONE,
						stakedParentId: OBJECT_TWO,
						suiPaymentCoinId: PAYMENT_COIN,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 7,
			},
			{
				name: "mix staked with staked",
				build: (tx) =>
					suifrensApi.mixStakedWithStakedAndKeepTx({
						tx,
						parentOneId: OBJECT_ONE,
						parentTwoId: OBJECT_TWO,
						suiPaymentCoinId: PAYMENT_COIN,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 7,
			},
			{
				name: "stake",
				build: (tx) =>
					suifrensApi.stakeAndKeepTx({
						tx,
						suiFrenId: OBJECT_ONE,
						autoStakeFees: true,
						baseFee: 1n,
						feeIncrementPerMix: 2n,
						minRemainingMixesToKeep: 3n,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 8,
			},
			{
				name: "unstake",
				build: (tx) =>
					suifrensApi.unstakeAndKeepTx({
						tx,
						stakedPositionId: OBJECT_ONE,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 3,
			},
			{
				name: "begin harvest",
				build: (tx) => suifrensApi.beginHarvestTx({ tx }),
				package: FULL_ELEVEN,
				module: "vault",
				args: 0,
			},
			{
				name: "harvest",
				build: (tx) =>
					suifrensApi.harvestTx({
						tx,
						stakedPositionId: OBJECT_ONE,
						harvestFeesEventMetadataId: OBJECT_TWO,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 3,
			},
			{
				name: "end harvest",
				build: (tx) =>
					suifrensApi.endHarvestTx({
						harvestFeesEventMetadataId: OBJECT_TWO,
						tx,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 1,
			},
			{
				name: "add accessory",
				build: (tx) =>
					suifrensApi.addAccessoryTx({
						tx,
						suiFrenId: OBJECT_ONE,
						accessoryId: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 3,
			},
			{
				name: "add owned accessory",
				build: (tx) =>
					suifrensApi.addAccessoryToOwnedSuiFrenTx({
						tx,
						suiFrenId: OBJECT_ONE,
						accessoryId: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 2,
			},
			{
				name: "remove accessory",
				build: (tx) =>
					suifrensApi.removeAccessoryAndKeepTx({
						tx,
						stakedPositionId: OBJECT_ONE,
						accessoryType: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 3,
			},
			{
				name: "remove owned accessory",
				build: (tx) =>
					suifrensApi.removeAccessoryFromOwnedSuiFrenAndKeepTx({
						tx,
						suiFrenId: OBJECT_ONE,
						accessoryType: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 2,
			},
		];

		for (const testCase of cases) {
			const tx = new Transaction();
			testCase.build(tx);
			const call = moveCall(tx);
			expect(call).toEqual(
				expect.objectContaining({
					package: testCase.package,
					module: testCase.module,
					arguments: expect.arrayContaining([]),
				})
			);
			expect((call.arguments as unknown[]).length).toBe(testCase.args);
		}
	});

	it("builds stake and unstake transactions with wallet sender and typed values", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const stakeTx = suifrensApi.fetchStakeTx({
			walletAddress: WALLET,
			suiFrenId: OBJECT_ONE,
			baseFee: 10n,
			feeIncrementPerMix: 20n,
			minRemainingMixesToKeep: 3n,
			suiFrenType: SUI_FREN_TYPE,
		});
		const stakeCall = moveCall(stakeTx);
		expect(stakeTx.getData().sender).toBe(FULL_ONE);
		expect(stakeCall.function).toBe("stake_and_keep");
		expect(stakeCall.typeArguments).toEqual([SUI_FREN_TYPE]);

		const unstakeTx = suifrensApi.fetchUnstakeTx({
			walletAddress: WALLET,
			stakedPositionId: OBJECT_TWO,
			suiFrenType: SUI_FREN_TYPE,
		});
		expect(unstakeTx.getData().sender).toBe(FULL_ONE);
		expect(moveCall(unstakeTx).function).toBe("unstake_and_keep");
	});

	it("selects all mixing branches and calculates exact bigint payment fees", async () => {
		const { api, coin } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const base: Omit<
			ApiMixSuiFrensBody,
			"suiFrenParentOne" | "suiFrenParentTwo"
		> = {
			baseFee: 100n,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
			isSponsoredTx: true,
		};

		const noneStaked = await suifrensApi.fetchBuildMixTx({
			...base,
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: undefined },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: undefined },
		});
		expect(moveCall(noneStaked).function).toBe("mix_and_keep");
		expect(coin.fetchCoinWithAmountTx.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				coinAmount: 250000100n,
				isSponsoredTx: true,
			})
		);

		const oneStaked = await suifrensApi.fetchBuildMixTx({
			...base,
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: 300000000n },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: undefined },
		});
		expect(moveCall(oneStaked).function).toBe("mix_with_staked_and_keep");
		expect(coin.fetchCoinWithAmountTx.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({ coinAmount: 550000100n })
		);

		const bothStaked = await suifrensApi.fetchBuildMixTx({
			...base,
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: 300000000n },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: 3000000000n },
		});
		expect(moveCall(bothStaked).function).toBe(
			"mix_staked_with_staked_and_keep"
		);
		expect(coin.fetchCoinWithAmountTx.mock.calls[2]?.[0]).toEqual(
			expect.objectContaining({ coinAmount: 3850000100n })
		);
		-expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: undefined,
				mixFee2: undefined,
			})
		).toBe(250000000n);
	});

	it("builds harvest transactions with merge/transfer behavior for one and many positions", async () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const one = await suifrensApi.fetchBuildHarvestFeesTx({
			walletAddress: WALLET,
			stakedPositionIds: [OBJECT_ONE],
		});
		expect(one.getData().sender).toBe(FULL_ONE);
		expect(commands(one).map((command) => command.$kind)).toEqual([
			"MoveCall",
			"MoveCall",
			"TransferObjects",
			"MoveCall",
		]);

		const many = await suifrensApi.fetchBuildHarvestFeesTx({
			walletAddress: OTHER_WALLET,
			stakedPositionIds: [OBJECT_ONE, OBJECT_TWO],
		});
		expect(commands(many).map((command) => command.$kind)).toEqual([
			"MoveCall",
			"MoveCall",
			"MoveCall",
			"MergeCoins",
			"TransferObjects",
			"MoveCall",
		]);
		expect(many.getData().sender).toBe(FULL_TWO);
	});

	it("chooses owned versus staked accessory transaction variants", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const common: ApiAddSuiFrenAccessoryBody = {
			suiFrenId: OBJECT_ONE,
			accessoryId: OBJECT_TWO,
			isOwned: true,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
		};

		expect(
			moveCall(suifrensApi.fetchBuildAddAccessoryTx(common)).function
		).toBe("add_accessory_to_owned_suifren");
		expect(
			moveCall(
				suifrensApi.fetchBuildAddAccessoryTx({ ...common, isOwned: false })
			).function
		).toBe("add_accessory");
		expect(
			moveCall(
				suifrensApi.fetchBuildRemoveAccessoryTx({
					suiFrenId: OBJECT_ONE,
					accessoryType: OBJECT_THREE,
					suiFrenType: SUI_FREN_TYPE,
					walletAddress: WALLET,
				})
			).function
		).toBe("remove_accessory_from_owned_suifren_and_keep");
		expect(
			moveCall(
				suifrensApi.fetchBuildRemoveAccessoryTx({
					stakedPositionId: OBJECT_ONE,
					accessoryType: OBJECT_THREE,
					suiFrenType: SUI_FREN_TYPE,
					walletAddress: WALLET,
				})
			).function
		).toBe("remove_accessory_and_keep");
	});

	it("aggregates stats and performs case-insensitive attribute filtering", async () => {
		const { api, events } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		jest
			.spyOn(suifrensApi, "fetchSuiFrenVaultStateV1Object")
			.mockResolvedValue({
				objectId: "0x23",
				objectType: "0x11::vault_state::VaultState",
				stakedSuiFrens: 8n,
				totalMixes: 13n,
			});
		events.fetchEventsWithinTime.mockResolvedValue([
			{ fee: 100n },
			{ fee: 250n },
		]);

		expect(await suifrensApi.fetchSuiFrenStats()).toEqual({
			totalMixes: 13n,
			currentTotalStaked: 8n,
			mixingVolume24hr: 2,
			mixingFees24hr: 350n,
		});
		expect(events.fetchEventsWithinTime).toHaveBeenCalledWith(
			expect.objectContaining({ timeMs: 24 * 60 * 60 * 1000 })
		);

		const first = makeSuiFren({ objectId: OBJECT_ONE });
		const second = makeSuiFren({
			objectId: OBJECT_TWO,
			attributes: { ...first.attributes, skin: "cheetah" },
		});
		const all = [first, second];
		expect(
			suifrensApi.filterSuiFrensWithAttributes({
				suiFrens: all,
				attributes: {},
			})
		).toBe(all);
		expect(
			suifrensApi.filterSuiFrensWithAttributes({
				suiFrens: all,
				attributes: { SKIN: "CHEETAH" } as never,
			})
		).toEqual([second]);
	});
});

describe("SuiFren and StakedSuiFren wrappers", () => {
	it("exposes display properties, dynamic fields, type helpers, and cloning flags", () => {
		const config = { baseUrl: API_BASE_URL, accessToken: "token" };
		const suiFren = new SuiFren(makeSuiFren(), config, true, true);

		expect(suiFren.suiFrenType()).toBe(SUI_TYPE);
		expect(suiFren.properties()).toEqual({
			Skin: "stripes",
			Ears: "ear1",
			Expression: "bigSmile",
			"Main Color": "6FBBEE",
			"Secondary Color": "CF9696",
			"Birth Location": "Capy City",
			Birthday: "January 15, 2020",
			Cohort: "4",
			Generation: "2",
		});
		expect(suiFren.dynamicFields()).toEqual({
			"Mixes Remaining": "5",
			"Last Epoch Mixed": "9",
		});
		expect(suiFren.displayNumber()).toBe("0X1");
		const clone = suiFren.clone();
		expect(clone).toBeInstanceOf(SuiFren);
		expect(clone.suiFren).toBe(suiFren.suiFren);
		expect(clone.isStaked).toBe(true);
		expect(clone.isOwned).toBe(true);
	});

	it("maps SuiFren object calls and enforces stake/removal preconditions", async () => {
		const suiFrenApi = {
			fetchStakeTx: asyncMock<string>().mockResolvedValue("stake-tx"),
			fetchBuildAddAccessoryTx: asyncMock<string>().mockResolvedValue("add-tx"),
			fetchBuildRemoveAccessoryTx:
				asyncMock<string>().mockResolvedValue("remove-tx"),
		};
		const api = fakeApi({ SuiFrens: () => suiFrenApi });
		const owned = new SuiFren(
			makeSuiFren(),
			{ baseUrl: API_BASE_URL },
			false,
			true,
			api
		);

		await expect(
			owned.getStakeTransaction({
				baseFee: 1n,
				feeIncrementPerMix: 2n,
				minRemainingMixesToKeep: 3n,
				walletAddress: WALLET,
			})
		).resolves.toBe("stake-tx");
		expect(suiFrenApi.fetchStakeTx).toHaveBeenCalledWith({
			baseFee: 1n,
			feeIncrementPerMix: 2n,
			minRemainingMixesToKeep: 3n,
			walletAddress: WALLET,
			suiFrenType: SUI_TYPE,
			suiFrenId: OBJECT_ONE,
		});
		await owned.getAddAccessoryTransaction({
			accessoryId: OBJECT_TWO,
			walletAddress: WALLET,
		});
		expect(suiFrenApi.fetchBuildAddAccessoryTx).toHaveBeenCalledWith({
			accessoryId: OBJECT_TWO,
			walletAddress: WALLET,
			isOwned: true,
			suiFrenType: SUI_TYPE,
			suiFrenId: OBJECT_ONE,
		});
		await owned.getRemoveAccessoryTransaction({
			accessoryType: ACCESSORY_TYPE,
			walletAddress: WALLET,
		});
		expect(suiFrenApi.fetchBuildRemoveAccessoryTx).toHaveBeenCalledWith({
			accessoryType: ACCESSORY_TYPE,
			walletAddress: WALLET,
			suiFrenType: SUI_TYPE,
			suiFrenId: OBJECT_ONE,
		});

		const staked = new SuiFren(makeSuiFren(), undefined, true, true, api);
		await expect(
			staked.getStakeTransaction({
				baseFee: 1n,
				feeIncrementPerMix: 2n,
				minRemainingMixesToKeep: 3n,
				walletAddress: WALLET,
			})
		).rejects.toThrow("unable to stake already staked suiFren");

		const notOwned = new SuiFren(makeSuiFren(), undefined, false, false, api);
		await expect(
			notOwned.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).rejects.toThrow(
			"unable to remove accessory from suiFren that is not owned by caller"
		);
		await expect(
			new SuiFren(makeSuiFren()).getStakeTransaction({
				baseFee: 1n,
				feeIncrementPerMix: 2n,
				minRemainingMixesToKeep: 3n,
				walletAddress: WALLET,
			})
		).rejects.toThrow("missing AftermathApi instance");
	});

	it("uses the wrapper HTTP seam for accessories and preserves bigint request values", async () => {
		const calls = installJsonFetch([
			{
				objectId: "0x50",
				objectType: "0x10::accessories::Accessory",
				name: "Hat",
				type: ACCESSORY_TYPE,
				imageUrl: "image",
			},
		]);
		const suiFren = new SuiFren(makeSuiFren(), { baseUrl: API_BASE_URL });
		expect(await suiFren.getAccessories()).toEqual([
			{
				objectId: "0x50",
				objectType: "0x10::accessories::Accessory",
				name: "Hat",
				type: ACCESSORY_TYPE,
				imageUrl: "image",
			},
		]);
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/sui-frens/accessories`
		);
		expect(requestBody(calls[0])).toEqual({ suiFrenId: OBJECT_ONE });
	});

	it("maps staked wrapper calls and rejects absent positions or unowned mutations", async () => {
		const suiFrenApi = {
			fetchUnstakeTx: asyncMock<string>().mockResolvedValue("unstake-tx"),
			fetchBuildHarvestFeesTx:
				asyncMock<string>().mockResolvedValue("harvest-tx"),
			fetchBuildRemoveAccessoryTx:
				asyncMock<string>().mockResolvedValue("remove-tx"),
		};
		const api = fakeApi({ SuiFrens: () => suiFrenApi });
		const info = makeStakedInfo({
			position: {
				objectId: "0x60",
				objectType: "0x11::staked_position::Position",
				suiFrenId: OBJECT_ONE,
			},
		});
		const staked = new StakedSuiFren(
			info,
			{ baseUrl: API_BASE_URL },
			true,
			api
		);

		expect(staked.mixFee()).toBe(300000000n);
		expect(staked.suiFrenId()).toBe(OBJECT_ONE);
		await expect(
			staked.getUnstakeTransaction({ walletAddress: WALLET })
		).resolves.toBe("unstake-tx");
		expect(suiFrenApi.fetchUnstakeTx).toHaveBeenCalledWith({
			walletAddress: WALLET,
			suiFrenType: SUI_TYPE,
			stakedPositionId: "0x60",
		});
		await expect(
			staked.getHarvestFeesTransaction({ walletAddress: WALLET })
		).resolves.toBe("harvest-tx");
		expect(suiFrenApi.fetchBuildHarvestFeesTx).toHaveBeenCalledWith({
			walletAddress: WALLET,
			stakedPositionIds: ["0x60"],
		});
		await expect(
			staked.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).resolves.toBe("remove-tx");

		const clone = staked.clone();
		expect(clone.info).toBe(info);
		expect(clone.isOwned).toBe(true);
		expect(clone.suiFren.isStaked).toBe(true);

		const noPosition = new StakedSuiFren(
			makeStakedInfo(),
			undefined,
			true,
			api
		);
		await expect(
			noPosition.getUnstakeTransaction({ walletAddress: WALLET })
		).rejects.toThrow("no position found on suiFren");
		await expect(
			noPosition.getHarvestFeesTransaction({ walletAddress: WALLET })
		).rejects.toThrow("no position found on suiFren");
		await expect(
			noPosition.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).rejects.toThrow("no position found on suiFren");
		const unowned = new StakedSuiFren(info, undefined, false, api);
		await expect(
			unowned.getHarvestFeesTransaction({ walletAddress: WALLET })
		).rejects.toThrow(
			"unable to remove accessory from suiFren that is not owned by caller"
		);
		await expect(
			unowned.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).rejects.toThrow(
			"unable to remove accessory from suiFren that is not owned by caller"
		);
	});
});

describe("SuiFrens facade", () => {
	it("calculates protocol mix fees across owned, singly staked, and doubly staked inputs", () => {
		expect(SuiFrens.constants.mixingFeeCoinType).toBe(FULL_SUI);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: undefined,
				mixFee2: undefined,
			})
		).toBe(250000000n);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: 300000000n,
				mixFee2: undefined,
			})
		).toBe(550000000n);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: undefined,
				mixFee2: 300000000n,
			})
		).toBe(550000000n);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: 300000000n,
				mixFee2: 3000000000n,
			})
		).toBe(3850000000n);
	});

	it("maps read, event, stats, pagination, and optional query requests", async () => {
		const response = {
			objectId: OBJECT_ONE,
			objectType: SUI_FREN_TYPE,
			generation: "2n",
			birthdate: 1_579_096_800_000,
			cohort: "4n",
			genes: ["1n"],
			attributes: {
				skin: "stripes",
				main: "6FBBEE",
				secondary: "CF9696",
				expression: "bigSmile",
				ears: "ear1",
			},
			birthLocation: "Capy City",
			display: {
				link: "link",
				imageUrl: "image",
				description: "description",
				projectUrl: "project",
			},
		};
		const calls = installJsonFetchSequence([
			[response],
			[response],
			[{ suiFren: response, metadata: makeMetadata() }],
			[{ suiFren: response, metadata: makeMetadata() }],
			{
				dynamicFieldObjects: [{ suiFren: response, metadata: makeMetadata() }],
				nextCursor: "next",
			},
			[{ suiFren: response, metadata: makeMetadata() }],
			{
				mixingLimit: "1n",
				coolDownPeriodEpochs: "2n",
				mixingPrice: "3n",
				suiProfits: "4n",
				objectId: "0x21",
				objectType: "0x21::capy_labs::App",
			},
			[
				{
					objectId: "0x50",
					objectType: "0x10::accessories::Accessory",
					name: "Hat",
					type: ACCESSORY_TYPE,
					imageUrl: "image",
				},
			],
			{ events: [], nextCursor: null },
			{ events: [], nextCursor: null },
			{ events: [], nextCursor: null },
			{ events: [], nextCursor: null },
			{
				totalMixes: "9n",
				currentTotalStaked: "3n",
				mixingFees24hr: "4n",
				mixingVolume24hr: 2,
			},
		]);
		const suifrens = new SuiFrens({
			baseUrl: API_BASE_URL,
			accessToken: "token",
		});

		expect(
			(await suifrens.getSuiFrens({ suiFrenObjectIds: [OBJECT_ONE] }))[0]
		).toBeInstanceOf(SuiFren);
		expect(
			await suifrens.getSuiFren({ suiFrenObjectId: OBJECT_ONE })
		).toBeInstanceOf(SuiFren);
		expect(
			(await suifrens.getOwnedSuiFrens({ walletAddress: WALLET }))[0]?.isOwned
		).toBe(true);
		expect(
			(await suifrens.getOwnedStakedSuiFrens({ walletAddress: WALLET }))[0]
				?.isOwned
		).toBe(true);
		expect(
			(
				await suifrens.getAllStakedSuiFrens({
					attributes: { skin: "stripes" },
					sortBy: "Price (low to high)",
					cursor: "cursor",
					limit: 3,
				} as never)
			).nextCursor
		).toBe("next");
		expect(
			(await suifrens.getStakedSuiFrens({ stakedSuiFrenIds: [OBJECT_ONE] }))[0]
		).toBeInstanceOf(StakedSuiFren);
		expect(await suifrens.getCapyLabsApp()).toEqual(
			expect.objectContaining({ mixingLimit: 1n })
		);
		expect(
			await suifrens.getOwnedAccessories({ walletAddress: WALLET })
		).toHaveLength(1);
		await suifrens.getHarvestFeesEvents({ limit: 1 });
		await suifrens.getMixEvents({
			cursor: { txDigest: "digest", eventSeq: "0" },
		});
		await suifrens.getStakeEvents({});
		await suifrens.getUnstakeEvents({});
		expect(await suifrens.getStats()).toEqual({
			totalMixes: 9n,
			currentTotalStaked: 3n,
			mixingFees24hr: 4n,
			mixingVolume24hr: 2,
		});

		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/sui-frens/["0x10"]`
		);
		expect(requestBody(calls[2])).toEqual({ walletAddress: WALLET });
		expect(requestUrl(calls[4])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/sui-frens/filtered-staked-sui-frens/?sort=Price (low to high)&skin=stripes`
		);
		expect(requestBody(calls[4])).toEqual({
			attributes: { skin: "stripes" },
			sortBy: "Price (low to high)",
			cursor: "cursor",
			limit: 3,
		});
		expect(
			(calls[0].init?.headers as Record<string, string>).Authorization
		).toBe("Bearer token");
	});

	it("maps transaction methods and static wrapper helpers, with missing-provider errors", async () => {
		const suiFrenApi = {
			fetchBuildMixTx: asyncMock<string>().mockResolvedValue("mix-tx"),
			fetchBuildHarvestFeesTx:
				asyncMock<string>().mockResolvedValue("harvest-tx"),
		};
		const api = fakeApi({ SuiFrens: () => suiFrenApi });
		const suifrens = new SuiFrens(undefined, api);
		const mixInput: ApiMixSuiFrensBody = {
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: undefined },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: 1n },
			baseFee: 2n,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
		};
		await expect(suifrens.getMixTransaction(mixInput)).resolves.toBe("mix-tx");
		await expect(
			suifrens.getHarvestFeesTransaction({
				stakedPositionIds: [OBJECT_ONE],
				walletAddress: WALLET,
			})
		).resolves.toBe("harvest-tx");
		expect(suiFrenApi.fetchBuildMixTx).toHaveBeenCalledWith(mixInput);

		const owned = new SuiFren(makeSuiFren(), undefined, false, true);
		const staked = new StakedSuiFren(
			makeStakedInfo({
				position: {
					objectId: "0x60",
					objectType: "position",
					suiFrenId: OBJECT_ONE,
				},
			})
		);
		expect(SuiFrens.suiFren(owned)).toBe(owned);
		expect(SuiFrens.suiFren(staked)).toBe(staked.suiFren);
		expect(SuiFrens.suiFren(undefined)).toBeUndefined();
		expect(SuiFrens.suiFrenId(owned)).toBe(OBJECT_ONE);
		expect(SuiFrens.suiFrenId(staked)).toBe(OBJECT_ONE);
		expect(SuiFrens.mixFee(staked)).toBe(300000000n);
		expect(SuiFrens.mixFee(owned)).toBeUndefined();

		await expect(new SuiFrens().getMixTransaction(mixInput)).rejects.toThrow(
			"missing AftermathApi instance"
		);
	});
});

describe("FaucetApi and Faucet", () => {
	it("constructs event types, casts events, and derives supported coins from add events", async () => {
		const events = {
			fetchCastEventsWithCursor: asyncMock<unknown>().mockResolvedValue({
				events: [
					{
						coinType:
							"0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
					},
				],
				nextCursor: null,
			}),
		};
		const api = fakeApi({ Events: () => events });
		const faucetApi = new FaucetApi(api);
		expect(faucetApi.eventTypes).toEqual({
			mintCoin: "0x31::faucet::MintedCoin",
			addCoin: "0x31::faucet::AddedCoin",
		});
		expect(await faucetApi.fetchSupportedCoins()).toEqual([FULL_SUI]);
		expect(events.fetchCastEventsWithCursor.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				query: { MoveEventType: faucetApi.eventTypes.addCoin },
			})
		);
		expect(() => new FaucetApi(fakeApi({ addresses: {} }))).toThrow(
			"not all required addresses have been set in provider"
		);

		const mint = FaucetApiCasting.faucetMintCoinEventFromOnChain(
			makeEvent(
				{ amount: "9007199254740993", user: WALLET },
				"0x31::faucet::MintedCoin<0x2::sui::SUI>"
			) as never
		);
		expect(mint).toEqual({
			coinType: FULL_SUI,
			minter: FULL_ONE,
			amount: 9007199254740993n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: "0x31::faucet::MintedCoin<0x2::sui::SUI>",
		});
		expect(
			FaucetApiCasting.faucetAddCoinEventFromOnChain(
				makeEvent(
					{ default_mint_amount: "123" },
					"0x31::faucet::AddedCoin<0x2::sui::SUI>"
				) as never
			)
		).toEqual({
			coinType: FULL_SUI,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: "0x31::faucet::AddedCoin<0x2::sui::SUI>",
		});
	});

	it("builds request and SuiFren mint Move transactions with exact addresses", async () => {
		const coinApi = {
			fetchCoinWithAmountTx: jest.fn(async ({ tx }: { tx: Transaction }) =>
				tx.object(PAYMENT_COIN)
			),
		};
		const faucetApi = new FaucetApi(fakeApi({ Coin: () => coinApi }));
		const request = faucetApi.buildRequestCoinTx({
			coinType: SUI_TYPE,
			walletAddress: WALLET,
		});
		expect(request.getData().sender).toBe(FULL_ONE);
		expect(moveCall(request)).toEqual(
			expect.objectContaining({
				package: `0x${"31".padStart(64, "0")}`,
				module: "faucet",
				function: "mint",
				typeArguments: [SUI_TYPE],
			})
		);
		expect(commands(request).map((command) => command.$kind)).toEqual([
			"MoveCall",
			"TransferObjects",
		]);

		const mint = await faucetApi.fetchBuildMintSuiFrenTx({
			mintFee: 8000000000n,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
		});
		expect(coinApi.fetchCoinWithAmountTx).toHaveBeenCalledWith(
			expect.objectContaining({
				walletAddress: WALLET,
				coinType: FULL_SUI,
				coinAmount: 8000000000n,
				tx: expect.any(Transaction),
			})
		);
		expect(moveCall(mint)).toEqual(
			expect.objectContaining({
				package: `0x${"32".padStart(64, "0")}`,
				module: "genesis_wrapper",
				function: "mint_and_keep",
				typeArguments: [SUI_FREN_TYPE],
			})
		);
	});

	it("routes Faucet facade calls and event pagination, and reports missing providers", async () => {
		const faucetApi = {
			buildRequestCoinTx: jest.fn().mockReturnValue("request-tx"),
			fetchBuildMintSuiFrenTx: asyncMock<string>().mockResolvedValue("mint-tx"),
		};
		const api = fakeApi({ Faucet: () => faucetApi });
		const faucet = new Faucet({ baseUrl: API_BASE_URL }, api);
		const calls = installJsonFetch([SUI_TYPE]);
		expect(await faucet.getSupportedCoins()).toEqual([SUI_TYPE]);
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/faucet/supported-coins`
		);
		expect(
			faucet.getRequestCoinTransaction({
				coinType: SUI_TYPE,
				walletAddress: WALLET,
			})
		).toBe("request-tx");
		await expect(
			faucet.getMintSuiFrenTransaction({
				mintFee: 1n,
				suiFrenType: SUI_FREN_TYPE,
				walletAddress: WALLET,
			})
		).resolves.toBe("mint-tx");
		expect(() =>
			new Faucet().getMintSuiFrenTransaction({
				mintFee: 1n,
				suiFrenType: SUI_FREN_TYPE,
				walletAddress: WALLET,
			})
		).toThrow("missing AftermathApi instance");
		expect(() =>
			new Faucet().getRequestCoinTransaction({
				coinType: SUI_TYPE,
				walletAddress: WALLET,
			})
		).toThrow("missing AftermathApi instance");
	});
});

describe("Auth", () => {
	it("signs and posts deterministic access-token messages, schedules refresh, and cancels it", async () => {
		jest.useFakeTimers();
		jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
		jest.spyOn(Math, "random").mockReturnValue(0.25);
		const calls = installJsonFetch({
			accessToken: "access-token",
			header: "Authorization",
			expirationTimestamp: 1_700_001_000_000,
		});
		const messages: string[] = [];
		const signMessageCallback = jest.fn(
			({ message }: { message: Uint8Array }) => {
				messages.push(new TextDecoder().decode(message));
				return Promise.resolve({ signature: "signature-1" });
			}
		);
		const auth = new Auth({ baseUrl: API_BASE_URL });

		const stop = await auth.init({
			walletAddress: WALLET,
			signMessageCallback,
		});
		const serialized = JSON.parse(messages[0] ?? "{}");
		expect(serialized).toEqual({
			date: 1_700_000_000,
			nonce: 262_144,
			method: "GetAccessToken",
			value: {},
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/auth/access-token`
		);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: FULL_ONE,
			signature: "signature-1",
			serializedJson: messages[0],
		});
		expect(auth.config.accessToken).toBe("access-token");
		expect(signMessageCallback).toHaveBeenCalledTimes(1);
		stop();
		await jest.advanceTimersByTimeAsync(2_000_000);
		expect(signMessageCallback).toHaveBeenCalledTimes(1);
	});

	it("serializes admin account creation data and forwards the signed request", async () => {
		const calls = installJsonFetch(true);
		const messages: string[] = [];
		const auth = new Auth({ baseUrl: API_BASE_URL });
		await expect(
			auth.adminCreateAuthAccount({
				walletAddress: WALLET,
				accountWalletAddress: OTHER_WALLET,
				accountName: "sub-account",
				rateLimits: [{ p: "/pools", m: { GET: { l: 10 }, POST: { l: 2 } } }],
				signMessageCallback: ({ message }) => {
					messages.push(new TextDecoder().decode(message));
					return Promise.resolve({ signature: "admin-signature" });
				},
			})
		).resolves.toBe(true);
		const serialized = JSON.parse(messages[0] ?? "{}");
		expect(serialized.method).toBe("AccountCreate");
		expect(serialized.value).toEqual({
			sub: "sub-account",
			wallet_address: FULL_TWO,
			rate_limits: [{ p: "/pools", m: { GET: { l: 10 }, POST: { l: 2 } } }],
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/auth/create-account`
		);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: FULL_ONE,
			signature: "admin-signature",
			serializedJson: messages[0],
		});
	});

	it("classifies auth HTTP and network failures at the public boundary", async () => {
		installJsonFetch({ error: "denied" }, 401);
		await expect(
			new Auth({ baseUrl: API_BASE_URL }).adminCreateAuthAccount({
				walletAddress: WALLET,
				accountWalletAddress: OTHER_WALLET,
				accountName: "name",
				rateLimits: [],
				signMessageCallback: () => Promise.resolve({ signature: "sig" }),
			})
		).rejects.toEqual(expect.objectContaining({ kind: "http", status: 401 }));

		const calls = installRejectingFetch();
		await expect(
			new Auth({ baseUrl: API_BASE_URL }).adminCreateAuthAccount({
				walletAddress: WALLET,
				accountWalletAddress: OTHER_WALLET,
				accountName: "name",
				rateLimits: [],
				signMessageCallback: () => Promise.resolve({ signature: "sig" }),
			})
		).rejects.toEqual(expect.objectContaining({ kind: "network" }));
		expect(calls).toHaveLength(1);
	});
});

describe("GasPools", () => {
	function mockTransactionDecoders() {
		const decoded = { decoded: true } as unknown as Transaction;
		jest.spyOn(Transaction, "fromKind").mockReturnValue(decoded);
		return decoded;
	}

	it("maps pool reads with bigint response values and optional gasPoolId", async () => {
		const calls = installJsonFetch({
			walletAddress: WALLET,
			gasPoolId: null,
			balance: "12345678901234567890n",
			whitelistedAddresses: [WALLET, OTHER_WALLET],
		});
		const gasPools = new GasPools({
			baseUrl: API_BASE_URL,
			accessToken: "gas-token",
		});
		expect(await gasPools.getPool({ walletAddress: WALLET })).toEqual({
			walletAddress: WALLET,
			gasPoolId: undefined,
			balance: 12345678901234567890n,
			whitelistedAddresses: [WALLET, OTHER_WALLET],
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/pool`
		);
		expect(requestBody(calls[0])).toEqual({ walletAddress: WALLET });
		expect(
			(calls[0].init?.headers as Record<string, string>).Authorization
		).toBe("Bearer gas-token");
	});

	it("maps create/deposit/withdraw/grant/revoke/share request bodies and tx-kind options", async () => {
		const decoded = mockTransactionDecoders();
		const tx = new Transaction();
		const transactionHelper = {
			fetchBase64TxKindFromTx: jest.fn(
				async ({ tx: input }: { tx?: Transaction }) =>
					input ? "client-kind" : undefined
			),
		};
		const api = fakeApi({ Transactions: () => transactionHelper });
		const gasPools = new GasPools({ baseUrl: API_BASE_URL }, api);
		const responses = [
			{
				txKind: "create-kind",
				gasPoolArg: "gas-arg",
				sharePolicyArg: "policy-arg",
			},
			{ txKind: "deposit-kind" },
			{ txKind: "withdraw-kind", withdrawnCoinArg: "withdrawn-arg" },
			{ txKind: "grant-kind" },
			{ txKind: "revoke-kind" },
			{ txKind: "share-kind" },
		];
		const calls: FetchCall[] = [];
		globalThis.fetch = ((input, init) => {
			calls.push({ input, init });
			return Promise.resolve(
				new Response(wireJson(responses.shift()), { status: 200 })
			);
		}) as typeof fetch;

		await expect(
			gasPools.getCreateTx({
				walletAddress: WALLET,
				initialDepositAmount: 100n,
				deferShare: true,
				tx,
			})
		).resolves.toEqual({
			tx: decoded,
			gasPoolArg: "gas-arg",
			sharePolicyArg: "policy-arg",
		});
		await expect(
			gasPools.getDepositTx({
				walletAddress: WALLET,
				isSponsoredTx: true,
				coinType: "0x3::coin::USDC",
				amount: 7n,
				slippage: 0.02,
				gasPoolArg: "pool-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded });
		await expect(
			gasPools.getWithdrawTx({
				walletAddress: WALLET,
				amount: 8n,
				recipientAddress: OTHER_WALLET,
				deferTransfer: true,
				gasPoolArg: "pool-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded, withdrawnCoinArg: "withdrawn-arg" });
		await expect(
			gasPools.getGrantTx({
				walletAddress: WALLET,
				targetWalletAddress: OTHER_WALLET,
				gasPoolArg: "pool-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded });
		await expect(
			gasPools.getRevokeTx({
				walletAddress: WALLET,
				targetWalletAddress: OTHER_WALLET,
				tx,
			})
		).resolves.toEqual({ tx: decoded });
		await expect(
			gasPools.getShareTx({
				gasPoolArg: "pool-arg" as never,
				sharePolicyArg: "policy-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded });

		expect(calls.map((call) => requestUrl(call))).toEqual([
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/create`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/deposit`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/withdraw`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/grant`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/revoke`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/share`,
		]);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: WALLET,
			initialDepositAmount: "100n",
			deferShare: true,
			txKind: "client-kind",
		});
		expect(requestBody(calls[1])).toEqual({
			walletAddress: WALLET,
			isSponsoredTx: true,
			coinType: "0x3::coin::USDC",
			amount: "7n",
			slippage: 0.02,
			gasPoolArg: "pool-arg",
			txKind: "client-kind",
		});
		expect(requestBody(calls[2])).toEqual({
			walletAddress: WALLET,
			amount: "8n",
			recipientAddress: OTHER_WALLET,
			deferTransfer: true,
			gasPoolArg: "pool-arg",
			txKind: "client-kind",
		});
		expect(requestBody(calls[3])).toEqual({
			walletAddress: WALLET,
			targetWalletAddress: OTHER_WALLET,
			gasPoolArg: "pool-arg",
			txKind: "client-kind",
		});
		expect(requestBody(calls[4])).toEqual({
			walletAddress: WALLET,
			targetWalletAddress: OTHER_WALLET,
			txKind: "client-kind",
		});
		expect(requestBody(calls[5])).toEqual({
			gasPoolArg: "pool-arg",
			sharePolicyArg: "policy-arg",
			txKind: "client-kind",
		});
		expect(transactionHelper.fetchBase64TxKindFromTx).toHaveBeenCalledTimes(6);
	});

	it("maps sponsored transaction requests with and without an optional tx kind", async () => {
		const transactionHelper = {
			fetchBase64TxKindFromTx:
				asyncMock<string>().mockResolvedValue("signed-kind"),
		};
		const api = fakeApi({ Transactions: () => transactionHelper });
		const gasPools = new GasPools({ baseUrl: API_BASE_URL }, api);
		const calls = installJsonFetch({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest",
		});

		expect(
			await gasPools.getSponsoredTransaction({
				walletAddress: WALLET,
				bytes: "auth-bytes",
				signature: "wallet-sig",
			})
		).toEqual({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest",
		});
		expect(requestBody(calls[0])).toEqual({
			walletAddress: WALLET,
			bytes: "auth-bytes",
			signature: "wallet-sig",
		});

		const callsWithTx = installJsonFetch({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest-2",
		});
		expect(
			await gasPools.getSponsoredTransaction({
				walletAddress: WALLET,
				bytes: "auth-bytes",
				signature: "wallet-sig",
				tx: new Transaction(),
			})
		).toEqual({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest-2",
		});
		expect(requestBody(callsWithTx[0])).toEqual({
			walletAddress: WALLET,
			bytes: "auth-bytes",
			signature: "wallet-sig",
			txKind: "signed-kind",
		});
		expect(transactionHelper.fetchBase64TxKindFromTx).toHaveBeenCalledTimes(1);
	});

	it("classifies gas-pool HTTP errors and no-base-url configuration errors", async () => {
		installJsonFetch({ message: "unavailable" }, 503, { "Retry-After": "2" });
		await expect(
			new GasPools({ baseUrl: API_BASE_URL }).getPool({ walletAddress: WALLET })
		).rejects.toEqual(
			expect.objectContaining({ kind: "http", status: 503, retryAfterMs: 2000 })
		);
		const calls = installRejectingFetch();
		await expect(
			new GasPools().getPool({ walletAddress: WALLET })
		).rejects.toThrow("no apiBaseUrl: unable to fetch data");
		expect(calls).toHaveLength(0);
	});
});
