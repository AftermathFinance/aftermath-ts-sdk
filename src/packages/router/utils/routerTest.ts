import { Aftermath } from "../../../general/providers";

const runMe = async () => {
	const AftermathSdk = new Aftermath("LOCAL");
	const pools = await AftermathSdk.Pools().getAllPools();
	const router = await AftermathSdk.Router(pools);

	const coinIn = "0xc6d6a60b8edc8f50cb07f4ef64935e9ecbe43e8e::whusdt::WHUSDT";
	const coinOut =
		"0xc6d6a60b8edc8f50cb07f4ef64935e9ecbe43e8e::whusdc::WHUSDC";
	const coinInAmount = BigInt(100000000000000000);

	debugger;

	try {
		const completeRoute = router.getCompleteRoute(
			coinIn,
			coinInAmount,
			coinOut
		);
		console.log({ completeRoute });
		console.log(completeRoute.routes);
		console.log(completeRoute.routes.length);

		for (const route of completeRoute.routes) {
			console.log("\n\n");
			console.log(route.paths);
		}
	} catch (e) {
		console.error(e);
	}
};

runMe();
