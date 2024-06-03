import { EventOnChain, TableOnChain } from "../../../general/types/castingTypes";
import { BigIntAsString, CoinType, ObjectId } from "../../../types";

// =========================================================================
// Events
// =========================================================================

export type DcaCreatedVaultEventOnChain = EventOnChain<{

    // Todo: - update with real smart-contract data

	vault_id: ObjectId;
	allocated_coin: CoinType;
	allocated_coin_amount: BigIntAsString;
	buy_coin: CoinType;
	buy_coin_amount: BigIntAsString;
}>;