import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Faucet } from "../faucet";
import { EventId } from "@mysten/sui.js";
import { FaucetApiCasting } from "./faucetApiCasting";
import { CoinType } from "../../coin/coinTypes";
import {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";
import { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes";
import { FaucetApiHelpers } from "./faucetApiHelpers";
import { SerializedTransaction } from "../../../types";

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
		const coins = addCoinEvents.events.map((event) => "0x" + event.type);
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

	public fetchRequestCoinAmountTransaction = async (
		coin: CoinType
	): Promise<SerializedTransaction> => {
		const price = await this.Provider.Prices().fetchPrice(coin);

		const requestAmount = Faucet.constants.defaultRequestAmountUsd / price;
		const requestAmountWithDecimals =
			await this.Provider.Coin().Helpers.fetchCoinDecimalsNormalizeBalance(
				coin,
				requestAmount
			);

		const transaction = this.Helpers.faucetRequestCoinAmountTransaction(
			coin as CoinType,
			requestAmountWithDecimals
		);

		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			transaction
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
