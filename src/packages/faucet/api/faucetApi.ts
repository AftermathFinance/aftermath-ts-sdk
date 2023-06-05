import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Faucet } from "../faucet";
import {
	EventId,
	ObjectId,
	SuiAddress,
	TransactionBlock,
} from "@mysten/sui.js";
import { FaucetApiCasting } from "./faucetApiCasting";
import { CoinDecimal, CoinType } from "../../coin/coinTypes";
import {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";
import { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes";
import {
	AnyObjectType,
	Balance,
	EventsInputs,
	FaucetAddresses,
	SerializedTransaction,
} from "../../../types";
import { Coin } from "../../coin";
import { TransactionsApiHelpers } from "../../../general/api/transactionsApiHelpers";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";

export class FaucetApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		faucetModuleName: "faucet",
		faucetRegistryModuleName: "faucet_registry",
		functions: {
			add: {
				name: "add_coin",
			},
			request: {
				name: "request_coin",
			},
			requestAmount: {
				name: "request_coin_amount",
			},
		},
		eventNames: {
			mintCoin: "MintedCoin",
			addCoin: "AddedCoinEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: FaucetAddresses;

	public readonly eventTypes: {
		mintCoin: AnyObjectType;
		addCoin: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.faucet;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;

		this.eventTypes = {
			mintCoin: this.mintCoinEventType(),
			addCoin: this.addCoinEventType(),
		};
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchSupportedCoins = async (): Promise<CoinType[]> => {
		const addCoinEvents = await this.fetchAddCoinEvents({});
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

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchRequestCoinAmountTx = async (inputs: {
		coinType: CoinType;
		coinPrice: number;
		coinDecimals: CoinDecimal;
		walletAddress: SuiAddress;
	}): Promise<TransactionBlock> => {
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

		this.requestCoinAmountTx({
			tx,
			coinType,
			amount: requestAmountWithDecimals,
		});

		return tx;
	};

	public fetchRequestCustomCoinAmountTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		amount: bigint;
	}): Promise<TransactionBlock> => {
		const { walletAddress, coinType, amount } = inputs;
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		this.requestCoinAmountTx({
			tx,
			coinType,
			amount,
		});

		return tx;
	};
	// =========================================================================
	//  Transcations
	// =========================================================================

	public addCoinTx = (inputs: {
		tx: TransactionBlock;
		treasuryCapId: ObjectId;
		treasuryCapType: AnyObjectType;
	}) => {
		const { tx, treasuryCapId, treasuryCapType } = inputs;

		return tx.moveCall({
			target: TransactionsApiHelpers.createTransactionTarget(
				this.addresses.packages.faucet,
				FaucetApi.constants.faucetModuleName,
				FaucetApi.constants.functions.add.name
			),
			typeArguments: [treasuryCapType],
			arguments: [
				tx.object(this.addresses.objects.faucet),
				tx.object(treasuryCapId),
			],
		});
	};

	public requestCoinAmountTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		amount: Balance;
	}) => {
		const { tx, coinType, amount } = inputs;

		return tx.moveCall({
			target: TransactionsApiHelpers.createTransactionTarget(
				this.addresses.packages.faucet,
				FaucetApi.constants.faucetModuleName,
				FaucetApi.constants.functions.requestAmount.name
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.faucet),
				tx.pure(amount),
			],
		});
	};

	public requestCoinTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;

		return tx.moveCall({
			target: TransactionsApiHelpers.createTransactionTarget(
				this.addresses.packages.faucet,
				FaucetApi.constants.faucetModuleName,
				FaucetApi.constants.functions.request.name
			),
			typeArguments: [coinType],
			arguments: [tx.object(this.addresses.objects.faucet)],
		});
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchMintCoinEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			FaucetMintCoinEventOnChain,
			FaucetMintCoinEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.mintCoin,
			},
			eventFromEventOnChain:
				FaucetApiCasting.faucetMintCoinEventFromOnChain,
		});

	public fetchAddCoinEvents = async (inputs: EventsInputs) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			FaucetAddCoinEventOnChain,
			FaucetAddCoinEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.addCoin,
			},
			eventFromEventOnChain:
				FaucetApiCasting.faucetAddCoinEventFromOnChain,
		});

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private mintCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			this.addresses.packages.faucet,
			FaucetApi.constants.faucetModuleName,
			FaucetApi.constants.eventNames.mintCoin
		);
	};

	private addCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			this.addresses.packages.faucet,
			FaucetApi.constants.faucetModuleName,
			FaucetApi.constants.eventNames.addCoin
		);
	};
}
