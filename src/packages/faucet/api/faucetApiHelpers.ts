import { AftermathApi } from "../../../general/providers/aftermathApi";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { ObjectId, TransactionBlock } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import {
	AnyObjectType,
	Balance,
	FaucetAddresses,
	GasBudget,
} from "../../../types";
import { Sui } from "../../sui/sui";

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
				defaultGasBudget: 10000000,
			},
			request: {
				name: "request_coin",
				defaultGasBudget: 10000000,
			},
			requestAmount: {
				name: "request_coin_amount",
				defaultGasBudget: 10000000,
			},
		},
		eventNames: {
			mintedCoin: "MintedCoin",
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
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Transcations
	/////////////////////////////////////////////////////////////////////

	public faucetAddCoinTransaction = (
		treasuryCapId: ObjectId,
		treasuryCapType: CoinType,
		gasBudget: GasBudget = FaucetApiHelpers.constants.functions.add
			.defaultGasBudget
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
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public faucetRequestCoinAmountTransaction = (
		coinType: CoinType,
		amount: Balance,
		gasBudget: GasBudget = FaucetApiHelpers.constants.functions
			.requestAmount.defaultGasBudget
	): TransactionBlock => {
		const tx = new TransactionBlock();

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
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public faucetRequestCoinTransaction = (
		coinType: CoinType,
		gasBudget: GasBudget = FaucetApiHelpers.constants.functions.request
			.defaultGasBudget
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
		tx.setGasBudget(gasBudget);

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	// public faucetSupportedCoinsMoveCall = (): Transaction => {
	// 	return {
	// 		packageObjectId: this.addresses.packages.faucet,
	// 		module: FaucetApiHelpers.constants.faucetRegistryModuleName,
	// 		function: "typenames",
	// 		typeArguments: [],
	// 		arguments: [this.addresses.objects.faucetRegistry],
	// 	};
	// };

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	private mintCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			Sui.constants.addresses.suiPackageId,
			this.addresses.packages.faucet,
			FaucetApiHelpers.constants.eventNames.mintedCoin
		);
	};
}
