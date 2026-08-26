import {
	ACCESSORY_TYPE,
	API_BASE_URL,
	type ApiMixSuiFrensBody,
	asyncMock,
	describe,
	expect,
	FULL_SUI,
	fakeApi,
	installJsonFetch,
	installJsonFetchSequence,
	it,
	makeMetadata,
	makeStakedInfo,
	makeSuiFren,
	OBJECT_ONE,
	OBJECT_TWO,
	requestBody,
	requestUrl,
	StakedSuiFren,
	SUI_FREN_TYPE,
	SUI_TYPE,
	SuiFren,
	SuiFrens,
	WALLET,
} from "@test/packages/suiFrens/fixtures.js";

describe("SuiFren and StakedSuiFren wrappers", () => {
	it("exposes display properties, dynamic fields, type helpers, and cloning flags", () => {
		const config = { baseUrl: API_BASE_URL, accessToken: "token" };
		const suiFren = new SuiFren(makeSuiFren(), config, true, true);

		expect(suiFren.suiFrenType()).toBe(SUI_TYPE);
		expect(suiFren.properties()).toEqual({
			Skin: "stripes",
			Ears: "ear1",
			Expression: "bigSmile",
			"Main Color": "6FBBEE",
			"Secondary Color": "CF9696",
			"Birth Location": "Capy City",
			Birthday: "January 15, 2020",
			Cohort: "4",
			Generation: "2",
		});
		expect(suiFren.dynamicFields()).toEqual({
			"Mixes Remaining": "5",
			"Last Epoch Mixed": "9",
		});
		expect(suiFren.displayNumber()).toBe("0X1");
		const clone = suiFren.clone();
		expect(clone).toBeInstanceOf(SuiFren);
		expect(clone.suiFren).toBe(suiFren.suiFren);
		expect(clone.isStaked).toBe(true);
		expect(clone.isOwned).toBe(true);
	});

	it("maps SuiFren object calls and enforces stake/removal preconditions", async () => {
		const suiFrenApi = {
			fetchStakeTx: asyncMock<string>().mockResolvedValue("stake-tx"),
			fetchBuildAddAccessoryTx: asyncMock<string>().mockResolvedValue("add-tx"),
			fetchBuildRemoveAccessoryTx:
				asyncMock<string>().mockResolvedValue("remove-tx"),
		};
		const api = fakeApi({ SuiFrens: () => suiFrenApi });
		const owned = new SuiFren(
			makeSuiFren(),
			{ baseUrl: API_BASE_URL },
			false,
			true,
			api
		);

		await expect(
			owned.getStakeTransaction({
				baseFee: 1n,
				feeIncrementPerMix: 2n,
				minRemainingMixesToKeep: 3n,
				walletAddress: WALLET,
			})
		).resolves.toBe("stake-tx");
		expect(suiFrenApi.fetchStakeTx).toHaveBeenCalledWith({
			baseFee: 1n,
			feeIncrementPerMix: 2n,
			minRemainingMixesToKeep: 3n,
			walletAddress: WALLET,
			suiFrenType: SUI_TYPE,
			suiFrenId: OBJECT_ONE,
		});
		await owned.getAddAccessoryTransaction({
			accessoryId: OBJECT_TWO,
			walletAddress: WALLET,
		});
		expect(suiFrenApi.fetchBuildAddAccessoryTx).toHaveBeenCalledWith({
			accessoryId: OBJECT_TWO,
			walletAddress: WALLET,
			isOwned: true,
			suiFrenType: SUI_TYPE,
			suiFrenId: OBJECT_ONE,
		});
		await owned.getRemoveAccessoryTransaction({
			accessoryType: ACCESSORY_TYPE,
			walletAddress: WALLET,
		});
		expect(suiFrenApi.fetchBuildRemoveAccessoryTx).toHaveBeenCalledWith({
			accessoryType: ACCESSORY_TYPE,
			walletAddress: WALLET,
			suiFrenType: SUI_TYPE,
			suiFrenId: OBJECT_ONE,
		});

		const staked = new SuiFren(makeSuiFren(), undefined, true, true, api);
		await expect(
			staked.getStakeTransaction({
				baseFee: 1n,
				feeIncrementPerMix: 2n,
				minRemainingMixesToKeep: 3n,
				walletAddress: WALLET,
			})
		).rejects.toThrow("unable to stake already staked suiFren");

		const notOwned = new SuiFren(makeSuiFren(), undefined, false, false, api);
		await expect(
			notOwned.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).rejects.toThrow(
			"unable to remove accessory from suiFren that is not owned by caller"
		);
		await expect(
			new SuiFren(makeSuiFren()).getStakeTransaction({
				baseFee: 1n,
				feeIncrementPerMix: 2n,
				minRemainingMixesToKeep: 3n,
				walletAddress: WALLET,
			})
		).rejects.toThrow("missing AftermathApi instance");
	});

	it("uses the wrapper HTTP seam for accessories and preserves bigint request values", async () => {
		const calls = installJsonFetch([
			{
				objectId: "0x50",
				objectType: "0x10::accessories::Accessory",
				name: "Hat",
				type: ACCESSORY_TYPE,
				imageUrl: "image",
			},
		]);
		const suiFren = new SuiFren(makeSuiFren(), { baseUrl: API_BASE_URL });
		expect(await suiFren.getAccessories()).toEqual([
			{
				objectId: "0x50",
				objectType: "0x10::accessories::Accessory",
				name: "Hat",
				type: ACCESSORY_TYPE,
				imageUrl: "image",
			},
		]);
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/sui-frens/accessories`
		);
		expect(requestBody(calls[0])).toEqual({ suiFrenId: OBJECT_ONE });
	});

	it("maps staked wrapper calls and rejects absent positions or unowned mutations", async () => {
		const suiFrenApi = {
			fetchUnstakeTx: asyncMock<string>().mockResolvedValue("unstake-tx"),
			fetchBuildHarvestFeesTx:
				asyncMock<string>().mockResolvedValue("harvest-tx"),
			fetchBuildRemoveAccessoryTx:
				asyncMock<string>().mockResolvedValue("remove-tx"),
		};
		const api = fakeApi({ SuiFrens: () => suiFrenApi });
		const info = makeStakedInfo({
			position: {
				objectId: "0x60",
				objectType: "0x11::staked_position::Position",
				suiFrenId: OBJECT_ONE,
			},
		});
		const staked = new StakedSuiFren(
			info,
			{ baseUrl: API_BASE_URL },
			true,
			api
		);

		expect(staked.mixFee()).toBe(300000000n);
		expect(staked.suiFrenId()).toBe(OBJECT_ONE);
		await expect(
			staked.getUnstakeTransaction({ walletAddress: WALLET })
		).resolves.toBe("unstake-tx");
		expect(suiFrenApi.fetchUnstakeTx).toHaveBeenCalledWith({
			walletAddress: WALLET,
			suiFrenType: SUI_TYPE,
			stakedPositionId: "0x60",
		});
		await expect(
			staked.getHarvestFeesTransaction({ walletAddress: WALLET })
		).resolves.toBe("harvest-tx");
		expect(suiFrenApi.fetchBuildHarvestFeesTx).toHaveBeenCalledWith({
			walletAddress: WALLET,
			stakedPositionIds: ["0x60"],
		});
		await expect(
			staked.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).resolves.toBe("remove-tx");

		const clone = staked.clone();
		expect(clone.info).toBe(info);
		expect(clone.isOwned).toBe(true);
		expect(clone.suiFren.isStaked).toBe(true);

		const noPosition = new StakedSuiFren(
			makeStakedInfo(),
			undefined,
			true,
			api
		);
		await expect(
			noPosition.getUnstakeTransaction({ walletAddress: WALLET })
		).rejects.toThrow("no position found on suiFren");
		await expect(
			noPosition.getHarvestFeesTransaction({ walletAddress: WALLET })
		).rejects.toThrow("no position found on suiFren");
		await expect(
			noPosition.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).rejects.toThrow("no position found on suiFren");
		const unowned = new StakedSuiFren(info, undefined, false, api);
		await expect(
			unowned.getHarvestFeesTransaction({ walletAddress: WALLET })
		).rejects.toThrow(
			"unable to remove accessory from suiFren that is not owned by caller"
		);
		await expect(
			unowned.getRemoveAccessoryTransaction({
				accessoryType: ACCESSORY_TYPE,
				walletAddress: WALLET,
			})
		).rejects.toThrow(
			"unable to remove accessory from suiFren that is not owned by caller"
		);
	});
});

describe("SuiFrens facade", () => {
	it("calculates protocol mix fees across owned, singly staked, and doubly staked inputs", () => {
		expect(SuiFrens.constants.mixingFeeCoinType).toBe(FULL_SUI);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: undefined,
				mixFee2: undefined,
			})
		).toBe(250000000n);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: 300000000n,
				mixFee2: undefined,
			})
		).toBe(550000000n);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: undefined,
				mixFee2: 300000000n,
			})
		).toBe(550000000n);
		expect(
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: 300000000n,
				mixFee2: 3000000000n,
			})
		).toBe(3850000000n);
	});

	it("maps read, event, stats, pagination, and optional query requests", async () => {
		const response = {
			objectId: OBJECT_ONE,
			objectType: SUI_FREN_TYPE,
			generation: "2n",
			birthdate: 1_579_096_800_000,
			cohort: "4n",
			genes: ["1n"],
			attributes: {
				skin: "stripes",
				main: "6FBBEE",
				secondary: "CF9696",
				expression: "bigSmile",
				ears: "ear1",
			},
			birthLocation: "Capy City",
			display: {
				link: "link",
				imageUrl: "image",
				description: "description",
				projectUrl: "project",
			},
		};
		const calls = installJsonFetchSequence([
			[response],
			[response],
			[{ suiFren: response, metadata: makeMetadata() }],
			[{ suiFren: response, metadata: makeMetadata() }],
			{
				dynamicFieldObjects: [{ suiFren: response, metadata: makeMetadata() }],
				nextCursor: "next",
			},
			[{ suiFren: response, metadata: makeMetadata() }],
			{
				mixingLimit: "1n",
				coolDownPeriodEpochs: "2n",
				mixingPrice: "3n",
				suiProfits: "4n",
				objectId: "0x21",
				objectType: "0x21::capy_labs::App",
			},
			[
				{
					objectId: "0x50",
					objectType: "0x10::accessories::Accessory",
					name: "Hat",
					type: ACCESSORY_TYPE,
					imageUrl: "image",
				},
			],
			{ events: [], nextCursor: null },
			{ events: [], nextCursor: null },
			{ events: [], nextCursor: null },
			{ events: [], nextCursor: null },
			{
				totalMixes: "9n",
				currentTotalStaked: "3n",
				mixingFees24hr: "4n",
				mixingVolume24hr: 2,
			},
		]);
		const suifrens = new SuiFrens({
			baseUrl: API_BASE_URL,
			accessToken: "token",
		});

		expect(
			(await suifrens.getSuiFrens({ suiFrenObjectIds: [OBJECT_ONE] }))[0]
		).toBeInstanceOf(SuiFren);
		expect(
			await suifrens.getSuiFren({ suiFrenObjectId: OBJECT_ONE })
		).toBeInstanceOf(SuiFren);
		expect(
			(await suifrens.getOwnedSuiFrens({ walletAddress: WALLET }))[0]?.isOwned
		).toBe(true);
		expect(
			(await suifrens.getOwnedStakedSuiFrens({ walletAddress: WALLET }))[0]
				?.isOwned
		).toBe(true);
		expect(
			(
				await suifrens.getAllStakedSuiFrens({
					attributes: { skin: "stripes" },
					sortBy: "Price (low to high)",
					cursor: "cursor",
					limit: 3,
				} as never)
			).nextCursor
		).toBe("next");
		expect(
			(await suifrens.getStakedSuiFrens({ stakedSuiFrenIds: [OBJECT_ONE] }))[0]
		).toBeInstanceOf(StakedSuiFren);
		expect(await suifrens.getCapyLabsApp()).toEqual(
			expect.objectContaining({ mixingLimit: 1n })
		);
		expect(
			await suifrens.getOwnedAccessories({ walletAddress: WALLET })
		).toHaveLength(1);
		await suifrens.getHarvestFeesEvents({ limit: 1 });
		await suifrens.getMixEvents({
			cursor: { txDigest: "digest", eventSeq: "0" },
		});
		await suifrens.getStakeEvents({});
		await suifrens.getUnstakeEvents({});
		expect(await suifrens.getStats()).toEqual({
			totalMixes: 9n,
			currentTotalStaked: 3n,
			mixingFees24hr: 4n,
			mixingVolume24hr: 2,
		});

		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/sui-frens/["0x10"]`
		);
		expect(requestBody(calls[2])).toEqual({ walletAddress: WALLET });
		expect(requestUrl(calls[4])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/sui-frens/filtered-staked-sui-frens/?sort=Price (low to high)&skin=stripes`
		);
		expect(requestBody(calls[4])).toEqual({
			attributes: { skin: "stripes" },
			sortBy: "Price (low to high)",
			cursor: "cursor",
			limit: 3,
		});
		expect(
			(calls[0].init?.headers as Record<string, string>).Authorization
		).toBe("Bearer token");
	});

	it("maps transaction methods and static wrapper helpers, with missing-provider errors", async () => {
		const suiFrenApi = {
			fetchBuildMixTx: asyncMock<string>().mockResolvedValue("mix-tx"),
			fetchBuildHarvestFeesTx:
				asyncMock<string>().mockResolvedValue("harvest-tx"),
		};
		const api = fakeApi({ SuiFrens: () => suiFrenApi });
		const suifrens = new SuiFrens(undefined, api);
		const mixInput: ApiMixSuiFrensBody = {
			suiFrenParentOne: { objectId: OBJECT_ONE, mixFee: undefined },
			suiFrenParentTwo: { objectId: OBJECT_TWO, mixFee: 1n },
			baseFee: 2n,
			suiFrenType: SUI_FREN_TYPE,
			walletAddress: WALLET,
		};
		await expect(suifrens.getMixTransaction(mixInput)).resolves.toBe("mix-tx");
		await expect(
			suifrens.getHarvestFeesTransaction({
				stakedPositionIds: [OBJECT_ONE],
				walletAddress: WALLET,
			})
		).resolves.toBe("harvest-tx");
		expect(suiFrenApi.fetchBuildMixTx).toHaveBeenCalledWith(mixInput);

		const owned = new SuiFren(makeSuiFren(), undefined, false, true);
		const staked = new StakedSuiFren(
			makeStakedInfo({
				position: {
					objectId: "0x60",
					objectType: "position",
					suiFrenId: OBJECT_ONE,
				},
			})
		);
		expect(SuiFrens.suiFren(owned)).toBe(owned);
		expect(SuiFrens.suiFren(staked)).toBe(staked.suiFren);
		expect(SuiFrens.suiFren(undefined)).toBeUndefined();
		expect(SuiFrens.suiFrenId(owned)).toBe(OBJECT_ONE);
		expect(SuiFrens.suiFrenId(staked)).toBe(OBJECT_ONE);
		expect(SuiFrens.mixFee(staked)).toBe(300000000n);
		expect(SuiFrens.mixFee(owned)).toBeUndefined();

		await expect(new SuiFrens().getMixTransaction(mixInput)).rejects.toThrow(
			"missing AftermathApi instance"
		);
	});
});
