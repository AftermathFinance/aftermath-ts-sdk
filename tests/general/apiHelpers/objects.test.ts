import {
	type BcsType,
	jest,
	KIOSK_CAP_TYPE,
	makeApi,
	makeObjectView,
	OBJECT_1,
	OBJECT_2,
	OBJECT_3,
	ObjectsApiHelpers,
	OWNER,
	PACKAGE_NFT,
	type SuiObjectView,
	TransactionClass,
} from "@test/general/fixtures/services.js";

describe("ObjectsApiHelpers", () => {
	it("distinguishes existing and missing objects at the gRPC boundary", async () => {
		const getObject = jest
			.fn()
			.mockResolvedValueOnce({ object: makeObjectView() })
			.mockRejectedValueOnce(new Error("object not found"));
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(helper.fetchDoesObjectExist(OBJECT_1)).resolves.toBe(true);
		await expect(helper.fetchDoesObjectExist(OBJECT_2)).resolves.toBe(false);
		expect(getObject).toHaveBeenNthCalledWith(1, { objectId: OBJECT_1 });
		expect(getObject).toHaveBeenNthCalledWith(2, { objectId: OBJECT_2 });
	});

	it("checks both address-owner forms and returns false for absent or different owners", async () => {
		const getObject = jest
			.fn()
			.mockResolvedValueOnce({
				object: makeObjectView({ owner: { AddressOwner: OWNER } }),
			})
			.mockResolvedValueOnce({
				object: makeObjectView({ owner: { ObjectOwner: OWNER } }),
			})
			.mockResolvedValueOnce({
				object: makeObjectView({ owner: { AddressOwner: "0xother" } }),
			})
			.mockResolvedValueOnce({ object: makeObjectView({ owner: undefined }) });
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_1,
				walletAddress: OWNER,
			})
		).resolves.toBe(true);
		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_2,
				walletAddress: OWNER,
			})
		).resolves.toBe(true);
		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_3,
				walletAddress: OWNER,
			})
		).resolves.toBe(false);
		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_3,
				walletAddress: OWNER,
			})
		).resolves.toBe(false);
	});

	it("pages owned objects, pins the caster include flags, and forwards type filters", async () => {
		const listOwnedObjects = jest
			.fn()
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_1 })],
				cursor: "owned-cursor-1",
				hasNextPage: true,
			})
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_2 })],
				cursor: null,
				hasNextPage: false,
			});
		const helper = new ObjectsApiHelpers(makeApi({ listOwnedObjects }));

		await expect(
			helper.fetchObjectsOfTypeOwnedByAddress({
				walletAddress: OWNER,
				objectType: KIOSK_CAP_TYPE,
				withDisplay: true,
			})
		).resolves.toEqual([
			makeObjectView({ objectId: OBJECT_1 }),
			makeObjectView({ objectId: OBJECT_2 }),
		]);
		expect(listOwnedObjects).toHaveBeenNthCalledWith(1, {
			owner: OWNER,
			type: KIOSK_CAP_TYPE,
			include: { json: true, display: true },
			limit: 50,
			cursor: undefined,
		});
		expect(listOwnedObjects).toHaveBeenNthCalledWith(2, {
			owner: OWNER,
			type: KIOSK_CAP_TYPE,
			include: { json: true, display: true },
			limit: 50,
			cursor: "owned-cursor-1",
		});
	});

	it("stops owned-object pagination when a page is empty even if the server advertises another page", async () => {
		const listOwnedObjects = jest.fn().mockResolvedValue({
			objects: [],
			cursor: "ignored",
			hasNextPage: true,
		});

		await expect(
			new ObjectsApiHelpers(makeApi({ listOwnedObjects })).fetchOwnedObjects({
				walletAddress: OWNER,
			})
		).resolves.toEqual([]);
		expect(listOwnedObjects).toHaveBeenCalledTimes(1);
	});

	it("fetches and casts single objects while wrapping transport errors", async () => {
		const object = makeObjectView({ objectId: OBJECT_2 });
		const getObject = jest
			.fn()
			.mockResolvedValueOnce({ object })
			.mockRejectedValueOnce(new Error("missing object"));
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(
			helper.fetchObject({ objectId: OBJECT_2, withDisplay: true })
		).resolves.toBe(object);
		expect(getObject).toHaveBeenNthCalledWith(1, {
			objectId: OBJECT_2,
			include: { json: true, display: true },
		});
		await expect(helper.fetchObject({ objectId: OBJECT_2 })).rejects.toThrow(
			"an error occured fetching object: missing object"
		);
		const castObject = makeObjectView({ objectId: OBJECT_1 });
		const castHelper = new ObjectsApiHelpers(
			makeApi({
				getObject: jest.fn().mockResolvedValue({ object: castObject }),
			})
		);
		await expect(
			castHelper.fetchCastObject({
				objectId: OBJECT_1,
				objectFromSuiObjectResponse: (value) => value.objectId,
			})
		).resolves.toBe(OBJECT_1);

		const customObject = makeObjectView({ objectId: OBJECT_3 });
		const customHelper = new ObjectsApiHelpers(
			makeApi({
				getObject: jest.fn().mockResolvedValue({ object: customObject }),
			})
		);
		await expect(
			customHelper.fetchCastObjectGeneral({
				objectId: OBJECT_3,
				include: { json: true, owner: true } as never,
				objectFromSuiObjectResponse: (value) => value.objectId,
			})
		).resolves.toBe(OBJECT_3);
	});

	it("batches at the 50-object boundary and drops per-object error arms", async () => {
		const objectIds = [
			"0x01",
			"0x02",
			"0x03",
			"0x04",
			"0x05",
			"0x06",
			"0x07",
			"0x08",
			"0x09",
			"0x0a",
			"0x0b",
			"0x0c",
			"0x0d",
			"0x0e",
			"0x0f",
			"0x10",
			"0x11",
			"0x12",
			"0x13",
			"0x14",
			"0x15",
			"0x16",
			"0x17",
			"0x18",
			"0x19",
			"0x1a",
			"0x1b",
			"0x1c",
			"0x1d",
			"0x1e",
			"0x1f",
			"0x20",
			"0x21",
			"0x22",
			"0x23",
			"0x24",
			"0x25",
			"0x26",
			"0x27",
			"0x28",
			"0x29",
			"0x2a",
			"0x2b",
			"0x2c",
			"0x2d",
			"0x2e",
			"0x2f",
			"0x30",
			"0x31",
			"0x32",
			"0x33",
		];
		const getObjects = jest
			.fn()
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_1 }), new Error("missing")],
			})
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_2 })],
			});
		const helper = new ObjectsApiHelpers(makeApi({ getObjects }));

		await expect(
			helper.fetchObjectBatch({ objectIds, withDisplay: true })
		).resolves.toEqual([
			makeObjectView({ objectId: OBJECT_1 }),
			makeObjectView({ objectId: OBJECT_2 }),
		]);
		expect(getObjects).toHaveBeenNthCalledWith(1, {
			objectIds: objectIds.slice(0, 50),
			include: { json: true, display: true },
		});
		expect(getObjects).toHaveBeenNthCalledWith(2, {
			objectIds: ["0x33"],
			include: { json: true, display: true },
		});
	});

	it("casts object batches and owned objects through caller-provided public casters", async () => {
		const object = makeObjectView({ objectId: OBJECT_1 });
		const getObjects = jest.fn().mockResolvedValue({ objects: [object] });
		const listOwnedObjects = jest.fn().mockResolvedValue({
			objects: [object],
			cursor: null,
			hasNextPage: false,
		});
		const helper = new ObjectsApiHelpers(
			makeApi({ getObjects, listOwnedObjects })
		);
		const caster = (value: SuiObjectView) => value.objectId;

		await expect(
			helper.fetchCastObjectBatch({
				objectIds: [OBJECT_1],
				objectFromSuiObjectResponse: caster,
			})
		).resolves.toEqual([OBJECT_1]);
		await expect(
			helper.fetchCastObjectsOwnedByAddressOfType({
				walletAddress: OWNER,
				objectType: KIOSK_CAP_TYPE,
				objectFromSuiObjectResponse: caster,
			})
		).resolves.toEqual([OBJECT_1]);
	});

	it("reshapes BCS object content and supports a caller deserializer", async () => {
		const object = makeObjectView({
			objectId: OBJECT_2,
			content: new Uint8Array([1, 2, 255]),
		});
		const getObject = jest.fn().mockResolvedValue({ object });
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(helper.fetchObjectBcs(OBJECT_2)).resolves.toEqual({
			data: {
				objectId: OBJECT_2,
				version: "7",
				digest: "digest-1",
				type: `${PACKAGE_NFT}::collectible::Collectible`,
				owner: { AddressOwner: OWNER },
				bcs: {
					dataType: "moveObject",
					type: `${PACKAGE_NFT}::collectible::Collectible`,
					version: "7",
					bcsBytes: "AQL/",
				},
			},
		});
		expect(getObject).toHaveBeenCalledWith({
			objectId: OBJECT_2,
			include: { content: true },
		});
		const failedBcsHelper = new ObjectsApiHelpers(
			makeApi({ getObject: jest.fn().mockRejectedValue("bcs unavailable") })
		);
		await expect(failedBcsHelper.fetchObjectBcs(OBJECT_2)).rejects.toThrow(
			"an error occured fetching object: bcs unavailable"
		);

		const bcsType = {
			fromBase64: jest.fn().mockReturnValue(123n),
		} as unknown as BcsType<bigint>;
		await expect(
			helper.fetchCastObjectBcs({
				objectId: OBJECT_2,
				bcsType,
				fromDeserialized: (value) => `value:${value.toString()}`,
			})
		).resolves.toBe("value:123");
		expect(bcsType.fromBase64).toHaveBeenCalledWith("AQL/");
	});

	it("builds burn and public-share transaction commands through the Sui transaction boundary", async () => {
		const tx = new TransactionClass();
		const object = tx.object(OBJECT_1);
		await new ObjectsApiHelpers(makeApi({})).burnObjectTx({ tx, object });
		const burnCommand = tx.getData().commands[0];
		expect(burnCommand).toMatchObject({
			$kind: "TransferObjects",
			TransferObjects: {
				objects: [{ Input: 0, type: "object" }],
				address: { Input: 1, type: "pure" },
			},
		});

		const shareTx = new TransactionClass();
		await new ObjectsApiHelpers(makeApi({})).publicShareObjectTx({
			tx: shareTx,
			object: shareTx.object(OBJECT_1),
			objectType: `${PACKAGE_NFT}::collectible::Collectible`,
		});
		expect(shareTx.getData().commands[0]).toMatchObject({
			$kind: "MoveCall",
			MoveCall: {
				package:
					"0x0000000000000000000000000000000000000000000000000000000000000002",
				module: "transfer",
				function: "public_share_object",
				typeArguments: [`${PACKAGE_NFT}::collectible::Collectible`],
				arguments: [{ Input: 0, type: "object" }],
			},
		});
	});
});
