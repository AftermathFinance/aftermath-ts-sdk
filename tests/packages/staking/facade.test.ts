import {
	type AftermathApi,
	FULL_1,
	FULL_2,
	FULL_4,
	jest,
	Staking,
} from "@test/packages/staking/fixtures.js";

describe("high-level staking and farms transaction facades", () => {
	it("delegates staking transaction methods and preserves the provider error", async () => {
		const provider = {
			fetchBuildStakeTx: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("stake-tx"),
			fetchBuildUnstakeTx: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("unstake-tx"),
			fetchBuildStakeStakedSuiTx: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("restake-tx"),
			buildUpdateValidatorFeeTx: jest
				.fn<() => string>()
				.mockReturnValue("fee-tx"),
			buildEpochWasChangedTx: jest
				.fn<() => string>()
				.mockReturnValue("crank-tx"),
		};
		const api = {
			Staking: jest.fn(() => provider),
		} as unknown as AftermathApi;
		const staking = new Staking({}, api);
		const stakeInputs = {
			walletAddress: FULL_1,
			suiStakeAmount: 1n,
			validatorAddress: FULL_4,
		};

		expect(await staking.getStakeTransaction(stakeInputs)).toBe("stake-tx");
		expect(
			await staking.getUnstakeTransaction({
				walletAddress: FULL_1,
				afSuiUnstakeAmount: 2n,
				isAtomic: false,
			})
		).toBe("unstake-tx");
		expect(
			await staking.getStakeStakedSuiTransaction({
				walletAddress: FULL_1,
				stakedSuiIds: [FULL_2],
				validatorAddress: FULL_4,
			})
		).toBe("restake-tx");
		expect(
			staking.getUpdateValidatorFeeTransaction({
				walletAddress: FULL_1,
				validatorOperationCapId: FULL_2,
				newFeePercentage: 0.01,
			})
		).toBe("fee-tx");
		expect(staking.getCrankAfSuiTransaction({ walletAddress: FULL_1 })).toBe(
			"crank-tx"
		);
		expect(provider.fetchBuildStakeTx).toHaveBeenCalledWith(stakeInputs);

		await expect(
			new Staking().getStakeTransaction(stakeInputs)
		).rejects.toThrow("missing AftermathApi instance");
	});
});
