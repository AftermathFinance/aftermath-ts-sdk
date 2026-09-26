import { access, readFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import process from "node:process";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root)));
const checks = [];
const warnings = [];
const mapPathPattern =
	/`((?:\.github|src|tests|scripts|docs)\/[A-Za-z0-9_./-]+|[A-Za-z0-9_.-]+\.(?:md|json|ts|mjs|yml|yaml))`/g;
const mapLinkPattern = /\]\(([^)#]+)(?:#[^)]*)?\)/g;

async function check(name, path, repair) {
	try {
		await access(new URL(path, root));
		checks.push({ name, ok: true });
	} catch {
		checks.push({ name, ok: false, repair });
	}
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
checks.push({
	name: "Node.js >= 20",
	ok: nodeMajor >= 20,
	...(nodeMajor < 20 ? { repair: "Use Node.js 22, matching CI." } : {}),
});
checks.push({
	name: "Bun package manager selected",
	ok: packageJson.packageManager?.startsWith("bun@") === true,
	...(packageJson.packageManager?.startsWith("bun@")
		? {}
		: { repair: "Use the package manager declared in package.json." }),
});

const bunCandidates = (process.env.PATH ?? "")
	.split(delimiter)
	.map((directory) => join(directory, "bun"));
if (process.env.npm_execpath?.endsWith("/bun")) {
	bunCandidates.unshift(process.env.npm_execpath);
}
let bunAvailable = false;
for (const candidate of bunCandidates) {
	try {
		await access(candidate);
		bunAvailable = true;
		break;
	} catch {
		// Continue to the next PATH entry.
	}
}
checks.push({
	name: "Bun executable",
	ok: bunAvailable,
	...(bunAvailable
		? {}
		: { repair: "Install Bun, then run bun install --frozen-lockfile." }),
});
const runningBun = process.env.npm_config_user_agent?.match(
	/\bbun\/(\d+\.\d+\.\d+)/
)?.[1];
const declaredBun = packageJson.packageManager?.split("@")[1];
if (runningBun && declaredBun && runningBun !== declaredBun) {
	warnings.push(
		`Bun ${runningBun} is running; CI uses ${declaredBun}. Use the CI version when reproducing an environment-specific failure.`
	);
}

await check(
	"Bun lockfile",
	"bun.lock",
	"Restore bun.lock from the repository."
);
await check(
	"Installed SDK dependencies",
	"node_modules/@mysten/sui/package.json",
	"Run bun install --frozen-lockfile."
);
await check(
	"TypeScript compiler",
	"node_modules/typescript/bin/tsc",
	"Run bun install --frozen-lockfile."
);
await check(
	"SDK capability map",
	"docs/AGENT_CAPABILITIES.md",
	"Restore docs/AGENT_CAPABILITIES.md."
);
await check(
	"Public contract verifier",
	"scripts/verifyPublicContract.mjs",
	"Restore scripts/verifyPublicContract.mjs."
);
let capabilityMap = "";
try {
	capabilityMap = await readFile(
		new URL("docs/AGENT_CAPABILITIES.md", root),
		"utf8"
	);
} catch {
	// The missing map is reported above.
}
for (const path of new Set(
	[...capabilityMap.matchAll(mapPathPattern)].map((match) => match[1])
)) {
	await check(
		`capability path ${path}`,
		path,
		`Update or restore ${path} in the capability map.`
	);
}
for (const link of new Set(
	[...capabilityMap.matchAll(mapLinkPattern)].map((match) => match[1])
)) {
	if (/^[a-z]+:/i.test(link)) {
		continue;
	}
	await check(
		`capability link ${link}`,
		new URL(link, new URL("docs/AGENT_CAPABILITIES.md", root)),
		`Update or restore the ${link} link in the capability map.`
	);
}
for (const name of [
	"test:focused",
	"test:ci",
	"test:surface:strict",
	"typecheck:tests",
	"test:release",
	"build",
	"docs:audit:strict",
	"docs:generate",
	"docs:check-links",
	"docs:check-site",
	"package:check",
	"verify:public",
	"agent:doctor",
]) {
	checks.push({
		name: `package script ${name}`,
		ok: typeof packageJson.scripts?.[name] === "string",
		...(typeof packageJson.scripts?.[name] === "string"
			? {}
			: { repair: `Restore the ${name} script in package.json.` }),
	});
}

const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ ok, checks, warnings }, null, 2));
if (!ok) {
	process.exitCode = 1;
}
