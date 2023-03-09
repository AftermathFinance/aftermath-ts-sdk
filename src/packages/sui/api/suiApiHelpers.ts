import { AftermathApi } from "../../../general/providers/aftermathApi";

export class SuiApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(protected readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}
}
