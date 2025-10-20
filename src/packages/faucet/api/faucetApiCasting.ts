import {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";
import { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes";
import { Helpers } from "../../../general/utils";
import { Coin } from "../../coin";

export class FaucetApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	public static faucetMintCoinEventFromOnChain = (
		eventOnChain: FaucetMintCoinEventOnChain
	): FaucetMintCoinEvent => {
		const fields = eventOnChain.parsedJson;
		const coinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			coinType,
			minter: Helpers.addLeadingZeroesToType(fields.user),
			amount: BigInt(fields.amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static faucetAddCoinEventFromOnChain = (
		eventOnChain: FaucetAddCoinEventOnChain
	): FaucetAddCoinEvent => {
		const fields = eventOnChain.parsedJson;
		const coinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			coinType,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}
