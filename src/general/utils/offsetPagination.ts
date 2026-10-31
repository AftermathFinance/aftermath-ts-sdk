import type { ApiOffsetPageBody, ApiPage } from "../types";

export const SMALL_API_PAGE_SIZE = 32;
export const FARM_CATALOGUE_PAGE_SIZE = 32;
export const POOL_CATALOGUE_PAGE_SIZE = 256;

const PAGE_WINDOW_SIZE = 4;

function effectivePageRequest(
	request: ApiOffsetPageBody | undefined,
	maxLimit: number
): Required<ApiOffsetPageBody> {
	const requestedCursor = request?.cursor;
	const requestedLimit = request?.limit;
	return {
		cursor:
			typeof requestedCursor === "number" && Number.isFinite(requestedCursor)
				? Math.max(0, Math.trunc(requestedCursor))
				: 0,
		limit: Math.max(
			0,
			Math.min(
				typeof requestedLimit === "number" && Number.isFinite(requestedLimit)
					? Math.trunc(requestedLimit)
					: maxLimit,
				maxLimit
			)
		),
	};
}

function pageFromItems<Item>(
	items: Item[],
	request: Required<ApiOffsetPageBody>,
	hasMoreWhenFull = true
): ApiPage<Item> {
	return {
		items,
		nextCursor:
			hasMoreWhenFull && request.limit > 0 && items.length >= request.limit
				? request.cursor + request.limit
				: undefined,
	};
}

function isOffsetPageRequest(request: ApiOffsetPageBody | undefined): boolean {
	return request?.cursor !== undefined || request?.limit !== undefined;
}

async function fetchAllOffsetPages<Item>({
	fetchPage,
	identity,
	pageSize,
}: {
	fetchPage: (request: Required<ApiOffsetPageBody>) => Promise<Item[]>;
	identity?: (item: Item) => string;
	pageSize: number;
}): Promise<Item[]> {
	const firstRequest = { cursor: 0, limit: pageSize };
	const first = await fetchPage(firstRequest);
	if (first.length !== pageSize) {
		return first;
	}

	const items = [...first];
	const firstIdentities = identity ? first.map(identity).sort() : undefined;
	for (
		let windowCursor = pageSize;
		;
		windowCursor += pageSize * PAGE_WINDOW_SIZE
	) {
		const requests = Array.from({ length: PAGE_WINDOW_SIZE }, (_, index) => ({
			cursor: windowCursor + index * pageSize,
			limit: pageSize,
		}));
		const results = await Promise.allSettled(requests.map(fetchPage));
		for (const result of results) {
			if (result.status === "rejected") {
				throw result.reason;
			}
			const resultIdentities = identity
				? result.value.map(identity).sort()
				: undefined;
			if (
				firstIdentities &&
				resultIdentities?.length === firstIdentities.length &&
				resultIdentities.every(
					(value, index) => value === firstIdentities[index]
				)
			) {
				return first;
			}
			items.push(...result.value);
			if (result.value.length < pageSize) {
				return items;
			}
		}
	}
}

async function fetchExplicitChunks<Input, Output>({
	inputs,
	fetchChunk,
}: {
	inputs: readonly Input[];
	fetchChunk: (inputs: Input[]) => Promise<Output[]>;
}): Promise<Output[]> {
	const chunks = Array.from(
		{ length: Math.ceil(inputs.length / SMALL_API_PAGE_SIZE) },
		(_, index) =>
			inputs.slice(
				index * SMALL_API_PAGE_SIZE,
				(index + 1) * SMALL_API_PAGE_SIZE
			)
	);
	const results: Output[] = [];
	for (let index = 0; index < chunks.length; index += PAGE_WINDOW_SIZE) {
		const window = chunks.slice(index, index + PAGE_WINDOW_SIZE);
		const rows = await Promise.all(
			window.map((chunk) => fetchChunk([...chunk]))
		);
		results.push(...rows.flat());
	}
	return results;
}

export {
	effectivePageRequest,
	fetchAllOffsetPages,
	fetchExplicitChunks,
	isOffsetPageRequest,
	pageFromItems,
};
