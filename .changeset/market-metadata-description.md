---
"aftermath-ts-sdk": patch
---

Add optional `description` to `PerpetualsMarketMetadata`.

The static enricher can now carry a long-form blurb per market alongside the
existing display name and artwork. Optional because it is omitted for markets
that have not been given one.
