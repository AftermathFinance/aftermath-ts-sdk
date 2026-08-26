import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/**/*.test.ts"],
	// Legacy files are explicitly marked outdated and target removed APIs plus a
	// live local Sui/Rust environment. Current perpetuals behavior is covered by
	// the deterministic API/domain suites in this repository.
	testPathIgnorePatterns: ["<rootDir>/tests/legacy/"],
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "json", "node"],
	extensionsToTreatAsEsm: [".ts", ".tsx"],
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				useESM: true,
				tsconfig: "<rootDir>/tsconfig.tests.json",
			},
		],
	},
	transformIgnorePatterns: [],
	moduleNameMapper: {
		"^@sdk$": "<rootDir>/src/index.ts",
		"^@sdk/(.*)\\.js$": "<rootDir>/src/$1",
		"^@sdk/(.*)$": "<rootDir>/src/$1",
		"^@test/(.*)\\.js$": "<rootDir>/tests/$1",
		"^@test/(.*)$": "<rootDir>/tests/$1",
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	coverageProvider: "v8",
	collectCoverageFrom: [
		"<rootDir>/src/**/*.ts",
		"!<rootDir>/src/**/index.ts",
		"!<rootDir>/src/**/*Types.ts",
	],
	coverageDirectory: "<rootDir>/coverage",
	coverageReporters: ["text", "lcov", "json-summary"],
	coverageThreshold: {
		global: {
			statements: 90,
			branches: 75,
			functions: 90,
			lines: 90,
		},
	},
	clearMocks: true,
	restoreMocks: true,
};

export default config;
