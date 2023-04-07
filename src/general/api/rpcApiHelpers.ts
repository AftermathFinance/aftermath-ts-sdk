import { AftermathApi } from "../providers/aftermathApi";

export class RpcApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static constants = {
		devInspectSigner:
			"0x195b73858cbc1762e8c837fd403637e5475d312c80f3a0b4d96e2abae3e69229",
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
