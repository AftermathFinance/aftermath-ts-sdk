import { AftermathApi } from "../../providers/aftermathApi";
import { CoinType, UniqueId, Url } from "../../../types";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { Helpers } from "../../utils";

export class PythPricesApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants: {
		priceFeedsEndpoint: Url;
		priceFeedIds: Record<
			string,
			{
				id: UniqueId;
				coinTypes: CoinType[];
			}
		>;
	} = {
		priceFeedsEndpoint: "https://xc-mainnet.pyth.network",
		priceFeedIds: {
			usdc: {
				id: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
				coinTypes: [
					"0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN", // (eth)
					"0xb231fcda8bbddb31f2ef02e6161444aec64a514e2c89279584ac9806ce9cf037::coin::COIN", // (sol)
				],
			},
			sui: {
				id: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
				coinTypes: ["0x2::sui::SUI"],
			},
			usdt: {
				id: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
				coinTypes: [
					"0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN", // (eth)
				],
			},
			eth: {
				id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
				coinTypes: [
					"0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN", // weth (eth)
				],
			},
			btc: {
				id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
				coinTypes: [
					"0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN", // wbtc (eth)
				],
			},
			ftm: {
				id: "0x5c6c0d2386e3352356c3ab84434fafb5ea067ac2678a38a338c4a69ddc4bdb0c",
				coinTypes: [
					"0x6081300950a4f1e2081580e919c210436a1bed49080502834950d31ee55a2396::coin::COIN", // wftm (fantom)
				],
			},
			avax: {
				id: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
				coinTypes: [
					"0x1e8b532cca6569cab9f9b9ebc73f8c13885012ade714729aa3b450e0339ac766::coin::COIN", // wavax (avalanche)
				],
			},
			celo: {
				id: "0x7d669ddcdd23d9ef1fa9a9cc022ba055ec900e91c4cb960f3c20429d4447a411",
				coinTypes: [
					"0xa198f3be41cda8c07b3bf3fee02263526e535d682499806979a111e88a5a8d0f::coin::COIN",
				],
			},
			sol: {
				id: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
				coinTypes: [
					"0xb7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8::coin::COIN", // wsol (sol)
				],
			},
			matic: {
				id: "0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52",
				coinTypes: [
					"0xdbe380b13a6d0f5cdedd58de8f04625263f113b3f9db32b3e1983f49e2841676::coin::COIN", // wmatic (polygon)
				],
			},
			bnb: {
				id: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
				coinTypes: [
					"0xb848cce11ef3a8f62eccea6eb5b35a12c4c2b1ee1af7755d02d7bd6218e8226f::coin::COIN", // wbnb (bsc)
				],
			},
			// glmr: {
			// 	id: "",
			// 	coinTypes: [
			// 		"0x66f87084e49c38f76502d17f87d17f943f183bb94117561eb573e075fdc5ff75::coin::COIN", // wglmr (moonbeam)
			// 	],
			// },
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	protected readonly connection: EvmPriceServiceConnection;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;

		this.connection = new EvmPriceServiceConnection(
			PythPricesApiHelpers.constants.priceFeedsEndpoint
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	protected fetchPriceFeeds = async (coins: CoinType[]) => {
		const filteredPriceIds = coins.map((coin) => {
			const fullCoinType = Helpers.addLeadingZeroesToType(coin);
			const foundPriceId = Object.values(
				PythPricesApiHelpers.constants.priceFeedIds
			).find((data) =>
				data.coinTypes
					.map(Helpers.addLeadingZeroesToType)
					.includes(fullCoinType)
			);

			return foundPriceId?.id ?? "";
		});

		const onlyPriceIds = filteredPriceIds.filter(
			(priceId) => priceId !== ""
		);
		const uniquePriceIds = onlyPriceIds.filter(
			(priceId, index) => onlyPriceIds.indexOf(priceId) === index
		);

		const uniquePriceFeeds = await this.connection.getLatestPriceFeeds(
			uniquePriceIds
		);
		if (!uniquePriceFeeds) throw Error("failed to get latest prices");

		const priceFeeds = filteredPriceIds.map((priceId) => {
			const foundIndex = uniquePriceIds.indexOf(priceId);
			if (foundIndex >= 0)
				return uniquePriceFeeds[foundIndex].getPriceNoOlderThan(60);

			return undefined;
		});

		return priceFeeds;
	};
}
