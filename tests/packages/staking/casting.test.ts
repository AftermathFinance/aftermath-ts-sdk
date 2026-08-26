import {
	Casting,
	eventMeta,
	eventV1,
	FULL_1,
	FULL_2,
	FULL_3,
	FULL_4,
	FULL_5,
	FULL_6,
	FULL_9,
	objectView,
} from "@test/packages/staking/fixtures.js";

describe("staking casters", () => {
	it("casts staking objects with exact bigint and nested protocol values", () => {
		const validator =
			Casting.staking.validatorOperationCapObjectFromSuiObjectResponse(
				objectView("0x9::validator::Cap", {
					authorizer_validator_address: "0x2",
				})
			);
		expect(validator).toEqual({
			objectId: FULL_1,
			objectType: `${FULL_9}::validator::Cap`,
			authorizerValidatorAddress: FULL_2,
		});

		const state =
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				objectView("0x9::staked_sui_vault::State", {
					active_epoch: "9007199254740993",
					atomic_unstake_sui_reserves: "3000",
					total_rewards_amount: "4000",
					total_sui_amount: "5000",
					protocol_config: {
						atomic_unstake_sui_reserves_target_value: "1000",
						atomic_unstake_protocol_fee: {
							min_fee: "1000000000000000",
							max_fee: "10000000000000000",
						},
					},
				})
			);

		expect(state).toEqual({
			objectId: FULL_1,
			objectType: `${FULL_9}::staked_sui_vault::State`,
			atomicUnstakeSuiReservesTargetValue: 1_000n,
			atomicUnstakeSuiReserves: 3_000n,
			minAtomicUnstakeFee: 1_000_000_000_000_000n,
			maxAtomicUnstakeFee: 10_000_000_000_000_000n,
			totalSuiAmount: 5_000n,
			totalRewardsAmount: 4_000n,
			activeEpoch: 9_007_199_254_740_993n,
		});

		const jsonRpcShaped = objectView("0x9::staked_sui_vault::State", {
			active_epoch: "7",
			atomic_unstake_sui_reserves: "8",
			total_rewards_amount: "9",
			total_sui_amount: "10",
			protocol_config: {
				type: "0x9::config::ProtocolConfig",
				fields: {
					atomic_unstake_sui_reserves_target_value: "11",
					atomic_unstake_protocol_fee: {
						type: "0x9::config::AtomicFee",
						fields: { min_fee: "12", max_fee: "13" },
					},
				},
			},
		});
		expect(
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				jsonRpcShaped
			)
		).toEqual({
			objectId: FULL_1,
			objectType: `${FULL_9}::staked_sui_vault::State`,
			atomicUnstakeSuiReservesTargetValue: 11n,
			atomicUnstakeSuiReserves: 8n,
			minAtomicUnstakeFee: 12n,
			maxAtomicUnstakeFee: 13n,
			totalSuiAmount: 10n,
			totalRewardsAmount: 9n,
			activeEpoch: 7n,
		});

		expect(() =>
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				objectView("0x9::staked_sui_vault::State", {
					active_epoch: "not-a-number",
					atomic_unstake_sui_reserves: "0",
					total_rewards_amount: "0",
					total_sui_amount: "0",
					protocol_config: {
						atomic_unstake_sui_reserves_target_value: "0",
						atomic_unstake_protocol_fee: { min_fee: "0", max_fee: "0" },
					},
				})
			)
		).toThrow();
	});

	it("casts staking events, including nullable referrers and requested optional fields", () => {
		const staked = Casting.staking.stakedEventFromOnChain(
			eventV1({
				sui_id: "0x2",
				staked_sui_id: "0x3",
				staker: "0x1",
				validator: "0x4",
				epoch: "17",
				sui_amount: "9007199254740993",
				validator_fee: "25000000000000000",
				is_restaked: true,
				referrer: null,
				afsui_id: "0x5",
				afsui_amount: "9007199254740995",
			}) as never
		);
		expect(staked).toEqual({
			suiId: FULL_2,
			stakedSuiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: 17n,
			suiStakeAmount: 9_007_199_254_740_993n,
			validatorFee: 0.025,
			isRestaked: true,
			referrer: undefined,
			afSuiId: FULL_5,
			afSuiAmount: 9_007_199_254_740_995n,
			...eventMeta,
		});

		const unstakeRequested = Casting.staking.unstakeRequestedEventFromOnChain(
			eventV1({
				afsui_id: "0x6",
				provided_afsui_amount: "21",
				requester: "0x1",
				epoch: "22",
			}) as never
		);
		expect(unstakeRequested).toEqual({
			afSuiId: FULL_6,
			providedAfSuiAmount: 21n,
			requester: FULL_1,
			epoch: 22n,
			...eventMeta,
		});
		expect("suiId" in unstakeRequested).toBe(false);

		const unstaked = Casting.staking.unstakedEventFromOnChain(
			eventV1({
				afsui_id: "0x6",
				sui_id: "0x7",
				requester: "0x1",
				epoch: "23",
				provided_afsui_amount: "24",
				returned_sui_amount: "25",
			}) as never
		);
		expect(unstaked).toEqual({
			afSuiId: FULL_6,
			suiId:
				"0x0000000000000000000000000000000000000000000000000000000000000007",
			requester: FULL_1,
			epoch: 23n,
			providedAfSuiAmount: 24n,
			returnedSuiAmount: 25n,
			...eventMeta,
		});
	});
});
