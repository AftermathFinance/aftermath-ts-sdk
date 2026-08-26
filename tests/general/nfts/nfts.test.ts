import {
	type AftermathApiType,
	jest,
	KIOSK_CAP_TYPE,
	KIOSK_TYPE,
	makeApi,
	makeObjectView,
	NftsApi,
	NftsApiCasting,
	OBJECT_1,
	OBJECT_2,
	OBJECT_3,
	OWNER,
	PACKAGE_NFT,
	type SuiObjectView,
} from "@test/general/fixtures/services.js";

describe("NftsApi and NftsApiCasting", () => {
	const nftObject = makeObjectView({
		objectId: OBJECT_1,
		type: `${PACKAGE_NFT}::collectible::Collectible`,
		display: {
			output: {
				name: "Moon Cat",
				image_url: "https://images.test/moon-cat.png",
				rarity: "rare",
			},
			errors: null,
		},
	});

	it("normalizes display fields into suggested and other NFT data and filters unrenderable objects", () => {
		const emptyDisplay = makeObjectView({
			objectId: OBJECT_2,
			display: { output: {}, errors: null },
		});
		const noDisplay = makeObjectView({ objectId: OBJECT_3, display: null });

		expect(
			NftsApiCasting.nftsFromSuiObjects([nftObject, emptyDisplay, noDisplay])
		).toEqual([
			{
				info: {
					objectId: OBJECT_1,
					objectType: `${PACKAGE_NFT}::collectible::Collectible`,
				},
				display: {
					suggested: {
						name: "Moon Cat",
						imageUrl: "https://images.test/moon-cat.png",
					},
					other: { rarity: "rare" },
				},
			},
		]);
	});

	it("returns empty display maps for display errors and rejects objects without identity", () => {
		const errorDisplay = makeObjectView({
			display: { output: null, errors: [{ key: "name" }] },
		});
		expect(NftsApiCasting.nftFromSuiObject(errorDisplay)).toEqual({
			info: {
				objectId: OBJECT_1,
				objectType: `${PACKAGE_NFT}::collectible::Collectible`,
			},
			display: { suggested: {}, other: {} },
		});
		expect(() =>
			NftsApiCasting.nftFromSuiObject(
				makeObjectView({ objectId: undefined, type: undefined })
			)
		).toThrow("no object type found on undefined");
	});

	it("casts regular and personal kiosk owner caps from their gRPC field shapes", () => {
		const regular = makeObjectView({
			objectId: OBJECT_1,
			type: KIOSK_CAP_TYPE,
			json: { for: OBJECT_2 },
		});
		const personal = makeObjectView({
			objectId: OBJECT_2,
			type: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
			json: { cap: { for: OBJECT_3 } },
		});

		expect(NftsApiCasting.kioskOwnerCapFromSuiObject(regular)).toEqual({
			objectId: OBJECT_1,
			objectType: KIOSK_CAP_TYPE,
			kioskObjectId: OBJECT_2,
		});
		expect(
			NftsApiCasting.kioskOwnerCapFromPersonalKioskCapSuiObject(personal)
		).toEqual({
			objectId: OBJECT_2,
			objectType: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
			kioskObjectId: OBJECT_3,
		});
	});

	it("requires NFT addresses and derives the personal kiosk cap type", () => {
		const missingApi = makeApi({});
		expect(() => new NftsApi(missingApi)).toThrow(
			"not all required addresses have been set in provider"
		);

		const nftsAddress = { packages: { mystenTransferPolicy: PACKAGE_NFT } };
		const api = makeApi({}, { nfts: nftsAddress });
		const nfts = new NftsApi(api);
		expect(nfts.addresses).toEqual(nftsAddress);
		expect(nfts.objectTypes.personalKioskCap).toBe(
			`${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`
		);
	});

	it("routes NFT and kiosk reads through the low-level API and asks for display data", async () => {
		const ownedObjects = jest.fn().mockResolvedValue([nftObject]);
		const objectBatch = jest.fn().mockResolvedValue([nftObject]);
		const ownedCaps = jest
			.fn()
			.mockImplementation(
				({
					objectType,
					objectFromSuiObjectResponse,
				}: {
					objectType: string;
					objectFromSuiObjectResponse: (value: SuiObjectView) => unknown;
				}) =>
					Promise.resolve([
						objectFromSuiObjectResponse(
							objectType === `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`
								? makeObjectView({
										objectId: OBJECT_2,
										type: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
										json: { cap: { for: OBJECT_3 } },
									})
								: makeObjectView({
										objectId: OBJECT_1,
										type: KIOSK_CAP_TYPE,
										json: { for: OBJECT_2 },
									})
						),
					])
			);
		const dynamicObjects = jest
			.fn()
			.mockResolvedValue([
				{ info: { objectId: OBJECT_3 }, display: { suggested: {}, other: {} } },
			]);
		const objects = {
			fetchOwnedObjects: ownedObjects,
			fetchObjectBatch: objectBatch,
			fetchCastObjectsOwnedByAddressOfType: ownedCaps,
			fetchCastObjectBatch: jest.fn().mockResolvedValue([
				{
					objectId: OBJECT_1,
					objectType: KIOSK_CAP_TYPE,
					kioskObjectId: OBJECT_2,
				},
			]),
		};
		const dynamicFields = { fetchCastAllDynamicFieldsOfType: dynamicObjects };
		const api = {
			addresses: { nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } } },
			Objects: () => objects,
			DynamicFields: () => dynamicFields,
		} as unknown as AftermathApiType;
		const nfts = new NftsApi(api);

		await expect(
			nfts.fetchOwnedNfts({ walletAddress: OWNER })
		).resolves.toHaveLength(1);
		expect(ownedObjects).toHaveBeenCalledWith({
			walletAddress: OWNER,
			withDisplay: true,
		});
		await expect(
			nfts.fetchNfts({ objectIds: [OBJECT_1] })
		).resolves.toHaveLength(1);
		expect(objectBatch).toHaveBeenCalledWith({
			objectIds: [OBJECT_1],
			withDisplay: true,
		});

		await expect(
			nfts.fetchOwnedKioskOwnerCaps({ walletAddress: OWNER })
		).resolves.toEqual([
			{
				objectId: OBJECT_1,
				objectType: KIOSK_CAP_TYPE,
				kioskObjectId: OBJECT_2,
			},
			{
				objectId: OBJECT_2,
				objectType: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
				kioskObjectId: OBJECT_3,
			},
		]);
		expect(ownedCaps).toHaveBeenCalledTimes(2);
		expect(ownedCaps.mock.calls[0]?.[0]).toMatchObject({
			walletAddress: OWNER,
			objectType: KIOSK_CAP_TYPE,
		});
		expect(ownedCaps.mock.calls[1]?.[0]).toMatchObject({
			walletAddress: OWNER,
			objectType: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
		});

		await expect(
			nfts.fetchNftsInKiosk({ kioskObjectId: OBJECT_2 })
		).resolves.toHaveLength(1);
		expect(dynamicObjects).toHaveBeenCalledWith({
			parentObjectId: OBJECT_2,
			objectsFromObjectIds: expect.any(Function),
		});

		await expect(
			nfts.fetchKioskOwnerCaps({ kioskOwnerCapIds: [OBJECT_1] })
		).resolves.toEqual([
			{
				objectId: OBJECT_1,
				objectType: KIOSK_CAP_TYPE,
				kioskObjectId: OBJECT_2,
			},
		]);
	});

	it("materializes kiosk objects and personal-kiosk flags from owner caps", async () => {
		const personalType = `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`;
		const caps = [
			{
				objectId: OBJECT_1,
				objectType: KIOSK_CAP_TYPE,
				kioskObjectId: OBJECT_2,
			},
			{ objectId: OBJECT_2, objectType: personalType, kioskObjectId: OBJECT_3 },
		];
		const api = {
			addresses: { nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } } },
			Objects: () => ({ fetchCastObjectBatch: jest.fn() }),
			DynamicFields: () => ({ fetchCastAllDynamicFieldsOfType: jest.fn() }),
		} as unknown as AftermathApiType;
		const nfts = new NftsApi(api);
		jest
			.spyOn(nfts, "fetchNftsInKiosk")
			.mockResolvedValueOnce([
				{
					info: { objectId: OBJECT_2, objectType: "nft" },
					display: { suggested: {}, other: {} },
				},
			])
			.mockResolvedValueOnce([]);

		await expect(nfts.fetchKiosks({ kioskOwnerCaps: caps })).resolves.toEqual([
			{
				objectId: OBJECT_2,
				objectType: KIOSK_TYPE,
				kioskOwnerCapId: OBJECT_1,
				nfts: [
					{
						info: { objectId: OBJECT_2, objectType: "nft" },
						display: { suggested: {}, other: {} },
					},
				],
				isPersonal: false,
			},
			{
				objectId: OBJECT_3,
				objectType: KIOSK_TYPE,
				kioskOwnerCapId: OBJECT_2,
				nfts: [],
				isPersonal: true,
			},
		]);
	});

	it("delegates kiosk collection wrappers through owner-cap and dynamic-field readers", async () => {
		const personalType = `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`;
		const firstCap = {
			objectId: OBJECT_1,
			objectType: KIOSK_CAP_TYPE,
			kioskObjectId: OBJECT_2,
		};
		const caps = [
			firstCap,
			{ objectId: OBJECT_2, objectType: personalType, kioskObjectId: OBJECT_3 },
		];
		const api = {
			addresses: { nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } } },
			Objects: () => ({ fetchCastObjectBatch: jest.fn() }),
			DynamicFields: () => ({ fetchCastAllDynamicFieldsOfType: jest.fn() }),
		} as unknown as AftermathApiType;
		const nfts = new NftsApi(api);
		const fetchedKioskOwnerCaps = jest
			.spyOn(nfts, "fetchKioskOwnerCaps")
			.mockResolvedValue(caps);
		const kioskResult = [{ objectId: OBJECT_2 }];
		const fetchedKiosks = jest
			.spyOn(nfts, "fetchKiosks")
			.mockResolvedValue(kioskResult as never);

		await expect(
			nfts.fetchKiosksFromOwnerCaps({ kioskOwnerCapIds: [OBJECT_1, OBJECT_2] })
		).resolves.toBe(kioskResult);
		expect(fetchedKioskOwnerCaps).toHaveBeenCalledWith({
			kioskOwnerCapIds: [OBJECT_1, OBJECT_2],
		});
		expect(fetchedKiosks).toHaveBeenCalledWith({ kioskOwnerCaps: caps });

		const fetchedOwnedCaps = jest
			.spyOn(nfts, "fetchOwnedKioskOwnerCaps")
			.mockResolvedValue([firstCap]);
		const fetchedNftsInKiosk = jest
			.spyOn(nfts, "fetchNftsInKiosk")
			.mockResolvedValue([]);
		await expect(
			nfts.fetchOwnedKiosks({ walletAddress: OWNER })
		).resolves.toEqual([
			{
				objectId: OBJECT_2,
				objectType: KIOSK_TYPE,
				kioskOwnerCapId: OBJECT_1,
				nfts: [],
				isPersonal: false,
			},
		]);
		expect(fetchedOwnedCaps).toHaveBeenCalledWith({ walletAddress: OWNER });
		expect(fetchedNftsInKiosk).toHaveBeenCalledWith({
			kioskObjectId: OBJECT_2,
		});
	});
});
