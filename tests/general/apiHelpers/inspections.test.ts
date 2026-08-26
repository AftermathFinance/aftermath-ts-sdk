import {
	InspectionsApiHelpers,
	jest,
	makeApi,
	OWNER,
	TransactionClass,
} from "@test/general/fixtures/services.js";

describe("InspectionsApiHelpers", () => {
	function successfulSimulation() {
		return {
			$kind: "Transaction",
			Transaction: {
				effects: { gasUsed: { computationCost: "7", storageCost: "3" } },
				events: [{ event: "event-1" }],
				status: { success: true },
			},
			commandResults: [
				{ returnValues: [{ bcs: new Uint8Array([1, 2]) }] },
				{
					returnValues: [
						{ bcs: new Uint8Array([3]) },
						{ bcs: new Uint8Array([]) },
					],
				},
			],
		};
	}

	it("simulates a cloned transaction with the default inspect signer and returns every command's BCS bytes", async () => {
		const simulateTransaction = jest
			.fn()
			.mockResolvedValue(successfulSimulation());
		const tx = new TransactionClass();
		const api = makeApi({ simulateTransaction });

		await expect(
			new InspectionsApiHelpers(api).fetchAllBytesFromTx({ tx })
		).resolves.toEqual({
			events: [{ event: "event-1" }],
			effects: { gasUsed: { computationCost: "7", storageCost: "3" } },
			allBytes: [[[1, 2]], [[3], []]],
		});
		expect(simulateTransaction).toHaveBeenCalledWith({
			transaction: expect.any(TransactionClass),
			include: { effects: true, events: true, commandResults: true },
			checksEnabled: false,
		});
		expect(
			simulateTransaction.mock.calls[0]?.[0].transaction.getData().sender
		).toBe(InspectionsApiHelpers.constants.devInspectSigner);
		expect(tx.getData().sender).toBeNull();
	});

	it("uses an explicit sender and exposes first/last command output wrappers", async () => {
		const simulateTransaction = jest
			.fn()
			.mockResolvedValue(successfulSimulation());
		const helper = new InspectionsApiHelpers(makeApi({ simulateTransaction }));
		const tx = new TransactionClass();

		await expect(
			helper.fetchFirstBytesFromTxOutput({ tx, sender: OWNER })
		).resolves.toEqual([3]);
		await expect(
			helper.fetchAllBytesFromTxOutput({ tx, sender: OWNER })
		).resolves.toEqual([[3], []]);
		expect(
			simulateTransaction.mock.calls[0]?.[0].transaction.getData().sender
		).toBe(OWNER);
	});

	it("surfaces failed simulation status and missing command results", async () => {
		const failed = {
			$kind: "FailedTransaction",
			FailedTransaction: {
				effects: { gasUsed: { computationCost: "1", storageCost: "0" } },
				events: [],
				status: { success: false, error: { message: "Move abort" } },
			},
			commandResults: [],
		};
		const failedHelper = new InspectionsApiHelpers(
			makeApi({ simulateTransaction: jest.fn().mockResolvedValue(failed) })
		);
		await expect(
			failedHelper.fetchAllBytesFromTx({ tx: new TransactionClass() })
		).rejects.toThrow("Move abort");

		const noResults = {
			$kind: "Transaction",
			Transaction: { effects: {}, events: [], status: { success: true } },
		};
		const noResultsHelper = new InspectionsApiHelpers(
			makeApi({ simulateTransaction: jest.fn().mockResolvedValue(noResults) })
		);
		await expect(
			noResultsHelper.fetchAllBytesFromTx({ tx: new TransactionClass() })
		).rejects.toThrow("dev inspect move call returned no results");
	});
});
