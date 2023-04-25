import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers";
import { CoinType, ReferralVaultAddresses } from "../../../types";

export class ReferralVaultApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			referralVault: "referral_vault",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: ReferralVaultAddresses;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.referralVault;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public addUpdateReferrerCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		referrer: SuiAddress;
	}) => {
		const { tx, referrer } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApiHelpers.constants.moduleNames.referralVault,
				"update_referrer_address"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.referralVault),
				tx.pure(referrer, "address"),
			],
		});
	};

	public addWithdrawRebateCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		withTransfer?: boolean;
	}) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApiHelpers.constants.moduleNames.referralVault,
				inputs.withTransfer
					? "withdraw_and_transfer"
					: "withdraw_rebate"
			),
			typeArguments: [inputs.coinType],
			arguments: [tx.object(this.addresses.objects.referralVault)],
		});
	};

	public addBalanceOfRebateCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		referrer: SuiAddress;
	}) /* u64 */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApiHelpers.constants.moduleNames.referralVault,
				"balance_of"
			),
			typeArguments: [inputs.coinType],
			arguments: [
				tx.object(this.addresses.objects.referralVault),
				tx.pure(inputs.referrer, "address"),
			],
		});
	};

	public addReferrerForCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		referee: SuiAddress;
	}) /* Option<address> */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApiHelpers.constants.moduleNames.referralVault,
				"referrer_for"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.referralVault),
				tx.pure(inputs.referee, "address"),
			],
		});
	};

	public addHasReffererCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		referee: SuiAddress;
	}) /* bool */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.referralVault,
				ReferralVaultApiHelpers.constants.moduleNames.referralVault,
				"has_referrer"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.referralVault),
				tx.pure(inputs.referee, "address"),
			],
		});
	};
}