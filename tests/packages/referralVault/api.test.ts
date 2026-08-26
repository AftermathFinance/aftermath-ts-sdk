import {
	bcs,
	COIN_A,
	COIN_B,
	describe,
	expect,
	fakeApi,
	it,
	jest,
	moveCallData,
	PACKAGE,
	REFERRER,
	ReferralVaultApi,
	referralApi,
	Transaction,
	transactionCommands,
	WALLET,
} from "@test/packages/referralVault/fixtures.js";

describe("ReferralVault API transaction and inspection seams", () => {
	it("requires referral-vault addresses", () => {
		expect(() => new ReferralVaultApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
	});

	it("builds update_referrer_address and skips self-referrals", () => {
		const api = referralApi();
		const tx = new Transaction();
		const result = api.updateReferrerTx({ tx, referrer: REFERRER });

		expect(result).toBeDefined();
		expect(moveCallData(tx)).toMatchObject({
			package: PACKAGE,
			module: "referral_vault",
			function: "update_referrer_address",
			typeArguments: [],
		});

		const selfTx = new Transaction();
		selfTx.setSender(WALLET);
		expect(
			api.updateReferrerTx({ tx: selfTx, referrer: WALLET })
		).toBeUndefined();
		expect(transactionCommands(selfTx)).toHaveLength(0);
	});

	it("swallows invalid referrer input without partially building a command", () => {
		const tx = new Transaction();
		expect(() =>
			referralApi().updateReferrerTx({ tx, referrer: "not-an-address" })
		).not.toThrow();
		expect(transactionCommands(tx)).toHaveLength(0);
	});

	it.each([
		["withdraw_rebate", false],
		["withdraw_and_transfer", true],
	])("builds %s with the coin type and vault object", (fn, withTransfer) => {
		const tx = new Transaction();
		referralApi().withdrawRebateTx({
			tx,
			coinType: COIN_B,
			withTransfer,
		});
		expect(moveCallData(tx)).toMatchObject({
			package: PACKAGE,
			module: "referral_vault",
			function: fn,
			typeArguments: [COIN_B],
		});
	});

	it("builds rebate balance, referrer, and has-referrer inspection calls", () => {
		const api = referralApi();
		const balanceTx = new Transaction();
		api.balanceOfRebateTx({
			tx: balanceTx,
			coinType: COIN_A,
			referrer: REFERRER,
		});
		expect(moveCallData(balanceTx)).toMatchObject({
			function: "balance_of",
			typeArguments: [COIN_A],
		});

		const referrerTx = new Transaction();
		api.referrerForTx({ tx: referrerTx, referee: WALLET });
		expect(moveCallData(referrerTx)).toMatchObject({
			function: "referrer_for",
			typeArguments: [],
		});

		const hasReferrerTx = new Transaction();
		api.hasReffererTx({ tx: hasReferrerTx, referee: WALLET });
		expect(moveCallData(hasReferrerTx)).toMatchObject({
			function: "has_referrer",
			typeArguments: [],
		});
	});

	it("casts inspected little-endian rebate bytes to bigint", async () => {
		const fetchFirstBytesFromTxOutput = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(Uint8Array.from([0x15, 0xcd, 0x5b, 0x07]))
		);
		const api = referralApi({ inspections: { fetchFirstBytesFromTxOutput } });

		await expect(
			api.fetchBalanceOfRebate({ coinType: COIN_A, referrer: REFERRER })
		).resolves.toBe(123_456_789n);
		expect(fetchFirstBytesFromTxOutput).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
		});
	});

	it("maps BCS option Some and None referrers", async () => {
		const someBytes = bcs.option(bcs.Address).serialize(REFERRER).toBytes();
		const someInspection = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(someBytes)
		);
		await expect(
			referralApi({
				inspections: {
					fetchFirstBytesFromTxOutput: someInspection,
				},
			}).fetchReferrer({ referee: WALLET })
		).resolves.toBe(REFERRER);

		const noneBytes = bcs.option(bcs.Address).serialize(null).toBytes();
		await expect(
			referralApi({
				inspections: {
					fetchFirstBytesFromTxOutput: async () => noneBytes,
				},
			}).fetchReferrer({ referee: WALLET })
		).resolves.toBeUndefined();
	});
});
