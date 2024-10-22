import { Transaction } from "@mysten/sui/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import {
	BigIntAsString,
	CoinDecimal,
	CoinSymbol,
	ObjectId,
	OracleAddresses,
} from "../../../types";
import { IFixedUtils } from "../../../general/utils/iFixedUtils";
import { Sui } from "../../sui";

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
	//  Inspections
	// =========================================================================

	public fetchPrice = async (inputs: {
		priceFeedId: ObjectId;
	}): Promise<number> => {
		const tx = new Transaction();

		this.getPriceTx({ ...inputs, tx });

		const priceBytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const price = Casting.bigIntFromBytes(priceBytes);
		return IFixedUtils.numberFromIFixed(price);
	};

	public fetchPriceFeedSymbols = async (inputs: {
		priceFeedIds: ObjectId[];
	}): Promise<
		{
			symbol: CoinSymbol;
			decimals: CoinDecimal;
		}[]
	> => {
		const { priceFeedIds } = inputs;

		const response = await this.Provider.indexerCaller.fetchIndexer<
			{
				symbol: CoinSymbol;
				decimals: BigIntAsString;
				priceFeedId: ObjectId;
			}[],
			{
				price_feed_ids: ObjectId[];
			}
		>(`oracle/price-feed-symbols`, {
			price_feed_ids: priceFeedIds,
		});

		let result: {
			symbol: CoinSymbol;
			decimals: CoinDecimal;
		}[] = [];
		for (const priceFeedId of priceFeedIds) {
			const foundData = response.find(
				(data) => data.priceFeedId === priceFeedId
			)!;
			result.push({
				symbol: foundData.symbol,
				decimals: Math.log10(Number(foundData.decimals)),
			});
		}
		return result;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public getPriceTx = (inputs: {
		tx: Transaction;
		priceFeedId: ObjectId;
	}) /* u256 */ => {
		const { tx, priceFeedId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.oracleReader,
				"oracle_reader",
				"get_average_price_for_all_sources"
			),
			typeArguments: [],
			arguments: [
				tx.object(priceFeedId), // PriceFeedStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(Casting.u64MaxBigInt), // A really huge value for tolerance, we never want it here
				tx.pure.bool(false), // price of unit
				tx.pure.bool(false), // may abort
			],
		});
	};
}
