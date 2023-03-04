import { Url } from "aftermath-sdk";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";

export abstract class AftermathProvider {
	constructor(
		public readonly network: SuiNetwork,
		private readonly urlPrefix: Url = ""
	) {
		this.network = network;
		this.urlPrefix = urlPrefix;
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

	private static urlForApiCall = (url: string, network: SuiNetwork): Url =>
		`/api/${network}/${url[0] === "/" ? url.replace("/", "") : url}`;

	protected async fetchApi<Output, BodyType = undefined>(
		url: Url,
		body?: BodyType
	): Promise<Output> {
		const apiCallUrl = AftermathProvider.urlForApiCall(
			this.urlPrefix + url,
			this.network
		);
		const response = await (body === undefined
			? fetch(apiCallUrl)
			: fetch(apiCallUrl, {
					method: "POST",
					body: JSON.stringify(body),
			  }));

		return await AftermathProvider.fetchResponseToType<Output>(response);
	}
}
