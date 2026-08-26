import { jest as jestApi } from "@jest/globals";

import type { BcsType } from "@mysten/sui/bcs";

import type { SuiGrpcClient } from "@mysten/sui/grpc";

import type { SuiEvent, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

import type { Transaction } from "@mysten/sui/transactions";

import type { AftermathApi as AftermathApiType } from "@sdk/general/providers/aftermathApi";

import type { Event } from "@sdk/general/types";

import type { ConfigAddresses } from "@sdk/general/types/configTypes";

import type { SuiObjectView } from "@sdk/general/utils/grpcCasting";

const jest = jestApi as unknown as {
	fn: (...args: any[]) => any;
	spyOn: typeof jestApi.spyOn;
	restoreAllMocks: typeof jestApi.restoreAllMocks;
};

await import("@sdk/general/utils/helpers");

const { Transaction: TransactionClass } = await import(
	"@mysten/sui/transactions"
);

const { Aftermath } = await import("@sdk/general/providers/aftermath");

const { AftermathApi } = await import("@sdk/general/providers/aftermathApi");

const { DynamicFieldsApiHelpers } = await import(
	"@sdk/general/apiHelpers/dynamicFieldsApiHelpers"
);

const { EventsApiHelpers } = await import(
	"@sdk/general/apiHelpers/eventsApiHelpers"
);

const { InspectionsApiHelpers } = await import(
	"@sdk/general/apiHelpers/inspectionsApiHelpers"
);

const { ObjectsApiHelpers } = await import(
	"@sdk/general/apiHelpers/objectsApiHelpers"
);

const { TransactionsApiHelpers } = await import(
	"@sdk/general/apiHelpers/transactionsApiHelpers"
);

const { DynamicGas } = await import("@sdk/general/dynamicGas/dynamicGas");

const { default: PriceFeeds } = await import(
	"@sdk/general/priceFeeds/priceFeeds"
);

const { default: PriceFeedsApi } = await import(
	"@sdk/general/priceFeeds/priceFeedsApi"
);

const { NftsApi } = await import("@sdk/general/nfts/nftsApi");

const { NftsApiCasting } = await import("@sdk/general/nfts/nftsApiCasting");

const { Prices } = await import("@sdk/general/prices/prices");

const { Wallet } = await import("@sdk/general/wallet/wallet");

const { WalletApi } = await import("@sdk/general/wallet/walletApi");

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

type FetchHandler = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

const originalFetch = globalThis.fetch;

const OWNER =
	"0x00000000000000000000000000000000000000000000000000000000000000aa";

const PACKAGE_NFT =
	"0x1111111111111111111111111111111111111111111111111111111111111111";

const OBJECT_1 =
	"0x0000000000000000000000000000000000000000000000000000000000000001";

const OBJECT_2 =
	"0x0000000000000000000000000000000000000000000000000000000000000002";

const OBJECT_3 =
	"0x0000000000000000000000000000000000000000000000000000000000000003";

const KIOSK_TYPE =
	"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk";

const KIOSK_CAP_TYPE =
	"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap";

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetch(
	body: unknown,
	status = 200,
	headers?: HeadersInit
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		const responseBody = typeof body === "string" ? body : JSON.stringify(body);
		return Promise.resolve(new Response(responseBody, { status, headers }));
	}) as typeof fetch;
	return calls;
}

function installFetchHandler(handler: FetchHandler): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(handler(input, init));
	}) as typeof fetch;
	return calls;
}

function requestBody(calls: FetchCall[]): Record<string, unknown> {
	const body = calls[0]?.init?.body;
	if (typeof body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(body) as Record<string, unknown>;
}

function makeApi(
	client: Record<string, unknown>,
	addresses: ConfigAddresses = {},
	jsonRpcClient?: Record<string, unknown>
): AftermathApiType {
	return new AftermathApi(
		client as unknown as SuiGrpcClient,
		addresses,
		jsonRpcClient as unknown as SuiJsonRpcClient
	);
}

function makeObjectView(
	overrides: Record<string, unknown> = {}
): SuiObjectView {
	return {
		objectId: OBJECT_1,
		version: "7",
		digest: "digest-1",
		type: `${PACKAGE_NFT}::collectible::Collectible`,
		owner: { AddressOwner: OWNER },
		json: {},
		display: { output: {}, errors: null },
		...overrides,
	} as unknown as SuiObjectView;
}

function dynamicFieldEntry(
	fieldId: string,
	valueType: string,
	byte: number,
	kind: "DynamicField" | "DynamicObject" = "DynamicField"
) {
	return {
		$kind: kind,
		fieldId,
		valueType,
		name: {
			type: "0x1::string::String",
			bcs: new Uint8Array([byte]),
		},
	};
}

function event(type: string, timestamp: number | undefined, id: string): Event {
	return { type, timestamp, txnDigest: id };
}

export {
	Aftermath,
	AftermathApi,
	DynamicFieldsApiHelpers,
	DynamicGas,
	EventsApiHelpers,
	InspectionsApiHelpers,
	KIOSK_CAP_TYPE,
	KIOSK_TYPE,
	NftsApi,
	NftsApiCasting,
	OBJECT_1,
	OBJECT_2,
	OBJECT_3,
	OWNER,
	ObjectsApiHelpers,
	PACKAGE_NFT,
	PriceFeeds,
	PriceFeedsApi,
	Prices,
	TransactionClass,
	TransactionsApiHelpers,
	Wallet,
	WalletApi,
	dynamicFieldEntry,
	event,
	installFetch,
	installFetchHandler,
	jest,
	jestApi,
	makeApi,
	makeObjectView,
	originalFetch,
	requestBody,
};
export type {
	AftermathApiType,
	BcsType,
	ConfigAddresses,
	Event,
	FetchCall,
	FetchHandler,
	SuiEvent,
	SuiGrpcClient,
	SuiJsonRpcClient,
	SuiObjectView,
	Transaction,
};
