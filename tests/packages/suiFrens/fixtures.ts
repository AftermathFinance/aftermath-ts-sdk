import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { bcs } from "@mysten/sui/bcs";

import { Transaction } from "@mysten/sui/transactions";

import type { ConfigAddresses } from "@sdk/general/types/configTypes";

import type { SuiObjectView } from "@sdk/general/utils/grpcCasting";

import type {
	ApiAddSuiFrenAccessoryBody,
	ApiMixSuiFrensBody,
	StakedSuiFrenInfo,
	SuiFrenObject,
} from "@sdk/packages/suiFrens/suiFrensTypes";

const { SuiFren, StakedSuiFren, SuiFrens } = await import("@sdk");

const { SuiFrensApi } = await import("@sdk/packages/suiFrens/api/suiFrensApi");

const { SuiFrensApiCasting } = await import(
	"@sdk/packages/suiFrens/api/suiFrensApiCasting"
);

type AftermathApiType =
	import("@sdk/general/providers/aftermathApi").AftermathApi;

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

export {
	bcs,
	commands,
	describe,
	expect,
	FULL_ELEVEN,
	FULL_ONE,
	FULL_TWO,
	fakeApi,
	fullType,
	it,
	jest,
	makeStakedInfo,
	makeSuiFren,
	moveCall,
	OBJECT_ONE,
	OBJECT_THREE,
	OBJECT_TWO,
	OTHER_WALLET,
	PAYMENT_COIN,
	protocolApi,
	SUI_FREN_TYPE,
	SuiFrens,
	SuiFrensApi,
	Transaction,
	WALLET,
	ACCESSORY_TYPE,
	FULL_NINE,
	FULL_TEN,
	FULL_TWELVE,
	makeEvent,
	objectView,
	SuiFrensApiCasting,
	API_BASE_URL,
	asyncMock,
	FULL_SUI,
	installJsonFetch,
	installJsonFetchSequence,
	makeMetadata,
	requestBody,
	requestUrl,
	StakedSuiFren,
	SUI_TYPE,
	SuiFren,
};

export type { ApiAddSuiFrenAccessoryBody, ApiMixSuiFrensBody, JsonRecord };
