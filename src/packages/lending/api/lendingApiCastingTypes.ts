import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";
import {
	EventOnChain,
	TreasuryCapOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface DepositoryFieldsOnchain {
	protected_balance: BigIntAsString,
	borrowable_balance: BigIntAsString,
    ptoken_treasury_cap: TreasuryCapOnChain,
    btoken_treasury_cap: TreasuryCapOnChain,
    locked_ptokens: BigIntAsString,
    locked_btokens: BigIntAsString,
}

export interface DepositoryIndexFieldsOnchain {
    asset_ticker: string,
    protected_balance_value: BigIntAsString,
    borrowable_balance_value: BigIntAsString,
    btoken_supply_value: BigIntAsString,
    ptoken_supply_value: BigIntAsString
    total_debt_value: BigIntAsString,
    collected_fee_value: bigint,
    rate_level: BigIntAsString,
    timestamp_in_seconds: BigIntAsString,
}

export interface SubPositionFieldsOnchain {
    debt_with_interest: BigIntAsString,
    locked_borrowable_amount: BigIntAsString,
    locked_protected_amount: BigIntAsString,
    last_rate_level: BigIntAsString,
}

// =========================================================================
//  Events Fields
// =========================================================================

export interface PublishedMarketEventOnChainFields {
	sender: SuiAddress,
	market_id: ObjectId
}

export interface DepositedProtectedEventOnChainFields {
    market_id: ObjectId,
    balance_value: BigIntAsString,
    returned_tokens_amount: BigIntAsString,
    asset_ticker: string,
}

export interface DepositedBorrowableEventOnChainFields {
    market_id: ObjectId,
    balance_value: BigIntAsString,
    returned_tokens_amount: BigIntAsString,
    asset_ticker: string,
}

export interface WithdrawnProtectedEventOnChainFields {
    market_id: ObjectId,
    tokens_amount: BigIntAsString,
    returned_balance_value: BigIntAsString,
    asset_ticker: string,
}

export interface WithdrawnBorrowableEventOnChainFields {
    market_id: ObjectId,
    tokens_amount: BigIntAsString,
    returned_balance_value: BigIntAsString,
    asset_ticker: string,
}

export interface WithdrawnCollectedFeeEventOnChainFields {
    market_id: ObjectId,
    returned_balance_value: BigIntAsString,
    asset_ticker: string,
}

export interface BorrowedEventOnChainFields {
    position: ObjectId,
    market_id: ObjectId,
    amount: BigIntAsString,
    returned_balance_value: BigIntAsString,
    asset_ticker: string,
}

export interface RepayedEventOnChainFields {
    position: ObjectId,
    market_id: ObjectId,
    debt: BigIntAsString,
    asset_ticker: string,
}

export interface LockedProtectedEventOnChainFields {
    position: ObjectId,
    market_id: ObjectId,
    tokens_amount: BigIntAsString,
    asset_ticker: string,
}

export interface LockedBorrowableEventOnChainFields {
    position: ObjectId,
    market_id: ObjectId,
    tokens_amount: BigIntAsString,
    asset_ticker: string,
}

export interface UnlockedProtectedEventOnChainFields {
    position: ObjectId,
    market_id: ObjectId,
    amount: BigIntAsString,
    returned_tokens_amount: BigIntAsString,
    asset_ticker: string,
}

export interface UnlockedBorrowableEventOnChainFields {
    position: ObjectId,
    market_id: ObjectId,
    amount: BigIntAsString,
    returned_tokens_amount: BigIntAsString,
    asset_ticker: string,
}

export interface TriggeredFlashLiquidationEventOnChainFields {
    sender_position: ObjectId,
    borrower_position: ObjectId,
    market_id: ObjectId,
    debt_asset_ticker: string,
    collateral_asset_ticker: string,
    liquidated_amount: BigIntAsString
}

// =========================================================================
//  Events
// =========================================================================

export type PublishedMarketEventOnChain = EventOnChain<PublishedMarketEventOnChainFields>;
export type DepositedProtectedEventOnChain = EventOnChain<DepositedProtectedEventOnChainFields>;
export type DepositedBorrowableEventOnChain = EventOnChain<DepositedBorrowableEventOnChainFields>;
export type WithdrawnProtectedEventOnChain = EventOnChain<WithdrawnProtectedEventOnChainFields>;
export type WithdrawnBorrowableEventOnChain = EventOnChain<WithdrawnBorrowableEventOnChainFields>;
export type WithdrawnCollectedFeeEventOnChain = EventOnChain<WithdrawnCollectedFeeEventOnChainFields>;
export type BorrowedEventOnChain = EventOnChain<BorrowedEventOnChainFields>;
export type RepayedEventOnChain = EventOnChain<RepayedEventOnChainFields>;
export type LockedProtectedEventOnChain = EventOnChain<LockedProtectedEventOnChainFields>;
export type LockedBorrowableEventOnChain = EventOnChain<LockedBorrowableEventOnChainFields>;
export type UnlockedProtectedEventOnChain = EventOnChain<UnlockedProtectedEventOnChainFields>;
export type UnlockedBorrowableEventOnChain = EventOnChain<UnlockedBorrowableEventOnChainFields>;
export type TriggeredFlashLiquidationEventOnChain = EventOnChain<TriggeredFlashLiquidationEventOnChainFields>;