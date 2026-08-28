---
"aftermath-ts-sdk": major
---

Router, DCA and limit-order transaction builders now call the versioned `v1`
API routes, which return a base64 `TransactionKind` instead of a gas-resolved
transaction.

The unversioned routes round-trip the built transaction through a legacy
v1-JSON serializer that cannot encode the `FundsWithdrawal` input the API emits
when the input coin is sourced from an address balance. They fail for wallets
holding a balance there, and are left unchanged for existing integrators.

Affected: `Router.getTransactionForCompleteTradeRoute`,
`Router.addTransactionForCompleteTradeRoute`, `Dca.getCreateDcaOrderTx` and
`LimitOrders.getCreateLimitOrderTx`.

Breaking:

- **The returned transaction carries no gas data.** A `TransactionKind` has no
  budget, price, owner or payment, so the caller owns gas — a wallet resolves it
  at signing time, or dynamic gas rewrites it. Code reading `gasData` off the
  returned transaction, or submitting it without a wallet that fills gas, must
  change. The sender is still set.
- **`Router.addTransactionForCompleteTradeRoute` now requires an
  `AftermathApi`.** It serializes the supplied transaction into a kind, which
  needs a client to resolve object references. `Aftermath.create()` supplies one;
  a directly constructed `new Router(config)` does not and will throw. `Router`
  accepts the provider as an optional second constructor argument.
- **`ApiRouterAddTransactionForCompleteTradeRouteBody.serializedTx` is now
  `txKind`**, and the add-trade response field `tx` is now `txKind`.

Each affected builder has a `…Deprecated` counterpart keeping the previous
behaviour against the unversioned routes, for callers that need the old shape
while they migrate: `getTransactionForCompleteTradeRouteDeprecated`,
`addTransactionForCompleteTradeRouteDeprecated`,
`getCreateDcaOrderTxDeprecated` and `getCreateLimitOrderTxDeprecated`. They
carry the same address-balance limitation as the endpoints behind them.
