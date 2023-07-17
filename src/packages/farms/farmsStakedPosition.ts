import { Caller } from "../../general/utils/caller";
import {
	CoinType,
	CoinsToBalance,
	FarmsStakedPositionObject,
	SuiNetwork,
	Url,
} from "../../types";

export class FarmsStakedPosition extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly stakedPosition: FarmsStakedPositionObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `farms/staked-positions/${stakedPosition.objectId}`);
		this.stakedPosition = stakedPosition;
	}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Getters
	// =========================================================================

	public isLocked = (): boolean => {
		const nowTimestamp = Date.now();
		return this.unlockTimestamp() > nowTimestamp;
	};

	public isLockDuration = (): boolean => {
		return this.stakedPosition.lockDurationMs > 0;
	};

	public unlockTimestamp = (): number => {
		return (
			this.stakedPosition.lockStartTimestamp +
			this.stakedPosition.lockDurationMs
		);
	};

	public rewardCoinsToClaimableBalance = (): CoinsToBalance => {
		return this.stakedPosition.rewardCoins.reduce(
			(acc, coin) => ({
				...acc,
				[coin.coinType]:
					coin.baseRewardsAccumulated - coin.baseRewardsDebt,
			}),
			{} as CoinsToBalance
		);
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	public rewardsEarned = (inputs: { coinType: CoinType }) => {
		const rewardCoin = this.getRewardCoin(inputs.coinType);
		return rewardCoin.baseRewardsAccumulated - rewardCoin.baseRewardsDebt;
	};

	public rewardsApy = (inputs: { coinType: CoinType }) => {
		const rewardCoin = this.getRewardCoin(inputs.coinType);

		// TODO: make this calculation

		return Math.random();
	};

	// =========================================================================
	//  Private
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private getRewardCoin = (coinType: CoinType) => {
		const foundCoin = this.stakedPosition.rewardCoins.find(
			(coin) => coin.coinType === coinType
		);
		if (!foundCoin) throw new Error("Invalid coin type");

		return foundCoin;
	};
}
