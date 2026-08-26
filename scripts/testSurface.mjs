import { readdir, readFile } from "node:fs/promises";
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
const testFiles = (await filesUnder(testsRoot)).filter((file) =>
	file.endsWith(".test.ts")
);
const testSources = await Promise.all(
	testFiles.map(async (file) => ({
		file,
		text: await readFile(file, "utf8"),
	}))
);

const sourceAreas = [
	"general",
	...(
		await readdir(path.join(sourceRoot, "packages"), {
			withFileTypes: true,
		})
	)
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name),
];

const areaRows = sourceAreas.map((area) => {
	const marker = area === "general" ? "src/general/" : `src/packages/${area}/`;
	const matchingTests = testSources
		.filter(
			({ file, text }) =>
				text.includes(marker) ||
				path.basename(file).toLowerCase().includes(area.toLowerCase())
		)
		.map(({ file }) => path.relative(root, file));
	const sourceCount = sourceFiles.filter((file) => {
		const parts = path.relative(sourceRoot, file).split(path.sep);
		const fileArea = parts[0] === "packages" ? parts[1] : parts[0];
		return fileArea === area;
	}).length;
	return { area, sourceCount, matchingTests };
});

const directReferences = sourceFiles.map((file) => {
	const relative = path.relative(root, file).replaceAll(path.sep, "/");
	const referencedBy = testSources
		.filter(({ text }) => text.includes(relative))
		.map(({ file: testFile }) => path.relative(root, testFile));
	return { relative, referencedBy };
});

console.log("SDK test surface");
console.log(`source modules: ${sourceFiles.length}`);
console.log(`test files: ${testFiles.length}`);
console.log("");
for (const row of areaRows) {
	console.log(
		`${row.matchingTests.length > 0 ? "PASS" : "MISS"} ${row.area}: ${row.sourceCount} modules -> ${row.matchingTests.join(", ") || "no direct slice"}`
	);
}

const unreferenced = directReferences.filter(
	(row) => row.referencedBy.length === 0
);
console.log("");
console.log(
	`modules with a direct source-path reference: ${sourceFiles.length - unreferenced.length}/${sourceFiles.length}`
);
console.log(`modules without a direct source-path import: ${unreferenced.length}`);
if (process.argv.includes("--list-unreferenced")) {
	for (const row of unreferenced) {
		console.log(`  ${row.relative}`);
	}
}

if (strict && areaRows.some((row) => row.matchingTests.length === 0)) {
	console.error(
		"\nStrict surface audit failed: every source area needs a test slice."
	);
	process.exitCode = 1;
}
