import { AftermathApi } from "../../../general/providers/aftermathApi";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import {
	MoveCallTransaction,
	ObjectId,
	SignableTransaction,
} from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Balance, FaucetAddresses, GasBudget } from "../../../types";

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

	public readonly faucetAddresses: FaucetAddresses;
	public readonly coinTypes: {
		af: CoinType;
		afSui: CoinType;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(protected readonly rpcProvider: AftermathApi) {
		const faucetAddresses = this.rpcProvider.addresses.faucet;
		if (!faucetAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.rpcProvider = rpcProvider;
		this.faucetAddresses = faucetAddresses;

		this.coinTypes = {
			af: `${faucetAddresses.packages.faucet}::af::AF`,
			afSui: `${faucetAddresses.packages.faucet}::afsui::AFSUI`,
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	public faucetMintCoinEventType = () => {
		return EventsApiHelpers.createEventType(
			AftermathApi.constants.packages.sui.packageId,
			this.faucetAddresses.packages.faucet,
			FaucetApiHelpers.constants.eventNames.mintedCoin
		);
	};

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
				packageObjectId: this.faucetAddresses.packages.faucet,
				module: FaucetApiHelpers.constants.faucetModuleName,
				function: FaucetApiHelpers.constants.functions.add.name,
				typeArguments: [treasuryCapType],
				arguments: [this.faucetAddresses.objects.faucet, treasuryCapId],
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
				packageObjectId: this.faucetAddresses.packages.faucet,
				module: FaucetApiHelpers.constants.faucetModuleName,
				function:
					FaucetApiHelpers.constants.functions.requestAmount.name,
				typeArguments: [coinType],
				arguments: [
					this.faucetAddresses.objects.faucet,
					amount.toString(),
				],
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
				packageObjectId: this.faucetAddresses.packages.faucet,
				module: FaucetApiHelpers.constants.faucetModuleName,
				function: FaucetApiHelpers.constants.functions.request.name,
				typeArguments: [coinType],
				arguments: [this.faucetAddresses.objects.faucet],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	protected faucetSupportedCoinsMoveCall = (): MoveCallTransaction => {
		return {
			packageObjectId: this.faucetAddresses.packages.faucet,
			module: FaucetApiHelpers.constants.faucetRegistryModuleName,
			function: "typenames",
			typeArguments: [],
			arguments: [this.faucetAddresses.objects.faucetRegistry],
		};
	};
}
