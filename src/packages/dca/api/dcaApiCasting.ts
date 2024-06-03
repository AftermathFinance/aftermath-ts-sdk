import { Helpers } from "../../../general/utils";
import { DcaCreatedVaultEvent } from "../dcaTypes";
import { DcaCreatedVaultEventOnChain } from "./dcaApiCastingTypes";

export class DcaApiCasting {

    public static createdVaultEventFromOnChain = (
		eventOnChain: DcaCreatedVaultEventOnChain
	): DcaCreatedVaultEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			allocatedCoin: Helpers.addLeadingZeroesToType("0x" + fields.allocated_coin),
            allocatedCoinAmount: BigInt(fields.allocated_coin_amount),
			buyCoin: Helpers.addLeadingZeroesToType("0x" + fields.buy_coin),
            buyCoinAmount: BigInt(fields.buy_coin_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}