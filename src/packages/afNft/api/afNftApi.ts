import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinType,
	DynamicFieldObjectsWithCursor,
	Nft,
	AfNftAddresses,
	ObjectId,
	Slippage,
	SuiAddress,
	AnyObjectType,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../../coin/coin";
import { Pools } from "../../pools/pools";
import {
	TransactionArgument,
	TransactionBlock,
	TransactionObjectArgument,
} from "@mysten/sui.js/transactions";

export class AfNftApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			whitelistManager: "wl_manager",
			egg: "egg",
			kioskLockRule: "kiosk_lock_rule",
			kioskRoyaltyRule: "royalty_rule",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: AfNftAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.afNft;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public proveRuleTx = (inputs: {
		tx: TransactionBlock;
		nftType: AnyObjectType;
		kioskId: ObjectId;
		transferRequestId: ObjectId;
	}) => {
		const { tx, nftType, kioskId, transferRequestId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.afEgg,
				AfNftApi.constants.moduleNames.kioskLockRule,
				"prove"
			),
			typeArguments: [nftType],
			arguments: [tx.object(transferRequestId), tx.object(kioskId)],
		});
	};

	public payRoyaltyRuleTx = (inputs: {
		tx: TransactionBlock;
		nftType: AnyObjectType;
		coinId: ObjectId;
		transferPolicyId: ObjectId;
		transferRequestId: ObjectId;
	}) => {
		const { tx, nftType, coinId, transferPolicyId, transferRequestId } =
			inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.afEgg,
				AfNftApi.constants.moduleNames.kioskRoyaltyRule,
				"pay"
			),
			typeArguments: [nftType],
			arguments: [
				tx.object(transferPolicyId),
				tx.object(transferRequestId),
				tx.object(coinId),
			],
		});
	};
}
