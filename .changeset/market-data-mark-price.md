---
"aftermath-ts-sdk": patch
---

Add optional `markPrice` to `PerpetualsMarketData`.

The websocket market stream carries a mark price alongside the index, but the
type never declared it, so consumers reading it had to widen the type
themselves. REST responses are built from an indexer payload with no mark
price and omit the field, hence optional.

`markPrice` was already on `PerpetualsWsUpdatesOraclePayload`; this covers the
market stream, which fills the window before the first oracle tick arrives.

Also corrects `PerpetualsWsUpdatesOraclePayload.bookPrice` from `number | null`
to optional. The API does send JSON `null`, but the websocket parser
(`parseJsonWithBigint`) maps every `null` to `undefined` before handing the
message to consumers, so the old type described a value that never arrives and
a `=== null` check could never match.
