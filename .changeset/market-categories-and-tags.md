---
"aftermath-ts-sdk": patch
---

feat(perpetuals): add market categories endpoint and per-market tags

Add `Perpetuals.getMarketsCategories()`, which posts to
`perpetuals/markets/categories` and returns the ordered category/tag vocabulary
behind market metadata, plus the `PerpetualsMarketCategory` and
`ApiPerpetualsMarketsCategoriesResponse` types. Extend
`PerpetualsMarketMetadata` with optional `tags`: a market names exactly one
`category` and may carry any number of that category's tags.
