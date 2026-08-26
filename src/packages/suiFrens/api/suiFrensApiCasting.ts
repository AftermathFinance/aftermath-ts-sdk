import {
	MixSuiFrensEvent,
	StakeSuiFrenEvent,
	StakedSuiFrenMetadataV1Object,
	UnstakeSuiFrenEvent,
	SuiFrenAttributes,
	CapyLabsAppObject,
	SuiFrenVaultStateV1Object,
	SuiFrenAccessoryObject,
	HarvestSuiFrenFeesEvent,
	PartialSuiFrenObject,
	StakedSuiFrenPositionObject,
} from "../suiFrensTypes";
import {
	MixSuiFrensEventOnChain,
	StakeSuiFrenEventOnChain,
	UnstakeSuiFrenEventOnChain,
	SuiFrenFieldsOnChain,
	SuiFrenDisplayOnChain,
	CapyLabsAppFieldsOnChain,
	SuiFrenAccessoryDisplayOnChain,
	SuiFrenAccessoryFieldsOnChain,
	StakedSuiFrenMetadataV1FieldsOnChain,
	SuiFrenVaultStateV1FieldsOnChain,
	HarvestSuiFrenFeesEventOnChain,
	StakedSuiFrenPositionFieldsOnChain,
} from "./suiFrensApiCastingTypes";
import {
	GrpcCasting,
	Helpers,
	type SuiObjectView,
} from "../../../general/utils";

/**
 * Converts raw SuiFrens object views and on-chain events into SDK data shapes.
 *
 * The static methods perform local field conversion only. They decode numeric
 * strings to `bigint`, pad Sui addresses and object IDs, and map snake-case
 * on-chain fields to the public camel-case interfaces.
 */
export class SuiFrensApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	// TODO: handle leading 0s for ALL castings

	/**
	 * Casts a CapyLabs application object view.
	 *
	 * @param data - Raw Sui object view containing CapyLabs fields.
	 * @returns The public CapyLabs application object with bigint balances.
	 * @throws Errors when required fields are missing or cannot convert to `bigint`.
	 */
	public static capyLabsAppObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): CapyLabsAppObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(data) as CapyLabsAppFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			mixingLimit: BigInt(fields.mixing_limit),
			coolDownPeriodEpochs: BigInt(fields.cool_down_period),
			mixingPrice: BigInt(fields.mixing_price),
			suiProfits: BigInt(fields.profits),
		};
	};

	/**
	 * Casts the base fields and display data of a non-staked SuiFren.
	 *
	 * The method returns a `PartialSuiFrenObject`; dynamic fields are added later
	 * by `SuiFrensApi` inspection methods. `birthdate` remains a millisecond
	 * timestamp represented as a JavaScript number.
	 *
	 * @param data - Raw Sui object view with SuiFren fields and display output.
	 * @returns Partial SuiFren data with bigint numeric fields.
	 * @throws Errors when required fields or display values are missing.
	 */
	public static partialSuiFrenObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): PartialSuiFrenObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(data) as SuiFrenFieldsOnChain;
		const display = Helpers.getObjectDisplay(data)
			.data as unknown as SuiFrenDisplayOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			generation: BigInt(fields.generation),
			birthdate: Number(fields.birthdate),
			cohort: BigInt(fields.cohort),
			genes: fields.genes.map((gene) => BigInt(gene)),
			attributes: {
				skin: fields.attributes[0],
				main: fields.attributes[1],
				secondary: fields.attributes[2],
				expression: fields.attributes[3],
				ears: fields.attributes[4],
			} as SuiFrenAttributes,
			birthLocation: fields.birth_location,
			display: {
				link: display.link,
				imageUrl: display.image_url,
				description: display.description,
				projectUrl: display.project_url,
			},
		};
	};

	/**
	 * Casts SuiFren fields embedded in staked metadata.
	 *
	 * The method takes the SuiFren type and ID from metadata, pads the ID, and
	 * replaces every `mainnet` substring with `testnet` in the display image URL.
	 * It returns no dynamic fields.
	*
	 * @param data - Raw staked-metadata object view with display output.
	 * @returns Partial SuiFren data reconstructed from metadata fields.
	 * @throws Errors when required fields or display values are missing.
	 */
	public static partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse =
		(data: SuiObjectView): PartialSuiFrenObject => {
			const fields = Helpers.getObjectFields(
				data
			) as StakedSuiFrenMetadataV1FieldsOnChain;
			const display = Helpers.getObjectDisplay(data)
				.data as unknown as SuiFrenDisplayOnChain;

			return {
				objectType: fields.suifren_type,
				objectId: Helpers.addLeadingZeroesToType(fields.suifren_id),
				generation: BigInt(fields.generation),
				birthdate: Number(fields.birthdate),
				cohort: BigInt(fields.cohort),
				genes: fields.genes.map((gene) => BigInt(gene)),
				attributes: {
					skin: fields.attributes[0],
					main: fields.attributes[1],
					secondary: fields.attributes[2],
					expression: fields.attributes[3],
					ears: fields.attributes[4],
				} as SuiFrenAttributes,
				birthLocation: fields.birth_location,
				display: {
					link: display.link,
					imageUrl: display.image_url.replace("mainnet", "testnet"),
					description: display.description,
					projectUrl: display.project_url,
				},
			};
		};

	/**
	 * Casts the vault metadata object for one staked SuiFren.
	 *
	 * Numeric fee and count fields become `bigint`; the associated SuiFren ID is
	 * padded with leading zeroes. Raw display fields and `last_epoch_mixed` are
	 * not included in the returned public metadata shape.
	*
	 * @param data - Raw staked-metadata object view.
	 * @returns Public staked metadata.
	 * @throws Errors when required fields are missing or cannot convert to `bigint`.
	 */
	public static stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): StakedSuiFrenMetadataV1Object => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as StakedSuiFrenMetadataV1FieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id),
			collectedFees: BigInt(fields.collected_fees),
			autoStakeFees: fields.auto_stake_fees,
			mixFee: BigInt(fields.mix_fee),
			feeIncrementPerMix: BigInt(fields.fee_increment_per_mix),
			minRemainingMixesToKeep: BigInt(fields.min_remaining_mixes_to_keep),
		};
	};

	/**
	 * Casts one staked-metadata view into both public metadata and partial SuiFren data.
	 *
	 * @param data - Raw staked-metadata object view with display output.
	 * @returns The cast metadata and partial SuiFren values.
	 * @throws Errors propagated from either underlying caster.
	 */
	public static partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse =
		(
			data: SuiObjectView
		): {
			stakedSuiFrenMetadata: StakedSuiFrenMetadataV1Object;
			partialSuiFren: PartialSuiFrenObject;
		} => {
			return {
				stakedSuiFrenMetadata:
					this.stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse(data),
				partialSuiFren:
					this.partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse(
						data
					),
			};
		};

	/**
	 * Casts a staked-position object view.
	*
	 * @param data - Raw position object view.
	 * @returns Position data with a padded SuiFren ID.
	 * @throws Errors when required fields are missing.
	 */
	public static stakedSuiFrenPositionFromSuiObjectResponse = (
		data: SuiObjectView
	): StakedSuiFrenPositionObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as StakedSuiFrenPositionFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id),
		};
	};

	/**
	 * Casts the SuiFrens vault-state object.
	*
	 * The nested metadata table's size becomes `stakedSuiFrens`, and the raw
	 * `mixed` value becomes `totalMixes`.
	*
	 * @param data - Raw vault-state object view.
	 * @returns Public vault-state totals as bigints.
	 * @throws Errors when required fields are missing or cannot convert to `bigint`.
	 */
	public static suiFrenVaultStateV1ObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): SuiFrenVaultStateV1Object => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as SuiFrenVaultStateV1FieldsOnChain;

		// @dev: `suifrens_metadata` is a nested `Table`, so it lost JSON-RPC's
		// `{ type, fields }` envelope over gRPC.
		const suiFrensMetadata = GrpcCasting.unwrapStructField(
			fields.suifrens_metadata
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			totalMixes: BigInt(fields.mixed),
			stakedSuiFrens: BigInt(suiFrensMetadata.size),
		};
	};

	/**
	 * Casts an accessory object view.
	*
	 * @param data - Raw accessory object view with display output.
	 * @returns Public accessory data.
	 * @throws Errors when required fields or display values are missing.
	 */
	public static accessoryObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): SuiFrenAccessoryObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as SuiFrenAccessoryFieldsOnChain;
		const display = Helpers.getObjectDisplay(data)
			.data as unknown as SuiFrenAccessoryDisplayOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			name: fields.name,
			type: fields.type,
			imageUrl: display.image_url,
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Casts a raw harvested-fees event.
	*
	 * The issuer address is padded, the fee is converted to `bigint`, and the raw
	 * timestamp, transaction digest, and event type are preserved.
	*
	 * @param eventOnChain - Raw event with parsed fields and metadata.
	 * @returns Public harvested-fees event.
	 */
	public static harvestSuiFrenFeesEventFromOnChain = (
		eventOnChain: HarvestSuiFrenFeesEventOnChain
	): HarvestSuiFrenFeesEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			harvester: Helpers.addLeadingZeroesToType(fields.issuer),
			fees: BigInt(fields.fees),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/**
	 * Casts a raw SuiFren mix event.
	*
	 * Parent and child IDs are padded and the fee is converted to `bigint`.
	*
	 * @param eventOnChain - Raw event with parsed fields and metadata.
	 * @returns Public mix event.
	 */
	public static mixSuiFrensEventFromOnChain = (
		eventOnChain: MixSuiFrensEventOnChain
	): MixSuiFrensEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			mixer: Helpers.addLeadingZeroesToType(fields.issuer),
			parentOneId: Helpers.addLeadingZeroesToType(fields.parent_one_id),
			parentTwoId: Helpers.addLeadingZeroesToType(fields.parent_two_id),
			childId: Helpers.addLeadingZeroesToType(fields.suifren_id),
			fee: BigInt(fields.fee),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/**
	 * Casts a raw SuiFren stake event.
	*
	 * @param eventOnChain - Raw event with parsed fields and metadata.
	 * @returns Public stake event with padded issuer and SuiFren IDs.
	 */
	public static stakeSuiFrenEventFromOnChain = (
		eventOnChain: StakeSuiFrenEventOnChain
	): StakeSuiFrenEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			staker: Helpers.addLeadingZeroesToType(fields.issuer),
			suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id),
			// TODO: generalize casting of event types with passing of
			// timestamp and txnDigest (create wrapper)
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/**
	 * Casts a raw SuiFren unstake event.
	*
	 * The issuer and SuiFren ID are padded and the fee becomes a `bigint`.
	*
	 * @param eventOnChain - Raw event with parsed fields and metadata.
	 * @returns Public unstake event.
	 */
	public static unstakeSuiFrenEventFromOnChain = (
		eventOnChain: UnstakeSuiFrenEventOnChain
	): UnstakeSuiFrenEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			unstaker: Helpers.addLeadingZeroesToType(fields.issuer),
			suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id),
			fees: BigInt(fields.fees),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}
