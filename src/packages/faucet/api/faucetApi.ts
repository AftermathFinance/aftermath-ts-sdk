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

/**
 * Provides faucet transaction builders and event queries for `AftermathApi`.
 *
 * The transaction methods use the configured faucet and SuiFrens addresses,
 * while the event methods query and cast the corresponding on-chain events.
 */
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

	/**
	 * Package and shared-object addresses used by faucet transactions.
	 */
	public readonly addresses: FaucetAddresses;

	/**
	 * Move event type strings used by the faucet event queries.
	 */
	public readonly eventTypes: {
		mintCoin: AnyObjectType;
		addCoin: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a faucet API helper from an Aftermath provider.
	 *
	 * @param api - Provider that supplies faucet addresses, event queries, and coin helpers.
	 * @throws `Error` when the provider does not include the required faucet addresses.
	 */
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

	/**
	 * Fetches the coin types registered with the faucet.
	 *
	 * The method reads `AddedCoin` events and returns each coin type with its
	 * `0x` prefix.
	 *
	 * @returns The registered faucet coin types.
	 */
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
	 *
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.coinType - Coin type to mint.
	 * @returns The transaction result containing the minted coin.
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

	/**
	 * Adds a `mint_and_keep` Move call for a SuiFren.
	 *
	 * The payment coin may be an object ID or an argument from the supplied
	 * transaction. The method mutates `inputs.tx` and leaves the minted result in
	 * the transaction for the caller to compose.
	 *
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.suiPaymentCoinId - SUI payment coin object ID or transaction argument.
	 * @param inputs.suiFrenType - SuiFren object type to mint.
	 * @returns The result of the added Move call.
	 */
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

	/**
	 * Builds a transaction that mints and transfers one faucet coin.
	 *
	 * The returned transaction sets `walletAddress` as sender and recipient.
	 *
	 * @param inputs - Coin type to mint and wallet that receives it.
	 * @returns A new transaction containing the mint and transfer commands.
	 */
	public buildRequestCoinTx = (inputs: ApiFaucetRequestBody): Transaction => {
		const { walletAddress, coinType } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const coin = this.requestCoinTx({ tx, coinType });
		tx.transferObjects([coin], walletAddress);

		return tx;
	};

	/**
	 * Fetches a SUI payment coin and builds a SuiFren mint transaction.
	 *
	 * The payment amount is taken from `mintFee`, and the returned transaction
	 * sets `walletAddress` as its sender.
	 *
	 * @param inputs - Mint fee, SuiFren type, and wallet that signs the transaction.
	 * @returns A promise for the transaction that pays the fee and mints the SuiFren.
	 */
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

	/**
	 * Fetches faucet coin-mint events with cursor pagination.
	 *
	 * @param inputs - Optional event cursor and page limit.
	 * @returns The cast mint events and the next pagination cursor.
	 */
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

	/**
	 * Fetches faucet coin-registration events with cursor pagination.
	 *
	 * @param inputs - Optional event cursor and page limit.
	 * @returns The cast registration events and the next pagination cursor.
	 */
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
