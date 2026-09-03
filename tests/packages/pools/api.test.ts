import {
	A,
	AMM,
	AMM_INTERFACE,
	asTransaction,
	B,
	type CoinType,
	DAO_AMM,
	type DaoFeePoolOwnerCapObject,
	describe,
	EVENTS,
	EVENTS_V2,
	expect,
	type FakeTx,
	fakeTransaction,
	installFetch,
	installNetworkFailure,
	it,
	LP,
	makeAddresses,
	makePool,
	makeProvider,
	POOL_ID,
	Pool,
	Pools,
	PoolsApi,
	requestBody,
	requestUrl,
	statsFixture,
	WALLET,
} from "@test/packages/pools/fixtures.js";

describe("Pools HTTP/API boundary", () => {
	const config = { baseUrl: "https://sdk.test/", accessToken: "token" };

	it("fetches one, many, and all pools with exact request contracts", async () => {
		const pool = makePool();
		const signal = new AbortController().signal;

		let calls = installFetch(pool);
		const one = await new Pools(config).getPool({ objectId: POOL_ID }, signal);
		expect(one.pool).toEqual(pool);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools/0x5");
		expect(calls[0]?.init?.method).toBeUndefined();
		expect(calls[0]?.init?.signal).toBe(signal);
		expect(calls[0]?.init?.headers).toEqual({
			"Content-Type": "application/json",
			Authorization: "Bearer token",
		});

		calls = installFetch([pool]);
		const many = await new Pools(config).getPools(
			{ objectIds: [POOL_ID, "0x8"] },
			signal
		);
		expect(many.map((item) => item.pool.objectId)).toEqual([POOL_ID]);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools");
		expect(calls[0]?.init?.method).toBe("POST");
		expect(requestBody(calls[0]!)).toEqual({
			poolIds: [POOL_ID, "0x8"],
			limit: 32,
		});
		expect(calls[0]?.init?.signal).toBe(signal);

		calls = installFetch([pool]);
		const all = await new Pools(config).getAllPools(signal);
		expect(all).toHaveLength(1);
		expect(requestBody(calls[0]!)).toEqual({ cursor: 0, limit: 256 });
	});

	it("covers pool list, metadata, TVL, stats, and summary endpoints", async () => {
		const pools = new Pools({ baseUrl: "https://sdk.test" });
		const pool = makePool();
		const lpInfo = { lpCoinType: LP, poolId: POOL_ID, balance: 123n };

		let calls = installFetch([lpInfo]);
		expect(await pools.getOwnedLpCoins({ walletAddress: WALLET })).toEqual([
			lpInfo,
		]);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/owned-lp-coins"
		);
		expect(requestBody(calls[0]!)).toEqual({
			walletAddress: WALLET,
			cursor: 0,
			limit: 32,
		});

		calls = installFetch([POOL_ID, undefined]);
		await expect(
			pools.getPoolObjectIdsForLpCoinTypes({ lpCoinTypes: [LP, "0x9::x::X"] })
		).resolves.toEqual([POOL_ID, undefined]);
		expect(requestBody(calls[0]!)).toEqual({
			lpCoinTypes: [LP, "0x9::x::X"],
			limit: 32,
		});

		calls = installFetch([POOL_ID]);
		await expect(
			pools.getPoolObjectIdForLpCoinType({ lpCoinType: LP })
		).resolves.toEqual([POOL_ID]);
		expect(requestBody(calls[0]!)).toEqual({
			lpCoinTypes: [LP],
			limit: 32,
		});

		calls = installFetch([undefined]);
		await expect(pools.isLpCoinType({ lpCoinType: LP })).resolves.toBe(false);

		calls = installFetch(123.45);
		await expect(pools.getTotalVolume24hrs()).resolves.toBe(123.45);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/volume-24hrs"
		);
		expect(calls[0]?.init?.signal).toBeUndefined();

		calls = installFetch(99.5);
		await expect(pools.getTVL()).resolves.toBe(99.5);
		expect(requestBody(calls[0]!)).toEqual({});
		calls = installFetch(99.5);
		await pools.getTVL({ poolIds: [POOL_ID] });
		expect(requestBody(calls[0]!)).toEqual({ poolIds: [POOL_ID] });

		calls = installFetch([statsFixture]);
		await expect(
			pools.getPoolsStats({ poolIds: [POOL_ID] }, new AbortController().signal)
		).resolves.toEqual([statsFixture]);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools/stats");
		expect(requestBody(calls[0]!)).toEqual({ poolIds: [POOL_ID], limit: 32 });

		calls = installFetch([{ pool, stats: statsFixture }]);
		await expect(pools.getPoolSummaries()).resolves.toEqual([
			{ pool, stats: statsFixture },
		]);
		expect(requestBody(calls[0]!)).toEqual({ cursor: 0, limit: 256 });
	});

	it("preserves bigint request serialization and indexer pagination", async () => {
		const pools = new Pools({ baseUrl: "https://sdk.test" });
		const signal = new AbortController().signal;
		const events = [
			{ poolId: POOL_ID, depositor: WALLET, deposits: [9n] },
			{ poolId: POOL_ID, withdrawer: WALLET, withdrawn: [4n] },
		];
		const calls = installFetch(events);
		await expect(
			pools.getInteractionEvents({ walletAddress: WALLET, cursor: 5, limit: 2 })
		).resolves.toEqual({ events, nextCursor: 7 });
		expect(requestBody(calls[0]!)).toEqual({
			walletAddress: WALLET,
			cursor: 5,
			limit: 2,
		});

		const shortCalls = installFetch([events[0]]);
		await expect(
			pools.getInteractionEvents({ walletAddress: WALLET, cursor: 5, limit: 2 })
		).resolves.toEqual({ events: [events[0]], nextCursor: undefined });
		expect(shortCalls[0]?.init?.signal).toBeUndefined();

		const bodyCalls = installFetch([]);
		await pools.getPoolsStats({ poolIds: [POOL_ID] }, signal);
		const rawBody = bodyCalls[0]?.init?.body;
		expect(typeof rawBody).toBe("string");
		expect(String(rawBody)).not.toContain("signal");
	});

	it("classifies HTTP, decode, network, and missing-base-url failures", async () => {
		installFetch({ message: "nope" }, 503, "service unavailable");
		await expect(
			new Pools({ baseUrl: "https://sdk.test" }).getTotalVolume24hrs()
		).rejects.toMatchObject({ kind: "http", status: 503 });

		installFetch({}, 200, "not-json");
		await expect(
			new Pools({ baseUrl: "https://sdk.test" }).getTotalVolume24hrs()
		).rejects.toMatchObject({ kind: "decode" });

		installNetworkFailure();
		await expect(
			new Pools({ baseUrl: "https://sdk.test" }).getTotalVolume24hrs()
		).rejects.toMatchObject({ kind: "network" });

		await expect(new Pools().getTotalVolume24hrs()).rejects.toThrow(
			"no apiBaseUrl: unable to fetch data"
		);
	});
});

describe("PoolsApi transaction commands and provider boundary", () => {
	it("constructs regular move calls with type arguments, objects, and fixed values", () => {
		const api = new PoolsApi(makeProvider(makeAddresses()));
		const tx = fakeTransaction();

		api.tradeTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinInId: "0x20",
			coinInType: A,
			expectedCoinOutAmount: 321n,
			coinOutType: B,
			lpCoinType: LP,
			slippage: 0.01,
			withTransfer: true,
		});
		api.multiCoinDepositTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinIds: ["0x21", "0x22"],
			coinTypes: [A, B],
			expectedLpRatio: 123n,
			lpCoinType: LP,
			slippage: 0.02,
		});
		api.multiCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x23",
			lpCoinType: LP,
			expectedAmountsOut: [7n, 8n],
			coinTypes: [A, B],
			slippage: 0.03,
		});
		api.allCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x24",
			lpCoinType: LP,
			coinTypes: [A, B],
			withTransfer: true,
		});

		expect(tx.moveCalls.map((call) => call.target)).toEqual([
			`${AMM_INTERFACE}::amm_interface::swap_exact_in`,
			`${AMM}::deposit::deposit_2_coins`,
			`${AMM}::withdraw::withdraw_2_coins`,
			`${AMM_INTERFACE}::amm_interface::all_coin_withdraw_2_coins`,
		]);
		expect(tx.moveCalls[0]?.typeArguments).toEqual([LP, A, B]);
		expect(tx.pures).toContainEqual({
			kind: "pure",
			value: { type: "u64", value: 990_000_000_000_000_000n },
		});
		expect(tx.moveCalls[2]?.arguments).toHaveLength(9);
	});

	it("constructs publishing, pool creation, registry, and DAO-fee commands", () => {
		const addresses = makeAddresses();
		const api = new PoolsApi(makeProvider(addresses));
		const publishTx = fakeTransaction();
		const upgradeCap = api.publishLpCoinTx({
			tx: asTransaction(publishTx),
			lpCoinDecimals: 9,
		});
		expect(upgradeCap).toEqual({ kind: "upgrade-cap" });
		expect(publishTx.publishes).toEqual([
			{ modules: [[0]], dependencies: [`0x${"0".repeat(63)}2`] },
		]);
		const addressesWithoutCompilations = makeAddresses();
		delete addressesWithoutCompilations.pools?.other;
		const apiWithoutCompilations = new PoolsApi(
			makeProvider(addressesWithoutCompilations)
		);
		expect(() =>
			apiWithoutCompilations.publishLpCoinTx({
				tx: asTransaction(fakeTransaction()),
				lpCoinDecimals: 8,
			})
		).toThrow("requires package compilations");

		const createTx = fakeTransaction();
		api.createPoolTx({
			tx: asTransaction(createTx),
			lpCoinType: LP,
			coinsInfo: [
				{
					coinId: "0x30",
					coinType: A,
					weight: 500_000_000_000_000_000n,
					decimals: 9,
					tradeFeeIn: 1n,
					tradeFeeOut: 2n,
					depositFee: 3n,
					withdrawFee: 4n,
				},
			],
			lpCoinMetadata: { name: "Pool LP", symbol: "plp" },
			lpCoinIconUrl: "https://sdk.test/icon.svg",
			createPoolCapId: "0x31",
			poolName: "My Pool",
			poolFlatness: 0n,
			lpCoinDescription: "description",
			respectDecimals: true,
			forceLpDecimals: 9,
		});
		expect(createTx.moveCalls[0]).toMatchObject({
			target: `${AMM}::pool_factory::create_pool_1_coins`,
			typeArguments: [LP, A],
		});
		expect(createTx.moveCalls[0]?.arguments).toHaveLength(17);

		const registryTx = fakeTransaction();
		api.poolObjectIdForLpCoinTypeTx({
			tx: asTransaction(registryTx),
			lpCoinType: LP,
		});
		expect(registryTx.moveCalls[0]).toMatchObject({
			target: `${AMM}::pool_registry::lp_type_to_pool_id`,
			typeArguments: [LP],
		});

		const daoTx = fakeTransaction();
		api.daoFeePoolNewTx({
			tx: asTransaction(daoTx),
			poolId: POOL_ID,
			feeBps: 100n,
			feeRecipient: WALLET,
			lpCoinType: LP,
		});
		api.daoFeePoolUpdateFeeBpsTx({
			tx: asTransaction(daoTx),
			daoFeePoolOwnerCapId: "0x32",
			daoFeePoolId: "0x33",
			newFeeBps: 250n,
			lpCoinType: LP,
		});
		api.daoFeePoolUpdateFeeRecipientTx({
			tx: asTransaction(daoTx),
			daoFeePoolOwnerCapId: "0x32",
			daoFeePoolId: "0x33",
			newFeeRecipient: WALLET,
			lpCoinType: LP,
		});
		expect(daoTx.moveCalls.map((call) => call.target)).toEqual([
			`${DAO_AMM}::pool::new`,
			`${DAO_AMM}::pool::update_fee_bps`,
			`${DAO_AMM}::pool::update_fee_recipient`,
		]);

		const noDaoApi = new PoolsApi(makeProvider(makeAddresses(false)));
		expect(() =>
			noDaoApi.daoFeePoolNewTx({
				tx: asTransaction(fakeTransaction()),
				poolId: POOL_ID,
				feeBps: 1n,
				feeRecipient: WALLET,
				lpCoinType: LP,
			})
		).toThrow("dao fee pool addresses have not been set");
	});

	it("covers transfer target branches and DAO-fee pool command variants", () => {
		const api = new PoolsApi(makeProvider(makeAddresses()));
		const tx = fakeTransaction();

		api.tradeTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinInId: "0x50",
			coinInType: A,
			expectedCoinOutAmount: 10n,
			coinOutType: B,
			lpCoinType: LP,
			slippage: 0.01,
		});
		api.multiCoinDepositTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinIds: ["0x51", "0x52"],
			coinTypes: [A, B],
			expectedLpRatio: 11n,
			lpCoinType: LP,
			slippage: 0.01,
			withTransfer: true,
		});
		api.multiCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x53",
			lpCoinType: LP,
			expectedAmountsOut: [12n, 13n],
			coinTypes: [A, B],
			slippage: 0.01,
			withTransfer: true,
		});
		api.allCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x54",
			lpCoinType: LP,
			coinTypes: [A, B],
		});

		api.daoFeePoolTradeTx({
			tx: asTransaction(tx),
			daoFeePoolId: "0x55",
			coinInId: "0x56",
			coinInType: A,
			expectedCoinOutAmount: 14n,
			coinOutType: B,
			lpCoinType: LP,
			slippage: 0.01,
		});
		api.daoFeePoolMultiCoinDepositTx({
			tx: asTransaction(tx),
			daoFeePoolId: "0x57",
			coinIds: ["0x58", "0x59"],
			coinTypes: [A, B],
			expectedLpRatio: 15n,
			lpCoinType: LP,
			slippage: 0.01,
		});
		api.daoFeePoolAllCoinWithdrawTx({
			tx: asTransaction(tx),
			daoFeePoolId: "0x5a",
			lpCoinId: "0x5b",
			lpCoinType: LP,
			coinTypes: [A, B],
		});

		expect(tx.moveCalls.map((call) => call.target)).toEqual([
			`${AMM}::swap::swap_exact_in`,
			`${AMM_INTERFACE}::amm_interface::deposit_2_coins`,
			`${AMM_INTERFACE}::amm_interface::withdraw_2_coins`,
			`${AMM}::withdraw::all_coin_withdraw_2_coins`,
			`${DAO_AMM}::swap::swap_exact_in`,
			`${DAO_AMM}::deposit::deposit_2_coins`,
			`${DAO_AMM}::withdraw::all_coin_withdraw_2_coins`,
		]);
		expect(tx.moveCalls[4]?.arguments).toHaveLength(10);
		expect(tx.moveCalls[5]?.arguments).toHaveLength(11);
		expect(tx.moveCalls[6]?.arguments).toHaveLength(8);

		const noDaoApi = new PoolsApi(makeProvider(makeAddresses(false)));
		expect(() =>
			noDaoApi.daoFeePoolTradeTx({
				tx: asTransaction(fakeTransaction()),
				daoFeePoolId: POOL_ID,
				coinInId: "0x5c",
				coinInType: A,
				expectedCoinOutAmount: 1n,
				coinOutType: B,
				lpCoinType: LP,
				slippage: 0.01,
			})
		).toThrow("dao fee pool addresses have not been set");
		expect(() =>
			noDaoApi.daoFeePoolMultiCoinDepositTx({
				tx: asTransaction(fakeTransaction()),
				daoFeePoolId: POOL_ID,
				coinIds: ["0x5d", "0x5e"],
				coinTypes: [A, B],
				expectedLpRatio: 1n,
				lpCoinType: LP,
				slippage: 0.01,
			})
		).toThrow("dao fee pool addresses have not been set");
		expect(() =>
			noDaoApi.daoFeePoolAllCoinWithdrawTx({
				tx: asTransaction(fakeTransaction()),
				daoFeePoolId: POOL_ID,
				lpCoinId: "0x5f",
				lpCoinType: LP,
				coinTypes: [A, B],
			})
		).toThrow("dao fee pool addresses have not been set");
	});

	it("exposes normalized object/event types, Move errors, and owned-cap casting", async () => {
		const addresses = makeAddresses();
		const ownedCalls: Record<string, unknown>[] = [];
		const cap: DaoFeePoolOwnerCapObject = {
			objectId: "0x40",
			objectType: `${EVENTS}::pool::OwnerCap`,
			daoFeePoolId: "0x41",
		};
		const api = new PoolsApi(
			makeProvider(addresses, {
				Objects: () => ({
					fetchCastObjectsOwnedByAddressOfType: (
						input: Record<string, unknown>
					) => {
						ownedCalls.push(input);
						return Promise.resolve([cap]);
					},
				}),
			})
		);
		await expect(
			api.fetchOwnedDaoFeePoolOwnerCaps({ walletAddress: WALLET })
		).resolves.toEqual([cap]);
		expect(ownedCalls[0]).toMatchObject({
			walletAddress: WALLET,
			objectType: `${EVENTS}::pool::OwnerCap`,
		});
		expect(api.objectTypes.pool).toBe(`${EVENTS}::pool::Pool`);
		expect(api.eventTypes.trade).toBe(`${EVENTS}::events::SwapEvent`);
		expect(api.eventTypes.tradeV2).toBe(`${EVENTS_V2}::events::SwapEventV2`);
		expect(api.moveErrors[AMM]?.pool?.[3]).toBe("Invalid Weight");
		expect(api.moveErrors[DAO_AMM]?.version?.[1]).toBe(
			"Version Object Already Created"
		);

		const noDaoApi = new PoolsApi(
			makeProvider(makeAddresses(false), { Objects: () => ({}) })
		);
		expect(() =>
			noDaoApi.fetchOwnedDaoFeePoolOwnerCaps({ walletAddress: WALLET })
		).toThrow("dao fee pool addresses have not been set");
	});

	it("builds high-level transactions through mocked Coin and referral providers", async () => {
		const referralCalls: unknown[] = [];
		let coinSequence = 0;
		const api = new PoolsApi(
			makeProvider(makeAddresses(), {
				ReferralVault: () => ({
					updateReferrerTx: (input: unknown) => referralCalls.push(input),
				}),
				Coin: () => ({
					fetchCoinWithAmountTx: async () => ({
						kind: "coin",
						id: `coin-${++coinSequence}`,
					}),
					fetchCoinsWithAmountTx: async (input: { coinTypes: CoinType[] }) =>
						input.coinTypes.map((coinType) => ({
							kind: "coin",
							coinType,
							id: `coin-${++coinSequence}`,
						})),
				}),
			})
		);
		const regularPool = new Pool(makePool());
		const daoPool = new Pool(makePool({ daoFee: true }));

		const builtTrade = (await api.fetchBuildTradeTx({
			walletAddress: WALLET,
			pool: regularPool,
			coinInType: A,
			coinInAmount: 100n,
			coinOutType: B,
			slippage: 0.01,
			referrer: "0x8",
			isSponsoredTx: true,
		})) as unknown as FakeTx;
		expect(builtTrade.sender).toBe(WALLET);
		expect(builtTrade.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::swap_exact_in`
		);
		expect(builtTrade.transfers).toHaveLength(0);
		expect(referralCalls).toHaveLength(1);

		const builtDaoTrade = (await api.fetchBuildTradeTx({
			walletAddress: WALLET,
			pool: daoPool,
			coinInType: A,
			coinInAmount: 100n,
			coinOutType: B,
			slippage: 0.01,
		})) as unknown as FakeTx;
		expect(builtDaoTrade.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::swap::swap_exact_in`
		);
		expect(builtDaoTrade.transfers).toHaveLength(1);

		const addTradeTx = fakeTransaction();
		api.fetchAddTradeTx({
			tx: asTransaction(addTradeTx),
			coinInId: "0x60",
			coinInType: A,
			coinInAmount: 100n,
			coinOutType: B,
			slippage: 0.01,
			pool: regularPool,
		});
		expect(addTradeTx.moveCalls[0]?.target).toBe(`${AMM}::swap::swap_exact_in`);

		const builtDeposit = (await api.fetchBuildDepositTx({
			walletAddress: WALLET,
			pool: regularPool,
			amountsIn: { [A]: 100n, [B]: 100n },
			slippage: 0.01,
			referrer: "0x8",
			isSponsoredTx: true,
		})) as unknown as FakeTx;
		expect(builtDeposit.sender).toBe(WALLET);
		expect(builtDeposit.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::deposit_2_coins`
		);

		const builtDaoDeposit = (await api.fetchBuildDepositTx({
			walletAddress: WALLET,
			pool: daoPool,
			amountsIn: { [A]: 100n, [B]: 100n },
			slippage: 0.01,
		})) as unknown as FakeTx;
		expect(builtDaoDeposit.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::deposit::deposit_2_coins`
		);

		const builtWithdraw = (await api.fetchBuildWithdrawTx({
			walletAddress: WALLET,
			pool: regularPool,
			amountsOutDirection: { [A]: 100n, [B]: 100n },
			lpCoinAmount: 100n,
			slippage: 0.01,
			referrer: "0x8",
		})) as unknown as FakeTx;
		expect(builtWithdraw.sender).toBe(WALLET);
		expect(builtWithdraw.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::withdraw_2_coins`
		);

		const builtDaoWithdraw = (await api.fetchBuildWithdrawTx({
			walletAddress: WALLET,
			pool: daoPool,
			amountsOutDirection: { [A]: 100n, [B]: 100n },
			lpCoinAmount: 100n,
			slippage: 0.01,
		})) as unknown as FakeTx;
		expect(builtDaoWithdraw.sender).toBe(WALLET);
		expect(builtDaoWithdraw.moveCalls).toHaveLength(0);

		const builtAllWithdraw = (await api.fetchBuildAllCoinWithdrawTx({
			walletAddress: WALLET,
			pool: regularPool,
			lpCoinAmount: 100n,
			referrer: "0x8",
		})) as unknown as FakeTx;
		expect(builtAllWithdraw.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::all_coin_withdraw_2_coins`
		);

		const published = api.buildPublishLpCoinTx({
			walletAddress: WALLET,
			lpCoinDecimals: 9,
		}) as unknown as FakeTx;
		expect(published.sender).toBe(WALLET);
		expect(published.publishes).toHaveLength(1);
		expect(published.transfers).toHaveLength(1);

		const feeBps = api.buildDaoFeePoolUpdateFeeBpsTx({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x61",
			daoFeePoolId: "0x62",
			newFeeBps: 99n,
			lpCoinType: LP,
		}) as unknown as FakeTx;
		const feeRecipient = api.buildDaoFeePoolUpdateFeeRecipientTx({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x63",
			daoFeePoolId: "0x64",
			newFeeRecipient: "0x65",
			lpCoinType: LP,
		}) as unknown as FakeTx;
		expect(feeBps.sender).toBe(WALLET);
		expect(feeRecipient.sender).toBe(WALLET);
		expect(feeBps.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::pool::update_fee_bps`
		);
		expect(feeRecipient.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::pool::update_fee_recipient`
		);
	});
});
