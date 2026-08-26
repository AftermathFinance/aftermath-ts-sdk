import {
	AftermathApi,
	installJsonFetch,
	type JsonRecord,
	PADDED_TWO,
	Sui,
} from "@test/packages/sui/fixtures.js";

describe("Sui HTTP and JSON-RPC seams", () => {
	it("fetches system state through the Aftermath API endpoint and parses bigint fields", async () => {
		const calls = installJsonFetch({
			epoch: "42n",
			activeValidators: [],
			protocolVersion: "1n",
		});
		const state = await new Sui({
			baseUrl: "https://sdk.test",
		}).getSystemState();
		expect(state).toEqual({
			epoch: 42n,
			activeValidators: [],
			protocolVersion: 1n,
		});
		expect(calls[0]?.input).toBe("https://sdk.test/api/sui/system-state");
		expect(calls[0]?.init?.method).toBeUndefined();
	});

	it("surfaces an HTTP status error instead of returning a partial state", async () => {
		installJsonFetch({ error: "backend unavailable" }, 503);
		await expect(
			new Sui({ baseUrl: "https://sdk.test" }).getSystemState()
		).rejects.toMatchObject({ kind: "http", status: 503 });
	});

	it("routes the deprecated fullnode helper through an injected JSON-RPC client", async () => {
		const calls: string[] = [];
		const provider = new AftermathApi(
			{} as never,
			{} as never,
			{
				getLatestSuiSystemState: () => {
					calls.push("getLatestSuiSystemState");
					return {
						epoch: "8",
						activeValidators: [{ suiAddress: "0x2", stakeAmount: "10" }],
					};
				},
			} as never
		);

		const state = await provider.Sui().fetchSystemState();
		expect(calls).toEqual(["getLatestSuiSystemState"]);
		expect(state.activeValidators[0]?.suiAddress).toBe(PADDED_TWO);
		const validator = state.activeValidators[0] as unknown as JsonRecord;
		expect(validator.stakeAmount).toBe("10");
	});

	it("fails descriptively when the optional JSON-RPC client is absent", async () => {
		const provider = new AftermathApi({} as never, {} as never);
		await expect(provider.Sui().fetchSystemState()).rejects.toThrow(
			"Sui().fetchSystemState requires a `SuiJsonRpcClient`"
		);
	});
});
