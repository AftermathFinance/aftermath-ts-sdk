import {
	Aftermath,
	type ConfigAddresses,
	DynamicFieldsApiHelpers,
	DynamicGas,
	EventsApiHelpers,
	InspectionsApiHelpers,
	installFetch,
	installFetchHandler,
	jest,
	makeApi,
	NftsApi,
	ObjectsApiHelpers,
	OWNER,
	PACKAGE_NFT,
	Prices,
	TransactionsApiHelpers,
	WalletApi,
} from "@test/general/fixtures/services.js";

describe("AftermathApi and Aftermath provider construction", () => {
	it("constructs general low-level helpers around one client and preserves optional JSON-RPC selection", () => {
		const client = { clientMarker: true };
		const jsonRpcClient = { jsonRpcMarker: true };
		const addresses: ConfigAddresses = {
			nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } },
		};
		const api = makeApi(client, addresses, jsonRpcClient);

		expect(api.client).toBe(client);
		expect(api.addresses).toBe(addresses);
		expect(api.requireJsonRpcClient("test seam")).toBe(jsonRpcClient);
		expect(api.DynamicFields()).toBeInstanceOf(DynamicFieldsApiHelpers);
		expect(api.Events()).toBeInstanceOf(EventsApiHelpers);
		expect(api.Inspections()).toBeInstanceOf(InspectionsApiHelpers);
		expect(api.Objects()).toBeInstanceOf(ObjectsApiHelpers);
		expect(api.Transactions()).toBeInstanceOf(TransactionsApiHelpers);
		expect(api.Wallet()).toBeInstanceOf(WalletApi);
		expect(api.Nfts()).toBeInstanceOf(NftsApi);
	});

	it("describes the missing JSON-RPC dependency at the public boundary", () => {
		const api = makeApi({});
		expect(() =>
			api.requireJsonRpcClient("Events().fetchCastEventsWithCursor")
		).toThrow(
			"Events().fetchCastEventsWithCursor requires a `SuiJsonRpcClient`"
		);
	});

	it("uses a prebuilt API without address discovery or Sui network calls", async () => {
		const addresses: ConfigAddresses = {
			nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } },
		};
		const api = makeApi({}, addresses);
		const calls = installFetchHandler(() => {
			throw new Error("prebuilt API path must not fetch");
		});

		const aftermath = await Aftermath.create({ api, network: "TESTNET" });
		expect(calls).toHaveLength(0);
		expect(aftermath.network).toBe("TESTNET");
		expect(aftermath.getApiBaseUrl()).toBe("https://testnet.aftermath.finance");
		expect(aftermath.Wallet(OWNER)).toMatchObject({ address: OWNER, api });
		expect(aftermath.Prices()).toBeInstanceOf(Prices);
		expect(aftermath.DynamicGas()).toBeInstanceOf(DynamicGas);
		expect(aftermath.Sui().api).toBe(api);
		expect(aftermath.Coin().api).toBe(api);
		expect(aftermath.Router().config).toBe(aftermath.config);
		expect(aftermath.Referrals().config).toBe(aftermath.config);
		expect(aftermath.Dca().config).toBe(aftermath.config);
		expect(aftermath.LimitOrders().config).toBe(aftermath.config);
		expect(aftermath.UserData().config).toBe(aftermath.config);
		expect((aftermath.Auth() as { config: unknown }).config).toBe(
			aftermath.config
		);
	});

	it("forwards Move-error translation through the configured low-level API", async () => {
		const api = makeApi({});
		const translation = {
			errorCode: 7,
			packageId: PACKAGE_NFT,
			module: "collectible",
			error: "not transferable",
		};
		const translateMoveErrorMessage = jest
			.spyOn(api, "translateMoveErrorMessage")
			.mockReturnValue(translation);
		const aftermath = await Aftermath.create({ api });

		expect(
			aftermath.translateMoveErrorMessage({ errorMessage: "MoveAbort(7)" })
		).toBe(translation);
		expect(translateMoveErrorMessage).toHaveBeenCalledWith({
			errorMessage: "MoveAbort(7)",
		});
	});

	it("discovers addresses through the configured API endpoint and constructs the requested network provider", async () => {
		const calls = installFetch({
			nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } },
		});
		const signal = new AbortController().signal;

		const aftermath = await Aftermath.create(
			{
				baseUrl: "https://sdk.test/",
				network: "DEVNET",
				fullnodeUrl: "https://fullnode.test",
			},
			signal
		);
		expect(aftermath.network).toBe("DEVNET");
		expect(aftermath.getApiBaseUrl()).toBe("https://sdk.test/");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.input).toBe("https://sdk.test/api//addresses");
		expect(calls[0]?.init?.signal).toBe(signal);
	});

	it("keeps preloaded-address construction network-free and routes custom API endpoints", async () => {
		const calls = installFetchHandler(() => {
			throw new Error("preloaded addresses must not fetch");
		});
		const aftermath = await Aftermath.create({
			baseUrl: "https://sdk.test/",
			apiEndpoint: "gateway",
			addresses: {},
		});

		expect(calls).toHaveLength(0);
		expect(aftermath.getApiBaseUrl()).toBe("https://sdk.test/");
		const addressCalls = installFetch({});
		await expect(aftermath.getAddresses()).resolves.toEqual({});
		expect(addressCalls[0]?.input).toBe("https://sdk.test/gateway//addresses");
	});
});
