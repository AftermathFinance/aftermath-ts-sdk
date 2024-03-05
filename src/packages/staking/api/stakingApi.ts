import {
	TransactionArgument,
	TransactionBlock,
	TransactionObjectArgument,
} from "@mysten/sui.js/transactions";
import { DelegatedStake, ValidatorsApy } from "@mysten/sui.js/client";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	StakeEvent,
	StakePosition,
	StakedEvent,
	StakingPosition,
	UnstakePosition,
	UnstakedEvent,
	isStakePosition,
	isUnstakePosition,
	isStakeEvent,
	isUnstakeEvent,
	ValidatorConfigObject,
	ApiStakeStakedSuiBody,
	ApiUnstakeBody,
	ApiStakeBody,
	ApiDelegatedStakesBody,
	SuiDelegatedStake,
	ValidatorOperationCapObject,
	ApiUpdateValidatorFeeBody,
	UnstakeEvent,
	UnstakeRequestedEvent,
	StakedSuiVaultStateObject,
	AfSuiRouterPoolObject,
	ApiLeveragedStakeBody,
} from "../stakingTypes";
import {
	AfSuiRouterWrapperAddresses,
	AnyObjectType,
	ApiIndexerEventsBody,
	ApiIndexerUserEventsBody,
	Balance,
	CoinType,
	ObjectId,
	StakingAddresses,
	SuiAddress,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Coin } from "../../coin";
import { Sui } from "../../sui";
import { FixedUtils } from "../../../general/utils/fixedUtils";
import { StakingApiCasting } from "./stakingApiCasting";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
import { RouterPoolTradeTxInputs } from "../..";
import { Scallop } from "@scallop-io/sui-scallop-sdk";
import { ValidatorConfigOnIndexer } from "./stakingApiCastingTypes";

export class StakingApi
	implements RouterSynchronousApiInterface<AfSuiRouterPoolObject>
{
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			actions: "actions",
			events: "events",
			stakedSuiVault: "staked_sui_vault",
			stakedSuiVaultState: "staked_sui_vault_state",
			routerWrapper: "router",
		},
		eventNames: {
			staked: "StakedEvent",
			unstaked: "UnstakedEvent",
			unstakeRequested: "UnstakeRequestedEvent",
			epochWasChanged: "EpochWasChangedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		staking: StakingAddresses;
		routerWrapper?: AfSuiRouterWrapperAddresses;
	};

	public readonly eventTypes: {
		staked: AnyObjectType;
		unstakeRequested: AnyObjectType;
		unstaked: AnyObjectType;
		epochWasChanged: AnyObjectType;
	};

	public readonly coinTypes: {
		afSui: CoinType;
	};

	public readonly objectTypes: {
		unverifiedValidatorOperationCap: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const staking = this.Provider.addresses.staking;
		const routerWrapper = Provider.addresses.router?.afSui;

		if (!staking)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			staking,
			routerWrapper,
		};

		this.eventTypes = {
			staked: this.stakedEventType(),
			unstakeRequested: this.unstakeRequestedEventType(),
			unstaked: this.unstakedEventType(),
			epochWasChanged: this.epochWasChangedEventType(),
		};

		this.coinTypes = {
			afSui: `${staking.packages.afsui}::afsui::AFSUI`,
		};

		this.objectTypes = {
			unverifiedValidatorOperationCap: `${staking.packages.lsd}::validator::UnverifiedValidatorOperationCap`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Router Interface
	// =========================================================================

	public fetchAllPools = async (): Promise<AfSuiRouterPoolObject[]> => {
		const wrapperAddresses = this.addresses.routerWrapper;
		if (!wrapperAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		const [afSuiToSuiExchangeRate, stakedSuiVaultState] = await Promise.all(
			[
				this.fetchAfSuiToSuiExchangeRate(),
				this.fetchStakedSuiVaultState(),
			]
		);
		return [
			{
				...stakedSuiVaultState,
				afSuiCoinType: this.coinTypes.afSui,
				aftermathValidatorAddress:
					wrapperAddresses.objects.aftermathValidator,
				afSuiToSuiExchangeRate,
			},
		];
	};

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchDelegatedStakes = async (
		inputs: ApiDelegatedStakesBody
	): Promise<SuiDelegatedStake[]> => {
		const rawStakes = await this.Provider.provider.getStakes({
			owner: inputs.walletAddress,
		});

		const stakes = rawStakes.reduce((acc, stakeData) => {
			const stakesToAdd: SuiDelegatedStake[] = stakeData.stakes.map(
				(stake) => ({
					...stake,
					stakedSuiId: Helpers.addLeadingZeroesToType(
						stake.stakedSuiId
					),
					stakeRequestEpoch: BigInt(stake.stakeRequestEpoch),
					stakeActiveEpoch: BigInt(stake.stakeActiveEpoch),
					principal: BigInt(stake.principal),
					estimatedReward:
						stake.status === "Active"
							? BigInt(stake.estimatedReward)
							: undefined,
					stakingPool: Helpers.addLeadingZeroesToType(
						stakeData.stakingPool
					),
					validatorAddress: Helpers.addLeadingZeroesToType(
						stakeData.validatorAddress
					),
				})
			);
			return [...acc, ...stakesToAdd];
		}, [] as SuiDelegatedStake[]);

		stakes.sort((a, b) =>
			Number(b.stakeRequestEpoch - a.stakeRequestEpoch)
		);

		return stakes;
	};

	public fetchValidatorApys = async (): Promise<ValidatorsApy> => {
		const apyData = await this.Provider.provider.getValidatorsApy();

		const apys = apyData.apys.map((apy) => ({
			...apy,
			address: Helpers.addLeadingZeroesToType(apy.address),
		}));

		return { ...apyData, apys };
	};

	public fetchValidatorConfigs = async (): Promise<
		ValidatorConfigObject[]
	> => {
		const configs: ValidatorConfigOnIndexer[] =
			await this.Provider.indexerCaller.fetchIndexer(
				`staking/validator-configs`
			);
		return configs.map(StakingApiCasting.validatorConfigObjectFromIndexer);
	};

	public fetchOwnedValidatorOperationCaps = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<ValidatorOperationCapObject[]> => {
		const { walletAddress } = inputs;

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.unverifiedValidatorOperationCap,
			objectFromSuiObjectResponse:
				Casting.staking
					.validatorOperationCapObjectFromSuiObjectResponse,
		});
	};

	public fetchStakedSuiVaultState =
		async (): Promise<StakedSuiVaultStateObject> => {
			return this.Provider.Objects().fetchCastObject({
				objectId: this.addresses.staking.objects.stakedSuiVaultState,
				objectFromSuiObjectResponse:
					StakingApiCasting.stakedSuiVaultStateObjectFromSuiObjectResponse,
			});
		};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Staking Transaction Commands
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

	/**
	 * Adds move call to tx for liquid unstaking of afSUI for SUI that will be
	 * processed at start of next epoch (end of current epoch).
	 *
	 * @returns ()
	 */
	public unstakeTx = (inputs: {
		tx: TransactionBlock;
		afSuiCoin: ObjectId | TransactionArgument;
	}) => {
		const { tx, afSuiCoin } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_unstake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				typeof afSuiCoin === "string"
					? tx.object(afSuiCoin)
					: afSuiCoin,
			],
		});
	};

	/**
	 * Adds move call to tx for liquid unstaking of afSUI for SUI that will be
	 * processed immedietly.
	 *
	 * @returns `Coin<SUI>` if `withTransfer` is `undefined` or `false`
	 */
	public atomicUnstakeTx = (inputs: {
		tx: TransactionBlock;
		afSuiCoin: ObjectId | TransactionArgument;
		withTransfer?: boolean;
	}) => {
		const { tx, afSuiCoin, withTransfer } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_unstake_atomic" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				tx.object(this.addresses.staking.objects.referralVault), // ReferralVault
				tx.object(this.addresses.staking.objects.treasury), // Treasury
				typeof afSuiCoin === "string"
					? tx.object(afSuiCoin)
					: afSuiCoin,
			],
		});
	};

	/**
	 * Adds move call to tx for liquid staking of currently staked (non-liquid)
	 * SUI objects for afSUI.
	 *
	 * @returns `Coin<AFSUI>` if `withTransfer` is `undefined` or `false`
	 */
	public requestStakeStakedSuiVecTx = (inputs: {
		tx: TransactionBlock;
		stakedSuiIds: ObjectId[];
		validatorAddress: SuiAddress;
		withTransfer?: boolean;
	}) => {
		const { tx, stakedSuiIds, withTransfer } = inputs;

		const stakedSuiIdsVec = tx.makeMoveVec({
			objects: stakedSuiIds.map((id) => tx.object(id)),
		});

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_stake_staked_sui_vec" +
					(withTransfer ? "_and_keep" : "")
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.staking.objects.referralVault), // ReferralVault
				stakedSuiIdsVec,
				tx.pure(inputs.validatorAddress, "address"),
			],
		});
	};

	// =========================================================================
	//  Inspection Transaction Commands
	// =========================================================================

	public afSuiToSuiExchangeRateTx = (inputs: {
		tx: TransactionBlock;
	}) /* (u128) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"afsui_to_sui_exchange_rate"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
			],
		});
	};

	public suiToAfSuiExchangeRateTx = (inputs: {
		tx: TransactionBlock;
	}) /* (u128) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"sui_to_afsui_exchange_rate"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
			],
		});
	};

	public totalSuiAmountTx = (inputs: { tx: TransactionBlock }) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"total_sui_amount"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault),
			],
		});
	};

	public afSuiToSuiTx = (inputs: {
		tx: TransactionBlock;
		afSuiAmount: Balance;
	}) /* (u64) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"afsui_to_sui"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				tx.pure(inputs.afSuiAmount, "u64"),
			],
		});
	};

	public suiToAfSuiTx = (inputs: {
		tx: TransactionBlock;
		suiAmount: Balance;
	}) /* (u64) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"sui_to_afsui"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				tx.pure(inputs.suiAmount, "u64"),
			],
		});
	};

	// =========================================================================
	//  Validator Transaction Commands
	// =========================================================================

	public updateValidatorFeeTx = (inputs: {
		tx: TransactionBlock;
		validatorOperationCapId: ObjectId;
		newFee: bigint;
	}) => {
		const { tx, validatorOperationCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.staking.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"update_validator_fee"
			),
			typeArguments: [],
			arguments: [
				typeof validatorOperationCapId === "string"
					? tx.object(validatorOperationCapId)
					: validatorOperationCapId, // UnverifiedValidatorOperationCap
				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.pure(inputs.newFee, "u64"),
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	/**
	 * Builds complete PTB for liquid staking of SUI for afSUI.
	 *
	 * @returns Transaction Block ready for execution
	 */
	public fetchBuildStakeTx = async (
		inputs: ApiStakeBody
	): Promise<TransactionBlock> => {
		const { referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const suiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: Coin.constants.suiCoinType,
			coinAmount: inputs.suiStakeAmount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		const afSuiCoinId = this.stakeTx({
			tx,
			...inputs,
			suiCoin,
			// withTransfer: true,
		});
		tx.transferObjects([afSuiCoinId], tx.pure(inputs.walletAddress));

		return tx;
	};

	/**
	 * Builds complete PTB for liquid unstaking of afSUI for SUI.
	 *
	 * @returns Transaction Block ready for execution
	 */
	public fetchBuildUnstakeTx = async (
		inputs: ApiUnstakeBody
	): Promise<TransactionBlock> => {
		const { referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const afSuiCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: this.coinTypes.afSui,
			coinAmount: inputs.afSuiUnstakeAmount,
		});

		if (inputs.isAtomic) {
			const suiCoinId = this.atomicUnstakeTx({
				tx,
				...inputs,
				afSuiCoin,
				// withTransfer: true,
			});
			tx.transferObjects([suiCoinId], tx.pure(inputs.walletAddress));
		} else {
			this.unstakeTx({
				tx,
				...inputs,
				afSuiCoin,
			});
		}

		return tx;
	};

	/**
	 * Builds complete PTB for liquid staking of currently staked (non-liquid)
	 * SUI objects for afSUI.
	 *
	 * @returns Transaction Block ready for execution
	 */
	public fetchBuildStakeStakedSuiTx = async (
		inputs: ApiStakeStakedSuiBody
	): Promise<TransactionBlock> => {
		const { referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const afSuiCoinId = this.requestStakeStakedSuiVecTx({
			tx,
			...inputs,
			// withTransfer: true,
		});
		tx.transferObjects([afSuiCoinId], tx.pure(inputs.walletAddress));

		return tx;
	};

	public buildUpdateValidatorFeeTx = async (
		inputs: ApiUpdateValidatorFeeBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.updateValidatorFeeTx({
			...inputs,
			tx,
			newFee: Casting.numberToFixedBigInt(inputs.newFeePercentage),
		});

		return tx;
	};

	// =========================================================================
	//  Positions
	// =========================================================================

	/**
	 * Queries events for history of stakes and unstakes made by user to
	 * assemble current status of each.
	 *
	 * @returns All recent stakes and unstakes for user
	 */
	public fetchAllPositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakingPosition[]> => {
		const [stakes, unstakes] = await Promise.all([
			this.fetchAllStakePositions(inputs),
			this.fetchAllUnstakePositions(inputs),
		]);

		const positions = [...stakes, ...unstakes];

		return positions.sort(
			(a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
		);
	};

	/**
	 * Queries events for history of stakes made by user to
	 * assemble current status of each.
	 *
	 * @returns All recent stakes for user
	 */
	public fetchAllStakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakePosition[]> => {
		const { walletAddress } = inputs;

		const stakedEvents = (
			await this.fetchStakedEvents({
				cursor: 0,
				limit: 100,
				walletAddress,
			})
		).events;

		return stakedEvents;
	};

	/**
	 * Queries events for history of unstakes made by user to
	 * assemble current status of each.
	 *
	 * @returns All recent unstakes for user
	 */
	public fetchAllUnstakePositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<UnstakePosition[]> => {
		const { walletAddress } = inputs;

		const cursor = 0;
		const limit = 100;
		const [unstakedEvents, requestedEvents] = await Promise.all([
			// unstaked
			(
				await this.fetchUnstakedEvents({
					cursor,
					limit,
					walletAddress,
				})
			).events,
			// unstake requested
			(
				await this.fetchUnstakeRequestedEvents({
					cursor,
					limit,
					walletAddress,
				})
			).events,
		]);

		const partiallyMergedPositions: UnstakePosition[] = requestedEvents.map(
			(request) => {
				const foundMintIndex = unstakedEvents.findIndex(
					(mint) => mint.afSuiId === request.afSuiId
				);
				if (foundMintIndex >= 0)
					return {
						...unstakedEvents[foundMintIndex],
						state: "SUI_MINTED",
						epoch: request.epoch,
					};

				return {
					state: "REQUEST",
					...request,
				};
			}
		);
		const completeMergedPositions: UnstakePosition[] =
			unstakedEvents.reduce((acc, unstakedEvent) => {
				if (
					acc.some(
						(position) => position.afSuiId === unstakedEvent.afSuiId
					)
				)
					return acc;

				return [
					{
						...unstakedEvent,
						state: "SUI_MINTED",
					},
					...acc,
				];
			}, partiallyMergedPositions);

		return completeMergedPositions;
	};

	// =========================================================================
	//  Router Transaction Commands
	// =========================================================================

	public routerWrapperStakeTx = (
		inputs: RouterPoolTradeTxInputs
	): TransactionArgument => {
		if (!this.addresses.routerWrapper)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.routerWrapper.packages.wrapper,
				StakingApi.constants.moduleNames.routerWrapper,
				"request_stake"
			),
			typeArguments: [inputs.routerSwapCapCoinType],
			arguments: [
				tx.object(this.addresses.routerWrapper.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.staking.objects.referralVault), // ReferralVault
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure(
					this.addresses.routerWrapper.objects.aftermathValidator,
					"address"
				),
			],
		});
	};

	public routerWrapperAtomicUnstakeTx = (
		inputs: RouterPoolTradeTxInputs
	): TransactionArgument => {
		if (!this.addresses.routerWrapper)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.routerWrapper.packages.wrapper,
				StakingApi.constants.moduleNames.routerWrapper,
				"request_unstake_atomic"
			),
			typeArguments: [inputs.routerSwapCapCoinType],
			arguments: [
				tx.object(this.addresses.routerWrapper.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.staking.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.staking.objects.safe), // Safe
				tx.object(this.addresses.staking.objects.referralVault), // ReferralVault
				tx.object(this.addresses.staking.objects.treasury), // Treasury
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
			],
		});
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Total SUI staked for afSUI in protocol.
	 *
	 * @returns SUI staked for afSUI as `bigint`
	 */
	public fetchSuiTvl = async (): Promise<Balance> => {
		const tx = new TransactionBlock();
		this.totalSuiAmountTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchAfSuiToSuiExchangeRate = async (): Promise<number> => {
		const tx = new TransactionBlock();
		this.afSuiToSuiExchangeRateTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const exchangeRate = FixedUtils.directCast(
			Casting.bigIntFromBytes(bytes)
		);
		return exchangeRate <= 0 ? 1 : exchangeRate;
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	public liquidStakingApy = async (): Promise<number> => {
		const limit = 30 + 2; // ~30 days/epochs of data
		// + 2 to account for apy being calculated from events delta
		// (and possible initial 0 afsui supply)
		const recentEpochChanges = await this.fetchEpochWasChangedEvents({
			limit,
		});
		if (recentEpochChanges.events.length <= 2) return 0;

		const daysInYear = 365;
		const avgApy =
			(Helpers.sum(
				recentEpochChanges.events.slice(2).map((event, index) => {
					const currentRate = Number(event.totalAfSuiSupply)
						? Number(event.totalSuiAmount) /
						  Number(event.totalAfSuiSupply)
						: 1;

					const pastEvent = recentEpochChanges.events[index + 1];
					const pastRate = Number(pastEvent.totalAfSuiSupply)
						? Number(pastEvent.totalSuiAmount) /
						  Number(pastEvent.totalAfSuiSupply)
						: 1;

					return (currentRate - pastRate) / pastRate;
				})
			) /
				(recentEpochChanges.events.length - 2)) *
			daysInYear;

		return avgApy;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public async fetchEpochWasChangedEvents(inputs: ApiIndexerEventsBody) {
		const { cursor, limit } = inputs;
		// const eventsData = await this.Provider.indexerCaller.fetchIndexerEvents(
		// 	`staking/events/epoch-was-changed`,
		// 	{
		// 		cursor,
		// 		limit,
		// 	},
		// 	Casting.staking.epochWasChangedEventFromOnChain
		// );
		// // TODO: move timestamp ordering reversal to indexer
		// eventsData.events.reverse();
		// return eventsData;
		const eventsData =
			await this.Provider.Events().fetchCastEventsWithCursor({
				query: {
					MoveEventType: this.eventTypes.epochWasChanged,
				},
				eventFromEventOnChain:
					Casting.staking.epochWasChangedEventFromOnChain,
				limit,
			});
		eventsData.events.reverse();
		return eventsData;
	}

	public async fetchStakedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/${walletAddress}/events/staked`,
			{
				cursor,
				limit,
			},
			Casting.staking.stakedEventFromOnChain
		);
	}

	public async fetchUnstakedEvents(inputs: ApiIndexerUserEventsBody) {
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

	public async fetchUnstakeRequestedEvents(inputs: ApiIndexerUserEventsBody) {
		const { walletAddress, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/${walletAddress}/events/unstake-requested`,
			{
				cursor,
				limit,
			},
			Casting.staking.unstakeRequestedEventFromOnChain
		);
	}

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private stakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.staked
		);

	private unstakeRequestedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstakeRequested
		);

	private unstakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstaked
		);

	private epochWasChangedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.staking.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.epochWasChanged
		);

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Staking Positions Updating
	// =========================================================================

	// NOTE: should these functions be on FE only ?

	public static updateStakingPositionsFromEvent = (inputs: {
		stakingPositions: StakingPosition[];
		event: StakeEvent | UnstakeEvent;
	}): StakingPosition[] => {
		const positions = inputs.stakingPositions;
		const event = inputs.event;

		let newPositions: StakingPosition[] = [];

		// TODO: use bifilter
		const unstakePositions = positions.filter(isUnstakePosition);
		const newUnstakes = isUnstakeEvent(event)
			? this.updateUnstakePositionsFromEvent({
					event,
					unstakePositions,
			  })
			: unstakePositions;

		const stakePositions = positions.filter(isStakePosition);
		const newStakes = isStakeEvent(event)
			? [...stakePositions, event]
			: stakePositions;

		newPositions = [...newUnstakes, ...newStakes];

		return newPositions.sort(
			(a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
		);
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Unstake Event Processing
	// =========================================================================

	private static updateUnstakePositionsFromEvent = (inputs: {
		unstakePositions: UnstakePosition[];
		event: UnstakeEvent;
	}): UnstakePosition[] => {
		const foundPositionIndex = inputs.unstakePositions.findIndex(
			(pos) => pos.afSuiId === inputs.event.afSuiId
		);
		if (foundPositionIndex < 0) {
			if (
				inputs.event.type.includes(
					this.constants.eventNames.unstakeRequested
				)
			)
				return [
					{
						...(inputs.event as UnstakeRequestedEvent),
						state: "REQUEST",
					},
					...inputs.unstakePositions,
				];

			// unstaked event
			return [
				{
					...(inputs.event as UnstakedEvent),
					state: "SUI_MINTED",
				},
				...inputs.unstakePositions,
			];
		}

		const foundStakePosition = inputs.unstakePositions[foundPositionIndex];

		let position: UnstakePosition | undefined = undefined;
		if (inputs.event.type.includes(this.constants.eventNames.unstaked))
			position = {
				...(inputs.event as UnstakedEvent),
				state: "SUI_MINTED",
				epoch: foundStakePosition.epoch,
			};

		if (
			inputs.event.type.includes(
				this.constants.eventNames.unstakeRequested
			)
		)
			position = {
				...(inputs.event as UnstakeRequestedEvent),
				state: "REQUEST",
				epoch: foundStakePosition.epoch,
			};

		if (!position) return inputs.unstakePositions;

		let newStakePositions = [...inputs.unstakePositions];
		newStakePositions[foundPositionIndex] = position;

		return newStakePositions;
	};
}
