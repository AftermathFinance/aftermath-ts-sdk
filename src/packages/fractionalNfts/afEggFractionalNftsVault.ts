import { SuiNetwork, FractionalNftsVaultObject } from "../../types";
import { AftermathApi } from "../../general/providers";
import {
	FractionalNftsVaultGetDepositNftsTransaction,
	FractionalNftsVaultGetWithdrawNftsTransaction,
	FractionalNftsVaultInterface,
} from "./fractionalNftsVaultInterface";
import { FractionalNftsVault } from "./fractionalNftsVault";

export class AfEggFractionalNftsVault
	extends FractionalNftsVault
	implements FractionalNftsVaultInterface
{
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		vault: FractionalNftsVaultObject,
		network?: SuiNetwork,
		Provider?: AftermathApi
	) {
		super(vault, network, Provider);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	getDepositNftsTransaction: FractionalNftsVaultGetDepositNftsTransaction = (
		inputs
	) => {
		return this.useProvider().buildDepositAfEggsTx({
			...inputs,
			vault: this,
		});
	};

	getWithdrawNftsTransaction: FractionalNftsVaultGetWithdrawNftsTransaction =
		(inputs) => {
			return this.useProvider().buildWithdrawAfEggsTx({
				...inputs,
				vault: this,
			});
		};
}
