import { Coin, FractionalNfts } from "..";
import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	AnyObjectType,
	Balance,
	CoinDecimal,
	CoinType,
	FractionalNftsVaultObject,
	SuiNetwork,
} from "../../types";
import {
	FractionalNftsVaultGetAllNfts,
	FractionalNftsVaultGetNfts,
} from "./fractionalNftsVaultInterface";

export class FractionalNftsVault extends Caller {
	// =========================================================================
	//  Private Constants
	// =========================================================================

	private static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly vault: FractionalNftsVaultObject,
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, `fractional-nfts/vaults/${vault.objectId}`);
		this.vault = vault;
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	getNfts: FractionalNftsVaultGetNfts = (inputs) => {
		return this.useProvider().fetchNftsInMarketWithCursor({
			...inputs,
			kioskId: this.vault.kioskStorage?.ownerCap.forObjectId!,
			kioskOwnerCapId: this.vault.kioskStorage?.ownerCap.objectId!,
		});
	};

	getAllNfts: FractionalNftsVaultGetAllNfts = () => {
		return this.useProvider().fetchNftsInKiosk({
			kioskId: this.vault.kioskStorage?.ownerCap.forObjectId!,
			kioskOwnerCapId: this.vault.kioskStorage?.ownerCap.objectId!,
		});
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	public getNftEquivalence = (inputs: { fractionalAmount: Balance }) => {
		return Number(inputs.fractionalAmount) / Number(this.fractionsAmount());
	};

	public getFractionalCoinEquivalence = (inputs: { nftsCount: number }) => {
		return BigInt(Math.round(inputs.nftsCount)) * this.fractionsAmount();
	};

	// =========================================================================
	//  Getters
	// =========================================================================

	public fractionalCoinType = (): CoinType => {
		return this.vault.fractionalCoinType;
	};

	public nftType = (): AnyObjectType => {
		return this.vault.nftType;
	};

	public fractionsAmount = (): Balance => {
		return this.vault.fractionsAmount;
	};

	// =========================================================================
	//  Protected Helpers
	// =========================================================================

	protected useProvider = () => {
		const provider = this.Provider?.FractionalNfts();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
