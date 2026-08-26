import type {
	ModuleName,
	MoveErrorCode,
	ObjectId,
	PackageId,
} from "./generalTypes";

/**
 * Contract implemented by providers that expose a Move-error translation
 * table for their deployed package.
 */
export interface MoveErrorsInterface {
	/** Package-, module-, and error-code mappings used for translation. */
	readonly moveErrors: MoveErrors;
}

/**
 * Move abort messages keyed by package ID, module name, and numeric error code.
 *
 * The module key may be `"ANY"` to provide a package-wide fallback. Translation
 * checks the exact module before it checks that fallback.
 */
export type MoveErrors = Record<
	PackageId,
	// TODO: handle this case better
	// "ANY" | (ModuleName & {})
	Record<"ANY" | ModuleName, Record<MoveErrorCode, string>>
>;

/** Parsed location of a Move abort, the output of `Helpers.parseMoveErrorMessage`. */
export interface ParsedMoveError {
	/** Numeric abort code emitted by the Move package. */
	errorCode: MoveErrorCode;
	/** Published package ID that emitted the abort. */
	packageId: ObjectId;
	/** Move module that emitted the abort. */
	module: ModuleName;
}

/** Parsed Move abort plus the human-readable message resolved from the registry. */
export interface TranslatedMoveError extends ParsedMoveError {
	/** Human-readable message mapped from the package, module, and error code. */
	error: string;
}
