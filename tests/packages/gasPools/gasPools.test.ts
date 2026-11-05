import {
	API_BASE_URL,
	asyncMock,
	describe,
	expect,
	type FetchCall,
	fakeApi,
	GasPools,
	installJsonFetch,
	installRejectingFetch,
	it,
	jest,
	OTHER_WALLET,
	requestBody,
	requestUrl,
	Transaction,
	WALLET,
	wireJson,
} from "@test/packages/gasPools/fixtures.js";

describe("GasPools", () => {
	function mockTransactionDecoders() {
		const decoded = { decoded: true } as unknown as Transaction;
		jest.spyOn(Transaction, "fromKind").mockReturnValue(decoded);
		return decoded;
	}

	it("maps v1 pool reads with bigint balance, reserved, and optional gasPoolId", async () => {
		const calls = installJsonFetch({
			walletAddress: WALLET,
			gasPoolId: null,
			balance: "12345678901234567890n",
			reserved: "250n",
			whitelistedAddresses: [WALLET, OTHER_WALLET],
		});
		const gasPools = new GasPools({
			baseUrl: API_BASE_URL,
			accessToken: "gas-token",
		});
		expect(await gasPools.getPool({ walletAddress: WALLET })).toEqual({
			walletAddress: WALLET,
			gasPoolId: undefined,
			balance: 12345678901234567890n,
			reserved: 250n,
			whitelistedAddresses: [WALLET, OTHER_WALLET],
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/v1/gas-pool/pool`
		);
		expect(requestBody(calls[0])).toEqual({ walletAddress: WALLET });
		expect(
			(calls[0].init?.headers as Record<string, string>).Authorization
		).toBe("Bearer gas-token");
	});

	it("maps create/deposit/withdraw/grant/revoke/share request bodies and tx-kind options", async () => {
		const decoded = mockTransactionDecoders();
		const tx = new Transaction();
		const transactionHelper = {
			fetchBase64TxKindFromTx: jest.fn(
				async ({ tx: input }: { tx?: Transaction }) =>
					input ? "client-kind" : undefined
			),
		};
		const api = fakeApi({ Transactions: () => transactionHelper });
		const gasPools = new GasPools({ baseUrl: API_BASE_URL }, api);
		const responses = [
			{
				txKind: "create-kind",
				gasPoolArg: "gas-arg",
				sharePolicyArg: "policy-arg",
			},
			{ txKind: "deposit-kind" },
			{ txKind: "withdraw-kind", withdrawnCoinArg: "withdrawn-arg" },
			{ txKind: "grant-kind" },
			{ txKind: "revoke-kind" },
			{ txKind: "share-kind" },
		];
		const calls: FetchCall[] = [];
		globalThis.fetch = ((input, init) => {
			calls.push({ input, init });
			return Promise.resolve(
				new Response(wireJson(responses.shift()), { status: 200 })
			);
		}) as typeof fetch;

		await expect(
			gasPools.getCreateTx({
				walletAddress: WALLET,
				initialDepositAmount: 100n,
				deferShare: true,
				tx,
			})
		).resolves.toEqual({
			tx: decoded,
			gasPoolArg: "gas-arg",
			sharePolicyArg: "policy-arg",
		});
		await expect(
			gasPools.getDepositTx({
				walletAddress: WALLET,
				isSponsoredTx: true,
				coinType: "0x3::coin::USDC",
				amount: 7n,
				slippage: 0.02,
				gasPoolArg: "pool-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded });
		await expect(
			gasPools.getWithdrawTx({
				walletAddress: WALLET,
				amount: 8n,
				recipientAddress: OTHER_WALLET,
				deferTransfer: true,
				gasPoolArg: "pool-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded, withdrawnCoinArg: "withdrawn-arg" });
		await expect(
			gasPools.getGrantTx({
				walletAddress: WALLET,
				targetWalletAddress: OTHER_WALLET,
				gasPoolArg: "pool-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded });
		await expect(
			gasPools.getRevokeTx({
				walletAddress: WALLET,
				targetWalletAddress: OTHER_WALLET,
				tx,
			})
		).resolves.toEqual({ tx: decoded });
		await expect(
			gasPools.getShareTx({
				gasPoolArg: "pool-arg" as never,
				sharePolicyArg: "policy-arg" as never,
				tx,
			})
		).resolves.toEqual({ tx: decoded });

		expect(calls.map((call) => requestUrl(call))).toEqual([
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/create`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/deposit`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/withdraw`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/grant`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/revoke`,
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/transactions/share`,
		]);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: WALLET,
			initialDepositAmount: "100n",
			deferShare: true,
			txKind: "client-kind",
		});
		expect(requestBody(calls[1])).toEqual({
			walletAddress: WALLET,
			isSponsoredTx: true,
			coinType: "0x3::coin::USDC",
			amount: "7n",
			slippage: 0.02,
			gasPoolArg: "pool-arg",
			txKind: "client-kind",
		});
		expect(requestBody(calls[2])).toEqual({
			walletAddress: WALLET,
			amount: "8n",
			recipientAddress: OTHER_WALLET,
			deferTransfer: true,
			gasPoolArg: "pool-arg",
			txKind: "client-kind",
		});
		expect(requestBody(calls[3])).toEqual({
			walletAddress: WALLET,
			targetWalletAddress: OTHER_WALLET,
			gasPoolArg: "pool-arg",
			txKind: "client-kind",
		});
		expect(requestBody(calls[4])).toEqual({
			walletAddress: WALLET,
			targetWalletAddress: OTHER_WALLET,
			txKind: "client-kind",
		});
		expect(requestBody(calls[5])).toEqual({
			gasPoolArg: "pool-arg",
			sharePolicyArg: "policy-arg",
			txKind: "client-kind",
		});
		expect(transactionHelper.fetchBase64TxKindFromTx).toHaveBeenCalledTimes(6);
	});

	it("maps sponsored transaction requests with and without an optional tx kind", async () => {
		const transactionHelper = {
			fetchBase64TxKindFromTx:
				asyncMock<string>().mockResolvedValue("signed-kind"),
		};
		const api = fakeApi({ Transactions: () => transactionHelper });
		const gasPools = new GasPools({ baseUrl: API_BASE_URL }, api);
		const calls = installJsonFetch({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest",
		});

		expect(
			await gasPools.getSponsoredTransaction({
				walletAddress: WALLET,
				bytes: "auth-bytes",
				signature: "wallet-sig",
			})
		).toEqual({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest",
		});
		expect(requestBody(calls[0])).toEqual({
			walletAddress: WALLET,
			bytes: "auth-bytes",
			signature: "wallet-sig",
		});

		const callsWithTx = installJsonFetch({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest-2",
		});
		expect(
			await gasPools.getSponsoredTransaction({
				walletAddress: WALLET,
				bytes: "auth-bytes",
				signature: "wallet-sig",
				tx: new Transaction(),
			})
		).toEqual({
			transaction: "attached",
			sponsorSignature: "sponsor-sig",
			digest: "digest-2",
		});
		expect(requestBody(callsWithTx[0])).toEqual({
			walletAddress: WALLET,
			bytes: "auth-bytes",
			signature: "wallet-sig",
			txKind: "signed-kind",
		});
		expect(transactionHelper.fetchBase64TxKindFromTx).toHaveBeenCalledTimes(1);
	});

	it("applies access-token changes to v1 routes through the shared config", async () => {
		const calls = installJsonFetch({
			walletAddress: WALLET,
			gasPoolId: "0x9",
			balance: "1n",
			reserved: "0n",
			whitelistedAddresses: [],
		});
		const gasPools = new GasPools({ baseUrl: API_BASE_URL });
		gasPools.config.accessToken = "later-token";
		await gasPools.getPool({ walletAddress: WALLET });
		expect(
			(calls[0].init?.headers as Record<string, string>).Authorization
		).toBe("Bearer later-token");
	});

	it("computes the spendable balance as balance minus reserved, never below zero", () => {
		expect(GasPools.spendableBalance({ balance: 1_000n, reserved: 250n })).toBe(
			750n
		);
		expect(GasPools.spendableBalance({ balance: 100n, reserved: 100n })).toBe(
			0n
		);
		expect(GasPools.spendableBalance({ balance: 100n, reserved: 400n })).toBe(
			0n
		);
	});

	it("maps v1 history pages with bigint amounts and an optional cursor", async () => {
		const calls = installJsonFetch({
			gasPoolId: "0x9",
			events: [
				{
					timestampMs: 1_792_965_134_812,
					operation: "deposit",
					eventType: "rebate",
					amount: "144000n",
				},
				{
					timestampMs: 1_792_964_682_267,
					operation: "withdraw",
					eventType: "sponsor",
					amount: "1188217n",
				},
			],
			cursor: null,
		});
		const gasPools = new GasPools({ baseUrl: API_BASE_URL });
		expect(
			await gasPools.getHistory({ gasPoolId: "0x9", cursor: "c1", limit: 2 })
		).toEqual({
			gasPoolId: "0x9",
			events: [
				{
					timestampMs: 1_792_965_134_812,
					operation: "deposit",
					eventType: "rebate",
					amount: 144000n,
				},
				{
					timestampMs: 1_792_964_682_267,
					operation: "withdraw",
					eventType: "sponsor",
					amount: 1188217n,
				},
			],
			cursor: undefined,
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/v1/gas-pool/history`
		);
		expect(requestBody(calls[0])).toEqual({
			gasPoolId: "0x9",
			cursor: "c1",
			limit: 2,
		});
	});

	it("builds swap-funded create and deposit as sponsor-signed v1 transactions", async () => {
		const decoded = { sponsored: true } as unknown as Transaction;
		const fromSpy = jest.spyOn(Transaction, "from").mockReturnValue(decoded);
		const fromKindSpy = jest.spyOn(Transaction, "fromKind");
		const gasPools = new GasPools({ baseUrl: API_BASE_URL });
		const body = {
			walletAddress: WALLET,
			swap: { coinType: "0x3::coin::USDC", amount: 1_000_000n, slippage: 0.01 },
			bytes: "terms-bytes",
			signature: "terms-sig",
		};
		const calls: FetchCall[] = [];
		globalThis.fetch = ((input, init) => {
			calls.push({ input, init });
			return Promise.resolve(
				new Response(
					wireJson({
						txKind: `signed-${calls.length}`,
						sponsorSignature: "sponsor-sig",
						digest: `digest-${calls.length}`,
					}),
					{ status: 200 }
				)
			);
		}) as typeof fetch;

		await expect(gasPools.getSwapFundedCreateTx(body)).resolves.toEqual({
			tx: decoded,
			sponsorSignature: "sponsor-sig",
			digest: "digest-1",
		});
		await expect(gasPools.getSwapFundedDepositTx(body)).resolves.toEqual({
			tx: decoded,
			sponsorSignature: "sponsor-sig",
			digest: "digest-2",
		});
		expect(calls.map((call) => requestUrl(call))).toEqual([
			`${API_BASE_URL.slice(0, -1)}/api/v1/gas-pool/transactions/create`,
			`${API_BASE_URL.slice(0, -1)}/api/v1/gas-pool/transactions/deposit`,
		]);
		for (const call of calls) {
			expect(requestBody(call)).toEqual({
				walletAddress: WALLET,
				swap: {
					coinType: "0x3::coin::USDC",
					amount: "1000000n",
					slippage: 0.01,
				},
				bytes: "terms-bytes",
				signature: "terms-sig",
			});
		}
		expect(fromSpy).toHaveBeenCalledWith("signed-1");
		expect(fromSpy).toHaveBeenCalledWith("signed-2");
		expect(fromKindSpy).not.toHaveBeenCalled();
	});

	it("classifies gas-pool HTTP errors and no-base-url configuration errors", async () => {
		installJsonFetch({ message: "unavailable" }, 503, { "Retry-After": "2" });
		await expect(
			new GasPools({ baseUrl: API_BASE_URL }).getPool({ walletAddress: WALLET })
		).rejects.toEqual(
			expect.objectContaining({ kind: "http", status: 503, retryAfterMs: 2000 })
		);
		const calls = installRejectingFetch();
		await expect(
			new GasPools().getPool({ walletAddress: WALLET })
		).rejects.toThrow("no apiBaseUrl: unable to fetch data");
		expect(calls).toHaveLength(0);
	});
});
