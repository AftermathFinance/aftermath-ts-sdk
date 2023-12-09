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
	Percentage,
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
import { Pool, Staking } from "../..";

// TODO(Kevin): remove.
import { bcs } from "@mysten/sui.js/bcs";
import { BCS } from "@mysten/bcs";

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

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// public openObligationTx = (inputs: {
	// 	tx: TransactionBlock;
	// 	// TODO: document return values like this for ALL tx commands in api
	// }): [
	// 	obligation: TransactionObjectArgument,
	// 	leveragedAfSuiPosition: TransactionObjectArgument,
	// 	obligationHotPotato: TransactionObjectArgument
	// ] /* (Obligation, LeveragedAfSuiPosition, ObligationHotPotato) */ => {
	// 	const { tx } = inputs;

	// 	return tx.moveCall({
	// 		target: Helpers.transactions.createTxTarget(
	// 			this.addresses.leveragedStaking.packages.leveragedAfSui,
	// 			LeveragedStakingApi.constants.moduleNames
	// 				.leveragedAfSuiPosition,
	// 			"open_obligation"
	// 		),
	// 		typeArguments: [],
	// 		arguments: [
	// 			tx.object(
	// 				this.addresses.leveragedStaking.objects.leveragedAfSuiState
	// 			), // LeveragedAfSuiState
	// 			tx.object(this.addresses.scallop.objects.version), // Version
	// 		],
	// 	});
	// };

	// public returnObligationTx = (inputs: {
	// 	tx: TransactionBlock;
	// 	obligationId: ObjectId | TransactionObjectArgument;
	// 	obligationHotPotatoId: ObjectId | TransactionObjectArgument;
	// }) => {
	// 	const { tx } = inputs;

	// 	return tx.moveCall({
	// 		target: Helpers.transactions.createTxTarget(
	// 			this.addresses.leveragedStaking.packages.leveragedAfSui,
	// 			LeveragedStakingApi.constants.moduleNames
	// 				.leveragedAfSuiPosition,
	// 			"return_obligation"
	// 		),
	// 		typeArguments: [],
	// 		arguments: [
	// 			tx.object(
	// 				this.addresses.leveragedStaking.objects.leveragedAfSuiState
	// 			), // LeveragedAfSuiState

	// 			tx.object(this.addresses.scallop.objects.version), // Version
	// 			Helpers.addTxObject(tx, inputs.obligationId), // Obligation
	// 			Helpers.addTxObject(tx, inputs.obligationHotPotatoId), // ObligationHotPotato
	// 		],
	// 	});
	// };

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

	// public borrowObligationKeyMutTx = (inputs: {
	// 	tx: TransactionBlock;
	// 	leveragedAfSuiPositionId: ObjectId | TransactionObjectArgument;
	// }) /* &mut ObligationKey */ => {
	// 	const { tx } = inputs;

	// 	return tx.moveCall({
	// 		target: Helpers.transactions.createTxTarget(
	// 			this.addresses.leveragedStaking.packages.leveragedAfSui,
	// 			LeveragedStakingApi.constants.moduleNames.leveragedAfSuiPosition,
	// 			"obligation_key_mut"
	// 		),
	// 		typeArguments: [],
	// 		arguments: [
	// 			Helpers.addTxObject(tx, inputs.leveragedAfSuiPositionId), // LeveragedAfSuiPosition
	// 		],
	// 	});
	// };

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

			// newBaseAfSuiCollateral = this.Provider.Staking().suiToAfSuiTx({
			// 	tx,
			// 	suiAmount: stakeAmount,
			// });

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
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		unstakeAmount: Balance;
		unstakeCoinType: "sui" | "afsui";
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
			totalAfSuiCollateral,
			totalSuiDebt,
			unstakeCoinType,
			slippage,
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
			unstakeAmount,
		});

		const afSuiToSuiExchangeRate =
			await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();

		// iia. Calculate current leverage ratio.
		const currentLeverageRatio = LeveragedStaking.calcLeverage({
			totalSuiDebt,
			totalAfSuiCollateral,
			afSuiToSuiExchangeRate,
		});

		// TODO: [edge case] handle closing of position.
		// TODO: [edge case] handle deleveraging back to 1x.

		// REVIEW(Kevin): Does this properly handle the unstake case.
		//
		// iiia. Decrease the leverage to the desired leverage ratio.
		const remainingSuiCoinId = await this.fetchBuildDecreaseLeverageTx({
			scallopTx,
			leveragedActionCapId,
			leveragedAfSuiPositionId,
			obligationId,
			totalSuiDebt,
			totalAfSuiCollateral,
			// REVIEW(Kevin): should we be subtracting from here too?
			//
			// totalAfSuiCollateral:
			// 	inputs.totalAfSuiCollateral - unstakeAmount,
			newLeverage: currentLeverageRatio,
			baseAfSuiCollateral: inputs.baseAfSuiCollateral - unstakeAmount,
			slippage,
		});

		if (unstakeCoinType === "afsui") {
			/// iiib. Stake the withdrawn SUI for afSUI.
			let [unstakedAfSuiCollateral] = this.Provider.Staking().stakeTx({
				tx,
				validatorAddress:
					this.addresses.leveragedStaking.objects.aftermathValidator,
				suiCoin: remainingSuiCoinId,
			});

			// iv. Return the afSUI to the sender.
			tx.transferObjects([unstakedAfSuiCollateral], walletAddress);
		} else {
			tx.transferObjects([remainingSuiCoinId], walletAddress);
		}

		// v. Complete Unstake tx.
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
			borrowAmount: flashLoanAmount,
		});

		// vi. Repay flash loan on Scallop.
		scallopTx.repayFlashLoan(borrowedSuiCoinId, loan, "sui");

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

		// TODO: Check for setting leverage to one
		// TODO: Check for complete withdraw

		const afSuiToSuiExchangeRate =
			await this.Provider.Staking().fetchAfSuiToSuiExchangeRate();

		// ia. Calculate the total amount of afSUI collateral required to reach a leverage ratio of
		//  `newLeverage`.
		const newTotalAfSuiCollateral = BigInt(
			Math.floor(Number(inputs.baseAfSuiCollateral) * inputs.newLeverage)
		);

		// ib. Calculate the amount of afSUI collateral that must be withdrawn to reach
		//  `newTotalAfSuiCollateral`.
		const decreaseInAfSuiCollateral =
			inputs.totalAfSuiCollateral - newTotalAfSuiCollateral;

		// iia. Calculate the amount of SUI debt that must be repayed to allow withdrawing
		//  `decreaseInAfSuiCollateral` worth of afSUI collateral.
		const newSuiDebt = BigInt(
			Math.floor(
				Number(newTotalAfSuiCollateral - inputs.baseAfSuiCollateral) *
					afSuiToSuiExchangeRate
			)
		);
		const decreaseInSuiDebt = inputs.totalSuiDebt - newSuiDebt;

		// iib. Flash loan `decreaseInSuiDebt` worth of SUI from Scallop.
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

		// REVIEW(Kevin): check if both assets need to be updated.
		//
		await scallopTx.updateAssetPricesQuick(["sui", "afsui"]);
		// ivb. Withdraw `decreaseInCollateralAmount` worth of afSUI collateral.
		const [afSuiId] = this.withdrawAfSuiCollateralTx({
			...inputs,
			tx,
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

		// TODO(Collin): Stake OR swap (to account for when `suiFlashLoanAmount` < `minimum_stake_amount`).
		//
		// vii. [Potentially] Swap leftover SUI back into afSUI

		// TODO: make into swap if less than 1 sui

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
