---
"aftermath-ts-sdk": minor
---

Perpetuals `getMarkets` and `getMarket` accept an optional `language`, typed as the new exported `Language` union (`"en" | "ko" | "ru"`), for market metadata. `PerpetualsMarketMetadata.language` reports the language its `description` came back in.
