import {
	ACCOUNT_CAP_ID,
	ACCOUNT_OBJECT_ID,
	ASSISTANT_CAP_ID,
	BASE_URL,
	EMPTY_TRANSACTION_KIND,
	expectTransactionResponse,
	installJsonFetch,
	MARKET_ID,
	MARKET_ID_2,
	makeAccount,
	makeApi,
	makeDirectCap,
	makeStopOrder,
	makeVaultAccountCap,
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsStopOrderTriggerPriceType,
	RECIPIENT,
	requestBody,
	Transaction,
	transactionResponse,
	USDC,
	VAULT_ID,
	WALLET,
} from "@test/packages/perpetuals/fixturesDomain.js";

describe("PerpetualsAccount state and order/margin branches", () => {
	it("exposes direct-account identity, order data, and missing-position behavior", () => {
		const account = makeAccount();
		const position = account.positionForMarketId({ marketId: MARKET_ID });

		expect(position?.baseAssetAmount).toBe(2.5);
		expect(
			account.positionForMarketId({ marketId: MARKET_ID_2 })
		).toBeUndefined();
		expect(account.orderDatas()).toEqual([
			{
				orderId: 22763282186957586694186n,
				currentSize: 3_000_000_000n,
				initialSize: 4_000_000_000n,
				side: PerpetualsOrderSide.Ask,
				marketId: MARKET_ID,
			},
		]);
		expect(account.collateral()).toBe(700);
		expect(account.isVault()).toBe(false);
		expect(account.ownerAddress()).toBe(WALLET);
		expect(account.accountObjectId()).toBe(ACCOUNT_OBJECT_ID);
		expect(account.accountId()).toBe(9_007_199_254_740_993n);
		expect(account.accountCapId()).toBe(ACCOUNT_CAP_ID);
		expect(account.getStopOrdersMessageToSign()).toEqual({
			action: "GET_STOP_ORDERS",
			account_id: "9007199254740993",
			clearing_house_ids: [],
		});
		expect(
			account.getStopOrdersMessageToSign({
				marketIds: [MARKET_ID, MARKET_ID_2],
			})
		).toEqual({
			action: "GET_STOP_ORDERS",
			account_id: "9007199254740993",
			clearing_house_ids: [MARKET_ID, MARKET_ID_2],
		});
	});

	it("distinguishes full, partial, unrelated, and limit-linked SL/TP orders", () => {
		const account = makeAccount();
		const full = makeStopOrder({
			objectId: "0xfull",
			size: 9_223_372_036_854_775_807n,
		});
		const partial = makeStopOrder({ objectId: "0xpartial", size: 2_000_000n });
		const standalone = makeStopOrder({
			objectId: "0xstandalone",
			side: PerpetualsOrderSide.Bid,
			slTp: undefined,
			nonSlTp: {
				stopIndexPrice: 2200,
				triggerIfGeStopIndexPrice: true,
				reduceOnly: true,
				triggerPriceType: PerpetualsStopOrderTriggerPriceType.IndexPrice,
			},
		});
		const wrongSide = makeStopOrder({
			objectId: "0xwrong-side",
			side: PerpetualsOrderSide.Bid,
		});
		const linkedLimit = makeStopOrder({
			objectId: "0xlinked-limit",
			size: 9_223_372_036_854_775_807n,
			limitOrder: {
				price: 2_100_000_000_000n,
				orderType: PerpetualsOrderType.PostOnly,
			},
			slTp: {
				takeProfitPrice: 2100,
				triggerPriceType: PerpetualsStopOrderTriggerPriceType.MarkPrice,
				limitOrderId: 123n,
			},
		});
		const orders = [full, partial, standalone, wrongSide, linkedLimit];

		expect(
			account.slTpStopOrderDatasForPosition({
				marketId: MARKET_ID,
				stopOrderDatas: orders,
			})
		).toEqual({ fullSlTpOrder: full, partialSlTpOrders: [partial] });
		expect(
			account.slTpStopOrderDatasForLimitOrder({
				limitOrderId: 123n,
				stopOrderDatas: orders,
			})
		).toEqual({ fullSlTpOrder: linkedLimit, partialSlTpOrders: undefined });
		expect(
			account
				.slTpStopOrderDatas({ stopOrderDatas: orders })
				?.map((order) => order.objectId)
		).toEqual(["0xfull", "0xpartial", "0xlinked-limit"]);
		expect(
			account
				.nonSlTpStopOrderDatas({ stopOrderDatas: orders })
				?.map((order) => order.objectId)
		).toEqual(["0xstandalone", "0xwrong-side"]);
		expect(
			account
				.nonSlTpStopOrderDatasForPosition({
					marketId: MARKET_ID,
					stopOrderDatas: orders,
				})
				?.map((order) => order.objectId)
		).toEqual(["0xstandalone", "0xwrong-side"]);
		expect(
			account.slTpStopOrderDatasForPosition({
				marketId: MARKET_ID_2,
				stopOrderDatas: orders,
			})
		).toEqual({ fullSlTpOrder: undefined, partialSlTpOrders: undefined });
	});

	it("routes direct and vault account previews and preserves margin errors", async () => {
		const direct = makeAccount();
		const vault = makeAccount(makeVaultAccountCap());
		const previewInputs = {
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			size: 2_000_000_000n,
			reduceOnly: false,
			leverage: 4,
		};
		let calls = installJsonFetch({ error: "maintenance margin" });
		await expect(
			direct.getPlaceMarketOrderPreview(previewInputs as never)
		).resolves.toEqual({
			error: "maintenance margin",
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-market-order`
		);
		expect(requestBody(calls)).toEqual({
			...previewInputs,
			size: "2000000000n",
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: 3,
		});
		await expect(
			vault.getSetLeveragePreview({ marketId: MARKET_ID, leverage: 3 })
		).resolves.toEqual({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: 3,
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vault/previews/set-leverage`
		);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			leverage: 3,
			vaultId: VAULT_ID,
		});

		calls = installJsonFetch({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: -5,
		});
		await expect(
			direct.getEditCollateralPreview({
				marketId: MARKET_ID,
				collateralChange: -5n,
			})
		).resolves.toEqual({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: -5,
		});
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			collateralChange: "-5n",
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch({ stopOrderDatas: [] });
		await expect(
			direct.getStopOrderDatas({ bytes: "signed-bytes", signature: "sig" })
		).resolves.toEqual({ stopOrderDatas: [] });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/stop-order-datas`
		);
		expect(requestBody(calls)).toEqual({
			bytes: "signed-bytes",
			signature: "sig",
			walletAddress: WALLET,
			marketIds: [],
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch({
			marginHistoryDatas: [],
		});
		await expect(
			direct.getMarginHistory({
				timeframe: "1W",
			})
		).resolves.toEqual({
			marginHistoryDatas: [],
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/margin-history`
		);
		expect(requestBody(calls)).toEqual({
			timeframe: "1W",
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch({ marketIdsToData: {} });
		await expect(
			direct.getCancelOrdersPreview({ marketIdsToData: {} })
		).resolves.toEqual({
			marketIdsToData: {},
		});
		expect(calls).toHaveLength(0);
	});

	it("builds direct-account collateral and order transactions with wire bigints", async () => {
		const { api, serializedTransactions } = makeApi();
		const account = makeAccount(makeDirectCap(), api);
		const sponsor = {
			walletAddress: WALLET,
			bytes: "bytes",
			signature: "signature",
		};

		let calls = installJsonFetch(transactionResponse());
		let response = await account.getDepositCollateralTx({
			depositAmount: 9_007_199_254_740_993n,
			isSponsoredTx: true,
			sponsor,
		});
		expectTransactionResponse(response);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/transactions/deposit-collateral`
		);
		expect(requestBody(calls)).toEqual({
			depositAmount: "9007199254740993n",
			isSponsoredTx: true,
			sponsor,
			walletAddress: WALLET,
			collateralCoinType: USDC,
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(
			transactionResponse({ coinOutArg: { kind: "Result", index: 0 } })
		);
		response = await account.getWithdrawCollateralTx({
			withdrawAmount: 123_456_789_012_345n,
			recipientAddress: RECIPIENT,
			tx: new Transaction(),
		});
		expectTransactionResponse(response);
		expect((response as unknown as { coinOutArg: unknown }).coinOutArg).toEqual(
			{
				kind: "Result",
				index: 0,
			}
		);
		expect(requestBody(calls)).toEqual({
			withdrawAmount: "123456789012345n",
			recipientAddress: RECIPIENT,
			walletAddress: WALLET,
			accountId: "9007199254740993n",
			txKind: EMPTY_TRANSACTION_KIND,
		});
		expect(serializedTransactions).toHaveLength(2);
		expect(serializedTransactions[1]).toBeInstanceOf(Transaction);

		calls = installJsonFetch(transactionResponse());
		response = await account.getTransferCollateralTx({
			transferAmount: 500n,
			toAccountId: 42n,
			toAccountCapId: "0xto-cap",
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toEqual({
			transferAmount: "500n",
			toAccountId: "42n",
			toAccountCapId: "0xto-cap",
			walletAddress: WALLET,
			fromAccountId: "9007199254740993n",
			fromAccountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceMarketOrderTx({
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			size: 2_000_000_000n,
			collateralChange: 100,
			hasPosition: true,
			cancelSlTp: false,
			reduceOnly: false,
			slippage: 0.01,
			leverage: 5,
			slTp: { size: 1_000_000_000n, stopLossPrice: 1800 },
		});
		expectTransactionResponse(response);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/transactions/place-market-order`
		);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			side: 0,
			size: "2000000000n",
			collateralChange: 100,
			hasPosition: true,
			cancelSlTp: false,
			reduceOnly: false,
			slippage: 0.01,
			leverage: 5,
			slTp: { size: "1000000000n", stopLossPrice: 1800 },
			walletAddress: WALLET,
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceLimitOrderTx({
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Ask,
			size: 3_000_000_000n,
			price: 2_100_000_000_000n,
			orderType: PerpetualsOrderType.PostOnly,
			collateralChange: 0,
			hasPosition: true,
			cancelSlTp: true,
			reduceOnly: true,
			expiryTimestamp: 1_800_000_000_000n,
			clientOrderId: 88n,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			side: 1,
			size: "3000000000n",
			price: "2100000000000n",
			orderType: 2,
			collateralChange: 0,
			hasPosition: true,
			cancelSlTp: true,
			reduceOnly: true,
			expiryTimestamp: "1800000000000n",
			clientOrderId: "88n",
			walletAddress: WALLET,
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceScaleOrderTx({
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			totalSize: 6_000_000_000n,
			startPrice: 2_000_000_000_000n,
			endPrice: 2_100_000_000_000n,
			numberOfOrders: 3,
			orderType: PerpetualsOrderType.Standard,
			collateralChange: 20,
			hasPosition: false,
			reduceOnly: false,
			cancelSlTp: false,
			clientOrderIds: [1n, 2n, 3n],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			totalSize: "6000000000n",
			startPrice: "2000000000000n",
			endPrice: "2100000000000n",
			clientOrderIds: ["1n", "2n", "3n"],
			accountId: "9007199254740993n",
		});
	});

	it("builds cancel, stop, SL/TP, TWAP, leverage, and agent-wallet transactions", async () => {
		const { api } = makeApi();
		const account = makeAccount(makeDirectCap(), api);
		let calls = installJsonFetch(transactionResponse());
		let response = await account.getCancelAndPlaceOrdersTx({
			marketId: MARKET_ID,
			orderIdsToCancel: [11n, 12n],
			ordersToPlace: [
				{ side: PerpetualsOrderSide.Bid, price: 2_000n, size: 3_000n },
			],
			orderType: PerpetualsOrderType.Standard,
			reduceOnly: false,
			hasPosition: true,
		});
		expectTransactionResponse(response);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/transactions/cancel-and-place-orders`
		);
		expect(requestBody(calls)).toMatchObject({
			orderIdsToCancel: ["11n", "12n"],
			ordersToPlace: [{ side: 0, price: "2000n", size: "3000n" }],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCancelOrdersTx({
			marketIdsToData: {
				[MARKET_ID]: {
					orderIds: [11n],
					collateralChange: -4,
				},
			},
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			marketIdsToData: {
				[MARKET_ID]: { orderIds: ["11n"], collateralChange: -4 },
			},
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCancelStopOrdersTx({
			stopOrderIds: ["0xstop"],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			stopOrderIds: ["0xstop"],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceStopOrdersTx({
			stopOrders: [
				{
					marketId: MARKET_ID,
					size: 2_000_000_000n,
					side: PerpetualsOrderSide.Ask,
					slTp: {
						stopLossPrice: 1800,
						triggerPriceType: PerpetualsStopOrderTriggerPriceType.IndexPrice,
					},
				},
			] as never,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			stopOrders: [
				{
					marketId: MARKET_ID,
					size: "2000000000n",
					side: 1,
				},
			],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceSlTpOrdersTx({
			marketId: MARKET_ID,
			size: 1_000_000_000n,
			stopLossPrice: 1800,
			takeProfitPrice: 2200,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			marketId: MARKET_ID,
			positionSide: 0,
			size: "1000000000n",
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCreateTwapOrdersTx({
			twapOrders: [
				{
					marketId: MARKET_ID,
					side: PerpetualsOrderSide.Bid,
					size: 10_000n,
					reduceOnly: false,
					chunksAmount: 4,
					executionGapMs: 1000,
					executionTimeUncertaintyMs: 100,
					timeForRetryMs: 500,
					amountUncertaintyBps: 10,
					maxOneExecutionAmountBps: 2500,
					smallTailMergeThresholdBps: 50,
					maxSlippageBps: 100,
				},
			],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			twapOrders: [expect.objectContaining({ size: "10000n" })],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getEditTwapOrdersTx({
			newTwapOrders: { "0xtwap": { newExecutors: [RECIPIENT] } },
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			newTwapOrders: { "0xtwap": { newExecutors: [RECIPIENT] } },
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCancelTwapOrdersTx({
			twapOrderIds: ["0xtwap"],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			twapOrderIds: ["0xtwap"],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getSetLeverageTx({
			marketId: MARKET_ID,
			leverage: 8,
			collateralChange: 12,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			marketId: MARKET_ID,
			leverage: 8,
			collateralChange: 12,
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getGrantAgentWalletTx({
			recipientAddress: RECIPIENT,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			recipientAddress: RECIPIENT,
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getRevokeAgentWalletTx({
			accountCapId: ASSISTANT_CAP_ID,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			accountCapId: ASSISTANT_CAP_ID,
			accountId: "9007199254740993n",
		});
	});

	it("rejects direct-only account operations for vault-backed accounts", async () => {
		const vaultAccount = makeAccount(makeVaultAccountCap());

		await expect(
			vaultAccount.getDepositCollateralTx({ depositAmount: 1n })
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getWithdrawCollateralTx({ withdrawAmount: 1n })
		).rejects.toThrow("not supported for vaults");
		await expect(
			vaultAccount.getTransferCollateralTx({
				transferAmount: 1n,
				toAccountId: 2n,
			})
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getGrantAgentWalletTx({ recipientAddress: RECIPIENT })
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getRevokeAgentWalletTx({ accountCapId: ASSISTANT_CAP_ID })
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getPlaceSlTpOrdersTx({
				marketId: MARKET_ID_2,
				stopLossPrice: 1800,
			})
		).rejects.toThrow("you have no position for this market");

		expect(vaultAccount.isVault()).toBe(true);
		expect(vaultAccount.ownerAddress()).toBe(WALLET);
		expect(() => vaultAccount.accountCapId()).toThrow(
			"not account cap id present on vault owned account"
		);
	});
});
