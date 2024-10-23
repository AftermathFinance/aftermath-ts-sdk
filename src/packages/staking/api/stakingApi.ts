import {
	TransactionArgument,
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { DelegatedStake, ValidatorsApy } from "@mysten/sui/client";
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
} from "../stakingTypes";
import {
	AnyObjectType,
	ApiIndexerEventsBody,
	ApiIndexerUserEventsBody,
	Balance,
	CoinType,
	ExternalFee,
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
import { ValidatorConfigOnIndexer } from "./stakingApiCastingTypes";
import { Staking } from "../..";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";

export class StakingApi implements MoveErrorsInterface {
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
			sort: "sort",
			receipt: "receipt",
			calculations: "calculations",
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

	public readonly addresses: StakingAddresses;
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
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		if (!this.Provider.addresses.staking)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = this.Provider.addresses.staking;
		this.eventTypes = {
			staked: this.stakedEventType(),
			unstakeRequested: this.unstakeRequestedEventType(),
			unstaked: this.unstakedEventType(),
			epochWasChanged: this.epochWasChangedEventType(),
		};
		this.coinTypes = {
			afSui: `${this.addresses.packages.afsui}::afsui::AFSUI`,
		};
		this.objectTypes = {
			unverifiedValidatorOperationCap: `${this.addresses.packages.lsd}::validator::UnverifiedValidatorOperationCap`,
		};
		this.moveErrors = {
			[this.addresses.packages.lsd]: {
				[StakingApi.constants.moduleNames.stakedSuiVault]: {
					/// The admin calls `migrate` on an outdated package.
					0: "Version Incompatibility",
					/// A user tries to interact with the `StakedSuiVault` through an outdated package.
					1: "Wrong Package Version",
					/// One tries to call deprecated function.
					2: "Deprecated",
				},
				[StakingApi.constants.moduleNames.sort]: {
					/// One provided keys and values vectors of different lengths.
					1: "Different Inputs Length",
					/// Error for tests.
					2: "Dummy Error",
				},
				[StakingApi.constants.moduleNames.calculations]: {
					/// User provided a percentage value larger than 10^18 = 1 = 100%.
					0: "Invalid Percentage",
				},
				[StakingApi.constants.moduleNames.actions]: {
					/// Epoch advancement has not yet been processed.
					0: "Epoch Change Has Not Been Treated",
					/// Epoch advancement has already been processed.
					1: "Epoch Change Has Already Been Treated",
					/// User tried to delegate stake to a validator that is inactive.
					2: "Validator Is Not Active",
					/// User tried to delegate stake with value less than the minimum staking threshold.
					3: "Less Than Minimum Staking Threshold",
					/// User tried to delegate stake to a validator whose history of exchange rates is too short.
					4: "Insufficient Validator History",
					/// User provided an empty vector as input.
					5: "Empty Vector",
					/// User requested to unstake more SUI than held in the `atomic_unstake_sui_reserves`.
					6: "Insufficient Sui Reserves",
					/// User provided afSUI coin with insufficient balance.
					7: "Insufficient Balance afSUI Coin Provided",
				},
				[StakingApi.constants.moduleNames.receipt]: {
					0: "Not Enough Amount In Receipt",
					1: "Try To Burn Non Zero Receipt",
				},
				[StakingApi.constants.moduleNames.stakedSuiVaultState]: {
					/// One provided value larger than 1 (100%) when opposite is supposed.
					1: "Invalid Percentage",
					/// One provided min atomic unstake fee value larger than max atomic unstake fee value.
					2: "Invalid Atomic Unstake Fees Values",
					/// A `validator` address - that isn't recognized by the afSUI framework - is provided to a function
					///  that requests a `ValidatorConfig`.
					3: "Invalid Validator",
					/// An address tries to create a `UnverifiedValidatorOperationCap` without being an active validator.
					4: "Validator Is Not Active",
					/// An authorized owner of an `UnverifiedValidatorOperationCap` object tries to perform a permissioned
					///  function for another validator.
					5: "Invalid Operation Cap",
					/// An authorized owner of an `UnverifiedValidatorOperationCap` object tries to set a `validator_fee`
					///  that is greater than the maximum allowed validator fee.
					6: "Invalid Validator Fee",
				},
			},
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

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
		return this.Provider.indexerCaller.fetchIndexer(
			`staking/validator-configs`
		);
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
				objectId: this.addresses.objects.stakedSuiVaultState,
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
		tx: Transaction;
		suiCoin: ObjectId | TransactionArgument;
		validatorAddress: SuiAddress;
		withTransfer?: boolean;
	}) => {
		const { tx, suiCoin, withTransfer } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_stake" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.objects.referralVault), // ReferralVault
				typeof suiCoin === "string" ? tx.object(suiCoin) : suiCoin,
				tx.pure.address(inputs.validatorAddress),
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
		tx: Transaction;
		afSuiCoin: ObjectId | TransactionArgument;
	}) => {
		const { tx, afSuiCoin } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_unstake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
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
		tx: Transaction;
		afSuiCoin: ObjectId | TransactionArgument;
		withTransfer?: boolean;
	}) => {
		const { tx, afSuiCoin, withTransfer } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_unstake_atomic" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(this.addresses.objects.referralVault), // ReferralVault
				tx.object(this.addresses.objects.treasury), // Treasury
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
		tx: Transaction;
		stakedSuiIds: ObjectId[];
		validatorAddress: SuiAddress;
		withTransfer?: boolean;
	}) => {
		const { tx, stakedSuiIds, withTransfer } = inputs;

		const stakedSuiIdsVec = tx.makeMoveVec({
			elements: stakedSuiIds.map((id) => tx.object(id)),
		});

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"request_stake_staked_sui_vec" +
					(withTransfer ? "_and_keep" : "")
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.objects.referralVault), // ReferralVault
				stakedSuiIdsVec,
				tx.pure.address(inputs.validatorAddress),
			],
		});
	};

	public epochWasChangedTx = (inputs: { tx: Transaction }) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"epoch_was_changed"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(Sui.constants.addresses.suiSystemStateId), // SuiSystemState
				tx.object(this.addresses.objects.referralVault), // ReferralVault
				tx.object(this.addresses.objects.treasury), // Treasury
				tx.pure.u64(BigInt(1000)), // fields_requests_per_tx
			],
		});
	};

	// =========================================================================
	//  Inspection Transaction Commands
	// =========================================================================

	public afSuiToSuiExchangeRateTx = (inputs: {
		tx: Transaction;
	}) /* (u128) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"afsui_to_sui_exchange_rate"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
			],
		});
	};

	public suiToAfSuiExchangeRateTx = (inputs: {
		tx: Transaction;
	}) /* (u128) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"sui_to_afsui_exchange_rate"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
			],
		});
	};

	public totalSuiAmountTx = (inputs: { tx: Transaction }) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"total_sui_amount"
			),
			typeArguments: [],
			arguments: [tx.object(this.addresses.objects.stakedSuiVault)],
		});
	};

	public afSuiToSuiTx = (inputs: {
		tx: Transaction;
		afSuiAmount: Balance;
	}) /* (u64) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"afsui_to_sui"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.pure.u64(inputs.afSuiAmount),
			],
		});
	};

	public suiToAfSuiTx = (inputs: {
		tx: Transaction;
		suiAmount: Balance;
	}) /* (u64) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"sui_to_afsui"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.pure.u64(inputs.suiAmount),
			],
		});
	};

	// =========================================================================
	//  Validator Transaction Commands
	// =========================================================================

	public updateValidatorFeeTx = (inputs: {
		tx: Transaction;
		validatorOperationCapId: ObjectId;
		newFee: bigint;
	}) => {
		const { tx, validatorOperationCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				"update_validator_fee"
			),
			typeArguments: [],
			arguments: [
				typeof validatorOperationCapId === "string"
					? tx.object(validatorOperationCapId)
					: validatorOperationCapId, // UnverifiedValidatorOperationCap
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.pure.u64(inputs.newFee),
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
	): Promise<Transaction> => {
		const { referrer, externalFee } = inputs;

		if (externalFee) StakingApi.assertValidExternalFee(externalFee);

		const tx = new Transaction();
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

		if (externalFee) {
			const feeAmount = BigInt(
				Math.floor(
					Number(inputs.suiStakeAmount) * externalFee.feePercentage
				)
			);
			const suiFeeCoin = tx.splitCoins(suiCoin, [feeAmount]);
			tx.transferObjects([suiFeeCoin], externalFee.recipient);
		}

		const afSuiCoinId = this.stakeTx({
			tx,
			...inputs,
			suiCoin,
			// withTransfer: true,
		});
		tx.transferObjects([afSuiCoinId], inputs.walletAddress);

		return tx;
	};

	/**
	 * Builds complete PTB for liquid unstaking of afSUI for SUI.
	 *
	 * @returns Transaction Block ready for execution
	 */
	public fetchBuildUnstakeTx = async (
		inputs: ApiUnstakeBody
	): Promise<Transaction> => {
		const { referrer, externalFee } = inputs;

		if (externalFee) StakingApi.assertValidExternalFee(externalFee);

		const tx = new Transaction();
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

		if (externalFee) {
			const feeAmount = BigInt(
				Math.floor(
					Number(inputs.afSuiUnstakeAmount) *
						externalFee.feePercentage
				)
			);
			const afSuiFeeCoin = tx.splitCoins(afSuiCoin, [feeAmount]);
			tx.transferObjects([afSuiFeeCoin], externalFee.recipient);
		}
		if (inputs.isAtomic) {
			const suiCoinId = this.atomicUnstakeTx({
				tx,
				...inputs,
				afSuiCoin,
				// withTransfer: true,
			});
			tx.transferObjects([suiCoinId], inputs.walletAddress);
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
	): Promise<Transaction> => {
		const { referrer } = inputs;

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		// TODO: add external fee here
		const afSuiCoinId = this.requestStakeStakedSuiVecTx({
			tx,
			...inputs,
			// withTransfer: true,
		});
		tx.transferObjects([afSuiCoinId], inputs.walletAddress);

		return tx;
	};

	public buildUpdateValidatorFeeTx = async (
		inputs: ApiUpdateValidatorFeeBody
	): Promise<Transaction> => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		this.updateValidatorFeeTx({
			...inputs,
			tx,
			newFee: Casting.numberToFixedBigInt(inputs.newFeePercentage),
		});

		return tx;
	};

	public buildEpochWasChangedTx = Helpers.transactions.createBuildTxFunc(
		this.epochWasChangedTx
	);

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
	//  Inspections
	// =========================================================================

	/**
	 * Total SUI staked for afSUI in protocol.
	 *
	 * @returns SUI staked for afSUI as `bigint`
	 */
	public fetchSuiTvl = async (): Promise<Balance> => {
		const tx = new Transaction();
		this.totalSuiAmountTx({ tx });
		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchAfSuiToSuiExchangeRate = async (): Promise<number> => {
		const tx = new Transaction();
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

	public fetchUniqueStakers = async (): Promise<number> => {
		return this.Provider.indexerCaller.fetchIndexer(
			"staking/unique-stakers"
		);
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
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`staking/events/epoch-was-changed`,
			{
				cursor,
				limit,
			}
		);
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
			this.addresses.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.staked
		);

	private unstakeRequestedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstakeRequested
		);

	private unstakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstaked
		);

	private epochWasChangedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
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

	private static assertValidExternalFee = (externalFee: ExternalFee) => {
		if (
			externalFee.feePercentage >=
			Staking.constants.bounds.maxExternalFeePercentage
		)
			throw new Error(
				`external fee percentage exceeds max of ${
					Staking.constants.bounds.maxExternalFeePercentage * 100
				}%`
			);
		if (externalFee.feePercentage <= 0)
			throw new Error(`external fee percentage must be greater than 0`);
	};

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
