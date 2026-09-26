import type {
	Aftermath,
	AftermathOptions,
	PerpetualsWsCandleResponseMessage,
	SerializedTransaction,
} from "aftermath-ts-sdk";

// Compile against the built package declaration, without executing a consumer.
export interface PublishedContract {
	options: AftermathOptions;
	transaction: SerializedTransaction;
	candle: PerpetualsWsCandleResponseMessage;
	accessors: Pick<
		Aftermath,
		| "Auth"
		| "Coin"
		| "Dca"
		| "DynamicGas"
		| "Farms"
		| "Faucet"
		| "GasPools"
		| "LimitOrders"
		| "Multisig"
		| "NftAmm"
		| "Perpetuals"
		| "Pools"
		| "ReferralVault"
		| "Referrals"
		| "Rewards"
		| "Router"
		| "Staking"
		| "Sui"
		| "SuiFrens"
		| "UserData"
		| "Prices"
		| "Wallet"
	>;
}
