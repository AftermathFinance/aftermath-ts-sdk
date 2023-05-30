import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers";
import {
    PerpetualsAdminCapability,
	AnyObjectType,
	Balance,
	CoinType,
	PerpetualsAddresses,
    PerpetualsRegistry,
} from "../../../types";
import { Helpers } from "../../../general/utils";

export class PerpetualsHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: PerpetualsAddresses;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.perpetuals;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////
	public fetchInitializeForCollateral = async (inputs: {
		walletAddress: SuiAddress;
        coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.XInitializeForCollateral({
			tx,
			...inputs
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////
    public XInitializeForCollateral = (inputs: {
		tx: TransactionBlock;
        coinType: CoinType;
	}) => {
		const { tx, coinType, } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsHelpers.constants.moduleNames.interface,
				"initialize_for_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.adminCapability),
				tx.object(this.addresses.objects.registry),
			],
		});
	};
}