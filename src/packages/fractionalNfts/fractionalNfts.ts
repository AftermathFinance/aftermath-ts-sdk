import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	ApiCreateFractionalNftVaultBody,
	ApiOwnedCreateFractionalVaultCapIds,
	ApiPublishFractionalCoinBody,
	CoinType,
	FractionalNftsVaultObject,
	ObjectId,
	SuiAddress,
	SuiNetwork,
} from "../../types";
import { AfEggFractionalNftsVault } from "./afEggFractionalNftsVault";
import { FractionalNftsVault } from "./fractionalNftsVault";
import { FractionalNftsVaultInterface } from "./fractionalNftsVaultInterface";

export class FractionalNfts extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "fractional-nfts");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	// =========================================================================
	//  Vault Class
	// =========================================================================

	// public async getAllVaults(): Promise<FractionalNftsVaultInterface[]> {
	// 	const vaults = await this.fetchApi<FractionalNftsVaultObject[]>(
	// 		`vaults`
	// 	);
	// 	// NOTE: this works now because ONLY egg vault exists
	// 	return vaults.map(
	// 		(vault) =>
	// 			new AfEggFractionalNftsVault(vault, this.network, this.Provider)
	// 	);
	// }

	public async getAfEggVault() {
		const market = await this.fetchApi<FractionalNftsVaultObject>(
			`vaults/af-egg`
		);
		return new AfEggFractionalNftsVault(
			market,
			this.network,
			this.Provider
		);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getOwnedCreateFractionalVaultCapIds(
		inputs: ApiOwnedCreateFractionalVaultCapIds
	): Promise<ObjectId[]> {
		return this.useProvider().fetchOwnedCreateFractionalVaultCapIds(inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getPublishFractionalCoinTransaction(
		inputs: ApiPublishFractionalCoinBody
	) {
		return this.useProvider().buildPublishFactionalCoinTx(inputs);
	}

	public async getCreatePoolTransaction(
		inputs: ApiCreateFractionalNftVaultBody
	) {
		return this.useProvider().fetchBuildCreateFractionalNftVaultTx(inputs);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.FractionalNfts();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
