import { AftermathApi } from "../../general/providers/aftermathApi";
import { CoinType } from "../../types";
import { CoinApiHelpers } from "../coin/coinApiHelpers";
import { ObjectsApiHelpers } from "../../general/api/objectsApiHelpers";
import { Faucet } from "./faucet";

export class FaucetApi {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly rpcProvider: AftermathApi) {
		this.rpcProvider = rpcProvider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchFaucetSupportedCoins = () => {
		const faucetPackageId =
			this.rpcProvider.addresses.faucet?.packages.faucet;
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
		const faucetPackageId =
			this.rpcProvider.addresses.faucet?.packages.faucet;
		if (!faucetPackageId) throw new Error("faucet package id is unset");

		return new ObjectsApiHelpers(this.rpcProvider).fetchDoesObjectExist(
			faucetPackageId
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchFaucetRequestCoinAmountTransaction = async (coin: CoinType) => {
		const prices = await fetchPythPrices([coin]);

		const price = prices[0];
		if (price === 0) throw new Error("price of 0");

		const requestAmount = Faucet.constants.defaultRequestAmountUsd / price;
		const requestAmountWithDecimals = await new CoinApiHelpers(
			this.rpcProvider
		).fetchCoinDecimalsNormalizeBalance(coin, requestAmount);

		const transaction = faucetRequestCoinAmountTransaction(
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
		await fetchCastEventsWithCursor<
			FaucetMintCoinEventOnChain,
			FaucetMintCoinEvent
		>(
			{
				MoveEvent: faucetMintCoinEventType(),
			},
			faucetMintCoinEventFromOnChain,
			cursor,
			eventLimit
		);
}
