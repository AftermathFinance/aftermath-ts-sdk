import { Helpers } from "../../../general/utils";
import { Coin } from "../../coin";
import type { FaucetAddCoinEvent, FaucetMintCoinEvent } from "../faucetTypes";
import type {
	FaucetAddCoinEventOnChain,
	FaucetMintCoinEventOnChain,
} from "./faucetApiCastingTypes";

/**
 * Converts faucet events from the on-chain representation to SDK event types.
 */
export class FaucetApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Converts an on-chain `MintedCoin` event to a `FaucetMintCoinEvent`.
	 *
	 * The coin amount is converted from its serialized string to `bigint`, and
	 * the event's addresses and coin type are normalized with leading zeroes.
	 *
	 * @param eventOnChain - On-chain faucet mint event to convert.
	 * @returns The normalized SDK faucet mint event.
	 */
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

	/**
	 * Converts an on-chain `AddedCoin` event to a `FaucetAddCoinEvent`.
	 *
	 * @param eventOnChain - On-chain faucet coin-registration event to convert.
	 * @returns The normalized SDK faucet registration event.
	 */
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
