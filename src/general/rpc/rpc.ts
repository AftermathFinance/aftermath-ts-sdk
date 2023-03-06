export class Rpc {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static constants = {
		devInspectSigner: "0xedd30fda5ea992615d73ca8eca9e381a7fe025db",
		rpcVersion: "2.0",
		rpcId: 1,
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly rpcEndpoint: string) {
		this.rpcEndpoint = rpcEndpoint;
	}

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public fetchRpcCall = async (method: string, params: any[]) => {
		const jsonrpc = Rpc.constants.rpcVersion;
		const prefixedMethod = `sui_${method}`;
		const id = Rpc.constants.rpcId;

		const data = {
			jsonrpc: jsonrpc,
			id: id,
			method: prefixedMethod,
			params: params,
		};

		const responseJson = await fetch(this.rpcEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		});

		try {
			const response = await responseJson.json();
			return response;
		} catch (error) {
			console.error(error);
			throw new Error(`${method} rpcCall failed`);
		}
	};
}
