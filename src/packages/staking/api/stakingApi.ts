import {
	Transaction,
	type TransactionArgument,
} from "@mysten/sui/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import type {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";
import { Casting, Helpers } from "../../../general/utils";
import type {
	AnyObjectType,
	Balance,
	CoinType,
	ExternalFee,
	ObjectId,
	StakingAddresses,
	SuiAddress,
} from "../../../types";
import { Staking } from "../..";
import { Coin } from "../../coin";
import { Sui } from "../../sui";
import {
	type ApiStakeBody,
	type ApiStakeStakedSuiBody,
	type ApiUnstakeBody,
	type ApiUpdateValidatorFeeBody,
	isStakeEvent,
	isStakePosition,
	isUnstakeEvent,
	isUnstakePosition,
	type StakeEvent,
	type StakingPosition,
	type UnstakedEvent,
	type UnstakeEvent,
	type UnstakePosition,
	type UnstakeRequestedEvent,
} from "../stakingTypes";

/**
 * Low-level staking adapter for Move commands, complete transaction builders,
 * event types, and staking-position updates.
 *
 * `StakingApi` is created by `AftermathApi.Staking()` and requires the
 * network-specific `addresses.staking` section. The `*Tx` methods mutate a
 * caller-owned `Transaction` and perform no network I/O. The complete builders
 * that start with `fetchBuild` create a new transaction; stake and unstake
 * builders query the coin API to select an input coin. All balance arguments
 * use raw SUI or afSUI units, and decimal percentages are converted to the
 * protocol's 18-decimal fixed-point representation where required.
 *
 * @throws The constructor throws when the supplied `AftermathApi` has no
 * staking addresses. Move calls can return protocol errors such as an inactive
 * validator, an amount below the minimum threshold, an invalid operation cap,
 * or insufficient atomic-unstake reserves.
 */
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

	/** Package and shared-object IDs used by staking commands for this network. */
	public readonly addresses: StakingAddresses;
	/** Fully qualified Move event types for normalized staking events. */
	public readonly eventTypes: {
		/** Type of a liquid-staking event. */
		staked: AnyObjectType;
		/** Type of a queued afSUI-to-SUI unstake event. */
		unstakeRequested: AnyObjectType;
		/** Type of a completed afSUI-to-SUI unstake event. */
		unstaked: AnyObjectType;
		/** Type of an afSUI vault epoch-change event. */
		epochWasChanged: AnyObjectType;
	};
	/** Move coin types used by staking transaction builders. */
	public readonly coinTypes: {
		/** Fully qualified afSUI coin type derived from the configured package. */
		afSui: CoinType;
	};
	/** Move object types used to identify staking-related objects. */
	public readonly objectTypes: {
		/** Unverified validator operation-cap type from the events package. */
		unverifiedValidatorOperationCap: AnyObjectType;
	};
	/** Registered Move abort translations for the staking package. */
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a low-level staking adapter from a configured `AftermathApi`.
	 *
	 * Construction is local and does not query the network. The provider must
	 * include `addresses.staking`, including the liquid-staking package and its
	 * shared objects. Use `AftermathApi.Staking()` to obtain an instance with
	 * the correct address set.
	 *
	 * @param api - Low-level provider containing the Sui client and staking
	 * package and object addresses.
	 * @throws `Error` when `api.addresses.staking` is missing.
	 */
	constructor(private readonly api: AftermathApi) {
		if (!this.api.addresses.staking) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.addresses = this.api.addresses.staking;
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
			unverifiedValidatorOperationCap: `${this.addresses.packages.events}::validator::UnverifiedValidatorOperationCap`,
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
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Staking Transaction Commands
	// =========================================================================

	/**
	 * Adds the liquid-staking Move call that converts a SUI coin to afSUI.
	 *
	 * This method mutates `tx` and performs no network I/O. The default entry
	 * point is `request_stake`; setting `withTransfer` selects
	 * `request_stake_and_keep`. The selected Move call receives the configured
	 * vault, safe, Sui system state, and referral vault objects.
	 *
	 * @param inputs - Transaction, SUI coin argument, destination validator, and
	 * optional alternate entry-point flag. The coin amount is already encoded in
	 * the supplied coin object.
	 * @returns The transaction argument returned by the selected Move call. The
	 * default entry point returns the afSUI coin for a later transfer command.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public stakeTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
		/** SUI coin object or transaction argument to stake. */
		suiCoin: ObjectId | TransactionArgument;
		/** Validator that receives the native stake. */
		validatorAddress: SuiAddress;
		/** Selects the `request_stake_and_keep` Move entry point when `true`. */
		withTransfer?: boolean;
	}) => {
		const { tx, suiCoin, withTransfer } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				`request_stake${withTransfer ? "_and_keep" : ""}`
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
	 * Adds a queued afSUI-to-SUI unstake request to a transaction.
	 *
	 * The protocol processes the request at the next epoch boundary. This method
	 * mutates `tx`, performs no network I/O, and calls `request_unstake`.
	 *
	 * @param inputs - Transaction to mutate and the afSUI coin to provide.
	 * @returns The transaction result returned by the Move call, which represents
	 * the unit-valued request entry point.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public unstakeTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
		/** afSUI coin object or transaction argument to burn or convert. */
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
				typeof afSuiCoin === "string" ? tx.object(afSuiCoin) : afSuiCoin,
			],
		});
	};

	/**
	 * Adds the immediate afSUI-to-SUI atomic-unstake Move call.
	 *
	 * This method mutates `tx` and performs no network I/O. The default entry
	 * point is `request_unstake_atomic`; setting `withTransfer` selects
	 * `request_unstake_atomic_and_keep`. The atomic call can fail with the Move
	 * error `Insufficient Sui Reserves` when the vault lacks enough liquidity.
	 *
	 * @param inputs - Transaction, afSUI coin argument, and optional alternate
	 * entry-point flag. The coin amount is already encoded in the supplied coin.
	 * @returns The transaction argument returned by the selected Move call. The
	 * default entry point returns the SUI coin for a later transfer command.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public atomicUnstakeTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
		/** afSUI coin object or transaction argument to provide. */
		afSuiCoin: ObjectId | TransactionArgument;
		/** Selects the `request_unstake_atomic_and_keep` entry point when `true`. */
		withTransfer?: boolean;
	}) => {
		const { tx, afSuiCoin, withTransfer } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.lsd,
				StakingApi.constants.moduleNames.stakedSuiVault,
				`request_unstake_atomic${withTransfer ? "_and_keep" : ""}`
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.stakedSuiVault), // StakedSuiVault
				tx.object(this.addresses.objects.safe), // Safe
				tx.object(this.addresses.objects.referralVault), // ReferralVault
				tx.object(this.addresses.objects.treasury), // Treasury
				typeof afSuiCoin === "string" ? tx.object(afSuiCoin) : afSuiCoin,
			],
		});
	};

	/**
	 * Adds the Move call that restakes native `StakedSui` objects for afSUI.
	 *
	 * The method creates a Move vector from `stakedSuiIds`, mutates `tx`, and
	 * performs no network I/O. The default entry point is
	 * `request_stake_staked_sui_vec`; `withTransfer: true` selects its
	 * `_and_keep` variant. An empty vector or inactive validator can produce a
	 * Move error.
	 *
	 * @param inputs - Transaction, native staked SUI object IDs, destination
	 * validator, and optional alternate entry-point flag.
	 * @returns The transaction argument returned by the selected Move call. The
	 * default entry point returns the afSUI coin for a later transfer command.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public requestStakeStakedSuiVecTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
		/** Native `StakedSui` object IDs to place in the Move vector. */
		stakedSuiIds: ObjectId[];
		/** Validator that receives the restaked objects. */
		validatorAddress: SuiAddress;
		/** Selects the `_and_keep` Move entry point when `true`. */
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
				`request_stake_staked_sui_vec${withTransfer ? "_and_keep" : ""}`
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

	/**
	 * Adds the afSUI vault's epoch-processing Move call to a transaction.
	 *
	 * This local builder mutates `tx` and performs no network I/O. It calls
	 * `epoch_was_changed` with the configured vault, safe, Sui system state,
	 * referral vault, treasury, and a fixed request batch size of `1000`.
	 *
	 * @param inputs - Transaction to mutate.
	 * @returns The transaction result returned by the Move call.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public epochWasChangedTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
	}) => {
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

	/**
	 * Adds a Move inspection call that reads the afSUI-to-SUI exchange rate.
	 *
	 * The Move call returns a `u128` transaction argument. This method does not
	 * execute the inspection or convert the result to a JavaScript number.
	 *
	 * @param inputs - Transaction to mutate.
	 * @returns The raw transaction argument returned by the Move call. The method
	 * does not decode its protocol-specific rate representation.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public afSuiToSuiExchangeRateTx = (inputs: {
		/** Transaction to mutate. */
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

	/**
	 * Adds a Move inspection call that reads the SUI-to-afSUI exchange rate.
	 *
	 * The Move call returns a `u128` transaction argument. This method does not
	 * execute the inspection or convert the result to a JavaScript number.
	 *
	 * @param inputs - Transaction to mutate.
	 * @returns The raw transaction argument returned by the Move call. The method
	 * does not decode its protocol-specific rate representation.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public suiToAfSuiExchangeRateTx = (inputs: {
		/** Transaction to mutate. */
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

	/**
	 * Adds a Move inspection call that reads the vault's total SUI amount.
	 *
	 * The Move call returns a raw `u64` transaction argument. The method mutates
	 * `tx` and performs no network I/O.
	 *
	 * @param inputs - Transaction to mutate.
	 * @returns The transaction argument containing total SUI in raw units.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public totalSuiAmountTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
	}) => {
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

	/**
	 * Adds a Move inspection call that converts an afSUI amount to its SUI value.
	 *
	 * The call returns a raw `u64` transaction argument. It computes a value and
	 * does not transfer or burn a coin.
	 *
	 * @param inputs - Transaction to mutate and raw afSUI amount to convert.
	 * @returns The transaction argument containing the raw SUI result.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public afSuiToSuiTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
		/** afSUI amount in raw afSUI units. */
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

	/**
	 * Adds a Move inspection call that converts a SUI amount to its afSUI value.
	 *
	 * The call returns a raw `u64` transaction argument. It computes a value and
	 * does not transfer or burn a coin.
	 *
	 * @param inputs - Transaction to mutate and raw SUI amount to convert.
	 * @returns The transaction argument containing the raw afSUI result.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 */
	public suiToAfSuiTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
		/** SUI amount in raw SUI units. */
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

	/**
	 * Adds the Move call that updates a validator's fee.
	 *
	 * This local builder mutates `tx` and performs no network I/O. `newFee` must
	 * be an 18-decimal fixed-point integer. The operation-cap object must
	 * authorize the validator being updated, and the Move contract enforces its
	 * maximum validator fee.
	 *
	 * @param inputs - Transaction, operation-cap object ID, and fixed-point fee.
	 * @returns The transaction result returned by the Move call.
	 * @throws Errors from the Sui transaction builder when an argument is invalid.
	 * The executed transaction can fail with `Invalid Operation Cap` or
	 * `Invalid Validator Fee`.
	 */
	public updateValidatorFeeTx = (inputs: {
		/** Transaction to mutate. */
		tx: Transaction;
		/** Object ID of the validator operation cap. */
		validatorOperationCapId: ObjectId;
		/** New validator fee as an 18-decimal fixed-point integer. */
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
	 * Builds a complete programmable transaction block for liquid staking.
	 *
	 * This builder creates a new transaction, sets `walletAddress` as its sender,
	 * optionally updates the referral vault, fetches a SUI coin through the
	 * configured coin client, optionally transfers the external fee, stakes the
	 * coin, and transfers the returned afSUI to the wallet. It performs coin
	 * selection I/O but does not sign or execute the transaction.
	 *
	 * @param inputs - Wallet, raw SUI amount, validator, and optional referral,
	 * external-fee, and sponsorship settings.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws `Error` when the external fee ratio is not greater than 0 and less
	 * than `0.5`. Coin-selection or Sui-client errors can also reject the promise.
	 */
	public fetchBuildStakeTx = async (
		inputs: ApiStakeBody
	): Promise<Transaction> => {
		const { referrer, externalFee } = inputs;

		if (externalFee) {
			StakingApi.assertValidExternalFee(externalFee);
		}

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		if (referrer) {
			this.api.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});
		}

		const suiCoin = await this.api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: Coin.constants.suiCoinType,
			coinAmount: inputs.suiStakeAmount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		if (externalFee) {
			const feeAmount = BigInt(
				Math.floor(Number(inputs.suiStakeAmount) * externalFee.feePercentage)
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
	 * Builds a complete programmable transaction block for liquid unstaking.
	 *
	 * This builder creates a new transaction, sets `walletAddress` as its sender,
	 * optionally updates the referral vault, fetches an afSUI coin, optionally
	 * transfers the external fee, and selects the atomic or queued Move call from
	 * `isAtomic`. Atomic mode transfers the returned SUI to the wallet. Queued
	 * mode creates an unstake request for the next epoch. The builder performs
	 * coin-selection I/O but does not sign or execute the transaction.
	 *
	 * @param inputs - Wallet, raw afSUI amount, atomic-mode flag, and optional
	 * referral, external-fee, and sponsorship settings.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws `Error` when the external fee ratio is not greater than 0 and less
	 * than `0.5`. Coin-selection or Sui-client errors can also reject the promise.
	 * The executed atomic transaction can fail with `Insufficient Sui Reserves`.
	 */
	public fetchBuildUnstakeTx = async (
		inputs: ApiUnstakeBody
	): Promise<Transaction> => {
		const { referrer, externalFee } = inputs;

		if (externalFee) {
			StakingApi.assertValidExternalFee(externalFee);
		}

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		if (referrer) {
			this.api.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});
		}

		const afSuiCoin = await this.api.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: this.coinTypes.afSui,
			coinAmount: inputs.afSuiUnstakeAmount,
		});

		if (externalFee) {
			const feeAmount = BigInt(
				Math.floor(
					Number(inputs.afSuiUnstakeAmount) * externalFee.feePercentage
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
	 * Builds a complete programmable transaction block for restaking native
	 * `StakedSui` objects.
	 *
	 * The builder creates a new transaction, sets the wallet sender, optionally
	 * updates the referral vault, creates a Move vector from the supplied object
	 * IDs, and transfers the returned afSUI to the wallet. It does not fetch coin
	 * balances, sign the transaction, or execute it. External fees are not added
	 * by this builder.
	 *
	 * @param inputs - Wallet, native staked SUI object IDs, destination validator,
	 * and optional referral and sponsorship settings.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws Sui transaction-builder errors for invalid object arguments. The
	 * executed transaction can fail with `Empty Vector` or an inactive-validator
	 * error.
	 */
	public fetchBuildStakeStakedSuiTx = async (
		inputs: ApiStakeStakedSuiBody
	): Promise<Transaction> => {
		const { referrer } = inputs;

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		if (referrer) {
			this.api.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});
		}

		// TODO: add external fee here
		const afSuiCoinId = this.requestStakeStakedSuiVecTx({
			tx,
			...inputs,
			// withTransfer: true,
		});
		tx.transferObjects([afSuiCoinId], inputs.walletAddress);

		return tx;
	};

	/**
	 * Builds an unsigned transaction that updates a validator fee.
	 *
	 * This local builder creates a transaction, sets its sender, converts the
	 * decimal ratio to an 18-decimal fixed-point integer, and adds
	 * `update_validator_fee`. It performs no network I/O and does not execute the
	 * transaction.
	 *
	 * @param inputs - Wallet sender, operation-cap object ID, new decimal fee
	 * ratio, and optional sponsorship flag.
	 * @returns A promise for an unsigned `Transaction` ready for signing.
	 * @throws Sui transaction-builder errors for invalid arguments. The executed
	 * transaction can fail with `Invalid Operation Cap` or `Invalid Validator Fee`.
	 */
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

	/**
	 * Builds an unsigned transaction that calls `epoch_was_changed` for the afSUI
	 * vault.
	 *
	 * This wrapper creates a transaction, sets `walletAddress` as sender, and
	 * delegates to `epochWasChangedTx`. It performs no network I/O and does not
	 * execute the transaction.
	 *
	 * @param inputs - Wallet address that signs and sends the crank transaction.
	 * @returns An unsigned `Transaction` ready for signing.
	 * @throws Sui transaction-builder errors for invalid arguments.
	 */
	public buildEpochWasChangedTx = Helpers.transactions.createBuildTxFunc(
		this.epochWasChangedTx
	);

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private readonly stakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.staked
		);

	private readonly unstakeRequestedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstakeRequested
		);

	private readonly unstakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			StakingApi.constants.moduleNames.events,
			StakingApi.constants.eventNames.unstaked
		);

	private readonly epochWasChangedEventType = () =>
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

	/**
	 * Applies one normalized staking event to an existing position list.
	 *
	 * This is a local state transition and performs no network I/O. A stake event
	 * is appended as a new stake position. An unstake request is added as
	 * `state: "REQUEST"`, and a matching completion event replaces the request
	 * with `state: "SUI_MINTED"` while retaining the request epoch. Matching uses
	 * `afSuiId`. The returned list is sorted by descending timestamp; an absent
	 * timestamp sorts after timestamped positions.
	 *
	 * @param inputs - Existing positions and one normalized stake or unstake event.
	 * @returns A new position array containing the event's state transition.
	 */
	public static updateStakingPositionsFromEvent = (inputs: {
		/** Existing positions to update. */
		stakingPositions: StakingPosition[];
		/** Normalized stake, queued-unstake, or completed-unstake event. */
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

		return newPositions.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	private static assertValidExternalFee = (externalFee: ExternalFee) => {
		if (
			externalFee.feePercentage >=
			Staking.constants.bounds.maxExternalFeePercentage
		) {
			throw new Error(
				`external fee percentage exceeds max of ${
					Staking.constants.bounds.maxExternalFeePercentage * 100
				}%`
			);
		}
		if (externalFee.feePercentage <= 0) {
			throw new Error("external fee percentage must be greater than 0");
		}
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
				inputs.event.type.includes(this.constants.eventNames.unstakeRequested)
			) {
				return [
					{
						...(inputs.event as UnstakeRequestedEvent),
						state: "REQUEST",
					},
					...inputs.unstakePositions,
				];
			}

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

		let position: UnstakePosition | undefined;
		if (inputs.event.type.includes(this.constants.eventNames.unstaked)) {
			position = {
				...(inputs.event as UnstakedEvent),
				state: "SUI_MINTED",
				epoch: foundStakePosition.epoch,
			};
		}

		if (
			inputs.event.type.includes(this.constants.eventNames.unstakeRequested)
		) {
			position = {
				...(inputs.event as UnstakeRequestedEvent),
				state: "REQUEST",
				epoch: foundStakePosition.epoch,
			};
		}

		if (!position) {
			return inputs.unstakePositions;
		}

		const newStakePositions = [...inputs.unstakePositions];
		newStakePositions[foundPositionIndex] = position;

		return newStakePositions;
	};
}
