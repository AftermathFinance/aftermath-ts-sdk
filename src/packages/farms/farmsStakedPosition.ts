import { Caller } from "../../general/utils/caller";
import { FarmsStakedPositionObject, SuiNetwork, Url } from "../../types";

export class FarmsStakedPosition extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Private Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly stakedPosition: FarmsStakedPositionObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `farms/staked-positions/${stakedPosition.objectId}`);
		this.stakedPosition = stakedPosition;
	}
}
