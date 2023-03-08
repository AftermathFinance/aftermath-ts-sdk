import { AftermathApi } from "../../../general/providers/aftermathApi";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import {
	MoveCallTransaction,
	ObjectId,
	SignableTransaction,
} from "@mysten/sui.js";
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
				defaultGasBudget: 1000,
			},
			request: {
				name: "request_coin",
				defaultGasBudget: 1000,
			},
			requestAmount: {
				name: "request_coin_amount",
				defaultGasBudget: 1000,
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

	constructor(protected readonly Provider: AftermathApi) {
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
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transcations
	/////////////////////////////////////////////////////////////////////

	protected faucetAddCoinTransaction = (
		treasuryCapId: ObjectId,
		treasuryCapType: CoinType,
		gasBudget: GasBudget = FaucetApiHelpers.constants.functions.add
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.faucet,
				module: FaucetApiHelpers.constants.faucetModuleName,
				function: FaucetApiHelpers.constants.functions.add.name,
				typeArguments: [treasuryCapType],
				arguments: [this.addresses.objects.faucet, treasuryCapId],
				gasBudget: gasBudget,
			},
		};
	};

	protected faucetRequestCoinAmountTransaction = (
		coinType: CoinType,
		amount: Balance,
		gasBudget: GasBudget = FaucetApiHelpers.constants.functions
			.requestAmount.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.faucet,
				module: FaucetApiHelpers.constants.faucetModuleName,
				function:
					FaucetApiHelpers.constants.functions.requestAmount.name,
				typeArguments: [coinType],
				arguments: [this.addresses.objects.faucet, amount.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected faucetRequestCoinTransaction = (
		coinType: CoinType,
		gasBudget: GasBudget = FaucetApiHelpers.constants.functions.request
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.faucet,
				module: FaucetApiHelpers.constants.faucetModuleName,
				function: FaucetApiHelpers.constants.functions.request.name,
				typeArguments: [coinType],
				arguments: [this.addresses.objects.faucet],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	protected faucetSupportedCoinsMoveCall = (): MoveCallTransaction => {
		return {
			packageObjectId: this.addresses.packages.faucet,
			module: FaucetApiHelpers.constants.faucetRegistryModuleName,
			function: "typenames",
			typeArguments: [],
			arguments: [this.addresses.objects.faucetRegistry],
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	private mintCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			AftermathApi.constants.packages.sui.packageId,
			this.addresses.packages.faucet,
			FaucetApiHelpers.constants.eventNames.mintedCoin
		);
	};
}
