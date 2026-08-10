---
"aftermath-ts-sdk": minor
---

Add final-positional `AbortSignal` support to Aftermath initialization and
read methods, plus additive `AftermathTransportError` classification for
HTTP, network, cancellation, timeout, and decode failures. Existing error
messages and names remain compatible, including the legacy HTTP error format;
new structured transport fields are available alongside them.
