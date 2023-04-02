import { FaucetMintCoinEventOnChain } from "./faucetApiCastingTypes";
import { FaucetMintCoinEvent } from "../faucetTypes";

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
}
