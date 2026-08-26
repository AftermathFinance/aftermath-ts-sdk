import {
	ACCESSORY_TYPE,
	describe,
	expect,
	FULL_ELEVEN,
	FULL_NINE,
	FULL_ONE,
	FULL_TEN,
	FULL_TWELVE,
	fullType,
	it,
	makeEvent,
	OBJECT_ONE,
	OBJECT_THREE,
	OBJECT_TWO,
	objectView,
	SUI_FREN_TYPE,
	SuiFrensApiCasting,
	WALLET,
} from "@test/packages/suiFrens/fixtures.js";

describe("SuiFrensApiCasting", () => {
	it("casts CapyLabs app fields and preserves bigint precision", () => {
		const result = SuiFrensApiCasting.capyLabsAppObjectFromSuiObjectResponse(
			objectView({
				type: "0x21::capy_labs::CapyLabsApp",
				json: {
					mixing_limit: "255",
					cool_down_period: "12",
					mixing_price: "9000000000",
					profits: "123456789012345678901234567890",
				},
			})
		);

		expect(result).toEqual({
			objectType: fullType("0x21::capy_labs::CapyLabsApp"),
			objectId: FULL_TEN,
			mixingLimit: 255n,
			coolDownPeriodEpochs: 12n,
			mixingPrice: 9000000000n,
			suiProfits: 123456789012345678901234567890n,
		});
	});

	it("casts a complete SuiFren from gRPC fields and display output", () => {
		const result = SuiFrensApiCasting.partialSuiFrenObjectFromSuiObjectResponse(
			objectView({
				json: {
					generation: "2",
					birthdate: "1579096800000",
					cohort: "4",
					genes: ["1", "9007199254740993"],
					attributes: ["stripes", "6FBBEE", "CF9696", "bigSmile", "ear1"],
					birth_location: "Capy City",
				},
				display: {
					output: {
						link: "https://example.test/link",
						image_url: "https://example.test/image.png",
						description: "description",
						project_url: "https://example.test",
					},
					errors: null,
				},
			})
		);

		expect(result).toEqual({
			objectType: `${FULL_NINE}::suifrens::SuiFren<2::sui::SUI>`,
			objectId: FULL_TEN,
			generation: 2n,
			birthdate: 1_579_096_800_000,
			cohort: 4n,
			genes: [1n, 9007199254740993n],
			attributes: {
				skin: "stripes",
				main: "6FBBEE",
				secondary: "CF9696",
				expression: "bigSmile",
				ears: "ear1",
			},
			birthLocation: "Capy City",
			display: {
				link: "https://example.test/link",
				imageUrl: "https://example.test/image.png",
				description: "description",
				projectUrl: "https://example.test",
			},
		});
	});

	it("casts metadata, including the testnet image rewrite used by staked objects", () => {
		const input = objectView({
			objectId: "0x40",
			json: {
				suifren_id: OBJECT_ONE,
				suifren_type: SUI_FREN_TYPE,
				collected_fees: "700",
				auto_stake_fees: true,
				mix_fee: "300000000",
				fee_increment_per_mix: "10000000",
				min_remaining_mixes_to_keep: "2",
				last_epoch_mixed: "8",
				generation: "2",
				birthdate: "1579096800000",
				cohort: "4",
				genes: ["1"],
				birth_location: "Capy City",
				attributes: ["stripes", "6FBBEE", "CF9696", "bigSmile", "ear1"],
			},
			display: {
				output: {
					link: "link",
					image_url: "https://mainnet.example/image.png",
					description: "description",
					project_url: "project",
				},
				errors: null,
			},
		});

		expect(
			SuiFrensApiCasting.stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse(
				input
			)
		).toEqual({
			objectType: `${FULL_NINE}::suifrens::SuiFren<2::sui::SUI>`,
			objectId: `0x${"40".padStart(64, "0")}`,
			suiFrenId: FULL_TEN,
			collectedFees: 700n,
			autoStakeFees: true,
			mixFee: 300000000n,
			feeIncrementPerMix: 10000000n,
			minRemainingMixesToKeep: 2n,
		});

		expect(
			SuiFrensApiCasting.partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse(
				input
			).display.imageUrl
		).toBe("https://testnet.example/image.png");
	});

	it("casts combined metadata, position, vault state, and accessory objects", () => {
		const metadataView = objectView({
			json: {
				suifren_id: OBJECT_ONE,
				suifren_type: SUI_FREN_TYPE,
				collected_fees: "1",
				auto_stake_fees: false,
				mix_fee: "2",
				fee_increment_per_mix: "3",
				min_remaining_mixes_to_keep: "4",
				generation: "5",
				birthdate: "6",
				cohort: "7",
				genes: ["8"],
				birth_location: "9",
				attributes: ["cheetah", "6FBBEE", "CF9696", "bigSmile", "ear1"],
			},
			display: {
				output: {
					link: "link",
					image_url: "https://mainnet.example/image.png",
					description: "description",
					project_url: "project",
				},
				errors: null,
			},
		});
		const combined =
			SuiFrensApiCasting.partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse(
				metadataView
			);

		expect(combined.stakedSuiFrenMetadata.suiFrenId).toBe(FULL_TEN);
		expect(combined.partialSuiFren.objectId).toBe(FULL_TEN);
		expect(combined.partialSuiFren.attributes.skin).toBe("cheetah");

		expect(
			SuiFrensApiCasting.stakedSuiFrenPositionFromSuiObjectResponse(
				objectView({
					objectId: "0x41",
					json: { suifren_id: OBJECT_TWO },
				})
			)
		).toEqual({
			objectType: `${FULL_NINE}::suifrens::SuiFren<2::sui::SUI>`,
			objectId: `0x${"41".padStart(64, "0")}`,
			suiFrenId: FULL_ELEVEN,
		});

		expect(
			SuiFrensApiCasting.suiFrenVaultStateV1ObjectFromSuiObjectResponse(
				objectView({
					objectId: "0x42",
					type: "0x11::vault_state::VaultState",
					json: {
						suifrens_metadata: { fields: { size: "19" } },
						mixed: "27",
					},
				})
			)
		).toEqual({
			objectType: `${FULL_ELEVEN}::vault_state::VaultState`,
			objectId: `0x${"42".padStart(64, "0")}`,
			stakedSuiFrens: 19n,
			totalMixes: 27n,
		});

		expect(
			SuiFrensApiCasting.accessoryObjectFromSuiObjectResponse(
				objectView({
					objectId: "0x43",
					type: "0x10::accessories::Accessory",
					json: { name: "Top Hat", type: ACCESSORY_TYPE },
					display: { output: { image_url: "https://example.test/hat.png" } },
				})
			)
		).toEqual({
			objectType: `${fullType("0x10::accessories::Accessory")}`,
			objectId: `0x${"43".padStart(64, "0")}`,
			name: "Top Hat",
			type: ACCESSORY_TYPE,
			imageUrl: "https://example.test/hat.png",
		});
	});

	it("casts every SuiFren event with padded ids and bigint fees", () => {
		const base = makeEvent({
			issuer: WALLET,
			suifren_id: OBJECT_ONE,
			parent_one_id: OBJECT_TWO,
			parent_two_id: OBJECT_THREE,
			fee: "12345678901234567890",
			fees: "98765432109876543210",
		});

		expect(
			SuiFrensApiCasting.harvestSuiFrenFeesEventFromOnChain(base as never)
		).toEqual({
			harvester: FULL_ONE,
			fees: 98765432109876543210n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
		expect(
			SuiFrensApiCasting.mixSuiFrensEventFromOnChain(base as never)
		).toEqual({
			mixer: FULL_ONE,
			parentOneId: FULL_ELEVEN,
			parentTwoId: FULL_TWELVE,
			childId: FULL_TEN,
			fee: 12345678901234567890n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
		expect(
			SuiFrensApiCasting.stakeSuiFrenEventFromOnChain(base as never)
		).toEqual({
			staker: FULL_ONE,
			suiFrenId: `0x${"10".padStart(64, "0")}`,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
		expect(
			SuiFrensApiCasting.unstakeSuiFrenEventFromOnChain(base as never)
		).toEqual({
			unstaker: FULL_ONE,
			suiFrenId: `0x${"10".padStart(64, "0")}`,
			fees: 98765432109876543210n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-event",
			type: base.type,
		});
	});
});
