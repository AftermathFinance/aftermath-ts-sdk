import { AftermathApi } from "../../../general/providers/aftermathApi";

export class SuiApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}
}
