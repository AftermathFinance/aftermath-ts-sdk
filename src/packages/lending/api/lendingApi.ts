import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	CoinType,
	ObjectId,
	LendingAddresses,
	SuiAddress,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Sui } from "../../sui";
import {
	ApiBorrowBody,
	ApiCurrentApyBody,
	ApiDepositBody,
	ApiFlashLiquidationBody,
	ApiFlashLiquidationSpecifiedAmountBody,
	ApiLockBody,
	ApiPositionHealthBody,
	ApiRepayBody,
	ApiUnlockBody,
	ApiUtilizationRatioBody,
	ApiWithdrawBody,
	IssuePositionTicketBody,
	PositionTicketObject
} from "../lendingTypes";

export class LendingApi
{
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			events: "events",
		},
		eventNames: {
			publishedMarket: "PublishedMarketEvent",
			depositedProtected: "DepositedProtectedEvent",
			depositedBorrowable: "DepositedBorrowableEvent",
			withdrawnProtected: "WithdrawnProtectedEvent",
			withdrawnBorrowable: "WithdrawnBorrowableEvent",
			withdrawnCollectedFee: "WithdrawnCollectedFeeEvent",
			borrowed: "BorrowedEvent",
			repayed: "RepayedEvent",
			lockedProtected: "LockedProtectedEvent",
			lockedBorrowable: "LockedBorrowableEvent",
			unlockedProtected: "UnlockedProtectedEvent",
			unlockedBorrowable: "UnlockedBorrowableEvent",
			triggeredFlashLiquidation:"TriggeredFlashLiquidationEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		lending: LendingAddresses;
	};

	public readonly eventTypes: {
		publishedMarket: AnyObjectType;
		depositedProtected: AnyObjectType;
		depositedBorrowable: AnyObjectType;
		withdrawnProtected: AnyObjectType;
		withdrawnBorrowable: AnyObjectType;
		withdrawnCollectedFee: AnyObjectType;
		borrowed: AnyObjectType;
		repayed: AnyObjectType;
		lockedProtected: AnyObjectType;
		lockedBorrowable: AnyObjectType;
		unlockedProtected: AnyObjectType;
		unlockedBorrowable: AnyObjectType;
		triggeredFlashLiquidation:AnyObjectType;
	};


	public readonly objectTypes: {
		positionTicket: AnyObjectType;
	};


	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const lending = this.Provider.addresses.lending;

		if (!lending)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			lending,
		};

		this.eventTypes = {
		publishedMarket: this.publishedMarketType(),
		depositedProtected:this.depositedProtectedType(),
		depositedBorrowable: this.depositedBorrowableType(),
		withdrawnProtected: this.withdrawnProtectedType(),
		withdrawnBorrowable: this.withdrawnBorrowableType(),
		withdrawnCollectedFee: this.withdrawnBorrowableType(),
		borrowed: this.borrowedType(),
		repayed: this.repayedType(),
		lockedProtected: this.lockedProtectedType(),
		lockedBorrowable: this.lockedBorrowableType(),
		unlockedProtected: this.unlockedProtectedType(),
		unlockedBorrowable: this.unlockedBorrowableType(),
		triggeredFlashLiquidation: this.triggeredFlashLiquidationType(),
		};
		this.objectTypes = {
			positionTicket:
				`${lending.packages.lending}::position_ticket::PositionTicket`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchOwnedPositionTickets = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<PositionTicketObject[]> => {
		const { walletAddress } = inputs;

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.positionTicket,
			objectFromSuiObjectResponse:
				Casting.lending
					.positionTicketObjectFromSuiObjectResponse,
		});
	};
	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Position Ticket Transaction Commands
	// =========================================================================

	public issuePositionTicketTx = (inputs: {
		tx: TransactionBlock;
		withTransfer?: boolean;
	}) => {
		const { tx, withTransfer } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"issue_position_ticket" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [],
			arguments: [],
		});
	}

	// =========================================================================
	//  Depositing Transaction Commands
	// =========================================================================

	public depositProtectedTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		pTokenCoinType: CoinType;
		bTokenCoinType: CoinType;
		coin: ObjectId | TransactionArgument;
		isProtected: boolean;
		withTransfer?: boolean;
	}) => {
		const {
			tx, collateralCoinType, pTokenCoinType,
			bTokenCoinType, coin, isProtected, withTransfer,
		} = inputs;
		const method_name =
			isProtected ? "deposit_protected" : "deposit_borrowable"
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				method_name + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [
				collateralCoinType,
				pTokenCoinType,
				bTokenCoinType,
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof coin === "string" ? tx.object(coin) : coin, // Coin
			],
		});
	}

	// =========================================================================
	//  Withdraw Transaction Commands
	// =========================================================================

	public withdrawTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		pTokenCoinType: CoinType;
		bTokenCoinType: CoinType;
		token: ObjectId | TransactionArgument;
		isProtected: boolean;
		withTransfer?: boolean;
	}) => {
		const {
			tx, collateralCoinType, pTokenCoinType,
			bTokenCoinType, token, isProtected, withTransfer,
		} = inputs;
		const method_name =
			isProtected ? "withdraw_protected" : "withdraw_borrowable"
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				method_name + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [
				collateralCoinType,
				pTokenCoinType,
				bTokenCoinType,
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof token === "string" ? tx.object(token) : token, // Token
			],
		});
	}

	// =========================================================================
	//  Lock Transaction Commands
	// =========================================================================

	public lockTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		pTokenCoinType: CoinType;
		bTokenCoinType: CoinType;
		token: ObjectId | TransactionArgument;
		positionTicket: ObjectId;
		isProtected: boolean;
	}) => {
		const {
			tx, collateralCoinType, pTokenCoinType,
			bTokenCoinType, token, positionTicket, isProtected
		} = inputs;

		const method_name =
			isProtected ? "lock_protected" : "lock_borrowable"

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				method_name,
			),
			typeArguments: [
				collateralCoinType,
				pTokenCoinType,
				bTokenCoinType,
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(positionTicket), // PositionTicket
				typeof token === "string" ? tx.object(token) : token, // Token
			],
		});
	}

	// =========================================================================
	//  Unlock Transaction Commands
	// =========================================================================

	public unlockTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		pTokenCoinType: CoinType;
		bTokenCoinType: CoinType;
		positionTicket: ObjectId;
		amount: Balance;
		isProtected: boolean;
		withTransfer?: boolean;
	}) => {
		const {
			tx, collateralCoinType, pTokenCoinType,	bTokenCoinType,
			positionTicket, amount, isProtected, withTransfer
		} = inputs;
		const method_name =
			isProtected ? "unlock_protected" : "unlock_borrowable"
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				method_name + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [
				collateralCoinType,
				pTokenCoinType,
				bTokenCoinType,
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(this.addresses.lending.objects.Oracle), // Oracle
				tx.object(positionTicket), // PositionTicket
				tx.object(amount), // Unlocked amount
			],
		});
	}

	// =========================================================================
	//  Borrow / Repay Transaction Commands
	// =========================================================================

	public borrowTx = (inputs: {
		tx: TransactionBlock;
		borrowCoinType: CoinType;
		pTokenCoinType: CoinType;
		bTokenCoinType: CoinType;
		positionTicket: ObjectId;
		amount: Balance,
		withTransfer?: boolean;
	}) => {
		const {
			tx, borrowCoinType, pTokenCoinType,	bTokenCoinType,
			positionTicket, amount, withTransfer
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"borrow" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [
				borrowCoinType,
				pTokenCoinType,
				bTokenCoinType,
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(this.addresses.lending.objects.Oracle), // Oracle
				tx.object(positionTicket), // PositionTicket
				tx.object(amount), // Borrowed amount
			],
		});
	}

	public repayTx = (inputs: {
		tx: TransactionBlock;
		repayCoinType: CoinType;
		pTokenCoinType: CoinType;
		bTokenCoinType: CoinType;
		positionToRepayId: ObjectId;
		coin: CoinType,
	}) => {
		const {
			tx, repayCoinType, pTokenCoinType,	bTokenCoinType,
			positionToRepayId, coin
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"repay"
			),
			typeArguments: [
				repayCoinType,
				pTokenCoinType,
				bTokenCoinType,
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(positionToRepayId), // Id of repayed position
				typeof coin === "string" ? tx.object(coin) : coin, // Coin
			],
		});
	}

	// =========================================================================
	//  Liquidation Transaction Commands
	// =========================================================================

	public flashLiquidationSpecifiedAmountTx = (inputs: {
		tx: TransactionBlock;
		debtCoinType: CoinType;
		pTokenDebtCoinType: CoinType;
		bTokenDebtCoinType: CoinType;
		collateralRepayCoinType: CoinType;
		liquidatorPositionTicket: ObjectId;
		borrowerPositionId: ObjectId;
		liquidityAmount: Balance;
	}) => {
		const {
			tx, debtCoinType, pTokenDebtCoinType,bTokenDebtCoinType,
			collateralRepayCoinType, liquidatorPositionTicket,
			borrowerPositionId, liquidityAmount,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"flash_liquidation_specified_amount"
			),
			typeArguments: [
				debtCoinType,
				pTokenDebtCoinType,
				bTokenDebtCoinType,
				collateralRepayCoinType
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(this.addresses.lending.objects.Oracle), // Oracle
				tx.object(liquidatorPositionTicket), // Position Ticket of liquidator
				tx.object(borrowerPositionId), //Id of position be liquidated.
				tx.object(liquidityAmount), // Amount to liquidate
			],
		});
	}

	public flashLiquidationTx = (inputs: {
		tx: TransactionBlock;
		debtCoinType: CoinType;
		pTokenDebtCoinType: CoinType;
		bTokenDebtCoinType: CoinType;
		collateralRepayCoinType: CoinType;
		liquidatorPositionTicket: ObjectId;
		borrowerPositionId: ObjectId;
	}) => {
		const {
			tx, debtCoinType, pTokenDebtCoinType,bTokenDebtCoinType,
			collateralRepayCoinType, liquidatorPositionTicket, borrowerPositionId,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"flash_liquidation"
			),
			typeArguments: [
				debtCoinType,
				pTokenDebtCoinType,
				bTokenDebtCoinType,
				collateralRepayCoinType
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(this.addresses.lending.objects.Oracle), // Oracle
				tx.object(liquidatorPositionTicket), // Position Ticket of liquidator
				tx.object(borrowerPositionId), //Id of position be liquidated.
			],
		});
	}

	// =========================================================================
	//  Inspection Transaction Commands
	// =========================================================================

	public positionHealthTx = (inputs: {
		tx: TransactionBlock;
		positionId: ObjectId;
	}) => {
		const { tx, positionId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"position_health"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(this.addresses.lending.objects.Oracle), // Oracle
				tx.object(positionId), //Id of position
			],
		});
	}

	public utilizationRatioTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
	}) => {
		const { tx, collateralCoinType} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"utilization_ratio"
			),
			typeArguments: [
				collateralCoinType
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
			],
		});
	}

	public currentApyTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
	}) => {
		const { tx, collateralCoinType} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.lending.packages.lending,
				LendingApi.constants.moduleNames.interface,
				"utilization_ratio"
			),
			typeArguments: [
				collateralCoinType
			],
			arguments: [
				tx.object(this.addresses.lending.objects.Market), // Market
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	}

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchIssuePositionTicket = async (
		inputs: IssuePositionTicketBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.issuePositionTicketTx({ tx })

		return tx;
	};

	public fetchBuildDepositTx = async (
		inputs: ApiDepositBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const coin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: inputs.collateralCoinType,
			coinAmount: inputs.depositedAmount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		const tokenId = this.depositProtectedTx({ tx, ...inputs, coin });
		tx.transferObjects([tokenId], tx.pure(inputs.walletAddress));
		return tx;
	};

	public fetchBuildWithdrawTx = async (
		inputs: ApiWithdrawBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const coinType =
			inputs.isProtected ? inputs.pTokenCoinType : inputs.bTokenCoinType;
		const token = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: coinType,
			coinAmount: inputs.withdrawnAmount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		const coinId = this.withdrawTx({ tx, ...inputs, token });
		tx.transferObjects([coinId], tx.pure(inputs.walletAddress));
		return tx;
	};

	public fetchBuildLockTx = async (
		inputs: ApiLockBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const coinType =
			inputs.isProtected ? inputs.pTokenCoinType : inputs.bTokenCoinType;
		const token = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: coinType,
			coinAmount: inputs.lockedAmount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		this.lockTx({ tx, ...inputs, token });
		return tx;
	};

	public fetchBuildUnlockTx = async (
		inputs: ApiUnlockBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.unlockTx({ tx, ...inputs});
		return tx;
	};

	public fetchBuildBorrowTx = async (
		inputs: ApiBorrowBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.borrowTx({ tx, ...inputs});
		return tx;
	};

	public fetchBuildRepayTx = async (
		inputs: ApiRepayBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const coin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: inputs.repayCoinType,
			coinAmount: inputs.amount,
			isSponsoredTx: inputs.isSponsoredTx,
		});

		const tokenId = this.repayTx({ tx, ...inputs, coin });
		tx.transferObjects([tokenId], tx.pure(inputs.walletAddress));
		return tx;
	};

	public fetchBuildFlashLIquidationSpecifiedAmountTx = async (
		inputs: ApiFlashLiquidationSpecifiedAmountBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.flashLiquidationSpecifiedAmountTx({ tx, ...inputs });
		return tx;
	};

	public fetchBuildFlashLIquidationTx = async (
		inputs: ApiFlashLiquidationBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.flashLiquidationTx({ tx, ...inputs });
		return tx;
	};

	public fetchBuildPositionHealthTx = async (
		inputs: ApiPositionHealthBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.positionHealthTx({ tx, ...inputs });
		return tx;
	};

	public fetchBuildUtilizationRatioTx = async (
		inputs: ApiUtilizationRatioBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.utilizationRatioTx({ tx, ...inputs });
		return tx;
	};

	public fetchBuildCurrentApyTx = async (
		inputs: ApiCurrentApyBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);
		this.currentApyTx({ tx, ...inputs });
		return tx;
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private publishedMarketType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.publishedMarket
		);

	private  depositedProtectedType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.depositedProtected
		);

	private  depositedBorrowableType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.depositedBorrowable
		);

	private  withdrawnProtectedType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.withdrawnProtected
		);

	private  withdrawnBorrowableType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.withdrawnBorrowable
		);

	private  borrowedType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.borrowed
		);

	private repayedType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.repayed
		);

	private lockedProtectedType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.lockedProtected,
		);

	private lockedBorrowableType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.lockedBorrowable,
		);

	private unlockedProtectedType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.unlockedProtected,
		);

	private unlockedBorrowableType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.unlockedBorrowable,
		);

	private triggeredFlashLiquidationType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.lending.packages.events,
			LendingApi.constants.moduleNames.events,
			LendingApi.constants.eventNames.triggeredFlashLiquidation,
		);
	}