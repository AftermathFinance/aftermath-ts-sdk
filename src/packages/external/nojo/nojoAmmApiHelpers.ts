import { ObjectId } from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { NojoAddresses } from "../../../types";
import { Pool, PoolRegistry } from "@kunalabs-io/amm/src/amm/pool/structs";
import { EventOnChain } from "../../../general/types/castingTypes";

export class NojoAmmApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: NojoAddresses;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.externalRouter?.nojo;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPoolObjectIds = async (): Promise<ObjectId[]> => {
		const paginatedEvents =
			await this.Provider.Events().fetchCastEventsWithCursor<
				EventOnChain<{
					id: ObjectId;
				}>,
				ObjectId
			>(
				{
					MoveEventType: EventsApiHelpers.createEventType(
						this.addresses.packages.pool,
						"pool",
						"PoolCreationEvent"
					),
				},
				(eventOnChain) => eventOnChain.parsedJson.id
			);

		return paginatedEvents.events;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	private fetchPoolRegistry = () => {
		return PoolRegistry.fetch(
			this.Provider.provider,
			this.addresses.packages.pool
		);
	};
}
