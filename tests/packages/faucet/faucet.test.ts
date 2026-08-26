import {
	API_BASE_URL,
	asyncMock,
	commands,
	describe,
	expect,
	Faucet,
	FaucetApi,
	FaucetApiCasting,
	FULL_ONE,
	FULL_SUI,
	fakeApi,
	installJsonFetch,
	it,
	jest,
	makeEvent,
	moveCall,
	PAYMENT_COIN,
	requestUrl,
	SUI_FREN_TYPE,
	SUI_TYPE,
	Transaction,
	WALLET,
} from "@test/packages/faucet/fixtures.js";

describe("FaucetApi and Faucet", () => {
	it("constructs event types, casts events, and derives supported coins from add events", async () => {
		const events = {
			fetchCastEventsWithCursor: asyncMock<unknown>().mockResolvedValue({
				events: [
					{
						coinType:
							"0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
					},
				],
				nextCursor: null,
			}),
		};
		const api = fakeApi({ Events: () => events });
		const faucetApi = new FaucetApi(api);
		expect(faucetApi.eventTypes).toEqual({
			mintCoin: "0x31::faucet::MintedCoin",
			addCoin: "0x31::faucet::AddedCoin",
		});
		expect(await faucetApi.fetchSupportedCoins()).toEqual([FULL_SUI]);
		expect(events.fetchCastEventsWithCursor.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				query: { MoveEventType: faucetApi.eventTypes.addCoin },
			})
		);
		expect(() => new FaucetApi(fakeApi({ addresses: {} }))).toThrow(
			"not all required addresses have been set in provider"
		);

		const mint = FaucetApiCasting.faucetMintCoinEventFromOnChain(
			makeEvent(
				{ amount: "9007199254740993", user: WALLET },
				"0x31::faucet::MintedCoin<0x2::sui::SUI>"
			) as never
		);
		expect(mint).toEqual({
			coinType: FULL_SUI,
			minter: FULL_ONE,
			amount: 9007199254740993n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: "0x31::faucet::MintedCoin<0x2::sui::SUI>",
		});
		expect(
			FaucetApiCasting.faucetAddCoinEventFromOnChain(
				makeEvent(
					{ default_mint_amount: "123" },
					"0x31::faucet::AddedCoin<0x2::sui::SUI>"
				) as never
			)
		).toEqual({
			coinType: FULL_SUI,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: "0x31::faucet::AddedCoin<0x2::sui::SUI>",
		});
	});

	it("builds request and SuiFren mint Move transactions with exact addresses", async () => {
		const coinApi = {
			fetchCoinWithAmountTx: jest.fn(async ({ tx }: { tx: Transaction }) =>
				tx.object(PAYMENT_COIN)
			),
		};
		const faucetApi = new FaucetApi(fakeApi({ Coin: () => coinApi }));
		const request = faucetApi.buildRequestCoinTx({
			coinType: SUI_TYPE,
			walletAddress: WALLET,
		});
		expect(request.getData().sender).toBe(FULL_ONE);
		expect(moveCall(request)).toEqual(
			expect.objectContaining({
				package: `0x${"31".padStart(64, "0")}`,
				module: "faucet",
				function: "mint",
				typeArguments: [SUI_TYPE],
			})
		);
		expect(commands(request).map((command) => command.$kind)).toEqual([
			"MoveCall",
			"TransferObjects",
		]);

		const mint = await faucetApi.fetchBuildMintSuiFrenTx({
			mintFee: 8000000000n,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
		});
		expect(coinApi.fetchCoinWithAmountTx).toHaveBeenCalledWith(
			expect.objectContaining({
				walletAddress: WALLET,
				coinType: FULL_SUI,
				coinAmount: 8000000000n,
				tx: expect.any(Transaction),
			})
		);
		expect(moveCall(mint)).toEqual(
			expect.objectContaining({
				package: `0x${"32".padStart(64, "0")}`,
				module: "genesis_wrapper",
				function: "mint_and_keep",
				typeArguments: [SUI_FREN_TYPE],
			})
		);
	});

	it("routes Faucet facade calls and event pagination, and reports missing providers", async () => {
		const faucetApi = {
			buildRequestCoinTx: jest.fn().mockReturnValue("request-tx"),
			fetchBuildMintSuiFrenTx: asyncMock<string>().mockResolvedValue("mint-tx"),
		};
		const api = fakeApi({ Faucet: () => faucetApi });
		const faucet = new Faucet({ baseUrl: API_BASE_URL }, api);
		const calls = installJsonFetch([SUI_TYPE]);
		expect(await faucet.getSupportedCoins()).toEqual([SUI_TYPE]);
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/faucet/supported-coins`
		);
		expect(
			faucet.getRequestCoinTransaction({
				coinType: SUI_TYPE,
				walletAddress: WALLET,
			})
		).toBe("request-tx");
		await expect(
			faucet.getMintSuiFrenTransaction({
				mintFee: 1n,
				suiFrenType: SUI_FREN_TYPE,
				walletAddress: WALLET,
			})
		).resolves.toBe("mint-tx");
		expect(() =>
			new Faucet().getMintSuiFrenTransaction({
				mintFee: 1n,
				suiFrenType: SUI_FREN_TYPE,
				walletAddress: WALLET,
			})
		).toThrow("missing AftermathApi instance");
		expect(() =>
			new Faucet().getRequestCoinTransaction({
				coinType: SUI_TYPE,
				walletAddress: WALLET,
			})
		).toThrow("missing AftermathApi instance");
	});
});
