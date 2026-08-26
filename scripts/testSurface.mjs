import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const testsRoot = path.join(root, "tests");
const strict = process.argv.includes("--strict");

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

const sourceAreas = [
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

const areaRows = sourceAreas.map((area) => {
	const matchingTests = testFiles
		.filter((file) => testArea(file) === area)
		.map((file) => path.relative(root, file));
	const sourceCount = sourceFiles.filter((file) => {
		const parts = path.relative(sourceRoot, file).split(path.sep);
		const fileArea = parts[0] === "packages" ? parts[1] : parts[0];
		return fileArea === area;
	}).length;
	return { area, sourceCount, matchingTests };
});

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

if (strict && areaRows.some((row) => row.matchingTests.length === 0)) {
	console.error(
		"\nStrict surface audit failed: every source area needs a test slice."
	);
	process.exitCode = 1;
}
