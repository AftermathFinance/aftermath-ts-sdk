import { jest } from "@jest/globals";

import { Transaction } from "@mysten/sui/transactions";

import {
	AftermathApi,
	Casting,
	Farms,
	FarmsStakedPosition,
	type FarmsStakedPositionObject,
	FarmsStakingPool,
	type FarmsStakingPoolObject,
	Staking,
	type SuiObjectView,
} from "@sdk";

import { FarmsApi } from "@sdk/packages/farms/api/farmsApi";

import { StakingApi } from "@sdk/packages/staking/api/stakingApi";

const FULL_1 =
	"0x0000000000000000000000000000000000000000000000000000000000000001";

const FULL_2 =
	"0x0000000000000000000000000000000000000000000000000000000000000002";

const FULL_3 =
	"0x0000000000000000000000000000000000000000000000000000000000000003";

const FULL_4 =
	"0x0000000000000000000000000000000000000000000000000000000000000004";

const FULL_9 =
	"0x0000000000000000000000000000000000000000000000000000000000000009";

const FULL_10 =
	"0x000000000000000000000000000000000000000000000000000000000000000a";

const SUI_TYPE = "0x2::sui::SUI";

const NORMALIZED_SUI_TYPE = `${FULL_2}::sui::SUI`;

const FARM_TYPE = "0x9::vault::Vault";

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

function lastMoveCall(tx: Transaction) {
	const calls = moveCalls(tx);
	return calls[calls.length - 1];
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

function makePool(
	overrides: Partial<FarmsStakingPoolObject> = {}
): FarmsStakingPoolObject {
	return {
		objectId: FULL_10,
		objectType: `${FULL_9}::vault::Vault`,
		stakeCoinType: NORMALIZED_SUI_TYPE,
		stakedAmount: 1_000n,
		stakedAmountWithMultiplier: 1_000n,
		minLockDurationMs: 1000,
		maxLockDurationMs: 5000,
		maxLockMultiplier: 2_000_000_000_000_000_000n,
		rewardCoins: [
			{
				coinType: SUI_TYPE,
				rewards: 10_000n,
				rewardsAccumulatedPerShare: 0n,
				emissionRate: 100n,
				emissionSchedulesMs: 1000,
				emissionStartTimestamp: 0,
				lastRewardTimestamp: 0,
				rewardsRemaining: 10_000n,
				actualRewards: 10_000n,
			},
			{
				coinType: "0x3::example::REWARD",
				rewards: 50n,
				rewardsAccumulatedPerShare: 0n,
				emissionRate: 51n,
				emissionSchedulesMs: 1000,
				emissionStartTimestamp: 0,
				lastRewardTimestamp: 0,
				rewardsRemaining: 50n,
				actualRewards: 50n,
			},
		],
		emissionEndTimestamp: 10_000,
		minStakeAmount: 100n,
		isUnlocked: false,
		lockEnforcement: "Strict",
		version: 2,
		...overrides,
	};
}

function makePosition(
	overrides: Partial<FarmsStakedPositionObject> = {}
): FarmsStakedPositionObject {
	return {
		objectId: FULL_3,
		objectType: `${FULL_9}::staked_position::StakedPosition`,
		stakingPoolObjectId: FULL_10,
		stakeCoinType: NORMALIZED_SUI_TYPE,
		stakedAmount: 100n,
		stakedAmountWithMultiplier: 150n,
		lockStartTimestamp: 1000,
		lockDurationMs: 2000,
		lockMultiplier: 1_500_000_000_000_000_000n,
		rewardCoins: [
			{
				coinType: SUI_TYPE,
				baseRewardsAccumulated: 12n,
				baseRewardsDebt: 0n,
				multiplierRewardsAccumulated: 5n,
				multiplierRewardsDebt: 0n,
			},
		],
		lastHarvestRewardsTimestamp: 1000,
		version: 2,
		...overrides,
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

function eventV2(parsedJson: unknown, type = EVENT_TYPE) {
	return {
		...eventV1({ pos0: parsedJson }, type),
	};
}

const eventMeta = {
	timestamp: 1_700_000_000_123,
	txnDigest: "digest-1",
	type: EVENT_TYPE,
};

export {
	Farms,
	FarmsStakedPosition,
	FarmsStakingPool,
	jest,
	makePool,
	makePosition,
	SUI_TYPE,
	Casting,
	eventMeta,
	eventV1,
	eventV2,
	FarmsApi,
	FULL_1,
	FULL_2,
	FULL_3,
	FULL_9,
	makeFakeApi,
	NORMALIZED_SUI_TYPE,
	objectView,
	AftermathApi,
	FULL_10,
	ADDRESSES,
	API_BASE_URL,
	EVENT_TYPE,
	FARM_TYPE,
	FULL_4,
	installFetchQueue,
	lastMoveCall,
	moveCalls,
	StakingApi,
	Transaction,
};
