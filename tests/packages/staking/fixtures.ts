import { jest } from "@jest/globals";

import { Transaction } from "@mysten/sui/transactions";

import {
	AftermathApi,
	Casting,
	Staking,
	type StakingPosition,
	type SuiObjectView,
} from "@sdk";

import { StakingApi } from "@sdk/packages/staking/api/stakingApi";

import {
	isStakePosition,
	isSuiDelegatedStake,
	isUnstakePosition,
} from "@sdk/packages/staking/stakingTypes";

const FULL_1 =
	"0x0000000000000000000000000000000000000000000000000000000000000001";

const FULL_2 =
	"0x0000000000000000000000000000000000000000000000000000000000000002";

const FULL_3 =
	"0x0000000000000000000000000000000000000000000000000000000000000003";

const FULL_4 =
	"0x0000000000000000000000000000000000000000000000000000000000000004";

const FULL_5 =
	"0x0000000000000000000000000000000000000000000000000000000000000005";

const FULL_6 =
	"0x0000000000000000000000000000000000000000000000000000000000000006";

const FULL_9 =
	"0x0000000000000000000000000000000000000000000000000000000000000009";

const FULL_10 =
	"0x000000000000000000000000000000000000000000000000000000000000000a";

const EVENT_TYPE = "0x9::events::Event";

const API_BASE_URL = "https://sdk.test";

const ADDRESSES = {
	staking: {
		packages: { lsd: "0x101", afsui: "0x102", events: "0x103" },
		objects: {
			stakedSuiVault: "0x111",
			stakedSuiVaultState: "0x112",
			safe: "0x113",
			treasury: "0x114",
			referralVault: "0x115",
			validatorConfigsTable: "0x116",
			aftermathValidator: FULL_4,
		},
	},
	farms: {
		packages: {
			vaults: "0x201",
			vaultsInitial: "0x202",
			vaultsV2: "0x203",
			eventsV2: "0x204",
		},
		objects: { version: "0x205" },
	},
} as const;

type FetchCall = {
	input: RequestInfo | URL;
	init?: RequestInit;
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetchQueue(responses: Array<unknown | Response>): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ input, init });
		const response = responses.shift();
		if (response instanceof Response) {
			return response;
		}
		return Response.json(response);
	}) as typeof fetch;
	return calls;
}

function objectView(
	type: string,
	json: Record<string, unknown>,
	objectId = "0x1"
): SuiObjectView {
	return {
		objectId,
		version: "1",
		digest: "digest",
		owner: { AddressOwner: FULL_1 },
		type,
		json,
		display: null,
	} as unknown as SuiObjectView;
}

function moveCalls(tx: Transaction): Array<{
	function: string;
	module: string;
	package: string;
	arguments: unknown[];
}> {
	const data = tx.getData() as {
		commands: Array<{
			MoveCall?: {
				function: string;
				module: string;
				package: string;
				arguments: unknown[];
			};
		}>;
	};
	return data.commands.flatMap((command) =>
		command.MoveCall ? [command.MoveCall] : []
	);
}

function makeFakeApi() {
	const coin = {
		fetchCoinWithAmountTx: jest.fn(async ({ tx }: { tx: Transaction }) =>
			tx.object("0x301")
		),
	};
	const referralVault = {
		updateReferrerTx: jest.fn(({ tx }: { tx: Transaction }) => tx),
	};
	const staking = {
		addresses: ADDRESSES.staking,
		stakeTx: jest.fn(),
	};
	const objects = {
		fetchCastObjectsOwnedByAddressOfType: jest.fn<() => Promise<unknown[]>>(),
	};
	const api = {
		addresses: ADDRESSES,
		Coin: jest.fn(() => coin),
		ReferralVault: jest.fn(() => referralVault),
		Staking: jest.fn(() => staking),
		Objects: jest.fn(() => objects),
	};

	return {
		api: api as unknown as AftermathApi,
		coin,
		referralVault,
		staking,
		objects,
	};
}

function eventV1(parsedJson: unknown, type = EVENT_TYPE) {
	return {
		id: { txDigest: "digest-1", eventSeq: "0" },
		packageId: "0x9",
		transactionModule: "events",
		sender: FULL_1,
		type,
		parsedJson,
		bcs: "",
		timestampMs: "1700000000123",
	};
}

const eventMeta = {
	timestamp: 1_700_000_000_123,
	txnDigest: "digest-1",
	type: EVENT_TYPE,
};

export {
	Staking,
	FULL_9,
	FULL_10,
	Casting,
	eventMeta,
	eventV1,
	FULL_1,
	FULL_2,
	FULL_3,
	FULL_4,
	FULL_5,
	FULL_6,
	objectView,
	AftermathApi,
	jest,
	API_BASE_URL,
	installFetchQueue,
	isStakePosition,
	isSuiDelegatedStake,
	isUnstakePosition,
	makeFakeApi,
	moveCalls,
	StakingApi,
	Transaction,
};

export type { StakingPosition };
