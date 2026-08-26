import {
	type ApiAddSuiFrenAccessoryBody,
	type ApiMixSuiFrensBody,
	bcs,
	commands,
	describe,
	expect,
	FULL_ELEVEN,
	FULL_ONE,
	FULL_TWO,
	fakeApi,
	fullType,
	it,
	type JsonRecord,
	jest,
	makeStakedInfo,
	makeSuiFren,
	moveCall,
	OBJECT_ONE,
	OBJECT_THREE,
	OBJECT_TWO,
	OTHER_WALLET,
	PAYMENT_COIN,
	protocolApi,
	SUI_FREN_TYPE,
	SuiFrens,
	SuiFrensApi,
	Transaction,
	WALLET,
} from "@test/packages/suiFrens/fixtures.js";

describe("SuiFrensApi", () => {
	it("constructs object and event type metadata and rejects incomplete addresses", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);

		expect(suifrensApi.objectTypes).toEqual({
			suiFren: "0x9::suifrens::SuiFren",
			capy: "0x9::capy::Capy",
			bullshark: "0x8::bullshark::Bullshark",
			suiFrenAccessory: "0x10::accessories::Accessory",
			stakedSuiFrenPosition: "0x11::staked_position::StakedPosition",
			stakedSuiFrenMetadataV1: "0x11::vault_state::StakedSuiFrenMetadataV1",
		});
		expect(suifrensApi.eventTypes).toEqual({
			harvestSuiFrenFees: "0x11::events::HarvestedFeesEvent",
			mixSuiFrens: "0x11::events::MixedSuiFrenEvent",
			stakeSuiFren: "0x11::events::StakedSuiFrenEvent",
			unstakeSuiFren: "0x11::events::UnstakedSuiFrenEvent",
		});
		expect(() => new SuiFrensApi(fakeApi({ addresses: {} }))).toThrow(
			"not all required addresses have been set in provider"
		);
	});

	it("routes event queries with the correct Move event type and preserves pagination", async () => {
		const { api, events } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const inputs = {
			cursor: { txDigest: "cursor-digest", eventSeq: "3" },
			limit: 4,
		};

		await suifrensApi.fetchHarvestSuiFrenFeesEvents(inputs);
		await suifrensApi.fetchMixSuiFrensEvents(inputs);
		await suifrensApi.fetchStakeSuiFrenEvents(inputs);
		await suifrensApi.fetchUnstakeSuiFrenEvents(inputs);

		expect(events.fetchCastEventsWithCursor).toHaveBeenCalledTimes(4);
		expect(
			events.fetchCastEventsWithCursor.mock.calls.map(
				(call: unknown[]) => call[0] as JsonRecord
			)
		).toEqual([
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.harvestSuiFrenFees },
			}),
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.mixSuiFrens },
			}),
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.stakeSuiFren },
			}),
			expect.objectContaining({
				...inputs,
				query: { MoveEventType: suifrensApi.eventTypes.unstakeSuiFren },
			}),
		]);
	});

	it("routes object and accessory reads with exact ids, types, and display requirements", async () => {
		const { api, objects, dynamicFields } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		objects.fetchCastObject.mockResolvedValue({ objectId: "capy" });
		objects.fetchCastObjectBatch.mockResolvedValue([]);
		objects.fetchCastObjectsOwnedByAddressOfType.mockResolvedValue([]);
		dynamicFields.fetchCastAllDynamicFieldsOfType.mockResolvedValue([]);

		await suifrensApi.fetchCapyLabsApp();
		await suifrensApi.fetchSuiFrenVaultStateV1Object();
		await suifrensApi.fetchSuiFrens({ suiFrenIds: [OBJECT_ONE, OBJECT_TWO] });
		await suifrensApi.fetchAccessories({ objectIds: [OBJECT_THREE] });
		await suifrensApi.fetchOwnedAccessories({ walletAddress: WALLET });
		await suifrensApi.fetchAccessoriesForSuiFren({ suiFrenId: OBJECT_ONE });

		expect(objects.fetchCastObject.mock.calls[0]?.[0]).toEqual({
			objectId: "0x21",
			objectFromSuiObjectResponse: expect.any(Function),
		});
		expect(objects.fetchCastObject.mock.calls[1]?.[0]).toEqual({
			objectId: "0x23",
			objectFromSuiObjectResponse: expect.any(Function),
		});
		expect(objects.fetchCastObjectBatch.mock.calls[0]?.[0]).toEqual({
			objectIds: [OBJECT_ONE, OBJECT_TWO],
			objectFromSuiObjectResponse: expect.any(Function),
			withDisplay: true,
		});
		expect(objects.fetchCastObjectBatch.mock.calls[1]?.[0]).toEqual({
			objectIds: [OBJECT_THREE],
			objectFromSuiObjectResponse: expect.any(Function),
			withDisplay: true,
		});
		expect(
			objects.fetchCastObjectsOwnedByAddressOfType.mock.calls[0]?.[0]
		).toEqual({
			walletAddress: WALLET,
			objectType: suifrensApi.objectTypes.suiFrenAccessory,
			objectFromSuiObjectResponse: expect.any(Function),
			withDisplay: true,
		});
		expect(
			dynamicFields.fetchCastAllDynamicFieldsOfType.mock.calls[0]?.[0]
		).toEqual(
			expect.objectContaining({
				parentObjectId: OBJECT_ONE,
				dynamicFieldType: suifrensApi.objectTypes.suiFrenAccessory,
			})
		);
	});

	it("decodes inspection output, including optional values and bullshark short-circuits", async () => {
		const { api, inspections } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		inspections.fetchFirstBytesFromTxOutput
			.mockResolvedValueOnce(bcs.option(bcs.u8()).serialize(7).toBytes())
			.mockResolvedValueOnce(
				bcs.option(bcs.u64()).serialize(9007199254740993n).toBytes()
			)
			.mockResolvedValueOnce(
				bcs.vector(bcs.Address).serialize([FULL_ONE, FULL_TWO]).toBytes()
			);

		expect(
			await suifrensApi.fetchMixingLimit({
				suiFrenId: OBJECT_ONE,
				suiFrenType: SUI_FREN_TYPE,
			})
		).toBe(7n);
		expect(
			await suifrensApi.fetchLastEpochMixed({
				suiFrenId: OBJECT_ONE,
				suiFrenType: SUI_FREN_TYPE,
			})
		).toBe(9007199254740993n);
		expect(
			await suifrensApi.fetchStakedSuiFrenMetadataIds({
				suiFrenIds: [OBJECT_ONE, OBJECT_TWO],
			})
		).toEqual([FULL_ONE, FULL_TWO]);
		expect(
			await suifrensApi.fetchMixingLimit({
				suiFrenId: OBJECT_ONE,
				suiFrenType: suifrensApi.objectTypes.bullshark,
			})
		).toBeUndefined();
		expect(inspections.fetchFirstBytesFromTxOutput).toHaveBeenCalledTimes(3);
	});

	it("decodes aligned vectors from the multi-object inspection", async () => {
		const { api, inspections } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		inspections.fetchAllBytesFromTxOutput.mockResolvedValue([
			bcs.vector(bcs.option(bcs.u8())).serialize([7, null]).toBytes(),
			bcs.vector(bcs.option(bcs.u64())).serialize([99n, 100n]).toBytes(),
		]);

		expect(
			await suifrensApi.fetchMixingLimitsAndLastEpochMixeds({
				suiFrenIds: [OBJECT_ONE, OBJECT_TWO],
				suiFrenType: SUI_FREN_TYPE,
			})
		).toEqual([
			{ mixLimit: 7n, lastEpochMixed: 99n },
			{ mixLimit: undefined, lastEpochMixed: 100n },
		]);
	});

	it("completes a partial SuiFren through per-object inspection calls", async () => {
		const { api, objects, inspections } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		objects.fetchCastObjectBatch.mockResolvedValue([
			makeSuiFren({ objectId: OBJECT_ONE }),
		]);
		inspections.fetchFirstBytesFromTxOutput
			.mockResolvedValueOnce(bcs.option(bcs.u8()).serialize(4).toBytes())
			.mockResolvedValueOnce(bcs.option(bcs.u64()).serialize(99n).toBytes());

		const result = await suifrensApi.fetchSuiFrens({
			suiFrenIds: [OBJECT_ONE],
		});

		expect(result.map((item) => [item.objectId, item.mixLimit])).toEqual([
			[OBJECT_ONE, 4n],
		]);
		expect(result[0]?.lastEpochMixed).toBe(99n);
		expect(inspections.fetchFirstBytesFromTxOutput).toHaveBeenCalledTimes(2);
	});

	it("filters staked dynamic fields case-insensitively and advances the cursor after the limit", async () => {
		const { api, dynamicFields } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const infos = [
			makeStakedInfo({
				suiFren: makeSuiFren({ objectId: OBJECT_ONE }),
			}),
			makeStakedInfo({
				suiFren: makeSuiFren({
					objectId: OBJECT_TWO,
					attributes: { ...makeSuiFren().attributes, skin: "cheetah" },
				}),
			}),
			makeStakedInfo({
				suiFren: makeSuiFren({ objectId: OBJECT_THREE }),
			}),
		];
		dynamicFields.fetchDynamicFieldsUntil.mockResolvedValue({
			dynamicFieldObjects: infos,
			nextCursor: "server-cursor",
		});

		const result =
			await suifrensApi.fetchStakedSuiFrensDynamicFieldsWithFilters({
				attributes: { Skin: "STRIPES" } as never,
				limit: 1,
				cursor: "client-cursor",
			});

		expect(
			result.dynamicFieldObjects.map((item) => item.suiFren.objectId)
		).toEqual([OBJECT_ONE]);
		expect(result.nextCursor).toBe(OBJECT_THREE);
		expect(dynamicFields.fetchDynamicFieldsUntil).toHaveBeenCalledWith(
			expect.objectContaining({
				attributes: { Skin: "STRIPES" },
				limit: 1,
				cursor: "client-cursor",
			})
		);
	});

	it("builds every public SuiFren transaction command with the expected Move target", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const cases: Array<{
			name: string;
			build: (tx: Transaction) => unknown;
			module: string;
			package: string;
			args: number;
		}> = [
			{
				name: "metadata inspection",
				build: (tx) =>
					suifrensApi.devInspectMetadataObjectIdMulTx({
						tx,
						suiFrenIds: [OBJECT_ONE],
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 2,
			},
			{
				name: "mixing limits inspection",
				build: (tx) =>
					suifrensApi.devInspectMixLimitAndLastEpochMixedMulTx({
						tx,
						suiFrenIds: [OBJECT_ONE],
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 3,
			},
			{
				name: "mix owned",
				build: (tx) =>
					suifrensApi.mixAndKeepTx({
						tx,
						parentOneId: OBJECT_ONE,
						parentTwoId: OBJECT_TWO,
						suiPaymentCoinId: PAYMENT_COIN,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 7,
			},
			{
				name: "mix with staked",
				build: (tx) =>
					suifrensApi.mixWithStakedAndKeepTx({
						tx,
						nonStakedParentId: OBJECT_ONE,
						stakedParentId: OBJECT_TWO,
						suiPaymentCoinId: PAYMENT_COIN,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 7,
			},
			{
				name: "mix staked with staked",
				build: (tx) =>
					suifrensApi.mixStakedWithStakedAndKeepTx({
						tx,
						parentOneId: OBJECT_ONE,
						parentTwoId: OBJECT_TWO,
						suiPaymentCoinId: PAYMENT_COIN,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 7,
			},
			{
				name: "stake",
				build: (tx) =>
					suifrensApi.stakeAndKeepTx({
						tx,
						suiFrenId: OBJECT_ONE,
						autoStakeFees: true,
						baseFee: 1n,
						feeIncrementPerMix: 2n,
						minRemainingMixesToKeep: 3n,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 8,
			},
			{
				name: "unstake",
				build: (tx) =>
					suifrensApi.unstakeAndKeepTx({
						tx,
						stakedPositionId: OBJECT_ONE,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: fullType("0x12::capy_labs::ignored").split("::")[0],
				module: "capy_labs",
				args: 3,
			},
			{
				name: "begin harvest",
				build: (tx) => suifrensApi.beginHarvestTx({ tx }),
				package: FULL_ELEVEN,
				module: "vault",
				args: 0,
			},
			{
				name: "harvest",
				build: (tx) =>
					suifrensApi.harvestTx({
						tx,
						stakedPositionId: OBJECT_ONE,
						harvestFeesEventMetadataId: OBJECT_TWO,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 3,
			},
			{
				name: "end harvest",
				build: (tx) =>
					suifrensApi.endHarvestTx({
						harvestFeesEventMetadataId: OBJECT_TWO,
						tx,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 1,
			},
			{
				name: "add accessory",
				build: (tx) =>
					suifrensApi.addAccessoryTx({
						tx,
						suiFrenId: OBJECT_ONE,
						accessoryId: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 3,
			},
			{
				name: "add owned accessory",
				build: (tx) =>
					suifrensApi.addAccessoryToOwnedSuiFrenTx({
						tx,
						suiFrenId: OBJECT_ONE,
						accessoryId: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 2,
			},
			{
				name: "remove accessory",
				build: (tx) =>
					suifrensApi.removeAccessoryAndKeepTx({
						tx,
						stakedPositionId: OBJECT_ONE,
						accessoryType: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 3,
			},
			{
				name: "remove owned accessory",
				build: (tx) =>
					suifrensApi.removeAccessoryFromOwnedSuiFrenAndKeepTx({
						tx,
						suiFrenId: OBJECT_ONE,
						accessoryType: OBJECT_TWO,
						suiFrenType: SUI_FREN_TYPE,
					}),
				package: FULL_ELEVEN,
				module: "vault",
				args: 2,
			},
		];

		for (const testCase of cases) {
			const tx = new Transaction();
			testCase.build(tx);
			const call = moveCall(tx);
			expect(call).toEqual(
				expect.objectContaining({
					package: testCase.package,
					module: testCase.module,
					arguments: expect.arrayContaining([]),
				})
			);
			expect((call.arguments as unknown[]).length).toBe(testCase.args);
		}
	});

	it("builds stake and unstake transactions with wallet sender and typed values", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const stakeTx = suifrensApi.fetchStakeTx({
			walletAddress: WALLET,
			suiFrenId: OBJECT_ONE,
			baseFee: 10n,
			feeIncrementPerMix: 20n,
			minRemainingMixesToKeep: 3n,
			suiFrenType: SUI_FREN_TYPE,
		});
		const stakeCall = moveCall(stakeTx);
		expect(stakeTx.getData().sender).toBe(FULL_ONE);
		expect(stakeCall.function).toBe("stake_and_keep");
		expect(stakeCall.typeArguments).toEqual([SUI_FREN_TYPE]);

		const unstakeTx = suifrensApi.fetchUnstakeTx({
			walletAddress: WALLET,
			stakedPositionId: OBJECT_TWO,
			suiFrenType: SUI_FREN_TYPE,
		});
		expect(unstakeTx.getData().sender).toBe(FULL_ONE);
		expect(moveCall(unstakeTx).function).toBe("unstake_and_keep");
	});

	it("selects all mixing branches and calculates exact bigint payment fees", async () => {
		const { api, coin } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const base: Omit<
			ApiMixSuiFrensBody,
			"suiFrenParentOne" | "suiFrenParentTwo"
		> = {
			baseFee: 100n,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
			isSponsoredTx: true,
		};

		const noneStaked = await suifrensApi.fetchBuildMixTx({
			...base,
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: undefined },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: undefined },
		});
		expect(moveCall(noneStaked).function).toBe("mix_and_keep");
		expect(coin.fetchCoinWithAmountTx.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				coinAmount: 250000100n,
				isSponsoredTx: true,
			})
		);

		const oneStaked = await suifrensApi.fetchBuildMixTx({
			...base,
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: 300000000n },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: undefined },
		});
		expect(moveCall(oneStaked).function).toBe("mix_with_staked_and_keep");
		expect(coin.fetchCoinWithAmountTx.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({ coinAmount: 550000100n })
		);

		const bothStaked = await suifrensApi.fetchBuildMixTx({
			...base,
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: 300000000n },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: 3000000000n },
		});
		expect(moveCall(bothStaked).function).toBe(
			"mix_staked_with_staked_and_keep"
		);
		expect(coin.fetchCoinWithAmountTx.mock.calls[2]?.[0]).toEqual(
			expect.objectContaining({ coinAmount: 3850000100n })
		);
		-expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: undefined,
				mixFee2: undefined,
			})
		).toBe(250000000n);
	});

	it("builds harvest transactions with merge/transfer behavior for one and many positions", async () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const one = await suifrensApi.fetchBuildHarvestFeesTx({
			walletAddress: WALLET,
			stakedPositionIds: [OBJECT_ONE],
		});
		expect(one.getData().sender).toBe(FULL_ONE);
		expect(commands(one).map((command) => command.$kind)).toEqual([
			"MoveCall",
			"MoveCall",
			"TransferObjects",
			"MoveCall",
		]);

		const many = await suifrensApi.fetchBuildHarvestFeesTx({
			walletAddress: OTHER_WALLET,
			stakedPositionIds: [OBJECT_ONE, OBJECT_TWO],
		});
		expect(commands(many).map((command) => command.$kind)).toEqual([
			"MoveCall",
			"MoveCall",
			"MoveCall",
			"MergeCoins",
			"TransferObjects",
			"MoveCall",
		]);
		expect(many.getData().sender).toBe(FULL_TWO);
	});

	it("chooses owned versus staked accessory transaction variants", () => {
		const { api } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		const common: ApiAddSuiFrenAccessoryBody = {
			suiFrenId: OBJECT_ONE,
			accessoryId: OBJECT_TWO,
			isOwned: true,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
		};

		expect(
			moveCall(suifrensApi.fetchBuildAddAccessoryTx(common)).function
		).toBe("add_accessory_to_owned_suifren");
		expect(
			moveCall(
				suifrensApi.fetchBuildAddAccessoryTx({ ...common, isOwned: false })
			).function
		).toBe("add_accessory");
		expect(
			moveCall(
				suifrensApi.fetchBuildRemoveAccessoryTx({
					suiFrenId: OBJECT_ONE,
					accessoryType: OBJECT_THREE,
					suiFrenType: SUI_FREN_TYPE,
					walletAddress: WALLET,
				})
			).function
		).toBe("remove_accessory_from_owned_suifren_and_keep");
		expect(
			moveCall(
				suifrensApi.fetchBuildRemoveAccessoryTx({
					stakedPositionId: OBJECT_ONE,
					accessoryType: OBJECT_THREE,
					suiFrenType: SUI_FREN_TYPE,
					walletAddress: WALLET,
				})
			).function
		).toBe("remove_accessory_and_keep");
	});

	it("aggregates stats and performs case-insensitive attribute filtering", async () => {
		const { api, events } = protocolApi();
		const suifrensApi = new SuiFrensApi(api);
		jest
			.spyOn(suifrensApi, "fetchSuiFrenVaultStateV1Object")
			.mockResolvedValue({
				objectId: "0x23",
				objectType: "0x11::vault_state::VaultState",
				stakedSuiFrens: 8n,
				totalMixes: 13n,
			});
		events.fetchEventsWithinTime.mockResolvedValue([
			{ fee: 100n },
			{ fee: 250n },
		]);

		expect(await suifrensApi.fetchSuiFrenStats()).toEqual({
			totalMixes: 13n,
			currentTotalStaked: 8n,
			mixingVolume24hr: 2,
			mixingFees24hr: 350n,
		});
		expect(events.fetchEventsWithinTime).toHaveBeenCalledWith(
			expect.objectContaining({ timeMs: 24 * 60 * 60 * 1000 })
		);

		const first = makeSuiFren({ objectId: OBJECT_ONE });
		const second = makeSuiFren({
			objectId: OBJECT_TWO,
			attributes: { ...first.attributes, skin: "cheetah" },
		});
		const all = [first, second];
		expect(
			suifrensApi.filterSuiFrensWithAttributes({
				suiFrens: all,
				attributes: {},
			})
		).toBe(all);
		expect(
			suifrensApi.filterSuiFrensWithAttributes({
				suiFrens: all,
				attributes: { SKIN: "CHEETAH" } as never,
			})
		).toEqual([second]);
	});
});
