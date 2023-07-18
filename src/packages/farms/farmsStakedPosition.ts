import { SuiAddress } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsDepositPrincipalBody,
	ApiFarmsLockBody,
	ApiFarmsRenewLockBody,
	ApiFarmsUnlockBody,
	ApiFarmsUnstakeBody,
	ApiHarvestFarmsRewardsBody,
	Balance,
	CoinType,
	CoinsToBalance,
	FarmsStakedPositionObject,
	SuiNetwork,
	Timestamp,
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

	public rewardCoinTypes = (): CoinType[] => {
		return this.stakedPosition.rewardCoins.map((coin) => coin.coinType);
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
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	public async getDepositPrincipalTransaction(inputs: {
		depositAmount: Balance;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsDepositPrincipalBody>(
			"transactions/deposit-principal",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			}
		);
	}

	public async getUnstakeTransaction(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApiTransaction<ApiFarmsUnstakeBody>(
			"transactions/unstake",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
				withdrawAmount: this.stakedPosition.stakedAmount,
				rewardCoinTypes: this.rewardCoinTypes(),
			}
		);
	}

	// =========================================================================
	//  Locking Transactions
	// =========================================================================

	public async getLockTransaction(inputs: {
		lockDurationMs: Timestamp;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsLockBody>("transactions/lock", {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		});
	}

	public async getRenewLockTransaction(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsRenewLockBody>(
			"transactions/renew-lock",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			}
		);
	}

	public async getUnlockTransaction(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApiTransaction<ApiFarmsUnlockBody>(
			"transactions/unlock",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			}
		);
	}

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	public async getHarvestRewardsTransaction(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiHarvestFarmsRewardsBody>(
			"transactions/harvest-rewards",
			{
				...inputs,
				stakedPositionIds: [this.stakedPosition.objectId],
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
				rewardCoinTypes: this.rewardCoinTypes(),
			}
		);
	}

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
