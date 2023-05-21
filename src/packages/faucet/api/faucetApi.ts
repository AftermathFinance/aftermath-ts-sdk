import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Faucet } from "../faucet";
import { EventId, SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { FaucetApiCasting } from "./faucetApiCasting";
import { CoinDecimal, CoinType } from "../../coin/coinTypes";
import {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";
import { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes";
import { FaucetApiHelpers } from "./faucetApiHelpers";
import { SerializedTransaction } from "../../../types";
import { Coin } from "../../coin";

export class FaucetApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new FaucetApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSupportedCoins = async (): Promise<CoinType[]> => {
		const addCoinEvents = await this.fetchAddCoinEvents();
		const coins = addCoinEvents.events.map(
			(event) => "0x" + event.coinType
		);
		const coinsWithoutAfSui = coins.filter(
			(coin) => !coin.toLowerCase().includes("afsui")
		);
		return coinsWithoutAfSui;
	};

	public fetchIsPackageOnChain = () => {
		const faucetPackageId = this.Provider.addresses.faucet?.packages.faucet;
		if (!faucetPackageId) throw new Error("faucet package id is unset");

		return this.Provider.Objects().fetchDoesObjectExist(faucetPackageId);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchRequestCoinAmountTransaction = async (inputs: {
		coinType: CoinType;
		coinPrice: number;
		coinDecimals: CoinDecimal;
		walletAddress: SuiAddress;
	}): Promise<SerializedTransaction> => {
		const { coinType, coinPrice, coinDecimals, walletAddress } = inputs;

		const requestAmount =
			Faucet.constants.defaultRequestAmountUsd /
			(coinPrice <= 0 ? 1 : coinPrice);
		const requestAmountWithDecimals = Coin.normalizeBalance(
			requestAmount,
			coinDecimals
		);

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		this.Helpers.requestCoinAmountTx({
			tx,
			coinType,
			amount: requestAmountWithDecimals,
		});

		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			tx
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchMintCoinEvents = async (cursor?: EventId, limit?: number) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			FaucetMintCoinEventOnChain,
			FaucetMintCoinEvent
		>(
			{
				MoveEventType: this.Helpers.eventTypes.mintCoin,
			},
			FaucetApiCasting.faucetMintCoinEventFromOnChain,
			cursor,
			limit
		);

	public fetchAddCoinEvents = async (cursor?: EventId, limit?: number) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			FaucetAddCoinEventOnChain,
			FaucetAddCoinEvent
		>(
			{
				MoveEventType: this.Helpers.eventTypes.addCoin,
			},
			FaucetApiCasting.faucetAddCoinEventFromOnChain,
			cursor,
			limit
		);
}
