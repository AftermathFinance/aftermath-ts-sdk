import {
	DynamicFieldsApiHelpers,
	dynamicFieldEntry,
	jest,
	makeApi,
	makeObjectView,
	OBJECT_1,
	OBJECT_2,
	OBJECT_3,
} from "@test/general/fixtures/services.js";

describe("DynamicFieldsApiHelpers", () => {
	it("lists, casts, filters, and forwards cursor/limit values through the gRPC client", async () => {
		const listDynamicFields = jest.fn().mockResolvedValue({
			dynamicFields: [
				dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 1),
				dynamicFieldEntry(OBJECT_2, "0x2::field::Other", 2, "DynamicObject"),
			],
			cursor: OBJECT_3,
		});
		const api = makeApi({ listDynamicFields });
		const helper = new DynamicFieldsApiHelpers(api);

		await expect(
			helper.fetchDynamicFieldsOfTypeWithCursor({
				parentObjectId: OBJECT_3,
				cursor: OBJECT_1,
				limit: 2,
				dynamicFieldType: "0x2::field::Wanted",
			})
		).resolves.toEqual({
			dynamicFields: [
				{
					name: {
						type: "0x1::string::String",
						value: "AQ==",
					},
					bcsEncoding: "base64",
					bcsName: "AQ==",
					type: "DynamicField",
					objectType: "0x2::field::Wanted",
					objectId: OBJECT_1,
				},
			],
			nextCursor: OBJECT_3,
		});
		expect(listDynamicFields).toHaveBeenCalledWith({
			parentId: OBJECT_3,
			cursor: OBJECT_1,
			limit: 2,
		});

		await helper.fetchDynamicFieldsOfTypeWithCursor({
			parentObjectId: OBJECT_3,
			dynamicFieldType: (type) => type.endsWith("Other"),
		});
		expect(listDynamicFields).toHaveBeenLastCalledWith({
			parentId: OBJECT_3,
			cursor: undefined,
			limit: 256,
		});
	});

	it("casts one page of dynamic fields to objects and preserves the next cursor", async () => {
		const listDynamicFields = jest.fn().mockResolvedValue({
			dynamicFields: [dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 9)],
			cursor: OBJECT_2,
		});
		const objectsFromObjectIds = jest
			.fn()
			.mockResolvedValue([{ id: OBJECT_1 }]);
		const helper = new DynamicFieldsApiHelpers(makeApi({ listDynamicFields }));

		await expect(
			helper.fetchCastDynamicFieldsOfTypeWithCursor({
				parentObjectId: OBJECT_3,
				objectsFromObjectIds,
			})
		).resolves.toEqual({
			dynamicFieldObjects: [{ id: OBJECT_1 }],
			nextCursor: OBJECT_2,
		});
		expect(objectsFromObjectIds).toHaveBeenCalledWith([OBJECT_1]);
	});

	it("fetches every dynamic-field page with the configured step size", async () => {
		const listDynamicFields = jest
			.fn()
			.mockResolvedValueOnce({
				dynamicFields: [dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 1)],
				cursor: OBJECT_2,
			})
			.mockResolvedValueOnce({
				dynamicFields: [dynamicFieldEntry(OBJECT_2, "0x2::field::Wanted", 2)],
				cursor: null,
			});
		const helper = new DynamicFieldsApiHelpers(makeApi({ listDynamicFields }));

		await expect(
			helper.fetchAllDynamicFieldsOfType({
				parentObjectId: OBJECT_3,
				limitStepSize: 1,
			})
		).resolves.toHaveLength(2);
		expect(listDynamicFields).toHaveBeenNthCalledWith(1, {
			parentId: OBJECT_3,
			cursor: undefined,
			limit: 1,
		});
		expect(listDynamicFields).toHaveBeenNthCalledWith(2, {
			parentId: OBJECT_3,
			cursor: OBJECT_2,
			limit: 1,
		});
	});

	it("casts all dynamic-field pages in one object-id batch", async () => {
		const listDynamicFields = jest.fn().mockResolvedValue({
			dynamicFields: [
				dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 1),
				dynamicFieldEntry(OBJECT_2, "0x2::field::Wanted", 2),
			],
			cursor: null,
		});
		const objectsFromObjectIds = jest
			.fn()
			.mockResolvedValue([{ id: OBJECT_1 }, { id: OBJECT_2 }]);
		const helper = new DynamicFieldsApiHelpers(makeApi({ listDynamicFields }));

		await expect(
			helper.fetchCastAllDynamicFieldsOfType({
				parentObjectId: OBJECT_3,
				objectsFromObjectIds,
				limitStepSize: 32,
			})
		).resolves.toEqual([{ id: OBJECT_1 }, { id: OBJECT_2 }]);
		expect(objectsFromObjectIds).toHaveBeenCalledWith([OBJECT_1, OBJECT_2]);
	});

	it("fetchDynamicFieldsUntil stops after completion and forwards the returned cursor", async () => {
		const fetchFunc: (inputs: { cursor?: string; limit?: number }) => Promise<{
			dynamicFieldObjects: Array<{ id: string }>;
			nextCursor: string | null;
		}> = jest
			.fn()
			.mockResolvedValueOnce({
				dynamicFieldObjects: [{ id: OBJECT_1 }, { id: OBJECT_2 }],
				nextCursor: OBJECT_3,
			})
			.mockResolvedValueOnce({
				dynamicFieldObjects: [{ id: "complete" }],
				nextCursor: null,
			});
		const helper = new DynamicFieldsApiHelpers(makeApi({}));

		await expect(
			helper.fetchDynamicFieldsUntil({
				fetchFunc,
				limitStepSize: 4,
				isComplete: (objects) =>
					objects.some((object) => object.id === "complete"),
			})
		).resolves.toEqual({
			dynamicFieldObjects: [
				{ id: OBJECT_1 },
				{ id: OBJECT_2 },
				{ id: "complete" },
			],
			nextCursor: null,
		});
		expect(fetchFunc).toHaveBeenNthCalledWith(1, {
			cursor: undefined,
			limit: 4,
		});
		expect(fetchFunc).toHaveBeenNthCalledWith(2, {
			cursor: OBJECT_3,
			limit: 4,
		});
	});

	it("returns immediately when the accumulated dynamic-field objects satisfy the predicate", async () => {
		const fetchFunc = jest.fn().mockResolvedValue({
			dynamicFieldObjects: [{ id: "complete-on-first-page" }],
			nextCursor: OBJECT_1,
		});

		await expect(
			new DynamicFieldsApiHelpers(makeApi({})).fetchDynamicFieldsUntil({
				fetchFunc,
				isComplete: () => true,
			})
		).resolves.toEqual({
			dynamicFieldObjects: [{ id: "complete-on-first-page" }],
			nextCursor: OBJECT_1,
		});
		expect(fetchFunc).toHaveBeenCalledTimes(1);
	});

	it("fetchDynamicFieldObject requests the gRPC object view needed by casters", async () => {
		const object = makeObjectView();
		const getDynamicObjectField = jest.fn().mockResolvedValue({ object });
		const api = makeApi({ core: { getDynamicObjectField } });

		await expect(
			new DynamicFieldsApiHelpers(api).fetchDynamicFieldObject({
				parentId: OBJECT_3,
				name: { type: "0x1::string::String", bcs: new Uint8Array([1, 2]) },
			})
		).resolves.toBe(object);
		expect(getDynamicObjectField).toHaveBeenCalledWith({
			parentId: OBJECT_3,
			name: { type: "0x1::string::String", bcs: new Uint8Array([1, 2]) },
			include: { json: true, display: true },
		});
	});
});
