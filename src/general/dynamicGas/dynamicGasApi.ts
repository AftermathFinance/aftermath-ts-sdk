import { Helpers } from "../utils/helpers";
import { AftermathApi } from "../providers/aftermathApi";
import { CoinType, ServiceCoinData } from "../../packages/coin/coinTypes";
import { Transaction } from "@mysten/sui/transactions";
import {
	ApiDynamicGasResponse,
	DynamicGasAddresses,
	SuiAddress,
	TxBytes,
} from "../types";

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
		tx: Transaction;
		walletAddress: SuiAddress;
		gasCoinType: CoinType;
	}): Promise<ApiDynamicGasResponse> => {
		const { tx, gasCoinType, walletAddress } = inputs;

		// TODO: handle all split cases
		const gasSplitMoveCall = tx.getData().commands.find(
			(command) =>
				command.$kind === "MoveCall" &&
				command.MoveCall.package ===
					Helpers.addLeadingZeroesToType(
						// Sui.constants.addresses.suiPackageId
						"0x2"
					) &&
				command.MoveCall.module === "coin" &&
				command.MoveCall.function === "split" &&
				command.MoveCall.typeArguments.length > 0 &&
				Helpers.addLeadingZeroesToType(
					command.MoveCall.typeArguments[0]
				) === Helpers.addLeadingZeroesToType(gasCoinType)
		);

		const gasCoin: ServiceCoinData = await (async () => {
			if (
				!gasSplitMoveCall ||
				!("arguments" in gasSplitMoveCall) ||
				(gasSplitMoveCall.MoveCall?.arguments &&
					gasSplitMoveCall.MoveCall.arguments[0].$kind === "GasCoin")
			) {
				const allCoins = await this.Provider.Coin().fetchAllCoins({
					walletAddress,
					coinType: gasCoinType,
				});
				const coinIds = allCoins.map((coin) => coin.coinObjectId);

				if (coinIds.length <= 1) {
					return Helpers.transactions.serviceCoinDataFromCoinTxArg({
						coinTxArg: coinIds[0],
					});
				}

				const mergedCoinArg = tx.object(coinIds[0]);
				tx.mergeCoins(
					mergedCoinArg,
					coinIds.slice(1).map((coinId) => tx.object(coinId))
				);

				return Helpers.transactions.serviceCoinDataFromCoinTxArg({
					coinTxArg: mergedCoinArg,
				});
			}

			const gasCoinArg = gasSplitMoveCall.MoveCall!.arguments[0];
			return Helpers.transactions.serviceCoinDataFromCoinTxArg({
				coinTxArg: gasCoinArg,
			});
		})();

		const txBytes = await tx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});
		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		const body: {
			gas_coin: ServiceCoinData;
			gas_asset: CoinType;
			transaction_kind: TxBytes;
			sender: SuiAddress;
			sponsor: SuiAddress;
		} = {
			// TODO: make it so `as` doesn't have to be used here!
			gas_coin: gasCoin,
			gas_asset: gasCoinType,
			transaction_kind: b64TxBytes,
			sender: walletAddress,
			sponsor: this.addresses.sponsorAddress,
		};

		const res: {
			tx_data: string;
			signature: string;
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
