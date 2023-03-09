import { AftermathApi } from "../providers/aftermathApi";

export class RpcApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static constants = {
		devInspectSigner: "0xedd30fda5ea992615d73ca8eca9e381a7fe025db",
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
			console.error(error);
			throw new Error(`${method} rpcCall failed`);
		}
	};
}
