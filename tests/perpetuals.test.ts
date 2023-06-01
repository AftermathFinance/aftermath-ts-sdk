import { Connection, JsonRpcProvider } from "@mysten/sui.js";
import { Aftermath, AftermathApi } from "../src/general/providers";
import {
	ASK,
	BID,
	adminPrivateKey,
	user1PrivateKey,
	user2PrivateKey,
	user3PrivateKey,
	user4PrivateKey,
	LOT_SIZE,
	TICK_SIZE,
	MARKET_ID_1,
	ACCOUNT_ID,
	fromOraclePriceToOrderbookPrice,
	getSigner,
} from "./utils";

import { perpetualsConfig } from "./perpetualsConfig";

// =========================================================================
// TEST CASE FLOW
// =========================================================================
describe("Perpetuals Tests", () => {
	test("Test Case 1", async () => {
		const connection = new Connection({
			fullnode: "http://127.0.0.1:9000",
		});
		const provider = new JsonRpcProvider(connection);
		const aftermathApi = new AftermathApi(provider, perpetualsConfig);

		// Create package provider

		let admin = getSigner(adminPrivateKey, aftermathApi);
		let user1 = getSigner(user1PrivateKey, aftermathApi);
		let user2 = getSigner(user2PrivateKey, aftermathApi);
		let user3 = getSigner(user3PrivateKey, aftermathApi);
		let user4 = getSigner(user4PrivateKey, aftermathApi);

		let tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsInitializeForCollateralTx({
				walletAddress:
					"0x2d78d396d59080e2ee66d73cb09ce28b70708b0672c390bcb68cff529e298964",
				coinType:
					"0xe351053c6ebdaa3f6294e6cdd7be5bd6d4c1e693e66b50db4c30ea8ec175bacc::usdc::USDC",
			});

		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		console.log(tx);
	}, 50000000000);
});
