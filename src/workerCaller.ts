import {
	Balance,
	CoinType,
	RouterCompleteTradeRoute,
	RouterExternalFee,
	RouterProtocolName,
	RouterSerializableCompleteGraph,
	RouterSynchronousOptions,
	SuiAddress,
	SuiNetwork,
} from ".";
import { Worker } from "worker_threads";

export type WorkerData = {
	graphInputs: {
		network: SuiNetwork;
		graph: RouterSerializableCompleteGraph;
		options: RouterSynchronousOptions;
		excludeProtocols: RouterProtocolName[];
	};
	inputs: {
		coinInType: CoinType;
		coinInAmounts: Balance[];
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
	};
};

// host side

export default function handleDoRoute(
	req: WorkerData
): Promise<RouterCompleteTradeRoute[]> {
	// const { Worker } = require("worker_threads");

	const worker = new Worker("./node_modules/aftermath-ts-sdk/dist/worker.js");

	// worker.postMessage({ input: req });

	// worker.on("message", (data) => {
	// 	res(data);
	// });

	return new Promise((resolve) => {
		worker.postMessage({ input: req });
		worker.on("message", (data: { output: RouterCompleteTradeRoute[] }) => {
			resolve(data.output);
		});
	});
}
