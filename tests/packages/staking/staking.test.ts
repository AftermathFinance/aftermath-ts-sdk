import {
	API_BASE_URL,
	FULL_1,
	FULL_2,
	FULL_3,
	FULL_4,
	FULL_5,
	FULL_6,
	FULL_9,
	FULL_10,
	installFetchQueue,
	isStakePosition,
	isSuiDelegatedStake,
	isUnstakePosition,
	makeFakeApi,
	moveCalls,
	Staking,
	StakingApi,
	type StakingPosition,
	Transaction,
} from "@test/packages/staking/fixtures.js";

describe("staking type guards and state transitions", () => {
	it("distinguishes native delegated stakes, stake positions, and unstake positions", () => {
		const delegated = {
			status: "Active" as const,
			stakedSuiId: FULL_2,
			stakeRequestEpoch: 1n,
			stakeActiveEpoch: 2n,
			principal: 3n,
			validatorAddress: FULL_3,
			stakingPool: FULL_4,
		};
		const stake = {
			stakedSuiId: FULL_2,
			suiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: 4n,
			suiStakeAmount: 5n,
			validatorFee: 0.01,
			isRestaked: false,
			afSuiId: FULL_5,
			afSuiAmount: 6n,
			timestamp: 7,
			txnDigest: "digest-stake",
		};
		const request = {
			state: "REQUEST" as const,
			afSuiId: FULL_5,
			providedAfSuiAmount: 8n,
			requester: FULL_1,
			epoch: 9n,
			timestamp: 10,
			txnDigest: "digest-request",
		};

		expect(isSuiDelegatedStake(delegated as never)).toBe(true);
		expect(isSuiDelegatedStake(stake as never)).toBe(false);
		expect(isStakePosition(stake as never)).toBe(true);
		expect(isUnstakePosition(request as never)).toBe(true);
	});

	it("maps staking and unstaking events while retaining event ordering and epoch state", () => {
		const stake: StakingPosition = {
			stakedSuiId: FULL_2,
			suiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: 4n,
			suiStakeAmount: 5n,
			validatorFee: 0.01,
			isRestaked: false,
			afSuiId: FULL_5,
			afSuiAmount: 6n,
			timestamp: 100,
			txnDigest: "stake-digest",
		};
		const request: StakingPosition = {
			state: "REQUEST",
			afSuiId: FULL_6,
			providedAfSuiAmount: 10n,
			requester: FULL_1,
			epoch: 8n,
			timestamp: 200,
			txnDigest: "request-digest",
		};
		const finalizedEvent = {
			afSuiId: FULL_6,
			providedAfSuiAmount: 11n,
			suiId: FULL_2,
			returnedSuiAmount: 12n,
			requester: FULL_1,
			epoch: 99n,
			timestamp: 300,
			txnDigest: "finalized-digest",
			type: "0x9::events::UnstakedEvent",
		};

		const updated = StakingApi.updateStakingPositionsFromEvent({
			stakingPositions: [stake, request],
			event: finalizedEvent,
		});

		expect(updated).toEqual([
			{
				...finalizedEvent,
				state: "SUI_MINTED",
				epoch: 8n,
			},
			stake,
		]);

		const inserted = StakingApi.updateStakingPositionsFromEvent({
			stakingPositions: [],
			event: {
				...finalizedEvent,
				afSuiId: FULL_3,
				timestamp: undefined,
			},
		});
		expect(inserted).toEqual([
			{
				...finalizedEvent,
				afSuiId: FULL_3,
				state: "SUI_MINTED",
				timestamp: undefined,
			},
		]);

		const requestInserted = StakingApi.updateStakingPositionsFromEvent({
			stakingPositions: [],
			event: {
				...request,
				timestamp: 400,
				type: "0x9::events::UnstakeRequestedEvent",
			},
		});
		expect(requestInserted[0]).toEqual({
			...request,
			timestamp: 400,
			type: "0x9::events::UnstakeRequestedEvent",
			state: "REQUEST",
		});
	});
});

describe("staking HTTP facade", () => {
	it("forwards endpoint bodies and restores bigint/optional response values", async () => {
		const positionPayload = {
			stakedSuiId: FULL_2,
			suiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: "17n",
			suiStakeAmount: "9007199254740993n",
			validatorFee: 0.01,
			isRestaked: false,
			afSuiId: FULL_5,
			afSuiAmount: "19n",
			timestamp: 20,
			txnDigest: "position-digest",
			type: "0x9::events::StakedEvent",
		};
		const delegatedPayload = {
			status: "Active",
			stakedSuiId: FULL_2,
			stakeRequestEpoch: "21n",
			stakeActiveEpoch: "22n",
			principal: "23n",
			validatorAddress: FULL_4,
			stakingPool: FULL_6,
		};
		const vaultPayload = {
			objectId: FULL_10,
			objectType: `${FULL_9}::staked_sui_vault::State`,
			atomicUnstakeSuiReservesTargetValue: "24n",
			atomicUnstakeSuiReserves: "25n",
			minAtomicUnstakeFee: "26n",
			maxAtomicUnstakeFee: "27n",
			totalRewardsAmount: "28n",
			totalSuiAmount: "29n",
			activeEpoch: "30n",
		};
		const responses = [
			[{ suiAddress: FULL_4 }],
			{ [FULL_4]: 0.04 },
			[{ objectId: FULL_2, objectType: `${FULL_9}::validator::Config` }],
			[positionPayload],
			[delegatedPayload],
			[{ objectId: FULL_3, objectType: `${FULL_9}::validator::Cap` }],
			123,
			1.05,
			vaultPayload,
			0.045,
			[{ timestamp: 31, apy: 0.05 }],
		];
		const calls = installFetchQueue(responses);
		const staking = new Staking({ baseUrl: API_BASE_URL });

		expect(await staking.getActiveValidators()).toEqual([
			{ suiAddress: FULL_4 },
		]);
		expect(await staking.getValidatorApys()).toEqual({ [FULL_4]: 0.04 });
		expect(await staking.getValidatorConfigs()).toEqual([
			{ objectId: FULL_2, objectType: `${FULL_9}::validator::Config` },
		]);
		const positions = await staking.getStakingPositions({
			walletAddress: FULL_1,
			cursor: 2,
			limit: 1,
		});
		expect(
			(positions[0] as { suiStakeAmount?: bigint } | undefined)?.suiStakeAmount
		).toBe(9_007_199_254_740_993n);
		expect(await staking.getDelegatedStakes({ walletAddress: FULL_1 })).toEqual(
			[
				{
					...delegatedPayload,
					stakeRequestEpoch: 21n,
					stakeActiveEpoch: 22n,
					principal: 23n,
				},
			]
		);
		expect(
			await staking.getValidatorOperationCaps({ walletAddress: FULL_1 })
		).toEqual([{ objectId: FULL_3, objectType: `${FULL_9}::validator::Cap` }]);
		expect(await staking.getSuiTvl()).toBe(123);
		expect(await staking.getAfSuiToSuiExchangeRate()).toBe(1.05);
		expect(await staking.getStakedSuiVaultState()).toEqual({
			...vaultPayload,
			atomicUnstakeSuiReservesTargetValue: 24n,
			atomicUnstakeSuiReserves: 25n,
			minAtomicUnstakeFee: 26n,
			maxAtomicUnstakeFee: 27n,
			totalRewardsAmount: 28n,
			totalSuiAmount: 29n,
			activeEpoch: 30n,
		});
		expect(await staking.getApy()).toBe(0.045);
		expect(await staking.getHistoricalApy({ timeframe: "1W" })).toEqual([
			{ timestamp: 31, apy: 0.05 },
		]);

		expect(calls).toHaveLength(11);
		expect(String(calls[0]?.input)).toBe(
			`${API_BASE_URL}/api/staking/active-validators`
		);
		expect(String(calls[3]?.input)).toBe(
			`${API_BASE_URL}/api/staking/staking-positions`
		);
		expect(calls[3]?.init?.method).toBe("POST");
		expect(JSON.parse(calls[3]?.init?.body as string)).toEqual({
			walletAddress: FULL_1,
			cursor: 2,
			limit: 1,
		});
	});

	it("classifies a deterministic HTTP failure at the provider boundary", async () => {
		installFetchQueue([
			new Response("temporarily unavailable", {
				status: 429,
				statusText: "Too Many Requests",
				headers: { "Retry-After": "3" },
			}),
		]);
		const staking = new Staking({ baseUrl: API_BASE_URL });

		await expect(staking.getApy()).rejects.toMatchObject({
			kind: "http",
			status: 429,
			retryAfterMs: 3000,
		});
	});
});

describe("staking transaction commands and builders", () => {
	it("selects staking Move entry points and preserves builder options", async () => {
		const { api, coin, referralVault } = makeFakeApi();
		const stakingApi = new StakingApi(api);

		const lowLevelCases: Array<{
			name: string;
			expectedFunction: string;
			invoke: (tx: Transaction) => unknown;
		}> = [
			{
				name: "stake",
				expectedFunction: "request_stake_and_keep",
				invoke: (tx) =>
					stakingApi.stakeTx({
						tx,
						suiCoin: "0x301",
						validatorAddress: FULL_4,
						withTransfer: true,
					}),
			},
			{
				name: "unstake",
				expectedFunction: "request_unstake",
				invoke: (tx) => stakingApi.unstakeTx({ tx, afSuiCoin: "0x302" }),
			},
			{
				name: "atomic unstake",
				expectedFunction: "request_unstake_atomic_and_keep",
				invoke: (tx) =>
					stakingApi.atomicUnstakeTx({
						tx,
						afSuiCoin: "0x303",
						withTransfer: true,
					}),
			},
			{
				name: "restake staked SUI",
				expectedFunction: "request_stake_staked_sui_vec",
				invoke: (tx) =>
					stakingApi.requestStakeStakedSuiVecTx({
						tx,
						stakedSuiIds: ["0x304", "0x305"],
						validatorAddress: FULL_4,
					}),
			},
			{
				name: "epoch update",
				expectedFunction: "epoch_was_changed",
				invoke: (tx) => stakingApi.epochWasChangedTx({ tx }),
			},
			{
				name: "exchange rate",
				expectedFunction: "afsui_to_sui_exchange_rate",
				invoke: (tx) => stakingApi.afSuiToSuiExchangeRateTx({ tx }),
			},
			{
				name: "reverse exchange rate",
				expectedFunction: "sui_to_afsui_exchange_rate",
				invoke: (tx) => stakingApi.suiToAfSuiExchangeRateTx({ tx }),
			},
			{
				name: "total SUI amount",
				expectedFunction: "total_sui_amount",
				invoke: (tx) => stakingApi.totalSuiAmountTx({ tx }),
			},
			{
				name: "afSUI conversion",
				expectedFunction: "afsui_to_sui",
				invoke: (tx) => stakingApi.afSuiToSuiTx({ tx, afSuiAmount: 305n }),
			},
			{
				name: "conversion",
				expectedFunction: "sui_to_afsui",
				invoke: (tx) => stakingApi.suiToAfSuiTx({ tx, suiAmount: 306n }),
			},
			{
				name: "validator fee",
				expectedFunction: "update_validator_fee",
				invoke: (tx) =>
					stakingApi.updateValidatorFeeTx({
						tx,
						validatorOperationCapId: "0x307",
						newFee: 308n,
					}),
			},
		];

		for (const testCase of lowLevelCases) {
			const tx = new Transaction();
			testCase.invoke(tx);
			expect(moveCalls(tx)[moveCalls(tx).length - 1]?.function).toBe(
				testCase.expectedFunction
			);
		}

		const stakeTx = await stakingApi.fetchBuildStakeTx({
			walletAddress: FULL_1,
			suiStakeAmount: 1_000n,
			validatorAddress: FULL_4,
			referrer: FULL_3,
			externalFee: { recipient: FULL_2, feePercentage: 0.1 },
			isSponsoredTx: true,
		});
		expect(stakeTx.getData().sender).toBe(FULL_1);
		expect(moveCalls(stakeTx).map((call) => call.function)).toContain(
			"request_stake"
		);
		expect(referralVault.updateReferrerTx).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
			referrer: FULL_3,
		});
		expect(coin.fetchCoinWithAmountTx).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
			walletAddress: FULL_1,
			coinType: expect.any(String),
			coinAmount: 1_000n,
			isSponsoredTx: true,
		});

		const atomicUnstake = await stakingApi.fetchBuildUnstakeTx({
			walletAddress: FULL_1,
			afSuiUnstakeAmount: 1_000n,
			isAtomic: true,
		});
		expect(moveCalls(atomicUnstake).map((call) => call.function)).toContain(
			"request_unstake_atomic"
		);
		const queuedUnstake = await stakingApi.fetchBuildUnstakeTx({
			walletAddress: FULL_1,
			afSuiUnstakeAmount: 1_000n,
			isAtomic: false,
		});
		expect(moveCalls(queuedUnstake).map((call) => call.function)).toContain(
			"request_unstake"
		);
		const restake = await stakingApi.fetchBuildStakeStakedSuiTx({
			walletAddress: FULL_1,
			stakedSuiIds: ["0x309", "0x30a"],
			validatorAddress: FULL_4,
			referrer: FULL_3,
		});
		expect(moveCalls(restake).map((call) => call.function)).toContain(
			"request_stake_staked_sui_vec"
		);
		expect(referralVault.updateReferrerTx).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
			referrer: FULL_3,
		});

		const updateFee = await stakingApi.buildUpdateValidatorFeeTx({
			walletAddress: FULL_1,
			validatorOperationCapId: "0x308",
			newFeePercentage: 0.0375,
		});
		expect(updateFee.getData().sender).toBe(FULL_1);
		expect(
			moveCalls(updateFee)[moveCalls(updateFee).length - 1]?.function
		).toBe("update_validator_fee");
	});

	it("rejects invalid external fee percentages before touching the coin boundary", async () => {
		const { api, coin } = makeFakeApi();
		const stakingApi = new StakingApi(api);
		const base = {
			walletAddress: FULL_1,
			suiStakeAmount: 1_000n,
			validatorAddress: FULL_4,
		};

		await expect(
			stakingApi.fetchBuildStakeTx({
				...base,
				externalFee: { recipient: FULL_2, feePercentage: 0.5 },
			})
		).rejects.toThrow("external fee percentage exceeds max of 50%");
		await expect(
			stakingApi.fetchBuildStakeTx({
				...base,
				externalFee: { recipient: FULL_2, feePercentage: 0 },
			})
		).rejects.toThrow("external fee percentage must be greater than 0");
		expect(coin.fetchCoinWithAmountTx).not.toHaveBeenCalled();
	});
});
