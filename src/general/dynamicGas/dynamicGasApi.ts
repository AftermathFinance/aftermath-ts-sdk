import { Helpers } from "../utils/helpers";
import { AftermathApi } from "../providers/aftermathApi";
import { CoinType } from "../../packages/coin/coinTypes";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Sui } from "../../packages";
import { ApiDynamicGasResponse, ObjectId, SuiAddress } from "../types";
import { SerializedSignature } from "@mysten/sui.js/cryptography";

export class DynamicGasApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	// =========================================================================
	//  Tx Setup
	// =========================================================================

	public fetchUseDynamicGasForTx = async (inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		gasCoinType: CoinType;
	}): Promise<ApiDynamicGasResponse> => {
		const { tx, gasCoinType, walletAddress } = inputs;

		const mergeCoinTxs = tx.blockData.transactions.filter(
			(tx) => tx.kind === "MergeCoins"
		);
		mergeCoinTxs.find((tx) => tx.kind === "MergeCoins" && tx.destination);

		const txBytes = await tx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});
		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		const gasSplitMoveCall = tx.blockData.transactions.find(
			(command) =>
				command.kind === "MoveCall" &&
				command.target ===
					Helpers.transactions.createTxTarget(
						Sui.constants.addresses.suiPackageId,
						"pay",
						"split_vec"
					) &&
				command.typeArguments.length > 0 &&
				Helpers.addLeadingZeroesToType(command.typeArguments[0]) ===
					Helpers.addLeadingZeroesToType(gasCoinType)
		);
		const coinIds = await (gasSplitMoveCall &&
		"arguments" in gasSplitMoveCall &&
		"value" in gasSplitMoveCall.arguments[0]
			? [gasSplitMoveCall.arguments[0].value as ObjectId]
			: (
					await this.Provider.Coin().fetchAllCoins({
						walletAddress,
						coinType: gasCoinType,
					})
			  ).map((coin) => coin.coinObjectId));

		const res: {
			tx_data: string;
			signature: SerializedSignature;
		} = await this.Provider.indexerCaller.fetchIndexer("sponsor.json", {
			sender: walletAddress,
			gas_coins: coinIds,
			transaction: b64TxBytes,
		});

		return {
			txBytes: res.tx_data,
			sponsoredSignature: res.signature,
		};
	};
}
