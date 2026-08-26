# SDK testing contract

This file is the shared recipe for test work in this repository. The directory
layout and ownership rules are documented in
[`TESTING_ARCHITECTURE.md`](./TESTING_ARCHITECTURE.md).

## Done predicate

Each slice adds deterministic Jest tests for the public SDK seam it owns. Tests must run without a live Sui node or Aftermath service, cover successful and failure/edge paths that the implementation exposes, and typecheck with the rest of the suite.

## Test at these seams

- Prefer exported SDK classes and functions, package facades, and the provider/API boundary.
- Stub external Sui clients and HTTP/API responses at the boundary; do not assert private fields or reimplement the production algorithm in the test.
- Use literal expected values from the API contract, protocol fixtures, or worked examples. Do not calculate the expected value by calling the same helper logic as the production code.
- Preserve bigint precision, optional values, pagination cursors, abort signals, and error classification in assertions where those are part of the public behavior.

## Test layout

- `tests/general/<area>/<seam>.test.ts` mirrors `src/general/<area>/`.
- `tests/packages/<package>/<seam>.test.ts` mirrors `src/packages/<package>/`.
- `tests/cross-cutting/` is reserved for contracts that intentionally span
  multiple source areas, such as transport behavior and shared casters.
- `tests/support/` contains only small, dependency-light test primitives.
- `tests/fixtures/objects/` contains captured external object fixtures.
- `tests/legacy/` contains historical/manual suites that are excluded from the
  deterministic default Jest run.

Use one `*.test.ts` file per public seam or behavior family. A file may contain
multiple `describe` blocks when they share a fixture and exercise the same
source seam; split it when the setup, ownership, or failure model becomes
independent. Do not create a catch-all test file for unrelated packages.

Jest and the test TypeScript project expose `@sdk/*` and `@test/*` aliases so
test imports do not depend on directory depth or extension quirks.

The strict surface audit is coverage-backed. Run the coverage-enabled test
command before `npm run test:surface:strict`.

## Worker fences

- A worker owns only the test files and fixture directory named in its task.
- Do not edit `src/`, existing tests, `package.json`, lockfiles, Jest config, shared helpers, or another worker's files.
- Do not commit or push. The parent agent will inspect and integrate the resulting work.
- Keep tests offline and deterministic. Never depend on environment secrets, a running API, wall-clock time, or random values.

## Verification contract

Before reporting `PASS`, run the focused test file(s) for the slice and the test TypeScript check if the shared harness supports it. Report the exact commands and any remaining issue. A test that only imports a module or asserts a mock was called is insufficient unless the call shape is the behavior being specified.

The default Jest suite intentionally excludes `tests/legacy/`, which contains
historical perpetuals files marked outdated and requiring removed APIs plus a
live local node. Current perpetuals behavior is covered by the deterministic
offline API and domain slices.

## Slice pattern

For each behavior family: establish one failing/meaningful example, make the smallest test fixture that exercises the public seam, add boundary cases, then run the focused suite. Keep fixtures local to the slice unless they are already repository-wide fixtures.
