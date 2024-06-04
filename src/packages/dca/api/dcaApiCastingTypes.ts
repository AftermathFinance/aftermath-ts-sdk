import { Coin } from "../..";
import { EventOnChain, TableOnChain } from "../../../general/types/castingTypes";
import { BigIntAsString, CoinType, ObjectId } from "../../../types";


// =========================================================================
// Objects
// =========================================================================

export interface DcaVaultFieldsOnChain {
    id: ObjectId,
    allocated_coin: CoinType;
    allocated_coin_amount: BigIntAsString;
    buy_coin: CoinType;
    buy_coin_amount: BigIntAsString;

    // Todo: add other fields including strategy
}

// =========================================================================
// Events
// =========================================================================

export type DcaCreatedVaultEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	allocated_coin: CoinType;
	allocated_coin_amount: BigIntAsString;
	buy_coin: CoinType;
	buy_coin_amount: BigIntAsString;

    // Todo: - update with real smart-contract data
}>;