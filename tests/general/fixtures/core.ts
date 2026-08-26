import { jest } from "@jest/globals";
import { bcs } from "@mysten/sui/bcs";

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";

import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";

import { Transaction } from "@mysten/sui/transactions";

import {
	AftermathTransportError,
	Casting,
	GrpcCasting,
	Helpers,
	isAftermathTransportError,
} from "@sdk";

import { Caller } from "@sdk/general/utils/caller";

import { FixedUtils } from "@sdk/general/utils/fixedUtils";

import { IFixedUtils } from "@sdk/general/utils/iFixedUtils";

import {
	normalizeAftermathTransportError,
	parseRetryAfter,
} from "@sdk/general/utils/transportError";

import {
	type FetchCall,
	type FetchHandler,
	installRecordedFetch,
} from "@test/support/http";

class TestCaller extends Caller {
	call<Output>(
		body?: unknown,
		signal?: AbortSignal,
		options?: { disableBigIntJsonParsing?: boolean }
	): Promise<Output> {
		return (this as any).fetchApi("test", body, signal, options);
	}
	callUrl(url: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
		return (this as any).fetchApi(url, body, signal);
	}
	callTx(inputs: {
		url: string;
		body?: any;
		signal?: AbortSignal;
		txKind?: boolean;
	}) {
		return (this as any).fetchApiTransaction(
			inputs.url,
			inputs.body,
			inputs.signal,
			{ txKind: inputs.txKind }
		);
	}
	callTxObject(inputs: { url: string; body?: any; signal?: AbortSignal }) {
		return (this as any).fetchApiTxObject(
			inputs.url,
			inputs.body,
			inputs.signal
		);
	}
	callEvents(url: string, body: any, signal?: AbortSignal) {
		return (this as any).fetchApiEvents(url, body, signal);
	}
	callIndexerEvents(url: string, body: any, signal?: AbortSignal) {
		return (this as any).fetchApiIndexerEvents(url, body, signal);
	}
	openWs(args: any) {
		return (this as any).openWsStream(args);
	}
	getApiEndpoint(): string {
		return this.apiEndpoint;
	}
	setToken(token: string) {
		(this as any).setAccessToken(token);
	}
}

const originalFetch = globalThis.fetch;

const originalWebSocket = (globalThis as any).WebSocket;

const originalErrorEvent = (globalThis as any).ErrorEvent;

const originalDateNow = Date.now;

const greatestBitLiteral = BigInt(
	"57896044618658097711785492504343953926634992332820282019728792003956564819968"
);

const notGreatestBitLiteral = BigInt(
	"57896044618658097711785492504343953926634992332820282019728792003956564819967"
);

afterEach(() => {
	globalThis.fetch = originalFetch;
	(globalThis as any).WebSocket = originalWebSocket;
	(globalThis as any).ErrorEvent = originalErrorEvent;
	Date.now = originalDateNow;
	jest.restoreAllMocks();
});

function installFetch(handler: FetchHandler): FetchCall[] {
	return installRecordedFetch(handler);
}

function makeResponse(
	body: string,
	status = 200,
	headers?: HeadersInit,
	statusText?: string
) {
	return new Response(body, { status, headers, statusText });
}

function makeCaller(baseUrl = "https://sdk.test", extra?: any): TestCaller {
	return new TestCaller({ baseUrl, ...extra });
}

export {
	AftermathTransportError,
	Caller,
	Casting,
	Ed25519Keypair,
	FixedUtils,
	GrpcCasting,
	Helpers,
	IFixedUtils,
	Secp256k1Keypair,
	Secp256r1Keypair,
	TestCaller,
	Transaction,
	bcs,
	greatestBitLiteral,
	installFetch,
	isAftermathTransportError,
	jest,
	makeCaller,
	makeResponse,
	normalizeAftermathTransportError,
	notGreatestBitLiteral,
	originalDateNow,
	originalErrorEvent,
	originalFetch,
	originalWebSocket,
	parseRetryAfter,
};
export type { FetchCall, FetchHandler };
