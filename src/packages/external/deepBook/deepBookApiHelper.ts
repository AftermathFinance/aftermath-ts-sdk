import {
	ObjectId,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinType,
	DeepBookAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import { Sui } from "../../sui";
import { EventOnChain } from "../../../general/types/castingTypes";
import { DeepBookPoolObject } from "./deepBookTypes";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";

export class DeepBookApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			clob: "clob",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: {
		deepBook: DeepBookAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const deepBook = this.Provider.addresses.externalRouter?.deepBook;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!deepBook || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = {
			deepBook,
			pools,
			referralVault,
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPools = async (): Promise<DeepBookPoolObject[]> => {
		const objectIds = await this.Provider.Events().fetchAllEvents(
			(cursor, limit) =>
				this.Provider.Events().fetchCastEventsWithCursor<
					EventOnChain<{
						pool_id: ObjectId;
						base_asset: CoinType;
						quote_asset: CoinType;
					}>,
					DeepBookPoolObject
				>(
					{
						MoveEventType: EventsApiHelpers.createEventType(
							this.addresses.deepBook.packages.clob,
							DeepBookApiHelpers.constants.moduleNames.clob,
							"PoolCreated"
						),
					},
					(eventOnChain) => {
						return {
							objectId: eventOnChain.parsedJson.pool_id,
							baseCoin: eventOnChain.parsedJson.base_asset,
							quoteCoin: eventOnChain.parsedJson.quote_asset,
						};
					},
					cursor,
					limit
				)
		);

		return objectIds;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	// public fun swap_exact_base_for_quote<BaseAsset, QuoteAsset>(
	//     pool: &mut Pool<BaseAsset, QuoteAsset>,

	//     pool_registry: &PoolRegistry,
	//     protocol_fee_vault: &ProtocolFeeVault,
	//     treasury: &mut Treasury,
	//     insurance_fund: &mut InsuranceFund,
	//     referral_vault: &ReferralVault,

	//     base_coin: Coin<BaseAsset>,
	//     clock: &Clock,
	//     ctx: &mut TxContext,

	// ): (Coin<BaseAsset>, Coin<QuoteAsset>, u64 (amountFilled), u64 (amountOut))

	public addTradeBaseToQuoteCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (Coin<BaseAsset>, Coin<QuoteAsset>, u64 (amountFilled), u64 (amountOut)) */ => {
		const { tx, coinInId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"swap_exact_base_for_quote"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public addTradeQuoteToBaseCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (Coin<QuoteAsset>, Coin<BaseAsset>, u64 (amountFilled), u64 (amountOut)) */ => {
		const { tx, coinInId } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.deepBook.packages.clob,
				DeepBookApiHelpers.constants.moduleNames.clob,
				"swap_exact_quote_for_base"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public addTradeCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		pool: DeepBookPoolObject;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (Coin<CoinIn>, Coin<CoinOut>, u64 (amountFilled), u64 (amountOut)) */ => {
		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
		};

		if (
			Helpers.stripLeadingZeroesFromType(inputs.coinInType) ===
			Helpers.stripLeadingZeroesFromType(inputs.pool.baseCoin)
		) {
			return this.addTradeBaseToQuoteCommandToTransaction(commandInputs);
		}

		return this.addTradeQuoteToBaseCommandToTransaction(commandInputs);
	};
}
