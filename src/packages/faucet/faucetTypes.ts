import {
	AnyObjectType,
	Balance,
	Event,
	SuiAddress,
} from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Events
// =========================================================================

export interface FaucetMintCoinEvent extends Event {
	minter: SuiAddress;
	coinMinted: CoinType;
	balanceMinted: BigInt;
}

export interface FaucetAddCoinEvent extends Event {
	coinSymbol: string;
	coinType: CoinType;
}

// =========================================================================
//  API
// =========================================================================

export interface ApiFaucetRequestBody {
	coinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFaucetMintSuiFrenBody {
	mintFee: Balance;
	suiFrenType: AnyObjectType;
	walletAddress: SuiAddress;
}
