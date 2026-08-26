import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const strict = process.argv.includes("--strict");
const json = process.argv.includes("--json");

async function filesUnder(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await filesUnder(entryPath)));
		} else if (entry.name.endsWith(".ts")) {
			files.push(entryPath);
		}
	}

	return files;
}

function hasModifier(node, kind) {
	return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function commentPartText(part) {
	if (!part) {
		return "";
	}
	if (typeof part === "string") {
		return part;
	}
	return part.text ?? "";
}

function documentationText(node) {
	const docs = node.jsDoc ?? [];
	const descriptions = docs.flatMap((doc) => {
		const description = Array.isArray(doc.comment)
			? doc.comment.map(commentPartText).join("")
			: commentPartText(doc.comment);
		const tags = (doc.tags ?? []).map((tag) => {
			const tagName = tag.tagName?.text ?? "";
			const tagComment = Array.isArray(tag.comment)
				? tag.comment.map(commentPartText).join("")
				: commentPartText(tag.comment);
			return `${tagName} ${tagComment}`;
		});
		return [description, ...tags];
	});

	return descriptions.join(" ").replace(/\s+/g, " ").trim();
}

function documentationNode(node) {
	if (ts.isVariableDeclaration(node)) {
		return node.parent.parent;
	}
	return node;
}

function isMeaningfullyDocumented(node) {
	return documentationText(documentationNode(node)).length > 0;
}

function sourceLocation(node) {
	const sourceFile = node.getSourceFile();
	const position = sourceFile.getLineAndCharacterOfPosition(
		node.getStart(sourceFile)
	);
	return {
		file: path.relative(root, sourceFile.fileName),
		line: position.line + 1,
	};
}

function nameOf(node) {
	if (node.name) {
		return node.name.getText();
	}
	if (ts.isConstructorDeclaration(node)) {
		return "constructor";
	}
	if (ts.isCallSignatureDeclaration(node)) {
		return "call signature";
	}
	if (ts.isConstructSignatureDeclaration(node)) {
		return "construct signature";
	}
	if (ts.isIndexSignatureDeclaration(node)) {
		return "index signature";
	}
	return ts.SyntaxKind[node.kind];
}

function kindOf(node) {
	if (ts.isClassDeclaration(node)) {
		return "class";
	}
	if (ts.isInterfaceDeclaration(node)) {
		return "interface";
	}
	if (ts.isTypeAliasDeclaration(node)) {
		return "type";
	}
	if (ts.isEnumDeclaration(node)) {
		return "enum";
	}
	if (ts.isEnumMember(node)) {
		return "enum member";
	}
	if (ts.isFunctionDeclaration(node)) {
		return "function";
	}
	if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
		return "method";
	}
	if (ts.isGetAccessorDeclaration(node)) {
		return "getter";
	}
	if (ts.isSetAccessorDeclaration(node)) {
		return "setter";
	}
	if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
		return "field";
	}
	if (ts.isConstructorDeclaration(node)) {
		return "constructor";
	}
	if (ts.isCallSignatureDeclaration(node)) {
		return "call signature";
	}
	if (ts.isConstructSignatureDeclaration(node)) {
		return "construct signature";
	}
	if (ts.isIndexSignatureDeclaration(node)) {
		return "index signature";
	}
	if (ts.isVariableDeclaration(node)) {
		return "constant";
	}
	return ts.SyntaxKind[node.kind];
}

function addRequirement(
	requirements,
	node,
	kind,
	name = nameOf(node),
	container = undefined
) {
	if (!name || name.startsWith("__")) {
		return;
	}
	const location = sourceLocation(node);
	requirements.push({
		...location,
		kind,
		name,
		...(container ? { container } : {}),
		documented: isMeaningfullyDocumented(node),
	});
}

function isPublicMember(node) {
	return !(
		hasModifier(node, ts.SyntaxKind.PrivateKeyword) ||
		hasModifier(node, ts.SyntaxKind.ProtectedKeyword) ||
		node.name?.getText().startsWith("#")
	);
}

function visitTypeMembers(typeNode, requirements, container) {
	if (!(typeNode && ts.isTypeLiteralNode(typeNode))) {
		return;
	}
	for (const member of typeNode.members) {
		if (
			ts.isPropertySignature(member) ||
			ts.isMethodSignature(member) ||
			ts.isCallSignatureDeclaration(member) ||
			ts.isConstructSignatureDeclaration(member) ||
			ts.isIndexSignatureDeclaration(member)
		) {
			addRequirement(
				requirements,
				member,
				kindOf(member),
				nameOf(member),
				container
			);
		}
	}
}

function collectRequirements(sourceFiles) {
	const requirements = [];

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AST traversal keeps the public-symbol rules together.
	function visit(node) {
		if (ts.isSourceFile(node)) {
			for (const statement of node.statements) {
				if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
					if (ts.isVariableStatement(statement)) {
						for (const declaration of statement.declarationList.declarations) {
							addRequirement(requirements, declaration, "constant");
						}
					} else if (
						ts.isFunctionDeclaration(statement) ||
						ts.isClassDeclaration(statement) ||
						ts.isInterfaceDeclaration(statement) ||
						ts.isTypeAliasDeclaration(statement) ||
						ts.isEnumDeclaration(statement)
					) {
						addRequirement(requirements, statement, kindOf(statement));
					}
				}
			}
		} else if (ts.isClassDeclaration(node)) {
			for (const member of node.members) {
				if (
					isPublicMember(member) &&
					(ts.isConstructorDeclaration(member) ||
						ts.isMethodDeclaration(member) ||
						ts.isGetAccessorDeclaration(member) ||
						ts.isSetAccessorDeclaration(member) ||
						ts.isPropertyDeclaration(member))
				) {
					addRequirement(
						requirements,
						member,
						kindOf(member),
						nameOf(member),
						node.name?.getText()
					);
				}
			}
		} else if (ts.isInterfaceDeclaration(node)) {
			for (const member of node.members) {
				addRequirement(
					requirements,
					member,
					kindOf(member),
					nameOf(member),
					node.name?.getText()
				);
			}
		} else if (ts.isEnumDeclaration(node)) {
			for (const member of node.members) {
				addRequirement(
					requirements,
					member,
					"enum member",
					nameOf(member),
					node.name?.getText()
				);
			}
		} else if (ts.isTypeAliasDeclaration(node)) {
			visitTypeMembers(node.type, requirements, node.name?.getText());
		}

		ts.forEachChild(node, visit);
	}

	for (const sourceFile of sourceFiles) {
		visit(sourceFile);
	}

	// TypeScript merges repeated interface declarations into one public shape.
	// Treat a repeated member name in the same container as one requirement so
	// the audit matches the public API rather than requiring duplicate comments
	// for the same merged field.
	const seenDeclarations = new Set();
	const seenMembers = new Set();
	return requirements.filter((requirement) => {
		if (requirement.kind === "interface") {
			const key = `${requirement.file}:${requirement.kind}:${requirement.name}`;
			if (seenDeclarations.has(key)) {
				return false;
			}
			seenDeclarations.add(key);
			return true;
		}
		if (!requirement.container) {
			return true;
		}
		const key = `${requirement.file}:${requirement.container}:${requirement.kind}:${requirement.name}`;
		if (seenMembers.has(key)) {
			return false;
		}
		seenMembers.add(key);
		return true;
	});
}

const sourceFiles = await filesUnder(sourceRoot);
const sourceFileNodes = await Promise.all(
	sourceFiles.map(async (file) =>
		ts.createSourceFile(
			file,
			await readFile(file, "utf8"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS
		)
	)
);
const requirements = collectRequirements(sourceFileNodes);
const missing = requirements.filter((requirement) => !requirement.documented);
const result = {
	sourceFiles: sourceFiles.length,
	requiredSymbols: requirements.length,
	documentedSymbols: requirements.length - missing.length,
	missingSymbols: missing.length,
	missing,
};

if (json) {
	console.log(JSON.stringify(result, null, 2));
} else {
	console.log("SDK documentation audit");
	console.log(`source files: ${result.sourceFiles}`);
	console.log(`required symbols: ${result.requiredSymbols}`);
	console.log(`documented symbols: ${result.documentedSymbols}`);
	console.log(`missing symbols: ${result.missingSymbols}`);
	if (missing.length > 0) {
		console.log("");
		for (const requirement of missing) {
			console.log(
				`${requirement.file}:${requirement.line} ${requirement.kind} ${requirement.name}`
			);
		}
	}
}

if (strict && missing.length > 0) {
	process.exitCode = 1;
}
