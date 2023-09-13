import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	SuiNetwork,
	Url,
	PerpetualsMarketState,
	PerpetualsMarketData,
	PerpetualsAccountData,
	PerpetualsMarketId,
	ApiPerpetualsAccountsBody,
	PerpetualsPosition,
	PerpetualsOrderSide,
	PerpetualsOrderbook,
	CoinType,
	PerpetualsOrderId,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Casting } from "../../general/utils";
import { PerpetualsOrderUtils } from "./utils";

export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	// TODO: set all of these values correctly
	public static readonly constants = {
		collateralCoinTypes: ["0x2::sui::SUI"],
		bounds: {
			minLeverage: 1,
			maxLeverage: 10,
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "perpetuals");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	public async getAllMarketDatas(inputs: {
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarketData[]> {
		const { collateralCoinType } = inputs;
		return this.fetchApi<PerpetualsMarketData[]>(
			`${collateralCoinType}/markets`
		);
	}

	public async getMarket(inputs: {
		marketId: PerpetualsMarketId;
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarket> {
		const { marketId, collateralCoinType } = inputs;

		const urlPrefix = `${collateralCoinType}/markets/${marketId}`;
		const [marketData, marketState, orderbook] = await Promise.all([
			this.fetchApi<PerpetualsMarketData>(urlPrefix),
			this.fetchApi<PerpetualsMarketState>(`${urlPrefix}/market-state`),
			this.fetchApi<PerpetualsOrderbook>(`${urlPrefix}/orderbook`),
		]);

		return new PerpetualsMarket(
			marketData.marketId,
			collateralCoinType,
			marketData.marketParams,
			marketState,
			orderbook,
			this.network
		);
	}

	public async getMarkets(inputs: {
		marketIds: PerpetualsMarketId[];
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarket[]> {
		const { collateralCoinType } = inputs;
		return Promise.all(
			inputs.marketIds.map((marketId) =>
				this.getMarket({
					marketId,
					collateralCoinType,
				})
			)
		);
	}

	public async getMarketData(inputs: {
		marketId: PerpetualsMarketId;
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarketData> {
		const { marketId, collateralCoinType } = inputs;
		return this.fetchApi(`${collateralCoinType}/markets/${marketId}`);
	}

	public async getMarketDatas(inputs: {
		marketIds: PerpetualsMarketId[];
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarketData[]> {
		const { collateralCoinType } = inputs;
		return Promise.all(
			inputs.marketIds.map((marketId) =>
				this.getMarketData({
					marketId,
					collateralCoinType,
				})
			)
		);
	}

	public async getUserAccounts(
		inputs: ApiPerpetualsAccountsBody & {
			collateralCoinType: CoinType;
		}
	): Promise<PerpetualsAccount[]> {
		const { collateralCoinType, walletAddress } = inputs;

		const accountDatas = await this.fetchApi<
			PerpetualsAccountData[],
			ApiPerpetualsAccountsBody
		>(`${collateralCoinType}/accounts`, {
			walletAddress,
		});

		return accountDatas.map(
			(account) =>
				new PerpetualsAccount(
					account.account,
					account.accountCap,
					this.network
				)
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getCreateAccountTx(inputs: ApiPerpetualsCreateAccountBody) {
		return this.fetchApiTransaction<ApiPerpetualsCreateAccountBody>(
			"transactions/create-account",
			inputs
		);
	}

	// =========================================================================
	//  Public Static Functions
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static positionSide(inputs: {
		position: PerpetualsPosition;
	}): PerpetualsOrderSide {
		const { position } = inputs;

		const baseAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const isLong = Math.sign(baseAmount);

		const side =
			isLong > 0 ? PerpetualsOrderSide.Ask : PerpetualsOrderSide.Bid;
		return side;
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public static calcEntryPrice(inputs: {
		position: PerpetualsPosition;
	}): number {
		const { position } = inputs;

		const denominator = Casting.IFixed.numberFromIFixed(
			position.baseAssetAmount
		);
		if (!denominator) return 0;

		return (
			Casting.IFixed.numberFromIFixed(position.quoteAssetNotionalAmount) /
			denominator
		);
	}
}
