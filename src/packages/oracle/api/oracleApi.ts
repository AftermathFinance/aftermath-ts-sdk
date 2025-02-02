import { Transaction } from "@mysten/sui/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import { IFixedAsString, IFixedAsStringBytes, ObjectId } from "../../../types";
import { IFixedUtils } from "../../../general/utils/iFixedUtils";

export class OracleApi {
	constructor(private readonly Provider: AftermathApi) {}
}
