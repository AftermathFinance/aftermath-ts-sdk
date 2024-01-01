import { Helpers } from "../utils/helpers";
import { AftermathApi } from "../providers/aftermathApi";
import { CoinType } from "../../packages/coin/coinTypes";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
	ApiDynamicGasResponse,
	DynamicGasAddresses,
	DynamicGasCoinData,
	SuiAddress,
	TxBytes,
} from "../types";
import { SerializedSignature } from "@mysten/sui.js/cryptography";

export class DynamicGasApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: DynamicGasAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.dynamicGas;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);
		this.addresses = addresses;
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
			sponsor: SuiAddress;
		} = {
			// TODO: make it so `as` doesn't have to be used here!
			gas_coin: gasCoin as DynamicGasCoinData,
			gas_asset: gasCoinType,
			transaction_kind: b64TxBytes,
			sender: walletAddress,
			sponsor: this.addresses.sponsorAddress,
		};

		const res: {
			tx_data: string;
			signature: SerializedSignature;
		} = await this.Provider.indexerCaller.fetchIndexer(
			"dynamic-gas/apply",
			body,
			undefined,
			undefined,
			undefined,
			true
		);

		return {
			txBytes: res.tx_data,
			sponsoredSignature: res.signature,
		};
	};
}
