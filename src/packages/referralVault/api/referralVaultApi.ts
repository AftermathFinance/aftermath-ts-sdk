import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import { Casting, Helpers } from "../../../general/utils";
import type {
	Balance,
	CoinType,
	ReferralVaultAddresses,
	SuiAddress,
} from "../../../types";

/**
 * Builds referral-vault Move calls and evaluates referral-vault inspection
 * results.
 *
 * This low-level helper requires the referral-vault package and object
 * addresses in the provider configuration. Use it when composing a larger
 * transaction or when the high-level referral facade does not expose the
 * operation you need.
 */
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

	/** Package and object addresses used by referral-vault calls. */
	public readonly addresses: ReferralVaultAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a helper bound to an {@link AftermathApi} provider.
	 *
	 * @param api - Provider containing the configured referral-vault addresses
	 * and inspection transport.
	 * @throws If referral-vault addresses are absent from the provider.
	 */
	constructor(private readonly api: AftermathApi) {
		const addresses = this.api.addresses.referralVault;
		if (!addresses) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.addresses = addresses;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	/**
	 * Appends a Move call that records a referee's referrer.
	 *
	 * If the transaction sender already matches `referrer`, this method leaves
	 * the transaction unchanged. The method also suppresses malformed-address
	 * errors to preserve the historical SDK behavior; validate addresses before
	 * calling it when you need deterministic failure handling.
	 *
	 * @param inputs - Transaction and referrer address to record.
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.referrer - Sui address of the referrer.
	 * @returns The result of `tx.moveCall`, or `undefined` when the sender is the
	 * referrer or the input address cannot be encoded.
	 */
	public updateReferrerTx = (inputs: {
		tx: Transaction;
		referrer: SuiAddress;
	}) => {
		// TODO: handle this case better
		// in try catch in case referrer is invalid address and throws
		try {
			const { tx, referrer } = inputs;

			const txData = tx.getData();
			if (
				txData.sender &&
				Helpers.addLeadingZeroesToType(txData.sender) ===
					Helpers.addLeadingZeroesToType(referrer)
			) {
				return;
			}

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
		} catch (_e) {}
	};

	/**
	 * Appends a Move call that withdraws accrued rebate for a coin type.
	 *
	 * @param inputs - Transaction, coin type, and transfer behavior.
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.coinType - Fully qualified coin type whose rebate is
	 * withdrawn.
	 * @param inputs.withTransfer - When `true`, transfers the withdrawn coins to
	 * the transaction sender; when omitted or `false`, returns the Move result.
	 * @returns The Move call result, which is a transaction result handle.
	 */
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
				inputs.withTransfer ? "withdraw_and_transfer" : "withdraw_rebate"
			),
			typeArguments: [inputs.coinType],
			arguments: [tx.object(this.addresses.objects.referralVault)],
		});
	};

	/**
	 * Appends a read-only Move call that returns a referrer's rebate balance.
	 *
	 * The Move function returns a `u64`; the result is not fetched until the
	 * transaction is executed or inspected.
	 *
	 * @param inputs - Transaction, coin type, and referrer address.
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.coinType - Fully qualified coin type for the rebate balance.
	 * @param inputs.referrer - Address whose rebate balance to read.
	 * @returns A transaction result handle containing the Move `u64` value.
	 */
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

	/**
	 * Appends a read-only Move call that returns the referrer of an address.
	 *
	 * The Move function returns `Option<address>`. Use an inspection helper or
	 * execute the transaction to read the value.
	 *
	 * @param inputs - Transaction and referee address.
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.referee - Address whose referrer to look up.
	 * @returns A transaction result handle containing `Option<address>`.
	 */
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

	/**
	 * Appends a read-only Move call that checks whether an address has a
	 * referrer.
	 *
	 * The method name preserves the SDK's historical `Refferer` spelling.
	 *
	 * @param inputs - Transaction and referee address.
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.referee - Address to check.
	 * @returns A transaction result handle containing the Move `bool` value.
	 */
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

	/**
	 * Inspects the rebate balance for a referrer and decodes the returned `u64`.
	 *
	 * @param inputs - Coin type and referrer address.
	 * @param inputs.coinType - Fully qualified coin type for the rebate balance.
	 * @param inputs.referrer - Address whose rebate balance to fetch.
	 * @returns The raw rebate balance as a bigint-backed {@link Balance} value.
	 * @throws If the inspection transport rejects the generated transaction.
	 */
	public fetchBalanceOfRebate = async (inputs: {
		coinType: CoinType;
		referrer: SuiAddress;
	}): Promise<Balance> => {
		const tx = new Transaction();
		this.balanceOfRebateTx({ ...inputs, tx });
		const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput({
			tx,
		});
		return Casting.bigIntFromBytes(bytes);
	};

	/**
	 * Inspects the referrer of an address and decodes the returned optional
	 * address.
	 *
	 * @param inputs - Referee address to query.
	 * @param inputs.referee - Address whose referrer to fetch.
	 * @returns The referrer address, or `undefined` when the Move option is
	 * empty.
	 * @throws If the inspection transport rejects the generated transaction or
	 * the returned bytes are not a valid BCS `Option<address>`.
	 */
	public fetchReferrer = async (inputs: {
		referee: SuiAddress;
	}): Promise<SuiAddress | undefined> => {
		const tx = new Transaction();
		this.referrerForTx({ ...inputs, tx });
		const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput({
			tx,
		});

		const unwrapped = bcs.option(bcs.Address).parse(new Uint8Array(bytes));
		return unwrapped ?? undefined;
	};
}
