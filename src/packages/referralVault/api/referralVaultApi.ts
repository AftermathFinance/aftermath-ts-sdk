import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { AftermathApi } from "../../../general/providers/aftermathApi.ts";
import {
	Balance,
	CoinType,
	ReferralVaultAddresses,
	SuiAddress,
} from "../../../types.ts";
import { Casting, Helpers } from "../../../general/utils/index.ts";

export class ReferralVaultApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			referralVault: "referral_vault",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: ReferralVaultAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.referralVault;
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
	//  Transaction Commands
	// =========================================================================

	public updateReferrerTx = (inputs: {
		tx: Transaction;
		referrer: SuiAddress;
	}) => {
		// TODO: handle this case better
		// in try catch in case referrer is invalid address and throws
		try {
			const { tx, referrer } = inputs;

			if (
				tx.blockData.sender &&
				Helpers.addLeadingZeroesToType(tx.blockData.sender) ===
					Helpers.addLeadingZeroesToType(referrer)
			)
				return;

			return tx.moveCall({
				target: Helpers.transactions.createTxTarget(
					this.addresses.packages.referralVault,
					ReferralVaultApi.constants.moduleNames.referralVault,
					"update_referrer_address"
				),
				typeArguments: [],
				arguments: [
					tx.object(this.addresses.objects.referralVault),
					tx.pure.address(referrer),
				],
			});
		} catch (e) {}
	};

	public withdrawRebateTx = (inputs: {
		tx: Transaction;
		coinType: CoinType;
		withTransfer?: boolean;
	}) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApi.constants.moduleNames.referralVault,
				inputs.withTransfer
					? "withdraw_and_transfer"
					: "withdraw_rebate"
			),
			typeArguments: [inputs.coinType],
			arguments: [tx.object(this.addresses.objects.referralVault)],
		});
	};

	public balanceOfRebateTx = (inputs: {
		tx: Transaction;
		coinType: CoinType;
		referrer: SuiAddress;
	}) /* u64 */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApi.constants.moduleNames.referralVault,
				"balance_of"
			),
			typeArguments: [inputs.coinType],
			arguments: [
				tx.object(this.addresses.objects.referralVault),
				tx.pure.address(inputs.referrer),
			],
		});
	};

	public referrerForTx = (inputs: {
		tx: Transaction;
		referee: SuiAddress;
	}) /* Option<address> */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApi.constants.moduleNames.referralVault,
				"referrer_for"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.referralVault),
				tx.pure.address(inputs.referee),
			],
		});
	};

	public hasReffererTx = (inputs: {
		tx: Transaction;
		referee: SuiAddress;
	}) /* bool */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApi.constants.moduleNames.referralVault,
				"has_referrer"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.referralVault),
				tx.pure.address(inputs.referee),
			],
		});
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchBalanceOfRebate = async (inputs: {
		coinType: CoinType;
		referrer: SuiAddress;
	}): Promise<Balance> => {
		const tx = new Transaction();
		this.balanceOfRebateTx({ ...inputs, tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchReferrer = async (inputs: {
		referee: SuiAddress;
	}): Promise<SuiAddress | undefined> => {
		const tx = new Transaction();
		this.referrerForTx({ ...inputs, tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const unwrapped = bcs.option(bcs.Address).parse(new Uint8Array(bytes));
		return unwrapped ?? undefined;
	};
}
