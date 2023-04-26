import { AftermathApi } from "../providers/aftermathApi";

export class RpcApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static constants = {
		devInspectSigner:
			"0xacb7cb045c3afac61381cdf272cd24ebe115f86361c9f06490482c238765aeb5",
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public fetchRpcCall = async (method: string, params: any[]) => {
		const rpcClient = this.Provider.provider.options.rpcClient;
		if (!rpcClient) throw new Error("rpcClient is unset");

		const responseJson = await rpcClient.request(method, params);

		try {
			const response = await responseJson.json();
			return response;
		} catch (error) {
			throw new Error(`${method} rpcCall failed with error: ${error}`);
		}
	};
}
