import {
	GrpcCasting,
	Helpers,
	type SuiObjectView,
} from "../../../general/utils";
import { Coin } from "../../coin";
import { PoolsApiCasting } from "../../pools/api/poolsApiCasting";
import type { NftAmmMarketObject } from "../nftAmmTypes";
import type { NftAmmMarketFieldsOnChain } from "./nftAmmApiCastingTypes";

/**
 * Converts raw NFT AMM Sui object views into SDK market objects.
 *
 * These methods are local casts only. They do not fetch missing nested objects
 * or recover Move type information that is absent from the input response.
 */
export class NftAmmApiCasting {
	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Converts a raw Sui object view into an `NftAmmMarketObject`.
	 *
	 * @param suiObject - Top-level NFT AMM market object view with raw fields.
	 * @returns The market object with bigint balances, table data, and Move types.
	 * @throws `Error` when the top-level object type is missing or nested pool and
	 * supply type information cannot be read by the current caster.
	 *
	 * @remarks ⚠️ **Two of this caster's reads need a *nested* Move struct's own
	 * `type`, which neither protocol supplies — so it throws, exactly as it did
	 * before the gRPC port.** It is kept source-compatible (same signature, same
	 * `NftAmmMarketObject` shape) rather than deleted, and the blocked reads are
	 * marked inline.
	 *
	 * - `fields.pool` is a nested `Pool<L>` handed to
	 *   {@link PoolsApiCasting.poolObjectFromSuiObject}, which needs the pool's
	 *   Move type for `objectType` and `lpCoinType`.
	 * - `fields.supply` is a nested `Supply<F>` whose `type` gave
	 *   `fractionalizedCoinType`.
	 *
	 * Under JSON-RPC a nested struct arrived as `{ type, fields }`, which is not
	 * a `SuiObjectResponse`, so the pre-port code already threw
	 * `no object id found on undefined` at its first nested read (verified
	 * against the source at `d4706127`). Under gRPC nested structs lose `type`
	 * outright, so the `lp_supply` recovery that fixed the *top-level* pool
	 * caster does not apply: the market's own type parameters do not name the
	 * pool's package. Recovering it needs the Move type layouts this SDK does not
	 * carry, and guessing a generic's position would produce a silently wrong
	 * `lpCoinType`, so the failure is left to surface.
	 *
	 * NftAmm is also **not deployed on mainnet** — `getAddresses()` returns empty
	 * strings for every `nftAmm` package and object — which is why there is no
	 * captured fixture for it. Fix the nested reads by fetching the pool as a
	 * top-level object by id.
	 */
	public static marketObjectFromSuiObject = (
		suiObject: SuiObjectView
	): NftAmmMarketObject => {
		const objectId = Helpers.getObjectId(suiObject);
		const marketType = Helpers.getObjectType(suiObject);
		if (!marketType) {
			throw new Error("no object type found");
		}

		const fields = Helpers.getObjectFields(
			suiObject
		) as NftAmmMarketFieldsOnChain;

		// @dev: nested `Table` and `Supply` structs lost their `{ type, fields }`
		// envelope over gRPC; these two reads port cleanly.
		const nfts = GrpcCasting.unwrapStructField(fields.nfts);
		const supply = GrpcCasting.unwrapStructField(fields.supply);

		// @dev: BLOCKED — see the remarks above. A nested struct carries no
		// `objectId` and no `type` on either protocol, so this throws inside
		// `Helpers.getObjectType`. Reconstructed rather than faked so that the
		// throw is the accurate "no object type found", and so this starts working
		// unchanged if the pool is ever fetched as a top-level object.
		const pool = PoolsApiCasting.poolObjectFromSuiObject({
			...GrpcCasting.unwrapStructField(fields.pool),
			objectId: undefined,
			type: undefined,
		} as unknown as SuiObjectView);

		// @dev: BLOCKED for the same reason — gRPC drops the nested `Supply<F>`'s
		// `type`. Left reading it so the value is `undefined` rather than a guess
		// at a generic's position.
		const fractionalizedCoinType = Coin.getInnerCoinType(
			(fields.supply as { type: string }).type
		);

		const innerMarketTypes = Coin.getInnerCoinType(marketType);
		const genericTypes = innerMarketTypes.replaceAll(" ", "").split(",");

		const assetCoinType = genericTypes[2];
		const nftType = genericTypes[3];

		return {
			objectId,
			pool,
			objectType: marketType,
			nftsTable: {
				objectId: GrpcCasting.unwrapUid(nfts.id),
				size: BigInt(nfts.size),
			},
			fractionalizedSupply: BigInt(supply.value),
			fractionalizedCoinAmount: BigInt(fields.fractions_amount),
			fractionalizedCoinType,
			assetCoinType,
			lpCoinType: pool.lpCoinType,
			nftType,
		};
	};
}
