import { Transaction } from "@mysten/sui/transactions";

import { AftermathApi, type AftermathTransportError, Coin } from "@sdk";

import { makeGrpcCoin as grpcCoin } from "@test/support/grpc";

import {
	type FetchCall,
	installRecordedFetch,
	requestBody,
} from "@test/support/http";

import { transactionCommands } from "@test/support/transactions";

type JsonRecord = Record<string, unknown>;

const originalFetch = globalThis.fetch;

const CUSTOM_COIN = "0xabc::token::TOK";

const PADDED_CUSTOM_COIN =
	"0x0000000000000000000000000000000000000000000000000000000000000abc::token::TOK";

const PADDED_SUI_COIN =
	"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

const PADDED_TWO =
	"0x0000000000000000000000000000000000000000000000000000000000000002";

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function installJsonFetch(
	payload: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {}
): FetchCall[] {
	return installRecordedFetch(
		() =>
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json", ...extraHeaders },
			})
	);
}

function installRejectingFetch(
	error = new Error("unexpected network request")
): FetchCall[] {
	return installRecordedFetch(() => Promise.reject(error));
}

function providerWithClient(
	client: Record<string, unknown>,
	addresses: Record<string, unknown> = {}
): AftermathApi {
	return new AftermathApi(client as never, addresses as never);
}

function transactionInputs(tx: Transaction): readonly JsonRecord[] {
	return tx.getData().inputs as readonly JsonRecord[];
}

function moveCall(tx: Transaction): JsonRecord {
	const command = transactionCommands(tx).find(
		(candidate) => candidate.$kind === "MoveCall"
	);
	if (!command || typeof command.MoveCall !== "object") {
		throw new Error("expected a MoveCall command");
	}
	return command.MoveCall as JsonRecord;
}

function pureU64Values(tx: Transaction): bigint[] {
	return transactionInputs(tx).flatMap((input) => {
		const pure = input.Pure;
		if (!pure || typeof pure !== "object") {
			return [];
		}
		const bytes = (pure as JsonRecord).bytes;
		if (typeof bytes !== "string") {
			return [];
		}
		const encoded = Buffer.from(bytes, "base64");
		let value = 0n;
		for (const [index, byte] of encoded.entries()) {
			value += BigInt(byte) * 2n ** BigInt(index * 8);
		}
		return [value];
	});
}

const FLOAT_COIN_A = "0x1::a::A";

const FLOAT_COIN_B = "0x2::b::B";

const FLOAT_COIN_C = "0x3::c::C";

export {
	Coin,
	CUSTOM_COIN,
	FLOAT_COIN_A,
	FLOAT_COIN_B,
	FLOAT_COIN_C,
	grpcCoin,
	installJsonFetch,
	installRejectingFetch,
	moveCall,
	PADDED_CUSTOM_COIN,
	PADDED_SUI_COIN,
	PADDED_TWO,
	providerWithClient,
	pureU64Values,
	requestBody,
	Transaction,
	transactionCommands,
};

export type { AftermathTransportError, JsonRecord };
