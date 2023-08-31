import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCancelOrderBody,
	ApiPerpetualsClosePositionBody,
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsLimitOrderBody,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsWithdrawCollateralBody,
	PerpetualsAccountId,
	PerpetualsAccountObject,
	PerpetualsMarketId,
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
		public readonly accountId: PerpetualsAccountId,
		public account: PerpetualsAccountObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `perpetuals/accounts/${accountId}`);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Collateral Txs
	// =========================================================================

	public async getDepositCollateralTx(
		inputs: ApiPerpetualsDepositCollateralBody
	) {
		return this.fetchApiTransaction<ApiPerpetualsDepositCollateralBody>(
			"transactions/deposit-collateral",
			inputs
		);
	}

	public async getWithdrawCollateralTx(
		inputs: ApiPerpetualsWithdrawCollateralBody
	) {
		return this.fetchApiTransaction<ApiPerpetualsWithdrawCollateralBody>(
			"transactions/withdraw-collateral",
			inputs
		);
	}

	// =========================================================================
	//  Order Txs
	// =========================================================================

	public async getPlaceMarketOrderTx(inputs: ApiPerpetualsMarketOrderBody) {
		return this.fetchApiTransaction<ApiPerpetualsMarketOrderBody>(
			"transactions/market-order",
			inputs
		);
	}

	public async getPlaceLimitOrderTx(inputs: ApiPerpetualsLimitOrderBody) {
		return this.fetchApiTransaction<ApiPerpetualsLimitOrderBody>(
			"transactions/limit-order",
			inputs
		);
	}

	public async getCancelOrderTx(inputs: ApiPerpetualsCancelOrderBody) {
		return this.fetchApiTransaction<ApiPerpetualsCancelOrderBody>(
			"transactions/cancel-order",
			inputs
		);
	}

	// =========================================================================
	//  Position Txs
	// =========================================================================

	public async getClosePositionTx(inputs: ApiPerpetualsClosePositionBody) {
		return this.fetchApiTransaction<ApiPerpetualsClosePositionBody>(
			"transactions/close-position",
			inputs
		);
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	public positionForMarketId(inputs: {
		marketId: PerpetualsMarketId;
	}): PerpetualsPosition {
		try {
			const posIndex = Number(
				this.account.marketIds.findIndex((id) => {
					return id === inputs.marketId;
				})
			);
			return this.account.positions[posIndex];
		} catch (e) {
			throw new Error("no position found for market");
		}
	}

	public marketIdForPosition(inputs: {
		position: PerpetualsPosition;
	}): bigint {
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
			throw new Error("no market found for position");
		}
	}
}
