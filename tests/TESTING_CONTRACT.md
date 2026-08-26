# SDK testing contract

This file is the shared recipe for parallel test work in this repository.

## Done predicate

Each slice adds deterministic Jest tests for the public SDK seam it owns. Tests must run without a live Sui node or Aftermath service, cover successful and failure/edge paths that the implementation exposes, and typecheck with the rest of the suite.

## Test at these seams

- Prefer exported SDK classes and functions, package facades, and the provider/API boundary.
- Stub external Sui clients and HTTP/API responses at the boundary; do not assert private fields or reimplement the production algorithm in the test.
- Use literal expected values from the API contract, protocol fixtures, or worked examples. Do not calculate the expected value by calling the same helper logic as the production code.
- Preserve bigint precision, optional values, pagination cursors, abort signals, and error classification in assertions where those are part of the public behavior.

## Worker fences

- A worker owns only the test files and fixture directory named in its task.
- Do not edit `src/`, existing tests, `package.json`, lockfiles, Jest config, shared helpers, or another worker's files.
- Do not commit or push. The parent agent will inspect and integrate the resulting work.
- Keep tests offline and deterministic. Never depend on environment secrets, a running API, wall-clock time, or random values.

## Verification contract

Before reporting `PASS`, run the focused test file(s) for the slice and the test TypeScript check if the shared harness supports it. Report the exact commands and any remaining issue. A test that only imports a module or asserts a mock was called is insufficient unless the call shape is the behavior being specified.

The default Jest suite intentionally excludes the two legacy perpetuals files
that are marked outdated and require removed APIs plus a live local node. Their
current public behavior is covered by the offline perpetuals API and domain
slices.

## Slice pattern

For each behavior family: establish one failing/meaningful example, make the smallest test fixture that exercises the public seam, add boundary cases, then run the focused suite. Keep fixtures local to the slice unless they are already repository-wide fixtures.
