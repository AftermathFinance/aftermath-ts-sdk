import {
	getObjectFields,
	getObjectId,
	SuiObjectResponse,
	ObjectContentFields,
	SuiObjectInfo,
} from "@mysten/sui.js";
import {
	AnyObjectType,
	Delegation,
	StakedSui,
	SuiBalance,
} from "../../../types";
import {
	DelegationFieldsOnChain,
	StakedSuiFieldsOnChain,
} from "./suiApiCastingTypes";
import { Staking } from "../../staking/staking";

export class SuiApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static balanceFromSuiObjectResponse(
		data: SuiObjectResponse
	): SuiBalance {
		const balanceMoveFields = getObjectFields(data) as ObjectContentFields;

		return {
			objectId: getObjectId(data),
			value: balanceMoveFields.value,
		} as SuiBalance;
	}

	public static stakedSuiFromSuiObjectResponse = (
		data: SuiObjectResponse
	): StakedSui => {
		const stakedSuiMoveFields = getObjectFields(
			data
		) as StakedSuiFieldsOnChain;

		return {
			objectId: getObjectId(data),
			validatorAddress: stakedSuiMoveFields.validator_address,
			poolStartingEpoch: stakedSuiMoveFields.pool_starting_epoch,
			delegationRequestEpoch:
				stakedSuiMoveFields.delegation_request_epoch,
			principal: BigInt(stakedSuiMoveFields.principal),
		};
	};

	public static delegationFromSuiObjectResponse = (
		data: SuiObjectResponse
	): Delegation => {
		const delegationMoveFields = getObjectFields(
			data
		) as DelegationFieldsOnChain;

		return {
			objectId: getObjectId(data),
			stakedSuiId: delegationMoveFields.staked_sui_id,
			poolTokens: BigInt(delegationMoveFields.pool_tokens),
			principalSuiAmount: BigInt(
				delegationMoveFields.principal_sui_amount
			),
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Type Checking
	/////////////////////////////////////////////////////////////////////

	public static isStakedSui = (suiObjectInfo: SuiObjectInfo): boolean =>
		suiObjectInfo.type === Staking.constants.objectTypes.stakedSuiType;

	public static isDelegation = (suiObjectInfo: SuiObjectInfo): boolean =>
		suiObjectInfo.type === Staking.constants.objectTypes.delegationType;

	public static isStakeVaultKeyType = (type: AnyObjectType) =>
		type.split(",")[0].includes("VaultKey");
}
