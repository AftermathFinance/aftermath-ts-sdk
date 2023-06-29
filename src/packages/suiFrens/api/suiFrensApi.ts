import {
	ObjectId,
	SuiAddress,
	SuiObjectInfo,
	TransactionArgument,
	TransactionBlock,
	bcs,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	MixSuiFrensEvent,
	SuiFrenObject,
	SuiFrenStats,
	SuiFrenVaultStateV1Object,
	StakeSuiFrenEvent,
	UnstakeSuiFrenEvent,
	SuiFrenAttributes,
	SuiFrensSortOption,
	SuiFrenAccessoryObject,
	StakedSuiFrenInfo,
	SuiFrenAccessoryType,
	ApiMixSuiFrensBody,
	ApiRemoveSuiFrenAccessoryBody,
	ApiAddSuiFrenAccessoryBody,
	HarvestFeesEvent,
	StakedSuiFrenMetadataV1Object,
	PartialSuiFrenObject,
} from "../suiFrensTypes";
import {
	HarvestFeesEventOnChain,
	MixSuiFrensEventOnChain,
	StakeSuiFrenEventOnChain,
	UnstakeSuiFrenEventOnChain,
} from "./suiFrensApiCastingTypes";
import { AmountInCoinAndUsd, CoinDecimal } from "../../coin/coinTypes";
import { Coin } from "../../coin/coin";
import { Helpers } from "../../../general/utils/helpers";
import {
	AnyObjectType,
	Balance,
	SuiFrensAddresses,
	DynamicFieldObjectsWithCursor,
	DynamicFieldsInputs,
	EventsInputs,
} from "../../../types";
import { Casting } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Sui } from "../../sui/sui";
import { BCS } from "@mysten/bcs";

export class SuiFrensApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			suiFrens: {
				suiFrens: "suifrens",
			},
			accessories: {
				accessories: "accessories",
			},
			capyLabs: {
				capyLabs: "capy_labs",
			},
			suiFrensVault: {
				vault: "vault",
				vaultState: "vault_state",
				events: "events",
				stakedPosition: "staked_position",
			},
			suiFrensVaultCapyLabsExtension: {
				capyLabs: "capy_labs",
			},
		},

		eventNames: {
			suiFrensVault: {
				mixSuiFrens: "MixedSuiFrenEvent",
				stakeSuiFren: "StakedSuiFrenEvent",
				unstakeSuiFren: "UnstakedSuiFrenEvent",
				harvestFees: "HarvestedFeesEvent",
			},
		},

		dynamicFieldKeys: {
			suiFrens: {
				mixLimit: "MixLimitKey",
				lastEpochMixed: "LastEpochMixedKey",
			},
			accessories: {
				accessory: "AccessoryKey",
			},
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: SuiFrensAddresses;

	public readonly objectTypes: {
		suiFren: AnyObjectType;
		capy: AnyObjectType;
		suiFrenAccessory: AnyObjectType;
		stakedSuiFrenPosition: AnyObjectType;
	};

	public readonly eventTypes: {
		harvestFees: AnyObjectType;
		mixSuiFrens: AnyObjectType;
		stakeSuiFren: AnyObjectType;
		unstakeSuiFren: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.suiFrens;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;

		this.objectTypes = {
			suiFren: `${addresses.packages.suiFrens}::${SuiFrensApi.constants.moduleNames.suiFrens.suiFrens}::SuiFren`,
			capy: `${addresses.packages.suiFrens}::capy::Capy`,
			suiFrenAccessory: `${addresses.packages.accessories}::${SuiFrensApi.constants.moduleNames.accessories.accessories}::Accessory`,
			stakedSuiFrenPosition: `${addresses.packages.suiFrensVault}::${SuiFrensApi.constants.moduleNames.suiFrensVault.stakedPosition}::StakedPosition`,
		};

		this.eventTypes = {
			harvestFees: this.harvestFeesEventType(),
			mixSuiFrens: this.mixSuiFrensEventType(),
			stakeSuiFren: this.stakeSuiFrenEventType(),
			unstakeSuiFren: this.unstakeSuiFrenEventType(),
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchMixingLimit = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		const tx = new TransactionBlock();

		this.mixingLimitTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		const unwrapped = Casting.unwrapDeserializedOption(
			bcs.de("Option<u8>", new Uint8Array(bytes))
		);
		return unwrapped === undefined ? undefined : BigInt(unwrapped);
	};

	public fetchLastEpochMixed = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		const tx = new TransactionBlock();

		this.lastEpochMixedTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		const unwrapped = Casting.unwrapDeserializedOption(
			bcs.de("Option<u64>", new Uint8Array(bytes))
		);
		return unwrapped === undefined ? undefined : BigInt(unwrapped);
	};

	public fetchIsSuiFrenPackageOnChain = () =>
		this.Provider.Objects().fetchDoesObjectExist(
			this.addresses.packages.suiFrens
		);

	public fetchStakedSuiFrensDynamicFieldsWithFilters = async (inputs: {
		attributes: Partial<SuiFrenAttributes>;
		sortBy?: SuiFrensSortOption;
		limit?: number;
		limitStepSize?: number;
		cursor?: ObjectId;
	}): Promise<DynamicFieldObjectsWithCursor<StakedSuiFrenInfo>> => {
		const { attributes } = inputs;
		const defaultLimit = 25;
		const limit = inputs.limit ?? defaultLimit;

		const isComplete = (data: StakedSuiFrenInfo[]) => {
			return (
				this.filterSuiFrensWithAttributes({
					suiFrens: data.map((info) => info.suiFren),
					attributes,
				}).length >= limit
			);
		};

		const suiFrensWithCursor =
			await this.Provider.DynamicFields().fetchDynamicFieldsUntil({
				...inputs,
				fetchFunc: this.fetchPartialStakedSuiFrensDynamicFields,
				isComplete,
			});

		const filteredSuiFrens = this.filterSuiFrensWithAttributes({
			suiFrens: suiFrensWithCursor.dynamicFieldObjects.map(
				(data) => data.suiFren
			),
			attributes,
		});
		const dynamicFieldObjects =
			suiFrensWithCursor.dynamicFieldObjects.filter((data) =>
				filteredSuiFrens
					.slice(0, limit)
					.some(
						(suiFren) => suiFren.objectId === data.suiFren.objectId
					)
			);

		const resizedSuiFrensWithCursor = {
			nextCursor:
				suiFrensWithCursor.nextCursor ?? limit < filteredSuiFrens.length
					? filteredSuiFrens[limit].objectId
					: suiFrensWithCursor.nextCursor,
			dynamicFieldObjects,
		};
		return resizedSuiFrensWithCursor;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchHarvestFeesEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			HarvestFeesEventOnChain,
			HarvestFeesEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.harvestFees,
			},
			eventFromEventOnChain: Casting.suiFrens.harvestFeesEventFromOnChain,
		});

	public fetchMixSuiFrensEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			MixSuiFrensEventOnChain,
			MixSuiFrensEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.mixSuiFrens,
			},
			eventFromEventOnChain: Casting.suiFrens.mixSuiFrensEventFromOnChain,
		});

	public fetchStakeSuiFrenEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			StakeSuiFrenEventOnChain,
			StakeSuiFrenEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.stakeSuiFren,
			},
			eventFromEventOnChain:
				Casting.suiFrens.stakeSuiFrenEventFromOnChain,
		});

	public fetchUnstakeSuiFrenEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			UnstakeSuiFrenEventOnChain,
			UnstakeSuiFrenEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.unstakeSuiFren,
			},
			eventFromEventOnChain:
				Casting.suiFrens.unstakeSuiFrenEventFromOnChain,
		});

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  CapyLabsApp Object
	// =========================================================================

	public fetchCapyLabsApp = async () => {
		return this.Provider.Objects().fetchCastObject({
			objectId: this.addresses.objects.capyLabsApp,
			objectFromSuiObjectResponse:
				Casting.suiFrens.capyLabsAppObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  SuiFren Objects
	// =========================================================================

	public fetchSuiFrens = async (inputs: {
		suiFrenIds: ObjectId[];
	}): Promise<SuiFrenObject[]> => {
		const { suiFrenIds } = inputs;

		const partialSuiFrens =
			await this.Provider.Objects().fetchCastObjectBatch({
				objectIds: suiFrenIds,
				objectFromSuiObjectResponse:
					Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
				options: {
					showDisplay: true,
					showType: true,
				},
			});

		return this.fetchCompletePartialSuiFrenObjects({ partialSuiFrens });
	};

	public fetchOwnedSuiFrens = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<SuiFrenObject[]> => {
		const { walletAddress } = inputs;

		const partialSuiFrens =
			await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.suiFren,
				objectFromSuiObjectResponse:
					Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
				withDisplay: true,
			});

		return this.fetchCompletePartialSuiFrenObjects({ partialSuiFrens });
	};

	public fetchStakedSuiFrens = async (inputs: {
		stakedSuiFrenIds: ObjectId[];
	}): Promise<StakedSuiFrenInfo[]> => {
		const { stakedSuiFrenIds } = inputs;

		const stakedSuiFrenData =
			await this.Provider.Objects().fetchCastObjectBatch({
				objectIds: stakedSuiFrenIds,
				objectFromSuiObjectResponse:
					Casting.suiFrens
						.partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse,
				options: {
					showDisplay: true,
					showType: true,
				},
			});
		const suiFrens = await this.fetchCompletePartialSuiFrenObjects({
			partialSuiFrens: stakedSuiFrenData.map(
				(data) => data.partialSuiFren
			),
		});

		return suiFrens.map((suiFren, index) => ({
			suiFren,
			metadata: stakedSuiFrenData[index].stakedSuiFrenMetadata,
		}));
	};

	public fetchPartialStakedSuiFrensDynamicFields = async (
		inputs: DynamicFieldsInputs
	) => {
		const suiFrenVaultStateId = this.addresses.objects.suiFrensVaultState;
		const suiFrenType = this.objectTypes.suiFren;

		return await this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				...inputs,
				parentObjectId: suiFrenVaultStateId,
				objectsFromObjectIds: (stakedSuiFrenIds) =>
					this.fetchStakedSuiFrens({ stakedSuiFrenIds }),
				dynamicFieldType: suiFrenType,
			}
		);
	};

	// =========================================================================
	//  Accessories
	// =========================================================================

	public fetchAccessoriesForSuiFren = async (inputs: {
		suiFrenId: ObjectId;
	}) => {
		return await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
			{
				parentObjectId: inputs.suiFrenId,
				objectsFromObjectIds: (objectIds) =>
					this.fetchAccessories({ objectIds }),
				dynamicFieldType:
					SuiFrensApi.constants.dynamicFieldKeys.accessories
						.accessory,
			}
		);
	};

	public fetchOwnedAccessories = async (inputs: {
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;
		return await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
			{
				walletAddress,
				objectType: this.objectTypes.suiFrenAccessory,
				objectFromSuiObjectResponse:
					Casting.suiFrens.accessoryObjectFromSuiObjectResponse,
				withDisplay: true,
			}
		);
	};

	public fetchAccessories = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<SuiFrenAccessoryObject[]> => {
		const { objectIds } = inputs;
		return this.Provider.Objects().fetchCastObjectBatch({
			objectIds,
			objectFromSuiObjectResponse:
				Casting.suiFrens.accessoryObjectFromSuiObjectResponse,
			options: {
				showDisplay: true,
				showType: true,
			},
		});
	};

	// =========================================================================
	//  Staked SuiFren Objects
	// =========================================================================

	public fetchOwnedStakedSuiFrens = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakedSuiFrenInfo[]> => {
		const { walletAddress } = inputs;

		const stakedPositions =
			await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.stakedSuiFrenPosition,
				objectFromSuiObjectResponse:
					Casting.suiFrens.stakedSuiFrenPositionFromSuiObjectResponse,
			});
		const stakedSuiFrens = await this.fetchStakedSuiFrens({
			stakedSuiFrenIds: stakedPositions.map(
				(position) => position.suiFrenMetadataId
			),
		});
		return stakedSuiFrens.map((data, index) => ({
			...data,
			position: stakedPositions[index],
		}));
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	public mixingLimitTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}) /* Option<u8> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrens,
				SuiFrensApi.constants.moduleNames.capyLabs.capyLabs,
				"mixing_limit"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(inputs.suiFrenId), // SuiFren
			],
		});
	};

	public lastEpochMixedTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}) /* Option<u64> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrens,
				SuiFrensApi.constants.moduleNames.capyLabs.capyLabs,
				"last_epoch_mixed"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(inputs.suiFrenId), // SuiFren
			],
		});
	};

	// =========================================================================
	//  Mixing Transaction Commands
	// =========================================================================

	public mixAndKeepTx = (inputs: {
		tx: TransactionBlock;
		parentOneId: ObjectId;
		parentTwoId: ObjectId;
		suiPaymentCoinId: ObjectId | TransactionArgument;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx, suiPaymentCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVaultCapyLabsExtension,
				SuiFrensApi.constants.moduleNames.suiFrensVaultCapyLabsExtension
					.capyLabs,
				"mix_and_keep"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(
					this.addresses.objects.suiFrensVaultCapyLabsExtension
				), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.capyLabsApp), // CapyLabsApp

				tx.object(inputs.parentOneId), // SuiFren
				tx.object(inputs.parentTwoId), // SuiFren
				typeof suiPaymentCoinId === "string"
					? tx.object(suiPaymentCoinId)
					: suiPaymentCoinId, // Coin

				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public mixWithStakedAndKeepTx = (inputs: {
		tx: TransactionBlock;
		nonStakedParentId: ObjectId;
		stakedParentId: ObjectId;
		suiPaymentCoinId: ObjectId | TransactionArgument;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx, suiPaymentCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVaultCapyLabsExtension,
				SuiFrensApi.constants.moduleNames.suiFrensVaultCapyLabsExtension
					.capyLabs,
				"mix_with_staked_and_keep"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(
					this.addresses.objects.suiFrensVaultCapyLabsExtension
				), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.capyLabsApp), // CapyLabsApp
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault

				tx.object(inputs.nonStakedParentId), // SuiFren
				tx.object(inputs.stakedParentId), // SuiFren
				typeof suiPaymentCoinId === "string"
					? tx.object(suiPaymentCoinId)
					: suiPaymentCoinId, // Coin

				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public mixStakedWithStakedAndKeepTx = (inputs: {
		tx: TransactionBlock;
		parentOneId: ObjectId;
		parentTwoId: ObjectId;
		suiPaymentCoinId: ObjectId | TransactionArgument;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx, suiPaymentCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVaultCapyLabsExtension,
				SuiFrensApi.constants.moduleNames.suiFrensVaultCapyLabsExtension
					.capyLabs,
				"mix_staked_with_staked_and_keep"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(
					this.addresses.objects.suiFrensVaultCapyLabsExtension
				), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.capyLabsApp), // CapyLabsApp
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault

				tx.object(inputs.parentOneId), // SuiFren
				tx.object(inputs.parentTwoId), // SuiFren
				typeof suiPaymentCoinId === "string"
					? tx.object(suiPaymentCoinId)
					: suiPaymentCoinId, // Coin

				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Staking Transaction Commands
	// =========================================================================

	public stakeAndKeepTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		autoStakeFees: boolean;
		baseFee: Balance;
		feeIncrementPerMix: Balance;
		minRemainingMixesToKeep: bigint;
		suiFrenType: AnyObjectType;
	}) /* (StakedPosition) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVaultCapyLabsExtension,
				SuiFrensApi.constants.moduleNames.suiFrensVaultCapyLabsExtension
					.capyLabs,
				"stake_and_keep"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(
					this.addresses.objects.suiFrensVaultCapyLabsExtension
				), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.capyLabsApp), // CapyLabsApp
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.object(inputs.suiFrenId), // SuiFren

				tx.pure(inputs.autoStakeFees, "bool"),
				tx.pure(inputs.baseFee, "u64"),
				tx.pure(inputs.feeIncrementPerMix, "u64"),
				tx.pure(inputs.minRemainingMixesToKeep, "u8"),
			],
		});
	};

	public unstakeAndKeepTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVaultCapyLabsExtension,
				SuiFrensApi.constants.moduleNames.suiFrensVaultCapyLabsExtension
					.capyLabs,
				"unstake_and_keep"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(
					this.addresses.objects.suiFrensVaultCapyLabsExtension
				), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.object(inputs.suiFrenId), // SuiFren
			],
		});
	};

	// =========================================================================
	//  Fee Harvest Transaction Commands
	// =========================================================================

	public beginHarvestTx = (inputs: {
		tx: TransactionBlock;
	}) /* (HarvestedFeesEventMetadata) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"begin_harvest"
			),
			typeArguments: [],
			arguments: [],
		});
	};

	public harvestTx = (inputs: {
		tx: TransactionBlock;
		stakedPositionId: ObjectId;
		harvestFeesEventMetadataId: ObjectId | TransactionArgument;
	}) /* (Coin) */ => {
		const { tx, harvestFeesEventMetadataId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"harvest"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.object(inputs.stakedPositionId), // StakedPosition
				typeof harvestFeesEventMetadataId === "string"
					? tx.object(harvestFeesEventMetadataId)
					: harvestFeesEventMetadataId, // HarvestedFeesEventMetadata
			],
		});
	};

	public endHarvestTx = (inputs: {
		tx: TransactionBlock;
		harvestFeesEventMetadataId: ObjectId | TransactionArgument;
	}) => {
		const { tx, harvestFeesEventMetadataId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"end_harvest"
			),
			typeArguments: [],
			arguments: [
				typeof harvestFeesEventMetadataId === "string"
					? tx.object(harvestFeesEventMetadataId)
					: harvestFeesEventMetadataId, // HarvestedFeesEventMetadata
			],
		});
	};

	// =========================================================================
	//  Accessory Transaction Commands
	// =========================================================================

	public addAccessoryTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		accessoryId: ObjectId;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"add_accessory"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.object(inputs.suiFrenId), // suifren_id
				tx.object(inputs.accessoryId), // Accessory
			],
		});
	};

	public addAccessoryToOwnedSuiFrenTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		accessoryId: ObjectId;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"add_accessory_to_owned_suifren"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(inputs.suiFrenId), // suifren_id
				tx.object(inputs.accessoryId), // Accessory
			],
		});
	};

	public removeAccessoryAndKeepTx = (inputs: {
		tx: TransactionBlock;
		stakedPositionId: ObjectId;
		accessoryType: SuiFrenAccessoryType;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"remove_accessory_and_keep"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.accessoryType), // String
			],
		});
	};

	public removeAccessoryFromOwnedSuiFrenAndKeepTx = (inputs: {
		tx: TransactionBlock;
		suiFrenId: ObjectId;
		accessoryType: SuiFrenAccessoryType;
		suiFrenType: AnyObjectType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"remove_accessory_from_owned_suifren_and_keep"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(inputs.suiFrenId), // SuiFren
				tx.object(inputs.accessoryType), // String
			],
		});
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	public fetchStakeTx = Helpers.transactions.creatBuildTxFunc(
		(inputs: {
			tx: TransactionBlock;
			suiFrenId: ObjectId;
			baseFee: Balance;
			feeIncrementPerMix: Balance;
			minRemainingMixesToKeep: bigint;
			suiFrenType: AnyObjectType;
		}) => this.stakeAndKeepTx({ ...inputs, autoStakeFees: true })
	);

	public fetchUnstakeTx = Helpers.transactions.creatBuildTxFunc(
		this.unstakeAndKeepTx
	);

	// =========================================================================
	//  Mixing Transactions
	// =========================================================================

	public fetchBuildMixTx = async (
		inputs: ApiMixSuiFrensBody
	): Promise<TransactionBlock> => {
		const {
			walletAddress,
			suiFrenParentOne,
			suiFrenParentTwo,
			totalFee,
			suiFrenType,
		} = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const suiPaymentCoinId =
			await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: Coin.constants.suiCoinType,
				coinAmount: totalFee,
			});

		const isParentOneStaked = suiFrenParentOne.isStaked;
		const isParentTwoStaked = suiFrenParentTwo.isStaked;

		const parentOneId = suiFrenParentOne.objectId;
		const parentTwoId = suiFrenParentTwo.objectId;

		if (isParentOneStaked && isParentTwoStaked) {
			// both staked
			this.mixStakedWithStakedAndKeepTx({
				tx,
				parentOneId,
				parentTwoId,
				suiPaymentCoinId,
				suiFrenType,
			});
		} else if (!isParentOneStaked && !isParentTwoStaked) {
			// neither staked
			this.mixAndKeepTx({
				tx,
				parentOneId,
				parentTwoId,
				suiPaymentCoinId,
				suiFrenType,
			});
		} else {
			// only one staked
			const [nonStakedParentId, stakedParentId] = isParentOneStaked
				? [parentTwoId, parentOneId]
				: [parentOneId, parentTwoId];

			this.mixWithStakedAndKeepTx({
				tx,
				nonStakedParentId,
				stakedParentId,
				suiPaymentCoinId,
				suiFrenType,
			});
		}

		return tx;
	};

	// =========================================================================
	//  Fee Harvesting Transactions
	// =========================================================================

	public fetchBuildHarvestFeesTx = async (inputs: {
		walletAddress: SuiAddress;
		stakedPositionIds: ObjectId[];
	}): Promise<TransactionBlock> => {
		const { stakedPositionIds } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const harvestFeesEventMetadataId = this.beginHarvestTx({ tx });

		let harvestedCoins = [];
		for (const stakedPositionId of stakedPositionIds) {
			const harvestedCoin = this.harvestTx({
				tx,
				stakedPositionId,
				harvestFeesEventMetadataId,
			});
			harvestedCoins.push(harvestedCoin);
		}

		// TODO: move this merging & transferring behaviour to coins api helpers ?
		const coinToTransfer = harvestedCoins[0];

		if (harvestedCoins.length > 1)
			tx.mergeCoins(coinToTransfer, harvestedCoins.slice(1));

		tx.transferObjects([coinToTransfer], tx.pure(inputs.walletAddress));

		this.endHarvestTx({ tx, harvestFeesEventMetadataId });

		return tx;
	};

	// =========================================================================
	//  Accessory Transactions
	// =========================================================================

	public fetchBuildAddAccessoryTx = (inputs: ApiAddSuiFrenAccessoryBody) => {
		if (inputs.isOwned) {
			return Helpers.transactions.creatBuildTxFunc(
				this.addAccessoryToOwnedSuiFrenTx
			)(inputs);
		}
		return Helpers.transactions.creatBuildTxFunc(this.addAccessoryTx)(
			inputs
		);
	};

	public fetchBuildRemoveAccessoryTx = (
		inputs: ApiRemoveSuiFrenAccessoryBody
	) => {
		if ("suiFrenId" in inputs) {
			return Helpers.transactions.creatBuildTxFunc(
				this.removeAccessoryFromOwnedSuiFrenAndKeepTx
			)(inputs);
		}
		return Helpers.transactions.creatBuildTxFunc(
			this.removeAccessoryAndKeepTx
		)(inputs);
	};

	// =========================================================================
	//  Stats
	// =========================================================================

	// TODO: make this function not exported from sdk (only internal use)
	// NOTE: this calculation will be  incorrect if feeCoinType is different for each fee
	public calcSuiFrenMixingFees = (
		mixSuiFrenEvents: MixSuiFrensEvent[],
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	): AmountInCoinAndUsd => {
		throw new Error("TODO");

		// const mixingFeesInFeeCoin = Helpers.sum(
		// 	mixSuiFrenEvents.map((event) =>
		// 		Coin.balanceWithDecimals(
		// 			event.feeCoinWithBalance.balance,
		// 			feeCoinDecimals
		// 		)
		// 	)
		// );

		// const mixingFeesUsd = feeCoinPrice * mixingFeesInFeeCoin;
		// return {
		// 	amount: mixingFeesInFeeCoin,
		// 	amountUsd: mixingFeesUsd,
		// };
	};

	public fetchSuiFrenStats = async (): Promise<SuiFrenStats> => {
		throw new Error("TODO");

		// const mixSuiFrenEventsWithinTime =
		// 	await this.Provider.Events().fetchEventsWithinTime({
		// 		fetchEventsFunc: this.fetchMixSuiFrensEvents,
		// 		timeUnit: "hour",
		// 		time: 24,
		// 	});

		// const feeCoin =
		// 	mixSuiFrenEventsWithinTime.length === 0
		// 		? SuiFrens.constants.mixingFeeCoinType
		// 		: mixSuiFrenEventsWithinTime[0].feeCoinWithBalance.coin;
		// const feeCoinDecimals = (
		// 	await this.Provider.Coin().fetchCoinMetadata(feeCoin)
		// ).decimals;
		// const feeCoinPrice = await this.Provider.Prices().fetchPrice(feeCoin);

		// const mixingFeesDaily = this.calcSuiFrenMixingFees(
		// 	mixSuiFrenEventsWithinTime,
		// 	feeCoinDecimals,
		// 	feeCoinPrice
		// );

		// const suiFrenVault = await this.fetchSuiFrenVault(
		// 	this.addresses.objects.suiFrensVault
		// );

		// const { bredSuiFrens, stakedSuiFrens, mixingFeesGlobal } =
		// 	await this.fetchSuiFrenVaultStats(
		// 		suiFrenVault,
		// 		feeCoinDecimals,
		// 		feeCoinPrice
		// 	);

		// return {
		// 	totalMixes: bredSuiFrens,
		// 	totalStaked: stakedSuiFrens,
		// 	mixingFeeCoin: feeCoin,
		// 	mixingFeesGlobal,
		// 	mixingFees24hr: mixingFeesDaily.amount,
		// 	mixingVolume24hr: mixSuiFrenEventsWithinTime.length,
		// };
	};

	public fetchSuiFrenVaultStats = async (
		suiFrenVault: SuiFrenVaultStateV1Object,
		feeCoinDecimals: CoinDecimal,
		feeCoinPrice: number
	) => {
		throw new Error("TODO");

		// const globalFeesWithDecimals = Coin.balanceWithDecimals(
		// 	suiFrenVault.globalFees,
		// 	feeCoinDecimals
		// );
		// const globalFeesUsd = feeCoinPrice * globalFeesWithDecimals;
		// const mixingFeesGlobal = {
		// 	amount: globalFeesWithDecimals,
		// 	amountUsd: globalFeesUsd,
		// } as AmountInCoinAndUsd;

		// return {
		// 	bredSuiFrens: suiFrenVault.bredSuiFrens,
		// 	stakedSuiFrens: suiFrenVault.stakedSuiFrens,
		// 	mixingFeesGlobal,
		// };
	};

	// =========================================================================
	//  SuiFren Attribute Filtering
	// =========================================================================

	public filterSuiFrensWithAttributes = (inputs: {
		suiFrens: SuiFrenObject[];
		attributes: Partial<SuiFrenAttributes>;
	}) => {
		const { suiFrens, attributes } = inputs;

		return suiFrens.filter((suiFren) =>
			Object.entries(attributes).every(([key1, val1]) =>
				Object.entries(suiFren.attributes).some(
					([key2, val2]) => key1 === key2 && val1 === val2
				)
			)
		);
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public isSuiFrenObjectType = (suiObjectInfo: SuiObjectInfo): boolean =>
		suiObjectInfo.type === this.objectTypes.suiFren;

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private fetchCompletePartialSuiFrenObjects = async (inputs: {
		partialSuiFrens: PartialSuiFrenObject[];
	}): Promise<SuiFrenObject[]> => {
		const { partialSuiFrens } = inputs;
		return Promise.all(
			partialSuiFrens.map((partialSuiFren) =>
				this.fetchCompletePartialSuiFrenObject({ partialSuiFren })
			)
		);
	};

	private fetchCompletePartialSuiFrenObject = async (inputs: {
		partialSuiFren: PartialSuiFrenObject;
	}): Promise<SuiFrenObject> => {
		const { partialSuiFren } = inputs;
		const suiFrenId = partialSuiFren.objectId;
		// TODO: move inner coin type func to general func in helpers
		const suiFrenType = Coin.getInnerCoinType(partialSuiFren.objectType);
		const [mixLimit, lastEpochMixed] = await Promise.all([
			this.fetchMixingLimit({ suiFrenId, suiFrenType }),
			this.fetchLastEpochMixed({ suiFrenId, suiFrenType }),
		]);

		return {
			...partialSuiFren,
			mixLimit,
			lastEpochMixed,
		};
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private harvestFeesEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.moduleNames.suiFrensVault.events,
			SuiFrensApi.constants.eventNames.suiFrensVault.harvestFees
		);

	private mixSuiFrensEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.moduleNames.suiFrensVault.events,
			SuiFrensApi.constants.eventNames.suiFrensVault.mixSuiFrens
		);

	private stakeSuiFrenEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.moduleNames.suiFrensVault.events,
			SuiFrensApi.constants.eventNames.suiFrensVault.stakeSuiFren
		);

	private unstakeSuiFrenEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.moduleNames.suiFrensVault.events,
			SuiFrensApi.constants.eventNames.suiFrensVault.stakeSuiFren
		);
}
