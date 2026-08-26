import {
	Transaction,
	type TransactionArgument,
} from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
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
	HarvestSuiFrenFeesEvent,
	StakedSuiFrenMetadataV1Object,
	PartialSuiFrenObject,
} from "../suiFrensTypes";
import {
	HarvestSuiFrenFeesEventOnChain,
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
	ObjectId,
	SuiAddress,
} from "../../../types";
import { Casting } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Sui } from "../../sui/sui";
import { SuiFrens } from "../suiFrens";

/**
 * Low-level SuiFrens object, event, inspection, and transaction-builder API.
 *
 * Read methods use the configured gRPC or API helpers. Event methods that call
 * `fetchCastEventsWithCursor` require the optional JSON-RPC client on
 * `AftermathApi`. Transaction-command methods append Move calls only; builder
 * methods create unsigned transactions for a caller-supplied wallet address.
 */
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

	/** Package and shared-object addresses used by SuiFrens operations. */
	public readonly addresses: SuiFrensAddresses;

	/** Move object types used by SuiFrens object and dynamic-field reads. */
	public readonly objectTypes: {
		// suiFrens
		/** Base SuiFren generic object type. */
		suiFren: AnyObjectType;
		/** Capy object type. */
		capy: AnyObjectType;
		/** Bullshark object type. */
		bullshark: AnyObjectType;

		// accessories
		/** Accessory object type. */
		suiFrenAccessory: AnyObjectType;

		// staking
		/** Staked-position object type. */
		stakedSuiFrenPosition: AnyObjectType;
		/** Version-one staked metadata dynamic-field type. */
		stakedSuiFrenMetadataV1: AnyObjectType;
	};

	/** Move event types used by the four public event fetchers. */
	public readonly eventTypes: {
		/** Harvested-fees event type. */
		harvestSuiFrenFees: AnyObjectType;
		/** Mixed-SuiFren event type. */
		mixSuiFrens: AnyObjectType;
		/** Staked-SuiFren event type. */
		stakeSuiFren: AnyObjectType;
		/** Unstaked-SuiFren event type. */
		unstakeSuiFren: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an API bound to an `AftermathApi` provider and derives package,
	 * object, and event type strings from its configured addresses.
	 *
	 * @param api - Provider containing Sui clients and SuiFrens addresses.
	 * @throws `Error` when `api.addresses.suiFrens` is not configured.
	 */
	constructor(private readonly api: AftermathApi) {
		const addresses = this.api.addresses.suiFrens;
		if (!addresses)
			throw new Error("not all required addresses have been set in provider");

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

	/**
	 * Reads mixing limits and last-mixed epochs for several SuiFrens in one dev-inspection transaction.
	 *
	 * The returned array matches `suiFrenIds` by index. `mixLimit` decodes
	 * `Option<u8>` and `lastEpochMixed` decodes `Option<u64>`; absent values are
	 * returned as `undefined` and present values as `bigint`.
	 *
	 * @param inputs - SuiFren IDs and the generic type used by the inspection call.
	 * @returns One `{ mixLimit, lastEpochMixed }` result per input ID.
	 * @throws Errors from the inspection client, BCS decoding, or transaction builder.
	 */
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
			await this.api.Inspections().fetchAllBytesFromTxOutput({
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

	/**
	 * Reads one SuiFren's optional mixing limit through dev inspection.
	 *
	 * Bullshark objects return `undefined` without creating an inspection call
	 * because the current implementation does not expose a mixing-limit field for
	 * that type.
	 *
	 * @param inputs - SuiFren ID and generic type used by the Move call.
	 * @returns The limit as a `bigint`, or `undefined` when the type or on-chain option has no value.
	 * @throws Errors from the inspection client, BCS decoding, or transaction builder.
	 */
	public fetchMixingLimit = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		// TODO: handle bullshark types more cleanly
		if (inputs.suiFrenType === this.objectTypes.bullshark) return undefined;

		const tx = new Transaction();

		this.mixingLimitTx({ tx, ...inputs });

		const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput(
			{
				tx,
			}
		);

		const unwrapped = bcs.option(bcs.u8()).parse(new Uint8Array(bytes));

		return unwrapped === null || unwrapped === undefined
			? undefined
			: BigInt(unwrapped);
	};

	/**
	 * Reads one SuiFren's optional last-mixed epoch through dev inspection.
	 *
	 * Bullshark objects return `undefined` without creating an inspection call.
	 * Other values decode from `Option<u64>` to `bigint`.
	 *
	 * @param inputs - SuiFren ID and generic type used by the Move call.
	 * @returns The epoch number as a `bigint`, or `undefined` when absent.
	 * @throws Errors from the inspection client, BCS decoding, or transaction builder.
	 */
	public fetchLastEpochMixed = async (inputs: {
		suiFrenId: ObjectId;
		suiFrenType: AnyObjectType;
	}): Promise<bigint | undefined> => {
		// TODO: handle bullshark types more cleanly
		if (inputs.suiFrenType === this.objectTypes.bullshark) return undefined;

		const tx = new Transaction();

		this.lastEpochMixedTx({ tx, ...inputs });

		const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput(
			{
				tx,
			}
		);

		const unwrapped = bcs.option(bcs.u64()).parse(new Uint8Array(bytes));

		return unwrapped === null || unwrapped === undefined
			? undefined
			: BigInt(unwrapped);
	};

	/**
	 * Resolves staked-metadata object IDs for a list of SuiFren IDs.
	 *
	 * The method builds a dev-inspection call that returns a `vector<address>` and
	 * decodes those addresses as object IDs.
	 *
	 * @param inputs - SuiFren object IDs to resolve.
	 * @returns Staked metadata object IDs in the Move call's returned order.
	 * @throws Errors from the inspection client, BCS decoding, or transaction builder.
	 */
	public fetchStakedSuiFrenMetadataIds = async (inputs: {
		suiFrenIds: ObjectId[];
	}): Promise<ObjectId[]> => {
		const { suiFrenIds } = inputs;

		const tx = new Transaction();
		this.devInspectMetadataObjectIdMulTx({ tx, suiFrenIds });

		const idBytes =
			await this.api.Inspections().fetchFirstBytesFromTxOutput({
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

	/**
	 * Fetches and casts paginated SuiFren fee-harvest events.
	 *
	 * This method uses the event helper's JSON-RPC path. The provider must include
	 * a `SuiJsonRpcClient`; the gRPC-only provider cannot satisfy this query.
	 *
	 * @param inputs - Optional event cursor and page limit.
	 * @returns Cast events and a nullable next cursor.
	 * @throws `Error` when the provider has no JSON-RPC client, or errors from event querying/casting.
	 */
	public fetchHarvestSuiFrenFeesEvents = (inputs: EventsInputs) =>
		this.api.Events().fetchCastEventsWithCursor<
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

	/**
	 * Fetches and casts paginated SuiFren mix events.
	 *
	 * @param inputs - Optional event cursor and page limit.
	 * @returns Cast mix events and a nullable next cursor.
	 * @throws `Error` when the provider has no JSON-RPC client, or errors from event querying/casting.
	 */
	public fetchMixSuiFrensEvents = (inputs: EventsInputs) =>
		this.api.Events().fetchCastEventsWithCursor<
			MixSuiFrensEventOnChain,
			MixSuiFrensEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.mixSuiFrens,
			},
			eventFromEventOnChain: Casting.suiFrens.mixSuiFrensEventFromOnChain,
		});

	/**
	 * Fetches and casts paginated SuiFren stake events.
	 *
	 * @param inputs - Optional event cursor and page limit.
	 * @returns Cast stake events and a nullable next cursor.
	 * @throws `Error` when the provider has no JSON-RPC client, or errors from event querying/casting.
	 */
	public fetchStakeSuiFrenEvents = (inputs: EventsInputs) =>
		this.api.Events().fetchCastEventsWithCursor<
			StakeSuiFrenEventOnChain,
			StakeSuiFrenEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.stakeSuiFren,
			},
			eventFromEventOnChain: Casting.suiFrens.stakeSuiFrenEventFromOnChain,
		});

	/**
	 * Fetches and casts paginated SuiFren unstake events.
	 *
	 * @param inputs - Optional event cursor and page limit.
	 * @returns Cast unstake events and a nullable next cursor.
	 * @throws `Error` when the provider has no JSON-RPC client, or errors from event querying/casting.
	 */
	public fetchUnstakeSuiFrenEvents = (inputs: EventsInputs) =>
		this.api.Events().fetchCastEventsWithCursor<
			UnstakeSuiFrenEventOnChain,
			UnstakeSuiFrenEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.unstakeSuiFren,
			},
			eventFromEventOnChain: Casting.suiFrens.unstakeSuiFrenEventFromOnChain,
		});

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  CapyLabsApp Object
	// =========================================================================

	/**
	 * Fetches and casts the configured CapyLabs application object.
	 *
	 * @returns The CapyLabs application object with bigint numeric fields.
	 * @throws Errors from the object client or response caster.
	 */
	public fetchCapyLabsApp = async () => {
		return this.api.Objects().fetchCastObject({
			objectId: this.addresses.objects.capyLabsApp,
			objectFromSuiObjectResponse:
				Casting.suiFrens.capyLabsAppObjectFromSuiObjectResponse,
		});
	};

	/**
	 * Fetches and casts the configured SuiFrens vault-state object.
	 *
	 * @returns Vault totals for staked SuiFrens and total mixes.
	 * @throws Errors from the object client or response caster.
	 */
	public fetchSuiFrenVaultStateV1Object = async () => {
		return this.api.Objects().fetchCastObject({
			objectId: this.addresses.objects.suiFrensVaultStateV1,
			objectFromSuiObjectResponse:
				Casting.suiFrens.suiFrenVaultStateV1ObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  SuiFren Objects
	// =========================================================================

	/**
	 * Fetches complete SuiFren objects by ID.
	 *
	 * The method first reads object fields and display data, then performs the
	 * inspection calls needed to add `mixLimit` and `lastEpochMixed`. Values that
	 * are absent on chain remain `undefined`.
	 *
	 * @param inputs - SuiFren object IDs.
	 * @returns Complete SuiFren objects in the response order.
	 * @throws Errors from object reads, dev inspection, BCS decoding, or casting.
	 */
	public fetchSuiFrens = async (inputs: {
		suiFrenIds: ObjectId[];
	}): Promise<SuiFrenObject[]> => {
		const { suiFrenIds } = inputs;

		const partialSuiFrens = await this.api.Objects().fetchCastObjectBatch({
			objectIds: suiFrenIds,
			objectFromSuiObjectResponse:
				Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
			withDisplay: true,
		});

		return this.fetchCompletePartialSuiFrenObjects({
			partialSuiFrens,
			isStaked: false,
		});
	};

	/**
	 * Fetches complete SuiFrens owned by a wallet.
	 *
	 * The method reads ordinary owned SuiFrens and also traverses owned kiosk
	 * owner caps to find Bullshark objects. Returned objects do not include an
	 * ownership flag; the high-level facade wraps them with `isOwned: true`.
	 *
	 * @param inputs - Wallet address whose SuiFren and kiosk objects are read.
	 * @returns Complete owned SuiFren objects.
	 * @throws Errors from object, dynamic-field, inspection, or kiosk reads.
	 */
	public fetchOwnedSuiFrens = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<SuiFrenObject[]> => {
		const { walletAddress } = inputs;

		const [partialSuiFrenNonBullsharks, partialSuiFrenBullsharks] =
			await Promise.all([
				this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
					walletAddress,
					objectType: this.objectTypes.suiFren,
					objectFromSuiObjectResponse:
						Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
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

	/**
	 * Fetches complete staked SuiFrens by metadata object ID.
	 *
	 * `stakedSuiFrenIds` are metadata IDs from the vault table, not owned
	 * staked-position IDs. The returned info contains the SuiFren and metadata;
	 * `position` is left unset by this method.
	 *
	 * @param inputs - Staked metadata object IDs.
	 * @returns Staked SuiFren info in the response order.
	 * @throws Errors from object reads, inspection, BCS decoding, or casting.
	 */
	public fetchStakedSuiFrens = async (inputs: {
		stakedSuiFrenIds: ObjectId[];
	}): Promise<StakedSuiFrenInfo[]> => {
		const { stakedSuiFrenIds } = inputs;

		const stakedSuiFrenData =
			await this.api.Objects().fetchCastObjectBatch({
				objectIds: stakedSuiFrenIds,
				objectFromSuiObjectResponse:
					Casting.suiFrens
						.partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse,
			withDisplay: true,
			});
		const suiFrens = await this.fetchCompletePartialSuiFrenObjects({
			partialSuiFrens: stakedSuiFrenData.map((data) => data.partialSuiFren),
			isStaked: true,
		});

		return suiFrens.map((suiFren, index) => ({
			suiFren,
			metadata: stakedSuiFrenData[index].stakedSuiFrenMetadata,
		}));
	};

	/**
	 * Fetches one page of staked-SuiFren metadata dynamic fields.
	 *
	 * `cursor` is the last dynamic-field object ID from the previous page and
	 * `limit` is the maximum number of dynamic fields requested. The method uses
	 * the configured metadata table and resolves each field to staked info.
	 *
	 * @param inputs - Optional dynamic-field cursor and page limit.
	 * @returns Staked info objects and a nullable next cursor.
	 * @throws Errors from dynamic-field listing, object reads, or casting.
	 */
	public fetchStakedSuiFrensDynamicFields = (inputs: DynamicFieldsInputs) => {
		return this.api.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
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

	/**
	 * Fetches all accessories attached to one SuiFren through dynamic fields.
	 *
	 * This method returns all matching fields without exposing a page cursor.
	 *
	 * @param inputs - SuiFren parent object ID.
	 * @returns Accessory objects attached to the parent.
	 * @throws Errors from dynamic-field listing, object reads, or casting.
	 */
	public fetchAccessoriesForSuiFren = async (inputs: {
		suiFrenId: ObjectId;
	}) => {
		return await this.api.DynamicFields().fetchCastAllDynamicFieldsOfType({
			parentObjectId: inputs.suiFrenId,
			objectsFromObjectIds: (objectIds) => this.fetchAccessories({ objectIds }),
			dynamicFieldType: this.objectTypes.suiFrenAccessory,
		});
	};

	/**
	 * Fetches accessory objects owned by a wallet.
	 *
	 * @param inputs - Wallet address whose accessory objects are listed.
	 * @returns Owned accessory objects with display data.
	 * @throws Errors from the object client or response caster.
	 */
	public fetchOwnedAccessories = async (inputs: {
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;
		return await this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.suiFrenAccessory,
			objectFromSuiObjectResponse:
				Casting.suiFrens.accessoryObjectFromSuiObjectResponse,
			withDisplay: true,
		});
	};

	/**
	 * Fetches and casts accessory objects by ID.
	 *
	 * @param inputs - Accessory object IDs.
	 * @returns Cast accessory objects with display data.
	 * @throws Errors from the object client or response caster.
	 */
	public fetchAccessories = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<SuiFrenAccessoryObject[]> => {
		const { objectIds } = inputs;
		return this.api.Objects().fetchCastObjectBatch({
			objectIds,
			objectFromSuiObjectResponse:
				Casting.suiFrens.accessoryObjectFromSuiObjectResponse,
			withDisplay: true,
		});
	};

	// =========================================================================
	//  Staked SuiFren Objects
	// =========================================================================

	// TODO: handle sorting
	/**
	 * Fetches staked SuiFrens until enough locally filtered results are available.
	 *
	 * `limit` is the number of matching results to return and defaults to 25.
	 * `limitStepSize` controls each underlying dynamic-field page and defaults to
	 * the dynamic-field helper's page size. Attribute keys and values are matched
	 * case-insensitively. If more matches remain, `nextCursor` is set to the first
	 * omitted matching object's ID. `sortBy` is accepted for compatibility but is
	 * not applied by the current implementation.
	 *
	 * @param inputs - Attribute filters and pagination controls.
	 * @returns Filtered staked info objects and a cursor for the next filtered page.
	 * @throws Errors from dynamic-field reads, object reads, inspection, or casting.
	 */
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
			await this.api.DynamicFields().fetchDynamicFieldsUntil({
				...inputs,
				fetchFunc: (data) => this.fetchStakedSuiFrensDynamicFields(data),
				isComplete,
			});

		const filteredSuiFrens = this.filterSuiFrensWithAttributes({
			suiFrens: suiFrensWithCursor.dynamicFieldObjects.map(
				(data) => data.suiFren
			),
			attributes,
		});
		const dynamicFieldObjects = suiFrensWithCursor.dynamicFieldObjects.filter(
			(data) =>
				filteredSuiFrens
					.slice(0, limit)
					.some((suiFren) => suiFren.objectId === data.suiFren.objectId)
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

	/**
	 * Fetches staked SuiFrens and their owned position objects for a wallet.
	 *
	 * The method lists owned staked positions, resolves their metadata IDs through
	 * dev inspection, and combines each position with its staked metadata.
	 *
	 * @param inputs - Wallet address whose staked-position objects are listed.
	 * @returns Staked info with the matching `position` field populated.
	 * @throws Errors from owned-object reads, dev inspection, BCS decoding, or casting.
	 */
	public fetchOwnedStakedSuiFrens = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<StakedSuiFrenInfo[]> => {
		const { walletAddress } = inputs;

		const stakedPositions =
			await this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
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

	/**
	 * Appends the vault metadata-ID inspection call to an existing transaction.
	 *
	 * The call returns a `vector<address>` in dev inspection output. This method
	 * only mutates `tx`; it does not set a sender, perform inspection, or sign.
	 *
	 * @param inputs - Existing transaction and SuiFren IDs to inspect.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Appends the batched mixing-limit and last-epoch inspection call.
	 *
	 * The Move call returns `vector<Option<u8>>` and `vector<Option<u64>>` for
	 * dev-inspection decoding. This method only mutates the supplied transaction.
	 *
	 * @param inputs - Existing transaction, SuiFren IDs, and generic SuiFren type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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
				tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.pure(bcs.vector(bcs.Address).serialize(inputs.suiFrenIds)), // suifren_ids
			],
		});
	};

	/**
	 * Appends the `mixing_limit` Move call for one SuiFren.
	 *
	 * The result is an `Option<u8>` in the Move call output. This local builder
	 * only mutates `tx` and does not perform the inspection itself.
	 *
	 * @param inputs - Existing transaction, SuiFren ID, and generic type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Appends the `last_epoch_mixed` Move call for one SuiFren.
	 *
	 * The result is an `Option<u64>` in the Move call output. This local builder
	 * only mutates `tx` and does not perform the inspection itself.
	 *
	 * @param inputs - Existing transaction, SuiFren ID, and generic type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Appends the owned-parent `mix_and_keep` Move call.
	 *
	 * The payment coin may be an object ID or an existing transaction argument.
	 * The method does not select the coin, set a sender, transfer outputs, or sign.
	 *
	 * @param inputs - Existing transaction, two parent IDs, payment coin, and SuiFren type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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
				tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension), // SuiFrensVaultCapyLabsExt
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

	/**
	 * Appends the `mix_with_staked_and_keep` Move call.
	 *
	 * `nonStakedParentId` and `stakedParentId` select the parent roles in the
	 * Move call. The payment coin may be an object ID or transaction argument.
	 *
	 * @param inputs - Existing transaction, parent IDs, payment coin, and SuiFren type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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
				tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension), // SuiFrensVaultCapyLabsExt
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

	/**
	 * Appends the `mix_staked_with_staked_and_keep` Move call.
	 *
	 * The payment coin may be an object ID or an existing transaction argument.
	 *
	 * @param inputs - Existing transaction, two staked parent IDs, payment coin, and SuiFren type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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
				tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension), // SuiFrensVaultCapyLabsExt
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

	/**
	 * Appends the `stake_and_keep` Move call.
	 *
	 * `baseFee` and `feeIncrementPerMix` are raw payment-coin balances. The Move
	 * call encodes `minRemainingMixesToKeep` as `u8`. This method does not set a
	 * sender or select gas and payment objects.
	 *
	 * @param inputs - Existing transaction, SuiFren ID, fee settings, auto-stake flag, minimum count, and type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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
				tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension), // SuiFrensVaultCapyLabsExt
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

	/**
	 * Appends the `unstake_and_keep` Move call for a staked position.
	 *
	 * This method only mutates the supplied transaction. The caller must provide
	 * a position object usable by the transaction sender.
	 *
	 * @param inputs - Existing transaction, staked-position ID, and SuiFren type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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
				tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension), // SuiFrensVaultCapyLabsExt
				tx.object(this.addresses.objects.suiFrensVault), // SuiFrenVault
				tx.object(inputs.stakedPositionId), // StakedPosition
			],
		});
	};

	// =========================================================================
	//  Fee Harvest Transaction Commands
	// =========================================================================

	/**
	 * Appends the vault `begin_harvest` Move call.
	 *
	 * @param inputs - Existing transaction to mutate.
	 * @returns The transaction argument used as harvest metadata.
	 */
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

	/**
	 * Appends a vault `harvest` Move call for one staked position.
	*
	 * `harvestFeesEventMetadataId` may be an object ID or a transaction argument
	 * returned by `beginHarvestTx`.
	*
	 * @param inputs - Existing transaction, position ID, and harvest metadata argument.
	 * @returns The transaction argument containing the harvested coin.
	 */
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

	/**
	 * Appends the vault `end_harvest` Move call.
	*
	 * @param inputs - Existing transaction and metadata ID or transaction argument.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Appends the staked-position `add_accessory` Move call.
	*
	 * @param inputs - Existing transaction, SuiFren ID, accessory ID, and generic type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Appends the owned-SuiFren `add_accessory_to_owned_suifren` Move call.
	*
	 * @param inputs - Existing transaction, SuiFren ID, accessory ID, and generic type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Appends the staked-position `remove_accessory_and_keep` Move call.
	*
	 * @param inputs - Existing transaction, staked-position ID, accessory type, and generic type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Appends the owned-SuiFren `remove_accessory_from_owned_suifren_and_keep` call.
	*
	 * @param inputs - Existing transaction, SuiFren ID, accessory type, and generic type.
	 * @returns The transaction argument returned by `tx.moveCall`.
	 */
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

	/**
	 * Creates a new unsigned staking transaction with `walletAddress` as sender.
	 *
	 * The builder appends `stake_and_keep` with `autoStakeFees: true`. It performs
	 * no network I/O and does not select an explicit payment coin.
	 *
	 * @param inputs - Wallet sender, SuiFren ID, fee settings, minimum count, and generic type.
	 * @returns A new unsigned Sui `Transaction`.
	 */
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

	/**
	 * Creates a new unsigned unstaking transaction with `walletAddress` as sender.
	 *
	 * @param inputs - Wallet sender, staked-position ID, and generic SuiFren type.
	 * @returns A new unsigned Sui `Transaction`.
	 */
	public fetchUnstakeTx = Helpers.transactions.createBuildTxFunc(
		this.unstakeAndKeepTx
	);

	// =========================================================================
	//  Mixing Transactions
	// =========================================================================

	/**
	 * Builds an unsigned mix transaction and selects the correct parent-state branch.
	 *
	 * The method sets `walletAddress` as sender, adds `baseFee` to the internal fee
	 * calculated from the optional parent `mixFee` values, and selects a SUI coin
	 * for the total. It calls the owned, mixed-owned/staked, or staked/staked Move
	 * function according to which parent fees are defined. `isSponsoredTx` is
	 * passed to coin selection.
	 *
	 * @param inputs - Parent IDs and fees, base fee, SuiFren type, wallet, and sponsorship flag.
	 * @returns An unsigned Sui `Transaction` with the sender set.
	 * @throws Errors from coin selection, the provider, or transaction building.
	 */
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

		const suiPaymentCoinId = await this.api.Coin().fetchCoinWithAmountTx({
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

	/**
	 * Builds an unsigned fee-harvest transaction for one or more positions.
	 *
	 * The transaction begins harvest, harvests each position, merges multiple
	 * harvested coins, transfers the resulting coin to `walletAddress`, and ends
	 * harvest. The implementation expects at least one position ID.
	 *
	 * @param inputs - Wallet sender/recipient and a non-empty list of position IDs.
	 * @returns An unsigned Sui `Transaction` with the sender set.
	 * @throws Errors from the Sui transaction builder when the input list is empty or an argument is invalid.
	 */
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

	/**
	 * Builds an unsigned accessory-add transaction for an owned or staked SuiFren.
	 *
	 * `isOwned` selects `add_accessory_to_owned_suifren` when true and
	 * `add_accessory` when false. The returned transaction has
	 * `walletAddress` as sender.
	*
	 * @param inputs - Accessory body including ownership mode and wallet sender.
	 * @returns A new unsigned Sui `Transaction`.
	 */
	public fetchBuildAddAccessoryTx = (inputs: ApiAddSuiFrenAccessoryBody) => {
		if (inputs.isOwned) {
			return Helpers.transactions.createBuildTxFunc(
				this.addAccessoryToOwnedSuiFrenTx
			)(inputs);
		}
		return Helpers.transactions.createBuildTxFunc(this.addAccessoryTx)(inputs);
	};

	/**
	 * Builds an unsigned accessory-removal transaction.
	 *
	 * The union discriminant selects the owned-SuiFren call when `suiFrenId` is
	 * present and the staked-position call otherwise. The returned transaction has
	 * `walletAddress` as sender.
	*
	 * @param inputs - Accessory type, generic type, wallet sender, and one object-ID branch.
	 * @returns A new unsigned Sui `Transaction`.
	 */
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

	/**
	 * Calculates SuiFrens statistics from vault state and the last 24 hours of mix events.
	 *
	 * The method performs the vault read and event query concurrently. The event
	 * query uses the provider's JSON-RPC client through the public event fetcher.
	*
	 * @returns Vault totals, 24-hour fee sum, and 24-hour mix count.
	 * @throws Errors from object reads, event queries, or event casting.
	 */
	public fetchSuiFrenStats = async (): Promise<SuiFrenStats> => {
		const [suiFrenVault, mixSuiFrenEventsWithinTime] = await Promise.all([
			this.fetchSuiFrenVaultStateV1Object(),
			this.api.Events().fetchEventsWithinTime({
				fetchEventsFunc: this.fetchMixSuiFrensEvents,
				timeMs: 24 * 60 * 60 * 1000,
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

	/**
	 * Filters SuiFren objects by attribute keys and values.
	 *
	 * Matching is case-insensitive for both keys and values. An empty attribute
	 * object returns the original `suiFrens` array reference; a non-empty filter
	 * returns a new filtered array.
	*
	 * @param inputs - SuiFren objects and the partial attribute filter.
	 * @returns The matching objects.
	 */
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
			await this.api.Nfts().fetchOwnedKioskOwnerCaps(inputs);

		const allBullsharks = await Promise.all(
			kioskOwnerCaps.map((kioskOwnerCap) =>
				this.api.DynamicFields().fetchCastAllDynamicFieldsOfType({
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
