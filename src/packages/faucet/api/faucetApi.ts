import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Faucet } from "../faucet";
import { EventId } from "@mysten/sui.js";
import { FaucetApiCasting } from "./faucetApiCasting";
import { CoinType } from "../../coin/coinTypes";
import { FaucetMintCoinEventOnChain } from "./faucetApiCastingTypes";
import { FaucetMintCoinEvent } from "../faucetTypes";
import { FaucetApiHelpers } from "./faucetApiHelpers";

export class FaucetApi extends FaucetApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(Provider: AftermathApi) {
		super(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchFaucetSupportedCoins = () => {
		const faucetPackageId = this.Provider.addresses.faucet?.packages.faucet;
		if (!faucetPackageId) throw new Error("faucet package id is unset");

		const coinSymbols = [
			"usdc",
			"whusdc",
			"lzusdc",
			"axlusdc",
			"whusdt",
			"lzusdt",
			"axldai",
			"wheth",
			"lzeth",
			"whbtc",
			"btcb",
			"af",
		];

		const coinTypes: CoinType[] = coinSymbols.map(
			(coinSymbol) =>
				`${faucetPackageId}::${coinSymbol.toLowerCase()}::${coinSymbol.toUpperCase()}`
		);
		return coinTypes;
	};

	// TODO: replace above function with below once support is added in contract
	// for typenames function

	// public fetchFaucetSupportedCoins = async () => {
	// 	const signer: SuiAddress = config.constants.devInspectSigner;
	// 	const moveCallTransaction = faucetSupportedCoinsMoveCall();
	// 	const bytes = await fetchBytesFromMoveCallTransaction(signer, moveCallTransaction);
	// 	return stringFromBytes(bytes);
	// };

	public fetchIsFaucetPackageOnChain = () => {
		const faucetPackageId = this.Provider.addresses.faucet?.packages.faucet;
		if (!faucetPackageId) throw new Error("faucet package id is unset");

		return this.Provider.Objects.fetchDoesObjectExist(faucetPackageId);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchFaucetRequestCoinAmountTransaction = async (coin: CoinType) => {
		const price = await this.Provider.Prices.fetchPrice(coin);

		const requestAmount = Faucet.constants.defaultRequestAmountUsd / price;
		const requestAmountWithDecimals =
			await this.Provider.Coin.fetchCoinDecimalsNormalizeBalance(
				coin,
				requestAmount
			);

		const transaction = this.faucetRequestCoinAmountTransaction(
			coin as CoinType,
			requestAmountWithDecimals
		);

		return transaction;
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchFaucetMintCoinEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events.fetchCastEventsWithCursor<
			FaucetMintCoinEventOnChain,
			FaucetMintCoinEvent
		>(
			{
				MoveEvent: this.eventTypes.mintCoin,
			},
			FaucetApiCasting.faucetMintCoinEventFromOnChain,
			cursor,
			eventLimit
		);
}
