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
		if (this.baseUrl === undefined)
			throw new Error("no baseUrl: unable to fetch data");

		// TODO: handle url prefixing and api calls based on network differently
		return `${this.baseUrl}/api/${
			this.urlPrefix === "" ? "" : this.urlPrefix + "/"
		}${url}`;
	};

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	protected async fetchApi<Output, BodyType = undefined>(
		url: Url,
		body?: BodyType,
		signal?: AbortSignal
	): Promise<Output> {
		// this allows BigInt to be JSON serialized (as string)
		(BigInt.prototype as any).toJSON = function () {
			return this.toString() + "n";
		};

		const apiCallUrl = this.urlForApiCall(url);
		const response = await (body === undefined
			? fetch(apiCallUrl, { signal })
			: fetch(apiCallUrl, {
					method: "POST",
					body: JSON.stringify(body),
					signal,
			  }));

		return await Caller.fetchResponseToType<Output>(response);
	}
}
