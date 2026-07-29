/**
 * Captures the object fixtures under `tests/fixtures/objects/` from **mainnet**,
 * one pair of files per entry in `objects/manifest.json`:
 *
 *   <name>.jsonrpc.json   getObject({ options: { showContent, showType, showDisplay, showOwner } })
 *   <name>.grpc.json      getObject({ include: { json: true, display: true } })
 *
 * The `.jsonrpc.json` files pin the behaviour the casters had **before** the
 * gRPC port; the `.grpc.json` files are what they read now. Keeping both lets
 * `tests/objectCasters.test.ts` assert that the port is behaviour-preserving
 * rather than merely self-consistent.
 *
 * Fixtures drift as on-chain object versions change — regenerate rather than
 * hand-editing:
 *
 * ```sh
 * node tests/fixtures/capture.mjs            # refresh every manifest entry
 * node tests/fixtures/capture.mjs pool       # refresh one
 * ```
 *
 * ## Which endpoint serves which protocol, and why
 *
 * - **JSON-RPC comes from the Aftermath fullnode.** Sui Foundation has disabled
 *   JSON-RPC on the public fullnodes, so it is the only source left. (That
 *   disablement is the entire reason for the port these fixtures guard.)
 * - **gRPC comes from the public fullnode.** The Aftermath node's gRPC
 *   intermittently answers `BatchGetObjects` with 502 Bad Gateway. The two
 *   nodes' `json` views were verified byte-identical on the pool fixture, so
 *   this is a reliability choice, not a semantic one. Retries cover the rest.
 */

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJECTS_DIR = join(HERE, "objects");

const AFTERMATH_FULLNODE = "https://fullnode.sui.mainnet.aftermath.finance:443";
const PUBLIC_FULLNODE = "https://fullnode.mainnet.sui.io:443";

const grpc = new SuiGrpcClient({
	network: "mainnet",
	baseUrl: PUBLIC_FULLNODE,
});
const jsonRpc = new SuiJsonRpcClient({
	network: "mainnet",
	url: AFTERMATH_FULLNODE,
});

/** The Aftermath node's gRPC 502s intermittently; the public one rate-limits. */
const retry = async (label, fn, attempts = 8) => {
	let lastError;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (e) {
			lastError = e;
			await new Promise((r) => setTimeout(r, 250 * (i + 1)));
		}
	}
	throw new Error(`${label} failed after ${attempts} attempts: ${lastError}`);
};

/** `Uint8Array` and `bigint` are not JSON — nothing captured here needs them. */
const stable = (value) =>
	JSON.parse(
		JSON.stringify(value, (_k, v) =>
			v instanceof Uint8Array ? Array.from(v) : typeof v === "bigint" ? String(v) : v
		)
	);

const manifest = JSON.parse(
	await import("node:fs").then((fs) =>
		fs.promises.readFile(join(OBJECTS_DIR, "manifest.json"), "utf8")
	)
);

const only = process.argv.slice(2);
const entries = Object.entries(manifest).filter(
	([name]) => only.length === 0 || only.includes(name)
);

if (entries.length === 0) {
	console.error(
		`no manifest entries matched ${JSON.stringify(only)}; known: ${Object.keys(manifest).join(", ")}`
	);
	process.exit(1);
}

let failed = 0;
for (const [name, objectId] of entries) {
	try {
		const g = await retry(`grpc ${name}`, () =>
			grpc.getObject({ objectId, include: { json: true, display: true } })
		);
		const j = await retry(`jsonrpc ${name}`, () =>
			jsonRpc.getObject({
				id: objectId,
				options: {
					showContent: true,
					showType: true,
					showDisplay: true,
					showOwner: true,
				},
			})
		);

		// @dev: the two protocols' type strings are semantically equal but not
		// byte-equal: gRPC fully zero-pads every address (including inside generic
		// parameters) and emits no space after a generic's comma, where JSON-RPC
		// echoes the node's abbreviated form (`0x2::sui::SUI`) and keeps `, `.
		// Compare modulo that, and warn — a *semantic* disagreement means the two
		// endpoints are serving different objects and the fixture pair is invalid.
		const canonical = (type) =>
			(type ?? "").replaceAll(" ", "").replaceAll(/0x0*/g, "0x");
		if (canonical(g.object.type) !== canonical(j.data?.type)) {
			throw new Error(
				`object type disagrees across protocols: grpc=${g.object.type} jsonrpc=${j.data?.type}`
			);
		}
		if (g.object.type !== j.data?.type) {
			console.warn(
				`  note ${name}: type differs only in address padding/spacing\n    grpc    ${g.object.type}\n    jsonrpc ${j.data?.type}`
			);
		}

		await writeFile(
			join(OBJECTS_DIR, `${name}.grpc.json`),
			`${JSON.stringify(stable(g.object), null, "\t")}\n`
		);
		await writeFile(
			join(OBJECTS_DIR, `${name}.jsonrpc.json`),
			`${JSON.stringify(stable(j), null, "\t")}\n`
		);
		console.log(`captured ${name}  (${g.object.type})`);
	} catch (e) {
		failed++;
		console.error(`FAILED ${name} (${objectId}): ${e.message}`);
	}
}

if (failed > 0) {
	console.error(`\n${failed}/${entries.length} entries failed`);
	process.exit(1);
}
