---
"aftermath-ts-sdk": patch
---

`fetchCoinsWithAtLeastAmount` now stops paginating as soon as the fetched coins cover the requested amount (with a 50-page backstop), instead of enumerating the wallet's entire coin list first. Coin-dust wallets with 100k+ coin objects previously made every trade build hang for minutes.
