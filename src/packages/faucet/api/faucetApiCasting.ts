import { Helpers } from "../../../general/utils";
import { Coin } from "../../coin";
import type { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes";
import type {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";

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
		const _fields = eventOnChain.parsedJson;
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
