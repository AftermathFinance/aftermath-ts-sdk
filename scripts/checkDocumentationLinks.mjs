import fs from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const whitespacePattern = /\s+/u;
const externalTargetPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

async function markdownFilesUnder(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const filePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await markdownFilesUnder(filePath)));
		} else if (entry.name.endsWith(".md")) {
			files.push(filePath);
		}
	}

	return files;
}

function headingSlug(heading) {
	return heading
		.toLowerCase()
		.replace(/[`*_~]/g, "")
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

function headingsIn(markdown) {
	const headings = new Set();
	for (const match of markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
		headings.add(headingSlug(match[1]));
	}
	return headings;
}

function targetFromMarkdownLink(rawTarget) {
	const target = rawTarget.trim();
	if (target.startsWith("<")) {
		const closingBracket = target.indexOf(">");
		return closingBracket === -1 ? target : target.slice(1, closingBracket);
	}
	return target.split(whitespacePattern, 1)[0];
}

function isExternalTarget(target) {
	return externalTargetPattern.test(target);
}

function splitTarget(target) {
	const hashIndex = target.indexOf("#");
	if (hashIndex === -1) {
		return { fileTarget: target, anchor: undefined };
	}
	return {
		fileTarget: target.slice(0, hashIndex),
		anchor: target.slice(hashIndex + 1),
	};
}

function decodeTarget(target) {
	try {
		return decodeURIComponent(target);
	} catch {
		return target;
	}
}

const markdownFiles = [
	path.join(root, "README.md"),
	...(await markdownFilesUnder(path.join(root, "docs"))),
];
const headingsByFile = new Map();
const invalid = [];
let checkedLinks = 0;

for (const filePath of markdownFiles) {
	const markdown = await readFile(filePath, "utf8");
	headingsByFile.set(filePath, headingsIn(markdown));
}

for (const filePath of markdownFiles) {
	const markdown = await readFile(filePath, "utf8");
	for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
		const target = targetFromMarkdownLink(match[1]);
		if (!target || isExternalTarget(target)) {
			continue;
		}

		const { fileTarget, anchor } = splitTarget(decodeTarget(target));
		const targetPath = fileTarget
			? path.resolve(path.dirname(filePath), fileTarget)
			: filePath;
		checkedLinks += 1;

		if (fileTarget && !fs.existsSync(targetPath)) {
			invalid.push({
				file: path.relative(root, filePath),
				target,
				reason: `target does not exist: ${path.relative(root, targetPath)}`,
			});
			continue;
		}

		if (anchor && targetPath.toLowerCase().endsWith(".md")) {
			const targetHeadings =
				headingsByFile.get(targetPath) ??
				headingsIn(await readFile(targetPath, "utf8"));
			if (!targetHeadings.has(headingSlug(anchor))) {
				invalid.push({
					file: path.relative(root, filePath),
					target,
					reason: `heading does not exist in ${path.relative(root, targetPath)}`,
				});
			}
		}
	}
}

const result = {
	markdownFiles: markdownFiles.length,
	checkedLinks,
	invalidLinks: invalid.length,
	invalid,
};

console.log(JSON.stringify(result, null, 2));
if (invalid.length > 0) {
	process.exitCode = 1;
}
