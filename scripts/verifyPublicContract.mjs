import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SuiGrpcClient } from "@mysten/sui/grpc";
// biome-ignore lint/performance/noNamespaceImport: Inspect the built package's named exports as a consumer.
import * as publishedSdk from "aftermath-ts-sdk";
import {
	Aftermath,
	AftermathApi,
	isAftermathTransportError,
} from "aftermath-ts-sdk";

test("built SDK contract works through package imports", async () => {
	const packageJson = JSON.parse(
		await readFile(new URL("../package.json", import.meta.url))
	);
	assert.equal(packageJson.exports["."].default, "./dist/index.js");
	assert.equal(packageJson.exports["."].types, "./dist/index.d.ts");

	const requests = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (input, init) => {
		const url = String(input);
		requests.push({ url, method: init?.method ?? "GET" });
		if (url.endsWith("/addresses")) {
			return Promise.resolve(Response.json({}));
		}
		if (url.endsWith("/router/supported-coins")) {
			return Promise.resolve(Response.json(["0x2::sui::SUI"]));
		}
		if (url.endsWith("/router/supported-coins/error")) {
			return Promise.resolve(
				new Response("unavailable", {
					status: 503,
					headers: { "Retry-After": "2" },
				})
			);
		}
		throw new Error(`Unexpected request: ${url}`);
	};

	try {
		const sdk = await Aftermath.create({
			network: "LOCAL",
			baseUrl: "http://127.0.0.1:3000",
			fullnodeUrl: "http://127.0.0.1:9000",
		});
		for (const accessor of [
			"Auth",
			"Coin",
			"Dca",
			"DynamicGas",
			"Farms",
			"Faucet",
			"GasPools",
			"LimitOrders",
			"Multisig",
			"NftAmm",
			"Perpetuals",
			"Pools",
			"ReferralVault",
			"Referrals",
			"Rewards",
			"Router",
			"Staking",
			"Sui",
			"SuiFrens",
			"UserData",
			"Prices",
			"Wallet",
		]) {
			assert.equal(typeof sdk[accessor], "function", `${accessor} accessor`);
		}
		for (const namedExport of [
			"Aftermath",
			"AftermathApi",
			"Auth",
			"Coin",
			"Farms",
			"Faucet",
			"GasPools",
			"NftAmm",
			"Perpetuals",
			"Pools",
			"ReferralVault",
			"Router",
			"Staking",
			"Sui",
			"SuiFrens",
			"isAftermathTransportError",
		]) {
			assert.ok(namedExport in publishedSdk, `${namedExport} named export`);
		}
		assert.deepEqual(await sdk.Router().getSupportedCoins(), ["0x2::sui::SUI"]);
		await assert.rejects(
			sdk.Router().searchSupportedCoins({ filter: "error" }),
			(error) =>
				isAftermathTransportError(error) &&
				error.kind === "http" &&
				error.status === 503 &&
				error.retryAfterMs === 2000
		);
		assert.deepEqual(requests, [
			{ url: "http://127.0.0.1:3000/api/addresses", method: "GET" },
			{
				url: "http://127.0.0.1:3000/api/router/supported-coins",
				method: "GET",
			},
			{
				url: "http://127.0.0.1:3000/api/router/supported-coins/error",
				method: "GET",
			},
		]);

		const client = new SuiGrpcClient({
			network: "localnet",
			baseUrl: "http://127.0.0.1:9000",
		});
		const api = new AftermathApi(client, {});
		assert.equal(api.client, client);
		assert.equal(typeof api.Objects().fetchObject, "function");
		assert.throws(
			() => api.requireJsonRpcClient("Events().fetchCastEventsWithCursor"),
			(error) => error.message.includes("requires a `SuiJsonRpcClient`")
		);

		console.log(
			JSON.stringify({
				ok: true,
				surface: "built ESM entrypoint, provider HTTP, low-level client",
				requests,
			})
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
