import {
	AftermathApi,
	assetCoin,
	type FetchCall,
	fakeApi,
	fractionalizedCoin,
	installJsonFetch,
	installRejectingFetch,
	type JsonRecord,
	lpCoin,
	marketFixture,
	marketJsonFixture,
	NftAmm,
	NftAmmApi,
	nftAmmAddresses,
	nftType,
	providerWithClient,
	RecordingTransaction,
	recordingMoveCall,
	type Transaction,
} from "@test/packages/nftAmm/fixtures.js";

describe("NftAmm provider and HTTP wrappers", () => {
	it("requires the configured NFT AMM addresses at the provider boundary", () => {
		const provider = new AftermathApi({} as never, {} as never);
		expect(() => provider.NftAmm()).toThrow(
			"not all required addresses have been set in provider"
		);
	});

	it("fetches one market and returns a typed market facade", async () => {
		const calls = installJsonFetch(marketJsonFixture());
		const market = await new NftAmm({ baseUrl: "https://sdk.test" }).getMarket({
			objectId: "0x20",
		});
		expect(market.market.objectId).toBe("0x20");
		expect(market.market.nftsTable.size).toBe(7n);
		expect(market.market.pool.lpCoinSupply).toBe(1000000000n);
		expect(calls[0]?.input).toBe("https://sdk.test/api/nft-amm/markets/0x20");
	});

	it("batches market reads and lists all markets through the public facade", async () => {
		const batchCalls: FetchCall[] = [];
		globalThis.fetch = ((input, init) => {
			batchCalls.push({ input, init });
			const objectId = String(input).endsWith("0x30") ? "0x30" : "0x20";
			return Promise.resolve(Response.json(marketJsonFixture(objectId)));
		}) as typeof fetch;
		const nftAmm = new NftAmm({ baseUrl: "https://sdk.test" });
		const markets = await nftAmm.getMarkets({ objectIds: ["0x20", "0x30"] });
		expect(markets.map((market) => market.market.objectId)).toEqual([
			"0x20",
			"0x30",
		]);
		expect(batchCalls[0]?.input).toBe(
			"https://sdk.test/api/nft-amm/markets/0x20"
		);
		expect(batchCalls[1]?.input).toBe(
			"https://sdk.test/api/nft-amm/markets/0x30"
		);

		const allCalls = installJsonFetch([
			marketJsonFixture(),
			marketJsonFixture("0x30"),
		]);
		const allMarkets = await nftAmm.getAllMarkets();
		expect(allMarkets).toHaveLength(2);
		expect(allCalls[0]?.input).toBe("https://sdk.test/api/nft-amm/markets");
	});

	it("preserves transport failures from market reads", async () => {
		installRejectingFetch(new Error("offline sentinel"));
		await expect(
			new NftAmm({ baseUrl: "https://sdk.test" }).getAllMarkets()
		).rejects.toMatchObject({ kind: "network" });
	});
});

describe("NftAmm API object and transaction boundaries", () => {
	it("passes dynamic-field pagination and NFT resolution through the API", async () => {
		const dynamicInputs: JsonRecord[] = [];
		let resolveIds: string[] = [];
		const provider = providerWithClient({}, { nftAmm: nftAmmAddresses() });
		const dynamicFields = {
			fetchCastDynamicFieldsOfTypeWithCursor: async (input: JsonRecord) => {
				dynamicInputs.push(input);
				const objects = await (
					input.objectsFromObjectIds as (ids: string[]) => Promise<unknown>
				)(["0xnft1"]);
				return { dynamicFieldObjects: objects, nextCursor: "0xnext" };
			},
		};
		const nfts = {
			fetchNfts: ({ objectIds }: { objectIds: string[] }) => {
				resolveIds = objectIds;
				return [{ info: { objectId: objectIds[0] }, display: {} }];
			},
		};
		(provider as unknown as { DynamicFields: () => unknown }).DynamicFields =
			() => dynamicFields;
		(provider as unknown as { Nfts: () => unknown }).Nfts = () => nfts;

		const result = await provider.NftAmm().fetchNftsInMarketTable({
			marketTableObjectId: "0xtable",
			cursor: "0xprevious",
			limit: 2,
		});
		expect(dynamicInputs[0]).toEqual(
			expect.objectContaining({
				marketTableObjectId: "0xtable",
				parentObjectId: "0xtable",
				cursor: "0xprevious",
				limit: 2,
			})
		);
		expect(resolveIds).toEqual(["0xnft1"]);
		expect(result.nextCursor).toBe("0xnext");
	});

	it("routes market object and batch reads to object helpers with casters", async () => {
		const objectInputs: JsonRecord[] = [];
		const batchInputs: JsonRecord[] = [];
		const provider = providerWithClient({}, { nftAmm: nftAmmAddresses() });
		const objects = {
			fetchCastObject: (input: JsonRecord) => {
				objectInputs.push(input);
				return marketFixture;
			},
			fetchCastObjectBatch: (input: JsonRecord) => {
				batchInputs.push(input);
				return [marketFixture];
			},
		};
		(provider as unknown as { Objects: () => unknown }).Objects = () => objects;

		expect(await provider.NftAmm().fetchMarket({ objectId: "0x20" })).toBe(
			marketFixture
		);
		expect(
			await provider.NftAmm().fetchMarkets({ objectIds: ["0x20"] })
		).toEqual([marketFixture]);
		expect(objectInputs[0]?.objectId).toBe("0x20");
		expect(typeof objectInputs[0]?.objectFromSuiObjectResponse).toBe(
			"function"
		);
		expect(batchInputs[0]?.objectIds).toEqual(["0x20"]);
		expect(typeof batchInputs[0]?.objectFromSuiObjectResponse).toBe("function");
	});

	it("builds a buy command with protocol objects, generic types, and inverted slippage", () => {
		const provider = fakeApi({ addresses: { nftAmm: nftAmmAddresses() } });
		const tx = new RecordingTransaction();
		new NftAmmApi(provider).buyTx({
			tx: tx as unknown as Transaction,
			marketObjectId: "0xmarket",
			assetCoin: "0xasset",
			nftObjectIds: ["0xnft1", "0xnft2"],
			expectedAssetCoinAmountIn: 123n,
			genericTypes: [lpCoin, fractionalizedCoin, assetCoin, nftType],
			slippage: 0.1,
			withTransfer: true,
		});

		expect(recordingMoveCall(tx)).toEqual(
			expect.objectContaining({
				target: "0xabc::interface::buy",
				typeArguments: [lpCoin, fractionalizedCoin, assetCoin, nftType],
			})
		);
		expect(tx.pureValues).toEqual([123n, 900000000000000000n]);
		expect(tx.commands.some((command) => command.$kind === "MakeMoveVec")).toBe(
			true
		);
	});

	it("builds sell, deposit, and withdraw commands on actions or interface", () => {
		const provider = fakeApi({ addresses: { nftAmm: nftAmmAddresses() } });
		const genericTypes = [lpCoin, fractionalizedCoin, assetCoin, nftType] as [
			string,
			string,
			string,
			string,
		];

		const sellTx = new RecordingTransaction();
		const nftAmmApi = new NftAmmApi(provider);
		nftAmmApi.sellTx({
			tx: sellTx as unknown as Transaction,
			marketObjectId: "0xmarket",
			nfts: ["0xnft"],
			expectedAssetCoinAmountOut: 77n,
			genericTypes,
			slippage: 0,
		});
		expect(recordingMoveCall(sellTx)).toEqual(
			expect.objectContaining({ target: "0xabc::actions::sell" })
		);
		expect(sellTx.pureValues).toEqual([77n, 1000000000000000000n]);

		const depositTx = new RecordingTransaction();
		nftAmmApi.depositTx({
			tx: depositTx as unknown as Transaction,
			marketObjectId: "0xmarket",
			assetCoin: "0xasset",
			nfts: ["0xnft"],
			expectedLpRatio: 555n,
			genericTypes,
			slippage: 0.25,
			withTransfer: true,
		});
		expect(recordingMoveCall(depositTx)).toEqual(
			expect.objectContaining({ target: "0xabc::interface::deposit" })
		);
		expect(depositTx.pureValues).toEqual([555n, 750000000000000000n]);

		const withdrawTx = new RecordingTransaction();
		nftAmmApi.addWithdrawCommandToTransaction({
			tx: withdrawTx as unknown as Transaction,
			marketObjectId: "0xmarket",
			lpCoin: "0xlp",
			nftObjectIds: ["0xnft"],
			expectedAssetCoinAmountOut: 333n,
			genericTypes,
			slippage: 0.05,
		});
		expect(recordingMoveCall(withdrawTx)).toEqual(
			expect.objectContaining({ target: "0xabc::actions::withdraw" })
		);
		expect(withdrawTx.pureValues).toEqual([333n, 950000000000000000n]);
	});
});
