import { execFileSync } from "node:child_process";
import process from "node:process";

const readmePattern = /^README(?:\.|$)/iu;
const licensePattern = /^LICENSE(?:\.|$)/iu;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: JSON string and nesting state must be tracked while isolating npm output.
const findJsonArrayEnd = (output, start) => {
	let depth = 0;
	let escaped = false;
	let inString = false;

	for (let index = start; index < output.length; index += 1) {
		const character = output[index];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (character === "\\") {
				escaped = true;
			} else if (character === '"') {
				inString = false;
			}
			continue;
		}

		if (character === '"') {
			inString = true;
			continue;
		}
		if (character === "[") {
			depth += 1;
			continue;
		}
		if (character === "]") {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}

	return -1;
};

const tryParsePackResult = (output, start) => {
	const end = findJsonArrayEnd(output, start);
	if (end === -1) {
		return null;
	}

	try {
		const parsed = JSON.parse(output.slice(start, end + 1));
		return Array.isArray(parsed) && parsed[0]?.files ? parsed : null;
	} catch {
		return null;
	}
};

const parsePackResult = (output) => {
	// npm can prepend lifecycle output (for example, prepare) to stdout before
	// the JSON result. Find and parse the complete top-level JSON array instead
	// of assuming that the result starts at byte zero.
	for (const candidate of output.matchAll(/^[\t ]*\[/gmu)) {
		const start = (candidate.index ?? 0) + candidate[0].length - 1;
		const parsed = tryParsePackResult(output, start);
		if (parsed) {
			return parsed;
		}
	}

	throw new Error("npm pack did not return a valid JSON manifest.");
};

const output = execFileSync(
	"npm",
	["pack", "--dry-run", "--ignore-scripts", "--json"],
	{
		cwd: process.cwd(),
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	}
);
const packResult = parsePackResult(output);
const files = packResult[0]?.files?.map((file) => file.path) ?? [];
const allowed = (file) =>
	file === "package.json" ||
	readmePattern.test(file) ||
	licensePattern.test(file) ||
	file.startsWith("dist/");
const unexpected = files.filter((file) => !allowed(file));
const required = ["dist/index.js", "dist/index.d.ts"];
const missing = required.filter((file) => !files.includes(file));
const result = {
	fileCount: files.length,
	files,
	unexpected,
	missing,
};

console.log(JSON.stringify(result, null, 2));
if (unexpected.length > 0 || missing.length > 0) {
	process.exitCode = 1;
}
