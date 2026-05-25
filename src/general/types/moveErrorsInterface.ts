import type {
	ModuleName,
	MoveErrorCode,
	ObjectId,
	PackageId,
} from "./generalTypes";

export interface MoveErrorsInterface {
	readonly moveErrors: MoveErrors;
}

export type MoveErrors = Record<
	PackageId,
	// TODO: handle this case better
	// "ANY" | (ModuleName & {})
	Record<"ANY" | ModuleName, Record<MoveErrorCode, string>>
>;

/** Parsed location of a Move abort, the output of `Helpers.parseMoveErrorMessage`. */
export interface ParsedMoveError {
	errorCode: MoveErrorCode;
	packageId: ObjectId;
	module: ModuleName;
}

/** Parsed Move abort plus the human-readable message resolved from the registry. */
export interface TranslatedMoveError extends ParsedMoveError {
	error: string;
}
