export function assert(condition: boolean, errorMessage: string) {
	if (!condition) {
		throw new Error(errorMessage);
	}
}
