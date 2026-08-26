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

	it("maps pool reads with bigint response values and optional gasPoolId", async () => {
		const calls = installJsonFetch({
			walletAddress: WALLET,
			gasPoolId: null,
			balance: "12345678901234567890n",
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
			whitelistedAddresses: [WALLET, OTHER_WALLET],
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/gas-pool/pool`
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
