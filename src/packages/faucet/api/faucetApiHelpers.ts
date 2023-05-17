import { AftermathApi } from "../../../general/providers/aftermathApi";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { ObjectId, SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { AnyObjectType, Balance, FaucetAddresses } from "../../../types";
import { Helpers } from "../../../general/utils";

export class FaucetApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

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

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: FaucetAddresses;

	public readonly eventTypes: {
		mintCoin: AnyObjectType;
		addCoin: AnyObjectType;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.faucet;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;

		this.eventTypes = {
			mintCoin: this.mintCoinEventType(),
			addCoin: this.addCoinEventType(),
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Transcations
	/////////////////////////////////////////////////////////////////////

	public addCoinTx = (inputs: {
		tx: TransactionBlock;
		treasuryCapId: ObjectId;
		treasuryCapType: AnyObjectType;
	}) => {
		const { tx, treasuryCapId, treasuryCapType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.faucet,
				FaucetApiHelpers.constants.faucetModuleName,
				FaucetApiHelpers.constants.functions.add.name
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
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.faucet,
				FaucetApiHelpers.constants.faucetModuleName,
				FaucetApiHelpers.constants.functions.requestAmount.name
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.faucet),
				tx.pure(amount.toString()),
			],
		});
	};

	public requestCoinTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.faucet,
				FaucetApiHelpers.constants.faucetModuleName,
				FaucetApiHelpers.constants.functions.request.name
			),
			typeArguments: [coinType],
			arguments: [tx.object(this.addresses.objects.faucet)],
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	protected mintCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			this.addresses.packages.faucet,
			FaucetApiHelpers.constants.faucetModuleName,
			FaucetApiHelpers.constants.eventNames.mintCoin
		);
	};

	protected addCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			this.addresses.packages.faucet,
			FaucetApiHelpers.constants.faucetModuleName,
			FaucetApiHelpers.constants.eventNames.addCoin
		);
	};
}
