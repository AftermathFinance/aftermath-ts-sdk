import { FaucetMintCoinEventOnChain } from "./faucetCastingTypes";
import { FaucetMintCoinEvent } from "../faucetTypes";

export class FaucetApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static faucetMintCoinEventFromOnChain = (
		eventOnChain: FaucetMintCoinEventOnChain
	): FaucetMintCoinEvent => {
		const fields = eventOnChain.event.moveEvent.fields;
		return {
			minter: fields.user,
			coinMinted: fields.type,
			balanceMinted: BigInt(fields.amount),
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};
}
