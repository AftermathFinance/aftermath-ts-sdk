import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const docsRoot = path.join(root, "docs");
const sourceRoot = path.join(root, "src");
const outputRoot = path.join(root, ".docs-site");
const generatedDocumentsRoot = path.join(outputRoot, "documents");
const expectedProjectDocuments = ["docs/guides/*.md", "docs/explanation/*.md"];
const publicDocumentDirectories = [
	path.join(docsRoot, "guides"),
	path.join(docsRoot, "explanation"),
];
const generatedDocumentationDirectories = new Set([
	"assets",
	"classes",
	"documents",
	"enums",
	"functions",
	"interfaces",
	"modules",
	"types",
	"variables",
]);
const generatedFilePattern = /\.html?$/iu;
const excludedGeneratedPaths = [
	"modules/general_priceFeeds_priceFeeds.html",
	"modules/general_priceFeeds_priceFeedsApi.html",
	"modules/general_priceFeeds_priceFeedsTypes.html",
	"modules/packages_referralVault_referralVaultTypes.html",
	"variables/general_priceFeeds_priceFeeds.default.html",
	"variables/general_priceFeeds_priceFeedsApi.default.html",
	"variables/general_priceFeeds_priceFeedsTypes.default.html",
];
const sensitivePatterns = [
	{
		name: "private key block",
		pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/u,
	},
	{
		name: "AWS access key",
		pattern: /\bAKIA[0-9A-Z]{16}\b/u,
	},
	{
		name: "GitHub access token",
		pattern:
			/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u,
	},
	{
		name: "npm access token",
		pattern: /\bnpm_[A-Za-z0-9]{30,}\b/u,
	},
	{
		name: "JWT",
		pattern:
			/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
	},
	{
		name: "bearer credential",
		pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/iu,
	},
	{
		name: "local user path",
		pattern:
			/(?:\/home\/[^\s"'`<)]+|\/Users\/[^\s"'`<)]+|[A-Z]:\\Users\\[^\s"'`<)]+)/u,
	},
];

function relativePath(filePath) {
	return path.relative(root, filePath).split(path.sep).join("/");
}

function markdownFilesUnder(directory) {
	if (!fs.existsSync(directory)) {
		return [];
	}

	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const filePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...markdownFilesUnder(filePath));
		} else if (entry.name.endsWith(".md")) {
			files.push(filePath);
		}
	}
	return files;
}

function filesUnder(directory) {
	if (!fs.existsSync(directory)) {
		return [];
	}

	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const filePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...filesUnder(filePath));
		} else {
			files.push(filePath);
		}
	}
	return files;
}

function generatedDocumentPath(sourcePath) {
	const source = relativePath(sourcePath);
	const documentName = source
		.slice("docs/".length, -".md".length)
		.replaceAll("/", "_");
	return `documents/${documentName}.html`;
}

function generatedOutputPath(filePath) {
	return path.relative(outputRoot, filePath).split(path.sep).join("/");
}

function setDifference(left, right) {
	return [...left].filter((value) => !right.has(value)).sort();
}

const failures = [];
const typedocConfig = JSON.parse(
	fs.readFileSync(path.join(root, "typedoc.json"), "utf8")
);

if (
	JSON.stringify(typedocConfig.projectDocuments) !==
	JSON.stringify(expectedProjectDocuments)
) {
	failures.push(
		`typedoc.json projectDocuments must be exactly ${JSON.stringify(expectedProjectDocuments)}`
	);
}

const publicSourceFiles = publicDocumentDirectories
	.flatMap(markdownFilesUnder)
	.sort();
const allSourceFiles = markdownFilesUnder(docsRoot).sort();
const publicSourceSet = new Set(publicSourceFiles);
const privateSourceFiles = allSourceFiles.filter(
	(filePath) => !publicSourceSet.has(filePath)
);
const expectedGeneratedDocuments = new Set(
	publicSourceFiles.map(generatedDocumentPath)
);
const actualGeneratedDocuments = new Set(
	filesUnder(generatedDocumentsRoot)
		.filter((filePath) => filePath.endsWith(".html"))
		.map(generatedOutputPath)
);
const actualGeneratedFiles = new Set(
	filesUnder(outputRoot).map(generatedOutputPath)
);

if (!fs.existsSync(outputRoot)) {
	failures.push(".docs-site does not exist; run bun run docs:generate first");
}

for (const filePath of setDifference(
	expectedGeneratedDocuments,
	actualGeneratedDocuments
)) {
	failures.push(`missing public document page: ${filePath}`);
}

for (const filePath of setDifference(
	actualGeneratedDocuments,
	expectedGeneratedDocuments
)) {
	failures.push(`unexpected generated document page: ${filePath}`);
}

for (const sourcePath of privateSourceFiles) {
	const generatedPath = generatedDocumentPath(sourcePath);
	if (actualGeneratedDocuments.has(generatedPath)) {
		failures.push(
			`private Markdown was published: ${relativePath(sourcePath)} -> ${generatedPath}`
		);
	}
}

for (const generatedPath of excludedGeneratedPaths) {
	if (actualGeneratedFiles.has(generatedPath)) {
		failures.push(`excluded TypeDoc output was generated: ${generatedPath}`);
	}
}

for (const docsFile of filesUnder(docsRoot)) {
	const trackedFile = relativePath(docsFile);
	const parts = trackedFile.split("/");
	const isGeneratedFile =
		trackedFile === "docs/.nojekyll" ||
		generatedFilePattern.test(trackedFile) ||
		(parts.length > 1 && generatedDocumentationDirectories.has(parts[1]));
	if (isGeneratedFile) {
		failures.push(`generated documentation is tracked: ${trackedFile}`);
	}
}

const filesToScan = [
	path.join(root, "README.md"),
	...allSourceFiles,
	...filesUnder(sourceRoot).filter((filePath) => filePath.endsWith(".ts")),
	...filesUnder(outputRoot),
];
const securityFindings = [];
for (const filePath of filesToScan) {
	const content = fs.readFileSync(filePath, "utf8");
	for (const { name, pattern } of sensitivePatterns) {
		if (pattern.test(content)) {
			securityFindings.push(`${name}: ${relativePath(filePath)}`);
		}
	}
}

for (const finding of securityFindings) {
	failures.push(`possible sensitive content: ${finding}`);
}

console.log(
	JSON.stringify(
		{
			publicSourceFiles: publicSourceFiles.map(relativePath),
			privateSourceFiles: privateSourceFiles.map(relativePath),
			generatedDocumentPages: [...actualGeneratedDocuments].sort(),
			scannedFiles: filesToScan.length,
			securityFindings,
			failures,
		},
		null,
		2
	)
);

if (failures.length > 0) {
	process.exitCode = 1;
}
