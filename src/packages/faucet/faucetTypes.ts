import type {
	AnyObjectType,
	Balance,
	Event,
	SuiAddress,
} from "../../general/types/generalTypes";
import type { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Events
// =========================================================================

/**
 * Event emitted when the faucet mints a coin for a wallet.
 */
export interface FaucetMintCoinEvent extends Event {
	/** Wallet that received the minted coin. */
	minter: SuiAddress;
	/** Coin type that the faucet minted. */
	coinType: CoinType;
	/** Minted amount in the coin's smallest unit. */
	amount: Balance;
}

/**
 * Event emitted when a coin type is added to the faucet.
 */
export interface FaucetAddCoinEvent extends Event {
	/** Coin type that was added to the faucet. */
	coinType: CoinType;
}

// =========================================================================
//  API
// =========================================================================

/**
 * Inputs for building a transaction that requests one faucet coin.
 */
export interface ApiFaucetRequestBody {
	/** Coin type to mint. */
	coinType: CoinType;
	/** Wallet that receives the minted coin and signs the transaction. */
	walletAddress: SuiAddress;
}

/**
 * Inputs for building a transaction that mints a SuiFren.
 */
export interface ApiFaucetMintSuiFrenBody {
	/** SUI amount used to pay the SuiFren mint fee, as a bigint. */
	mintFee: Balance;
	/** SuiFren object type to mint. */
	suiFrenType: AnyObjectType;
	/** Wallet that pays the fee and signs the transaction. */
	walletAddress: SuiAddress;
}
