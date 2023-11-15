import {
	TransactionBlock,
	TransactionObjectArgument,
} from "@mysten/sui.js/transactions";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	CoinType,
	ObjectId,
	PoolsAddresses,
	StakingAddresses,
	SuiAddress,
	LeveragedStakingAddresses,
	ScallopProviders,
	ScallopAddresses,
	RouterAddresses,
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
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import { Sui } from "../../sui";
import { ScallopTxBlock } from "@scallop-io/sui-scallop-sdk";
import { LeveragedStaking } from "..";
import { EventOnChain } from "../../../general/types/castingTypes";
import {
	LeveragedStakeChangedLeverageEventOnChain,
	LeveragedStakedEventOnChain,
	LeveragedUnstakedEventOnChain,
} from "./leveragedStakingApiCastingTypes";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

export class LeveragedStakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
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
		router: RouterAddresses;
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

	constructor(
		private readonly Provider: AftermathApi,
		private readonly ScallopProviders: ScallopProviders
	) {
		const leveragedStaking = this.Provider.addresses.leveragedStaking;
		const staking = this.Provider.addresses.staking;
		const pools = this.Provider.addresses.pools;
		const router = this.Provider.addresses.router;
		const scallop = this.Provider.addresses.scallop;

		if (!leveragedStaking || !staking || !pools || !scallop || !router)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			leveragedStaking,
			staking,
			pools,
			router,
			scallop,
		};

		this.eventTypes = {
			leveragedStaked: this.leveragedStakedEventType(),
			leveragedUnstaked: this.leveragedUnstakedEventType(),
			leverageChanged: this.leverageChangedEventType(),
		};

		this.objectTypes = {
			leveragedAfSuiPosition: `${leveragedStaking.packages.leveragedAfSui}::leveraged_afsui_position::LeveragedAfSuiPosition`,
		};
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	// public fetchOwnedObligation = async (
	// 	inputs: ApiLeveragedStakeObligationBody
	// ): Promise<ApiLeveragedStakePositionResponse> => {
	// 	const { walletAddress } = inputs;

	// 	const leveragedAfSuiPositions =
	// 		await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
	// 			walletAddress,
	// 			objectType: this.objectTypes.leveragedAfSuiPosition,
	// 			objectFromSuiObjectResponse:
	// 				Casting.leveragedStaking
	// 					.leveragedAfSuiPositionFromSuiObjectResponse,
	// 		});
	// 	if (leveragedAfSuiPositions.length <= 0) return "none";

	// 	const leveragedAfSuiPosition = leveragedAfSuiPositions[0];
	// 	const obligationAccount =
	// 		await this.ScallopProviders.Query.getObligationAccount(
	// 			leveragedAfSuiPosition.obligationId
	// 		);

	// 	return {
	// 		obligationAccount,
	// 		leveragedAfSuiPosition,
	// 	};
	// };

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

	public fetchSuiMarketPool = async (): Promise<ScallopMarketPool> => {
		const suiMarketPool = await this.ScallopProviders.Query.getMarketPool(
			"sui"
		);
		if (!suiMarketPool) throw new Error("sui market pool not found");
		return suiMarketPool;
	};

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

	public fetchAfSuiMarketCollateral =
		async (): Promise<ScallopMarketCollateral> => {
			const afSuiMarketCollateral =
				await this.ScallopProviders.Query.getMarketCollateral("afsui");
			if (!afSuiMarketCollateral)
				throw new Error("sui market pool not found");
			return afSuiMarketCollateral;
		};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public openObligationTx = (inputs: {
		tx: TransactionBlock;
		// TODO: document return values like this for ALL tx commands in api
	}): [
		obligation: TransactionObjectArgument,
		leveragedAfSuiPosition: TransactionObjectArgument,
		obligationHotPotato: TransactionObjectArgument
	] /* (Obligation, LeveragedAfSuiPosition, ObligationHotPotato) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames
					.leveragedAfSuiPosition,
				"open_obligation"
			),
			typeArguments: [],
			arguments: [
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
				tx.object(this.addresses.scallop.objects.version), // Version
			],
		});
	};

	public returnObligationTx = (inputs: {
		tx: TransactionBlock;
		obligationId: ObjectId | TransactionObjectArgument;
		obligationHotPotatoId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames
					.leveragedAfSuiPosition,
				"return_obligation"
			),
			typeArguments: [],
			arguments: [
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				Helpers.addTxObject(tx, inputs.obligationId), // Obligation
				Helpers.addTxObject(tx, inputs.obligationHotPotatoId), // ObligationHotPotato
			],
		});
	};

	public initiateLeverageStakeTx = (inputs: {
		tx: TransactionBlock;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
	}) /* LeveragedActionCap */ => {
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
				tx.object(this.addresses.scallop.objects.version), // Version
				Helpers.addTxObject(tx, inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				Helpers.addTxObject(tx, inputs.afSuiCoinId), // Coin
			],
		});
	};

	public completeLeverageStakeTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"complete_leverage_stake"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
			],
		});
	};

	public initiateLeverageUnstakeTx = (inputs: {
		tx: TransactionBlock;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		withdrawAmount: Balance;
	}) /* LeveragedActionCap */ => {
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
				tx.pure(inputs.withdrawAmount, "u64"), // withdraw_amount
			],
		});
	};

	public completeLeverageUnstakeTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"complete_leverage_unstake"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
			],
		});
	};

	public initiateChangeLeverageTx = (inputs: {
		tx: TransactionBlock;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
	}) /* LeveragedActionCap */ => {
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

	public completeChangeLeverageTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.leveragedStaking.packages.leveragedAfSui,
				LeveragedStakingApi.constants.moduleNames.interface,
				"complete_change_leverage"
			),
			typeArguments: [],
			arguments: [
				Helpers.addTxObject(tx, inputs.leveragedActionCapId), // LeveragedActionCap
				tx.object(
					this.addresses.leveragedStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState
			],
		});
	};

	public depositAfSuiCollateralTx = (inputs: {
		tx: TransactionBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
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
		obligationId: ObjectId | TransactionObjectArgument;
		withdrawAmount: Balance;
	}) /* Coin<AFSUI> */ => {
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
		obligationId: ObjectId | TransactionObjectArgument;
		borrowAmount: Balance;
	}) /* Coin<SUI> */ => {
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

	// TODO(kevin): Documentation
	public fetchBuildOpenLeveragedStakeTx = async (inputs: {
		walletAddress: SuiAddress;
		stakeAmount: Balance;
		stakeType: CoinType;
		leverage: number;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(inputs.walletAddress);

		// i. Open a new `LeveragedAfSuiPosition` position
		const [obligationId, leveragedAfSuiPositionId, obligationHotPotatoId] =
			this.openObligationTx({
				tx,
			});

		// ii. Leverage stake.
		await this.buildLeveragedStakeTx({
			...inputs,
			scallopTx,
			leveragedAfSuiPositionId,
			obligationId,
		});

		// iii. Share the associated Obligation object.
		this.returnObligationTx({
			tx,
			obligationId,
			obligationHotPotatoId,
		});

		return tx;
	};

	// TODO(kevin): Documentation
	public fetchBuildLeveragedStakeTx = async (inputs: {
		walletAddress: SuiAddress;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		stakeAmount: Balance;
		stakeType: CoinType;
		leverage: number;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(inputs.walletAddress);

		// i. Leverage stake.
		this.buildLeveragedStakeTx({
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
		stakeType: CoinType;
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

		// REVIEW(Collin): I am not sure how you want to handle errors, should we assert
		//  that `leverage` is less than or equal to `1 / (1 - collateralWeight)`.

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		let initialAfSuiCollateral;
		let afSuiCoinId;
		// i. Obtain the initial amount of afSUI collateral.
		if (Coin.isSuiCoin(inputs.stakeType)) {
			// ia. If the input was denominated in SUI, stake to afSUI.
			initialAfSuiCollateral = this.Provider.Staking().suiToAfSuiTx({
				tx,
				suiAmount: stakeAmount,
			});

			const suiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress: walletAddress,
				coinType: Coin.constants.suiCoinType,
				coinAmount: stakeAmount,
				isSponsoredTx: isSponsoredTx,
			});

			afSuiCoinId = this.Provider.Staking().stakeTx({
				tx,
				// REVIEW(Collin): set to our own validator,
				//
				validatorAddress:
					this.addresses.router.afSui!.objects.aftermathValidator,
				suiCoin,
			});
		} else {
			// ib. Obtain afSUI coin with `stakeAmount` value.
			initialAfSuiCollateral = stakeAmount;

			afSuiCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress: walletAddress,
				coinType: this.Provider.Staking().coinTypes.afSui,
				coinAmount: stakeAmount,
				isSponsoredTx: isSponsoredTx,
			});
		}

		// ii. Obtain a `StakeCap` by depositing the initial afSUI collateral.
		const leveragedActionCapId = this.initiateLeverageStakeTx({
			tx,
			leveragedAfSuiPositionId,
			obligationId,
			afSuiCoinId,
		});

		if (inputs.leverage > 1)
			// iii. Increase the leverage to the desired leverage ratio.
			this.buildIncreaseLeverageTx({
				scallopTx,
				leveragedActionCapId,
				obligationId,
				initialAfSuiCollateral,
				totalAfSuiCollateral: initialAfSuiCollateral,
				totalSuiDebt: BigInt(0),
				newLeverage: inputs.leverage,
			});

		// iv. Complete the Stake transaction and emit an event.
		this.completeLeverageStakeTx({
			tx,
			leveragedActionCapId,
		});
	};

	// TODO(Kevin): Documentation.
	public fetchBuildLeveragedUnstakeTx = async (inputs: {
		walletAddress: SuiAddress;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		initialAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		withdrawAmount: Balance;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const {
			referrer,
			walletAddress,
			leveragedAfSuiPositionId,
			obligationId,
		} = inputs;

		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// i. Initiate Unstake tx.
		const leveragedActionCapId = this.initiateLeverageUnstakeTx({
			tx,
			leveragedAfSuiPositionId,
			withdrawAmount: inputs.withdrawAmount,
		});

		// ii. Calculate current leverage ratio.
		const currentLeverageRatio = LeveragedStaking.calcLeverage({
			totalSuiDebt: inputs.totalSuiDebt,
			totalAfSuiCollateral: inputs.totalAfSuiCollateral,
		});

		// REVIEW(Kevin): Does this properly handle the unstake case.
		//
		// iii. Decrease the leverage to the desired leverage ratio.
		const remainingAfSuiCoinId = await this.buildDecreaseLeverageTx({
			scallopTx,
			leveragedActionCapId,
			obligationId,
			initialAfSuiCollateral:
				inputs.initialAfSuiCollateral - inputs.withdrawAmount,
			totalAfSuiCollateral: inputs.totalAfSuiCollateral,
			totalSuiDebt: inputs.totalSuiDebt,
			newLeverage: currentLeverageRatio,
		});

		// iv. Return the afSUI to the sender.
		tx.transferObjects(remainingAfSuiCoinId, walletAddress);

		// v. Complete Unstake tx.
		this.completeLeverageUnstakeTx({
			tx,
			leveragedActionCapId,
		});

		return tx;
	};

	// TODO(Kevin): Documentation.
	public buildChangeLeverageTx = (inputs: {
		walletAddress: SuiAddress;
		leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		initialAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		currentLeverage: number;
		newLeverage: number;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}) => {
		const {
			referrer,
			walletAddress,
			leveragedAfSuiPositionId,
			obligationId,
		} = inputs;

		// REVIEW(Collin): I am not sure how you want to handle errors, should we assert
		//  that `leverage` is less than or equal to `1 / (1 - collateralWeight)`.

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
			// iia. Remove afSUI Collateral + repay debt to reach desired leverage.
			const remainingAfSuiCoinId = this.buildDecreaseLeverageTx({
				...inputs,
				scallopTx,
				leveragedActionCapId,
			});

			// iic. Deposit remaining afSUI as collateral on Scallop.
			this.depositAfSuiCollateralTx({
				tx,
				leveragedActionCapId,
				obligationId,
				afSuiCoinId: remainingAfSuiCoinId,
			});
		} else {
			// iia. Borrow SUI and deposit more afSUI Collateral to reach desired leverage.
			this.buildIncreaseLeverageTx({
				...inputs,
				scallopTx,
				leveragedActionCapId,
			});
		}

		// iii. Complete Change Leverage tx.
		this.completeLeverageStakeTx({
			tx,
			leveragedActionCapId,
		});

		return tx;
	};

	// TODO(Kevin): Documentation.
	private buildDecreaseLeverageTx = async (inputs: {
		scallopTx: ScallopTxBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		initialAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		newLeverage: number;
	}): Promise<ObjectId | TransactionObjectArgument> /* Coin<AFSUI> */ => {
		const { scallopTx, leveragedActionCapId, obligationId } = inputs;

		const tx = scallopTx.txBlock;

		// ia. Calculate the amount of afSUI collateral to unstake.
		const newTotalAfSuiCollateral = BigInt(
			Number(inputs.initialAfSuiCollateral) * inputs.newLeverage
		);

		const decreaseInAfSuiCollateral =
			inputs.totalAfSuiCollateral - newTotalAfSuiCollateral;

		// ib. Calculate the amount of SUI debt to repay.
		const newSuiDebt = this.Provider.Staking().afSuiToSuiTx({
			tx,
			afSuiAmount: BigInt(
				newTotalAfSuiCollateral - inputs.initialAfSuiCollateral
			),
		});

		const decreaseInSuiDebt = inputs.totalSuiDebt - newSuiDebt;

		// ii. Flash loan `decreaseInSuiDebt` worth of SUI from Scallop.
		const [flashLoanedSuiCoinId, loan] = scallopTx.borrowFlashLoan(
			decreaseInSuiDebt,
			"sui"
		);

		// iii. Repay `decreaseInSuiDebt` of SUI debt.
		this.repaySuiTx({
			tx,
			leveragedActionCapId,
			obligationId,
			suiCoinId: flashLoanedSuiCoinId,
		});

		// iv. Withdraw `decreaseInCollateralAmount` worth of afSUI collateral.
		this.withdrawAfSuiCollateralTx({
			tx,
			leveragedActionCapId,
			obligationId,
			withdrawAmount: decreaseInAfSuiCollateral,
		});

		// TODO(Collin): Instant unstake or swap afSUI back into SUI.
		//
		// v. Convert `decreaseInCollateralAmount` of withdrawn collateral into SUI.
		const swappedSuiCoinId = 0;

		// vi. Repay flash loan with converted SUI.
		scallopTx.repayFlashLoan(swappedSuiCoinId, loan, "sui");

		// TODO(Collin): Stake OR swap (to account for when `suiFlashLoanAmount` < `minimum_stake_amount`).
		//
		// vii. [Potentially] Swap leftover SUI back into afSUI
		const swappedAfSuiCoinId = 0;

		swappedAfSuiCoinId;
	};

	// TODO(Kevin): Documentation.
	private buildIncreaseLeverageTx = (inputs: {
		scallopTx: ScallopTxBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		initialAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		newLeverage: number;
	}) => {
		const { scallopTx, leveragedActionCapId, obligationId } = inputs;

		const tx = scallopTx.txBlock;

		// ia. Calculate the extra amount of afSUI collateral that must be borrowed to reach a leverage
		//  ratio of `leverage`.
		const newTotalAfSuiCollateral = BigInt(
			Number(inputs.initialAfSuiCollateral) * inputs.newLeverage
		);

		const increaseInAfSuiCollateral =
			newTotalAfSuiCollateral - inputs.totalAfSuiCollateral;

		// REVIEW(Collin): I am not sure how you want to handle errors, should we assert that
		//  `flashLoanAmount` <= `totalLeveragedAfSuiCollateral` * `collateralWeight`?
		//
		// ib. Calculate amount of SUI that must be flash loaned to account for
		//  `increaseInAfSuiCollateral`.
		const flashLoanAmount = this.Provider.Staking().afSuiToSuiTx({
			tx,
			afSuiAmount: BigInt(increaseInAfSuiCollateral),
		});

		// ii. Flash loan `requiredAfSuiCollateral` worth of SUI from Scallop.
		const [flashLoanedSuiCoinId, loan] = scallopTx.borrowFlashLoan(
			flashLoanAmount,
			"sui"
		);

		// TODO(Collin): Stake OR swap (to account for when `flashLoanAmount` < `minimum_stake_amount`).
		//
		// iii. Stake SUI into afSUI.
		const stakedAfSuiCoinId = this.Provider.Staking().stakeTx({
			tx,
			// REVIEW(Collin): set to our own validator,
			//
			validatorAddress:
				this.addresses.router.afSui!.objects.aftermathValidator,
			suiCoin: flashLoanedSuiCoinId,
		});

		// iv. Deposit the staked afSUI as collateral on Scallop.
		this.depositAfSuiCollateralTx({
			tx,
			leveragedActionCapId,
			obligationId,
			afSuiCoinId: stakedAfSuiCoinId,
		});

		// v. Borrow amount of SUI required to pay off flash loan.
		const borrowedSuiCoinId = this.borrowSuiTx({
			tx,
			leveragedActionCapId,
			obligationId,
			borrowAmount: flashLoanAmount,
		});

		// vi. Repay flash loan on Scallop.
		scallopTx.repayFlashLoan(borrowedSuiCoinId, loan, "sui");

		// vii. [Potentially] Use remaining SUI to repay debt.
		this.repaySuiTx({
			tx,
			leveragedActionCapId,
			obligationId,
			suiCoinId: borrowedSuiCoinId,
		});
	};

	// =========================================================================
	//  Events
	// =========================================================================

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

	public async fetchPerformanceData(
		inputs: LeveragedStakingPerformanceDataBody
	): Promise<LeveragedStakingPerformanceDataPoint[]> {
		const { timeframe, borrowRate } = inputs;

		dayjs.extend(duration);
		const limit = // days ~ epochs
			dayjs
				.duration(
					LeveragedStakingApi.dataTimeframesToDays[timeframe],
					"days"
				)
				// + 1 to account for apy being calculated from events delta
				.asDays() + 1;

		// TODO: fetch borrow rate historically once scallop implements
		const [recentEpochChanges] = await Promise.all([
			this.Provider.Staking().fetchEpochWasChangedEvents({
				limit,
			}),
		]);
		if (recentEpochChanges.events.length <= 2) return [];

		console.log("epochs", recentEpochChanges);
		const timeData = recentEpochChanges.events
			.slice(2)
			.map((event, index) => {
				const currentRate = Number(event.totalAfSuiSupply)
					? Number(event.totalSuiAmount) /
					  Number(event.totalAfSuiSupply)
					: 1;

				const pastEvent = recentEpochChanges.events[index];
				const pastRate = Number(pastEvent.totalAfSuiSupply)
					? Number(pastEvent.totalSuiAmount) /
					  Number(pastEvent.totalAfSuiSupply)
					: 1;

				console.log({
					currentRate,
					pastRate,
					borrowRate,
				});

				const netApy = (currentRate - pastRate) / pastRate - borrowRate;
				return {
					time: event.timestamp ?? 0,
					sui: 0,
					afSui: netApy,
					leveragedAfSui:
						netApy * LeveragedStaking.constants.bounds.maxLeverage,
				};
			});

		for (const [index, dataPoint] of timeData.entries()) {
			if (index === 0) continue;

			const pastDataPoint = timeData[index - 1];

			timeData[index] = {
				...dataPoint,
				afSui: pastDataPoint.afSui * (1 + dataPoint.afSui),
				leveragedAfSui:
					pastDataPoint.leveragedAfSui *
					(1 + dataPoint.leveragedAfSui),
			};
		}
		return timeData;
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
