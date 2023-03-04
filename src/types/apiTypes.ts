import {
	Balance,
	CoinType,
	CoinsToBalance,
	IndicesRouterPath,
} from "aftermath-sdk";
import {
	EventId,
	ObjectId,
	SuiAddress,
	TransactionDigest,
} from "@mysten/sui.js";

export interface ApiDataWithCursorBody<CursorType> {
	cursor?: CursorType;
	limit?: number;
}

export type ApiEventsBody = ApiDataWithCursorBody<EventId>;

export type ApiDynamicFieldsBody = ApiDataWithCursorBody<ObjectId>;

export type ApiTransactionsBody = ApiDataWithCursorBody<TransactionDigest>;

export interface ApiStakeBody {
	walletAddress: SuiAddress;
	coinAmount: Balance;
	stakedCoinType: CoinType;
}

export interface ApiUnstakeBody {
	walletAddress: SuiAddress;
	coinAmount: Balance;
	unstakedCoinType: CoinType;
}

export interface ApiRequestAddDelegationBody {
	walletAddress: SuiAddress;
	coinAmount: Balance;
}

export interface ApiCancelOrRequestWithdrawDelegationBody {
	walletAddress: SuiAddress;
	principalAmount: Balance;
	delegationObjectId: ObjectId | undefined;
}

export interface ApiStakeCapyBody {
	capyId: ObjectId;
}

export interface ApiUnstakeCapyBody {
	stakingReceiptId: ObjectId;
}

export interface ApiWithdrawCapyFeesAmountBody {
	amount: Balance;
}

export interface ApiBreedCapyBody {
	walletAddress: SuiAddress;
	capyParentOneId: ObjectId;
	capyParentTwoId: ObjectId;
}

export interface ApiPoolSpotPriceBody {
	coinInType: CoinType;
	coinOutType: CoinType;
}

export interface ApiPoolSwapAmountOutBody {
	coinInType: CoinType;
	coinInAmount: Balance;
	coinOutType: CoinType;
}

export interface ApiPoolDepositLpMintAmountBody {
	depositCoinAmounts: CoinsToBalance;
}

export interface ApiPoolDepositBody {
	walletAddress: SuiAddress;
	depositCoinAmounts: CoinsToBalance;
}

export interface ApiPoolWithdrawBody {
	walletAddress: SuiAddress;
	withdrawCoinAmounts: CoinsToBalance;
	withdrawLpTotal: Balance;
}

export interface ApiPoolSwapBody {
	walletAddress: SuiAddress;
	fromCoin: CoinType;
	fromCoinAmount: Balance;
	toCoin: CoinType;
}

export interface ApiTradeBody {
	walletAddress: SuiAddress;
	fromCoin: CoinType;
	fromCoinAmount: Balance;
	toCoin: CoinType;
}

export interface ApiTradeInfoBody {
	fromCoin: CoinType;
	toCoin: CoinType;
}

export interface CapyFeesEarned {
	capyFeesEarnedIndividual: Balance;
	capyFeesEarnedGlobal: Balance;
}

export type ApiTradeTransactionsBody =
	| {
			walletAddress: SuiAddress;
			fromCoinAmount: Balance;
			path: IndicesRouterPath;
	  }
	| {
			path: IndicesRouterPath;
			fromCoinId: ObjectId;
	  };
