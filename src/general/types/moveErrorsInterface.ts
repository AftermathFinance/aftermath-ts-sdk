import { ModuleName, MoveErrorCode, PackageId } from "./generalTypes";

export interface MoveErrorsInterface {
	readonly moveErrors: MoveErrors;
}

export type MoveErrors = Record<
	PackageId,
	Record<ModuleName, Record<MoveErrorCode, string>>
>;
