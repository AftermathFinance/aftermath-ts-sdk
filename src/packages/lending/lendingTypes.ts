import { CoinType, Sui } from "../..";

import {
	Balance,
	SuiAddress,
	ObjectId,
	Object
} from "../../general/types/generalTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface PositionTicketObject extends Object {}

export interface DepositoryObject extends Object {
	protected_balance: Balance,
	borrowable_balance: Balance,
    locked_ptokens: Balance,
    locked_btokens: Balance,
}

export interface DepositoryIndexObject extends Object {
	    asset_ticker: string,
        protected_balance_value: Balance,
        borrowable_balance_value: Balance,
        btoken_supply_value: Balance,
        ptoken_supply_value: Balance,
        total_debt_value: Balance,
        collected_fee_value: bigint,
        rate_level: bigint,
        timestamp_in_seconds: bigint,
}

export interface SubPositionObject extends Object {
        debt_with_interest: Balance,
        locked_borrowable_amount: Balance,
        locked_protected_amount: Balance,
        last_rate_level: bigint,
}


// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Transactions API
// =========================================================================

export interface ApiIssuePositionTicketBody{
	walletAddress: SuiAddress;
}

export interface ApiDepositBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	pTokenCoinType: CoinType;
	bTokenCoinType: CoinType;
	depositedAmount: Balance;
	isProtected: boolean;
	isSponsoredTx?: boolean;
}

export interface ApiWithdrawBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	pTokenCoinType: CoinType;
	bTokenCoinType: CoinType;
	withdrawnAmount: Balance;
	isProtected: boolean;
	isSponsoredTx?: boolean;
}

export interface ApiLockBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	pTokenCoinType: CoinType;
	bTokenCoinType: CoinType;
	positionTicket: ObjectId;
	lockedAmount: Balance;
	isProtected: boolean;
	isSponsoredTx?: boolean;
}

export interface ApiUnlockBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	pTokenCoinType: CoinType;
	bTokenCoinType: CoinType;
	positionTicket: ObjectId;
	amount: Balance;
	isProtected: boolean;
}

export interface ApiBorrowBody {
	walletAddress: SuiAddress;
	borrowCoinType: CoinType;
	pTokenCoinType: CoinType;
	bTokenCoinType: CoinType;
	positionTicket: ObjectId;
	amount: Balance;
}

export interface ApiRepayBody {
	walletAddress: SuiAddress;
	repayCoinType: CoinType;
	pTokenCoinType: CoinType;
	bTokenCoinType: CoinType;
	positionToRepayId: ObjectId;
	amount: Balance;
	isSponsoredTx?: boolean;
}

export interface ApiFlashLiquidationSpecifiedAmountBody {
	walletAddress: SuiAddress;
	debtCoinType: CoinType;
	pTokenDebtCoinType: CoinType;
	bTokenDebtCoinType: CoinType;
	collateralRepayCoinType: CoinType;
	liquidatorPositionTicket: ObjectId;
	borrowerPositionId: ObjectId;
	liquidityAmount: Balance;
	isSponsoredTx?: boolean;
}

export interface ApiFlashLiquidationBody {
	walletAddress: SuiAddress;
	debtCoinType: CoinType;
	pTokenDebtCoinType: CoinType;
	bTokenDebtCoinType: CoinType;
	collateralRepayCoinType: CoinType;
	liquidatorPositionTicket: ObjectId;
	borrowerPositionId: ObjectId;
	isSponsoredTx?: boolean;
}

export interface ApiPositionHealthBody {
	walletAddress: SuiAddress;
	positionId: ObjectId;
}

export interface ApiUtilizationRatioBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
}

export interface ApiCurrentApyBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
}