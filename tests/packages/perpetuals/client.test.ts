import {
	ACCOUNT_CAP_ID,
	BASE_URL,
	EMPTY_TRANSACTION_KIND,
	expectTransactionResponse,
	expectTxCall,
	installJsonFetch,
	MARKET_ID,
	makeApi,
	makeDirectCap,
	makeVaultObject,
	Perpetuals,
	PerpetualsAccount,
	PerpetualsMarket,
	type PerpetualsMarketMetadata,
	PerpetualsVault,
	RECIPIENT,
	requestBody,
	transactionResponse,
	USDC,
	VAULT_ID,
	WALLET,
} from "@test/packages/perpetuals/fixturesDomain.js";

describe("Perpetuals root client", () => {
	it("wraps markets, vaults, and accounts while short-circuiting empty queries", async () => {
		const perps = new Perpetuals({ baseUrl: BASE_URL });
		const marketWire = {
			packageId: "0xpackage",
			objectId: MARKET_ID,
			collateralCoinType: USDC,
			marketParams: {
				marginRatioInitial: 0.05,
				marginRatioMaintenance: 0.025,
				baseAssetSymbol: "BTC",
				lotSize: "10000000n",
				tickSize: "500000000n",
			},
			marketState: {
				cumFundingRateLong: 0,
				cumFundingRateShort: 0,
			},
			collateralPrice: 2,
			indexPrice: 2000,
			estimatedFundingRate: 0,
			nextFundingTimestampMs: "1800000000000n",
		};
		const metadata: PerpetualsMarketMetadata = {
			symbol: "BTC",
			displayName: "Bitcoin",
			category: "Crypto",
			image: "/btc.png",
			collateralSymbol: "USDC",
		};
		let calls = installJsonFetch({
			marketDatas: [{ market: marketWire, metadata }],
		});
		const markets = await perps.getMarkets({ marketIds: [MARKET_ID] });
		expect(markets.markets[0]).toBeInstanceOf(PerpetualsMarket);
		expect(markets.markets[0]?.metadata).toEqual(metadata);
		expect(markets.markets[0]?.marketData.nextFundingTimestampMs).toBe(
			1_800_000_000_000n
		);
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({ markets: [marketWire] });
		const allMarkets = await perps.getAllMarkets({ collateralCoinType: USDC });
		expect(allMarkets.markets).toHaveLength(1);
		expect(allMarkets.markets[0]?.marketId).toBe(MARKET_ID);
		expect(requestBody(calls)).toEqual({ collateralCoinType: USDC });

		const vaultWire = {
			...makeVaultObject(),
			version: "18446744073709551615n",
			lpSupply: "10000000n",
			idleCollateral: "2000000n",
			marketIds: [MARKET_ID],
			accountId: "9007199254740993n",
			pausedUntilTimestamp: null,
			ownerLockedLpBalance: "100000n",
			parameters: {
				...makeVaultObject().parameters,
				lockPeriodMs: "86400000n",
				forceWithdrawDelayMs: "172800000n",
				collateralPriceFeedStorageTolerance: "1000n",
				maxMarketsInVault: "4n",
				maxPendingOrdersPerPosition: "20n",
				maxTotalDepositedCollateral: "100000000n",
			},
		};
		calls = installJsonFetch({ vaults: [vaultWire] });
		const vaults = await perps.getVaults({ vaultIds: [VAULT_ID] });
		expect(vaults.vaults[0]).toBeInstanceOf(PerpetualsVault);
		expect(vaults.vaults[0]?.vaultObject.accountId).toBe(
			9_007_199_254_740_993n
		);
		expect(requestBody(calls)).toEqual({ vaultIds: [VAULT_ID] });

		const directCap = makeDirectCap();
		const accountWire = {
			accountId: "9007199254740993n",
			totalEquityUsd: 1000,
			availableCollateral: 700,
			availableCollateralUsd: 1400,
			totalUnrealizedFundingsUsd: 0,
			totalUnrealizedPnlUsd: 0,
			positions: [],
		};
		calls = installJsonFetch({ accounts: [accountWire] });
		const accounts = await perps.getAccounts({ accountCaps: [directCap] });
		expect(accounts.accounts[0]).toBeInstanceOf(PerpetualsAccount);
		expect(accounts.accounts[0]?.accountId()).toBe(9_007_199_254_740_993n);
		expect(requestBody(calls)).toEqual({
			accountIds: ["9007199254740993n"],
		});

		const noFetch = installJsonFetch({ unexpected: true });
		await expect(perps.getAccounts({ accountCaps: [] })).resolves.toEqual({
			accounts: [],
		});
		await expect(perps.getAccountObjects({ accountIds: [] })).resolves.toEqual({
			accounts: [],
		});
		await expect(perps.getPrices({ marketIds: [] })).resolves.toEqual({
			marketsPrices: [],
		});
		await expect(perps.getLpCoinPrices({ vaultIds: [] })).resolves.toEqual({
			lpCoinPrices: [],
		});
		expect(noFetch).toHaveLength(0);
	});

	it("builds root account, cap, share, and vault transactions", async () => {
		const { api } = makeApi();
		const perps = new Perpetuals({ baseUrl: BASE_URL }, api);

		await expectTxCall(
			() =>
				perps.getTransferCapTx({
					recipientAddress: RECIPIENT,
					capObjectId: ACCOUNT_CAP_ID,
				}),
			"transactions/transfer-cap",
			{ recipientAddress: RECIPIENT, capObjectId: ACCOUNT_CAP_ID }
		);

		const deferred = {
			accountArg: { kind: "Input", index: 0 },
			sharePolicyArg: { kind: "Input", index: 1 },
			adminCapArg: { kind: "Input", index: 2 },
			collateralCoinType: USDC,
		};
		let calls = installJsonFetch(transactionResponse({ deferred }));
		const createAccount = await perps.getCreateAccountTx({
			walletAddress: WALLET,
			collateralCoinType: USDC,
			deferShare: true,
		});
		expectTransactionResponse(createAccount);
		expect((createAccount as { deferred: unknown }).deferred).toEqual(deferred);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/transactions/create-account`
		);
		expect(requestBody(calls)).toEqual({
			walletAddress: WALLET,
			collateralCoinType: USDC,
			deferShare: true,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		await expectTxCall(
			() =>
				perps.getGrantAgentWalletTx({
					recipientAddress: RECIPIENT,
					accountId: 9_007_199_254_740_993n,
				}),
			"account/transactions/grant-agent-wallet",
			{ recipientAddress: RECIPIENT, accountId: "9007199254740993n" }
		);
		await expectTxCall(
			() =>
				perps.getShareAccountTx({
					accountArg: { kind: "Input", index: 0 } as never,
					sharePolicyArg: { kind: "Input", index: 1 } as never,
					adminCapArg: { kind: "Input", index: 2 } as never,
					collateralCoinType: USDC,
				}),
			"account/transactions/share",
			{
				accountArg: { kind: "Input", index: 0 },
				sharePolicyArg: { kind: "Input", index: 1 },
				adminCapArg: { kind: "Input", index: 2 },
				collateralCoinType: USDC,
			}
		);

		calls = installJsonFetch(transactionResponse());
		const cap = await perps.getCreateVaultCapTx({
			walletAddress: WALLET,
			lpCoinMetadata: {
				name: "BTC Alpha",
				symbol: "BTC_ALPHA",
				description: "Vault LP",
			},
		});
		expectTransactionResponse(cap);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vault/transactions/create-vault-cap`
		);
		expect(requestBody(calls)).toEqual({
			walletAddress: WALLET,
			lpCoinMetadata: {
				name: "BTC Alpha",
				symbol: "BTC_ALPHA",
				description: "Vault LP",
			},
		});

		await expectTxCall(
			() =>
				perps.getCreateVaultTx({
					walletAddress: WALLET,
					metadata: { name: "BTC Alpha", description: "Vault LP" },
					coinMetadataId: "0xcoin-metadata",
					treasuryCapId: "0xtreasury-cap",
					collateralCoinType: USDC,
					lockPeriodMs: 86_400_000n,
					performanceFeePercentage: 0.2,
					forceWithdrawDelayMs: 172_800_000n,
					initialDepositAmount: 1_000_000n,
				}),
			"vault/transactions/create-vault",
			{
				walletAddress: WALLET,
				metadata: { name: "BTC Alpha", description: "Vault LP" },
				coinMetadataId: "0xcoin-metadata",
				treasuryCapId: "0xtreasury-cap",
				collateralCoinType: USDC,
				lockPeriodMs: "86400000n",
				performanceFeePercentage: 0.2,
				forceWithdrawDelayMs: "172800000n",
				initialDepositAmount: "1000000n",
			}
		);
	});
});
