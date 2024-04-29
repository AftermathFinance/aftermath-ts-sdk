import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { SuiNetwork } from "../../types";
import {
    ApiBorrowBody,
    ApiDepositBody,
    ApiFlashLiquidationBody,
    ApiFlashLiquidationSpecifiedAmountBody,
    ApiLockBody,
    ApiRepayBody,
    ApiUnlockBody,
    ApiWithdrawBody,
    ApiIssuePositionTicketBody
} from "./lendingTypes";

/**
 * The Lending class provides an interface for interacting with the Lending contract.
 */
export class Lending extends Caller {

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of the Lending class.
	 * @param network - The network to use for interacting with the Lending contract.
	 */
	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "lending");
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Fetches the transaction object for position ticket issue.
	 * @param inputs - An object containing only wallet address.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getIssuePositionTicketTransaction(inputs: ApiIssuePositionTicketBody) {
        return this.useProvider().fetchIssuePositionTicket(inputs)
    }

	/**
	 * Fetches the transaction object for deposit.
	 * @param inputs - An object containing provided coin.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getDepositTransaction(inputs: ApiDepositBody) {
        return this.useProvider().fetchBuildDepositTx(inputs)
    }

	/**
	 * Fetches the transaction object for deposit.
	 * @param inputs - An object containing provided token.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getWithdrawTransaction(inputs: ApiWithdrawBody) {
        return this.useProvider().fetchBuildWithdrawTx(inputs)
    }

	/**
	 * Fetches the transaction object for lock.
	 * @param inputs - An object containing provided token to be locked.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getLockTransaction(inputs: ApiLockBody) {
        return this.useProvider().fetchBuildLockTx(inputs)
    }

	/**
	 * Fetches the transaction object for unlock.
	 * @param inputs - An object containing position ticket and information about amount to be unlocked.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getUnlockTransaction(inputs: ApiUnlockBody) {
        return this.useProvider().fetchBuildUnlockTx(inputs)
    }

	/**
	 * Fetches the transaction object for borrow.
	 * @param inputs - An object containing position ticket and information about amount to be borrowed.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getBorrowTransaction(inputs: ApiBorrowBody) {
        return this.useProvider().fetchBuildBorrowTx(inputs)
    }

	/**
	 * Fetches the transaction object for repay.
	 * @param inputs - An object containing borrower position id and provided coin.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getRepayTransaction(inputs: ApiRepayBody) {
        return this.useProvider().fetchBuildRepayTx(inputs)
    }

	/**
	 * Fetches the transaction object for liquidation.
	 * @param inputs - An object containing borrower position id liquidator position ticket
     *  and information amount to be liquidated.
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getFlashLiquidationSpecifiedAmountTransaction(inputs: ApiFlashLiquidationSpecifiedAmountBody) {
        return this.useProvider().fetchBuildFlashLIquidationSpecifiedAmountTx(inputs)
    }

	/**
	 * Fetches the transaction object for liquidation.
	 * @param inputs - An object containing borrower position id and liquidator position ticket
	 * @returns A Promise that resolves to a transaction object.
	 */
    public async getFlashLiquidationTransaction(inputs: ApiFlashLiquidationBody) {
        return this.useProvider().fetchBuildFlashLIquidationTx(inputs)
    }

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Lending();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}