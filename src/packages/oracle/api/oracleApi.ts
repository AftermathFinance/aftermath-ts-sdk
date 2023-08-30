import { ObjectId, SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers";
import { Helpers } from "../../../general/utils";
import { OracleAddresses, Timestamp } from "../../../types";
import { PriceFeedStorage } from "../oracleTypes";
import { OracleCasting } from "./oracleCasting";

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

	public fetchPriceFeedStorage = async (
		objectId: ObjectId
	): Promise<PriceFeedStorage> => {
		return this.Provider.Objects().fetchCastObject<PriceFeedStorage>({
			objectId,
			objectFromSuiObjectResponse:
				OracleCasting.priceFeedStorageFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  Oracle Transactions
	// =========================================================================

	public fetchDevCreatePriceFeedTx = async (inputs: {
		walletAddress: SuiAddress;
		symbol: string;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.devCreatePriceFeedTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchDevUpdatePriceFeedTx = async (inputs: {
		walletAddress: SuiAddress;
		symbol: string;
		price: bigint;
		timestamp: Timestamp;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.devUpdatePriceFeedTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public devCreatePriceFeedTx = (inputs: {
		tx: TransactionBlock;
		symbol: string;
	}) => {
		const { tx, symbol } = inputs;
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
				tx.pure(symbol),
			],
		});
	};

	public devUpdatePriceFeedTx = (inputs: {
		tx: TransactionBlock;
		symbol: string;
		price: bigint;
		timestamp: Timestamp;
	}) => {
		const { tx, symbol, price, timestamp } = inputs;
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
				tx.pure(symbol),
				tx.pure(price),
				tx.pure(timestamp),
			],
		});
	};
}
