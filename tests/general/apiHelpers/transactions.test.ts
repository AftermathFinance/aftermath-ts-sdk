import {
	jest,
	makeApi,
	OBJECT_1,
	OWNER,
	type Transaction,
	TransactionsApiHelpers,
} from "@test/general/fixtures/services.js";

describe("TransactionsApiHelpers", () => {
	it("queries transaction history through the optional JSON-RPC client with all required options", async () => {
		const queryTransactionBlocks = jest.fn().mockResolvedValue({
			data: [{ digest: "tx-1", effects: { status: { status: "success" } } }],
			nextCursor: undefined,
		});
		const api = makeApi({}, {}, { queryTransactionBlocks });
		const query = { filter: { FromAddress: OWNER } } as never;

		await expect(
			new TransactionsApiHelpers(api).fetchTransactionsWithCursor({
				query,
				cursor: "tx-cursor",
				limit: 12,
			})
		).resolves.toEqual({
			transactions: [
				{ digest: "tx-1", effects: { status: { status: "success" } } },
			],
			nextCursor: null,
		});
		expect(queryTransactionBlocks).toHaveBeenCalledWith({
			filter: { FromAddress: OWNER },
			cursor: "tx-cursor",
			limit: 12,
			options: {
				showEvents: true,
				showBalanceChanges: true,
				showEffects: true,
				showObjectChanges: true,
				showInput: true,
			},
		});
	});

	it("uses failed simulation effects when assigning a bigint gas budget and reference price", async () => {
		const build = jest.fn().mockResolvedValue(new Uint8Array([1, 2]));
		const setGasBudget = jest.fn();
		const setGasPrice = jest.fn();
		const tx = { build, setGasBudget, setGasPrice } as unknown as Transaction;
		const simulateTransaction = jest.fn().mockResolvedValue({
			$kind: "FailedTransaction",
			FailedTransaction: {
				effects: {
					gasUsed: { computationCost: "70", storageCost: "5" },
				},
			},
		});
		const getReferenceGasPrice = jest
			.fn()
			.mockResolvedValue({ referenceGasPrice: "12" });
		const helper = new TransactionsApiHelpers(
			makeApi({ simulateTransaction, getReferenceGasPrice })
		);

		await expect(helper.fetchSetGasBudgetForTx({ tx })).resolves.toBe(tx);
		expect(build).toHaveBeenCalledWith({ client: expect.anything() });
		expect(simulateTransaction).toHaveBeenCalledWith({
			transaction: new Uint8Array([1, 2]),
			include: { effects: true },
		});
		expect(setGasBudget).toHaveBeenCalledWith(82n);
		expect(setGasPrice).toHaveBeenCalledWith(12n);
	});

	it("serializes sponsored transactions without simulating them and simulates non-sponsored ones", async () => {
		const sponsored = {
			toJSON: jest.fn().mockReturnValue("sponsored-json"),
		} as unknown as Transaction;
		const api = makeApi({});
		const helper = new TransactionsApiHelpers(api);
		await expect(
			helper.fetchSetGasBudgetAndSerializeTx({
				tx: Promise.resolve(sponsored),
				isSponsoredTx: true,
			})
		).resolves.toBe("sponsored-json");

		const adjusted = {
			toJSON: jest.fn().mockReturnValue("adjusted-json"),
		} as unknown as Transaction;
		const adjust = jest
			.spyOn(helper, "fetchSetGasBudgetForTx")
			.mockResolvedValue(adjusted);
		const original = { toJSON: jest.fn() } as unknown as Transaction;
		await expect(
			helper.fetchSetGasBudgetAndSerializeTx({ tx: Promise.resolve(original) })
		).resolves.toBe("adjusted-json");
		expect(adjust).toHaveBeenCalledWith({ tx: original });
		expect(original.toJSON).not.toHaveBeenCalled();
	});

	it("returns an optional base64 transaction kind and asks the transaction for kind-only bytes", async () => {
		const build = jest.fn().mockResolvedValue(new Uint8Array([0, 255, 65]));
		const tx = { build } as unknown as Transaction;
		const client = { clientMarker: true };
		const helper = new TransactionsApiHelpers(makeApi(client));

		await expect(helper.fetchBase64TxKindFromTx({ tx })).resolves.toBe("AP9B");
		await expect(
			helper.fetchBase64TxKindFromTx({ tx: undefined })
		).resolves.toBeUndefined();
		expect(build).toHaveBeenCalledWith({ client, onlyTransactionKind: true });
	});

	it("creates transaction targets and builders with the supplied wallet sender", () => {
		expect(
			TransactionsApiHelpers.createTxTarget("0xpackage", "module", "entry")
		).toBe("0xpackage::module::entry");

		let received: { walletAddress: string; value: number } | undefined;
		const builder = TransactionsApiHelpers.createBuildTxFunc(
			(inputs: { tx: Transaction; walletAddress: string; value: number }) => {
				received = inputs;
				return inputs.tx.pure.u64(inputs.value);
			}
		);
		const tx = builder({ walletAddress: OWNER, value: 7 });

		expect(received?.walletAddress).toBe(OWNER);
		expect(received?.value).toBe(7);
		expect(tx.getData().sender).toBe(OWNER);
	});

	it("builds the split-coin call with an object argument and u64 amount", () => {
		const moveCall = jest.fn().mockReturnValue("split-result");
		const object = jest.fn().mockReturnValue("coin-argument");
		const pure = { u64: jest.fn().mockReturnValue("amount-argument") };
		const tx = { moveCall, object, pure } as unknown as Transaction;

		expect(
			TransactionsApiHelpers.splitCoinTx({
				tx,
				coinType: "0x2::sui::SUI",
				coinId: OBJECT_1,
				amount: 123n,
			})
		).toBe("split-result");
		expect(object).toHaveBeenCalledWith(OBJECT_1);
		expect(pure.u64).toHaveBeenCalledWith(123n);
		expect(moveCall).toHaveBeenCalledWith({
			target: "0x2::coin::split",
			typeArguments: ["0x2::sui::SUI"],
			arguments: ["coin-argument", "amount-argument"],
		});
	});

	it("converts service coin data across input, result, nested-result, gas, and object-id forms", () => {
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: "0x2::sui::SUI",
			})
		).toEqual({
			Coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
		});
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { Input: 3 },
			})
		).toEqual({ Input: 3 });
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "NestedResult", NestedResult: [2, 1] },
			} as never)
		).toEqual({ NestedResult: [2, 1] });
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "Result", Result: 4 },
			} as never)
		).toEqual({ Result: 4 });
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "GasCoin", GasCoin: true } as never,
			})
		).toThrow("unable to convert gas coin arg to service coin data");
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { GasCoin: true } as never,
			})
		).toThrow("unable to convert gas coin arg to service coin data");
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "Unexpected" } as never,
			})
		).toThrow("unexpected coinTxArg.$kind: Unexpected");

		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { GasCoin: true },
			} as never)
		).toBe("Gas");
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "Input", Input: 5 },
			} as never)
		).toEqual({ Input: 5 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { Result: 6 },
			} as never)
		).toEqual({ Result: 6 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { NestedResult: [4, 2] },
			} as never)
		).toEqual({ NestedResult: [4, 2] });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { Input: 8 },
			} as never)
		).toEqual({ Input: 8 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "Result", Result: 9 },
			} as never)
		).toEqual({ Result: 9 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "NestedResult", NestedResult: [5, 1] },
			} as never)
		).toEqual({ NestedResult: [5, 1] });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "GasCoin", GasCoin: true },
			} as never)
		).toBe("Gas");
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { Unsupported: true } as never,
			})
		).toThrow("coinTxArg in format [object Object] not supported");

		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { Input: 5 },
			})
		).toEqual({ Input: 5 });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { NestedResult: [2, 1] },
			})
		).toEqual({ NestedResult: [2, 1] });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { Result: 6 },
			})
		).toEqual({ Result: 6 });
		expect(() =>
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { Coin: OBJECT_1 },
			})
		).toThrow("serviceCoinData in format { Coin: ObjectId } not supported");

		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: "Gas",
			})
		).toEqual({ GasCoin: true });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { Result: 2 },
			})
		).toEqual({ Result: 2 });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { NestedResult: [3, 0] },
			})
		).toEqual({ NestedResult: [3, 0] });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { Input: 4 },
			})
		).toEqual({ Input: 4 });
		expect(() =>
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { Result: [3, 0] } as never,
			})
		).toThrow('serviceCoinDataV2 format {"Result":[3,0]} not supported');
	});

	it("transfers transaction metadata while preserving valid bigint gas values", () => {
		const initTx = {
			getData: jest.fn().mockReturnValue({
				sender: OWNER,
				expiration: { Epoch: 9 },
				gasData: {
					budget: 101n,
					owner: "0xgas-owner",
					payment: [{ objectId: OBJECT_1 }],
					price: 3n,
				},
			}),
		} as unknown as Transaction;
		const newTx = {
			setSender: jest.fn(),
			setExpiration: jest.fn(),
			setGasBudget: jest.fn(),
			setGasOwner: jest.fn(),
			setGasPayment: jest.fn(),
			setGasPrice: jest.fn(),
		} as unknown as Transaction;

		TransactionsApiHelpers.transferTxMetadata({ initTx, newTx });
		expect(newTx.setSender).toHaveBeenCalledWith(OWNER);
		expect(newTx.setExpiration).toHaveBeenCalledWith({ Epoch: 9 });
		expect(newTx.setGasBudget).toHaveBeenCalledWith(101n);
		expect(newTx.setGasOwner).toHaveBeenCalledWith("0xgas-owner");
		expect(newTx.setGasPayment).toHaveBeenCalledWith([{ objectId: OBJECT_1 }]);
		expect(newTx.setGasPrice).toHaveBeenCalledWith(3n);
	});
});
