import {
	marketFixture,
	NftAmmApiCasting,
} from "@test/packages/nftAmm/fixtures.js";

describe("NftAmm response casting", () => {
	it("rejects a market object when nested gRPC pool type information is unavailable", () => {
		const view = {
			objectId: "0x20",
			type: marketFixture.objectType,
			json: {
				nfts: { id: "0x21", size: "7" },
				supply: { value: "1000000000" },
				pool: {
					name: "NFT AMM pool",
					creator: "0x1",
					lp_supply: { value: "1000000000" },
					illiquid_lp_supply: "0",
					type_names: ["2::fraction::F", "3::asset::A"],
					normalized_balances: ["1000000000", "2000000000"],
					weights: ["500000000000000000", "500000000000000000"],
					flatness: "0",
					fees_swap_in: ["0", "0"],
					fees_swap_out: ["0", "0"],
					fees_deposit: ["0", "0"],
					fees_withdraw: ["0", "0"],
					decimal_scalars: ["1", "1"],
					lp_decimals: "9",
					lp_decimal_scalar: "1",
				},
				fractions_amount: "100",
			},
		} as never;
		expect(() => NftAmmApiCasting.marketObjectFromSuiObject(view)).toThrow(
			"no object id found"
		);
	});

	it("still rejects missing top-level object type before reading dynamic fields", () => {
		expect(() =>
			NftAmmApiCasting.marketObjectFromSuiObject({
				objectId: "0x20",
				json: {},
			} as never)
		).toThrow("no object type found");
	});
});
