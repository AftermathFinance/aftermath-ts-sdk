import {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";
import { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes";

export class FaucetApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

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
		};
	};

	public static faucetAddCoinEventFromOnChain = (
		eventOnChain: FaucetAddCoinEventOnChain
	): FaucetAddCoinEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			symbol: fields.symbol,
			type: fields.type,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};
}
