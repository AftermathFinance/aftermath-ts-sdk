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
	ObjectId,
	PoolsAddresses,
	StakingAddresses,
	SuiAddress,
	SuperStakingAddresses,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import { Sui } from "../../sui";
import { Scallop, ScallopBuilder, ScallopQuery } from "@scallop-io/sui-scallop-sdk";

export class SuperStakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			leverageStake: "leverage_stake",
			events: "events"
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
		unverifiedValidatorOperationCap: AnyObjectType;
	};

	private readonly ScallopProviders: {
		Main: Scallop;
		Builder: ScallopBuilder;
		Query: ScallopQuery;
	};


	// =========================================================================
	//  Constructor
	// =========================================================================



	constructor(private readonly Provider: AftermathApi,  ScallopProvider: Scallop) {
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
			// unverifiedValidatorOperationCap: `${staking.packages.lsd}::validator::UnverifiedValidatorOperationCap`,
		};

		const [Builder, Query] = await Promise.all([ScallopProvider.createScallopBuilder(), ScallopProvider.createScallopQuery()])
		Builder.init();
		Query.init();

		this.ScallopProviders = {
			Main: ScallopProvider,
			Builder,
			Query,
		}
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchSuperStakeObligation = async (
		// inputs: ApiSuperStakeObligationBody
		inputs: {
			walletAddress: SuiAddress
		}
	): Promise< | "none"> => {
		const {walletAddress} = inputs


		const leveragedObligationKeys = await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: ,
			objectFromSuiObjectResponse: 
		})
		if (leveragedObligationKeys.length <= 0) return "none"

		const leverageKey = leveragedObligationKeys[0]
		const obligationAccount = await this.ScallopProviders.Query.getObligationAccount(leverageKey)


		return stakes;
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
		afSuiCoinId:  ObjectId | TransactionObjectArgument;
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
				tx.object(this.addresses.superStaking.objects.leveragedAfSuiState), // LeveragedAfSuiState

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
		borrowAmount: Balance
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
				tx.object(this.addresses.superStaking.objects.leveragedAfSuiState), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(this.addresses.scallop.objects.coinDecimalsRegistry), // CoinDecimalsRegistry
				tx.pure(inputs.borrowAmount, "u64"), // borrow_amount
				tx.object(this.addresses.scallop.objects.xOracle), // XOracle
				tx.object(Sui.constants.addresses.suiClockId) // Clock
			],
		});
	};
	

	public completeLeverageStakeTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		afSuiCoinId:  ObjectId | TransactionObjectArgument;
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
				tx.object(this.addresses.superStaking.objects.leveragedAfSuiState), // LeveragedAfSuiState

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
		afSuiCoinId:ObjectId | TransactionObjectArgument;
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
				tx.object(this.addresses.superStaking.objects.leveragedAfSuiState), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(inputs.afSuiCoinId), // Coin
				tx.object(inputs.obligationHotPotatoId) // ObligationHotPotato
			],
		});
	};



	public withdrawAfSuiCollateralTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		obligationKeyId: ObjectId | TransactionObjectArgument;
		withdrawAmount: Balance
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
				tx.object(this.addresses.superStaking.objects.leveragedAfSuiState), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(inputs.obligationKeyId), // ObligationKey
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(this.addresses.scallop.objects.coinDecimalsRegistry), // CoinDecimalsRegistry
				tx.pure(inputs.withdrawAmount, "u64"), // withdraw_amount
				tx.object(this.addresses.scallop.objects.xOracle), // XOracle
				tx.object(Sui.constants.addresses.suiClockId) // Clock
			],
		});
	};
	

	public repaySuiTx = (inputs: {
		tx: TransactionBlock;
		stakeCapId: ObjectId | TransactionObjectArgument;
		leveragedObligationKeyId: ObjectId | TransactionObjectArgument;
		obligationId: ObjectId | TransactionObjectArgument;
		suiCoinId:  ObjectId | TransactionObjectArgument;
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
				tx.object(this.addresses.superStaking.objects.leveragedAfSuiState), // LeveragedAfSuiState

				tx.object(this.addresses.scallop.objects.version), // Version
				tx.object(inputs.obligationId), // Obligation
				tx.object(this.addresses.scallop.objects.afSuiMarket), // Market
				tx.object(inputs.suiCoinId), // Coin
				tx.object(Sui.constants.addresses.suiClockId) // Clock
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

	public fetchBuildOpenSuperStakeTx = async (
		// inputs: ApiLeveragedStakeBody
		inputs: {
			walletAddress: SuiAddress,
			referrer?: SuiAddress,
			isSponsoredTx?: boolean
		}
	): Promise<TransactionBlock> => {
		const { referrer, walletAddress } = inputs;



		// TODO: find out how to calc these values
		let borrowAmount = BigInt(0)
		const leverageLoops = 3;





		const scallopTx = this.ScallopProviders.Builder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(walletAddress);

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

		// create a scallop account
		// const [obligation, obligationKey, hotPotato] =
		// 	scallopTx.openObligation();
		// scallopTx.openObligationEntry();


		const [stakeCapId, leveragedObligationKeyId, obligationId, obligationHotPotatoId] = this.initiateStakeAndOpenObligationTx({
			tx,
			afSuiCoinId
		})




		// perform leverage loops
		let suiCoin: TransactionObjectArgument;
		for (const _ of Array(leverageLoops).fill(null)) {


			suiCoin = this.borrowSuiTx({
				tx,
				stakeCapId,leveragedObligationKeyId,obligationId,borrowAmount
			})

			const afSuiCoinId = this.Provider.Staking().stakeTx({
				// TODO: cleanup this validator address
				tx, suiCoin, validatorAddress: this.Provider.addresses.router?.afSui?.objects.aftermathValidator ?? ""
			})


			this.depositAfSuiCollateralTx({
				tx,
				stakeCapId,
				leveragedObligationKeyId,
				obligationId,
				afSuiCoinId
			})
	

			// // stake
			// afSuiCoinId = this.stakeTx({
			// 	tx,
			// 	...inputs,
			// 	suiCoin,
			// 	// withTransfer: true,
			// });

			// // supply afsui as collateral
			// scallopTx.addCollateral(obligation, afSuiCoinId, "afsui");
			// // borrow sui
			// suiCoin = scallopTx.borrow(
			// 	obligation,
			// 	obligationKey,
			// 	suiBorrowAmount,
			// 	"sui"
			// );
		}


		this.completeStakeAndReturnObligation({
			tx, stakeCapId, leveragedObligationKeyId, obligationId, obligationHotPotatoId, afSuiCoinId
		})

		// // return obligation
		// scallopTx.returnObligation(obligation, hotPotato);
		// scallopTx.transferObjects([obligationKey], walletAddress);

		// // transfer final afsui to holder
		// tx.transferObjects([afSuiCoinId], tx.pure(inputs.walletAddress));
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
