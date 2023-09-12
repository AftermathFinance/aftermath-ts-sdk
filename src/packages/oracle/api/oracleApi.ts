import { TransactionBlock } from "@mysten/sui.js/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import { OracleAddresses, Timestamp } from "../../../types";
import { OracleCoinSymbol, PriceFeedStorage } from "../oracleTypes";
import { OracleApiCasting } from "./oracleApiCasting";
import { Coin } from "../..";

export class OracleApi {
	public readonly addresses: OracleAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.oracle;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchPriceFeedStorage = async (): Promise<PriceFeedStorage> => {
		return this.Provider.Objects().fetchCastObject<PriceFeedStorage>({
			objectId: this.addresses.objects.priceFeedStorage,
			objectFromSuiObjectResponse:
				OracleApiCasting.priceFeedStorageFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchPrice = async (inputs: {
		coinSymbol: OracleCoinSymbol;
	}): Promise<number> => {
		const tx = new TransactionBlock();

		this.getPriceTx({ ...inputs, tx });

		const priceBytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		const price = Casting.bigIntFromBytes(priceBytes);
		const exponent = 18;
		return Coin.balanceWithDecimals(price, Number(exponent));

		// const [price, exponent] = [
		// 	Casting.bigIntFromBytes(priceBytes),
		// 	Casting.bigIntFromBytes(exponentBytes),
		// ];
		// return Coin.balanceWithDecimals(price, Number(exponent));
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public getPriceTx = (inputs: {
		tx: TransactionBlock;
		coinSymbol: OracleCoinSymbol;
	}) /* u256 */ => {
		const { tx, coinSymbol } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.oracle,
				"oracle",
				"get_price"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.priceFeedStorage), // PriceFeedStorage
				tx.pure(coinSymbol), // symbol
			],
		});
	};

	public devCreatePriceFeedTx = (inputs: {
		tx: TransactionBlock;
		coinSymbol: OracleCoinSymbol;
	}) => {
		const { tx, coinSymbol } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.oracle,
				"oracle",
				"dev_create_price_feed"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.authorityCapability),
				tx.object(this.addresses.objects.priceFeedStorage),
				tx.pure(coinSymbol),
			],
		});
	};

	public devUpdatePriceFeedTx = (inputs: {
		tx: TransactionBlock;
		coinSymbol: OracleCoinSymbol;
		price: bigint;
		timestamp: Timestamp;
	}) => {
		const { tx, coinSymbol, price, timestamp } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.oracle,
				"oracle",
				"dev_update_price_feed"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.authorityCapability),
				tx.object(this.addresses.objects.priceFeedStorage),
				tx.pure(coinSymbol),
				tx.pure(price),
				tx.pure(timestamp),
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public buildDevCreatePriceFeedTx = Helpers.transactions.createBuildTxFunc(
		this.devCreatePriceFeedTx
	);

	public buildDevUpdatePriceFeedTx = Helpers.transactions.createBuildTxFunc(
		this.devUpdatePriceFeedTx
	);
}
