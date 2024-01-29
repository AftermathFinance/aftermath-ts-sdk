import {
	Balance,
	CoinType,
	RouterExternalFee,
	RouterProtocolName,
	RouterSerializableCompleteGraph,
	RouterSynchronousOptions,
	SuiAddress,
	SuiNetwork,
} from ".";
import { RouterGraph } from "./packages/router/utils/synchronous/routerGraph";
import { WorkerData } from "./workerCaller";
import { parentPort } from "node:worker_threads";

// worker side
// const { parentPort } = require("node:worker_threads");

parentPort?.on("message", (data: any) => {
	const doRoute = (data: WorkerData) => {
		const { graphInputs, inputs } = data;

		const routerGraph = new RouterGraph(
			graphInputs.network,
			graphInputs.graph,
			graphInputs.options,
			graphInputs.excludeProtocols
		);

		const synchronousCompleteRoutes =
			routerGraph.getCompleteRoutesGivenAmountIns(inputs);

		return synchronousCompleteRoutes;
	};

	const result = doRoute(data.input);

	parentPort?.postMessage({ output: result });
});
