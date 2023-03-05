import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import { Url } from "../types";

export default abstract class AftermathProvider {
	private readonly baseUrl: Url;

	constructor(
		public readonly network: SuiNetwork,
		private readonly urlPrefix: Url = ""
	) {
		this.network = network;
		this.urlPrefix = urlPrefix;
		this.baseUrl = AftermathProvider.baseUrlForNetwork(network);
	}

	private static baseUrlForNetwork(network: SuiNetwork): Url {
		if (network === "DEVNET") return "https://devnet.aftermath.finance";
		if (network === "TESTNET") return "https://testnet.aftermath.finance";

		// LOCAL
		return "http://localhost:3000";
	}

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
				AftermathProvider.isNumber(value)
			) {
				return BigInt(value);
			}
			return value;
		});

	private static async fetchResponseToType<OutputType>(
		response: Response
	): Promise<OutputType> {
		const json = JSON.stringify(await response.json());
		const output = AftermathProvider.parseJsonWithBigint(json);
		return output as OutputType;
	}

	private urlForApiCall = (url: string): Url =>
		`${this.baseUrl}/api/${this.network}/${this.urlPrefix}/${url}`;

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

		return await AftermathProvider.fetchResponseToType<Output>(response);
	}
}
