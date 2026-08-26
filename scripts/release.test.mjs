import assert from "node:assert/strict";
import { test } from "node:test";
import { isVersionPublished, runRelease } from "./release.mjs";

const packageJson = {
	name: "aftermath-ts-sdk",
	version: "3.3.4",
};

const response = (versions, status = 200) => ({
	ok: status >= 200 && status < 300,
	status,
	json: () => ({ versions }),
});

const registryStateError =
	/Unable to determine whether aftermath-ts-sdk@3\.3\.4 is published/;

const testOptions = {
	registry: "https://registry.test/",
	registryCheck: {
		maxAttempts: 1,
		retryDelayMs: 0,
	},
};

test("recognizes an exact version in the npm registry", async () => {
	const published = await isVersionPublished({
		name: packageJson.name,
		version: packageJson.version,
		registry: testOptions.registry,
		fetchImpl: () => response({ "3.3.4": {} }),
		maxAttempts: 1,
		retryDelayMs: 0,
	});

	assert.equal(published, true);
});

test("skips build and publish when the exact version already exists", async () => {
	const commands = [];
	const result = await runRelease({
		...testOptions,
		packageJson,
		fetchImpl: () => response({ "3.3.4": {} }),
		commandRunner: (...command) => {
			commands.push(command);
			return { code: 0, stdout: "", stderr: "" };
		},
	});

	assert.deepEqual(result, { published: false, skipped: true });
	assert.deepEqual(commands, []);
});

test("builds and publishes when the exact version is absent", async () => {
	const commands = [];
	const result = await runRelease({
		...testOptions,
		packageJson,
		fetchImpl: () => response({}),
		commandRunner: (...command) => {
			commands.push(command);
			return { code: 0, stdout: "", stderr: "" };
		},
	});

	assert.deepEqual(result, { published: true, skipped: false });
	assert.deepEqual(commands, [
		["bun", ["run", "build"]],
		["bun", ["run", "changeset", "publish"]],
	]);
});

test("retries a registry response that has not propagated the version yet", async () => {
	let attempts = 0;
	const published = await isVersionPublished({
		name: packageJson.name,
		version: packageJson.version,
		registry: testOptions.registry,
		fetchImpl: () => {
			attempts += 1;
			return response(attempts === 1 ? {} : { "3.3.4": {} });
		},
		maxAttempts: 2,
		retryDelayMs: 0,
	});

	assert.equal(published, true);
	assert.equal(attempts, 2);
});

test("recovers when npm reports publish failure after the version exists", async () => {
	let lookups = 0;
	const commands = [];
	const result = await runRelease({
		...testOptions,
		packageJson,
		fetchImpl: () => {
			lookups += 1;
			return response(lookups === 1 ? {} : { "3.3.4": {} });
		},
		commandRunner: (...command) => {
			commands.push(command);
			return command[1].at(-1) === "publish"
				? { code: 1, stdout: "", stderr: "publish failed" }
				: { code: 0, stdout: "", stderr: "" };
		},
	});

	assert.deepEqual(result, {
		published: false,
		skipped: true,
		recovered: true,
	});
	assert.equal(lookups, 2);
});

test("fails closed when the registry state cannot be determined", async () => {
	const commands = [];

	await assert.rejects(
		runRelease({
			...testOptions,
			packageJson,
			fetchImpl: () => {
				throw new Error("network unavailable");
			},
			commandRunner: (...command) => {
				commands.push(command);
				return { code: 0, stdout: "", stderr: "" };
			},
		}),
		registryStateError
	);

	assert.deepEqual(commands, []);
});
