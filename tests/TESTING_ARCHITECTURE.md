# SDK test architecture

The test suite mirrors the public source ownership of the SDK. This keeps a
failure local, makes coverage gaps visible, and lets contributors find a test
without searching a repository-wide catch-all file.

## Directory ownership

```text
tests/
├── cross-cutting/       # contracts shared by multiple source areas
├── general/             # src/general/*, grouped by public area and seam
├── packages/            # src/packages/*, grouped by package and seam
├── support/             # generic HTTP, transaction, and gRPC test primitives
├── fixtures/objects/    # captured external object responses
└── legacy/              # excluded historical/manual suites
```

The normal mapping is:

```text
src/general/<area>/<module>       -> tests/general/<area>/<seam>.test.ts
src/packages/<package>/<module>   -> tests/packages/<package>/<seam>.test.ts
package-specific test data        -> tests/packages/<package>/fixtures.ts
shared public contract             -> tests/cross-cutting/<contract>.test.ts
```

Test names describe the seam under test (`api`, `casting`, `calculations`,
`market`, `facade`, or the module name). A test file can cover several methods
of one seam; it should not combine unrelated source areas merely because they
share a fixture.

## Fixture boundaries

Fixtures stay beside the tests that own their domain. The shared support layer
is intentionally small:

- `support/http.ts` records fetch calls and decodes JSON request bodies.
- `support/transactions.ts` exposes stable inspection of transaction commands.
- `support/grpc.ts` builds the minimal coin shape used by gRPC tests.

These helpers do not encode package behavior or hide assertions. Package
fixtures may still provide protocol-specific mocks, constants, and dynamic
imports locally. Captured object payloads remain in `fixtures/objects/` rather
than being copied into individual test cases.

## Runtime and verification

The default Jest run is offline and deterministic. `tests/legacy/` is excluded
because it depends on removed APIs or a live local environment. Run the suite
and its structural checks with:

```sh
npm test -- --runInBand
npm run typecheck:tests
npm run test:surface:strict
npm run test:coverage
```

The surface audit checks source-area ownership rather than filename or import
text heuristics. In strict mode it also requires the coverage summary and
verifies that every included source module has coverage and at least one covered
statement. Cross-cutting tests are reported separately so they remain visible
without being misattributed to one package. GitHub Actions runs this audit
after the coverage-enabled CI test command.
