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
import { Scallop, ScallopQuery } from "@scallop-io/sui-scallop-sdk";

export class SuperStakingApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			actions: "actions",
		},
		eventNames: {
			staked: "StakedEvent",
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
		staked: AnyObjectType;
	};


	public readonly objectTypes: {
		unverifiedValidatorOperationCap: AnyObjectType;
	};

	private readonly ScallopProviders: {
		Main: Scallop;
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
			staked: this.stakedEventType(),
		};


		this.objectTypes = {
			unverifiedValidatorOperationCap: `${staking.packages.lsd}::validator::UnverifiedValidatorOperationCap`,
		};

		this.ScallopProviders = {
			Main: ScallopProvider,
			Query: await ScallopProvider.createScallopQuery()

		}
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchSuperStakeObligation = async (
		inputs: ApiSuperStakeObligationBody
	): Promise< | "none"> => {
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

	/**
	 * Adds move call to tx for liquid staking of SUI for afSUI.
	 *
	 * @returns `Coin<AFSUI>` if `withTransfer` is `undefined` or `false`
	 */
	public stakeTx = (inputs: {
		tx: TransactionBlock;
		suiCoin: ObjectId | TransactionArgument;
		validatorAddress: SuiAddress;
		withTransfer?: boolean;
	}) => {
		const { tx, suiCoin, withTransfer } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_stake" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.staking.objects.referralVault), // ReferralVault
				typeof suiCoin === "string" ? tx.object(suiCoin) : suiCoin,
				tx.pure(inputs.validatorAddress, "address"),
			],
		});
	};


	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildLeveragedStakeTx = async (
		inputs: ApiLeveragedStakeBody
	): Promise<TransactionBlock> => {
		const { referrer, walletAddress } = inputs;



		// TODO: find out how to calc these values
		const suiBorrowAmount = Number(inputs.suiStakeAmount);
		const leverageLoops = 3;



		// const scallopClient = await scallopSDK.createScallopClient();
		// 		const addresses =scallopClient.address.getAddresses("mainnet")




		const scallopBuilder = await scallopSDK.createScallopBuilder();
		scallopBuilder.init();

		const scallopTx = scallopBuilder.createTxBlock();
		const tx = scallopTx.txBlock;
		tx.setSender(walletAddress);

		// set referer
		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// get initial sui coin to stake
		let suiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: Coin.constants.suiCoinType,
			coinAmount: inputs.suiStakeAmount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		// create a scallop account
		const [obligation, obligationKey, hotPotato] =
			scallopTx.openObligation();
		scallopTx.openObligationEntry();

		// perform leverage loops
		let afSuiCoinId: TransactionObjectArgument;
		for (const _ of Array(leverageLoops).fill(null)) {
			// stake
			afSuiCoinId = this.stakeTx({
				tx,
				...inputs,
				suiCoin,
				// withTransfer: true,
			});

			// supply afsui as collateral
			scallopTx.addCollateral(obligation, afSuiCoinId, "afsui");
			// borrow sui
			suiCoin = scallopTx.borrow(
				obligation,
				obligationKey,
				suiBorrowAmount,
				"sui"
			);
		}

		// return obligation
		scallopTx.returnObligation(obligation, hotPotato);
		scallopTx.transferObjects([obligationKey], walletAddress);

		// transfer final afsui to holder
		tx.transferObjects([afSuiCoinId], tx.pure(inputs.walletAddress));
		return tx;
	};


		// =========================================================================
	//  Events
	// =========================================================================


	private async fetchUnstakedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/${walletAddress}/events/unstaked`,
			{
				cursor,
				limit,
			},
			Casting.staking.unstakedEventFromOnChain
		);
	}

	// =========================================================================
	//  Event Types
	// =========================================================================

	private stakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.staked
		);


}
