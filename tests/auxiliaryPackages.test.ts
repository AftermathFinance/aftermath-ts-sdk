import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../src/general/providers";
import { Dca } from "../src/packages/dca/dca";
import { LimitOrdersApi } from "../src/packages/limitOrders/api/limitOrdersApi";
import { LimitOrders } from "../src/packages/limitOrders/limitOrders";
import { MultisigApi } from "../src/packages/multisig/api/multisigApi";
import { Multisig } from "../src/packages/multisig/multisig";
import { Referrals } from "../src/packages/referrals/referrals";
import { ReferralVault } from "../src/packages/referralVault/referralVault";
import { Rewards } from "../src/packages/rewards/rewards";
import { UserData } from "../src/packages/userData/userData";

type DcaApiClass = typeof import("../src/packages/dca/api/dcaApi").DcaApi;
type ReferralVaultApiClass =
	typeof import("../src/packages/referralVault/api/referralVaultApi").ReferralVaultApi;

let DcaApi: DcaApiClass;
let ReferralVaultApi: ReferralVaultApiClass;

beforeAll(async () => {
	jest.unstable_mockModule("../src/general/utils/casting", () => ({
		Casting: {
			bigIntFromBytes: (bytes: number[] | Uint8Array) => {
				let value = 0n;
				for (const [index, byte] of bytes.entries()) {
					value += BigInt(byte) * 2n ** BigInt(index * 8);
				}
				return value;
			},
		},
	}));
	({ DcaApi } = await import("../src/packages/dca/api/dcaApi"));
	({ ReferralVaultApi } = await import(
		"../src/packages/referralVault/api/referralVaultApi"
	));
});

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

type JsonRecord = Record<string, unknown>;
type FetchResponder = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

const BASE_URL = "https://sdk.test";
const WALLET = `0x${"1".repeat(64)}`;
const RECIPIENT = `0x${"2".repeat(64)}`;
const REFERRER = `0x${"3".repeat(64)}`;
const COIN_A = "0x2::sui::SUI";
const COIN_B = `0x${"b".repeat(64)}::coin::B`;
const PACKAGE = `0x${"a".repeat(64)}`;
const EVENTS = `0x${"c".repeat(64)}`;
const EVENTS_V2 = `0x${"d".repeat(64)}`;
const REFERRAL_OBJECT = `0x${"e".repeat(64)}`;
const DCA_CONFIG = `0x${"f".repeat(64)}`;
const ORDER_ID = `0x${"4".repeat(64)}`;
const SECOND_ORDER_ID = `0x${"5".repeat(64)}`;

const referralVaultAddresses = {
	packages: { referralVault: PACKAGE },
	objects: { referralVault: REFERRAL_OBJECT },
};

const dcaAddresses = {
	packages: { dca: PACKAGE, events: EVENTS, eventsV2: EVENTS_V2 },
	objects: { config: DCA_CONFIG },
};

const limitAddresses = {
	packages: { limitOrders: PACKAGE, events: EVENTS },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetch(responder: FetchResponder): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(responder(input, init));
	}) as typeof fetch;
	return calls;
}

function installJsonFetch(
	payload: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {}
): FetchCall[] {
	return installFetch(
		() =>
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json", ...extraHeaders },
			})
	);
}

function requestBody(calls: FetchCall[], index = 0): JsonRecord {
	const body = calls[index]?.init?.body;
	if (typeof body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(body) as JsonRecord;
}

function transactionCommands(tx: Transaction): readonly JsonRecord[] {
	return tx.getData().commands as readonly JsonRecord[];
}

function moveCallData(tx: Transaction): JsonRecord {
	const command = transactionCommands(tx).find(
		(candidate) => candidate.$kind === "MoveCall"
	);
	if (!command || typeof command.MoveCall !== "object") {
		throw new Error("expected a MoveCall command");
	}
	return command.MoveCall as JsonRecord;
}

function fakeApi(
	input: { addresses?: Record<string, unknown>; [key: string]: unknown } = {}
): AftermathApi {
	return {
		client: {},
		addresses: {},
		...input,
	} as unknown as AftermathApi;
}

function serializedTransaction(): string {
	const tx = new Transaction();
	tx.setSender(WALLET);
	tx.moveCall({
		target: `${PACKAGE}::fixture::build`,
		typeArguments: [],
		arguments: [],
	});
	return tx.serialize();
}

async function serializedTransactionKind(): Promise<string> {
	const tx = new Transaction();
	tx.moveCall({
		target: `${PACKAGE}::fixture::kind`,
		typeArguments: [],
		arguments: [],
	});
	return Buffer.from(await tx.build({ onlyTransactionKind: true })).toString(
		"base64"
	);
}

function authBody() {
	return {
		walletAddress: WALLET,
		bytes: "dGVybXM=",
		signature: "signature-bytes",
	};
}

function referralApi(
	input: {
		inspections?: {
			fetchFirstBytesFromTxOutput: (input: {
				tx: Transaction;
			}) => Promise<Uint8Array | number[]>;
		};
	} = {}
) {
	return new ReferralVaultApi(
		fakeApi({
			addresses: { referralVault: referralVaultAddresses },
			Inspections: () =>
				input.inspections ?? {
					fetchFirstBytesFromTxOutput: async () => Uint8Array.from([]),
				},
		})
	);
}

describe("ReferralVault HTTP facade", () => {
	it("gets a referrer through the service prefix and preserves None", async () => {
		const calls = installFetch(
			(input) =>
				new Response(
					String(input).endsWith("/referrer")
						? JSON.stringify("None")
						: JSON.stringify(REFERRER),
					{ status: 200 }
				)
		);
		const client = new ReferralVault({ baseUrl: BASE_URL });

		await expect(client.getReferrer({ referee: WALLET })).resolves.toBe("None");
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/referral-vault/${WALLET}/referrer`
		);
		expect(calls[0]?.init?.method).toBeUndefined();
		expect(calls[0]?.init?.body).toBeUndefined();
	});

	it("returns a concrete referrer address without adding a request body", async () => {
		const calls = installJsonFetch(REFERRER);
		await expect(
			new ReferralVault({ baseUrl: BASE_URL }).getReferrer({ referee: WALLET })
		).resolves.toBe(REFERRER);
		expect(calls[0]?.init?.body).toBeUndefined();
	});
});

describe("ReferralVault API transaction and inspection seams", () => {
	it("requires referral-vault addresses", () => {
		expect(() => new ReferralVaultApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
	});

	it("builds update_referrer_address and skips self-referrals", () => {
		const api = referralApi();
		const tx = new Transaction();
		const result = api.updateReferrerTx({ tx, referrer: REFERRER });

		expect(result).toBeDefined();
		expect(moveCallData(tx)).toMatchObject({
			package: PACKAGE,
			module: "referral_vault",
			function: "update_referrer_address",
			typeArguments: [],
		});

		const selfTx = new Transaction();
		selfTx.setSender(WALLET);
		expect(
			api.updateReferrerTx({ tx: selfTx, referrer: WALLET })
		).toBeUndefined();
		expect(transactionCommands(selfTx)).toHaveLength(0);
	});

	it("swallows invalid referrer input without partially building a command", () => {
		const tx = new Transaction();
		expect(() =>
			referralApi().updateReferrerTx({ tx, referrer: "not-an-address" })
		).not.toThrow();
		expect(transactionCommands(tx)).toHaveLength(0);
	});

	it.each([
		["withdraw_rebate", false],
		["withdraw_and_transfer", true],
	])("builds %s with the coin type and vault object", (fn, withTransfer) => {
		const tx = new Transaction();
		referralApi().withdrawRebateTx({
			tx,
			coinType: COIN_B,
			withTransfer,
		});
		expect(moveCallData(tx)).toMatchObject({
			package: PACKAGE,
			module: "referral_vault",
			function: fn,
			typeArguments: [COIN_B],
		});
	});

	it("builds rebate balance, referrer, and has-referrer inspection calls", () => {
		const api = referralApi();
		const balanceTx = new Transaction();
		api.balanceOfRebateTx({
			tx: balanceTx,
			coinType: COIN_A,
			referrer: REFERRER,
		});
		expect(moveCallData(balanceTx)).toMatchObject({
			function: "balance_of",
			typeArguments: [COIN_A],
		});

		const referrerTx = new Transaction();
		api.referrerForTx({ tx: referrerTx, referee: WALLET });
		expect(moveCallData(referrerTx)).toMatchObject({
			function: "referrer_for",
			typeArguments: [],
		});

		const hasReferrerTx = new Transaction();
		api.hasReffererTx({ tx: hasReferrerTx, referee: WALLET });
		expect(moveCallData(hasReferrerTx)).toMatchObject({
			function: "has_referrer",
			typeArguments: [],
		});
	});

	it("casts inspected little-endian rebate bytes to bigint", async () => {
		const fetchFirstBytesFromTxOutput = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(Uint8Array.from([0x15, 0xcd, 0x5b, 0x07]))
		);
		const api = referralApi({ inspections: { fetchFirstBytesFromTxOutput } });

		await expect(
			api.fetchBalanceOfRebate({ coinType: COIN_A, referrer: REFERRER })
		).resolves.toBe(123_456_789n);
		expect(fetchFirstBytesFromTxOutput).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
		});
	});

	it("maps BCS option Some and None referrers", async () => {
		const someBytes = bcs.option(bcs.Address).serialize(REFERRER).toBytes();
		const someInspection = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(someBytes)
		);
		await expect(
			referralApi({
				inspections: {
					fetchFirstBytesFromTxOutput: someInspection,
				},
			}).fetchReferrer({ referee: WALLET })
		).resolves.toBe(REFERRER);

		const noneBytes = bcs.option(bcs.Address).serialize(null).toBytes();
		await expect(
			referralApi({
				inspections: {
					fetchFirstBytesFromTxOutput: async () => noneBytes,
				},
			}).fetchReferrer({ referee: WALLET })
		).resolves.toBeUndefined();
	});
});

describe("Referrals HTTP, auth, pagination, and signing", () => {
	it("routes every public endpoint and forwards signed auth plus pagination", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			if (url.endsWith("/ref-code")) {
				return Response.json({ address: WALLET, refCode: null });
			}
			if (url.endsWith("/linked-ref-code")) {
				return Response.json({
					address: WALLET,
					linkedRefCode: null,
					linkedAt: null,
				});
			}
			if (url.endsWith("/query")) {
				return Response.json({
					refCode: "alpha",
					referees: [{ walletAddress: RECIPIENT, joinedAt: 1_700_000_000_000 }],
					totalCount: 257,
				});
			}
			if (url.endsWith("/availability")) {
				return Response.json({ refCode: "fresh", isAvailable: true });
			}
			if (url.endsWith("/create")) {
				return Response.json({
					refCode: "fresh",
					walletAddress: WALLET,
					createdAt: 1_700_000_000_000,
					status: "created",
				});
			}
			return Response.json({
				refereeAddress: WALLET,
				refCode: "alpha",
				createdAt: 1_700_000_000_001,
				status: "linked",
			});
		});
		const client = new Referrals({ baseUrl: BASE_URL, accessToken: "token" });
		const signed = authBody();

		await expect(client.getRefCode(signed)).resolves.toEqual({
			address: WALLET,
			refCode: undefined,
		});
		await expect(client.getLinkedRefCode(signed)).resolves.toEqual({
			address: WALLET,
			linkedRefCode: undefined,
			linkedAt: undefined,
		});
		await expect(
			client.getReferees({ refCode: "alpha", limit: 2, offset: 255 })
		).resolves.toEqual({
			refCode: "alpha",
			referees: [{ walletAddress: RECIPIENT, joinedAt: 1_700_000_000_000 }],
			totalCount: 257,
		});
		await expect(client.isRefCodeTaken({ refCode: "fresh" })).resolves.toEqual({
			refCode: "fresh",
			isAvailable: true,
		});
		await expect(
			client.createReferralLink({ ...signed, refCode: "fresh" })
		).resolves.toMatchObject({ refCode: "fresh", status: "created" });
		await expect(
			client.setReferrer({ ...signed, refCode: "alpha" })
		).resolves.toMatchObject({ refereeAddress: WALLET, status: "linked" });

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/referrals/ref-code`,
			`${BASE_URL}/api/referrals/linked-ref-code`,
			`${BASE_URL}/api/referrals/query`,
			`${BASE_URL}/api/referrals/availability`,
			`${BASE_URL}/api/referrals/create`,
			`${BASE_URL}/api/referrals/link`,
		]);
		expect(requestBody(calls, 0)).toEqual(signed);
		expect(requestBody(calls, 1)).toEqual(signed);
		expect(requestBody(calls, 2)).toEqual({
			refCode: "alpha",
			limit: 2,
			offset: 255,
		});
		expect(requestBody(calls, 3)).toEqual({ refCode: "fresh" });
		expect(requestBody(calls, 4)).toEqual({ ...signed, refCode: "fresh" });
		expect(requestBody(calls, 5)).toEqual({ ...signed, refCode: "alpha" });
		for (const call of calls) {
			expect(call.init?.method).toBe("POST");
			expect(call.init?.headers).toMatchObject({
				Authorization: "Bearer token",
			});
		}
	});

	it("maps present referral code and linked timestamp values", async () => {
		const calls = installFetch((input) => {
			if (String(input).endsWith("/ref-code")) {
				return Response.json({ address: WALLET, refCode: "alpha" });
			}
			return Response.json({
				address: WALLET,
				linkedRefCode: "alpha",
				linkedAt: 1_700_000_000_000,
			});
		});
		const client = new Referrals({ baseUrl: BASE_URL });

		await expect(client.getRefCode(authBody())).resolves.toEqual({
			address: WALLET,
			refCode: "alpha",
		});
		await expect(client.getLinkedRefCode(authBody())).resolves.toEqual({
			address: WALLET,
			linkedRefCode: "alpha",
			linkedAt: 1_700_000_000_000,
		});
		expect(calls).toHaveLength(2);
	});

	it("creates the deprecated action messages with second precision", () => {
		jest.spyOn(Date, "now").mockReturnValue(1_700_000_123_456);
		const client = new Referrals();

		expect(
			client.createReferralLinkMessageToSign({ refCode: "alpha" })
		).toEqual({
			action: "CREATE_REFERRAL",
			ref_code: "alpha",
			date: 1_700_000_123,
		});
		expect(client.setReferrerMessageToSign({ refCode: "alpha" })).toEqual({
			action: "LINK_REFERRAL",
			ref_code: "alpha",
			date: 1_700_000_123,
		});
	});
});

describe("UserData API and signing contract", () => {
	it("posts wallet lookup and maps a missing key to undefined", async () => {
		const calls = installJsonFetch(null);
		await expect(
			new UserData({ baseUrl: BASE_URL }).getUserPublicKey({
				walletAddress: WALLET,
			})
		).resolves.toBeUndefined();
		expect(calls[0]?.input).toBe(`${BASE_URL}/api/user-data/public-key`);
		expect(requestBody(calls)).toEqual({ walletAddress: WALLET });
	});

	it("saves a public key with signed bytes and preserves a false response", async () => {
		const calls = installJsonFetch(false);
		const body = {
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
		};

		await expect(
			new UserData({ baseUrl: BASE_URL }).createUserPublicKey(body)
		).resolves.toBe(false);
		expect(calls[0]?.input).toBe(`${BASE_URL}/api/user-data/save-public-key`);
		expect(requestBody(calls)).toEqual(body);
	});

	it("exposes the exact canonical terms message and legacy account messages", () => {
		const client = new UserData();
		expect(UserData.termsAndConditionsMessage).toBe(
			"Aftermath Terms and Conditions"
		);
		expect(client.createTermsAndConditionsMessage()).toBe(
			"Aftermath Terms and Conditions"
		);
		expect(client.createUserAccountMessageToSign()).toEqual({
			action: "CREATE_USER_ACCOUNT",
		});
		expect(client.createSignTermsAndConditionsMessageToSign()).toEqual({
			action: "SIGN_TERMS_AND_CONDITIONS",
		});
	});
});

describe("Rewards HTTP, bigint mapping, pagination, and claim transactions", () => {
	it("routes read endpoints with signed auth, cursor fields, and boundary values", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			if (url.endsWith("/points")) {
				return Response.json({ totalPoints: 0 });
			}
			if (url.endsWith("/history")) {
				return Response.json({
					history: [
						{
							vaultId: ORDER_ID,
							coinType: COIN_A,
							amount: "18446744073709551615n",
							domain: "referrals",
							epochStartTimestampMs: 1,
							epochEndTimestampMs: 2,
							txDigest: "digest",
							eventType: "deposit",
						},
					],
					pagination: { hasMore: true, nextCursor: 100 },
				});
			}
			if (url.endsWith("/claimable")) {
				return Response.json({
					rewards: [{ coinType: COIN_B, amount: "9007199254740993n" }],
				});
			}
			return Response.json({
				epoch: {
					number: 0,
					startTimestampMs: 1,
					endTimestampMs: 2,
					status: "pending",
				},
				total: {
					tokensUsd: 0,
					tokensRaw: "0",
					points: 0,
				},
				domains: [
					{
						domain: "trading",
						tokensUsd: 12.5,
						tokensRaw: "12345678901234567890",
					},
				],
			});
		});
		const client = new Rewards({
			baseUrl: BASE_URL,
			accessToken: "reward-token",
		});
		const signed = authBody();

		await expect(client.getPoints(signed)).resolves.toEqual({
			totalPoints: 0,
		});
		await expect(
			client.getHistory({
				...signed,
				domain: "referrals",
				limit: 100,
				cursor: 99,
			})
		).resolves.toMatchObject({
			history: [
				{
					amount: 18_446_744_073_709_551_615n,
				},
			],
			pagination: { hasMore: true, nextCursor: 100 },
		});
		await expect(
			client.getClaimable({ walletAddress: WALLET })
		).resolves.toEqual({
			rewards: [{ coinType: COIN_B, amount: 9_007_199_254_740_993n }],
		});
		await expect(
			client.getExpectedRewards({
				accountId: "18446744073709551616",
				epoch: 0,
				totalMakerRewards: 0,
				totalTakerRewards: 1,
				calculationVariables: {
					qScoreCoefficient: 0,
					uptimeCoefficient: 1,
					mmVolumeCoefficient: 2,
					takerVolumeCoefficient: 3,
					takerOiCoefficient: 4,
				},
				tradingPointsBudget: 5,
				aflpPointsBudget: 6,
				refereeRateLow: 0,
				refereeRateHigh: 1,
				referrerRateLow: 2,
				referrerRateHigh: 3,
				referralVolumeThreshold: 4,
			})
		).resolves.toMatchObject({
			total: { tokensRaw: "0", points: 0 },
			domains: [{ tokensRaw: "12345678901234567890" }],
		});

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/rewards/points`,
			`${BASE_URL}/api/rewards/history`,
			`${BASE_URL}/api/rewards/claimable`,
			`${BASE_URL}/api/rewards/expected-rewards`,
		]);
		expect(requestBody(calls, 0)).toEqual(signed);
		expect(requestBody(calls, 1)).toEqual({
			...signed,
			domain: "referrals",
			limit: 100,
			cursor: 99,
		});
		expect(requestBody(calls, 2)).toEqual({ walletAddress: WALLET });
		expect(requestBody(calls, 3)).toEqual({
			accountId: "18446744073709551616",
			epoch: 0,
			totalMakerRewards: 0,
			totalTakerRewards: 1,
			calculationVariables: {
				qScoreCoefficient: 0,
				uptimeCoefficient: 1,
				mmVolumeCoefficient: 2,
				takerVolumeCoefficient: 3,
				takerOiCoefficient: 4,
			},
			tradingPointsBudget: 5,
			aflpPointsBudget: 6,
			refereeRateLow: 0,
			refereeRateHigh: 1,
			referrerRateLow: 2,
			referrerRateHigh: 3,
			referralVolumeThreshold: 4,
		});
	});

	it("turns a server tx kind into a Transaction and forwards optional coin filters", async () => {
		const txKind = await serializedTransactionKind();
		const fetchBase64TxKindFromTx = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(txKind)
		);
		const transactions = { fetchBase64TxKindFromTx };
		const calls = installJsonFetch({ txKind });
		const client = new Rewards(
			{
				baseUrl: BASE_URL,
			},
			fakeApi({ Transactions: () => transactions })
		);
		const inputTx = new Transaction();

		const result = await client.getClaimTransaction({
			walletAddress: WALLET,
			coinTypes: [COIN_A, COIN_B],
			recipientAddress: RECIPIENT,
			tx: inputTx,
		});

		expect(result.tx).toBeInstanceOf(Transaction);
		expect(fetchBase64TxKindFromTx).toHaveBeenCalledWith({ tx: inputTx });
		expect(requestBody(calls)).toEqual({
			walletAddress: WALLET,
			coinTypes: [COIN_A, COIN_B],
			recipientAddress: RECIPIENT,
			txKind,
		});
	});

	it("uses the sponsored full-transaction response branch and supports a missing API", async () => {
		const txKind = await serializedTransactionKind();
		const fullTransaction = serializedTransaction();
		const fetchBase64TxKindFromTx = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(txKind)
		);
		const calls = installJsonFetch({
			txKind: fullTransaction,
			sponsorSignature: "sponsor-signature",
		});
		const sponsoredResult = await new Rewards(
			{ baseUrl: BASE_URL },
			fakeApi({
				Transactions: () => ({ fetchBase64TxKindFromTx }),
			})
		).getClaimTransaction({ walletAddress: WALLET });

		expect(sponsoredResult).toMatchObject({
			sponsorSignature: "sponsor-signature",
			tx: expect.any(Transaction),
		});
		expect(requestBody(calls)).toEqual({ walletAddress: WALLET, txKind });

		const missingApiCalls = installJsonFetch({ txKind });
		await expect(
			new Rewards({ baseUrl: BASE_URL }).getClaimTransaction({
				walletAddress: WALLET,
			})
		).resolves.toMatchObject({ tx: expect.any(Transaction) });
		expect(requestBody(missingApiCalls)).toEqual({ walletAddress: WALLET });
	});

	it("normalizes an HTTP failure as an SDK transport error", async () => {
		installJsonFetch({ error: "rate limited" }, 429, { "Retry-After": "3" });
		await expect(
			new Rewards({ baseUrl: BASE_URL }).getPoints(authBody())
		).rejects.toMatchObject({ kind: "http", status: 429, retryAfterMs: 3000 });
	});
});

const DCA_ORDER_RESPONSE = {
	objectId: ORDER_ID,
	overview: {
		allocatedCoin: { coin: COIN_A, amount: "10000000000000000001n" },
		buyCoin: { coin: COIN_B, amount: "2500000000000000000n" },
		totalSpent: "5000000000000000000n",
		intervalMs: 3_600_000,
		totalTrades: 5,
		tradesRemaining: 4,
		maxSlippageBps: 75,
		strategy: { minPrice: "1n", maxPrice: "2n" },
		recipient: RECIPIENT,
		progress: 0.2,
		created: {
			timestamp: 1_700_000_000_000,
			time: 1_700_000_000_000,
			txnDigest: "created-digest",
			tnxDigest: "created-digest",
		},
		nextTrade: {
			timestamp: 1_700_003_600_000,
			time: 1_700_003_600_000,
			txnDigest: "next-digest",
			tnxDigest: "next-digest",
		},
		integratorFee: { feeBps: 10, feeRecipient: REFERRER },
	},
	trades: [
		{
			allocatedCoin: { coin: COIN_A, amount: "1000000000000000000n" },
			buyCoin: { coin: COIN_B, amount: "500000000000000000n" },
			txnDigest: "trade-digest",
			tnxDigest: "trade-digest",
			txnTimestamp: 1_700_000_100_000,
			tnxDate: 1_700_000_100_000,
			rate: 0.5,
		},
	],
	failed: [{ timestamp: 1_700_000_200_000, reason: "STRATEGY" }],
};

describe("DCA HTTP facade and transaction inputs", () => {
	it("fetches all, active, and past orders while preserving bigint response data", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			let payload: unknown = [];
			if (url.endsWith("/orders")) {
				payload = { active: [DCA_ORDER_RESPONSE], past: [] };
			} else if (url.endsWith("/active")) {
				payload = [DCA_ORDER_RESPONSE];
			}
			return Response.json(payload);
		});
		const client = new Dca({ baseUrl: BASE_URL });

		await expect(
			client.getAllDcaOrders({ walletAddress: WALLET })
		).resolves.toEqual({
			active: [
				expect.objectContaining({
					overview: expect.objectContaining({
						allocatedCoin: {
							coin: COIN_A,
							amount: 10_000_000_000_000_000_001n,
						},
					}),
				}),
			],
			past: [],
		});
		await expect(
			client.getActiveDcaOrders({ walletAddress: WALLET })
		).resolves.toHaveLength(1);
		await expect(
			client.getPastDcaOrders({ walletAddress: WALLET })
		).resolves.toEqual([]);

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/dca/orders`,
			`${BASE_URL}/api/dca/active`,
			`${BASE_URL}/api/dca/past`,
		]);
		for (const call of calls) {
			expect(requestBody([call])).toEqual({ walletAddress: WALLET });
		}
	});

	it("posts bigint-safe create-order options and restores a Transaction", async () => {
		const calls = installJsonFetch(serializedTransaction());
		const input = {
			walletAddress: WALLET,
			allocateCoinType: COIN_A,
			allocateCoinAmount: 10_000_000_000_000_000_001n,
			buyCoinType: COIN_B,
			frequencyMs: 0,
			tradesAmount: 1,
			strategy: { minPrice: 1n, maxPrice: 2n },
			isSponsoredTx: false,
			delayTimeMs: 0,
			maxAllowableSlippageBps: 0,
			coinPerTradeAmount: 5n,
			customRecipient: RECIPIENT,
			integratorFee: { feeBps: 10, feeRecipient: REFERRER },
		};

		const result = await new Dca({ baseUrl: BASE_URL }).getCreateDcaOrderTx(
			input
		);
		expect(result).toBeInstanceOf(Transaction);
		expect(result.getData().sender).toBe(WALLET);
		expect(requestBody(calls)).toEqual({
			...input,
			allocateCoinAmount: "10000000000000000001n",
			strategy: { minPrice: "1n", maxPrice: "2n" },
			coinPerTradeAmount: "5n",
		});
	});

	it("forwards signed cancellation data and preserves false responses", async () => {
		const calls = installJsonFetch(false);
		const input = {
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
			orderObjectIds: [ORDER_ID, SECOND_ORDER_ID],
		};

		await expect(
			new Dca({ baseUrl: BASE_URL }).closeDcaOrder(input)
		).resolves.toBe(false);
		expect(calls[0]?.input).toBe(`${BASE_URL}/api/dca/cancel`);
		expect(requestBody(calls)).toEqual(input);
	});

	it("builds cancellation signing data and retains deprecated user endpoints", async () => {
		const client = new Dca({ baseUrl: BASE_URL });
		expect(
			client.closeDcaOrdersMessageToSign({ orderIds: [ORDER_ID] })
		).toEqual({
			action: "CANCEL_DCA_ORDERS",
			order_object_ids: [ORDER_ID],
		});
		expect(client.createUserAccountMessageToSign()).toEqual({
			action: "CREATE_DCA_ACCOUNT",
		});

		const calls = installFetch(
			(input) =>
				new Response(String(input).endsWith("/user/get") ? "null" : "true")
		);
		await expect(
			client.getUserPublicKey({ walletAddress: WALLET })
		).resolves.toBe(undefined);
		await expect(
			client.createUserPublicKey({
				walletAddress: WALLET,
				bytes: "dGVybXM=",
				signature: "sig",
			})
		).resolves.toBe(true);
		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/dca/user/get`,
			`${BASE_URL}/api/dca//user/add`,
		]);
		expect(requestBody(calls, 0)).toEqual({ walletAddress: WALLET });
		expect(requestBody(calls, 1)).toEqual({
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
		});
	});
});

describe("DcaApi on-chain boundary", () => {
	it("requires DCA addresses and exposes all event type variants", () => {
		expect(() => new DcaApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
		const api = new DcaApi(fakeApi({ addresses: { dca: dcaAddresses } }));
		expect(api.addresses).toEqual(dcaAddresses);
		expect(api.eventTypes).toEqual({
			createdOrder: `${EVENTS}::events::CreatedOrderEvent`,
			createdOrderV2: `${EVENTS_V2}::events::CreatedOrderEventV2`,
			closedOrder: `${EVENTS}::events::ClosedOrderEvent`,
			executedTrade: `${EVENTS}::events::ExecutedTradeEvent`,
		});
	});

	it("builds close_order for both object IDs and prebuilt transaction arguments", () => {
		const api = new DcaApi(fakeApi({ addresses: { dca: dcaAddresses } }));
		const tx = new Transaction();
		api.createCloseOrderTx({
			tx,
			allocateCoinType: COIN_A,
			buyCoinType: COIN_B,
			orderId: ORDER_ID,
		});
		expect(moveCallData(tx)).toMatchObject({
			package: PACKAGE,
			module: "order",
			function: "close_order",
			typeArguments: [COIN_A, COIN_B],
		});

		const argumentTx = new Transaction();
		const orderArgument = argumentTx.object(ORDER_ID);
		api.createCloseOrderTx({
			tx: argumentTx,
			allocateCoinType: COIN_A,
			buyCoinType: COIN_B,
			orderId: orderArgument,
		});
		expect(moveCallData(argumentTx)).toMatchObject({
			function: "close_order",
			typeArguments: [COIN_A, COIN_B],
		});
	});
});

const LIMIT_ORDER_RESPONSE = {
	objectId: ORDER_ID,
	allocatedCoin: { coin: COIN_A, amount: "9007199254740993n" },
	buyCoin: { coin: COIN_B, amount: "123n" },
	currentAmountSold: "1n",
	currentAmountBought: "2n",
	recipient: RECIPIENT,
	created: { timestamp: 1, txnDigest: "created" },
	finished: { timestamp: 2, txnDigest: "finished" },
	expiryTimestamp: 3,
	status: "StopLossTriggered",
	error: "stop-loss",
	integratorFee: { feeBps: 20, feeRecipient: REFERRER },
	outputToInputStopLossExchangeRate: 0.25,
};

describe("LimitOrders HTTP facade and signing", () => {
	it("routes active, past, minimum-size, cancel, and preserves response bigint fields", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			if (url.endsWith("/active")) {
				return Response.json([LIMIT_ORDER_RESPONSE]);
			}
			if (url.endsWith("/past")) {
				return Response.json([]);
			}
			if (url.endsWith("/min-order-size-usd")) {
				return Response.json(0);
			}
			return Response.json(false);
		});
		const client = new LimitOrders({ baseUrl: BASE_URL });
		const signed = authBody();

		await expect(client.getActiveLimitOrders(signed)).resolves.toEqual([
			expect.objectContaining({
				allocatedCoin: {
					coin: COIN_A,
					amount: 9_007_199_254_740_993n,
				},
				status: "StopLossTriggered",
			}),
		]);
		await expect(
			client.getPastLimitOrders({ walletAddress: WALLET })
		).resolves.toEqual([]);
		await expect(client.getMinOrderSizeUsd()).resolves.toBe(0);
		await expect(
			client.cancelLimitOrder({
				...signed,
				orderObjectIds: [ORDER_ID],
			})
		).resolves.toBe(false);

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/limit-orders/active`,
			`${BASE_URL}/api/limit-orders/past`,
			`${BASE_URL}/api/limit-orders/min-order-size-usd`,
			`${BASE_URL}/api/limit-orders/cancel`,
		]);
		expect(requestBody(calls, 0)).toEqual(signed);
		expect(requestBody(calls, 1)).toEqual({ walletAddress: WALLET });
		expect(requestBody(calls, 2)).toEqual({});
		expect(requestBody(calls, 3)).toEqual({
			...signed,
			orderObjectIds: [ORDER_ID],
		});
	});

	it("posts create-order boundaries with bigint amounts and restores the sender", async () => {
		const calls = installJsonFetch(serializedTransaction());
		const input = {
			walletAddress: WALLET,
			allocateCoinType: COIN_A,
			allocateCoinAmount: 9_007_199_254_740_993n,
			buyCoinType: COIN_B,
			customRecipient: RECIPIENT,
			expiryDurationMs: 0,
			isSponsoredTx: false,
			integratorFee: { feeBps: 0, feeRecipient: REFERRER },
			outputToInputExchangeRate: 0,
			outputToInputStopLossExchangeRate: 0.25,
		};
		const result = await new LimitOrders({
			baseUrl: BASE_URL,
		}).getCreateLimitOrderTx(input);

		expect(result).toBeInstanceOf(Transaction);
		expect(result.getData().sender).toBe(WALLET);
		expect(requestBody(calls)).toEqual({
			...input,
			allocateCoinAmount: "9007199254740993n",
		});
	});

	it("creates the deprecated cancellation signing payload", () => {
		expect(
			new LimitOrders().cancelLimitOrdersMessageToSign({
				orderIds: [ORDER_ID, SECOND_ORDER_ID],
			})
		).toEqual({
			action: "CANCEL_LIMIT_ORDERS",
			order_object_ids: [ORDER_ID, SECOND_ORDER_ID],
		});
	});
});

describe("LimitOrdersApi event boundary", () => {
	it("requires addresses and creates the CreatedOrderEventV1 type", () => {
		expect(() => new LimitOrdersApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
		const api = new LimitOrdersApi(
			fakeApi({ addresses: { limitOrders: limitAddresses } })
		);
		expect(api.addresses).toEqual(limitAddresses);
		expect(api.eventTypes).toEqual({
			createdOrder: `${EVENTS}::events::CreatedOrderEventV1`,
		});
	});
});

const SHARED_CUSTODY_PUBLIC_KEY =
	"AP0XJDhaoMdbZPt4zWAvodmR/ev3axPFjtcC6sg16fYY";
const USER_PUBLIC_KEY = Uint8Array.from([
	234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197, 249, 149,
	71, 118, 174, 190, 190, 123, 146, 66, 30, 234, 105, 20, 70, 210, 44,
]);
const EXPECTED_MULTISIG_ADDRESS =
	"0xc59d4d9d6424ba44eadeb88120e2ef0fa163d1464df643c0e485a2afee37bd6c";
const EXPECTED_MULTISIG_RAW_BYTES = Uint8Array.from([
	2, 0, 253, 23, 36, 56, 90, 160, 199, 91, 100, 251, 120, 205, 96, 47, 161, 217,
	145, 253, 235, 247, 107, 19, 197, 142, 215, 2, 234, 200, 53, 233, 246, 24, 1,
	0, 234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197, 249,
	149, 71, 118, 174, 190, 190, 123, 146, 66, 30, 234, 105, 20, 70, 210, 44, 1,
	1, 0,
]);

describe("Multisig API and facade", () => {
	it("requires shared-custody addresses", () => {
		expect(() => new MultisigApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
	});

	it("derives a deterministic 1-of-2 multisig from 32-byte and flagged keys", () => {
		const api = new MultisigApi(
			fakeApi({
				addresses: {
					sharedCustody: {
						address: RECIPIENT,
						publicKey: SHARED_CUSTODY_PUBLIC_KEY,
					},
				},
			})
		);

		const result = api.getMultisigForUser({ userPublicKey: USER_PUBLIC_KEY });
		const flaggedUserKey = Uint8Array.from([0, ...USER_PUBLIC_KEY]);
		const flaggedResult = api.getMultisigForUser({
			userPublicKey: flaggedUserKey,
		});

		expect(result.address).toBe(EXPECTED_MULTISIG_ADDRESS);
		expect(result.publicKey.toRawBytes()).toEqual(EXPECTED_MULTISIG_RAW_BYTES);
		expect(flaggedResult.address).toBe(EXPECTED_MULTISIG_ADDRESS);
		expect(flaggedResult.publicKey.toRawBytes()).toEqual(
			EXPECTED_MULTISIG_RAW_BYTES
		);
	});

	it("rejects malformed user public keys", () => {
		const api = new MultisigApi(
			fakeApi({
				addresses: {
					sharedCustody: {
						address: RECIPIENT,
						publicKey: SHARED_CUSTODY_PUBLIC_KEY,
					},
				},
			})
		);
		expect(() =>
			api.getMultisigForUser({ userPublicKey: new Uint8Array(31) })
		).toThrow();
	});

	it("rejects a shared-custody record without a public key", () => {
		const api = new MultisigApi(
			fakeApi({
				addresses: {
					sharedCustody: { address: RECIPIENT, publicKey: "" },
				},
			})
		);
		expect(() =>
			api.getMultisigForUser({ userPublicKey: USER_PUBLIC_KEY })
		).toThrow();
	});

	it("delegates through the public facade and reports a missing provider", () => {
		const getMultisigForUser = jest.fn().mockReturnValue({
			address: EXPECTED_MULTISIG_ADDRESS,
			publicKey: "public-key",
		});
		const api = fakeApi({
			Multisig: () => ({ getMultisigForUser }),
		});
		const client = new Multisig({}, api);
		const input = { userPublicKey: USER_PUBLIC_KEY };

		expect(client.getMultisigForUser(input)).toEqual({
			address: EXPECTED_MULTISIG_ADDRESS,
			publicKey: "public-key",
		});
		expect(getMultisigForUser).toHaveBeenCalledWith(input);
		expect(() => new Multisig().getMultisigForUser(input)).toThrow(
			"missing AftermathApi instance"
		);
	});

	it("uses fixed Ed25519 inputs rather than random key material", () => {
		const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
		expect(keypair.getPublicKey().toRawBytes()).toEqual(USER_PUBLIC_KEY);
	});
});
