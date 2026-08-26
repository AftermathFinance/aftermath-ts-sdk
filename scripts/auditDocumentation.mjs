import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const entryPoint = path.join(sourceRoot, "index.ts");
const strict = process.argv.includes("--strict");
const json = process.argv.includes("--json");

function relativePath(fileName) {
	return path.relative(root, fileName).split(path.sep).join("/");
}

function sourceLocation(node) {
	const sourceFile = node.getSourceFile();
	const position = sourceFile.getLineAndCharacterOfPosition(
		node.getStart(sourceFile)
	);
	return {
		file: relativePath(sourceFile.fileName),
		line: position.line + 1,
	};
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

function nodeHasDocumentation(node) {
	return documentationText(documentationNode(node)).length > 0;
}

function symbolHasDocumentation(symbol, checker) {
	const description = ts
		.displayPartsToString(symbol.getDocumentationComment(checker))
		.trim();
	if (description.length > 0) {
		return true;
	}

	return symbol
		.getJsDocTags(checker)
		.some((tag) => `${tag.name} ${tag.text ?? ""}`.trim().length > 0);
}

function hasModifier(node, kind) {
	return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function isPublicMember(node) {
	return !(
		hasModifier(node, ts.SyntaxKind.PrivateKeyword) ||
		hasModifier(node, ts.SyntaxKind.ProtectedKeyword) ||
		node.name?.getText().startsWith("#")
	);
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
	return undefined;
}

function declarationsOf(symbol) {
	return (symbol.getDeclarations() ?? []).filter((declaration) => {
		const fileName = declaration.getSourceFile().fileName;
		return fileName.startsWith(`${sourceRoot}${path.sep}`);
	});
}

function resolveSymbol(symbol, checker) {
	// biome-ignore lint/suspicious/noBitwiseOperators: TypeScript symbol flags are bitmasks.
	if ((symbol.flags & ts.SymbolFlags.Alias) === 0) {
		return symbol;
	}
	try {
		return checker.getAliasedSymbol(symbol);
	} catch {
		return symbol;
	}
}

function unwrapTypeNode(typeNode) {
	let current = typeNode;
	while (
		current &&
		(ts.isParenthesizedTypeNode(current) || ts.isJSDocNullableType(current))
	) {
		current = current.type;
	}
	return current;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The compiler API traversal keeps public-surface cases together.
function collectRequirements(checker, moduleSymbol) {
	const requirements = new Map();

	function addRequirement({ node, kind, name, container, documented }) {
		if (!name || name.startsWith("__")) {
			return;
		}

		const key = `${container ?? "<module>"}|${kind}|${name}`;
		const existing = requirements.get(key);
		if (existing) {
			existing.documented ||= documented;
			return;
		}

		requirements.set(key, {
			...sourceLocation(node),
			kind,
			name,
			...(container ? { container } : {}),
			documented,
		});
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TypeScript type-literal traversal keeps nested public fields together.
	function addMembersToTypeLiteral(typeNode, container, visitedTypeNodes) {
		const unwrapped = unwrapTypeNode(typeNode);
		if (!unwrapped || visitedTypeNodes.has(unwrapped)) {
			return;
		}

		if (ts.isUnionTypeNode(unwrapped) || ts.isIntersectionTypeNode(unwrapped)) {
			visitedTypeNodes.add(unwrapped);
			for (const memberType of unwrapped.types) {
				addMembersToTypeLiteral(memberType, container, visitedTypeNodes);
			}
			return;
		}

		if (!ts.isTypeLiteralNode(unwrapped)) {
			return;
		}

		visitedTypeNodes.add(unwrapped);
		for (const member of unwrapped.members) {
			if (
				!(
					ts.isPropertySignature(member) ||
					ts.isMethodSignature(member) ||
					ts.isCallSignatureDeclaration(member) ||
					ts.isConstructSignatureDeclaration(member) ||
					ts.isIndexSignatureDeclaration(member)
				)
			) {
				continue;
			}

			const memberName = nameOf(member);
			addRequirement({
				node: member,
				kind: kindOf(member),
				name: memberName,
				container,
				documented: nodeHasDocumentation(member),
			});

			if (member.type && ts.isPropertySignature(member)) {
				addMembersToTypeLiteral(
					member.type,
					`${container}.${memberName}`,
					visitedTypeNodes
				);
			}
		}
	}

	function addClassMembers(declaration, container) {
		for (const member of declaration.members) {
			if (
				isPublicMember(member) &&
				(ts.isConstructorDeclaration(member) ||
					ts.isMethodDeclaration(member) ||
					ts.isGetAccessorDeclaration(member) ||
					ts.isSetAccessorDeclaration(member) ||
					ts.isPropertyDeclaration(member))
			) {
				addRequirement({
					node: member,
					kind: kindOf(member),
					name: nameOf(member),
					container,
					documented: nodeHasDocumentation(member),
				});
			}
		}
	}

	function addInterfaceMembers(declaration, container) {
		for (const member of declaration.members) {
			addRequirement({
				node: member,
				kind: kindOf(member),
				name: nameOf(member),
				container,
				documented: nodeHasDocumentation(member),
			});
		}
	}

	function addEnumMembers(declaration, container) {
		for (const member of declaration.members) {
			addRequirement({
				node: member,
				kind: "enum member",
				name: nameOf(member),
				container,
				documented: nodeHasDocumentation(member),
			});
		}
	}

	for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
		const symbol = resolveSymbol(exportedSymbol, checker);
		const declarations = declarationsOf(symbol);
		if (declarations.length === 0) {
			continue;
		}

		const rootDeclaration = declarations.find((declaration) =>
			kindOf(declaration)
		);
		const rootKind = rootDeclaration && kindOf(rootDeclaration);
		if (!(rootDeclaration && rootKind)) {
			continue;
		}

		const exportedName = exportedSymbol.getName();
		addRequirement({
			node: rootDeclaration,
			kind: rootKind,
			name: exportedName,
			documented:
				symbolHasDocumentation(symbol, checker) ||
				declarations.some(nodeHasDocumentation),
		});

		for (const declaration of declarations) {
			if (ts.isClassDeclaration(declaration)) {
				addClassMembers(declaration, exportedName);
			} else if (ts.isInterfaceDeclaration(declaration)) {
				addInterfaceMembers(declaration, exportedName);
			} else if (ts.isEnumDeclaration(declaration)) {
				addEnumMembers(declaration, exportedName);
			} else if (ts.isTypeAliasDeclaration(declaration)) {
				addMembersToTypeLiteral(declaration.type, exportedName, new Set());
			}
		}
	}

	return [...requirements.values()].sort((left, right) => {
		const leftLocation = `${left.file}:${left.line}`;
		const rightLocation = `${right.file}:${right.line}`;
		return leftLocation.localeCompare(rightLocation);
	});
}

const configPath = path.join(root, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) {
	throw new Error(
		ts.flattenDiagnosticMessageText(config.error.messageText, "\n")
	);
}

const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram([entryPoint], {
	...parsedConfig.options,
	noEmit: true,
});
const checker = program.getTypeChecker();
const entrySourceFile = program.getSourceFile(entryPoint);
if (!entrySourceFile) {
	throw new Error(
		`Could not load documentation entry point: ${relativePath(entryPoint)}`
	);
}

const moduleSymbol = checker.getSymbolAtLocation(entrySourceFile);
if (!moduleSymbol) {
	throw new Error(
		`Could not resolve module symbol: ${relativePath(entryPoint)}`
	);
}

const requirements = collectRequirements(checker, moduleSymbol);
const missing = requirements.filter((requirement) => !requirement.documented);
const sourceFiles = program
	.getSourceFiles()
	.filter((sourceFile) =>
		sourceFile.fileName.startsWith(`${sourceRoot}${path.sep}`)
	).length;
const result = {
	entryPoint: relativePath(entryPoint),
	sourceFiles,
	requiredSymbols: requirements.length,
	documentedSymbols: requirements.length - missing.length,
	missingSymbols: missing.length,
	missing,
};

if (json) {
	console.log(JSON.stringify(result, null, 2));
} else {
	console.log("SDK documentation audit");
	console.log(`entry point: ${result.entryPoint}`);
	console.log(`source files: ${result.sourceFiles}`);
	console.log(`required symbols: ${result.requiredSymbols}`);
	console.log(`documented symbols: ${result.documentedSymbols}`);
	console.log(`missing symbols: ${result.missingSymbols}`);
	if (missing.length > 0) {
		console.log("");
		for (const requirement of missing) {
			const container = requirement.container
				? `${requirement.container}.`
				: "";
			console.log(
				`${requirement.file}:${requirement.line} ${requirement.kind} ${container}${requirement.name}`
			);
		}
	}
}

if (strict && missing.length > 0) {
	process.exitCode = 1;
}
