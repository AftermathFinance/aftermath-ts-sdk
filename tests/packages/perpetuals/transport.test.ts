import {
	AftermathTransportError,
	COLLATERAL,
	clientForTest,
	describe,
	expect,
	installFetch,
	installFetchHandler,
	isAftermathTransportError,
	it,
	MALFORMED_COLLECTION_REGEX,
	SHORT_ID,
} from "@test/packages/perpetuals/fixturesApi.js";

describe("Perpetuals transport and malformed-response behavior", () => {
	it("classifies non-2xx responses and preserves retry metadata", async () => {
		installFetch("service unavailable", 429, { "Retry-After": "3" });
		const error = await clientForTest()
			.getPrices({ marketIds: [SHORT_ID] })
			.catch((value: unknown) => value);

		expect(isAftermathTransportError(error)).toBe(true);
		expect(error).toBeInstanceOf(AftermathTransportError);
		expect(error).toMatchObject({
			kind: "http",
			status: 429,
			retryAfterMs: 3000,
		});
		expect((error as Error).message).toContain("service unavailable");
	});

	it("classifies network failures at the public wrapper boundary", async () => {
		installFetchHandler(() => Promise.reject(new Error("offline")));
		const error = await clientForTest()
			.getVaultsConfig()
			.catch((value: unknown) => value);

		expect(error).toMatchObject({ kind: "network", message: "offline" });
		expect(error).toBeInstanceOf(AftermathTransportError);
	});

	it("classifies caller-triggered aborts", async () => {
		const controller = new AbortController();
		installFetchHandler((_input, init) => {
			controller.abort("caller cancelled");
			return Promise.reject(
				Object.assign(new Error("request aborted"), {
					name: "AbortError",
					signal: init?.signal,
				})
			);
		});
		const error = await clientForTest()
			.getVaultsConfig(controller.signal)
			.catch((value: unknown) => value);

		expect(error).toMatchObject({
			kind: "abort",
			abortSource: "caller",
		});
	});

	it("classifies invalid JSON before a response reaches the wrapper", async () => {
		installFetch("{not-json");
		const error = await clientForTest()
			.getMarkets24hrStats({ marketIds: [SHORT_ID] })
			.catch((value: unknown) => value);

		expect(error).toMatchObject({ kind: "decode" });
		expect(error).toBeInstanceOf(AftermathTransportError);
	});

	it("surfaces missing required response collections as malformed data", async () => {
		installFetch({});
		await expect(
			clientForTest().getAllMarkets({ collateralCoinType: COLLATERAL })
		).rejects.toThrow(MALFORMED_COLLECTION_REGEX);
	});
});
