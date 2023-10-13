import { Helpers } from "../utils/helpers";
import { AftermathApi } from "../providers/aftermathApi";
import { CoinType } from "../../packages/coin/coinTypes";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Sui } from "../../packages";
import {
	ApiDynamicGasResponse,
	DynamicGasCoinData,
	ObjectId,
	SuiAddress,
	TxBytes,
} from "../types";
import { SerializedSignature } from "@mysten/sui.js/cryptography";
import { Caller } from "../utils/caller";

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

		// TODO: handle all split cases
		const gasSplitMoveCall = tx.blockData.transactions.find(
			(command) =>
				command.kind === "MoveCall" &&
				command.target ===
					Helpers.transactions.createTxTarget(
						"0x2",
						"coin",
						"split"
					) &&
				command.typeArguments.length > 0 &&
				Helpers.addLeadingZeroesToType(command.typeArguments[0]) ===
					Helpers.addLeadingZeroesToType(gasCoinType)
		);

		const gasCoin = await (async () => {
			if (
				!gasSplitMoveCall ||
				!("arguments" in gasSplitMoveCall) ||
				gasSplitMoveCall.arguments[0].kind === "GasCoin"
			) {
				const allCoins = await this.Provider.Coin().fetchAllCoins({
					walletAddress,
					coinType: gasCoinType,
				});
				const coinIds = allCoins.map((coin) => coin.coinObjectId);

				if (coinIds.length <= 1) {
					return { Coin: coinIds[0] };
				}

				const mergedCoinArg = tx.object(coinIds[0]);
				tx.mergeCoins(
					mergedCoinArg,
					coinIds.slice(1).map((coinId) => tx.object(coinId))
				);

				return { [mergedCoinArg.kind]: mergedCoinArg.index };
			}

			const gasCoinArg = gasSplitMoveCall.arguments[0];
			const gasCoinVal =
				gasCoinArg.kind === "NestedResult"
					? [gasCoinArg.index, gasCoinArg.resultIndex]
					: gasCoinArg.index;

			return { [gasCoinArg.kind]: gasCoinVal };
		})();

		const txBytes = await tx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});
		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		const body: {
			gas_coin: DynamicGasCoinData;
			gas_asset: CoinType;
			transaction_kind: TxBytes;
			sender: SuiAddress;
		} = {
			// TODO: make it so `as` doesn't have to be used here!
			gas_coin: gasCoin as DynamicGasCoinData,
			gas_asset: gasCoinType,
			transaction_kind: b64TxBytes,
			sender: walletAddress,
		};

		const res: {
			tx_data: string;
			signature: SerializedSignature;
		} = await this.Provider.indexerCaller.fetchIndexer(
			"0x62188d0fcd558b68d89dec3e0502fc9d13da7ce36d9e930801f3e323615323cf/apply.json",
			body,
			undefined,
			"sui-dynamic-gas"
		);

		return {
			txBytes: res.tx_data,
			sponsoredSignature: res.signature,
		};
	};
}
