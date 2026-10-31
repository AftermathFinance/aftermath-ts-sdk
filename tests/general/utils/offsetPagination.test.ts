import { describe, expect, it, jest } from "@jest/globals";
import {
	effectivePageRequest,
	fetchAllOffsetPages,
	fetchExplicitChunks,
} from "@sdk/general/utils/offsetPagination";

describe("bounded offset pagination", () => {
	it("caps page requests at the endpoint maximum", () => {
		expect(effectivePageRequest({ cursor: 3, limit: 99 }, 32)).toEqual({
			cursor: 3,
			limit: 32,
		});
		expect(
			effectivePageRequest(
				{ cursor: Number.NaN, limit: Number.POSITIVE_INFINITY },
				32
			)
		).toEqual({ cursor: 0, limit: 32 });
	});

	it("chunks explicit inputs without changing result order", async () => {
		const calls: number[][] = [];
		const values = Array.from({ length: 65 }, (_, index) => index);
		const result = await fetchExplicitChunks({
			inputs: values,
			fetchChunk: (chunk) => {
				calls.push(chunk);
				return Promise.resolve(chunk.map((value) => value * 2));
			},
		});

		expect(calls.map((chunk) => chunk.length)).toEqual([32, 32, 1]);
		expect(result).toEqual(values.map((value) => value * 2));
	});

	it("drains bounded catalogue windows and ignores overshoot failures", async () => {
		const fetchPage = jest.fn(({ cursor }: { cursor: number }) => {
			if (cursor === 0) {
				return Promise.resolve(Array.from({ length: 32 }, (_, index) => index));
			}
			if (cursor === 32) {
				return Promise.resolve([32]);
			}
			return Promise.reject(new Error(`speculative ${cursor}`));
		});

		await expect(
			fetchAllOffsetPages({ fetchPage, pageSize: 32 })
		).resolves.toEqual(Array.from({ length: 33 }, (_, index) => index));
		expect(fetchPage).toHaveBeenCalledTimes(5);
	});

	it("accepts an unpaged legacy response without requesting it again", async () => {
		const legacy = Array.from({ length: 40 }, (_, index) => index);
		const fetchPage = jest.fn(() => Promise.resolve(legacy));

		await expect(
			fetchAllOffsetPages({ fetchPage, pageSize: 32 })
		).resolves.toEqual(legacy);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});

	it("detects an exact-size legacy page even when its order changes", async () => {
		const first = Array.from({ length: 32 }, (_, index) => ({
			id: `${index}`,
		}));
		const fetchPage = jest
			.fn<() => Promise<{ id: string }[]>>()
			.mockResolvedValueOnce(first)
			.mockResolvedValue([...first].reverse());

		await expect(
			fetchAllOffsetPages({
				fetchPage,
				identity: (item) => item.id,
				pageSize: 32,
			})
		).resolves.toEqual(first);
		expect(fetchPage).toHaveBeenCalledTimes(5);
	});
});
