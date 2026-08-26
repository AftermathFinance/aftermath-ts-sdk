import { Transaction } from "@mysten/sui/transactions";
import {
	AftermathApi,
	type AftermathApi as AftermathApiType,
	type AftermathTransportError,
	Coin,
	NftAmm,
	Sui,
} from "../src";
import { NftAmmApi } from "../src/packages/nftAmm/api/nftAmmApi";
import { NftAmmApiCasting } from "../src/packages/nftAmm/api/nftAmmApiCasting";
import { NftAmmMarket } from "../src/packages/nftAmm/nftAmmMarket";

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

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
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json", ...extraHeaders },
			})
		);
	}) as typeof fetch;
	return calls;
}

function installRejectingFetch(
	error = new Error("unexpected network request")
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.reject(error);
	}) as typeof fetch;
	return calls;
}

function requestBody(calls: FetchCall[]): JsonRecord {
	const body = calls[0]?.init?.body;
	if (typeof body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(body) as JsonRecord;
}

function fakeApi(
	input: {
		client?: Record<string, unknown>;
		addresses?: Record<string, unknown>;
		[key: string]: unknown;
	} = {}
): AftermathApiType {
	return {
		client: {},
		addresses: {},
		...input,
	} as unknown as AftermathApiType;
}

function providerWithClient(
	client: Record<string, unknown>,
	addresses: Record<string, unknown> = {}
): AftermathApi {
	return new AftermathApi(client as never, addresses as never);
}

function grpcCoin(
	objectId: string,
	balance: string,
	coinType = "0x2::sui::SUI"
) {
	return {
		objectId,
		version: "1",
		digest: `digest-${objectId}`,
		owner: { $kind: "AddressOwner", AddressOwner: "0x5" },
		type: `0x2::coin::Coin<${coinType}>`,
		balance,
	};
}

function nftAmmAddresses() {
	return {
		packages: { nftAmm: "0xabc" },
		objects: {
			protocolFeeVault: "0xfee",
			treasury: "0xtreasury",
			insuranceFund: "0xinsurance",
			referralVault: "0xreferral",
		},
	};
}

function transactionCommands(tx: Transaction): readonly JsonRecord[] {
	return tx.getData().commands as readonly JsonRecord[];
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

class RecordingTransaction {
	public readonly commands: JsonRecord[] = [];
	public readonly pureValues: bigint[] = [];

	public object(objectId: string): JsonRecord {
		return { kind: "object", objectId };
	}

	public pure = {
		u64: (value: bigint | number | string): JsonRecord => {
			const normalized = BigInt(value);
			this.pureValues.push(normalized);
			return { kind: "pure", value: normalized };
		},
	};

	public makeMoveVec = (input: {
		elements: unknown[];
		type: string;
	}): JsonRecord => {
		const result = { kind: "move-vec", ...input };
		this.commands.push({ $kind: "MakeMoveVec", MakeMoveVec: result });
		return result;
	};

	public moveCall = (input: JsonRecord): JsonRecord => {
		this.commands.push({ $kind: "MoveCall", MoveCall: input });
		return { $kind: "Result", Result: this.commands.length - 1 };
	};
}

function recordingMoveCall(tx: RecordingTransaction): JsonRecord {
	const command = tx.commands.find(
		(candidate) => candidate.$kind === "MoveCall"
	);
	if (!command || typeof command.MoveCall !== "object") {
		throw new Error("expected a recorded MoveCall command");
	}
	return command.MoveCall as JsonRecord;
}

const coinForPool = (balance: bigint) => ({
	weight: 500000000000000000n,
	balance,
	tradeFeeIn: 0n,
	tradeFeeOut: 0n,
	depositFee: 0n,
	withdrawFee: 0n,
	decimalsScalar: 1n,
	normalizedBalance: balance,
	decimals: 9,
});

const fractionalizedCoin = "0x2::fraction::F";
const assetCoin = "0x3::asset::A";
const lpCoin = "0x4::lp::L";
const nftType = "0x5::nft::N";

const poolFixture = {
	objectId: "0x10",
	objectType: `0x10::pool::Pool<${lpCoin}>`,
	name: "NFT AMM pool",
	creator: "0x1",
	lpCoinType: lpCoin,
	lpCoinSupply: 1000000000n,
	illiquidLpCoinSupply: 0n,
	flatness: 0n,
	coins: {
		[fractionalizedCoin]: coinForPool(1000000000n),
		[assetCoin]: coinForPool(2000000000n),
	},
	lpCoinDecimals: 9,
};

const marketFixture = {
	objectId: "0x20",
	objectType: `0x20::market::Market<${lpCoin}, ${fractionalizedCoin}, ${assetCoin}, ${nftType}>`,
	nftsTable: { objectId: "0x21", size: 7n },
	pool: poolFixture,
	fractionalizedSupply: 1000000000n,
	fractionalizedCoinAmount: 100n,
	fractionalizedCoinType: fractionalizedCoin,
	assetCoinType: assetCoin,
	lpCoinType: lpCoin,
	nftType,
};

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

const FLOAT_COIN_A = "0x1::a::A";
const FLOAT_COIN_B = "0x2::b::B";
const FLOAT_COIN_C = "0x3::c::C";

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

describe("NftAmmMarket facade and calculations", () => {
	it("uses the market table id and defaults pagination to 25", async () => {
		const captured: JsonRecord[] = [];
		const api = fakeApi({
			NftAmm: () => ({
				fetchNftsInMarketTable: (input: JsonRecord) => {
					captured.push(input);
					return { dynamicFieldObjects: [], nextCursor: null };
				},
			}),
		});
		const market = new NftAmmMarket(marketFixture, undefined, api);
		await market.getNfts({});
		await market.getNfts({ cursor: "0xcursor", limit: 3 });
		expect(captured).toEqual([
			{ marketTableObjectId: "0x20", limit: 25 },
			{ marketTableObjectId: "0x20", cursor: "0xcursor", limit: 3 },
		]);
	});

	it("delegates transaction inputs and preserves the deposit NFT naming seam", async () => {
		const calls: JsonRecord[] = [];
		const returned = {
			buy: new Transaction(),
			sell: new Transaction(),
			deposit: new Transaction(),
			withdraw: new Transaction(),
		};
		const api = fakeApi({
			NftAmm: () => ({
				fetchBuildBuyTx: (input: JsonRecord) => {
					calls.push({ kind: "buy", ...input });
					return returned.buy;
				},
				fetchBuildSellTx: (input: JsonRecord) => {
					calls.push({ kind: "sell", ...input });
					return returned.sell;
				},
				fetchBuildDepositTx: (input: JsonRecord) => {
					calls.push({ kind: "deposit", ...input });
					return returned.deposit;
				},
				fetchBuildWithdrawTx: (input: JsonRecord) => {
					calls.push({ kind: "withdraw", ...input });
					return returned.withdraw;
				},
			}),
		});
		const market = new NftAmmMarket(marketFixture, undefined, api);
		const common = {
			marketObjectId: "0xignored",
			walletAddress: "0xwallet",
			slippage: 0.01,
		};

		expect(
			await market.getBuyTransaction({ ...common, nftObjectIds: ["0xnft"] })
		).toBe(returned.buy);
		expect(
			await market.getSellTransaction({ ...common, nftObjectIds: ["0xnft"] })
		).toBe(returned.sell);
		expect(
			await market.getDepositTransaction({
				walletAddress: "0xwallet",
				marketObjectId: "0xignored",
				assetCoinAmountIn: 500n,
				nftObjectIds: ["0xnft"],
				slippage: 0.01,
			})
		).toBe(returned.deposit);
		expect(
			await market.getWithdrawTransaction({
				...common,
				lpCoinAmount: 500n,
				nftObjectIds: ["0xnft"],
			})
		).toBe(returned.withdraw);
		expect(calls[2]).toEqual(
			expect.objectContaining({ kind: "deposit", nfts: ["0xnft"] })
		);
		expect(calls.every((call) => call.market === market)).toBe(true);
	});

	it("calculates NFT spot, buy, sell, and deposit values with bigint outputs", () => {
		const market = new NftAmmMarket(marketFixture);
		expect(
			market.getAssetCoinToFractionalizeCoinSpotPrice({ withFees: false })
		).toBe(2);
		expect(
			market.getFractionalizedCoinToAssetCoinSpotPrice({ withFees: false })
		).toBe(0.5);
		expect(market.getNftSpotPriceInAssetCoin({ withFees: false })).toBe(200n);
		expect(market.getBuyAssetCoinAmountIn({ nftsCount: 1 })).toBe(200n);
		expect(market.getSellAssetCoinAmountOut({ nftsCount: 1 })).toBe(197n);
		expect(
			market.getDepositLpCoinAmountOut({ assetCoinAmountIn: 100_000_000n })
		).toEqual({
			lpAmountOut: 24_695_076n,
			lpRatio: 0.975_900_072_948_532_3,
		});
	});

	it("surfaces the current withdrawal calculation failure instead of fabricating NFT counts", () => {
		const market = new NftAmmMarket(marketFixture);
		expect(() =>
			market.getWithdrawNftsCountOut({ lpCoinAmount: 900000000n })
		).toThrow("Newton diverged");
	});

	it("requires an Aftermath API for transaction or NFT operations", async () => {
		const market = new NftAmmMarket(marketFixture);
		await expect(market.getNfts({})).rejects.toThrow(
			"missing AftermathApi instance"
		);
		await expect(
			market.getBuyTransaction({
				marketObjectId: "0x20",
				walletAddress: "0xwallet",
				nftObjectIds: ["0xnft"],
				slippage: 0.01,
			})
		).rejects.toThrow("missing AftermathApi instance");
	});
});

describe("NftAmm response casting", () => {
	it("rejects a market object when nested gRPC pool type information is unavailable", () => {
		const view = {
			objectId: "0x20",
			type: marketFixture.objectType,
			json: {
				nfts: { id: "0x21", size: "7" },
				supply: { value: "1000000000" },
				pool: {
					name: "NFT AMM pool",
					creator: "0x1",
					lp_supply: { value: "1000000000" },
					illiquid_lp_supply: "0",
					type_names: ["2::fraction::F", "3::asset::A"],
					normalized_balances: ["1000000000", "2000000000"],
					weights: ["500000000000000000", "500000000000000000"],
					flatness: "0",
					fees_swap_in: ["0", "0"],
					fees_swap_out: ["0", "0"],
					fees_deposit: ["0", "0"],
					fees_withdraw: ["0", "0"],
					decimal_scalars: ["1", "1"],
					lp_decimals: "9",
					lp_decimal_scalar: "1",
				},
				fractions_amount: "100",
			},
		} as never;
		expect(() => NftAmmApiCasting.marketObjectFromSuiObject(view)).toThrow(
			"no object id found"
		);
	});

	it("still rejects missing top-level object type before reading dynamic fields", () => {
		expect(() =>
			NftAmmApiCasting.marketObjectFromSuiObject({
				objectId: "0x20",
				json: {},
			} as never)
		).toThrow("no object type found");
	});
});

function marketJsonFixture(objectId = "0x20") {
	return {
		objectId,
		objectType: marketFixture.objectType,
		nftsTable: { objectId: "0x21", size: "7n" },
		pool: {
			...poolFixture,
			objectId: "0x10",
			lpCoinSupply: "1000000000n",
			illiquidLpCoinSupply: "0n",
			flatness: "0n",
			coins: {
				[fractionalizedCoin]: {
					...poolFixture.coins[fractionalizedCoin],
					weight: "500000000000000000n",
					balance: "1000000000n",
					tradeFeeIn: "0n",
					tradeFeeOut: "0n",
					depositFee: "0n",
					withdrawFee: "0n",
					decimalsScalar: "1n",
					normalizedBalance: "1000000000n",
				},
				[assetCoin]: {
					...poolFixture.coins[assetCoin],
					weight: "500000000000000000n",
					balance: "2000000000n",
					tradeFeeIn: "0n",
					tradeFeeOut: "0n",
					depositFee: "0n",
					withdrawFee: "0n",
					decimalsScalar: "1n",
					normalizedBalance: "2000000000n",
				},
			},
			lpCoinDecimals: 9,
		},
		fractionalizedSupply: "1000000000n",
		fractionalizedCoinAmount: "100n",
		fractionalizedCoinType: fractionalizedCoin,
		assetCoinType: assetCoin,
		lpCoinType: lpCoin,
		nftType,
	};
}
