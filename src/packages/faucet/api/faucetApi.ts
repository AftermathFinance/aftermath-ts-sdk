import {
	Transaction,
	type TransactionArgument,
} from "@mysten/sui/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import type {
	AnyObjectType,
	EventsInputs,
	FaucetAddresses,
	ObjectId,
} from "../../../types";
import { Coin } from "../../coin";
import type { CoinType } from "../../coin/coinTypes";
import { Sui } from "../../sui";
import type {
	ApiFaucetMintSuiFrenBody,
	ApiFaucetRequestBody,
	FaucetAddCoinEvent,
	FaucetMintCoinEvent,
} from "../faucetTypes";
import { FaucetApiCasting } from "./faucetApiCasting";
import type {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";

export class FaucetApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			faucet: "faucet",
			suiFrensGenesisWrapper: "genesis_wrapper",
		},
		eventNames: {
			mintCoin: "MintedCoin",
			addCoin: "AddedCoin",
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

	constructor(private readonly api: AftermathApi) {
		const addresses = this.api.addresses.faucet;
		if (!addresses) {
			throw new Error("not all required addresses have been set in provider");
		}

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
		const coins = addCoinEvents.events.map((event) => `0x${event.coinType}`);
		return coins;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	/**
	 * Mints `coinType`'s configured default amount and returns the resulting
	 * `Coin<T>`. Use {@link buildRequestCoinTx} to mint and transfer it to a
	 * wallet in one transaction.
	 */
	public requestCoinTx = (inputs: { tx: Transaction; coinType: CoinType }) => {
		const { tx, coinType } = inputs;

		return tx.moveCall({
			target: TransactionsApiHelpers.createTxTarget(
				this.addresses.packages.faucet,
				FaucetApi.constants.moduleNames.faucet,
				"mint"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.faucet),
				tx.object(this.addresses.objects.config),
			],
		});
	};

	public mintSuiFrenTx = (inputs: {
		tx: Transaction;
		suiPaymentCoinId: ObjectId | TransactionArgument;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx, suiPaymentCoinId, suiFrenType } = inputs;

		return tx.moveCall({
			target: TransactionsApiHelpers.createTxTarget(
				this.addresses.packages.suiFrensGenesisWrapper,
				FaucetApi.constants.moduleNames.suiFrensGenesisWrapper,
				"mint_and_keep"
			),
			typeArguments: [suiFrenType],
			arguments: [
				tx.object(this.addresses.objects.suiFrensMint), // Mint
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof suiPaymentCoinId === "string"
					? tx.object(suiPaymentCoinId)
					: suiPaymentCoinId, // Coin
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public buildRequestCoinTx = (inputs: ApiFaucetRequestBody): Transaction => {
		const { walletAddress, coinType } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const coin = this.requestCoinTx({ tx, coinType });
		tx.transferObjects([coin], walletAddress);

		return tx;
	};

	public fetchBuildMintSuiFrenTx = async (inputs: ApiFaucetMintSuiFrenBody) => {
		const { walletAddress, mintFee, suiFrenType } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const suiPaymentCoinId = await this.api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: Coin.constants.suiCoinType,
			coinAmount: mintFee,
		});

		this.mintSuiFrenTx({ tx, suiPaymentCoinId, suiFrenType });

		return tx;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchMintCoinEvents = async (inputs: EventsInputs) =>
		await this.api
			.Events()
			.fetchCastEventsWithCursor<
				FaucetMintCoinEventOnChain,
				FaucetMintCoinEvent
			>({
				...inputs,
				query: {
					MoveEventType: this.eventTypes.mintCoin,
				},
				eventFromEventOnChain: FaucetApiCasting.faucetMintCoinEventFromOnChain,
			});

	public fetchAddCoinEvents = async (inputs: EventsInputs) =>
		await this.api
			.Events()
			.fetchCastEventsWithCursor<FaucetAddCoinEventOnChain, FaucetAddCoinEvent>(
				{
					...inputs,
					query: {
						MoveEventType: this.eventTypes.addCoin,
					},
					eventFromEventOnChain: FaucetApiCasting.faucetAddCoinEventFromOnChain,
				}
			);

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private readonly mintCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			this.addresses.packages.faucet,
			FaucetApi.constants.moduleNames.faucet,
			FaucetApi.constants.eventNames.mintCoin
		);
	};

	private readonly addCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			this.addresses.packages.faucet,
			FaucetApi.constants.moduleNames.faucet,
			FaucetApi.constants.eventNames.addCoin
		);
	};
}
