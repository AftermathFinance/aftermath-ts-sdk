import {
	type AftermathTransportError,
	Coin,
	CUSTOM_COIN,
	FLOAT_COIN_A,
	FLOAT_COIN_B,
	FLOAT_COIN_C,
	grpcCoin,
	installJsonFetch,
	installRejectingFetch,
	type JsonRecord,
	moveCall,
	PADDED_CUSTOM_COIN,
	PADDED_SUI_COIN,
	PADDED_TWO,
	providerWithClient,
	pureU64Values,
	requestBody,
	Transaction,
	transactionCommands,
} from "@test/packages/coin/fixtures.js";

describe("Coin public type and amount helpers", () => {
	it("extracts coin type segments and generic arguments", () => {
		expect(Coin.getCoinTypePackageName(CUSTOM_COIN)).toBe("token");
		expect(Coin.getCoinTypeSymbol(CUSTOM_COIN)).toBe("TOK");
		expect(Coin.getInnerCoinType("0x2::coin::Coin<0x2::sui::SUI>")).toBe(
			"0x2::sui::SUI"
		);
		expect(Coin.coinTypeFromKeyType("0x2::coin::Coin<0x2::sui::SUI>")).toBe(
			"0x2::sui::SUI"
		);
		expect(Coin.getCoinTypePackageName("not-a-move-type")).toBe("");
	});

	it("recognizes padded SUI and standard Coin object types", () => {
		expect(Coin.isSuiCoin("0x2::sui::SUI")).toBe(true);
		expect(Coin.isSuiCoin(PADDED_SUI_COIN)).toBe(true);
		expect(Coin.isCoinObjectType("0x2::coin::Coin<0x2::sui::SUI>")).toBe(true);
		expect(Coin.isCoinObjectType("0x2::sui::SUI")).toBe(false);
	});

	it("keeps positive amount and bigint balance records aligned", () => {
		expect(
			Coin.coinsAndAmountsOverZero({
				[FLOAT_COIN_A]: 0,
				[FLOAT_COIN_B]: 1.25,
				[FLOAT_COIN_C]: -2,
			})
		).toEqual({ coins: [FLOAT_COIN_B], amounts: [1.25] });
		expect(
			Coin.coinsAndBalancesOverZero({
				[FLOAT_COIN_A]: 0n,
				[FLOAT_COIN_B]: 25n,
				[FLOAT_COIN_C]: -1n,
			})
		).toEqual({ coins: [FLOAT_COIN_B], balances: [25n] });
	});

	it("converts user amounts without losing the raw bigint contract", () => {
		expect(Coin.normalizeBalance(1.234, 2)).toBe(123n);
		expect(Coin.balanceWithDecimals(123_456_789n, 6)).toBe(123.456_789);
		expect(Coin.balanceWithDecimalsUsd(123_456_789n, 6, 2.5)).toBe(
			308.641_972_5
		);
	});

	it("filters by type, metadata text, and known symbol mappings", () => {
		const coins = ["0x2::sui::SUI", CUSTOM_COIN, "0xdef::other::USD"];
		expect(
			Coin.filterCoinsByType({ filter: " tok ", coinTypes: coins })
		).toEqual([CUSTOM_COIN]);
		expect(
			Coin.filterCoinsByMetadata({
				filter: "usd",
				coinMetadatas: {
					[CUSTOM_COIN]: {
						name: "Token",
						symbol: "TOK",
						decimals: 6,
						description: "Token",
					},
					"0xdef::other::USD": {
						name: "Dollar",
						symbol: "USD",
						decimals: 6,
						description: "Dollar",
					},
				},
			})
		).toEqual(["0xdef::other::USD"]);
		expect(
			Coin.coinSymbolForCoinType({
				coinType: "0x2::sui::SUI",
				coinSymbolToCoinTypes: { SUI: [PADDED_SUI_COIN], TOK: [CUSTOM_COIN] },
			})
		).toBe("SUI");
		expect(
			Coin.coinSymbolForCoinType({
				coinType: "0x1::missing::MISSING",
				coinSymbolToCoinTypes: { SUI: [PADDED_SUI_COIN] },
			})
		).toBeUndefined();
	});
});

describe("Coin HTTP wrappers", () => {
	it("posts normalized metadata requests and forwards abort/auth boundaries", async () => {
		const calls = installJsonFetch([
			{ name: "Token", symbol: "TOK", decimals: 6, description: "test" },
		]);
		const signal = new AbortController().signal;
		const coin = new Coin(CUSTOM_COIN, {
			baseUrl: "https://sdk.test/",
			accessToken: "token-123",
		});

		expect(
			await coin.getCoinMetadatas({ coins: [CUSTOM_COIN] }, signal)
		).toEqual([
			{ name: "Token", symbol: "TOK", decimals: 6, description: "test" },
		]);
		expect(calls[0]?.input).toBe("https://sdk.test/api/coins/metadata");
		expect(calls[0]?.init?.method).toBe("POST");
		expect(requestBody(calls)).toEqual({ coins: [PADDED_CUSTOM_COIN] });
		expect(calls[0]?.init?.signal).toBe(signal);
		expect(
			(calls[0]?.init?.headers as Record<string, string>).Authorization
		).toBe("Bearer token-123");
	});

	it("maps metadata decimals and caches a single-coin response", async () => {
		const calls = installJsonFetch([
			{ name: "Sui", symbol: "SUI", decimals: 9 },
			{ name: "Token", symbol: "TOK", decimals: 6 },
		]);
		const coin = new Coin(PADDED_SUI_COIN, { baseUrl: "https://sdk.test" });

		expect(
			await coin.getCoinsToDecimals({ coins: [PADDED_SUI_COIN, CUSTOM_COIN] })
		).toEqual({ [PADDED_SUI_COIN]: 9, [CUSTOM_COIN]: 6 });
		expect(requestBody(calls)).toEqual({
			coins: [PADDED_SUI_COIN, PADDED_CUSTOM_COIN],
		});

		const metadataCalls = installJsonFetch([
			{ name: "Sui", symbol: "SUI", decimals: 9 },
		]);
		const metadata = await coin.getCoinMetadata();
		expect(metadata).toEqual({ name: "Sui", symbol: "SUI", decimals: 9 });
		expect(metadataCalls[0]?.input).toBe("https://sdk.test/api/coins/metadata");

		const cachedCalls = installRejectingFetch();
		expect(await coin.getCoinMetadata()).toEqual(metadata);
		expect(cachedCalls).toHaveLength(0);
	});

	it("routes price and verified-coin reads and caches price info", async () => {
		const priceCalls = installJsonFetch({
			SUI: { price: 1.25, priceChange24HoursPercentage: -2.5 },
		});
		const coin = new Coin("0x2::sui::SUI", { baseUrl: "https://sdk.test" });
		expect(await coin.getPrice()).toEqual({
			price: 1.25,
			priceChange24HoursPercentage: -2.5,
		});
		expect(priceCalls[0]?.input).toBe("https://sdk.test/api/price-info");
		expect(requestBody(priceCalls)).toEqual({ coins: ["0x2::sui::SUI"] });

		const cachedCalls = installRejectingFetch();
		expect(await coin.getPrice()).toEqual({
			price: 1.25,
			priceChange24HoursPercentage: -2.5,
		});
		expect(cachedCalls).toHaveLength(0);

		const verifiedCalls = installJsonFetch(["0x2::sui::SUI", CUSTOM_COIN]);
		expect(await coin.getVerifiedCoins()).toEqual([
			"0x2::sui::SUI",
			CUSTOM_COIN,
		]);
		expect(verifiedCalls[0]?.input).toBe("https://sdk.test/api/coins/verified");
	});

	it("fails before network access when a type is required but absent", async () => {
		const calls = installRejectingFetch();
		const coin = new Coin(undefined, { baseUrl: "https://sdk.test" });
		await expect(coin.getCoinMetadata()).rejects.toThrow("no valid coin type");
		await expect(coin.getPrice()).rejects.toThrow("no valid coin type");
		expect(calls).toHaveLength(0);
	});

	it("classifies an HTTP response failure at the public transport seam", async () => {
		installJsonFetch({ error: "rate limited" }, 429, { "Retry-After": "3" });
		await expect(
			new Coin("0x2::sui::SUI", {
				baseUrl: "https://sdk.test",
			}).getVerifiedCoins()
		).rejects.toEqual(
			expect.objectContaining<Partial<AftermathTransportError>>({
				kind: "http",
				status: 429,
				retryAfterMs: 3000,
			})
		);
	});
});

describe("Coin API client routing and transaction seams", () => {
	it("selects the largest owned coins across pages using bigint balances", async () => {
		const cursors: unknown[] = [];
		const pages = [
			{
				objects: [grpcCoin("0x1", "5"), grpcCoin("0x2", "3")],
				hasNextPage: true,
				cursor: "page-2",
			},
			{
				objects: [grpcCoin("0x3", "10")],
				hasNextPage: false,
				cursor: null,
			},
		];
		let pageIndex = 0;
		const api = providerWithClient({
			listCoins: (input: { cursor?: string | null }) => {
				cursors.push(input.cursor);
				return pages[pageIndex++];
			},
		});

		const selected = await api.Coin().fetchCoinsWithAtLeastAmount({
			walletAddress: "0x5",
			coinType: "0x2::sui::SUI",
			coinAmount: 12n,
		});
		expect(cursors).toEqual([undefined, "page-2"]);
		expect(selected.map((coin) => [coin.coinObjectId, coin.balance])).toEqual([
			["0x3", "10"],
			["0x1", "5"],
		]);
	});

	it("distinguishes insufficient balance from an exhausted cursor", async () => {
		const api = providerWithClient({
			listCoins: async () => ({
				objects: [],
				hasNextPage: true,
				cursor: null,
			}),
		});
		await expect(
			api.Coin().fetchCoinsWithAtLeastAmount({
				walletAddress: "0x5",
				coinType: CUSTOM_COIN,
				coinAmount: 1n,
			})
		).rejects.toThrow("wallet does not have coins of sufficient balance");
	});

	it("fetches all coin pages and sorts object ids numerically", async () => {
		const cursors: unknown[] = [];
		let call = 0;
		const api = providerWithClient({
			listCoins: (input: { cursor?: string }) => {
				cursors.push(input.cursor);
				call += 1;
				return call === 1
					? {
							objects: [grpcCoin("0x10", "1")],
							hasNextPage: true,
							cursor: "next",
						}
					: {
							objects: [grpcCoin("0x2", "2")],
							hasNextPage: false,
							cursor: null,
						};
			},
		});

		const coins = await api.Coin().fetchAllCoins({
			walletAddress: "0x5",
			coinType: CUSTOM_COIN,
		});
		expect(cursors).toEqual([undefined, "next"]);
		expect(coins.map((coin) => coin.coinObjectId)).toEqual(["0x2", "0x10"]);
		expect(coins.map((coin) => coin.coinType)).toEqual([
			"0x2::sui::SUI",
			"0x2::sui::SUI",
		]);
	});

	it("uses the non-sponsored CoinWithBalance intent after checking total balance", async () => {
		const balanceInputs: JsonRecord[] = [];
		const api = providerWithClient({
			getBalance: (input: JsonRecord) => {
				balanceInputs.push(input);
				return {
					balance: {
						coinType: PADDED_CUSTOM_COIN,
						balance: "12345678901234567890",
						coinBalance: "1",
						addressBalance: "12345678901234567889",
					},
				};
			},
		});
		const tx = new Transaction();
		const argument = await api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: "0x5",
			coinType: CUSTOM_COIN,
			coinAmount: 9007199254740993n,
		});

		expect((argument as unknown as { $kind?: string }).$kind).toBe("Result");
		expect(balanceInputs).toEqual([{ owner: "0x5", coinType: CUSTOM_COIN }]);
		expect(tx.getData().sender).toBe(
			"0x0000000000000000000000000000000000000000000000000000000000000005"
		);
		const intent = transactionCommands(tx)[0]?.$Intent as JsonRecord;
		expect(intent).toEqual({
			name: "CoinWithBalance",
			inputs: {},
			data: {
				type: PADDED_CUSTOM_COIN,
				balance: 9007199254740993n,
				outputKind: "coin",
			},
		});
	});

	it("rejects a non-sponsored spend before creating a coin intent", async () => {
		let listCoinsCalls = 0;
		const api = providerWithClient({
			getBalance: async () => ({
				balance: { balance: "9" },
			}),
			listCoins: () => {
				listCoinsCalls += 1;
				return { objects: [], hasNextPage: false, cursor: null };
			},
		});
		await expect(
			api.Coin().fetchCoinWithAmountTx({
				tx: new Transaction(),
				walletAddress: "0x5",
				coinType: CUSTOM_COIN,
				coinAmount: 10n,
			})
		).rejects.toThrow("wallet does not have coins of sufficient balance");
		expect(listCoinsCalls).toBe(0);
	});

	it("merges selected sponsored coins and splits the exact bigint amount", async () => {
		const api = providerWithClient({
			listCoins: async () => ({
				objects: [
					grpcCoin("0x1", "60", CUSTOM_COIN),
					grpcCoin("0x2", "50", CUSTOM_COIN),
				],
				hasNextPage: false,
				cursor: null,
			}),
		});
		const tx = new Transaction();
		const argument = await api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: "0x5",
			coinType: CUSTOM_COIN,
			coinAmount: 100n,
			isSponsoredTx: true,
		});

		expect((argument as unknown as { $kind?: string }).$kind).toBe("Result");
		expect(transactionCommands(tx).map((command) => command.$kind)).toEqual([
			"MergeCoins",
			"MoveCall",
		]);
		const merge = transactionCommands(tx)[0]?.MergeCoins as JsonRecord;
		expect(merge.sources).toHaveLength(1);
		const split = moveCall(tx);
		expect(split).toEqual(
			expect.objectContaining({
				package: PADDED_TWO,
				module: "coin",
				function: "split",
				typeArguments: [CUSTOM_COIN],
			})
		);
		expect(pureU64Values(tx)).toEqual([100n]);
	});
});
