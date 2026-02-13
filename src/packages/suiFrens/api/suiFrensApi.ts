import { TransactionArgument, Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { AftermathApi } from "../../../general/providers/aftermathApi.ts";
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
	HarvestSuiFrenFeesEvent,
	StakedSuiFrenMetadataV1Object,
	PartialSuiFrenObject,
} from "../suiFrensTypes.ts";
import {
	HarvestSuiFrenFeesEventOnChain,
	MixSuiFrensEventOnChain,
	StakeSuiFrenEventOnChain,
	UnstakeSuiFrenEventOnChain,
} from "./suiFrensApiCastingTypes.ts";
import { AmountInCoinAndUsd, CoinDecimal } from "../../coin/coinTypes.ts";
import { Coin } from "../../coin/coin.ts";
import { Helpers } from "../../../general/utils/helpers.ts";
import {
	AnyObjectType,
	Balance,
	SuiFrensAddresses,
	DynamicFieldObjectsWithCursor,
	DynamicFieldsInputs,
	EventsInputs,
	ObjectId,
	SuiAddress,
} from "../../../types.ts";
import { Casting } from "../../../general/utils/index.ts";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers.ts";
import { Sui } from "../../sui/sui.ts";
import { SuiFrens } from "../suiFrens.ts";

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
				harvestSuiFrenFees: "HarvestedFeesEvent",
			},
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: SuiFrensAddresses;

	public readonly objectTypes: {
		// suiFrens
		suiFren: AnyObjectType;
		capy: AnyObjectType;
		bullshark: AnyObjectType;

		// accessories
		suiFrenAccessory: AnyObjectType;

		// staking
		stakedSuiFrenPosition: AnyObjectType;
		stakedSuiFrenMetadataV1: AnyObjectType;
	};

	public readonly eventTypes: {
		harvestSuiFrenFees: AnyObjectType;
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
			// suiFrens
			suiFren: `${addresses.packages.suiFrens}::${SuiFrensApi.constants.moduleNames.suiFrens.suiFrens}::SuiFren`,
			capy: `${addresses.packages.suiFrens}::capy::Capy`,
			bullshark: `${addresses.packages.suiFrensBullshark}::bullshark::Bullshark`,

			// accessories
			suiFrenAccessory: `${addresses.packages.accessories}::${SuiFrensApi.constants.moduleNames.accessories.accessories}::Accessory`,

			// staking
			stakedSuiFrenPosition: `${addresses.packages.suiFrensVault}::${SuiFrensApi.constants.moduleNames.suiFrensVault.stakedPosition}::StakedPosition`,
			stakedSuiFrenMetadataV1: `${addresses.packages.suiFrensVault}::${SuiFrensApi.constants.moduleNames.suiFrensVault.vaultState}::StakedSuiFrenMetadataV1`,
		};

		this.eventTypes = {
			harvestSuiFrenFees: this.harvestSuiFrenFeesEventType(),
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

	public fetchMixingLimitsAndLastEpochMixeds = async (inputs: {
		suiFrenIds: ObjectId[];
		suiFrenType: AnyObjectType;
	}): Promise<
		{
			mixLimit: bigint | undefined;
			lastEpochMixed: bigint | undefined;
		}[]
	> => {
		const tx = new Transaction();
		this.devInspectMixLimitAndLastEpochMixedMulTx({ ...inputs, tx });

		const [mixLimitBytes, lastEpochMixedBytes] =
			await this.Provider.Inspections().fetchAllBytesFromTxOutput({
				tx,
			});

		const mixLimits = bcs
			.vector(bcs.option(bcs.u8()))
			.parse(new Uint8Array(mixLimitBytes));

		const lastEpochMixeds: any[] = bcs
			.vector(bcs.option(bcs.u64()))
			.parse(new Uint8Array(lastEpochMixedBytes));

		return mixLimits.map((mixLimit, index) => ({
			mixLimit:
				mixLimit === null || mixLimit === undefined
					? undefined
					: BigInt(mixLimit),
			lastEpochMixed:
				lastEpochMixeds[index] === undefined
					? undefined
					: BigInt(lastEpochMixeds[index]),
		}));
	};

	public fetchMixingLimit = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		// TODO: handle bullshark types more cleanly
		if (inputs.suiFrenType === this.objectTypes.bullshark) return undefined;

		const tx = new Transaction();

		this.mixingLimitTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const unwrapped = bcs.option(bcs.u8()).parse(new Uint8Array(bytes));

		return unwrapped === null || unwrapped === undefined
			? undefined
			: BigInt(unwrapped);
	};

	public fetchLastEpochMixed = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		// TODO: handle bullshark types more cleanly
		if (inputs.suiFrenType === this.objectTypes.bullshark) return undefined;

		const tx = new Transaction();

		this.lastEpochMixedTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const unwrapped = bcs.option(bcs.u64()).parse(new Uint8Array(bytes));

		return unwrapped === null || unwrapped === undefined
			? undefined
			: BigInt(unwrapped);
	};

	public fetchStakedSuiFrenMetadataIds = async (inputs: {
		suiFrenIds: ObjectId[];
	}): Promise<ObjectId[]> => {
		const { suiFrenIds } = inputs;

		const tx = new Transaction();
		this.devInspectMetadataObjectIdMulTx({ tx, suiFrenIds });

		const idBytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const stakedSuiFrenMetadataIds = bcs
			.vector(bcs.Address)
			.parse(new Uint8Array(idBytes));

		return stakedSuiFrenMetadataIds;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchHarvestSuiFrenFeesEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			HarvestSuiFrenFeesEventOnChain,
			HarvestSuiFrenFeesEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.harvestSuiFrenFees,
			},
			eventFromEventOnChain:
				Casting.suiFrens.harvestSuiFrenFeesEventFromOnChain,
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

	public fetchSuiFrenVaultStateV1Object = async () => {
		return this.Provider.Objects().fetchCastObject({
			objectId: this.addresses.objects.suiFrensVaultStateV1,
			objectFromSuiObjectResponse:
				Casting.suiFrens.suiFrenVaultStateV1ObjectFromSuiObjectResponse,
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
					showContent: true,
				},
			});

		return this.fetchCompletePartialSuiFrenObjects({
			partialSuiFrens,
			isStaked: false,
		});
	};

	public fetchOwnedSuiFrens = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<SuiFrenObject[]> => {
		const { walletAddress } = inputs;

		const [partialSuiFrenNonBullsharks, partialSuiFrenBullsharks] =
			await Promise.all([
				this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
					walletAddress,
					objectType: this.objectTypes.suiFren,
					objectFromSuiObjectResponse:
						Casting.suiFrens
							.partialSuiFrenObjectFromSuiObjectResponse,
					withDisplay: true,
				}),
				this.fetchOwnedPartialSuiFrenBullsharks(inputs),
			]);

		const suiFrens = await this.fetchCompletePartialSuiFrenObjects({
			partialSuiFrens: [
				...partialSuiFrenNonBullsharks,
				...partialSuiFrenBullsharks,
			],
			isStaked: false,
		});
		return suiFrens;
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
					showContent: true,
				},
			});
		const suiFrens = await this.fetchCompletePartialSuiFrenObjects({
			partialSuiFrens: stakedSuiFrenData.map(
				(data) => data.partialSuiFren
			),
			isStaked: true,
		});

		return suiFrens.map((suiFren, index) => ({
			suiFren,
			metadata: stakedSuiFrenData[index].stakedSuiFrenMetadata,
		}));
	};

	public fetchStakedSuiFrensDynamicFields = (inputs: DynamicFieldsInputs) => {
		return this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				...inputs,
				parentObjectId:
					this.addresses.objects.suiFrensVaultStateV1MetadataTable,
				objectsFromObjectIds: (stakedSuiFrenIds) =>
					this.fetchStakedSuiFrens({ stakedSuiFrenIds }),
				dynamicFieldType: this.objectTypes.stakedSuiFrenMetadataV1,
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
				dynamicFieldType: this.objectTypes.suiFrenAccessory,
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
				showContent: true,
			},
		});
	};

	// =========================================================================
	//  Staked SuiFren Objects
	// =========================================================================

	// TODO: handle sorting
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
				fetchFunc: (data) =>
					this.fetchStakedSuiFrensDynamicFields(data),
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
				limit < filteredSuiFrens.length
					? filteredSuiFrens[limit].objectId
					: suiFrensWithCursor.nextCursor,
			dynamicFieldObjects,
		};

		return resizedSuiFrensWithCursor;
	};

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

		const stakedSuiFrenIds = await this.fetchStakedSuiFrenMetadataIds({
			suiFrenIds: stakedPositions.map((position) => position.suiFrenId),
		});
		const stakedSuiFrens = await this.fetchStakedSuiFrens({
			stakedSuiFrenIds,
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

	public devInspectMetadataObjectIdMulTx = (inputs: {
		tx: Transaction;
		suiFrenIds: ObjectId[];
	}) /* vector<address> */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVault,
				SuiFrensApi.constants.moduleNames.suiFrensVault.vault,
				"dev_inspect_metadata_object_id_mul"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.pure(bcs.vector(bcs.Address).serialize(inputs.suiFrenIds)), // suifren_ids
			],
		});
	};

	public devInspectMixLimitAndLastEpochMixedMulTx = (inputs: {
		tx: Transaction;
		suiFrenIds: ObjectId[];
		suiFrenType: AnyObjectType;
	}) /* (vector<Option<u8>>, vector<Option<u64>>) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.suiFrensVaultCapyLabsExtension,
				SuiFrensApi.constants.moduleNames.suiFrensVaultCapyLabsExtension
					.capyLabs,
				"dev_inspect_mixing_limit_and_last_epoch_mixed_mul"
			),
			typeArguments: [inputs.suiFrenType],
			arguments: [
				tx.object(
					this.addresses.objects.suiFrensVaultCapyLabsExtension
				), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.pure(bcs.vector(bcs.Address).serialize(inputs.suiFrenIds)), // suifren_ids
			],
		});
	};

	public mixingLimitTx = (inputs: {
		tx: Transaction;
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
		tx: Transaction;
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
		tx: Transaction;
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

	public mixWithStakedAndKeepTx = (inputs: {
		tx: Transaction;
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
		tx: Transaction;
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
		tx: Transaction;
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

				tx.pure.bool(inputs.autoStakeFees),
				tx.pure.u64(inputs.baseFee),
				tx.pure.u64(inputs.feeIncrementPerMix),
				tx.pure.u8(Number(inputs.minRemainingMixesToKeep)),
			],
		});
	};

	public unstakeAndKeepTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
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
				tx.object(inputs.stakedPositionId), // StakedPosition
			],
		});
	};

	// =========================================================================
	//  Fee Harvest Transaction Commands
	// =========================================================================

	public beginHarvestTx = (inputs: {
		tx: Transaction;
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
		tx: Transaction;
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
		tx: Transaction;
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
		tx: Transaction;
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
		tx: Transaction;
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
		tx: Transaction;
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
		tx: Transaction;
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

	public fetchStakeTx = Helpers.transactions.createBuildTxFunc(
		(inputs: {
			tx: Transaction;
			suiFrenId: ObjectId;
			baseFee: Balance;
			feeIncrementPerMix: Balance;
			minRemainingMixesToKeep: bigint;
			suiFrenType: AnyObjectType;
		}) => this.stakeAndKeepTx({ ...inputs, autoStakeFees: true })
	);

	public fetchUnstakeTx = Helpers.transactions.createBuildTxFunc(
		this.unstakeAndKeepTx
	);

	// =========================================================================
	//  Mixing Transactions
	// =========================================================================

	public fetchBuildMixTx = async (
		inputs: ApiMixSuiFrensBody
	): Promise<Transaction> => {
		const {
			walletAddress,
			suiFrenParentOne,
			suiFrenParentTwo,
			suiFrenType,
			baseFee,
			isSponsoredTx,
		} = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const totalFee =
			baseFee +
			SuiFrens.calcTotalInternalMixFee({
				mixFee1: suiFrenParentOne.mixFee,
				mixFee2: suiFrenParentTwo.mixFee,
			});

		const suiPaymentCoinId =
			await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: Coin.constants.suiCoinType,
				coinAmount: totalFee,
				isSponsoredTx,
			});

		const isParentOneStaked = suiFrenParentOne.mixFee !== undefined;
		const isParentTwoStaked = suiFrenParentTwo.mixFee !== undefined;

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
	}): Promise<Transaction> => {
		const { stakedPositionIds } = inputs;

		const tx = new Transaction();
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

		tx.transferObjects([coinToTransfer], inputs.walletAddress);

		this.endHarvestTx({ tx, harvestFeesEventMetadataId });

		return tx;
	};

	// =========================================================================
	//  Accessory Transactions
	// =========================================================================

	public fetchBuildAddAccessoryTx = (inputs: ApiAddSuiFrenAccessoryBody) => {
		if (inputs.isOwned) {
			return Helpers.transactions.createBuildTxFunc(
				this.addAccessoryToOwnedSuiFrenTx
			)(inputs);
		}
		return Helpers.transactions.createBuildTxFunc(this.addAccessoryTx)(
			inputs
		);
	};

	public fetchBuildRemoveAccessoryTx = (
		inputs: ApiRemoveSuiFrenAccessoryBody
	) => {
		if ("suiFrenId" in inputs) {
			return Helpers.transactions.createBuildTxFunc(
				this.removeAccessoryFromOwnedSuiFrenAndKeepTx
			)(inputs);
		}
		return Helpers.transactions.createBuildTxFunc(
			this.removeAccessoryAndKeepTx
		)(inputs);
	};

	// =========================================================================
	//  Stats
	// =========================================================================

	public fetchSuiFrenStats = async (): Promise<SuiFrenStats> => {
		const [suiFrenVault, mixSuiFrenEventsWithinTime] = await Promise.all([
			this.fetchSuiFrenVaultStateV1Object(),
			this.Provider.Events().fetchEventsWithinTime({
				fetchEventsFunc: this.fetchMixSuiFrensEvents,
				timeUnit: "hour",
				time: 24,
			}),
		]);

		const mixingFees24hr = Helpers.sumBigInt(
			mixSuiFrenEventsWithinTime.map((event) => event.fee)
		);

		return {
			totalMixes: suiFrenVault.totalMixes,
			currentTotalStaked: suiFrenVault.stakedSuiFrens,
			mixingVolume24hr: mixSuiFrenEventsWithinTime.length,
			mixingFees24hr,
		};
	};

	// =========================================================================
	//  SuiFren Attribute Filtering
	// =========================================================================

	public filterSuiFrensWithAttributes = (inputs: {
		suiFrens: SuiFrenObject[];
		attributes: Partial<SuiFrenAttributes>;
	}) => {
		const { suiFrens, attributes } = inputs;

		if (Object.keys(attributes).length <= 0) return suiFrens;

		return suiFrens.filter((suiFren) =>
			Object.entries(attributes).every(([key1, val1]) =>
				Object.entries(suiFren.attributes).some(
					([key2, val2]) =>
						key1.toLowerCase() === key2.toLowerCase() &&
						val1.toLowerCase() === val2.toLowerCase()
				)
			)
		);
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	// TODO: remove or update

	// public isSuiFrenObjectType = (suiObjectInfo: SuiObjectInfo): boolean =>
	// 	suiObjectInfo.type === this.objectTypes.suiFren;

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private fetchCompletePartialSuiFrenObjects = async (inputs: {
		partialSuiFrens: PartialSuiFrenObject[];
		isStaked: boolean;
	}): Promise<SuiFrenObject[]> => {
		const { partialSuiFrens, isStaked } = inputs;

		if (!isStaked) {
			return Promise.all(
				partialSuiFrens.map((partialSuiFren) =>
					this.fetchNonStakedCompletePartialSuiFrenObject({
						partialSuiFren,
					})
				)
			);
		}

		if (partialSuiFrens.length <= 0) return [];

		const [partialSuiFrenBullsharks, partialSuiFrenNonBullsharks] =
			Helpers.bifilter(partialSuiFrens, (partialSuiFren) =>
				partialSuiFren.objectType.includes(this.objectTypes.bullshark)
			);

		// TODO: handle different suifren types
		const bullsharkDynamicFields = partialSuiFrenBullsharks.map(() => ({
			mixLimit: undefined,
			lastEpochMixed: undefined,
		}));
		const nonBullsharkDynamicFields =
			await this.fetchMixingLimitsAndLastEpochMixeds({
				suiFrenIds: partialSuiFrenNonBullsharks.map(
					(suiFren) => suiFren.objectId
				),
				suiFrenType: Coin.getInnerCoinType(
					partialSuiFrenNonBullsharks[0].objectType
				),
			});

		const suiFrenBullsharks = bullsharkDynamicFields.map((data, index) => ({
			...partialSuiFrenBullsharks[index],
			...data,
		}));
		const suiFrenNonBullsharks = nonBullsharkDynamicFields.map(
			(data, index) => ({
				...partialSuiFrenNonBullsharks[index],
				...data,
			})
		);

		return [...suiFrenBullsharks, ...suiFrenNonBullsharks];
	};

	private fetchNonStakedCompletePartialSuiFrenObject = async (inputs: {
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

	// TODO: refactor to use NftsApi class
	private fetchOwnedPartialSuiFrenBullsharks = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<PartialSuiFrenObject[]> => {
		const kioskOwnerCaps =
			await this.Provider.Nfts().fetchOwnedKioskOwnerCaps(inputs);

		const allBullsharks = await Promise.all(
			kioskOwnerCaps.map((kioskOwnerCap) =>
				this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType({
					parentObjectId: kioskOwnerCap.kioskObjectId,
					objectsFromObjectIds: (suiFrenIds) =>
						this.fetchSuiFrens({ suiFrenIds }),
					dynamicFieldType: (fieldType) =>
						fieldType.includes(this.objectTypes.suiFren) &&
						fieldType.includes(this.objectTypes.bullshark),
				})
			)
		);

		const bullsharks = allBullsharks.reduce(
			(acc, bullsharks) => [...acc, ...bullsharks],
			[]
		);
		return bullsharks;
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private harvestSuiFrenFeesEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.suiFrensVault,
			SuiFrensApi.constants.moduleNames.suiFrensVault.events,
			SuiFrensApi.constants.eventNames.suiFrensVault.harvestSuiFrenFees
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
			SuiFrensApi.constants.eventNames.suiFrensVault.unstakeSuiFren
		);
}
