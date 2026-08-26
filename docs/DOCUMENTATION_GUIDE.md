# SDK documentation guide

This repository documents the public TypeScript API in source JSDoc and uses
TypeDoc to publish the reference. Keep the source comments complete so editor
tooltips, generated declarations, and the published reference describe the same
API.

## Choose the right kind of documentation

- Use the README and package guides for tutorials and common workflows.
- Use focused guides for tasks such as configuring a client, building a
  transaction, handling pagination, or migrating from a deprecated method.
- Use JSDoc for reference facts about a class, method, type, constant, parameter,
  return value, field, error, and side effect.
- Use explanation pages for concepts that cross package boundaries, such as
  the high-level provider versus the low-level API, gRPC versus JSON-RPC, and
  transaction serialization.

Keep each page in one mode. Link to another page when a reader needs a different
mode.

## Write a public symbol's JSDoc

Start with one sentence that says what the symbol represents or does. Add only
the details a caller needs to use it correctly:

```ts
/**
 * Fetches the current balance for one coin type owned by an address.
 *
 * The returned value is a `bigint` in the coin's smallest unit. Pass the
 * optional `signal` to cancel the request before the server responds.
 *
 * @param inputs - The owner address and coin type to query.
 * @param signal - Optional caller-owned cancellation signal.
 * @returns The balance in the coin's smallest unit.
 * @throws `AftermathTransportError` when the request cannot be completed.
 */
```

Document these points when they apply:

- What each parameter means, including units, address formats, and ownership.
- What the return value contains, including whether numbers are `bigint`,
  `number`, or decimal strings.
- Whether a method performs network I/O, builds a transaction, or only computes
  a local value.
- Which client or configuration is required.
- Which errors a caller can handle and which input conditions cause them.
- Whether a method is deprecated, what replaces it, and whether behavior differs
  across networks or transport clients.
- A short `@example` for constructors, providers, transaction builders, and
  methods whose inputs are not obvious.

Document every public class, constructor, method, accessor, property, exported
type, interface, enum, enum member, constant, and interface field. Use the real
symbol name and the units from the implementation. Do not guess backend behavior
from a method name.

## Examples

Examples must compile against the current package shape. Prefer a complete
snippet that starts from an import and shows the relevant result:

```ts
import { Aftermath } from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });
const pools = await sdk.Pools().getAllPools();
```

Use tabs inside code blocks when the example contains indented TypeScript. Keep
examples deterministic. Do not include private addresses, live secrets, or
unexplained placeholders that a reader could mistake for working values.

## Keep reference docs true

Run the documentation audit after source comments change:

```bash
npm run docs:audit
```

Run the strict audit before committing documentation:

```bash
npm run docs:audit:strict
```

Repeated declarations that TypeScript merges into one interface are checked as
one public symbol and one field per merged name. The audit still requires every
unique field in the merged public shape to have a comment.

Generate the HTML reference with:

```bash
npm run docs:generate
```

The generator reads `typedoc.json`, uses `src` as the entry point, and includes
the authored guides and research notes as project documents. Run the strict
audit before generation so a successful TypeDoc build cannot hide an
undocumented source declaration. Review the generated output and the source
diff together. A generated page must not hide an undocumented public symbol or
claim a parameter, unit, endpoint, or error that the current source does not
support.

Use `README.md` for the first successful integration path. Keep package-specific
details close to the package they describe, and link from the README instead of
putting every reference table on the landing page.
