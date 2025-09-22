declare module "*.wasm?url" {
	const url: string;
	export default url;
}

declare module "*.wasm" {
	const wasm: ArrayBuffer;
	export default wasm;
}
