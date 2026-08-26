import { execFileSync } from "node:child_process";
import process from "node:process";

const readmePattern = /^README(?:\.|$)/iu;
const licensePattern = /^LICENSE(?:\.|$)/iu;

const output = execFileSync(
	"npm",
	["pack", "--dry-run", "--ignore-scripts", "--json"],
	{
		cwd: process.cwd(),
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	}
);
const packResult = JSON.parse(output);
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
