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
import { Pool } from "../..";

// TODO(Kevin): remove.
import { bcs } from "@mysten/sui.js/bcs";
import { BCS } from "@mysten/bcs";

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
			leveragedAfSuiPosition: `${leveragedStaking.packages.leveragedAfSuiInitial}::leveraged_afsui_position::LeveragedAfSuiPosition`,
		};
	}

	// =========================================================================
	//  Objects
	// =========================================================================

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
	}): [
		leveragedActionCapId: TransactionObjectArgument,
	]  /* LeveragedActionCap */ => {
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
		unstakeAmount: Balance;
	}): [
		leveragedActionCapId: TransactionObjectArgument,
	]  /* LeveragedActionCap */ => {
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
	}): [
		leveragedActionCapId: TransactionObjectArgument,
	]  /* LeveragedActionCap */ => {
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
	}): [
		afSuiCoinId: TransactionObjectArgument,
	]  /* Coin<AFSUI> */ => {
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
	}): [
		suiCoinId: TransactionObjectArgument,
	]  /* Coin<SUI> */ => {
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

	// ERROR Notes:
	//  > [ScallopLeveragedAfSui] [interface] 0: EInvalidLeveragedAfSuiPosition
	//  > [ScallopLeveragedAfSui] [leveraged_afsui_state] 0: EInvalidProtocolVersion

	//  > [Scallop] 513 -> 0x201: version_mismatch_error
	//  > [Scallop] 1025 -> 0x401: oracle_stale_price_error
	//  > [Scallop] [deposit_collateral]  1793 -> 0x701: max_collateral_reached_error
	//  > [Scallop] [withdraw_collateral] 1795 -> 0x703: withdraw_collateral_too_much_error

	//  > [afSUI] [actions] 3: ELessThanMinimumStakingThreshold

	//  > [Pyth] [pyth_adaptor] 70146: assert_price_not_stale
	// 		{ address: 910f30cbc7f601f75a5141a01265cd47c62d468707c5e1aecb32a18f448cb25a}}

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

		console.log("[fetchBuildOpenLeveragedStakeTx] i. Open a new `LeveragedAfSuiPosition` position.")
		// i. Open a new `LeveragedAfSuiPosition` position.
		const [obligationId, leveragedAfSuiPositionId, obligationHotPotatoId] =
			this.openObligationTx({
				tx,
			});

		console.log("[fetchBuildOpenLeveragedStakeTx] ii. Leverage stake.")
		// ii. Leverage stake.
		await this.buildLeveragedStakeTx({
			...inputs,
			scallopTx,
			leveragedAfSuiPositionId,
			obligationId,
			baseAfSuiCollateral: BigInt(0),
			totalAfSuiCollateral: BigInt(0),
			totalSuiDebt: BigInt(0),
		});

		console.log("[fetchBuildOpenLeveragedStakeTx] iii. Share the associated Obligation object.")
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
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		leverage: number;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(inputs.walletAddress);

		console.log("[fetchBuildLeveragedStakeTx] i. Leverage stake.")
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
		stakeType: CoinType;
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

		let newBaseAfSuiCollateral;
		let afSuiCoinId;
		// i. Obtain the amount and ID of the afSUI collateral to be deposited. The user can choose to
		//  leverage stake starting in SUI in which case their SUI needs to be staked to afSUI.
		if (Coin.isSuiCoin(inputs.stakeType)) {
			console.log("[buildLeveragedStakeTx] ia. If the input was denominated in SUI, stake to afSUI.")
			// ia. If the input was denominated in SUI, stake to afSUI.
			newBaseAfSuiCollateral = this.Provider.Staking().suiToAfSuiTx({
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
			console.log("[buildLeveragedStakeTx] ib. Obtain afSUI coin with `stakeAmount` value.")
			// ib. Obtain afSUI coin with `stakeAmount` value.
			newBaseAfSuiCollateral = stakeAmount;

			afSuiCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress: walletAddress,
				coinType: this.Provider.Staking().coinTypes.afSui,
				coinAmount: stakeAmount,
				isSponsoredTx: isSponsoredTx,
			});
		}

		console.log("[buildLeveragedStakeTx] ii. Obtain a `StakeCap` by depositing the initial afSUI collateral.")
		// ii. Obtain a `StakeCap` by depositing the initial afSUI collateral.
		const leveragedActionCapId = this.initiateLeverageStakeTx({
			tx,
			leveragedAfSuiPositionId,
			obligationId,
			afSuiCoinId,
		});

		if (inputs.leverage > 1) {
			console.log("[buildLeveragedStakeTx] iii. Increase the leverage to the desired leverage ratio.")
			// iii. Increase the leverage to the desired leverage ratio.
			await this.fetchBuildIncreaseLeverageTx({
				scallopTx,
				leveragedActionCapId,
				obligationId,
				baseAfSuiCollateral: inputs.baseAfSuiCollateral + newBaseAfSuiCollateral,
				totalAfSuiCollateral: inputs.totalAfSuiCollateral + newBaseAfSuiCollateral,
				totalSuiDebt: inputs.totalSuiDebt,
				newLeverage: inputs.leverage,
			});
		};

		console.log("[buildLeveragedStakeTx] iv. Complete the Stake transaction and emit an event.")
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
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		unstakeAmount: Balance;
		afSuiSuiPoolId: ObjectId;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const {
			referrer,
			walletAddress,
			leveragedAfSuiPositionId,
			obligationId,
			afSuiSuiPoolId,
			unstakeAmount,
			totalAfSuiCollateral,
			totalSuiDebt,
		} = inputs;

		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		console.log("[fetchBuildLeveragedUnstakeTx] i. Initiate Unstake tx.")
		// i. Initiate Unstake tx.
		const leveragedActionCapId = this.initiateLeverageUnstakeTx({
			tx,
			leveragedAfSuiPositionId,
			unstakeAmount,
		});

		console.log("[fetchBuildLeveragedUnstakeTx] ii. Calculate current leverage ratio.")
		// ii. Calculate current leverage ratio.
		const currentLeverageRatio = LeveragedStaking.calcLeverage({
			totalSuiDebt,
			totalAfSuiCollateral,
		});

		if (unstakeAmount >= inputs.baseAfSuiCollateral) {
			const remainingSuiCoinId = 5;
		} else {
			console.log("[fetchBuildLeveragedUnstakeTx] iiia. Decrease the leverage to the desired leverage ratio.")
			// REVIEW(Kevin): Does this properly handle the unstake case.
			//
			// iiia. Decrease the leverage to the desired leverage ratio.
			const remainingSuiCoinId = await this.fetchBuildDecreaseLeverageTx({
				scallopTx,
				leveragedActionCapId,
				obligationId,
				afSuiSuiPoolId,
				totalSuiDebt,
				totalAfSuiCollateral,
				// REVIEW: should we be subtracting from here too?
				//
				// totalAfSuiCollateral: 
				// 	inputs.totalAfSuiCollateral - unstakeAmount,
				newLeverage: currentLeverageRatio,
				baseAfSuiCollateral:
					inputs.baseAfSuiCollateral - unstakeAmount,
			});
		}


		console.log("[fetchBuildLeveragedUnstakeTx] iiib. Stake the withdrawn SUI for afSUI.")
		/// iiib. Stake the withdrawn SUI for afSUI.
		let [unstakedAfSuiCollateral] = this.Provider.Staking().stakeTx({
			tx,
			// REVIEW(Collin): set to our own validator,
			//
			validatorAddress:
				this.addresses.router.afSui!.objects.aftermathValidator,
			suiCoin: remainingSuiCoinId,
		});

		// iv. Return the afSUI to the sender.
		tx.transferObjects([unstakedAfSuiCollateral], walletAddress);

		// v. Complete Unstake tx.
		this.completeLeverageUnstakeTx({
			tx,
			leveragedActionCapId,
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
		afSuiSuiPoolId: ObjectId;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}) => {
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
			const remainingSuiCoinId =
				await this.fetchBuildDecreaseLeverageTx({
					...inputs,
					scallopTx,
					leveragedActionCapId,
				});

			// iib. Deposit remaining afSUI as collateral on Scallop.
			this.repaySuiTx({
				tx,
				leveragedActionCapId,
				obligationId,
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
		this.completeChangeLeverageTx({
			tx,
			leveragedActionCapId,
		});

		return tx;
	};

	// TODO(Kevin): Documentation.
	private fetchBuildIncreaseLeverageTx = async (inputs: {
		scallopTx: ScallopTxBlock;
		leveragedActionCapId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		newLeverage: number;
	}) => {
		const { scallopTx, leveragedActionCapId, obligationId } = inputs;

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

		// REVIEW(Collin): I am not sure how you want to handle errors, should we assert that
		//  `flashLoanAmount` <= `totalLeveragedAfSuiCollateral` * `collateralWeight`?
		//
		// ib. Calculate amount of SUI that must be flash loaned to account for
		//  `increaseInAfSuiCollateral`.
		const flashLoanAmount: Balance = BigInt(
			Math.floor(
				Number(increaseInTotalAfSuiCollateral) * afSuiToSuiExchangeRate
			)
		);
		
		console.log(`[fetchBuildIncreaseLeverageTx] baseAfSuiCollateral: ${inputs.baseAfSuiCollateral}`)
		console.log(`[fetchBuildIncreaseLeverageTx] totalAfSuiCollateral: ${inputs.totalAfSuiCollateral}`)
		console.log(`[fetchBuildIncreaseLeverageTx] totalSuiDebt: ${inputs.totalSuiDebt}`)
		console.log(`[fetchBuildIncreaseLeverageTx] newLeverage: ${inputs.newLeverage}`)

		console.log(`[fetchBuildIncreaseLeverageTx] newTotalAfSuiCollateral: ${newTotalAfSuiCollateral}`)
		console.log(`[fetchBuildIncreaseLeverageTx] increaseInAfSuiCollateral: ${increaseInTotalAfSuiCollateral}`)
		console.log(`[fetchBuildIncreaseLeverageTx] afSuiToSuiExchangeRate: ${afSuiToSuiExchangeRate}`)
		console.log(`[fetchBuildIncreaseLeverageTx] flashLoanAmount: ${flashLoanAmount}`)

		// ii. Flash loan the required amount of SUI from Scallop to increase the position by 
		//  `increaseInAfSuiCollateral` afSUI.
		const [flashLoanedSuiCoinId, loan] = scallopTx.borrowFlashLoan(
			flashLoanAmount,
			"sui"
		);
		console.log(`[fetchBuildIncreaseLeverageTx] ii. Flash loan the required amount of SUI from Scallop to increase the position by increaseInAfSuiCollateral afSUI.`);

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
		console.log(`[fetchBuildIncreaseLeverageTx] iii. Stake SUI into afSUI.`);


		// iv. Deposit the staked afSUI as collateral on Scallop.
		this.depositAfSuiCollateralTx({
			tx,
			leveragedActionCapId,
			obligationId,
			afSuiCoinId: stakedAfSuiCoinId,
		});
		console.log(`[fetchBuildIncreaseLeverageTx] iv. Deposit the staked afSUI as collateral on Scallop.`);

		// REVIEW(Kevin): check if both assets need to be updated.
		//
		await scallopTx.updateAssetPricesQuick(['sui', 'afsui']);
		// v. Borrow amount of SUI required to pay off flash loan.
		const [borrowedSuiCoinId] = this.borrowSuiTx({
			tx,
			leveragedActionCapId,
			obligationId,
			borrowAmount: flashLoanAmount,
		});
		console.log(`[fetchBuildIncreaseLeverageTx] v. Borrow amount of SUI required to pay off flash loan.`);

		// const [remainingSuiCoinId] = tx.splitCoins(
		// 	borrowedSuiCoinId
		// );

		// vi. Repay flash loan on Scallop.
		scallopTx.repayFlashLoan(
			borrowedSuiCoinId,
			loan,
			"sui"
		);
		console.log(`[fetchBuildIncreaseLeverageTx] vi. Repay flash loan on Scallop.`);

		// REVIEW(kevin): will there even be any leftover SUI to repay?
		//
		// // vii. [Potentially] Use remaining SUI to repay debt.
		// this.repaySuiTx({
		// 	tx,
		// 	leveragedActionCapId,
		// 	obligationId,
		// 	suiCoinId: borrowedSuiCoinId,
		// });
		// console.log(`[fetchBuildIncreaseLeverageTx] vii. [Potentially] Use remaining SUI to repay debt.`);

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
		obligationId: ObjectId | TransactionObjectArgument;
		baseAfSuiCollateral: Balance;
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		newLeverage: number;
		afSuiSuiPoolId: ObjectId;
	}): Promise<ObjectId | TransactionObjectArgument> /* Coin<SUI> */ => {
		const {
			scallopTx,
			leveragedActionCapId,
			obligationId,
			afSuiSuiPoolId,
		} = inputs;

		const tx = scallopTx.txBlock;

		// const afSuiToSuiExchangeRate =
		// 	await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();
		
		// console.log(`[afSuiToSuiExchangeRate] ${afSuiToSuiExchangeRate}`)
		// console.log(`[baseAfSuiCollateral] ${inputs.baseAfSuiCollateral}`)
		// console.log(`[totalAfSuiCollateral] ${inputs.totalAfSuiCollateral}`)
		// console.log(`[totalSuiDebt] ${inputs.totalSuiDebt}`)
		// console.log(`[newLeverage] ${inputs.newLeverage}`)
		
		// // TODO: Check which are used otuside of these calcs.
		// //
		// let newTotalAfSuiCollateral;
		// let decreaseInAfSuiCollateral;
		// let newSuiDebt;
		// let decreaseInSuiDebt;
		// // TODO: Check for complete withdraw
		// if (inputs.baseAfSuiCollateral == BigInt(0)) {
		// 	newTotalAfSuiCollateral = 0;
		// 	decreaseInAfSuiCollateral = inputs.totalAfSuiCollateral;


		// } else {

		// };

		// // ia. Calculate the total amount of afSUI collateral required to reach a leverage ratio of
		// //  `newLeverage`.
		// const newTotalAfSuiCollateral = BigInt(
		// 	Math.floor(Number(inputs.baseAfSuiCollateral) * inputs.newLeverage)
		// );
		// console.log(`[newTotalAfSuiCollateral] ${newTotalAfSuiCollateral}`)

		// // ib. Calculate the amount of afSUI collateral that must be withdrawn to reach
		// //  `newTotalAfSuiCollateral`.
		// const decreaseInAfSuiCollateral =
		// 	inputs.totalAfSuiCollateral - newTotalAfSuiCollateral;

		// console.log(`[decreaseInAfSuiCollateral] ${decreaseInAfSuiCollateral}`)

		// // iia. Calculate the amount of SUI debt that must be repayed to allow withdrawing
		// //  `decreaseInAfSuiCollateral` worth of afSUI collateral.
		// const newSuiDebt = BigInt(
		// 	Math.floor(
		// 		Number(
		// 			newTotalAfSuiCollateral - inputs.baseAfSuiCollateral
		// 		) * afSuiToSuiExchangeRate
		// 	)
		// );
		// const decreaseInSuiDebt = inputs.totalSuiDebt - newSuiDebt;

		// console.log(`[newSuiDebt] ${newSuiDebt}`)
		// console.log(`[decreaseInSuiDebt] ${decreaseInSuiDebt}`)

		// TODO: Check for setting leverage to zero

		const afSuiToSuiExchangeRate =
			await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();
		
		console.log(`[afSuiToSuiExchangeRate] ${afSuiToSuiExchangeRate}`)
		console.log(`[baseAfSuiCollateral] ${inputs.baseAfSuiCollateral}`)
		console.log(`[totalAfSuiCollateral] ${inputs.totalAfSuiCollateral}`)
		console.log(`[totalSuiDebt] ${inputs.totalSuiDebt}`)
		console.log(`[newLeverage] ${inputs.newLeverage}`)
		
		// ia. Calculate the total amount of afSUI collateral required to reach a leverage ratio of
		//  `newLeverage`.
		const newTotalAfSuiCollateral = BigInt(
			Math.floor(Number(inputs.baseAfSuiCollateral) * inputs.newLeverage)
		);
		console.log("[fetchBuildDecreaseLeverageTx] ia. Calculate the total amount of afSUI collateral required to reach a leverage ratio of `newLeverage`.")
		console.log(`[newTotalAfSuiCollateral] ${newTotalAfSuiCollateral}`)

		// ib. Calculate the amount of afSUI collateral that must be withdrawn to reach
		//  `newTotalAfSuiCollateral`.
		const decreaseInAfSuiCollateral =
			inputs.totalAfSuiCollateral - newTotalAfSuiCollateral;

		console.log("[fetchBuildDecreaseLeverageTx] ib. Calculate the amount of afSUI collateral that must be withdrawn to reach `newTotalAfSuiCollateral`.")
		console.log(`[decreaseInAfSuiCollateral] ${decreaseInAfSuiCollateral}`)

		// iia. Calculate the amount of SUI debt that must be repayed to allow withdrawing
		//  `decreaseInAfSuiCollateral` worth of afSUI collateral.
		const newSuiDebt = BigInt(
			Math.floor(
				Number(
					newTotalAfSuiCollateral - inputs.baseAfSuiCollateral
				) * afSuiToSuiExchangeRate
			)
		);
		const decreaseInSuiDebt = inputs.totalSuiDebt - newSuiDebt;

		console.log("[fetchBuildDecreaseLeverageTx] iia. Calculate the amount of SUI debt that must be repayed to allow withdrawing `decreaseInAfSuiCollateral` worth of afSUI collateral.")
		console.log(`[newSuiDebt] ${newSuiDebt}`)
		console.log(`[decreaseInSuiDebt] ${decreaseInSuiDebt}`)

		// iib. Flash loan `decreaseInSuiDebt` worth of SUI from Scallop.
		const [flashLoanedSuiCoinId, loan] = scallopTx.borrowFlashLoan(
			decreaseInSuiDebt,
			"sui"
		);
		console.log("[fetchBuildDecreaseLeverageTx] iib. Flash loan `decreaseInSuiDebt` worth of SUI from Scallop.")

		// iii. Repay `decreaseInSuiDebt` of SUI debt.
		this.repaySuiTx({
			tx,
			leveragedActionCapId,
			obligationId,
			suiCoinId: flashLoanedSuiCoinId,
		});
		console.log("[fetchBuildDecreaseLeverageTx] iii. Repay `decreaseInSuiDebt` of SUI debt.")

		// REVIEW(Kevin): check if both assets need to be updated.
		//
		await scallopTx.updateAssetPricesQuick(['sui', 'afsui']);
		// iv. Withdraw `decreaseInCollateralAmount` worth of afSUI collateral.
		const afSuiId = this.withdrawAfSuiCollateralTx({
			tx,
			leveragedActionCapId,
			obligationId,
			withdrawAmount: decreaseInAfSuiCollateral,
		});
		console.log("[fetchBuildDecreaseLeverageTx] iv. Withdraw `decreaseInCollateralAmount` worth of afSUI collateral.")

		// TODO(Collin): Instant unstake or swap afSUI back into SUI.
		//
		// v. Convert `decreaseInCollateralAmount` of withdrawn collateral into SUI.

		const poolObject = await this.Provider.Pools().fetchPool({
			objectId: afSuiSuiPoolId,
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
			// TODO: hook up slippage to FE selection.
			//
			slippage: 1, // 100%
		});

		const repayLoanSuiCoinId = tx.splitCoins(swappedSuiCoinId, [
			decreaseInSuiDebt,
		]);

		// vi. Repay flash loan with converted SUI.
		scallopTx.repayFlashLoan(repayLoanSuiCoinId, loan, "sui");

		// TODO(Collin): Stake OR swap (to account for when `suiFlashLoanAmount` < `minimum_stake_amount`).
		//
		// vii. [Potentially] Swap leftover SUI back into afSUI

		// TODO: make into swap in less than 1 sui

		// return  this.Provider.Pools().fetchAddTradeTx({
		// 	tx,
		// 	pool,
		// 	coinInAmount: BigInt(
		// 		Math.floor(Number(decreaseInSuiDebt) * afSuiToSuiExchangeRate)
		// 	),
		// 	coinInId: swappedSuiCoinId,
		// 	coinInType : Coin.constants.suiCoinType,
		// 	coinOutType: this.Provider.Staking().coinTypes.afSui,
		// 	slippage: 1, // 100%
		// });

		return swappedSuiCoinId;
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

				const afSuiApy = (currentRate - pastRate) / pastRate;
				return {
					time: event.timestamp ?? 0,
					sui: 0,
					afSui: afSuiApy,
					leveragedAfSui:
						(afSuiApy - borrowRate) *
						LeveragedStaking.constants.bounds.maxLeverage,
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
