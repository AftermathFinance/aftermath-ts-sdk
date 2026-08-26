import { Transaction } from "@mysten/sui/transactions";

import {
	AftermathApi,
	type AftermathApi as AftermathApiType,
	NftAmm,
} from "@sdk";

import { NftAmmApi } from "@sdk/packages/nftAmm/api/nftAmmApi";

import { NftAmmApiCasting } from "@sdk/packages/nftAmm/api/nftAmmApiCasting";

import { NftAmmMarket } from "@sdk/packages/nftAmm/nftAmmMarket";

import { type FetchCall, installRecordedFetch } from "@test/support/http";

import { transactionCommands } from "@test/support/transactions";

type JsonRecord = Record<string, unknown>;

const originalFetch = globalThis.fetch;

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

function moveCall(tx: Transaction): JsonRecord {
	const command = transactionCommands(tx).find(
		(candidate) => candidate.$kind === "MoveCall"
	);
	if (!command || typeof command.MoveCall !== "object") {
		throw new Error("expected a MoveCall command");
	}
	return command.MoveCall as JsonRecord;
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

export {
	marketFixture,
	NftAmmApiCasting,
	fakeApi,
	NftAmmMarket,
	Transaction,
	AftermathApi,
	assetCoin,
	fractionalizedCoin,
	installJsonFetch,
	installRejectingFetch,
	lpCoin,
	marketJsonFixture,
	NftAmm,
	NftAmmApi,
	nftAmmAddresses,
	nftType,
	providerWithClient,
	RecordingTransaction,
	recordingMoveCall,
};

export type { JsonRecord, FetchCall };
