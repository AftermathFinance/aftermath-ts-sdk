import {
	ACCOUNT_OBJECT_ID,
	ASSISTANT_CAP_ID,
	BASE_URL,
	expectTxCall,
	installJsonFetch,
	MARKET_ID,
	makeApi,
	makeVault,
	makeWithdrawalRequest,
	PerpetualsAccount,
	PerpetualsVault,
	RECIPIENT,
	requestBody,
	USDC,
	VAULT_ID,
	WALLET,
} from "@test/packages/perpetuals/fixturesDomain.js";

describe("PerpetualsVault", () => {
	it("validates LP metadata, computes withdraw slippage, and exposes account metadata", () => {
		expect(PerpetualsVault.isValidLpCoinName("BTC Alpha")).toBe(true);
		expect(PerpetualsVault.isValidLpCoinName("BTC\u0000Alpha")).toBe(true);
		expect(PerpetualsVault.isValidLpCoinName("BTC Δ")).toBe(false);
		expect(PerpetualsVault.isValidLpCoinTypeSymbol("BTC_ALPHA")).toBe(true);
		expect(PerpetualsVault.isValidLpCoinTypeSymbol("btc_ALPHA")).toBe(false);
		expect(PerpetualsVault.isValidLpCoinTypeSymbol("BTC-ALPHA")).toBe(false);

		expect(
			PerpetualsVault.calcWithdrawRequestSlippage({
				withdrawRequest: makeWithdrawalRequest(),
			})
		).toBe(0.2);
		expect(
			PerpetualsVault.calcWithdrawRequestSlippage({
				withdrawRequest: makeWithdrawalRequest({ lpAmountInUsd: 0 }),
			})
		).toBe(0);

		const vault = makeVault();
		expect(vault.partialVaultCap()).toEqual({
			vaultId: VAULT_ID,
			ownerAddress: WALLET,
			accountId: 9_007_199_254_740_993n,
			accountObjectId: ACCOUNT_OBJECT_ID,
			collateralCoinType: USDC,
		});
		Date.now = () => 1_700_000_000_000;
		expect(vault.isPaused()).toBe(false);
		const paused = makeVault({ baseUrl: BASE_URL }, undefined, {
			pausedUntilTimestamp: 1_700_000_000_001n,
		});
		expect(paused.isPaused()).toBe(true);
	});

	it("builds force-withdraw, owner, and user vault transactions with vault identity", async () => {
		const { api } = makeApi();
		const vault = makeVault({ baseUrl: BASE_URL }, api);

		await expectTxCall(
			() =>
				vault.getProcessForceWithdrawRequestTx({
					walletAddress: WALLET,
					sizesToClose: { [MARKET_ID]: 9_007_199_254_740_993n },
					recipientAddress: RECIPIENT,
				}),
			"vault/transactions/process-force-withdraw-request",
			{
				walletAddress: WALLET,
				sizesToClose: { [MARKET_ID]: "9007199254740993n" },
				recipientAddress: RECIPIENT,
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() => vault.getPauseVaultForForceWithdrawRequestTx({}),
			"vault/transactions/pause-vault-for-force-withdraw-request",
			{ vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getUpdateWithdrawRequestSlippageTx({
					minCollateralAmountOut: 123_456n,
				}),
			"vault/transactions/update-withdraw-request-slippage",
			{ minCollateralAmountOut: "123456n", vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerUpdateForceWithdrawDelayTx({
					forceWithdrawDelayMs: 86_400_000n,
				}),
			"vault/transactions/owner/update-force-withdraw-delay",
			{ forceWithdrawDelayMs: "86400000n", vaultId: VAULT_ID }
		);
		await expectTxCall(
			() => vault.getOwnerUpdateLockPeriodTx({ lockPeriodMs: 43_200_000n }),
			"vault/transactions/owner/update-lock-period",
			{ lockPeriodMs: "43200000n", vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerUpdatePerformanceFeeTx({
					performanceFeePercentage: 0.15,
				}),
			"vault/transactions/owner/update-performance-fee",
			{ performanceFeePercentage: 0.15, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() => vault.getGrantAgentWalletTx({ recipientAddress: RECIPIENT }),
			"vault/transactions/owner/grant-agent-wallet",
			{ recipientAddress: RECIPIENT, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() => vault.getRevokeAgentWalletTx({ accountCapId: ASSISTANT_CAP_ID }),
			"vault/transactions/owner/revoke-agent-wallet",
			{ accountCapId: ASSISTANT_CAP_ID, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerProcessWithdrawRequestsTx({ userAddresses: [WALLET] }),
			"vault/transactions/owner/process-withdraw-requests",
			{ userAddresses: [WALLET], vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerWithdrawPerformanceFeesTx({
					withdrawAmount: 1_000n,
					recipientAddress: RECIPIENT,
				}),
			"vault/transactions/owner/withdraw-performance-fees",
			{
				withdrawAmount: "1000n",
				recipientAddress: RECIPIENT,
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() =>
				vault.getOwnerWithdrawCollateralTx({
					lpWithdrawAmount: 2_000n,
					minCollateralAmountOut: 1_500n,
				}),
			"vault/transactions/owner/withdraw-collateral",
			{
				lpWithdrawAmount: "2000n",
				minCollateralAmountOut: "1500n",
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() =>
				vault.getOwnerWithdrawLockedLiquidityTx({
					amount: 500n,
					minCollateralAmountOut: 300n,
				}),
			"vault/transactions/owner/withdraw-locked-liquidity",
			{
				amount: "500n",
				minCollateralAmountOut: "300n",
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() =>
				vault.getCreateWithdrawRequestTx({
					walletAddress: WALLET,
					lpWithdrawAmount: 2_000n,
					minCollateralAmountOut: 1_500n,
				}),
			"vault/transactions/create-withdraw-request",
			{
				walletAddress: WALLET,
				lpWithdrawAmount: "2000n",
				minCollateralAmountOut: "1500n",
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() => vault.getCancelWithdrawRequestTx({ walletAddress: WALLET }),
			"vault/transactions/cancel-withdraw-request",
			{ walletAddress: WALLET, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getDepositTx({
					walletAddress: WALLET,
					minLpAmountOut: 900n,
					depositAmount: 1_000_000n,
					isSponsoredTx: true,
				}),
			"vault/transactions/deposit",
			{
				walletAddress: WALLET,
				minLpAmountOut: "900n",
				depositAmount: "1000000n",
				isSponsoredTx: true,
				collateralCoinType: USDC,
				vaultId: VAULT_ID,
			}
		);
	});

	it("fetches vault requests and previews, LP prices, and account objects", async () => {
		const { api } = makeApi();
		const vault = makeVault({ baseUrl: BASE_URL }, api);

		let calls = installJsonFetch({ withdrawRequests: [] });
		await expect(vault.getAllWithdrawRequests()).resolves.toEqual({
			withdrawRequests: [],
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vaults/withdraw-requests`
		);
		expect(requestBody(calls)).toEqual({ vaultIds: [VAULT_ID] });

		calls = installJsonFetch({ collateralAmountOut: 800 });
		await expect(
			vault.getPreviewOwnerWithdrawCollateral({ lpWithdrawAmount: 1_000n })
		).resolves.toEqual({ collateralAmountOut: 800 });
		expect(requestBody(calls)).toEqual({
			lpWithdrawAmount: "1000n",
			vaultId: VAULT_ID,
		});

		calls = installJsonFetch({ lpAmountOut: 1250 });
		await expect(
			vault.getPreviewDeposit({ depositAmount: 2_000n })
		).resolves.toEqual({
			lpAmountOut: 1250,
		});
		expect(requestBody(calls)).toEqual({
			depositAmount: "2000n",
			vaultId: VAULT_ID,
		});

		calls = installJsonFetch({ lpCoinPrices: [1.25] });
		await expect(vault.getLpCoinPrice()).resolves.toBe(1.25);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vaults/lp-coin-prices`
		);
		expect(requestBody(calls)).toEqual({ vaultIds: [VAULT_ID] });

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
		await expect(vault.getAccountObject()).resolves.toEqual({
			account: { ...accountWire, accountId: 9_007_199_254_740_993n },
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/accounts/positions`
		);
		expect(requestBody(calls)).toEqual({ accountIds: ["9007199254740993n"] });

		calls = installJsonFetch({ accounts: [accountWire] });
		const accountResponse = await vault.getAccount();
		expect(accountResponse.account).toBeInstanceOf(PerpetualsAccount);
		expect(accountResponse.account.isVault()).toBe(true);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/accounts/positions`
		);
	});
});
