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
export class SuiFrensApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	// TODO: handle leading 0s for ALL castings

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
