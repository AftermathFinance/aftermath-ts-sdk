import {
	fakeApi,
	type JsonRecord,
	marketFixture,
	NftAmmMarket,
	Transaction,
} from "@test/packages/nftAmm/fixtures.js";

describe("NftAmmMarket facade and calculations", () => {
	it("uses the market table id and defaults pagination to 25", async () => {
		const captured: JsonRecord[] = [];
		const api = fakeApi({
			NftAmm: () => ({
				fetchNftsInMarketTable: (input: JsonRecord) => {
					captured.push(input);
					return { dynamicFieldObjects: [], nextCursor: null };
				},
			}),
		});
		const market = new NftAmmMarket(marketFixture, undefined, api);
		await market.getNfts({});
		await market.getNfts({ cursor: "0xcursor", limit: 3 });
		expect(captured).toEqual([
			{ marketTableObjectId: "0x20", limit: 25 },
			{ marketTableObjectId: "0x20", cursor: "0xcursor", limit: 3 },
		]);
	});

	it("delegates transaction inputs and preserves the deposit NFT naming seam", async () => {
		const calls: JsonRecord[] = [];
		const returned = {
			buy: new Transaction(),
			sell: new Transaction(),
			deposit: new Transaction(),
			withdraw: new Transaction(),
		};
		const api = fakeApi({
			NftAmm: () => ({
				fetchBuildBuyTx: (input: JsonRecord) => {
					calls.push({ kind: "buy", ...input });
					return returned.buy;
				},
				fetchBuildSellTx: (input: JsonRecord) => {
					calls.push({ kind: "sell", ...input });
					return returned.sell;
				},
				fetchBuildDepositTx: (input: JsonRecord) => {
					calls.push({ kind: "deposit", ...input });
					return returned.deposit;
				},
				fetchBuildWithdrawTx: (input: JsonRecord) => {
					calls.push({ kind: "withdraw", ...input });
					return returned.withdraw;
				},
			}),
		});
		const market = new NftAmmMarket(marketFixture, undefined, api);
		const common = {
			marketObjectId: "0xignored",
			walletAddress: "0xwallet",
			slippage: 0.01,
		};

		expect(
			await market.getBuyTransaction({ ...common, nftObjectIds: ["0xnft"] })
		).toBe(returned.buy);
		expect(
			await market.getSellTransaction({ ...common, nftObjectIds: ["0xnft"] })
		).toBe(returned.sell);
		expect(
			await market.getDepositTransaction({
				walletAddress: "0xwallet",
				marketObjectId: "0xignored",
				assetCoinAmountIn: 500n,
				nftObjectIds: ["0xnft"],
				slippage: 0.01,
			})
		).toBe(returned.deposit);
		expect(
			await market.getWithdrawTransaction({
				...common,
				lpCoinAmount: 500n,
				nftObjectIds: ["0xnft"],
			})
		).toBe(returned.withdraw);
		expect(calls[2]).toEqual(
			expect.objectContaining({ kind: "deposit", nfts: ["0xnft"] })
		);
		expect(calls.every((call) => call.market === market)).toBe(true);
	});

	it("calculates NFT spot, buy, sell, and deposit values with bigint outputs", () => {
		const market = new NftAmmMarket(marketFixture);
		expect(
			market.getAssetCoinToFractionalizeCoinSpotPrice({ withFees: false })
		).toBe(2);
		expect(
			market.getFractionalizedCoinToAssetCoinSpotPrice({ withFees: false })
		).toBe(0.5);
		expect(market.getNftSpotPriceInAssetCoin({ withFees: false })).toBe(200n);
		expect(market.getBuyAssetCoinAmountIn({ nftsCount: 1 })).toBe(200n);
		expect(market.getSellAssetCoinAmountOut({ nftsCount: 1 })).toBe(197n);
		expect(
			market.getDepositLpCoinAmountOut({ assetCoinAmountIn: 100_000_000n })
		).toEqual({
			lpAmountOut: 24_695_076n,
			lpRatio: 0.975_900_072_948_532_3,
		});
	});

	it("surfaces the current withdrawal calculation failure instead of fabricating NFT counts", () => {
		const market = new NftAmmMarket(marketFixture);
		expect(() =>
			market.getWithdrawNftsCountOut({ lpCoinAmount: 900000000n })
		).toThrow("Newton diverged");
	});

	it("requires an Aftermath API for transaction or NFT operations", async () => {
		const market = new NftAmmMarket(marketFixture);
		await expect(market.getNfts({})).rejects.toThrow(
			"missing AftermathApi instance"
		);
		await expect(
			market.getBuyTransaction({
				marketObjectId: "0x20",
				walletAddress: "0xwallet",
				nftObjectIds: ["0xnft"],
				slippage: 0.01,
			})
		).rejects.toThrow("missing AftermathApi instance");
	});
});
