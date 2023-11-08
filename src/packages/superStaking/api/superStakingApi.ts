import {
	TransactionArgument,
	TransactionBlock,
	TransactionObjectArgument,
} from "@mysten/sui.js/transactions";
import { DelegatedStake, ValidatorsApy } from "@mysten/sui.js/client";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AfSuiRouterWrapperAddresses,
	AnyObjectType,
	ApiIndexerUserEventsBody,
	Balance,
	CoinType,
	LeveragedObligationKey,
	ObjectId,
	PoolsAddresses,
	StakingAddresses,
	SuiAddress,
	SuperStakeObligation,
	SuperStakingAddresses,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import { Sui } from "../../sui";
import {
	ObligationAccount,
	Scallop,
	ScallopBuilder,
	ScallopQuery,
} from "@scallop-io/sui-scallop-sdk";

export class SuperStakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			leverageStake: "leverage_stake",
			events: "events",
		},
		eventNames: {
			superStaked: "StakedEvent",
			superUnstaked: "UnstakedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		superStaking: SuperStakingAddresses;
		staking: StakingAddresses;
		pools: PoolsAddresses;
	};

	public readonly eventTypes: {
		superStaked: AnyObjectType;
		superUnstaked: AnyObjectType;
	};

	public readonly objectTypes: {
		leveragedObligationKey: AnyObjectType;
	};

	private readonly ScallopProviders: {
		Main: Scallop;
		Builder: ScallopBuilder;
		Query: ScallopQuery;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		private readonly Provider: AftermathApi,
		ScallopProvider: Scallop
	) {
		const superStaking = this.Provider.addresses.superStaking;
		const staking = this.Provider.addresses.staking;
		const pools = this.Provider.addresses.pools;

		if (!superStaking || !staking || !pools)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			superStaking,
			staking,
			pools,
		};

		this.eventTypes = {
			superStaked: this.superStakedEventType(),
			superUnstaked: this.superUnstakedEventType(),
		};

		this.objectTypes = {
			leveragedObligationKey: `${superStaking.packages.leveragedAfSui}::leverage_stake::LeveragedAfSuiObligationKey`,
		};

		const [Builder, Query] = await Promise.all([
			ScallopProvider.createScallopBuilder(),
			ScallopProvider.createScallopQuery(),
		]);
		await Promise.all([Builder.init(), Query.init()]);

		this.ScallopProviders = {
			Main: ScallopProvider,
			Builder,
			Query,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchObligationForUser = async (
		// inputs: ApiSuperStakeObligationBody
		inputs: {
			walletAddress: SuiAddress;
		}
	): Promise<SuperStakeObligation | "none"> => {
		const { walletAddress } = inputs;

		const leveragedObligationKeys =
			await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.leveragedObligationKey,
				objectFromSuiObjectResponse:
					Casting.superStaking
						.leveragedObligationKeyFromSuiObjectResponse,
			});
		if (leveragedObligationKeys.length <= 0) return "none";

		const leveragedObligationKey = leveragedObligationKeys[0];
		const obligationAccount =
			await this.ScallopProviders.Query.getObligationAccount(
				leveragedObligationKey.obligationId
			);

		return {
			obligationAccount,
			leveragedObligationKey,
		};
	};

	public fetchMarketPool = (inputs: { coin: "afsui" | "sui" }) => {
		return this.ScallopProviders.Query.getMarketPool(inputs.coin);
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public initiateStakeTx = (inputs: {
		tx: TransactionBlock;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
	}) /* StakeCap */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"initiate_stake"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.leveragedObligationKeyId), // LeveragedAfSuiObligationKey
				tx.object(inputs.afSuiCoinId), // Coin
			],
		});
	};

	public initiateStakeAndOpenObligationTx = (inputs: {
		tx: TransactionBlock;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
	}) /* (StakeCap, LeveragedAfSuiObligationKey, Obligation, ObligationHotPotato) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"initiate_stake_and_open_obligation"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.afSuiCoinId), // Coin
				tx.object(this.addresses.scallop.objects.version), // Version
			],
		});
	};

	public depositAfSuiCollateralTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"deposit_afsui_collateral"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.stakeCapId), // StakeCap
				tx.object(inputs.leveragedObligationKeyId), // LeveragedAfSuiObligationKey
				tx.object(
					this.addresses.superStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(inputs.afSuiCoinId), // Coin
			],
		});
	};

	public borrowSuiTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		borrowAmount: Balance;
	}) /* Coin<SUI> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"borrow_sui"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.stakeCapId), // StakeCap
				tx.object(inputs.leveragedObligationKeyId), // LeveragedAfSuiObligationKey
				tx.object(
					this.addresses.superStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(this.addresses.scallop.objects.coinDecimalsRegistry), // CoinDecimalsRegistry
				tx.pure(inputs.borrowAmount, "u64"), // borrow_amount
				tx.object(this.addresses.scallop.objects.xOracle), // XOracle
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public completeLeverageStakeTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"complete_leverage_stake"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.stakeCapId), // StakeCap
				tx.object(inputs.leveragedObligationKeyId), // LeveragedAfSuiObligationKey
				tx.object(
					this.addresses.superStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(inputs.afSuiCoinId), // Coin
			],
		});
	};

	public completeStakeAndReturnObligation = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		obligationHotPotatoId: ObjectId | TransactionObjectArgument;
		afSuiCoinId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"complete_stake_and_return_obligation"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.stakeCapId), // StakeCap
				tx.object(inputs.leveragedObligationKeyId), // LeveragedAfSuiObligationKey
				tx.object(
					this.addresses.superStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(inputs.afSuiCoinId), // Coin
				tx.object(inputs.obligationHotPotatoId), // ObligationHotPotato
			],
		});
	};

	public withdrawAfSuiCollateralTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		obligationKeyId: ObjectId | TransactionObjectArgument;
		withdrawAmount: Balance;
	}) /* Coin<AFSUI> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"withdraw_afsui_collateral"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.stakeCapId), // StakeCap
				tx.object(inputs.leveragedObligationKeyId), // LeveragedAfSuiObligationKey
				tx.object(
					this.addresses.superStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(inputs.obligationKeyId), // ObligationKey
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(this.addresses.scallop.objects.coinDecimalsRegistry), // CoinDecimalsRegistry
				tx.pure(inputs.withdrawAmount, "u64"), // withdraw_amount
				tx.object(this.addresses.scallop.objects.xOracle), // XOracle
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public repaySuiTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		suiCoinId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"repay_sui"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.stakeCapId), // StakeCap
				tx.object(inputs.leveragedObligationKeyId), // LeveragedAfSuiObligationKey
				tx.object(
					this.addresses.superStaking.objects.leveragedAfSuiState
				), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(inputs.suiCoinId), // Coin
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public completeUnstakeTx = (inputs: {
		tx: TransactionBlock;
		unstakeCapId: ObjectId | TransactionObjectArgument;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.superStaking.packages.leveragedAfSui,
				SuperStakingApi.constants.moduleNames.leverageStake,
				"complete_unstake"
			),
			typeArguments: [],
			arguments: [
				tx.object(inputs.unstakeCapId), // UnstakeCap
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	// TODO: stake if not afsui
	public fetchBuildOpenSuperStakeTx = async (
		// inputs: ApiLeveragedStakeBody
		inputs: {
			walletAddress: SuiAddress;
			stakeAmount: Balance;
			leverage: number;
			maxCollateralWeight: number;
			referrer?: SuiAddress;
			isSponsoredTx?: boolean;
		}
	): Promise<TransactionBlock> => {
		const {
			referrer,
			walletAddress,
			stakeAmount,
			leverage,
			maxCollateralWeight,
		} = inputs;

		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(walletAddress);

		let borrowAmount = this.Provider.Staking().afsuiToSuiTx({
			tx,
			afSuiAmount: BigInt(
				Math.floor(Number(stakeAmount) * maxCollateralWeight)
			),
		});

		// TODO: find out how to calc these values
		const leverageLoops = 3;

		// set referer
		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// get initial sui coin to stake
		let afSuiCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: this.Provider.Staking().coinTypes.afSui,
			coinAmount: borrowAmount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		const [
			stakeCapId,
			leveragedObligationKeyId,
			obligationId,
			obligationHotPotatoId,
		] = this.initiateStakeAndOpenObligationTx({
			tx,
			afSuiCoinId,
		});

		// perform leverage loops
		let suiCoin: TransactionObjectArgument;
		for (const _ of Array(leverageLoops).fill(null)) {
			borrowAmount = this.Provider.Staking().afsuiToSuiTx({
				tx,
				afSuiAmount: BigInt(
					Math.floor(Number(borrowAmount) * maxCollateralWeight)
				),
			});

			suiCoin = this.borrowSuiTx({
				tx,
				stakeCapId,
				leveragedObligationKeyId,
				obligationId,
				borrowAmount,
			});

			const afSuiCoinId = this.Provider.Staking().stakeTx({
				// TODO: cleanup this validator address
				tx,
				suiCoin,
				validatorAddress:
					this.Provider.addresses.router?.afSui?.objects
						.aftermathValidator ?? "",
			});

			// levereage = 	totalBorrow / (stakeAmount as sui)

			this.depositAfSuiCollateralTx({
				tx,
				stakeCapId,
				leveragedObligationKeyId,
				obligationId,
				afSuiCoinId,
			});
		}

		this.completeStakeAndReturnObligation({
			tx,
			stakeCapId,
			leveragedObligationKeyId,
			obligationId,
			obligationHotPotatoId,
			afSuiCoinId,
		});
		return tx;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	private async fetchSuperStakedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`super-staking/${walletAddress}/events/staked`,
			{
				cursor,
				limit,
			},
			Casting.superStaking.superStakedEventFromOnChain
		);
	}

	private async fetchSuperUnstakedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`super-staking/${walletAddress}/events/unstaked`,
			{
				cursor,
				limit,
			},
			Casting.superStaking.superUnstakedEventFromOnChain
		);
	}

	// =========================================================================
	//  Event Types
	// =========================================================================

	private superStakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			SuperStakingApi.constants.moduleNames.events,
			SuperStakingApi.constants.eventNames.superStaked
		);

	private superUnstakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			SuperStakingApi.constants.moduleNames.events,
			SuperStakingApi.constants.eventNames.superUnstaked
		);
}
