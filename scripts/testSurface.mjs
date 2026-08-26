import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const testsRoot = path.join(root, "tests");
const strict = process.argv.includes("--strict");
const coveragePath = path.join(root, "coverage/coverage-summary.json");

async function filesUnder(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await filesUnder(entryPath)));
		} else {
			files.push(entryPath);
		}
	}
	return files;
}

const sourceFiles = (await filesUnder(sourceRoot))
	.filter((file) => file.endsWith(".ts"))
	.filter((file) => path.basename(file) !== "index.ts")
	.filter((file) => !path.basename(file).endsWith("Types.ts"));
const allTestSources = (await filesUnder(testsRoot)).filter(
	(file) =>
		file.endsWith(".ts") &&
		!path.relative(testsRoot, file).split(path.sep).includes("legacy")
);
const testFiles = allTestSources.filter((file) => file.endsWith(".test.ts"));

let coverageSummary;
try {
	coverageSummary = JSON.parse(await readFile(coveragePath, "utf8"));
} catch {
	coverageSummary = undefined;
}

const sourceAreas = [
	"root",
	"general",
	...(
		await readdir(path.join(sourceRoot, "packages"), {
			withFileTypes: true,
		})
	)
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort(),
];

function testArea(file) {
	const parts = path.relative(testsRoot, file).split(path.sep);
	if (parts[0] === "general") {
		return "general";
	}
	if (parts[0] === "packages") {
		return parts[1];
	}
	return undefined;
}

function sourceArea(file) {
	const parts = path.relative(sourceRoot, file).split(path.sep);
	if (parts.length === 1) {
		return "root";
	}
	return parts[0] === "packages" ? parts[1] : parts[0];
}

const areaRows = sourceAreas.map((area) => {
	const sourceCount = sourceFiles.filter(
		(file) => sourceArea(file) === area
	).length;
	const matchingTests =
		area === "root"
			? ["coverage-backed shared entrypoint tests"]
			: testFiles
					.filter((file) => testArea(file) === area)
					.map((file) => path.relative(root, file));
	return { area, sourceCount, matchingTests };
});

const sourceCoverage = sourceFiles.map((file) => ({
	file,
	coverage: coverageSummary?.[path.resolve(file)],
}));
const missingCoverage = sourceCoverage.filter((row) => !row.coverage);
const unexecutedModules = sourceCoverage.filter(
	(row) =>
		row.coverage?.statements?.total > 0 && row.coverage.statements.covered === 0
);

console.log("SDK test surface");
console.log(`source modules: ${sourceFiles.length}`);
console.log(`test files: ${testFiles.length}`);
console.log("");
for (const row of areaRows) {
	console.log(
		`${row.matchingTests.length > 0 ? "PASS" : "MISS"} ${row.area}: ${row.sourceCount} modules -> ${row.matchingTests.join(", ") || "no test slice"}`
	);
}

console.log("");
const crossCuttingCount = testFiles.filter((file) => !testArea(file)).length;
console.log(`cross-cutting test files: ${crossCuttingCount}`);

if (coverageSummary) {
	console.log(
		`coverage-backed source modules: ${sourceCoverage.length - missingCoverage.length}/${sourceCoverage.length}`
	);
	if (unexecutedModules.length > 0) {
		console.log(
			`unexecuted source modules: ${unexecutedModules.map((row) => path.relative(root, row.file)).join(", ")}`
		);
	}
} else {
	console.log(
		"coverage-backed source modules: unavailable (run test:ci or test:coverage first)"
	);
}

if (strict) {
	const failures = [];
	if (areaRows.some((row) => row.matchingTests.length === 0)) {
		failures.push("every source area needs a test slice");
	}
	if (!coverageSummary) {
		failures.push(
			"coverage data is required; run test:ci or test:coverage first"
		);
	}
	if (missingCoverage.length > 0) {
		failures.push(
			`coverage is missing for ${missingCoverage.length} source module(s)`
		);
	}
	if (unexecutedModules.length > 0) {
		failures.push(
			`${unexecutedModules.length} source module(s) have zero covered statements`
		);
	}
	if (failures.length > 0) {
		console.error(`\nStrict surface audit failed: ${failures.join("; ")}.`);
		process.exitCode = 1;
	}
}
