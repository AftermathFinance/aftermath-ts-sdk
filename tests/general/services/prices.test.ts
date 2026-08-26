import {
	installFetch,
	Prices,
	requestBody,
} from "@test/general/fixtures/services.js";

describe("Caller-backed general services", () => {
	it("Prices posts coin requests, casts bigint response values, and preserves auth", async () => {
		const calls = installFetch({
			"0x2::sui::SUI": {
				price: 1.23,
				priceChange24HoursPercentage: -2.5,
			},
		});
		const prices = new Prices({
			baseUrl: "https://sdk.test/",
			accessToken: "price-token",
		});

		await expect(
			prices.getCoinsToPriceInfo({ coins: ["0x2::sui::SUI"] })
		).resolves.toEqual({
			"0x2::sui::SUI": {
				price: 1.23,
				priceChange24HoursPercentage: -2.5,
			},
		});

		expect(calls[0]?.input).toBe("https://sdk.test/api/price-info");
		expect(requestBody(calls)).toEqual({ coins: ["0x2::sui::SUI"] });
		expect(calls[0]?.init?.method).toBe("POST");
		expect(calls[0]?.init?.headers).toEqual({
			"Content-Type": "application/json",
			Authorization: "Bearer price-token",
		});
	});

	it("Prices expose single and projected price methods over the same response contract", async () => {
		const response = {
			"0x2::sui::SUI": {
				price: 2.75,
				priceChange24HoursPercentage: 4,
			},
			"0xabc::coin::COIN": {
				price: 0.125,
				priceChange24HoursPercentage: 0,
			},
		};
		const prices = new Prices({ baseUrl: "https://sdk.test" });

		installFetch(response);
		await expect(
			prices.getCoinPriceInfo({ coin: "0x2::sui::SUI" })
		).resolves.toEqual(response["0x2::sui::SUI"]);

		installFetch(response);
		await expect(prices.getCoinPrice({ coin: "0x2::sui::SUI" })).resolves.toBe(
			2.75
		);

		installFetch(response);
		await expect(
			prices.getCoinsToPrice({
				coins: ["0x2::sui::SUI", "0xabc::coin::COIN"],
			})
		).resolves.toEqual({
			"0x2::sui::SUI": 2.75,
			"0xabc::coin::COIN": 0.125,
		});
	});

	it("service calls fail clearly when no API base URL is configured", async () => {
		await expect(
			new Prices().getCoinsToPriceInfo({ coins: ["0x2::sui::SUI"] })
		).rejects.toThrow("no apiBaseUrl: unable to fetch data");
	});
});
