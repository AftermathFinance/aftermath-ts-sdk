import {
	ACCOUNT_ID,
	ACCOUNT_ID_WIRE,
	API_BASE_URL,
	COLLATERAL,
	clientForTest,
	describe,
	expect,
	expectPost,
	type FetchCall,
	FULL_ADDRESS,
	FULL_ID,
	installFetch,
	it,
	PerpetualsClient,
	requestBody,
	SHORT_ID,
} from "@test/packages/perpetuals/fixturesApi.js";

describe("Perpetuals HTTP fetch wrappers", () => {
	it("posts all-markets and wraps bigint market data", async () => {
		const result = (await expectPost(
			(client) => client.getAllMarkets({ collateralCoinType: COLLATERAL }),
			{
				markets: [
					{
						objectId: SHORT_ID,
						nextFundingTimestampMs: "18446744073709551615n",
					},
				],
			},
			"all-markets",
			{ collateralCoinType: COLLATERAL }
		)) as { markets: Array<{ marketData: Record<string, unknown> }> };

		expect(result.markets[0]?.marketData).toEqual({
			objectId: SHORT_ID,
			nextFundingTimestampMs: 18446744073709551615n,
		});
	});

	it("posts markets and preserves optional market metadata", async () => {
		const result = (await expectPost(
			(client) => client.getMarkets({ marketIds: [SHORT_ID, FULL_ID] }),
			{
				marketDatas: [
					{
						market: { objectId: SHORT_ID },
						metadata: null,
					},
				],
			},
			"markets",
			{ marketIds: [SHORT_ID, FULL_ID] }
		)) as { markets: Array<{ marketData: unknown; metadata: unknown }> };

		expect(result.markets[0]?.marketData).toEqual({ objectId: SHORT_ID });
		expect(
			result.markets[0]?.metadata === null ||
				result.markets[0]?.metadata === undefined
		).toBe(true);
	});

	it("uses the markets endpoint for the single-market convenience wrapper", async () => {
		const result = (await expectPost(
			(client) => client.getMarket({ marketId: SHORT_ID }),
			{ marketDatas: [{ market: { objectId: SHORT_ID } }] },
			"markets",
			{ marketIds: [SHORT_ID] }
		)) as { market: { marketData: { objectId: string } } };

		expect(result.market.marketData.objectId).toBe(SHORT_ID);
	});

	it("fetches vault config with an empty POST body and casts bigint limits", async () => {
		const result = await expectPost(
			(client) => client.getVaultsConfig(),
			{
				id: SHORT_ID,
				version: "18446744073709551615n",
				collateralPriceFeedStorageToleranceMs: "30000n",
				maxLockPeriodMs: "5184000000n",
				maxForceWithdrawDelayMs: "86400000n",
				maxPerformanceFeePercentage: 0.2,
				minOwnerLockUsd: 1,
				maxOwnerLockUsd: 1_000_000,
				minDepositUsd: 1,
				maxMarketsInVault: "12n",
				maxPendingOrdersPerPosition: "70n",
				forceWithdrawPauseMs: "300000n",
				maxAssistantsPerVault: "10n",
			},
			"vaults/config",
			{}
		);

		expect(result).toMatchObject({
			version: 18446744073709551615n,
			maxMarketsInVault: 12n,
			maxAssistantsPerVault: 10n,
		});
	});

	it("routes all-vault and selected-vault requests", async () => {
		const all = (await expectPost(
			(client) => client.getAllVaults(),
			{ vaults: [{ objectId: SHORT_ID, version: "9n" }] },
			"vaults",
			{}
		)) as { vaults: Array<{ vaultObject: Record<string, unknown> }> };
		expect(all.vaults[0]?.vaultObject.version).toBe(9n);

		const selected = (await expectPost(
			(client) => client.getVaults({ vaultIds: [SHORT_ID, FULL_ID] }),
			{ vaults: [{ objectId: SHORT_ID }] },
			"vaults",
			{ vaultIds: [SHORT_ID, FULL_ID] }
		)) as { vaults: Array<{ vaultObject: unknown }> };
		expect(selected.vaults[0]?.vaultObject).toEqual({ objectId: SHORT_ID });

		const single = (await expectPost(
			(client) => client.getVault({ vaultId: SHORT_ID }),
			{ vaults: [{ objectId: SHORT_ID }] },
			"vaults",
			{ vaultIds: [SHORT_ID] }
		)) as { vault: { vaultObject: { objectId: string } } };
		expect(single.vault.vaultObject.objectId).toBe(SHORT_ID);
	});

	it("serializes account position filters and bigint account IDs", async () => {
		const result = await expectPost(
			(client) =>
				client.getAccountObjects({
					accountIds: [ACCOUNT_ID],
					marketIds: [SHORT_ID],
				}),
			{ accounts: [{ accountId: ACCOUNT_ID_WIRE, positions: [] }] },
			"accounts/positions",
			{
				accountIds: [ACCOUNT_ID_WIRE],
				marketIds: [SHORT_ID],
			}
		);

		expect(result).toEqual({
			accounts: [{ accountId: ACCOUNT_ID, positions: [] }],
		});
	});

	it("pairs fetched accounts with their caps and supports the empty fast path", async () => {
		const cap = {
			objectId: SHORT_ID,
			walletAddress: FULL_ADDRESS,
			accountId: ACCOUNT_ID,
			accountObjectId: FULL_ID,
			collateralCoinType: COLLATERAL,
			collateral: 10,
			objectVersion: 1,
			objectDigest: "digest",
			isAgent: false,
			accountObjectInitialSharedVersion: 1,
			whitelistedAgentCapIds: [],
		};
		const result = (await expectPost(
			(client) => client.getAccounts({ accountCaps: [cap] }),
			{ accounts: [{ accountId: ACCOUNT_ID_WIRE, positions: [] }] },
			"accounts/positions",
			{ accountIds: [ACCOUNT_ID_WIRE], marketIds: undefined }
		)) as {
			accounts: Array<{
				account: Record<string, unknown>;
				accountCap: unknown;
			}>;
		};

		expect(result.accounts[0]?.account).toEqual({
			accountId: ACCOUNT_ID,
			positions: [],
		});
		expect(result.accounts[0]?.accountCap).toEqual(cap);

		const calls = installFetch({ error: "must not call" });
		await expect(
			clientForTest().getAccounts({ accountCaps: [] })
		).resolves.toEqual({
			accounts: [],
		});
		expect(calls).toHaveLength(0);
	});

	it("uses the account-position endpoint for the single-account convenience wrapper", async () => {
		const cap = { accountId: ACCOUNT_ID } as never;
		const result = (await expectPost(
			(client) => client.getAccount({ accountCap: cap }),
			{ accounts: [{ accountId: ACCOUNT_ID_WIRE, positions: [] }] },
			"accounts/positions",
			{ accountIds: [ACCOUNT_ID_WIRE], marketIds: undefined }
		)) as {
			account: { account: Record<string, unknown>; accountCap: unknown };
		};

		expect(result.account.account.accountId).toBe(ACCOUNT_ID);
		expect(result.account.accountCap).toEqual(cap);

		const calls = installFetch({ error: "must not call" });
		await expect(
			clientForTest().getAccountObjects({ accountIds: [] })
		).resolves.toEqual({ accounts: [] });
		expect(calls).toHaveLength(0);
	});

	it("routes ownership and admin-cap queries with optional fields", async () => {
		const owned = await expectPost(
			(client) => client.getOwnedAccountCaps({ walletAddress: FULL_ADDRESS }),
			{ accountCaps: [{ accountId: ACCOUNT_ID_WIRE }] },
			"accounts/owned",
			{ walletAddress: FULL_ADDRESS }
		);
		expect(owned).toEqual({ accountCaps: [{ accountId: ACCOUNT_ID }] });

		await expectPost(
			(client) =>
				client.getOwnedAccountCaps({
					walletAddress: FULL_ADDRESS,
					collateralCoinTypes: [COLLATERAL],
				}),
			{ accountCaps: [] },
			"accounts/owned",
			{ walletAddress: FULL_ADDRESS, collateralCoinTypes: [COLLATERAL] }
		);

		await expectPost(
			(client) => client.getOwnedVaultCaps({ walletAddress: FULL_ADDRESS }),
			{ ownedVaultCaps: [] },
			"vaults/owned-vault-caps",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) =>
				client.getOwnedVaultAssistantCaps({ walletAddress: FULL_ADDRESS }),
			{ ownedVaultAssistantCaps: [] },
			"vaults/owned-vault-assistant-caps",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) =>
				client.getOwnedVaultWithdrawRequests({ walletAddress: FULL_ADDRESS }),
			{ ownedWithdrawRequests: [] },
			"vaults/owned-withdraw-requests",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) => client.getOwnedVaultLpCoins({ walletAddress: FULL_ADDRESS }),
			{ ownedLpCoins: [] },
			"vaults/owned-lp-coins",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) => client.getAdminAccountCaps({ accountIds: [ACCOUNT_ID] }),
			{ accountCaps: [] },
			"accounts",
			{ accountIds: [ACCOUNT_ID_WIRE] }
		);
	});

	it("routes historical market data and preserves pagination limits", async () => {
		await expectPost(
			(client) =>
				client.getMarketCandleHistory({
					marketId: SHORT_ID,
					fromTimestamp: 1_700_000_000_000,
					toTimestamp: 1_700_003_600_000,
					resolution: "1h",
				}),
			{ candles: [] },
			"market/candle-history",
			{
				marketId: SHORT_ID,
				fromTimestamp: 1_700_000_000_000,
				toTimestamp: 1_700_003_600_000,
				resolution: "1h",
			}
		);

		const funding = await expectPost(
			(client) =>
				client.getMarketFundingHistory({
					marketId: SHORT_ID,
					fromTimestamp: 1_700_000_000_000,
					toTimestamp: 1_700_003_600_000,
					limit: 2,
				}),
			{ history: [{ timestamp: 1_700_000_000_000 }] },
			"market/funding-history",
			{
				marketId: SHORT_ID,
				fromTimestamp: 1_700_000_000_000,
				toTimestamp: 1_700_003_600_000,
				limit: 2,
			}
		);
		expect(funding).toEqual({ history: [{ timestamp: 1_700_000_000_000 }] });

		await expectPost(
			(client) => client.getMarkets24hrStats({ marketIds: [SHORT_ID] }),
			{ marketsStats: [{ midPrice: null, markPrice: 101 }] },
			"markets/24hr-stats",
			{ marketIds: [SHORT_ID] }
		);
	});

	it("handles price and LP-price empty fast paths without transport calls", async () => {
		const calls = installFetch({ error: "must not call" });
		await expect(clientForTest().getPrices({ marketIds: [] })).resolves.toEqual(
			{
				marketsPrices: [],
			}
		);
		await expect(
			clientForTest().getLpCoinPrices({ vaultIds: [] })
		).resolves.toEqual({
			lpCoinPrices: [],
		});
		expect(calls).toHaveLength(0);
	});

	it("fetches market prices and LP coin prices with non-empty IDs", async () => {
		const prices = await expectPost(
			(client) => client.getPrices({ marketIds: [SHORT_ID] }),
			{
				marketsPrices: [
					{
						marketId: SHORT_ID,
						basePrice: 100,
						collateralPrice: 1,
						midPrice: null,
						markPrice: 101,
					},
				],
			},
			"markets/prices",
			{ marketIds: [SHORT_ID] }
		);
		expect(prices).toEqual({
			marketsPrices: [
				{
					marketId: SHORT_ID,
					basePrice: 100,
					collateralPrice: 1,
					midPrice: undefined,
					markPrice: 101,
				},
			],
		});

		await expectPost(
			(client) => client.getLpCoinPrices({ vaultIds: [SHORT_ID, FULL_ID] }),
			{ lpCoinPrices: [1.25, 0.99] },
			"vaults/lp-coin-prices",
			{ vaultIds: [SHORT_ID, FULL_ID] }
		);
	});

	it("serializes transaction wrapper bodies and reconstructs returned transaction kinds", async () => {
		const transfer = (await expectPost(
			(client) =>
				client.getTransferCapTx({
					recipientAddress: FULL_ADDRESS,
					capObjectId: SHORT_ID,
				}),
			{ txKind: "encoded-transfer" },
			"transactions/transfer-cap",
			{ recipientAddress: FULL_ADDRESS, capObjectId: SHORT_ID }
		)) as { tx: { mode: string; txKind: string } };
		expect(transfer.tx).toEqual({
			mode: "fromKind",
			txKind: "encoded-transfer",
		});

		const create = (await expectPost(
			(client) =>
				client.getCreateAccountTx({
					walletAddress: FULL_ADDRESS,
					collateralCoinType: COLLATERAL,
					deferShare: true,
				}),
			{
				txKind: "encoded-account",
				deferred: {
					accountArg: { kind: "Input", index: 0 },
					sharePolicyArg: { kind: "Input", index: 1 },
					adminCapArg: { kind: "Input", index: 2 },
					collateralCoinType: COLLATERAL,
				},
			},
			"transactions/create-account",
			{
				walletAddress: FULL_ADDRESS,
				collateralCoinType: COLLATERAL,
				deferShare: true,
			}
		)) as { tx: unknown; deferred: Record<string, unknown> };
		expect(create.tx).toEqual({ mode: "fromKind", txKind: "encoded-account" });
		expect(create.deferred.collateralCoinType).toBe(COLLATERAL);

		const grant = (await expectPost(
			(client) =>
				client.getGrantAgentWalletTx({
					recipientAddress: FULL_ADDRESS,
					accountId: ACCOUNT_ID,
				}),
			{ txKind: "encoded-grant" },
			"account/transactions/grant-agent-wallet",
			{ recipientAddress: FULL_ADDRESS, accountId: ACCOUNT_ID_WIRE }
		)) as { tx: unknown };
		expect(grant.tx).toEqual({ mode: "fromKind", txKind: "encoded-grant" });

		await expectPost(
			(client) =>
				client.getGrantVaultAgentWalletTx({
					vaultId: SHORT_ID,
					recipientAddress: FULL_ADDRESS,
					sponsor: { walletAddress: FULL_ADDRESS },
				}),
			{ txKind: "encoded-vault-grant" },
			"vault/transactions/owner/grant-agent-wallet",
			{
				vaultId: SHORT_ID,
				recipientAddress: FULL_ADDRESS,
				sponsor: { walletAddress: FULL_ADDRESS },
			}
		);

		await expectPost(
			(client) =>
				client.getRevokeVaultAgentWalletTx({
					vaultId: SHORT_ID,
					accountCapId: FULL_ID,
				}),
			{ txKind: "encoded-vault-revoke" },
			"vault/transactions/owner/revoke-agent-wallet",
			{ vaultId: SHORT_ID, accountCapId: FULL_ID }
		);

		await expectPost(
			(client) =>
				client.getShareAccountTx({
					accountArg: { kind: "Input", index: 0 } as never,
					sharePolicyArg: { kind: "Input", index: 1 } as never,
					adminCapArg: { kind: "Input", index: 2 } as never,
					collateralCoinType: COLLATERAL,
				}),
			{ txKind: "encoded-share" },
			"account/transactions/share",
			{
				accountArg: { kind: "Input", index: 0 } as never,
				sharePolicyArg: { kind: "Input", index: 1 } as never,
				adminCapArg: { kind: "Input", index: 2 } as never,
				collateralCoinType: COLLATERAL,
			}
		);
	});

	it("routes vault creation transaction variants and optional metadata", async () => {
		await expectPost(
			(client) =>
				client.getCreateVaultCapTx({
					walletAddress: FULL_ADDRESS,
					lpCoinMetadata: {
						name: "Aftermath Vault",
						symbol: "afV",
						description: "Test vault",
					},
					sponsor: { walletAddress: FULL_ADDRESS },
				}),
			{ txKind: "encoded-cap" },
			"vault/transactions/create-vault-cap",
			{
				walletAddress: FULL_ADDRESS,
				lpCoinMetadata: {
					name: "Aftermath Vault",
					symbol: "afV",
					description: "Test vault",
				},
				sponsor: { walletAddress: FULL_ADDRESS },
			}
		);

		await expectPost(
			(client) =>
				client.getCreateVaultTx({
					walletAddress: FULL_ADDRESS,
					metadata: { name: "Vault", description: "A test vault" },
					coinMetadataId: SHORT_ID,
					treasuryCapId: FULL_ID,
					collateralCoinType: COLLATERAL,
					lockPeriodMs: 86_400_000n,
					performanceFeePercentage: 0.2,
					forceWithdrawDelayMs: 3_600_000n,
					initialDepositAmount: 12345678901234567890n,
					isSponsoredTx: true,
				}),
			{ txKind: "encoded-vault" },
			"vault/transactions/create-vault",
			{
				walletAddress: FULL_ADDRESS,
				metadata: { name: "Vault", description: "A test vault" },
				coinMetadataId: SHORT_ID,
				treasuryCapId: FULL_ID,
				collateralCoinType: COLLATERAL,
				lockPeriodMs: "86400000n",
				performanceFeePercentage: 0.2,
				forceWithdrawDelayMs: "3600000n",
				initialDepositAmount: "12345678901234567890n",
				isSponsoredTx: true,
			}
		);
	});

	it("routes builder-code inspections", async () => {
		await expectPost(
			(client) =>
				client.getBuilderCodeIntegratorConfig({
					accountId: ACCOUNT_ID,
					integratorId: 7,
				}),
			{ maxIntegratorFee: null, exists: false },
			"builder-codes/integrator-config",
			{ accountId: ACCOUNT_ID_WIRE, integratorId: 7 }
		);
		await expectPost(
			(client) => client.getBuilderCodeIntegratorVaults({ integratorId: 7 }),
			{ integratorVaults: [] },
			"builder-codes/integrator-vaults",
			{ integratorId: 7 }
		);
	});

	it("derives txKind from the optional shared AftermathApi transaction helper", async () => {
		const tx = { marker: "existing transaction" };
		const fetchBase64TxKindFromTx = (input: { tx: unknown }) => {
			expect(input.tx).toBe(tx);
			return "existing-kind";
		};
		const api = {
			Transactions: () => ({ fetchBase64TxKindFromTx }),
		};
		const calls = installFetch({ txKind: "encoded" });
		const result = await new PerpetualsClient(
			{ baseUrl: API_BASE_URL },
			api as never
		).getCreateAccountTx({
			walletAddress: FULL_ADDRESS,
			collateralCoinType: COLLATERAL,
			tx: tx as never,
		});

		expect(requestBody(calls[0] as FetchCall)).toEqual({
			walletAddress: FULL_ADDRESS,
			collateralCoinType: COLLATERAL,
			txKind: "existing-kind",
		});
		expect(result.tx).toEqual({ mode: "fromKind", txKind: "encoded" });
	});
});
