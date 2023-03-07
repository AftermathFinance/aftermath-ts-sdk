import { SuiAddress } from "@mysten/sui.js";
import { Pools } from "../../packages/pools/pools";
import { CoinType, SuiNetwork, Url } from "../../types";
import { Wallet } from "../wallet/wallet";
import { Capys } from "../../packages/capys/capys";
import { Coin } from "../../packages/coin/coin";
import { Faucet } from "../../packages/faucet/faucet";
import { Staking } from "../../packages/staking/staking";

export abstract class Aftermath {
	private readonly baseUrl?: Url;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	protected constructor(
		public readonly network?: SuiNetwork,
		private readonly urlPrefix: Url = ""
	) {
		this.network = network;
		this.urlPrefix = urlPrefix;
		this.baseUrl =
			network === undefined
				? undefined
				: Aftermath.baseUrlForNetwork(network);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Class Object Creation
	/////////////////////////////////////////////////////////////////////

	public Pools = () => new Pools(this.network);

	public Staking = () => new Staking(this.network);

	public Capys = () => new Capys(this.network);

	public Faucet = () => new Faucet(this.network);

	public Wallet = (address: SuiAddress) => new Wallet(address, this.network);

	public Coin = (coinType: CoinType) => new Coin(coinType, this.network);

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	private static baseUrlForNetwork(network: SuiNetwork): Url {
		if (network === "DEVNET") return "https://devnet.aftermath.finance";
		if (network === "TESTNET") return "https://testnet.aftermath.finance";
		return "http://localhost:3000"; // LOCAL
	}

	// TODO: move this and other functions to helpers file
	private static isNumber = (str: string): boolean =>
		/^\d*\.?\d*$/g.test(str);

	private static parseJsonWithBigint = (
		json: string,
		unsafeStringNumberConversion = false
	): string =>
		JSON.parse(json, (key, value) => {
			// handles bigint casting
			if (typeof value === "string" && /^\d+n$/.test(value)) {
				return BigInt(value.slice(0, value.length - 1));
			}

			if (
				unsafeStringNumberConversion &&
				typeof value === "string" &&
				Aftermath.isNumber(value)
			) {
				return BigInt(value);
			}
			return value;
		});

	private static async fetchResponseToType<OutputType>(
		response: Response
	): Promise<OutputType> {
		const json = JSON.stringify(await response.json());
		const output = Aftermath.parseJsonWithBigint(json);
		return output as OutputType;
	}

	private urlForApiCall = (url: string): Url => {
		if (this.network === undefined || this.baseUrl === undefined)
			throw new Error("no network, no baseUrl: unable to fetch data");

		return `${this.baseUrl}/api/${this.network}/${this.urlPrefix}/${url}`;
	};

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	protected async fetchApi<Output, BodyType = undefined>(
		url: Url,
		body?: BodyType
	): Promise<Output> {
		const apiCallUrl = this.urlForApiCall(url);
		const response = await (body === undefined
			? fetch(apiCallUrl)
			: fetch(apiCallUrl, {
					method: "POST",
					body: JSON.stringify(body),
			  }));

		return await Aftermath.fetchResponseToType<Output>(response);
	}
}