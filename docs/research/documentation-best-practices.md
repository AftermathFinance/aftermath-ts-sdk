# Documentation best practices for this TypeScript SDK

## Status

Overall status: **PASS**.

- **PASS** — The research is complete and uses official TypeDoc, TypeScript, and Google developer documentation.
- **PASS** — The repository now has a strict source audit, a checked-in TypeDoc command and configuration, authored task guides, and a generated-reference workflow.
- **BLOCKED** — None. The recommendations below are actionable without changing source code in this task.

## Scope and decision

The repository guide is the local authority for documentation ownership. It assigns
the README and package guides to tutorials, focused guides to task-based work,
source JSDoc to reference facts, and explanation pages to cross-package concepts.
Keep that split. The [repository documentation guide](../DOCUMENTATION_GUIDE.md)
also requires examples to match the current package shape and asks maintainers to
run the documentation audits.

Use this documentation model:

| Reader goal | Primary artifact | Practical rule |
| --- | --- | --- |
| Complete a first integration | README or tutorial | Show one working path from prerequisites to a visible result. |
| Complete one known task | How-to guide | Give one focused, prescriptive procedure and link to reference facts. |
| Look up an API fact | Source JSDoc and generated TypeDoc | State the exact symbol, inputs, output, errors, side effects, and deprecation state. |
| Understand a cross-package concept | Explanation page | Define scope, explain relationships and trade-offs, and link to tasks and reference pages. |

Google recommends providing different documentation types for different user
groups and reinforcing concepts with examples in tutorials. See the [Technical
Writing Two summary](https://developers.google.com/tech-writing/course-summaries/two).

## Keep source JSDoc as the API contract

Put a `/** ... */` comment directly above every public declaration that needs
documentation. TypeDoc follows TypeScript's comment discovery in most cases,
supports Markdown, and renders fenced code blocks with syntax highlighting. See
[TypeDoc doc comments](https://typedoc.org/documents/Doc_Comments.html) and its
[comment options](https://typedoc.org/documents/Options.Comments.html).

Keep type facts in the TypeScript signature. TypeScript's JSDoc reference says
that TypeScript files support documentation tags, while the type-oriented JSDoc
tags are for JavaScript files. Use the real TypeScript types for the contract and
use comments to explain semantics that a signature cannot express. See the
[TypeScript JSDoc reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html).

For this SDK, a public comment should cover the following when applicable:

- The meaning, format, units, default, and ownership of each parameter.
- Whether the method performs network I/O, builds a transaction, or computes a local value.
- The client, network, provider, or configuration that the caller must supply.
- The return shape and the difference between `bigint`, `number`, decimal strings, cursors, and optional values.
- Input conditions, typed errors, transport failures, cancellation, and observable side effects.
- Network-specific behavior, deprecation replacements, and behavior that differs by transport.

Use the supported tags consistently:

- `@param` documents a parameter. For an object parameter, TypeDoc supports a dotted name for a first-level property such as `inputs.amount`; [the `@param` reference](https://typedoc.org/documents/Tags._param.html) documents the limit.
- `@returns` describes the returned value. TypeDoc permits at most one `@returns` tag, so put the complete result contract in one place. See [the `@returns` reference](https://typedoc.org/documents/Tags._returns.html).
- `@throws` names an exception and the condition that causes it. See [the `@throws` reference](https://typedoc.org/documents/Tags._throws.html).
- `@example` shows the smallest complete caller path when the inputs or setup are not obvious. Use a fenced `ts` block because TypeDoc only supports fenced code blocks. See [the `@example` reference](https://typedoc.org/documents/Tags._example.html).
- `@deprecated` states why a declaration is deprecated and names its replacement. TypeDoc renders deprecated members distinctly. See [the `@deprecated` reference](https://typedoc.org/documents/Tags._deprecated.html).
- `{@link Symbol}` links related public declarations. TypeDoc resolves these links with TypeScript's symbol rules by default and can warn about unresolved links. See [the `{@link}` reference](https://typedoc.org/documents/Tags.__link_.html).
- `@see` links related external or conceptual resources. Use an explicit `{@link ...}` inside `@see` when the target is a symbol. See [the `@see` reference](https://typedoc.org/documents/Tags._see.html).

Do not invent arbitrary JSDoc tags. TypeDoc warns about unrecognized tags; use
its supported tags or define a custom tag in a checked-in `tsdoc.json` or
TypeDoc configuration. See the [TypeDoc tags overview](https://typedoc.org/documents/Tags.html).

Use `{@inheritDoc ...}` only when the inherited contract is exact. TypeDoc copies
the summary, `@remarks`, parameters, type parameters, and return text, but not
every local caveat. Add local error, side-effect, and transport details when a
wrapper changes behavior. See [the `@inheritDoc` reference](https://typedoc.org/documents/Tags.__inheritDoc_.html).

## Make generated TypeDoc reproducible

Generate the reference from the same public entry point that consumers import.
TypeDoc examines the exports of its entry points. If no entry point is supplied,
it can discover them from the package `exports` or `main` fields. Configure an
explicit source entry point, such as the repository's public `src/index.ts`,
after confirming that it matches the package export surface. See [TypeDoc input
options](https://typedoc.org/documents/Options.Input.html).

Keep the TypeDoc version, entry point, output directory, and validation settings
in the repository. Treat generated HTML as a build artifact. Regenerate it from
source instead of editing individual HTML pages by hand.

Enable validation for the failures that make a reference misleading:

- `notExported` for links to types that do not appear in the public reference.
- `invalidLink` for unresolved `@link` tags.
- `invalidPath` for relative links that do not resolve.
- `rewrittenLink` for links whose target does not have a unique URL.
- `notDocumented` for public reflections without a comment.
- `treatValidationWarningsAsErrors` in CI so a broken reference fails the documentation build.

These checks are documented in [TypeDoc validation options](https://typedoc.org/documents/Options.Validation.html).

Keep the generated reference aligned with the published declarations. TypeScript
recommends publishing generated declarations with the package and pointing the
`types` field at the main declaration file. This package already points
`types` to `./dist/index.d.ts`; retain that alignment when the public export
surface changes. See [TypeScript declaration publishing](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html).

## Write tutorials and how-to guides for one outcome

Start each authored page with its scope, audience, prerequisites, and expected
result. Google recommends stating scope and non-scope, identifying what readers
already know, and putting key points at the start of a document. See [Google's
document organization guidance](https://developers.google.com/tech-writing/one/documents)
and [audience guidance](https://developers.google.com/tech-writing/one/audience).

For tutorials:

- Start with the smallest complete integration, such as importing the SDK, creating a client, and making one successful call.
- Keep the path linear. Show the expected result after the important steps.
- Explain concepts at the point where the example uses them, then link to an explanation or reference page for depth.
- Use examples that compile against the current package entry point. Do not use private addresses, live secrets, or placeholders that look like working values.

For how-to guides:

- Name the task with a command, such as “Configure cancellation” or “Build a transaction.”
- State the goal and the required context before the action.
- Use one numbered item per meaningful action. Put conditions before the step they guard.
- Choose one recommended path. Split genuinely different methods into separate sections or pages.
- Link to repeated procedures instead of copying them.

These rules follow Google's guidance that procedures use numbered steps, provide
context and goals, keep steps short, and avoid repeating procedures. See the
[Google procedures guide](https://developers.google.com/style/procedures) and
[prescriptive documentation guidance](https://developers.google.com/style/prescriptive-documentation).

For reference pages, keep prose dry and complete. Let TypeDoc provide signatures
and navigation, and let source JSDoc provide the behavior contract. Do not turn a
reference page into a tutorial. For explanation pages, describe one bounded
concept, state why it matters, and link to the relevant task and symbols.

## Make pages scannable and linkable

Use sentence case, one level-1 heading, descriptive headings, and a logical
heading hierarchy. Use task headings for procedures and noun phrases for
concepts. Do not skip heading levels or put links in headings. See [Google
headings and titles](https://developers.google.com/style/headings).

Use meaningful link text that identifies the destination. Avoid “click here” and
“read this document.” Link from tutorials and how-to guides to the exact TypeDoc
symbol or conceptual page that supplies the missing detail. See [Google's
accessibility guidance for links](https://developers.google.com/style/accessibility).

Use code formatting for imports, symbols, types, paths, flags, status codes, and
literal values. Use bullets for unordered options and numbered lists when order
matters. Keep list items parallel and introduce lists with a complete sentence.
See [Google's lists guidance](https://developers.google.com/style/lists) and its
[text-formatting summary](https://developers.google.com/style/text-formatting).

Prefer direct, consistent language for a global developer audience. Define
unfamiliar terms, avoid ambiguous pronouns and unnecessary jargon, and use active
voice. See Google's [voice and tone guidance](https://developers.google.com/style/tone)
and [Technical Writing One summary](https://developers.google.com/tech-writing/one/summary).

## Verify documentation as a product

Use this sequence for each documentation change:

1. Update the source comment beside the public declaration.
2. Run `npm run docs:audit` while editing and `npm run docs:audit:strict` before merging.
3. Type-check or build every example that the page promises will run.
4. Regenerate TypeDoc from the checked-in configuration and review generated output with the source diff.
5. Check internal and external links, then run the tutorial from a clean consumer project when the page changes installation or initialization.

The repository's [documentation guide](../DOCUMENTATION_GUIDE.md) already defines
the two audit commands and requires current, deterministic examples. TypeDoc's
validation catches reference-model and link failures, but its comment guidance
describes parsing and rendering code blocks, not compiling them. The separate
example type-check is therefore an implementation recommendation based on the
two tools' roles.

## Repository findings

The findings below record the repository observations that shaped this work.
They are observations, not a substitute for the source-level API reference.

- The [documentation audit script](https://github.com/AftermathFinance/aftermath-ts-sdk/blob/docs/scripts/auditDocumentation.mjs) inspects 135 source files and now reports 3,743 required public symbols with 0 missing comments. Repeated members of merged TypeScript interfaces are counted once because they represent one public field.
- The [package manifest](https://github.com/AftermathFinance/aftermath-ts-sdk/blob/docs/package.json) exposes `docs:audit`, `docs:audit:strict`, and `docs:generate`; `typedoc` is pinned in `devDependencies`, and [typedoc.json](https://github.com/AftermathFinance/aftermath-ts-sdk/blob/docs/typedoc.json) checks links and validation warnings. The generated reference is reproducible from the repository commands.
- The `docs/` tree now contains authored guides, an explanation of provider layers, and two research notes alongside the generated HTML. The README links readers to the generated API reference and the maintenance guide.

## Sources

All external sources were official documentation pages accessed on 2026-08-25.

- TypeDoc: [doc comments](https://typedoc.org/documents/Doc_Comments.html), [tags](https://typedoc.org/documents/Tags.html), [input options](https://typedoc.org/documents/Options.Input.html), [comment options](https://typedoc.org/documents/Options.Comments.html), and [validation options](https://typedoc.org/documents/Options.Validation.html).
- TypeDoc tag references: [`@param`](https://typedoc.org/documents/Tags._param.html), [`@returns`](https://typedoc.org/documents/Tags._returns.html), [`@throws`](https://typedoc.org/documents/Tags._throws.html), [`@example`](https://typedoc.org/documents/Tags._example.html), [`@deprecated`](https://typedoc.org/documents/Tags._deprecated.html), [`@see`](https://typedoc.org/documents/Tags._see.html), [`{@link}`](https://typedoc.org/documents/Tags.__link_.html), and [`{@inheritDoc}`](https://typedoc.org/documents/Tags.__inheritDoc_.html).
- TypeScript: [JSDoc reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html), [declaration-file do's and don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html), and [declaration publishing](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html).
- Google developer documentation: [style guide](https://developers.google.com/style), [headings](https://developers.google.com/style/headings), [procedures](https://developers.google.com/style/procedures), [accessibility](https://developers.google.com/style/accessibility), [lists](https://developers.google.com/style/lists), [documents](https://developers.google.com/tech-writing/one/documents), [audience](https://developers.google.com/tech-writing/one/audience), and [Technical Writing Two summary](https://developers.google.com/tech-writing/course-summaries/two).

## File changed

Created and updated only:

- `docs/research/documentation-best-practices.md`
