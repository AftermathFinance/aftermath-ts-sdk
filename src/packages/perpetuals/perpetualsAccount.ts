import { SuiAddress } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import {
	PerpetualsAccountStruct,
	PerpetualsPosition,
	SuiNetwork,
	Url,
} from "../../types";

export class PerpetualsAccount extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly walletAddress: SuiAddress,
		public readonly accountId: bigint,
		public account: PerpetualsAccountStruct,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `perpetuals/accounts/${walletAddress}/${accountId}`);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async refreshAccount(): Promise<PerpetualsAccountStruct> {
		const account = await this.fetchApi<PerpetualsAccountStruct>("");
		this.updateAccount({ account });
		return account;
	}

	public updateAccount(inputs: { account: PerpetualsAccountStruct }) {
		this.account = inputs.account;
	}

	public positionForMarketId(inputs: {
		marketId: bigint;
	}): PerpetualsPosition | undefined {
		const marketIdIndex = Number(inputs.marketId);
		try {
			const posIndex = Number(this.account.marketIds[marketIdIndex]);
			return this.account.positions[posIndex];
		} catch (e) {
			return undefined;
		}
	}

	public marketIdForPosition(inputs: {
		position: PerpetualsPosition;
	}): bigint | undefined {
		try {
			const posIndex = this.account.positions.findIndex(
				(pos) => JSON.stringify(pos) === JSON.stringify(inputs.position)
			);
			const marketId = this.account.marketIds.findIndex(
				(val) => val === BigInt(posIndex)
			);

			if (posIndex < 0 || marketId < 0)
				throw new Error("position not found");

			return BigInt(marketId);
		} catch (e) {
			return undefined;
		}
	}
}
