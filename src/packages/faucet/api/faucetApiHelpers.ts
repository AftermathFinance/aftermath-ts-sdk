import { AftermathApi } from "../../../general/providers/aftermathApi";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { ObjectId, SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import {
	AnyObjectType,
	Balance,
	FaucetAddresses,
	GasBudget,
} from "../../../types";

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
	public readonly coinTypes: {
		af: CoinType;
		afSui: CoinType;
	};
	public readonly eventTypes: {
		mintCoin: AnyObjectType;
		addCoin: AnyObjectType;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const faucetAddresses = this.Provider.addresses.faucet;
		if (!faucetAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = faucetAddresses;

		this.coinTypes = {
			af: `${faucetAddresses.packages.faucet}::af::AF`,
			afSui: `${faucetAddresses.packages.faucet}::afsui::AFSUI`,
		};

		this.eventTypes = {
			mintCoin: this.mintCoinEventType(),
			addCoin: this.addCoinEventType(),
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Transcations
	/////////////////////////////////////////////////////////////////////

	public faucetAddCoinTransaction = (
		treasuryCapId: ObjectId,
		treasuryCapType: CoinType
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
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

		return tx;
	};

	public faucetRequestCoinAmountTransaction = (
		coinType: CoinType,
		amount: Balance,
		walletAddress: SuiAddress
	): TransactionBlock => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
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

		return tx;
	};

	public faucetRequestCoinTransaction = (
		coinType: CoinType
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.faucet,
				FaucetApiHelpers.constants.faucetModuleName,
				FaucetApiHelpers.constants.functions.request.name
			),
			typeArguments: [coinType],
			arguments: [tx.object(this.addresses.objects.faucet)],
		});

		return tx;
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
