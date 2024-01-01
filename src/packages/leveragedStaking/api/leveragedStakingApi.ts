import {
	TransactionBlock,
	TransactionObjectArgument,
} from "@mysten/sui.js/transactions";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	ObjectId,
	PoolsAddresses,
	StakingAddresses,
	SuiAddress,
	LeveragedStakingAddresses,
	ScallopProviders,
	ScallopAddresses,
	ScallopMarketPool,
	ScallopMarketCollateral,
	ApiLeveragedStakePositionBody,
	ApiLeveragedStakePositionResponse,
	LeveragedAfSuiState,
	ApiIndexerUserEventsBody,
	LeveragedStakingEvent,
	IndexerEventsWithCursor,
	LeveragedStakingPerformanceDataPoint,
	LeveragedStakingPerformanceGraphDataTimeframeKey,
	LeveragedStakingPerformanceDataBody,
	Percentage,
	LeveragedAfSuiPosition,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import { Sui } from "../../sui";
import { LeveragedStaking } from "..";
import { EventOnChain } from "../../../general/types/castingTypes";
import {
	LeveragedStakeChangedLeverageEventOnChain,
	LeveragedStakedEventOnChain,
	LeveragedUnstakedEventOnChain,
} from "./leveragedStakingApiCastingTypes";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Pool, Staking } from "../..";
import BigNumber from 'bignumber.js';
import { BalanceSheet, BorrowIndex, InterestModel, MarketPool, ScallopTxBlock, SupportPoolCoins } from "@scallop-io/sui-scallop-sdk";

/**
 * Represents the API for interacting with the Leveraged Staking module.
 */
export class LeveragedStakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		moduleNames: {
			leveragedAfSuiPosition: "leveraged_afsui_position",
			leveragedAfSuiState: "leveraged_afsui_state",
			interface: "interface",
			events: "events",
		},
		eventNames: {
			leveragedStaked: "StakedEvent",
			leveragedUnstaked: "UnstakedEvent",
			leverageChanged: "ChangedLeverageEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		leveragedStaking: LeveragedStakingAddresses;
		staking: StakingAddresses;
		pools: PoolsAddresses;
		scallop: ScallopAddresses;
	};

	public readonly eventTypes: {
		leveragedStaked: AnyObjectType;
		leveragedUnstaked: AnyObjectType;
		leverageChanged: AnyObjectType;
	};

	public readonly objectTypes: {
		leveragedAfSuiPosition: AnyObjectType;
	};

	public static readonly dataTimeframesToDays: Record<
		LeveragedStakingPerformanceGraphDataTimeframeKey,
		number
	> = {
		"1M": 30,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an instance of the LeveragedStakingApi class.
	 * @param {AftermathApi} Provider - The AftermathApi instance.
	 * @param {ScallopProviders} ScallopProviders - The ScallopProviders instance.
	 * @throws {Error} If not all required addresses have been set in provider.
	 */
	constructor(
		private readonly Provider: AftermathApi,
		private readonly ScallopProviders?: ScallopProviders
	) {
		const leveragedStaking = this.Provider.addresses.leveragedStaking;
		const staking = this.Provider.addresses.staking;
		const pools = this.Provider.addresses.pools;
		const scallop = this.Provider.addresses.scallop;

		if (!leveragedStaking || !staking || !pools || !scallop)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			leveragedStaking,
			staking,
			pools,
			scallop,
		};

		this.eventTypes = {
			leveragedStaked: this.leveragedStakedEventType(),
			leveragedUnstaked: this.leveragedUnstakedEventType(),
			leverageChanged: this.leverageChangedEventType(),
		};

		this.objectTypes = {
			leveragedAfSuiPosition: `${leveragedStaking.packages.leveragedAfSuiInitial}::leveraged_afsui_position::LeveragedAfSuiPosition`,
		};
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches the leveraged stake position for a given wallet address.
	 * @param inputs - The input parameters for fetching the leveraged stake position.
	 * @returns A promise that resolves to the leveraged stake position response.
	 */
	public fetchLeveragedStakePosition = async (
		inputs: ApiLeveragedStakePositionBody
	): Promise<ApiLeveragedStakePositionResponse> => {
		const { walletAddress } = inputs;

		const leveragedAfSuiPositions =
			await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.leveragedAfSuiPosition,
				objectFromSuiObjectResponse:
					Casting.leveragedStaking
						.leveragedAfSuiPositionFromSuiObjectResponse,
			});
		if (leveragedAfSuiPositions.length <= 0) return "none";

		return leveragedAfSuiPositions[0];
	};

	/**
	 * Fetches the SUI market pool.
	 * @returns A promise that resolves to the ScallopMarketPool object representing the SUI market pool.
	 * @throws An error if the SUI market pool is not found.
	 */
	public fetchSuiMarketPool = async (): Promise<ScallopMarketPool> => {
		if (!this.ScallopProviders) throw new Error("ScallopProviders not set");

		const suiMarketPool = await this.ScallopProviders.Query.getMarketPool(
			"sui"
		);
		if (!suiMarketPool) throw new Error("sui market pool not found");
		return suiMarketPool;
	};

	/**
	 * Fetches the LeveragedAfSuiState.
	 * @returns A promise that resolves to the LeveragedAfSuiState.
	 */
	public fetchLeveragedAfSuiState =
		async (): Promise<LeveragedAfSuiState> => {
			return this.Provider.Objects().fetchCastObject({
				objectId:
					this.addresses.leveragedStaking.objects.leveragedAfSuiState,
				objectFromSuiObjectResponse:
					Casting.leveragedStaking
						.leveragedAfSuiStateFromSuiObjectResponse,
			});
		};

	/**
	 * Fetches the market collateral for the AfSui market.
	 * @returns A promise that resolves to the ScallopMarketCollateral object.
	 * @throws An error if the Sui market pool is not found.
	 */
	public fetchAfSuiMarketCollateral =
		async (): Promise<ScallopMarketCollateral> => {
			if (!this.ScallopProviders)
				throw new Error("ScallopProviders not set");

			const afSuiMarketCollateral =
				await this.ScallopProviders.Query.getMarketCollateral("afsui");
			if (!afSuiMarketCollateral)
				throw new Error("sui market pool not found");
			return afSuiMarketCollateral;
		};

	public fetchLeveragedAfSuiPosition = async (inputs: {
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
	}): Promise<LeveragedAfSuiPosition> => {		
		// ia. Obtain the owned `LeveragedAfSuiPosition` object.
		const leveragedAfSuiPosition = await this.Provider.Objects().fetchCastObject<LeveragedAfSuiPosition>({
			objectId: inputs.leveragedAfSuiPositionId,
			objectFromSuiObjectResponse: 
				Casting.leveragedStaking
					.leveragedAfSuiPositionFromSuiObjectResponse,
		});

		// ib. Obtain the shared `Obligation` object.
		const obligation = await this.ScallopProviders.Query.queryObligation(
			inputs.obligationId.toString()
		);

		// ic. Obtain Scallop's SUI Market.
		const marketData = await this.getMarketData({...inputs, poolCoinName: 'sui'});
		const oldBorrowIndex = Math.ceil(Number(marketData.borrowIndex));
		
		// ii. Update the position's Borrow Index to account for increase in the SUI Borrow Rate.
		// 	new_borrow_index = old_borrow_index + (old_borrow_index * interest_rate * time_delta)
		const currentTimestamp = Math.ceil(dayjs().valueOf() / 1000);
		const lastUpdated = Number(marketData.lastUpdated);
		const timeDelta = currentTimestamp
			- lastUpdated
		
		const interestRate = Number(marketData.interestRate.value);
		const interestRateScale = Number(marketData.interestRateScale) 
			* 100;
		
		const borrowIndexDelta = (oldBorrowIndex * interestRate * timeDelta) 
			/ interestRateScale;
		
		const newBorrowIndex = oldBorrowIndex
			+ borrowIndexDelta;

		// iii. Increase the Position's debt.
		const positionBorrowIndex = Number(obligation.debts[0].borrowIndex || 0);
		const increasedRate = newBorrowIndex 
			/ positionBorrowIndex
			- 1;
		
		const positionSuiDebt = BigNumber(obligation.debts[0].amount || 0);
		const availableRepayAmount = positionSuiDebt
			.multipliedBy(increasedRate + 1)
			// .multipliedBy(1.01)
			.toNumber();

		const positionSuiDebtUpdated = BigInt(Math.ceil(availableRepayAmount));
		
		return {
			...leveragedAfSuiPosition,
			suiDebt: positionSuiDebtUpdated
		};
	}

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public newLeveragedAfSuiPositionTx = (inputs: {
		tx: TransactionBlock;
		obligationKeyId: ObjectId | TransactionObjectArgument;
	}): [
		leveragedAfSuiPosition: TransactionObjectArgument
	] /* (LeveragedAfSuiPosition) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames
					.leveragedAfSuiPosition,
				"new_leveraged_afsui_position"
			),
			typeArguments: [],
			arguments: [
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
				Helpers.addTxObject(tx, inputs.obligationKeyId), // ObligationKey
			],
		});
	};

	public initiateLeverageStakeTx = (inputs: {
		tx: TransactionBlock;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
	}): [
		leveragedActionCapId: TransactionObjectArgument
	] /* LeveragedActionCap */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"initiate_leverage_stake"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
				Helpers.addTxObject(tx, inputs.afSuiCoinId), // Coin
			],
		});
	};

	public initiateLeverageUnstakeTx = (inputs: {
		tx: TransactionBlock;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		unstakeAmount: Balance;
	}): [
		leveragedActionCapId: TransactionObjectArgument
	] /* LeveragedActionCap */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"initiate_leverage_unstake"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
				tx.pure(inputs.unstakeAmount, "u64"), // withdraw_amount
			],
		});
	};

	public initiateChangeLeverageTx = (inputs: {
		tx: TransactionBlock;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
	}): [
		leveragedActionCapId: TransactionObjectArgument
	] /* LeveragedActionCap */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"initiate_change_leverage"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
			],
		});
	};

	public completeActionTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"complete_action"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
				Helpers.addTxObject(tx, inputs.obligationId), // Obligation,
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe<TreasuryCap<AFSUI>>
			],
		});
	};

	public depositAfSuiCollateralTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"deposit_afsui_collateral"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				Helpers.addTxObject(tx, inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				Helpers.addTxObject(tx, inputs.afSuiCoinId), // Coin
			],
		});
	};

	public withdrawAfSuiCollateralTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		withdrawAmount: Balance;
	}): [afSuiCoinId: TransactionObjectArgument] /* Coin<AFSUI> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"withdraw_afsui_collateral"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				Helpers.addTxObject(tx, inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(this.addresses.scallop.objects.coinDecimalsRegistry), // CoinDecimalsRegistry
				tx.pure(inputs.withdrawAmount, "u64"), // withdraw_amount
				tx.object(this.addresses.scallop.objects.xOracle), // XOracle
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public borrowSuiTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		borrowAmount: Balance;
	}): [suiCoinId: TransactionObjectArgument] /* Coin<SUI> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"borrow_sui"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				Helpers.addTxObject(tx, inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(this.addresses.scallop.objects.coinDecimalsRegistry), // CoinDecimalsRegistry
				tx.pure(inputs.borrowAmount, "u64"), // borrow_amount
				tx.object(this.addresses.scallop.objects.xOracle), // XOracle
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public repaySuiTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		suiCoinId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"repay_sui"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				Helpers.addTxObject(tx, inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				Helpers.addTxObject(tx, inputs.suiCoinId), // Coin
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	// ERROR Notes:
	//  > [ScallopLeveragedAfSui] [interface] 0: EInvalidLeveragedAfSuiPosition
	//  > [ScallopLeveragedAfSui] [leveraged_afsui_state] 0: EInvalidProtocolVersion

	//  > [Scallop] 513 -> 0x201: version_mismatch_error
	//  > [Scallop] 1025 -> 0x401: oracle_stale_price_error
	//  > [Scallop] [borrow] 1281 -> 0x501: borrow_too_much_error
	//  > [Scallop] [reserve] 1283 -> 0x503: flash_loan_repay_not_enough_error
	//  > [Scallop] [deposit_collateral]  1793 -> 0x701: max_collateral_reached_error
	//  > [Scallop] [withdraw_collateral] 1795 -> 0x703: withdraw_collateral_too_much_error

	//  > [afSUI] [actions] 3: ELessThanMinimumStakingThreshold

	//  > [Pyth] [pyth_adaptor] 70146: assert_price_not_stale
	// 		{ address: 910f30cbc7f601f75a5141a01265cd47c62d468707c5e1aecb32a18f448cb25a}}

	//  > [SUI] [dynamic_field] 1: EFieldDoesNotExist (The object does not have a dynamic field with
	//      this name (with the value and type specified))

	public fetchBuildWithdrawAfSuiCollateralTx = async (inputs: {
		scallopTx: ScallopTxBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		withdrawAmount: Balance;
	}): Promise<[afSuiCoinId: TransactionObjectArgument]> /* Coin<AFSUI> */ => {
		const { scallopTx } = inputs;

		// i. Update Scallop's price feeds for SUI and afSUI.
		await scallopTx.updateAssetPricesQuick(["sui", "afsui"]);
		
		// ii. Withdraw `withdrawAmount` worth of afSUI collateral.
		const [unstakedAfSuiCollateral] = this.withdrawAfSuiCollateralTx({
			...inputs,
			tx: scallopTx.txBlock,
			leveragedActionCapId: inputs.leveragedActionCapId,
			withdrawAmount: inputs.withdrawAmount,
		});

		return unstakedAfSuiCollateral;
	}

	// TODO(kevin): Documentation
	public fetchBuildOpenLeveragedStakeTx = async (inputs: {
		walletAddress: SuiAddress;
		stakeAmount: Balance;
		stakeCoinType: "sui" | "afsui";
		leverage: number;
		slippage: Percentage;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		if (!this.ScallopProviders) throw new Error("ScallopProviders not set");

		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(inputs.walletAddress);

		// i. Create an `Obligation` on Scallop.
		const [obligationId, obligationKeyId, obligationHotPotatoId] =
			scallopTx.openObligation();

		// ii. Open a new `LeveragedAfSuiPosition` position.
		const [leveragedAfSuiPositionId] = this.newLeveragedAfSuiPositionTx({
			tx,
			obligationKeyId,
		});

		// iii. Leverage stake.
		await this.buildLeveragedStakeTx({
			...inputs,
			scallopTx,
			leveragedAfSuiPositionId,
			obligationId,
			baseAfSuiCollateral: BigInt(0),
			totalAfSuiCollateral: BigInt(0),
			totalSuiDebt: BigInt(0),
		});

		// iv. Return the `LeveragedAfSuiPosition` to the sender.
		tx.transferObjects([leveragedAfSuiPositionId], inputs.walletAddress);

		// v. Share the associated `Obligation` object.
		scallopTx.returnObligation(obligationId, obligationHotPotatoId);

		return tx;
	};

	// TODO(kevin): Documentation
	public fetchBuildLeveragedStakeTx = async (inputs: {
		walletAddress: SuiAddress;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		stakeAmount: Balance;
		stakeCoinType: "sui" | "afsui";
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		leverage: number;
		slippage: Percentage;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		if (!this.ScallopProviders) throw new Error("ScallopProviders not set");

		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(inputs.walletAddress);

		// i. Leverage stake.
		await this.buildLeveragedStakeTx({
			...inputs,
			scallopTx,
		});

		return tx;
	};

	// TODO(kevin): Documentation
	private buildLeveragedStakeTx = async (inputs: {
		scallopTx: ScallopTxBlock;
		walletAddress: SuiAddress;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		stakeAmount: Balance;
		stakeCoinType: "sui" | "afsui";
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		leverage: number;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}) => {
		const {
			scallopTx,
			referrer,
			walletAddress,
			leveragedAfSuiPositionId,
			obligationId,
			stakeAmount,
			isSponsoredTx,
		} = inputs;

		const tx = scallopTx.txBlock;

		// TODO(Collin/Kevin): assert that `leverage` is less than or equal to `1 / (1 - collateralWeight)`.

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		let newBaseAfSuiCollateral: Balance;
		let afSuiCoinId;
		// i. Obtain the amount and ID of the afSUI collateral to be deposited. The user can choose to
		//  leverage stake starting in SUI in which case their SUI needs to be staked to afSUI.
		if (inputs.stakeCoinType === "sui") {
			// ia. If the input was denominated in SUI, stake to afSUI.
			const suiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				isSponsoredTx,
				coinType: Coin.constants.suiCoinType,
				coinAmount: stakeAmount,
			});

			const swapOrStakeResult = await this.swapOrStakeSuiToAfSui({
				tx,
				suiAmount: stakeAmount,
				suiCoinId: suiCoin,
			});
			newBaseAfSuiCollateral = swapOrStakeResult.minAmountOut;
			afSuiCoinId = swapOrStakeResult.afSuiCoinId;
		} else {
			// ib. Obtain afSUI coin with `stakeAmount` value.
			newBaseAfSuiCollateral = stakeAmount;

			afSuiCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				isSponsoredTx,
				coinType: this.Provider.Staking().coinTypes.afSui,
				coinAmount: stakeAmount,
			});
		}

		// ii. Initiate Stake tx.
		const leveragedActionCapId = this.initiateLeverageStakeTx({
			tx,
			leveragedAfSuiPositionId,
			afSuiCoinId,
		});

		// iii. Deposit afSUI as collateral on Scallop.
		this.depositAfSuiCollateralTx({
			...inputs,
			tx,
			leveragedActionCapId,
			afSuiCoinId,
			obligationId: inputs.obligationId,
		});

		if (inputs.leverage > 1) {
			// iv. Increase the leverage to the desired leverage ratio.
			await this.fetchBuildIncreaseLeverageTx({
				...inputs,
				baseAfSuiCollateral:
					inputs.baseAfSuiCollateral + newBaseAfSuiCollateral,
				totalAfSuiCollateral:
					inputs.totalAfSuiCollateral + newBaseAfSuiCollateral,
				totalSuiDebt: inputs.totalSuiDebt,
				newLeverage: inputs.leverage,
				leveragedActionCapId,
			});
		}

		// v. Complete the Stake transaction and emit an event.
		this.completeActionTx({
			tx,
			leveragedActionCapId,
			leveragedAfSuiPositionId,
			obligationId,
		});
	};

	// TODO(Kevin): Documentation.
	public fetchBuildLeveragedUnstakeTx = async (inputs: {
		walletAddress: SuiAddress;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;  // TODO: remove
		totalSuiDebt: Balance;			// TODO: remove
		unstakeAmount: Balance;
		desiredUnstakeCoinType: "sui" | "afsui";
		slippage: Percentage;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		if (!this.ScallopProviders) throw new Error("ScallopProviders not set");
		const {
			referrer,
			walletAddress,
			leveragedAfSuiPositionId,
			obligationId,
			unstakeAmount,
			desiredUnstakeCoinType,
			slippage,
		} = inputs;

		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(walletAddress);

		// i. Set the users referrer address.
		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// ii. Obtain the user's `LeveragedAfSuiPosition`.
		const leveragedAfSuiPosition = await this.fetchLeveragedAfSuiPosition({
			leveragedAfSuiPositionId,
    		obligationId,
		});

		// iii. Initiate Unstake tx.
		const leveragedActionCapId = this.initiateLeverageUnstakeTx({
			tx,
			leveragedAfSuiPositionId,
			unstakeAmount,
		});

		const afSuiToSuiExchangeRate =
			await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();

		// iv. Calculate current leverage ratio.
		const currentLeverageRatio = LeveragedStaking.calcLeverage({
			totalSuiDebt: leveragedAfSuiPosition.suiDebt,
			totalAfSuiCollateral: leveragedAfSuiPosition.afSuiCollateral,
			afSuiToSuiExchangeRate,
		});

		let unstakedCoinId;
		let unstakedCoinType;
		// [Edge Case] Position has no debt.
		if (leveragedAfSuiPosition.suiDebt == BigInt(0)) {
			// va. Withdraw `unstakeAmount` worth of afSUI collateral.
			const [unstakedAfSuiCollateral] = await this.fetchBuildWithdrawAfSuiCollateralTx({
				...inputs,
				scallopTx,
				leveragedActionCapId,
				withdrawAmount: unstakeAmount,
			});
			unstakedCoinId = unstakedAfSuiCollateral;
			unstakedCoinType = "afsui"
		} else /* (leveragedAfSuiPosition.suiDebt > BigInt(0)) */ {
			// vb. Decrease the leverage to the desired leverage ratio.
			const remainingSuiCoinId = await this.fetchBuildDecreaseLeverageTx({
				scallopTx,
				leveragedActionCapId,
				leveragedAfSuiPositionId,
				obligationId,
				totalSuiDebt: leveragedAfSuiPosition.suiDebt,
				totalAfSuiCollateral: leveragedAfSuiPosition.afSuiCollateral,
				// REVIEW(Kevin): should we be subtracting from here too?
				//
				// totalAfSuiCollateral:
				// 	inputs.totalAfSuiCollateral - unstakeAmount,
				newLeverage: currentLeverageRatio,
				baseAfSuiCollateral: inputs.baseAfSuiCollateral - unstakeAmount,
				slippage,
			});

			unstakedCoinId = remainingSuiCoinId;
			unstakedCoinType = "sui"
		};

		// vi. Return the unstaked coin to the user in their desired coin (SUI or afSUI).
		if (unstakedCoinType == inputs.desiredUnstakeCoinType) {
			// via. Unstaked coin already in desired coin type; no extra work needed.
			tx.transferObjects([unstakedCoinId], walletAddress);
		} else if (desiredUnstakeCoinType == "sui") {
			// vib. Swap withdrawn afSUI into SUI and return to the user.
			const poolObject = await this.Provider.Pools().fetchPool({
				objectId: this.addresses.leveragedStaking.objects.afSuiSuiPoolId,
			});
			const pool = new Pool(poolObject);

			const swappedSuiCoinId = await this.Provider.Pools().fetchAddTradeTx({
				tx,
				pool,
				coinInAmount: unstakeAmount,
				coinInId: unstakedCoinId,
				coinInType: this.Provider.Staking().coinTypes.afSui,
				coinOutType: Coin.constants.suiCoinType,
				slippage,
			});

			tx.transferObjects([swappedSuiCoinId], walletAddress);
		} else /* if (desiredUnstakeCoinType == "afsui") */ {
			// vic. Stake the withdrawn SUI for afSUI and return to the user.
			let [unstakedAfSuiCollateral] = this.Provider.Staking().stakeTx({
				tx,
				validatorAddress:
					this.addresses.leveragedStaking.objects.aftermathValidator,
				suiCoin: unstakedCoinId,
			});

			tx.transferObjects([unstakedAfSuiCollateral], walletAddress);
		};

		// vii. Complete Unstake tx.
		this.completeActionTx({
			tx,
			leveragedActionCapId,
			leveragedAfSuiPositionId,
			obligationId,
		});

		return tx;
	};

	// TODO(Kevin): Documentation.
	public fetchBuildChangeLeverageTx = async (inputs: {
		walletAddress: SuiAddress;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		currentLeverage: number;
		newLeverage: number;
		slippage: Percentage;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}) => {
		if (!this.ScallopProviders) throw new Error("ScallopProviders not set");
		const {
			referrer,
			walletAddress,
			leveragedAfSuiPositionId,
			obligationId,
		} = inputs;

		// TODO(Collin/Kevin): assert that `leverage` is less than or equal to `1 / (1 - collateralWeight)`.
		//  If leverage is greater than this then the user's collateral will not be enough to support the amount
		//  of SUI that must be borrowed to reach that leverage ratio.

		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// i. Initiate Change Leverage tx.
		const leveragedActionCapId = this.initiateChangeLeverageTx({
			tx,
			leveragedAfSuiPositionId,
		});

		// ii. Update the leverage in the desired direction.
		if (inputs.newLeverage < inputs.currentLeverage) {
			// iia. Remove afSUI Collateral and repay debt to reach desired leverage.
			const remainingSuiCoinId = await this.fetchBuildDecreaseLeverageTx({
				...inputs,
				scallopTx,
				leveragedActionCapId,
			});

			// iib. Use remaining SUI to pay off SUI debt on Scallop.
			this.repaySuiTx({
				...inputs,
				tx,
				leveragedActionCapId,
				suiCoinId: remainingSuiCoinId,
			});
		} else {
			// iic. Borrow SUI and deposit more afSUI Collateral to reach desired leverage.
			await this.fetchBuildIncreaseLeverageTx({
				...inputs,
				scallopTx,
				leveragedActionCapId,
			});
		}

		// iii. Complete Change Leverage tx.
		this.completeActionTx({
			tx,
			leveragedActionCapId,
			leveragedAfSuiPositionId,
			obligationId,
		});

		return tx;
	};

	// TODO(Kevin): Documentation.
	private fetchBuildIncreaseLeverageTx = async (inputs: {
		scallopTx: ScallopTxBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		// REVIEW(Kevin): this arg can be deleted.
		//
		obligationId: ObjectId | TransactionObjectArgument;
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		newLeverage: number;
	}) => {
		const { scallopTx } = inputs;

		const tx = scallopTx.txBlock;

		const afSuiToSuiExchangeRate =
			await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();

		const newTotalAfSuiCollateral = BigInt(
			Math.floor(Number(inputs.baseAfSuiCollateral) * inputs.newLeverage)
		);

		// ia. Calculate the extra amount of afSUI collateral that must be deposited to reach the new
		//  desired leverage.
		const increaseInTotalAfSuiCollateral =
			newTotalAfSuiCollateral - inputs.totalAfSuiCollateral;

		// ib. Calculate amount of SUI that must be flash loaned to account for
		//  `increaseInAfSuiCollateral`.
		const flashLoanAmount: Balance = BigInt(
			Math.floor(
				Number(increaseInTotalAfSuiCollateral) * afSuiToSuiExchangeRate
			)
		);

		// ii. Flash loan the required amount of SUI from Scallop to increase the position by
		//  `increaseInAfSuiCollateral` afSUI.
		const [flashLoanedSuiCoinId, loan] = scallopTx.borrowFlashLoan(
			flashLoanAmount,
			"sui"
		);

		const { afSuiCoinId } = await this.swapOrStakeSuiToAfSui({
			tx,
			suiAmount: flashLoanAmount,
			suiCoinId: flashLoanedSuiCoinId,
		});

		// iv. Deposit the staked afSUI as collateral on Scallop.
		this.depositAfSuiCollateralTx({
			...inputs,
			tx,
			afSuiCoinId,
			obligationId: inputs.obligationId,
		});

		// REVIEW(Kevin): check if both assets need to be updated.
		//
		await scallopTx.updateAssetPricesQuick(["sui", "afsui"]);
		// v. Borrow amount of SUI required to pay off flash loan.
		const [borrowedSuiCoinId] = this.borrowSuiTx({
			...inputs,
			tx,
			borrowAmount: flashLoanAmount + BigInt(/*0__0*/50_000_000),
			// borrowAmount: flashLoanAmount,
		});

		const repayLoanSuiCoinId = tx.splitCoins(borrowedSuiCoinId, [
			flashLoanAmount,
		]);

		// vi. Repay flash loan on Scallop.
		scallopTx.repayFlashLoan(
			// flashLoanedSuiCoinId,
			repayLoanSuiCoinId,
			// borrowedSuiCoinId, 
			loan, 
			"sui"
		);

		// Leftover SUI is used to repay SUI debt.
		this.repaySuiTx({
			...inputs,
			tx,
			suiCoinId: borrowedSuiCoinId,
		});

		// REVIEW(kevin): will there even be any leftover SUI to repay?
		//
		// // vii. [Potentially] Use remaining SUI to repay debt.
		// this.repaySuiTx({
		// 	tx,
		// 	leveragedActionCapId,
		// 	obligationId,
		// 	suiCoinId: borrowedSuiCoinId,
		// });
	};

	// TODO(Kevin): Documentation.
	//
	// To decrease leverage, a user needs to withdraw afSUI collateral. To withdraw collateral, a user must first
	//  repay some or all of their SUI debt. The decrease leverage flow is as follows:
	//   1. Calculate how much SUI debt must be repayed to allow withdrawing desired afSUI collateral.
	//   2. Flash loan SUI.
	//   3. Use SUI to repay debt on Scallop.
	//   4. Withdraw afSUI collateral on Scallop.
	//   5. Convert afSUI to SUI.
	//   6. Repay flash loan.
	private fetchBuildDecreaseLeverageTx = async (inputs: {
		scallopTx: ScallopTxBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		newLeverage: number;
		slippage: Percentage;
	}): Promise<ObjectId | TransactionObjectArgument> /* Coin<SUI> */ => {
		const { scallopTx, slippage } = inputs;
		const tx = scallopTx.txBlock;

		const afSuiToSuiExchangeRate =
			await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();

		let decreaseInAfSuiCollateral;
		let decreaseInSuiDebt;

		// [Edge Case] User wants to unstake their entire position.
		if (inputs.baseAfSuiCollateral == BigInt(0)) {
			// TODO: [edge case] handle closing of position.
			//
			decreaseInAfSuiCollateral = BigInt(inputs.totalAfSuiCollateral);
			// decreaseInAfSuiCollateral = inputs.totalAfSuiCollateral;
			decreaseInSuiDebt = inputs.totalSuiDebt;
		} else {
			// ia. Calculate the amount of afSUI collateral that must be withdrawn to reach
			//  a leverage ratio of `newLeverage`.
			const newTotalAfSuiCollateral = BigInt(
				Math.floor(
					Number(inputs.baseAfSuiCollateral) * inputs.newLeverage
				)
			);
			decreaseInAfSuiCollateral = inputs.totalAfSuiCollateral 
				- newTotalAfSuiCollateral;

			// ib. Calculate the amount of SUI debt that must be repayed to allow withdrawing
			//  `decreaseInAfSuiCollateral` worth of afSUI collateral.
			const newSuiDebt = BigInt(
				Math.floor(
					Number(newTotalAfSuiCollateral - inputs.baseAfSuiCollateral) *
						afSuiToSuiExchangeRate
				)
			);
			decreaseInSuiDebt = inputs.totalSuiDebt - newSuiDebt;
		}

		// ii. Flash loan `decreaseInSuiDebt` worth of SUI from Scallop.
		const [flashLoanedSuiCoinId, loan] = scallopTx.borrowFlashLoan(
			decreaseInSuiDebt,
			"sui"
		);

		// iii. Repay `decreaseInSuiDebt` of SUI debt.
		this.repaySuiTx({
			...inputs,
			tx,
			suiCoinId: flashLoanedSuiCoinId,
		});

		// iv. Withdraw `decreaseInCollateralAmount` worth of afSUI collateral.
		const [afSuiId] = await this.fetchBuildWithdrawAfSuiCollateralTx({
			...inputs,
			withdrawAmount: decreaseInAfSuiCollateral,
		});

		// v. Convert `decreaseInCollateralAmount` of withdrawn collateral into SUI.
		const poolObject = await this.Provider.Pools().fetchPool({
			objectId: this.addresses.leveragedStaking.objects.afSuiSuiPoolId,
		});
		const pool = new Pool(poolObject);

		const swappedSuiCoinId = await this.Provider.Pools().fetchAddTradeTx({
			tx,
			pool,
			coinInAmount: BigInt(
				Math.floor(Number(decreaseInSuiDebt) * afSuiToSuiExchangeRate)
			),
			coinInId: afSuiId,
			coinInType: this.Provider.Staking().coinTypes.afSui,
			coinOutType: Coin.constants.suiCoinType,
			slippage,
		});

		const repayLoanSuiCoinId = tx.splitCoins(swappedSuiCoinId, [
			decreaseInSuiDebt,
		]);

		// vi. Repay flash loan with converted SUI.
		scallopTx.repayFlashLoan(repayLoanSuiCoinId, loan, "sui");

		return swappedSuiCoinId;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches events for a specific user.
	 * @param inputs - The input parameters for fetching events.
	 * @returns A promise that resolves to an object containing the fetched events and a cursor for pagination.
	 */
	public async fetchEventsForUser(
		inputs: ApiIndexerUserEventsBody
	): Promise<IndexerEventsWithCursor<LeveragedStakingEvent>> {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`leveraged-staking/${walletAddress}/events`,
			{
				cursor,
				limit,
			},
			(event) => {
				const eventType = (event as EventOnChain<any>).type;
				return eventType.includes(this.eventTypes.leveragedStaked)
					? Casting.leveragedStaking.leveragedStakedEventFromOnChain(
							event as LeveragedStakedEventOnChain
					  )
					: eventType.includes(this.eventTypes.leveragedUnstaked)
					? Casting.leveragedStaking.leveragedUnstakedEventFromOnChain(
							event as LeveragedUnstakedEventOnChain
					  )
					: Casting.leveragedStaking.leveragedStakeChangedEventFromOnChain(
							event as LeveragedStakeChangedLeverageEventOnChain
					  );
			}
		);
	}

	// =========================================================================
	//  Graph Data
	// =========================================================================

	/**
	 * Fetches the performance data for leveraged staking.
	 * @param inputs - The inputs for fetching performance data.
	 * @returns A promise that resolves to an array of LeveragedStakingPerformanceDataPoint objects.
	 */
	public async fetchPerformanceData(
		inputs: LeveragedStakingPerformanceDataBody
	): Promise<LeveragedStakingPerformanceDataPoint[]> {
		const { timeframe, borrowRate, maxLeverage } = inputs;

		dayjs.extend(duration);
		const limit = // days ~ epochs
			dayjs
				.duration(
					LeveragedStakingApi.dataTimeframesToDays[timeframe],
					"days"
				)
				// + 2 to account for apy being calculated from events delta
				// (and possible initial 0 afsui supply)
				.asDays() + 2;

		// TODO: fetch borrow rate historically once scallop implements
		const [recentEpochChanges] = await Promise.all([
			this.Provider.Staking().fetchEpochWasChangedEvents({
				limit,
			}),
		]);
		if (recentEpochChanges.events.length <= 2) return [];

		const daysInYear = 365;
		const timeData = recentEpochChanges.events
			.slice(2)
			.map((event, index) => {
				const currentRate = Number(event.totalAfSuiSupply)
					? Number(event.totalSuiAmount) /
					  Number(event.totalAfSuiSupply)
					: 1;

				const pastEvent = recentEpochChanges.events[index + 1];
				const pastRate = Number(pastEvent.totalAfSuiSupply)
					? Number(pastEvent.totalSuiAmount) /
					  Number(pastEvent.totalAfSuiSupply)
					: 1;

				const afSuiApy =
					((currentRate - pastRate) / pastRate) * daysInYear;
				return {
					time: event.timestamp ?? 0,
					sui: 0,
					afSui: afSuiApy,
					leveragedAfSui:
						maxLeverage *
						(afSuiApy - borrowRate * (1 - 1 / maxLeverage)),
				};
			});

		return timeData;
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	private swapOrStakeSuiToAfSui = async (inputs: {
		tx: TransactionBlock;
		suiAmount: Balance;
		suiCoinId: ObjectId | TransactionObjectArgument;
	}): Promise<{
		afSuiCoinId: TransactionObjectArgument;
		minAmountOut: Balance;
	}> => {
		const { tx, suiAmount, suiCoinId } = inputs;

		const estimatedSlippageLowerBound = 0.0001; // 0.01%

		let afSuiCoinId: TransactionObjectArgument;
		let minAmountOut: Balance;
		if (suiAmount >= Staking.constants.bounds.minStake) {
			// Stake SUI into afSUI.
			afSuiCoinId = this.Provider.Staking().stakeTx({
				tx,
				validatorAddress:
					this.addresses.leveragedStaking.objects.aftermathValidator,
				suiCoin: suiCoinId,
			});

			const afSuiToSuiExchangeRate =
				await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();

			minAmountOut = BigInt(
				Math.floor(Number(suiAmount) * afSuiToSuiExchangeRate)
			);
		} else {
			const poolObject = await this.Provider.Pools().fetchPool({
				objectId:
					this.addresses.leveragedStaking.objects.afSuiSuiPoolId,
			});
			const pool = new Pool(poolObject);

			minAmountOut = BigInt(
				Math.floor(
					Number(
						pool.getTradeAmountOut({
							coinInAmount: suiAmount,
							coinInType: Coin.constants.suiCoinType,
							coinOutType:
								this.Provider.Staking().coinTypes.afSui,
						})
					) *
						(1 - estimatedSlippageLowerBound)
				)
			);

			afSuiCoinId = await this.Provider.Pools().fetchAddTradeTx({
				tx,
				pool,
				slippage: 1, // 100%
				coinInAmount: suiAmount,
				coinInId: suiCoinId,
				coinInType: Coin.constants.suiCoinType,
				coinOutType: this.Provider.Staking().coinTypes.afSui,
			});
		}
		return { afSuiCoinId, minAmountOut };
	};

	// REVIEW: this is only needed if a user's Obligation can have its debt increased by another address.
	//  If that isn't possible, then obligation's debt amount + borrow index will always be accurate after 
	//  a call to `completeActionTx`. -- needed because `liquidate` and `repay` don't require `ObligationKey`
	//  to be called.
	//
	private updateTotalSuiDebt = async (inputs: {
		tx: TransactionBlock;
		obligationId: ObjectId | TransactionObjectArgument;
	}): Promise<{
		totalSuiDebt: Balance;
	}> => {
		const suiMarket = await this.ScallopProviders.Query.getMarketPool("sui");
		const newBorrowIndex = suiMarket!.borrowIndex;
		
		const obligationAccount = await this.ScallopProviders.Query.queryObligation(
			inputs.obligationId.toString()
		);

		const [positionSuiDebt, positionBorrowIndex] = obligationAccount.debts
			? [
				BigInt(obligationAccount.debts[0].amount), 
				Number(obligationAccount.debts[0].borrowIndex)
			]
			: [BigInt(0), 0]

		if (positionBorrowIndex == newBorrowIndex)
			return { totalSuiDebt: positionSuiDebt }

		return {
			// REVIEW: calc. (seems to be undershooting/off by a little)
			totalSuiDebt: BigInt(
				Math.floor(
					(Number(positionSuiDebt) * newBorrowIndex) / positionBorrowIndex
				)
			)
		}
	}

	// NOTE: ported from Scallop's SDK.
	//
	private async getMarketData(inputs: {
		poolCoinName: SupportPoolCoins;
	}) {
		let {poolCoinName} = inputs;
		const marketId = this.ScallopProviders.Query.address.get('core.market');
		const marketObject = (await this.ScallopProviders.Query.suiKit.client().getObject({
			id: marketId,
			options: {
			showContent: true,
			},
		})).data;

		let balanceSheet: BalanceSheet | undefined;
		let borrowIndex: BorrowIndex | undefined;
		let interestModel: InterestModel | undefined;
		let borrowFeeRate: { value: string } | undefined;
		if (marketObject) {
			if (marketObject.content && 'fields' in marketObject.content) {
				const fields = marketObject.content.fields as any;
				const coinType = this.ScallopProviders.Query.utils.parseCoinType(poolCoinName);

				// Get balance sheet.
				const balanceSheetParentId =
					fields.vault.fields.balance_sheets.fields.table.fields.id.id;
				const balanceSheetDdynamicFieldObjectResponse = await this.ScallopProviders.Query.suiKit
					.client()
					.getDynamicFieldObject({
					parentId: balanceSheetParentId,
					name: {
						type: '0x1::type_name::TypeName',
						value: {
						name: coinType.substring(2),
						},
					},
					});
				const balanceSheetDdynamicFieldObject =
					balanceSheetDdynamicFieldObjectResponse.data;
				if (
					balanceSheetDdynamicFieldObject &&
					balanceSheetDdynamicFieldObject.content &&
					'fields' in balanceSheetDdynamicFieldObject.content
				) {
					const dynamicFields = balanceSheetDdynamicFieldObject.content
					.fields as any;
					balanceSheet = dynamicFields.value.fields;
				}

				// Get borrow index.
				const borrowIndexParentId =
					fields.borrow_dynamics.fields.table.fields.id.id;
				const borrowIndexDynamicFieldObjectResponse = await this.ScallopProviders.Query.suiKit
					.client()
					.getDynamicFieldObject({
					parentId: borrowIndexParentId,
					name: {
						type: '0x1::type_name::TypeName',
						value: {
						name: coinType.substring(2),
						},
					},
					});
				const borrowIndexDynamicFieldObject =
					borrowIndexDynamicFieldObjectResponse.data;
				if (
					borrowIndexDynamicFieldObject &&
					borrowIndexDynamicFieldObject.content &&
					'fields' in borrowIndexDynamicFieldObject.content
				) {
					const dynamicFields = borrowIndexDynamicFieldObject.content
					.fields as any;
					borrowIndex = dynamicFields.value.fields;
				}

				// Get interest models.
				const interestModelParentId =
					fields.interest_models.fields.table.fields.id.id;
				const interestModelDynamicFieldObjectResponse = await this.ScallopProviders.Query.suiKit
					.client()
					.getDynamicFieldObject({
					parentId: interestModelParentId,
					name: {
						type: '0x1::type_name::TypeName',
						value: {
						name: coinType.substring(2),
						},
					},
					});
				const interestModelDynamicFieldObject =
					interestModelDynamicFieldObjectResponse.data;
				if (
					interestModelDynamicFieldObject &&
					interestModelDynamicFieldObject.content &&
					'fields' in interestModelDynamicFieldObject.content
				) {
					const dynamicFields = interestModelDynamicFieldObject.content
					.fields as any;
					interestModel = dynamicFields.value.fields;
				}

				// Get borrow fee.
				const borrowFeeDynamicFieldObjectResponse = await this.ScallopProviders.Query.suiKit
					.client()
					.getDynamicFieldObject({
					parentId: marketId,
					name: {
						// TODO: obtain through ScallopSDK
						//
						type: `0xc38f849e81cfe46d4e4320f508ea7dda42934a329d5a6571bb4c3cb6ea63f5da::market_dynamic_keys::BorrowFeeKey`,
						value: {
						type: {
							name: coinType.substring(2),
						},
						},
					},
					});

				const borrowFeeDynamicFieldObject =
					borrowFeeDynamicFieldObjectResponse.data;
				if (
					borrowFeeDynamicFieldObject &&
					borrowFeeDynamicFieldObject.content &&
					'fields' in borrowFeeDynamicFieldObject.content
				) {
					const dynamicFields = borrowFeeDynamicFieldObject.content.fields as any;
					borrowFeeRate = dynamicFields.value.fields;
				}
			}
		}

		if (!balanceSheet || !borrowIndex || !interestModel || !borrowFeeRate) 
			throw Error("Could not load MarketData");
		
		return {
			type: interestModel.type.fields,
			maxBorrowRate: interestModel.max_borrow_rate.fields,
			interestRate: borrowIndex.interest_rate.fields,
			interestRateScale: borrowIndex.interest_rate_scale,
			borrowIndex: borrowIndex.borrow_index,
			lastUpdated: borrowIndex.last_updated,
			cash: balanceSheet.cash,
			debt: balanceSheet.debt,
			marketCoinSupply: balanceSheet.market_coin_supply,
			reserve: balanceSheet.revenue,
			reserveFactor: interestModel.revenue_factor.fields,
			borrowWeight: interestModel.borrow_weight.fields,
			borrowFeeRate: borrowFeeRate,
			baseBorrowRatePerSec: interestModel.base_borrow_rate_per_sec.fields,
			borrowRateOnHighKink: interestModel.borrow_rate_on_high_kink.fields,
			borrowRateOnMidKink: interestModel.borrow_rate_on_mid_kink.fields,
			highKink: interestModel.high_kink.fields,
			midKink: interestModel.mid_kink.fields,
			minBorrowAmount: interestModel.min_borrow_amount,
		};
	}

	// =========================================================================
	//  Event Types
	// =========================================================================

	private leveragedStakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			LeveragedStakingApi.constants.moduleNames.events,
			LeveragedStakingApi.constants.eventNames.leveragedStaked
		);

	private leveragedUnstakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			LeveragedStakingApi.constants.moduleNames.events,
			LeveragedStakingApi.constants.eventNames.leveragedUnstaked
		);

	private leverageChangedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			LeveragedStakingApi.constants.moduleNames.events,
			LeveragedStakingApi.constants.eventNames.leverageChanged
		);
}
