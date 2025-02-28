import { ModuleName, MoveErrorCode, PackageId } from "./generalTypes";

export interface MoveErrorsInterface {
	readonly moveErrors: MoveErrors;
}

export type MoveErrors = Record<
	PackageId,
	// TODO: handle this case better
	// "ANY" | (ModuleName & {})
	Record<"ANY" | ModuleName, Record<MoveErrorCode, string>>
>;
