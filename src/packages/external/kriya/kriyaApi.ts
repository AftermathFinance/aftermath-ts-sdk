import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
import {
	ObjectId,
	SuiObjectResponse,
	TransactionArgument,
	TransactionBlock,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import { AnyObjectType, Balance, KriyaAddresses } from "../../../types";
import {
	ApiKriyaOwnedLpTokensBody,
	KriyaLPInfo,
	KriyaLPTokenFieldsOnChain,
	KriyaLPTokenObject,
	KriyaPoolCreatedEvent,
	KriyaPoolCreatedEventOnChain,
	KriyaPoolFieldsOnChain,
	KriyaPoolObject,
} from "./kriyaTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { RouterPoolTradeTxInputs } from "../../router";
import {
	ManagementApiWithdrawInterface,
	ManagementCalcWithdrawAmountsOutInputs,
	ManagementOwnedLpInfosInputs,
	ManagementWithdrawTxInputs,
} from "../../management/api/utils/interfaces/managementApiWithdrawInterface";

export class KriyaApi
	implements
		RouterSynchronousApiInterface<KriyaPoolObject>,
		ManagementApiWithdrawInterface<KriyaLPInfo>
{
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			spotDex: "spot_dex",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: KriyaAddresses;

	public readonly eventTypes: {
		poolCreated: AnyObjectType;
	};

	public readonly objectTypes: {
		lpToken: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const kriyaAddresses = this.Provider.addresses.external?.kriya;

		if (!kriyaAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = kriyaAddresses;
		this.eventTypes = {
			poolCreated: `${kriyaAddresses.packages.dex}::${KriyaApi.constants.moduleNames.spotDex}::PoolCreatedEvent`,
		};
		this.objectTypes = {
			lpToken: `${kriyaAddresses.packages.dex}::${KriyaApi.constants.moduleNames.spotDex}::KriyaLPToken`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPoolIds = async () => {
		return this.Provider.Events().fetchAllEvents({
			fetchEventsFunc: (eventsInputs) =>
				this.Provider.Events().fetchCastEventsWithCursor({
					...eventsInputs,
					query: {
						MoveEventType: this.eventTypes.poolCreated,
					},
					eventFromEventOnChain: (eventOnChain) =>
						KriyaApi.kriyaPoolCreatedEventFromOnChain(
							eventOnChain as KriyaPoolCreatedEventOnChain
						).poolId,
				}),
		});
	};

	public fetchPoolsFromIds = async (inputs: { objectIds: ObjectId[] }) => {
		const { objectIds } = inputs;

		const pools = await this.Provider.Objects().fetchCastObjectBatch({
			objectIds,
			objectFromSuiObjectResponse:
				KriyaApi.kriyaPoolObjectFromSuiObjectResponse,
		});

		const unlockedPools = pools.filter(
			(pool) =>
				pool.isSwapEnabled &&
				pool.tokenXValue > BigInt(0) &&
				pool.tokenYValue > BigInt(0)
		);
		return unlockedPools;
	};

	public fetchOwnedLpInfos = async (
		inputs: ManagementOwnedLpInfosInputs
	): Promise<KriyaLPInfo[]> => {
		const lpTokens = await this.fetchOwnedLpTokens(inputs);

		const poolIds = Helpers.uniqueArray(lpTokens.map((lp) => lp.poolId));
		const pools = await this.fetchPoolsFromIds({ objectIds: poolIds });

		return lpTokens.map((lpToken) => {
			const pool = pools.find((pool) => pool.objectId === lpToken.poolId);
			if (!pool) throw new Error("kriya pool not found for lp token");
			return {
				// TODO: set this is a better way - associate direectly with class ?
				protocol: "Kriya",
				withdrawCoinTypes: [lpToken.coinTypeX, lpToken.coinTypeY],
				lpToken,
				pool,
			};
		});
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public swapTokenXTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				KriyaApi.constants.moduleNames.wrapper,
				"swap_token_x"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
			],
		});
	};

	public swapTokenYTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				KriyaApi.constants.moduleNames.wrapper,
				"swap_token_y"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
			],
		});
	};

	public removeLiquidityTx = (inputs: {
		tx: TransactionBlock;
		poolId: ObjectId;
		lpTokenId: ObjectId | TransactionArgument;
		amountToRemove: Balance;
		coinTypeX: AnyObjectType;
		coinTypeY: AnyObjectType;
	}) /* (Coin, Coin) */ => {
		const { tx, lpTokenId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.dex,
				KriyaApi.constants.moduleNames.spotDex,
				"remove_liquidity"
			),
			typeArguments: [inputs.coinTypeX, inputs.coinTypeY],
			arguments: [
				tx.object(inputs.poolId), // Pool
				typeof lpTokenId === "string"
					? tx.object(lpTokenId)
					: lpTokenId, // KriyaLPToken
				tx.pure(inputs.amountToRemove, "u64"),
			],
		});
	};

	// =========================================================================
	//  Transaction Command Wrappers
	// =========================================================================

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			pool: KriyaPoolObject;
		}
	) => {
		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
		};

		if (KriyaApi.isCoinX({ ...inputs, coinType: inputs.coinInType })) {
			return this.swapTokenXTx(commandInputs);
		}

		return this.swapTokenYTx(commandInputs);
	};

	public withdrawTx = (
		inputs: ManagementWithdrawTxInputs<KriyaLPInfo>
	) /* (Coin, Coin) */ => {
		const { lpInfo } = inputs;

		return this.removeLiquidityTx({
			...inputs,
			...lpInfo.lpToken,
			lpTokenId: lpInfo.lpToken.objectId,
			amountToRemove: lpInfo.lpToken.lspBalance,
		});
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	public calcWithdrawAmountsOut = (
		inputs: ManagementCalcWithdrawAmountsOutInputs<KriyaLPInfo>
	) => {
		const { lpInfo } = inputs;

		const { lspBalance } = lpInfo.lpToken;
		const { tokenXValue, tokenYValue, lspSupplyValue } = lpInfo.pool;

		const { tokenX, tokenY } = this.getLpAmountOut(
			Number(lspBalance),
			Number(lspSupplyValue),
			Number(tokenXValue),
			Number(tokenYValue)
		);

		return [BigInt(Math.floor(tokenX)), BigInt(Math.floor(tokenY))];
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	private fetchOwnedLpTokens = async (inputs: ApiKriyaOwnedLpTokensBody) => {
		const { walletAddress } = inputs;
		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.lpToken,
			objectFromSuiObjectResponse:
				KriyaApi.kriyaLPTokenObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	private getLpAmountOut = (
		lspAmount: number,
		lspSupply: number,
		reserveX: number,
		reserveY: number
	) => {
		return {
			tokenX: reserveX * (lspAmount / lspSupply),
			tokenY: reserveY * (lspAmount / lspSupply),
		};
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	public static isCoinX = (inputs: {
		pool: KriyaPoolObject;
		coinType: CoinType;
	}) => {
		const { coinType, pool } = inputs;
		return Helpers.addLeadingZeroesToType(coinType) === pool.coinTypeX;
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Casting
	// =========================================================================

	private static kriyaPoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): KriyaPoolObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = getObjectFields(data) as KriyaPoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
			tokenYValue: BigInt(fields.token_y),
			tokenXValue: BigInt(fields.token_x),
			lspSupplyValue: BigInt(fields.lsp_supply.fields.value),
			lspLockedValue: BigInt(fields.lsp_locked),
			lpFeePercent: BigInt(fields.lp_fee_percent),
			protocolFeePercent: BigInt(fields.protocol_fee_percent),
			protocolFeeXValue: BigInt(fields.protocol_fee_x),
			protocolFeeYValue: BigInt(fields.protocol_fee_y),
			isStable: fields.is_stable,
			scaleX: BigInt(fields.scaleX),
			scaleY: BigInt(fields.scaleY),
			isSwapEnabled: fields.is_swap_enabled,
			isDepositEnabled: fields.is_deposit_enabled,
			isWithdrawEnabled: fields.is_withdraw_enabled,
			coinTypeX: coinTypes[0],
			coinTypeY: coinTypes[1],
		};
	};

	private static kriyaPoolCreatedEventFromOnChain = (
		eventOnChain: KriyaPoolCreatedEventOnChain
	): KriyaPoolCreatedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			creator: fields.creator,
			lpFeePercent: BigInt(fields.lp_fee_percent),
			protocolFeePercent: BigInt(fields.protocol_fee_percent),
			isStable: fields.is_stable,
			scaleX: BigInt(fields.scaleX),
			scaleY: BigInt(fields.scaleY),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	private static kriyaLPTokenObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): KriyaLPTokenObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));
		const coinTypeX = coinTypes[0];
		const coinTypeY = coinTypes[1];

		const fields = getObjectFields(data) as KriyaLPTokenFieldsOnChain;
		return {
			objectType,
			objectId: getObjectId(data),
			poolId: Helpers.addLeadingZeroesToType(fields.pool_id),
			lspBalance: BigInt(fields.lsp),
			coinTypeX,
			coinTypeY,
		};
	};
}
