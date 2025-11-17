import {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes.ts";
import { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes.ts";

export class FaucetApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	public static faucetMintCoinEventFromOnChain = (
		eventOnChain: FaucetMintCoinEventOnChain
	): FaucetMintCoinEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			minter: fields.user,
			coinMinted: fields.type,
			balanceMinted: BigInt(fields.amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static faucetAddCoinEventFromOnChain = (
		eventOnChain: FaucetAddCoinEventOnChain
	): FaucetAddCoinEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			coinSymbol: fields.symbol,
			coinType: fields.type,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}
