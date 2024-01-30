import { RouterGraph } from "./packages/router/utils/synchronous/routerGraph";
import { WorkerData } from "./workerCaller";
import { parentPort } from "worker_threads";

// const { parentPort } = require("worker_threads");

// worker side
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
