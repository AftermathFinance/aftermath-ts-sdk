import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const defaultRegistry = "https://registry.npmjs.org/";
const defaultMaxAttempts = 3;
const defaultRetryDelayMs = 2000;

const sleep = (delayMs) =>
	new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));

const getPackageMetadataUrl = (registry, packageName) => {
	const registryUrl = registry.endsWith("/") ? registry : `${registry}/`;
	return new URL(encodeURIComponent(packageName), registryUrl).toString();
};

const assertRetryOptions = (maxAttempts, retryDelayMs) => {
	if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
		throw new Error("maxAttempts must be a positive integer.");
	}
	if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
		throw new Error("retryDelayMs must be a non-negative number.");
	}
};

export const isVersionPublished = async ({
	name,
	version,
	registry = defaultRegistry,
	fetchImpl = fetch,
	maxAttempts = defaultMaxAttempts,
	retryDelayMs = defaultRetryDelayMs,
}) => {
	assertRetryOptions(maxAttempts, retryDelayMs);
	const metadataUrl = getPackageMetadataUrl(registry, name);

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetchImpl(metadataUrl, {
				headers: {
					accept: "application/vnd.npm.install-v1+json",
				},
			});
			if (response.status === 404) {
				return false;
			}
			if (!response.ok) {
				throw new Error(
					`npm registry lookup returned HTTP ${response.status}.`
				);
			}

			const metadata = await response.json();
			const versions = metadata?.versions;
			if (
				versions === null ||
				typeof versions !== "object" ||
				Array.isArray(versions)
			) {
				throw new Error("npm registry returned an invalid package manifest.");
			}

			if (Object.hasOwn(versions, version)) {
				return true;
			}
			if (attempt === maxAttempts) {
				return false;
			}
		} catch (error) {
			if (attempt === maxAttempts) {
				throw new Error(
					`Unable to determine whether ${name}@${version} is published.`,
					{ cause: error }
				);
			}
		}

		await sleep(retryDelayMs);
	}

	return false;
};

const runCommand = (command, args) =>
	new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd: process.cwd(),
			env: process.env,
			stdio: ["inherit", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let settled = false;

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
			process.stdout.write(chunk);
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
			process.stderr.write(chunk);
		});
		child.once("error", (error) => {
			if (!settled) {
				settled = true;
				reject(error);
			}
		});
		child.once("close", (code) => {
			if (!settled) {
				settled = true;
				resolvePromise({ code, stdout, stderr });
			}
		});
	});

const assertPackageManifest = (packageJson) => {
	if (
		packageJson === null ||
		typeof packageJson !== "object" ||
		typeof packageJson.name !== "string" ||
		typeof packageJson.version !== "string"
	) {
		throw new Error("package.json must define a package name and version.");
	}
};

const assertCommandSucceeded = (result, command) => {
	if (result.code !== 0) {
		throw new Error(
			`${command} failed with exit code ${result.code ?? "unknown"}.`
		);
	}
};

export const runRelease = async ({
	packageJson,
	registry = packageJson?.publishConfig?.registry ?? defaultRegistry,
	fetchImpl = fetch,
	commandRunner = runCommand,
	registryCheck = {},
}) => {
	assertPackageManifest(packageJson);
	const { name, version } = packageJson;
	const checkPublished = () =>
		isVersionPublished({
			...registryCheck,
			name,
			version,
			registry,
			fetchImpl,
		});

	if (await checkPublished()) {
		console.log(`Skipping release: ${name}@${version} is already published.`);
		return { published: false, skipped: true };
	}

	const buildResult = await commandRunner("bun", ["run", "build"]);
	assertCommandSucceeded(buildResult, "bun run build");

	const publishResult = await commandRunner("bun", [
		"run",
		"changeset",
		"publish",
	]);
	if (publishResult.code === 0) {
		return { published: true, skipped: false };
	}

	// A publish can succeed at npm and still return an error because the
	// registry response was lost or a concurrent retry attempted the same
	// immutable version. Reconcile against npm before failing the workflow.
	if (await checkPublished()) {
		console.warn(
			`Treating release as complete: ${name}@${version} is present on npm after the publish command failed.`
		);
		return { published: false, skipped: true, recovered: true };
	}

	throw new Error(
		`bun run changeset publish failed with exit code ${publishResult.code ?? "unknown"}.`
	);
};

const readPackageJson = async () => {
	const packageContents = await readFile(
		new URL("../package.json", import.meta.url),
		"utf8"
	);
	return JSON.parse(packageContents);
};

const main = async () => {
	await runRelease({ packageJson: await readPackageJson() });
};

const isEntrypoint =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntrypoint) {
	main().catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		process.exitCode = 1;
	});
}
