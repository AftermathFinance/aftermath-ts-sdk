import { SuiNetwork, Url } from "../../types";
import { Helpers } from "./helpers";

export class Caller {
	private readonly baseUrl?: Url;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly network?: SuiNetwork,
		private readonly urlPrefix: Url = ""
	) {
		this.network = network;
		this.urlPrefix = urlPrefix;
		this.baseUrl =
			network === undefined
				? undefined
				: Caller.baseUrlForNetwork(network);
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	private static baseUrlForNetwork(network: SuiNetwork): Url {
		if (network === "DEVNET") return "https://devnet.aftermath.finance";
		if (network === "TESTNET") return "https://testnet.aftermath.finance";
		return "http://localhost:3000"; // LOCAL
	}

	private static async fetchResponseToType<OutputType>(
		response: Response
	): Promise<OutputType> {
		const json = JSON.stringify(await response.json());
		const output = Helpers.parseJsonWithBigint(json);
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

		return await Caller.fetchResponseToType<Output>(response);
	}
}
