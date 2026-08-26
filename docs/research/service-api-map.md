# SDK ↔ `service-af-fe` API map

**Overall status: ISSUES**

This is a source-level map of the current TypeScript SDK working tree to the
readable `service-af-fe` repository. `PASS` means that the HTTP method, path,
and the inspected request/response boundary agree. `ISSUES` means that a route
or shape is contradicted by the inspected source. `BLOCKED` means that the
repositories do not provide enough evidence to close the question, such as a
missing deployed proxy or an unverified nested field. The overall result is
`ISSUES` because several SDK routes have no corresponding backend route in the
inspected repository, and at least two response-shape risks are visible.

## Source snapshots and citation convention

| Source | Snapshot / state |
| --- | --- |
| SDK | SDK snapshot `f14032815c9b132df97d4532b4e286ef6b0ab559`. SDK line citations below refer to the documented source snapshot. |
| Backend | Service API snapshot `cb553c50b1a89832897ec88c5f6baacbfcddac5f`. |
| Documentation guidance | SDK `docs/DOCUMENTATION_GUIDE.md:1-98`, read before the investigation. It says to document actual implementation facts and not infer backend behavior from method names (`:55-58`), and to distinguish high-level providers, low-level APIs, transports, and transaction serialization (`:8-20`). |

`[SDK]` paths are relative to the SDK root. `[FE]` paths are relative to the
`service-af-fe` root. The line numbers are citations into the files as they
were inspected. A backend `#[utoipa::path(path = "/api/...")]` line is the
public/documented route evidence; the adjacent Actix macro commonly omits the
`/api` segment. That distinction is important below.

## How the SDK constructs and decodes calls

The SDK's route strings are fragments, not complete URLs:

- `Caller` defaults `apiEndpoint` to `"api"` and stores each provider's
  `apiUrlPrefix` (`[SDK] src/general/utils/caller.ts:47-79`). Its URL builder
  emits `{baseUrl}/{apiEndpoint}/{apiUrlPrefix}/{url}` and avoids a duplicate
  slash for an empty endpoint fragment (`[SDK] src/general/utils/caller.ts:165-180`).
- An undefined body is a GET; a defined body is a JSON POST. Bigints in request
  bodies are serialized as decimal strings with an `n` suffix, and the default
  response parser converts suffixed strings back to `bigint` and JSON `null` to
  `undefined` (`[SDK] src/general/utils/caller.ts:190-240`, especially
  `:193-198` and `:233-240`).
- `fetchApiTransaction` parses a plain serialized transaction with
  `Transaction.from` unless `txKind: true` is supplied; `fetchApiTxObject`
  expects a response containing `txKind` and chooses `from` when a
  `sponsorSignature` is present, otherwise `fromKind` (`[SDK] src/general/utils/caller.ts:266-340`).
- Event endpoints that return an object with a cursor go through
  `fetchApiEvents`; indexer endpoints that return a raw event array get a
  cursor wrapper derived locally by the SDK (`[SDK] src/general/utils/caller.ts:342-410`).
- WebSocket URLs use the same host, endpoint, and provider prefix as HTTP while
  replacing `http(s)` with `ws(s)` (`[SDK] src/general/utils/caller.ts:425-470`).

The root provider exposes the HTTP-backed packages and the low-level API-backed
packages from one object (`[SDK] src/general/providers/aftermath.ts:246-386`).
`Aftermath.create` normally fetches addresses with `getAddresses`, then creates
an `AftermathApi` bound to a Sui gRPC client (`[SDK]
src/general/providers/aftermath.ts:146-179`, `:221-223`).

On the backend, the OpenAPI annotations use `/api/...` while the Actix route
macros and the service registrations use the route without `/api`; for
example, addresses is annotated `/api/addresses` but registered as
`/addresses` (`[FE] src/handlers/configs/addresses.rs:7-22`). The application
registers the handler functions directly in `src/main.rs:36-365`, and its
OpenAPI server list names the host but does not document a rewrite
(`[FE] src/main.rs:36-42`, `:314-330`, `src/openapi.rs:12-16`). The local nginx
configuration observed here proxies `/af-fe...` while preserving the suffix
(`[FE] dev/nginx/nginx.conf:33-38`; the container is exposed at
`docker-compose.yml:151-161`). I could not verify the production routing layer
that makes the SDK's `/api/...` URL reach the raw Actix route, so deployment
prefix behavior is `BLOCKED` rather than assumed.

## General and authentication APIs

### Config, wallet, gas, prices, coins, and user data

- **Addresses — `PASS` at the source boundary.** `Aftermath.getAddresses` has
  no body, so it is `GET /api/addresses` and returns `ConfigAddresses`
  (`[SDK] src/general/providers/aftermath.ts:212-223`). The backend declares
  the same GET path and returns the loaded config as JSON
  (`[FE] src/handlers/configs/addresses.rs:7-22`).

- **Wallet — `PASS`.** The wallet prefix is `wallet`
  (`[SDK] src/general/wallet/wallet.ts:45-53`). `getBalances` sends
  `POST /api/wallet/coin-balances` with `{ coins, walletAddress }` and expects
  `Balance[]`; `getAllBalances` sends `{ walletAddress }` to
  `/api/wallet/all-coin-balances` and expects a coin-type-to-balance record;
  `getPastTransactions` sends `{ walletAddress, cursor?, limit? }` to
  `/api/wallet/past-transactions` and expects `{ transactions, nextCursor,
  hasNextPage }` (`[SDK] src/general/wallet/wallet.ts:93-129`, `:131-160`,
  `:166-203`). The backend declares the same request fields and routes. It
  returns an ordered `Vec<String>` with `n` suffixes for coin balances
  (`[FE] src/handlers/wallet/coin_balances.rs:9-29`, `:43-62`), a
  `HashMap<String,String>` with the same suffix convention for all balances
  (`[FE] src/handlers/wallet/all_coin_balances.rs:10-31`, `:41-55`), and the
  transaction page shape (`[FE] src/handlers/wallet/past_transactions.rs:9-35`).
  Those suffixes agree with the SDK's bigint parser.

- **Dynamic gas — `PASS`.** The provider prefix is `dynamic-gas` and the SDK
  posts `{ serializedTx, walletAddress, gasCoinType }` to
  `/api/dynamic-gas`, expecting `{ txBytes, sponsoredSignature }`
  (`[SDK] src/general/dynamicGas/dynamicGas.ts:30`, `:37-79`; request/response
  types `[SDK] src/general/dynamicGas/dynamicGasTypes.ts:5-44`). The backend uses
  camelCase deserialization for the same three fields and camelCase response
  serialization for the two strings (`[FE] src/handlers/dynamic_gas/apply.rs:28-54`)
  and declares the matching POST route (`[FE] src/handlers/dynamic_gas/apply.rs:70-77`).

- **Prices — `PASS`.** `Prices` prefixes `price-info` and posts
  `{ coins: CoinType[] }` to `/api/price-info`; the response is a record keyed
  by coin type whose values have `price` and
  `priceChange24HoursPercentage` (`[SDK] src/general/prices/prices.ts:46-48`,
  `:100-135`; `[SDK] src/packages/coin/coinTypes.ts:90-118`). The backend accepts
  `coins: Vec<String>` and returns a transparent `HashMap<String,CoinPriceInfo>`
  with the same JSON field name (`[FE] src/handlers/prices/price_info.rs:24-40`,
  `[FE] src/handlers/prices/types.rs:8-16`). The commented-only call in
  `[SDK] src/general/priceFeeds/priceFeeds.ts:22` is not an active SDK route.

- **Auth — `PASS`.** `Auth` prefixes `auth` (`[SDK]
  src/packages/auth/auth.ts:50-60`). `adminCreateAuthAccount` posts
  `{ signature, serializedJson, walletAddress }` to
  `/api/auth/create-account` and expects a boolean; `getAccessToken` posts the
  same signed-envelope shape to `/api/auth/access-token` and expects
  `{ accessToken, header, expirationTimestamp }` (`[SDK]
  src/packages/auth/auth.ts:273-310`; request/response types `[SDK]
  src/packages/auth/authTypes.ts:32-100`). The backend declares both routes and
  the same camelCase request fields. It returns a transparent bool for account
  creation and maps its expiry to milliseconds in `expirationTimestamp`
  (`[FE] src/handlers/auth/create_account.rs:9-32`, `:40-50`; `[FE]
  src/handlers/auth/access_token.rs:9-40`, `:58-62`).

- **Coin metadata and verified coins — `PASS` for the route and core fields;
  `BLOCKED` for an optional field.** The `coins` provider posts
  `{ coins }` to `/api/coins/metadata` and GETs `/api/coins/verified`
  (`[SDK] src/packages/coin/coin.ts:120`, `:221-231`, `:293-307`). The backend
  declares those routes and returns `Vec<CoinMetadataWithInfo>` and
  `Vec<String>` respectively (`[FE] src/handlers/coins/metadata.rs:68-112`,
  `[FE] src/handlers/coins/verified_coins.rs:11-22`). The inspected backend
  metadata fields include `decimals`, `description`, `iconUrl`, optional `id`,
  `name`, `symbol`, optional `isGenerated`, and optional `metadataType`
  (`[FE] src/handlers/coins/metadata.rs:68-96`). The SDK additionally exposes
  optional `coingeckoId` (`[SDK] src/packages/coin/coinTypes.ts:120-133`), but no
  corresponding field appears in that backend response type; population of
  that optional field cannot be verified from these sources.

- **User data — `ISSUES` in the backend's own documentation.** The SDK prefixes
  `user-data`, posts `{ walletAddress }` to `/api/user-data/public-key`, and
  types the response as `string | undefined`; it posts `{ walletAddress, bytes,
  signature }` to `/api/user-data/save-public-key` and types the response as
  boolean (`[SDK] src/packages/userData/userData.ts:23-25`, `:49-81`; `[SDK]
  src/packages/userData/userDataTypes.ts:7-29`). Both backend routes exist, and
  the implementations return exactly those primitive values at
  `[FE] src/handlers/af_users/get_public_key.rs:53-64` and `[FE]
  src/handlers/af_users/add_public_key.rs:40-54`. However, the OpenAPI
  annotations advertise object responses: `{ address, publicKeyObject,
  publicKeyBytes }` and `{ publicKeyBytes }` (`[FE]
  src/handlers/af_users/get_public_key.rs:16-27`, `:46-52`; `[FE]
  src/handlers/af_users/add_public_key.rs:20-39`). The SDK matches the runtime
  implementation, not the backend's generated schema.

## Pools and farms

### Pools

The pool provider prefixes `pools` (`[SDK] src/packages/pools/pools.ts:145-153`).
The high-level HTTP map is:

| SDK method(s) and source | SDK request → response | Backend route evidence |
| --- | --- | --- |
| `getPool`, `getPools`, `getAllPools` — `[SDK] src/packages/pools/pools.ts:176-232` | `GET /api/pools/{poolId}` → `PoolObject`; `POST /api/pools` with `{ poolIds }` or `{}` → `PoolObject[]` | Deprecated single-object route `[FE] src/handlers/pools/pool/pool_object_deprecated.rs:9-18`; batch route `[FE] src/handlers/pools/pool_objects.rs:114-126`; the application registers both `[FE] src/main.rs:60-76`. **PASS**. |
| `getOwnedLpCoins` — `[SDK] src/packages/pools/pools.ts:248-252` | `POST /api/pools/owned-lp-coins`, `{ walletAddress }` → `PoolLpInfo[]` | `[FE] src/handlers/pools/owned_lp_coins.rs:31-43`. **PASS**. |
| `getPoolObjectIdsForLpCoinTypes` — `[SDK] src/packages/pools/pools.ts:358-366` | `POST /api/pools/pool-object-ids`, `{ lpCoinTypes }` → object-id results | `[FE] src/handlers/pools/pool_object_ids.rs:20-36`. **PASS** for route; exact undefined/null behavior is not proven. |
| `getTotalVolume24hrs`, `getTVL`, `getPoolsStats`, `getPoolSummaries` — `[SDK] src/packages/pools/pools.ts:394-447` | `/volume-24hrs` GET → number; `/tvl` POST with optional `{ poolIds }` → number; `/stats` POST with `{ poolIds }` → `PoolStats[]`; `/summary` POST with optional `{ poolIds }` → `PoolSummary[]` | `[FE] src/handlers/pools/all_24hr_volume_deprecated.rs:14-22`; `[FE] src/handlers/pools/tvl.rs:20-35`; `[FE] src/handlers/pools/pools_stats.rs:135-157`; `[FE] src/handlers/pools/pool_summaries.rs:54-69`. **PASS**. |
| `getInteractionEvents` on `Pools` and `Pool` — `[SDK] src/packages/pools/pools.ts:487-501`, `[SDK] src/packages/pools/pool.ts:355-369` | POST `/api/pools/interaction-events-by-user` or `/api/pools/{poolId}/interaction-events-by-user`; SDK receives a raw event array and derives the cursor locally | Global route is registered in `[FE] src/main.rs:65-70` and declared at `[FE] src/handlers/pools/pools_interaction_events_by_user.rs:35-40`; per-pool route is `[FE] src/handlers/pools/pool/pool_interaction_events_by_user.rs:34-40`. **PASS** for the route and local cursor convention. |
| `Pool.getStats`, `getVolumeData`, `getFeeData`, `getVolume24hrs` — `[SDK] src/packages/pools/pool.ts:277-342` | GET `/api/pools/{poolId}/stats`, `/volume/{timeframe}`, `/fees/{timeframe}`, `/volume-24hrs` → `PoolStats`, `PoolDataPoint[]`, `PoolDataPoint[]`, number | `[FE] src/handlers/pools/pool/pool_stats_deprecated.rs:11-18`; `[FE] src/handlers/pools/pool/pool_volume_data.rs:52-67`; `[FE] src/handlers/pools/pool/pool_fee_data.rs:60-74`; `[FE] src/handlers/pools/pool/pool_24hr_volume_deprecated.rs:19-24`. **PASS**. |

`getCreatePoolTransaction` posts to `/api/pools/transactions/create-pool` and
parses a full transaction (`[SDK] src/packages/pools/pools.ts:303-311`). No
matching `/pools/transactions/create-pool` handler or OpenAPI path was found in
the backend route scan and registration list (`[FE] src/main.rs:55-79`). This is
`ISSUES` until the route is restored, moved to another service, or the SDK
method is removed.

The low-level `PoolsApi` is different: it reads objects through
`AftermathApi.Objects()` and builds `tx.moveCall` commands
(`[SDK] src/packages/pools/api/poolsApi.ts:301-315`, `:327-372`). Those methods
do not map to a `service-af-fe` HTTP route.

### Farms

The high-level farms provider prefixes `farms` (`[SDK]
src/packages/farms/farms.ts:64-69`). Its source-level map is:

- `getStakingPool` uses `GET /api/farms/{objectId}` and returns a wrapped
  `FarmsStakingPoolObject`; `getStakingPools` and `getAllStakingPools` use
  `POST /api/farms` with `{ farmIds }` or `{}` and return arrays
  (`[SDK] src/packages/farms/farms.ts:79-158`). The backend has the matching
  GET and POST Actix routes at `[FE]
  src/handlers/afterburner_vaults/vault_deprecated.rs:6-14` and `[FE]
  src/handlers/afterburner_vaults/vaults.rs:114-129`.
- `getOwnedStakedPositions`, the owner-cap methods, and the one-time-admin-cap
  method post `{ walletAddress }` to `/owned-staked-positions`,
  `/owned-staking-pool-owner-caps`, and
  `/owned-staking-pool-one-time-admin-caps`, returning arrays of the corresponding
  SDK objects (`[SDK] src/packages/farms/farms.ts:160-226`). Backend request
  fields and routes agree (`[FE] src/handlers/afterburner_vaults/owned_staked_positions.rs:17-31`,
  `[FE] src/handlers/afterburner_vaults/owned_staking_pool_owner_caps.rs:29-43`,
  `[FE] src/handlers/afterburner_vaults/owned_staking_pool_one_time_admin_caps.rs:34-48`).
- `getTVL`, `getRewardsTVL`, and `getFarmSummaries` use POST `/tvl`,
  `/rewards-tvl`, and `/summary`, with optional `{ farmIds }` and scalar or
  summary-array responses (`[SDK] src/packages/farms/farms.ts:228-289`). Backend
  bodies use the same camelCase `farmIds`; TVL/rewards TVL return `f64`, and
  summary returns a transparent vector (`[FE]
  src/handlers/afterburner_vaults/tvl.rs:17-30`, `[FE]
  src/handlers/afterburner_vaults/rewards_tvl.rs:17-30`, `[FE]
  src/handlers/afterburner_vaults/farm_summaries.rs:30-56`).
- `getInteractionEvents` posts to `/api/farms/events-by-user`; the backend
  accepts `{ walletAddress, cursor?, limit? }` and returns raw indexer events,
  while the SDK derives `nextCursor` locally (`[SDK]
  src/packages/farms/farms.ts:350-367`; `[FE]
  src/handlers/afterburner_vaults/events_by_user.rs:10-17`, `:28-55`).

The farm route set is therefore `PASS` at the path/body boundary. Most farm
handlers use Actix route macros without OpenAPI response schemas, and the SDK
has many bigint-rich object types (`[SDK] src/packages/farms/farmsTypes.ts:103-155`,
`:213-235`). Exact nested field parity is `BLOCKED` without a generated schema
comparison or live responses.

## DCA, limit orders, and gas pools

- **DCA.** The provider prefix is `dca` (`[SDK] src/packages/dca/dca.ts:47-56`).
  Active and past queries are `POST /api/dca/active` and `/api/dca/past` with
  `{ walletAddress }` → `DcaOrderObject[]`; the backend declares the same
  request and transparent-vector response (`[SDK] src/packages/dca/dca.ts:82-114`; `[FE]
  src/handlers/dca/get_active_orders.rs:11-29`; `[FE]
  src/handlers/dca/get_past_orders.rs:11-29`). Create-order is
  `POST /api/dca/transactions/create-order` with the typed DCA body, including
  coin types, bigint amounts, millisecond fields, trade count, slippage, and
  optional recipient/fee/sponsorship fields (`[SDK]
  src/packages/dca/dca.ts:120-150`, `[SDK] src/packages/dca/dcaTypes.ts:48-105`).
  The backend accepts the same camelCase fields and returns a frontend-ready
  serialized transaction string (`[FE] src/handlers/dca/create_order.rs:45-110`,
  `:119-134`), which agrees with SDK `Transaction.from` parsing.

  The deprecated `getAllDcaOrders` still posts to `/api/dca/orders`
  (`[SDK] src/packages/dca/dca.ts:62-80`), but no `/dca/orders` handler is
  registered; the backend registers only active, past, cancel, create, and the
  two deprecated user-key handlers (`[FE] src/main.rs:282-287`). This is
  `ISSUES`, even though the SDK marks the method deprecated. The cancel method
  posts the matching signed body to `/api/dca/cancel`, but the SDK declares a
  boolean while the backend documents and constructs an empty object
  `ResponseDataWrapper {}` (`[SDK] src/packages/dca/dca.ts:153-180`; `[FE]
  src/handlers/dca/cancel_order.rs:32-52`, `:69-83`). This is a concrete
  response-shape `ISSUES` item. Deprecated `/api/dca/user/get` and
  `/api/dca/user/add` do have backend routes (`[SDK] src/packages/dca/dca.ts:235-252`,
  `[FE] src/handlers/dca/get_public_key_deprecated.rs:42-47`, `[FE]
  src/handlers/dca/add_public_key_deprecated.rs:15-20`).

- **Limit orders — `PASS` at the inspected boundary.** The provider prefixes
  `limit-orders` (`[SDK] src/packages/limitOrders/limitOrders.ts:45-55`). Active
  and past queries post signed or owner bodies to `/api/limit-orders/active` and
  `/past` and return `LimitOrderObject[]`; create-order posts the typed order
  body and returns a full serialized transaction; cancel posts `{ walletAddress,
  bytes, signature, orderObjectIds }` and returns boolean; min-order-size posts
  `{}` and returns a number (`[SDK] src/packages/limitOrders/limitOrders.ts:70-205`,
  `[SDK] src/packages/limitOrders/limitOrdersTypes.ts:123-259`). The backend has
  all five routes (`[FE] src/handlers/limit_order/get_active_orders.rs:151-181`,
  `[FE] src/handlers/limit_order/get_past_orders.rs:15-37`, `[FE]
  src/handlers/limit_order/create_order.rs:27-95`, `[FE]
  src/handlers/limit_order/cancel_order.rs:9-41`, `[FE]
  src/handlers/limit_order/min_order_size.rs:16-21`). Its order caster appends
  `n` to the integer balance fields, matching the SDK's `Balance` decoding
  (`[FE] src/limit_orders_utils.rs:103-150`).

- **Gas pools — `PASS` for the route and transaction envelope.** The provider
  prefixes `gas-pool` (`[SDK] src/packages/gasPools/gasPools.ts:51-61`). `getPool`
  posts to `/api/gas-pool/pool` and returns pool state; create, deposit, withdraw,
  grant, revoke, and share post to the corresponding
  `/transactions/{create,deposit,withdraw,grant,revoke,share}` paths and return
  `txKind` objects, optionally with deferred PTB argument references. The SDK
  parses those via `fetchApiTxObject(..., { txKind: true })`
  (`[SDK] src/packages/gasPools/gasPools.ts:68-168`, `:206-274`; types `[SDK]
  src/packages/gasPools/gasPoolsTypes.ts:19-151`). Backend route annotations,
  request types, and `txKind`/argument response fields agree (`[FE]
  src/handlers/gas_pool/pool.rs:37-51`; `[FE]
  src/handlers/gas_pool/transactions/create.rs:60-84`; `[FE]
  src/handlers/gas_pool/transactions/deposit.rs:87-111`; `[FE]
  src/handlers/gas_pool/transactions/withdraw.rs:48-79`; `[FE]
  src/handlers/gas_pool/transactions/grant.rs:18-48`; `[FE]
  src/handlers/gas_pool/transactions/revoke.rs:10-37`; `[FE]
  src/handlers/gas_pool/transactions/share.rs:18-45`). Sponsor is the deliberate
  exception: the SDK expects direct `{ transaction, sponsorSignature, digest }`
  and does not use `fetchApiTxObject`, matching the backend response
  (`[SDK] src/packages/gasPools/gasPools.ts:182-194`; `[FE]
  src/handlers/gas_pool/transactions/sponsor.rs:11-64`).

## Router, referrals, rewards, staking, and Sui

- **Router.** The provider prefixes `router` (`[SDK]
  src/packages/router/router.ts:63-70`). `getVolume24hrs` is GET
  `/api/router/volume-24hrs` → number; `getSupportedCoins` is GET
  `/api/router/supported-coins` → `CoinType[]`; both have backend handlers and
  are registered (`[SDK] src/packages/router/router.ts:81-109`; `[FE]
  src/handlers/router/all_24hr_volume_deprecated.rs:6-14`, `[FE]
  src/handlers/router/supported_coins.rs:7-12`, `[FE] src/main.rs:263-269`).
  Both amount-in and amount-out route queries POST `/api/router/trade-route`
  with the SDK's union body (`coinInType`, `coinOutType`, one of
  `coinInAmount`/`coinOutAmount`, optional slippage/referral/allowlists) and
  return `RouterCompleteTradeRoute` (`[SDK] src/packages/router/router.ts:135-213`,
  `[SDK] src/packages/router/routerTypes.ts:198-267`). The backend request has
  the same fields and the same documented route (`[FE]
  src/handlers/router/trade_route.rs:25-49`, `:182-210`). Transaction and add-trade
  paths also match: `/transactions/trade` returns a serialized full transaction,
  and `/transactions/add-trade` returns `{ tx, coinOutId }` (`[SDK]
  src/packages/router/router.ts:219-297`; `[FE]
  src/handlers/router/transactions/trade.rs:13-50`, `[FE]
  src/handlers/router/transactions/add_trade.rs:76-105`). User events use
  `/events-by-user` and the SDK's local raw-array cursor wrapper; the backend
  route accepts the same sender/cursor/limit convention (`[SDK]
  src/packages/router/router.ts:299-324`; `[FE]
  src/handlers/router/events_by_user.rs:10-45`).

  `searchSupportedCoins` is an `ISSUES` item. The SDK requests
  `GET /api/router/supported-coins/{filter}` (`[SDK] src/packages/router/router.ts:111-133`),
  but the inspected backend exposes only `/router/supported-coins` and
  `/router/supported-coins-v2`, with no parameterized filter route (`[FE]
  src/handlers/router/supported_coins.rs:7-12`, `[FE]
  src/handlers/router/supported_coins_v2.rs:6-14`, and registrations `[FE]
  src/main.rs:263-265`).

- **Referrals — `PASS`.** `Referrals` prefixes `referrals` and maps its six
  methods to `POST /api/referrals/ref-code`, `/linked-ref-code`, `/query`,
  `/availability`, `/create`, and `/link` (`[SDK]
  src/packages/referrals/referrals.ts:31-95`). The request/response types are
  signed wallet envelopes, optional ref-code/link fields, pagination, and
  creation/link status objects (`[SDK] src/packages/referrals/referralsTypes.ts:22-195`).
  The backend declares each same route and matching field shapes, including
  nullable optional ref codes and timestamps (`[FE]
  src/handlers/referral/get_ref_code.rs:22-44`; `[FE]
  src/handlers/referral/get_linked_ref_code.rs:22-48`; `[FE]
  src/handlers/referral/query_referees.rs:30-56`; `[FE]
  src/handlers/referral/check_ref_code_availability.rs:15-38`; `[FE]
  src/handlers/referral/create_ref_link.rs:25-55`; `[FE]
  src/handlers/referral/set_referrer.rs:25-64`). The SDK normalizes null optional
  fields to `undefined` (`[SDK] src/packages/referrals/referrals.ts:43-66`).

- **Rewards — routes match; amount encoding is `ISSUES/BLOCKED`.** The provider
  prefixes `rewards` and calls `/points`, `/history`, `/claimable`,
  `/expected-rewards`, and `/transactions/claim` (`[SDK]
  src/packages/rewards/rewards.ts:18-101`). Request fields and outer response
  objects line up: points returns `{ totalPoints }`; history returns
  `{ history, pagination }`; claimable returns `{ rewards }`; expected rewards
  returns `{ epoch, total, domains }`; claim returns `{ txKind }` and is parsed
  with `fetchApiTxObject` (`[SDK] src/packages/rewards/rewardsTypes.ts:20-191`,
  `:210-293`; `[FE] src/handlers/rewards/points.rs:9-41`; `[FE]
  src/handlers/rewards/history.rs:9-40`, `:86-100`; `[FE]
  src/handlers/rewards/expected_rewards.rs:131-156`; `[FE]
  src/handlers/rewards/transactions/claim.rs:8-51`).

  The inspected source does not prove the numeric wire contract for amounts.
  The SDK types history and claimable amounts as `Balance`/`bigint`
  (`[SDK] src/packages/rewards/rewardsTypes.ts:105-117`, `:182-190`), while the
  backend response structs explicitly type both fields as plain `String` and
  describe them as raw integer strings (`[FE] src/handlers/rewards/history.rs:42-53`,
  `[FE] src/handlers/rewards/claimable.rs:15-30`). The SDK only converts strings
  ending in `n` (`[SDK] src/general/utils/caller.ts:193-198`). No inspected
  handler line appends `n` for these reward fields. If the live JSON is plain
  digits, callers receive strings despite the SDK type. A live response or the
  downstream rebate-client serialization is required to close this; treat it as
  an `ISSUES` item with a `BLOCKED` runtime-verification part.

- **Staking — `PASS` for the listed HTTP methods.** The high-level provider
  prefixes `staking` and uses GET `/active-validators`, `/validator-apys`,
  `/validator-configs`, `/sui-tvl`, `/afsui-exchange-rate`,
  `/staked-sui-vault-state`, `/apy`; POST `/staking-positions`,
  `/delegated-stakes`, `/validator-operation-caps`, and `/historical-apy`
  (`[SDK] src/packages/staking/staking.ts:118`, `:137-240`, `:365-452`). The
  backend has matching route annotations/macros. Representative shape evidence:
  active validators and validator APYs are vectors/records (`[FE]
  src/handlers/staking/active_validators.rs:123-134`, `[FE]
  src/handlers/staking/validators_apy.rs:15-26`); user positions, delegated
  stakes, and operation caps accept wallet/pagination bodies and return vectors
  (`[FE] src/handlers/staking/positions_by_user.rs:52-70`, `[FE]
  src/handlers/staking/delegated_stakes.rs:9-57`, `[FE]
  src/handlers/staking/validator_operation_caps.rs:9-40`); TVL and vault-state
  use `n`-suffixed integer strings while exchange rate/APY are f64
  (`[FE] src/handlers/staking/afsui_tvl.rs:14-27`, `[FE]
  src/handlers/staking/staked_sui_vault_state.rs:13-32`, `:55-67`, `[FE]
  src/handlers/staking/afsui_to_sui_exchange_rate.rs:21-33`, `[FE]
  src/handlers/staking/apy.rs:27-39`); historical APY is `{ timeframe }` →
  `[{ timestamp, apy }]` (`[FE] src/handlers/staking/historical_apy.rs:12-38`).
  Staking transaction builders under the low-level API are not HTTP routes.

- **Sui system state — `PASS` for the SDK method.** The SDK's `sui` prefix
  exposes GET `/api/sui/system-state` (`[SDK] src/packages/sui/sui.ts:45-74`).
  The backend declares and registers the matching route and returns the
  `SuiSystemStateSummary` shape (`[FE] src/handlers/sui/system_state.rs:117-135`,
  `[FE] src/main.rs:324-328`). The backend also exposes `/api/sui/epoch`
  (`[FE] src/handlers/sui/epoch.rs:9-24`), but no active high-level SDK call in
  the inspected source uses it.

## SuiFrens, faucet, NFT AMM, and referral-vault routes

These high-level classes contain active HTTP path strings, but no corresponding
route was found in the inspected `service-af-fe/src` handler tree or in the
handler registrations at `[FE] src/main.rs:36-365`. This is source-scan evidence
only; it does not prove that another service or deployment layer serves them.

- **SuiFrens — `ISSUES/UNVERIFIED`.** The SDK prefixes `sui-frens` and calls
  `/api/sui-frens/{JSON ids}`, `/owned-sui-frens`, `/owned-staked-sui-frens`,
  `/filtered-staked-sui-frens/{query}`, `/staked-sui-frens/{JSON ids}`,
  `/capy-labs-app`, `/owned-accessories`, the four `/events/{harvest-fees,mix,stake,unstake}`
  paths, `/stats`, and `/accessories` on an individual SuiFren
  (`[SDK] src/packages/suiFrens/suiFrens.ts:57-62`, `:126-241`; `[SDK]
  src/packages/suiFrens/suiFren.ts:23-36`, `:129-136`). A full-text route scan
  of the backend's `src/handlers`, `src/main.rs`, and `src/openapi.rs` found no
  `sui-frens`/`sui_frens` handler. The low-level `SuiFrensApi` is instead an
  on-chain helper, so its transaction methods do not establish an FE HTTP
  route (`[SDK] src/general/providers/aftermathApi.ts:303-307`).

- **Faucet — `ISSUES/UNVERIFIED`.** `Faucet.getSupportedCoins` is a GET to
  `/api/faucet/supported-coins` (`[SDK] src/packages/faucet/faucet.ts:21-29`),
  but no faucet handler or route registration was found in the inspected
  backend source. The low-level `FaucetApi` builds Move transactions and
  queries on-chain events (`[SDK] src/packages/faucet/api/faucetApi.ts:29-35`,
  `:72-85`), which is a separate API surface.

- **NFT AMM — `ISSUES/UNVERIFIED`.** `NftAmm.getMarket` and `getAllMarkets`
  call GET `/api/nft-amm/markets/{objectId}` and `/api/nft-amm/markets`
  (`[SDK] src/packages/nftAmm/nftAmm.ts:6-22`, `:32-49`). No matching
  `nft-amm`/`nft_amm` handler or registration was found in the inspected
  backend. Its low-level API is wired through `AftermathApi` for on-chain
  transaction logic (`[SDK] src/general/providers/aftermathApi.ts:315-319`).

- **Referral vault — `ISSUES/UNVERIFIED` and deprecated.** The high-level
  `ReferralVault` provider is explicitly deprecated and calls GET
  `/api/referral-vault/{referee}/referrer` (`[SDK]
  src/general/providers/aftermath.ts:282-288`, `[SDK]
  src/packages/referralVault/referralVault.ts:11-63`). No matching backend route
  was found. The low-level replacement-like operations use Move calls and
  inspection bytes (`[SDK] src/packages/referralVault/api/referralVaultApi.ts:50-185`),
  not `service-af-fe` HTTP.

## Perpetuals

Perpetuals is the largest typed HTTP surface. The root class prefixes
`perpetuals` (`[SDK] src/packages/perpetuals/perpetuals.ts:92-169`); the account,
market, and vault classes reuse that prefix. The following root map covers the
high-level provider methods:

| SDK path fragment and shape | SDK evidence | Backend evidence / result |
| --- | --- | --- |
| `POST /api/perpetuals/all-markets`, `{ collateralCoinType }` → `{ markets }` | `[SDK] src/packages/perpetuals/perpetuals.ts:193-207` | `[FE] src/handlers/perpetuals/markets/all_market_objects.rs:31-49`. **PASS**. |
| `POST /api/perpetuals/markets`, `{ marketIds }` → `{ marketDatas }` (wrapped by SDK as markets) | `[SDK] src/packages/perpetuals/perpetuals.ts:254-274` | `[FE] src/handlers/perpetuals/markets/market_objects.rs:58-82`. **PASS**. |
| `POST /api/perpetuals/vaults/config`, `{}` → `PerpetualsVaultsConfig`; `POST /vaults`, `{}` or `{ vaultIds }` → `{ vaults }` | `[SDK] src/packages/perpetuals/perpetuals.ts:290-364` | `[FE] src/handlers/perpetuals/vault/data/config.rs:85-102`, `[FE] src/handlers/perpetuals/vault/data/vault_objects.rs:36-54`. **PASS** for paths. |
| `POST /api/perpetuals/accounts/positions`, `{ accountIds, marketIds? }` → `{ accounts }`; `/accounts/owned`, `/vaults/owned-vault-caps`, `/vaults/owned-vault-assistant-caps`, `/vaults/owned-withdraw-requests`, `/vaults/owned-lp-coins`, and `/accounts` → typed cap/data objects | `[SDK] src/packages/perpetuals/perpetuals.ts:467-606` | `[FE] src/handlers/perpetuals/account/data/positions.rs:39-63`, `[FE] src/handlers/perpetuals/account/data/owned_account_objects.rs:39-63`, `[FE] src/handlers/perpetuals/vault/data/owned_vault_caps.rs:59-83`, `owned_vault_assistant_caps.rs:31-55`, `owned_withdraw_requests.rs:36-60`, `owned_lp_coins.rs:55-79`, and `account/data/account_objects.rs:32-56`. **PASS** for routes. |
| `/market/candle-history`, `/market/funding-history`, `/markets/24hr-stats`, `/markets/prices`, `/vaults/lp-coin-prices` → typed historical/stat/price objects | `[SDK] src/packages/perpetuals/perpetuals.ts:613-731` | `[FE] src/handlers/perpetuals/markets/candle_history.rs:74-98`, `funding_history.rs:72-96`, `markets_24hr_stats.rs:80-107`, `prices.rs:64-88`, `vault/data/lp_coin_prices.rs:37-61`. **PASS** for paths. |
| Root transaction builders `/transactions/transfer-cap`, `/transactions/create-account` → `txKind` response objects; builder-code transaction/data paths and rebate/report paths | `[SDK] src/packages/perpetuals/perpetuals.ts:753-811`, `:1075-1121`, `:1149-1395` | `[FE] src/handlers/perpetuals/transactions/transfer_cap.rs:64-82`, `account/transactions/create_account.rs:76-94`, `builder_codes/transactions/create_integrator_config.rs:55-79`, `remove_integrator_config.rs:46-70`, `builder_codes/data/integrator_config.rs:51-75`, `rebates/data/calculate_rewards.rs:132-150`, `create_csv_rebates.rs:48-66`, `create_referral_csv_rebates.rs:30-48`. **PASS** for route families found. |
| WebSocket `ws/updates` → `/api/perpetuals/ws/updates` | `[SDK] src/packages/perpetuals/perpetuals.ts:1558-1575`, `:1848-1865`; URL construction `[SDK] src/general/utils/caller.ts:442-470` | `[FE] src/handlers/perpetuals/websockets/general_ws_proxy.rs:482`; registration `[FE] src/main.rs:217-232`. **PASS** for the endpoint; subscription message parity was not exhaustively checked. |

`PerpetualsAccount` chooses the `account` or `vault` route family from the
capability shape. Its transaction fragments include allocation/deallocation,
deposit/withdraw/transfer collateral, market/limit/scale/stop/SL-TP orders,
cancel/edit/create/cancel TWAP orders, set leverage, cancel-and-place, and
agent-wallet grant/revoke (`[SDK] src/packages/perpetuals/perpetualsAccount.ts:210-1051`,
`:1178-1185`, `:1804-1873`). Its preview and data fragments include
`previews/{place-market-order,place-limit-order,place-scale-order,cancel-orders,
set-leverage,edit-collateral}`, `stop-order-datas`, `twap-order-datas`,
`collateral-history`, `order-history`, and `margin-history`
(`[SDK] src/packages/perpetuals/perpetualsAccount.ts:1320-1623`, `:1677-1778`).
The backend has matching account route annotations for these families, including
the transaction set in `[FE] src/handlers/perpetuals/account/transactions/` and
the preview/data set in `[FE] src/handlers/perpetuals/account/previews/` and
`[FE] src/handlers/perpetuals/account/data/`; representative exact routes are
`[FE] src/handlers/perpetuals/account/transactions/place_market_order.rs:17-35`,
`cancel_orders.rs:11-29`, `deposit_collateral.rs:121-145`,
`create_twap_orders.rs:169-187`, and `[FE]
src/handlers/perpetuals/account/previews/place_market_order.rs:11-29`.

`PerpetualsVault` similarly emits vault transaction fragments for deposits,
withdraw requests, force-withdraw processing, pause, owner fee/collateral/
liquidity actions, assistant grants/revokes, order operations, and the same
preview families (`[SDK] src/packages/perpetuals/perpetualsVault.ts:130-633`,
`:667-823`). The backend route annotations cover the corresponding vault
families, including `[FE] src/handlers/perpetuals/vault/transactions/deposit.rs:100-118`,
`create_vault.rs:138-156`, `create_withdraw_request.rs:56-74`,
`owner/process_withdraw_requests.rs:47-65`, `owner/withdraw_collateral.rs:77-95`,
and previews `[FE] src/handlers/perpetuals/vault/previews/deposit.rs:75-99`,
`owner/process_withdraw_requests.rs:80-104`, and
`process_force_withdraw_request.rs:103-127`.

The source evidence supports `PASS` for the named Perpetuals route families:
the backend also registers the corresponding account, vault, market, builder,
rebate, and WebSocket handlers (`[FE] src/main.rs:108-240`). It does **not**
close every nested request/response field, optional field, numeric encoding, or
WebSocket message variant. That field-level comparison is `BLOCKED`; the table
should not be read as a claim that every deep TypeScript interface has been
proven identical to every Rust struct.

## High-level providers versus package APIs

The high-level classes above are the HTTP clients. The `AftermathApi` package
surface is a separate low-level, on-chain layer: its constructor accepts a
`SuiGrpcClient`, package/object addresses, and an optional JSON-RPC client
(`[SDK] src/general/providers/aftermathApi.ts:126-179`). It creates helpers for
objects, dynamic fields, events, inspections, transactions, wallet/NFT/coin/Sui
operations, and package APIs (`[SDK] src/general/providers/aftermathApi.ts:225-361`).

Consequences for this map:

- `PoolsApi`, `DcaApi`, `StakingApi`, `FaucetApi`, `SuiFrensApi`, `NftAmmApi`,
  `ReferralVaultApi`, and `PerpetualsApi` build Move calls, query fullnode data,
  or cast on-chain events. For example, `PoolsApi.tradeTx` calls
  `tx.moveCall` (`[SDK] src/packages/pools/api/poolsApi.ts:327-372`), and
  `DcaApi` explicitly documents that it does not send HTTP
  (`[SDK] src/packages/dca/api/dcaApi.ts:15-20`). These methods have no
  `service-af-fe` route to map.
- `MultisigApi.getMultisigForUser` is local key derivation and explicitly makes
  no network request (`[SDK] src/packages/multisig/api/multisigApi.ts:7-13`,
  `:58-80`).
- `ReferralVaultApi` uses Move calls and inspection bytes, not the deprecated
  high-level HTTP route (`[SDK] src/packages/referralVault/api/referralVaultApi.ts:50-185`).

Calling a low-level package API “unmapped” is therefore not an omission: it is
an intentional transport boundary. The route map applies to methods that call
`fetchApi`, `fetchApiTransaction`, `fetchApiTxObject`, `fetchApiEvents`,
`fetchApiIndexerEvents`, or `openWsStream`.

## Issues and blocked verification items

1. **Missing or unverified FE routes (`ISSUES`).** No matching route was found
   in the inspected backend source/registration set for SDK high-level
   `/api/dca/orders`, `/api/pools/transactions/create-pool`,
   `/api/faucet/supported-coins`, `/api/nft-amm/markets...`,
   `/api/referral-vault/...`, or the SuiFrens HTTP paths. The SDK router filter
   path `/api/router/supported-coins/{filter}` also has no backend counterpart.
   A missing route in this source snapshot is not proof that a separate service
   does not serve it, so deployment ownership remains to be checked.
2. **DCA cancellation response (`ISSUES`).** The SDK returns `boolean`, while
   the backend's documented response is `{}` even though its implementation
   forwards the downstream result (`[SDK] src/packages/dca/dca.ts:153-180`; `[FE]
   src/handlers/dca/cancel_order.rs:32-52`, `:69-83`).
3. **User-data OpenAPI drift (`ISSUES`).** Backend annotations advertise object
   responses but runtime implementations return a string/undefined and boolean
   (`[FE] src/handlers/af_users/get_public_key.rs:46-64`; `[FE]
   src/handlers/af_users/add_public_key.rs:33-54`).
4. **Rewards amount encoding (`ISSUES/BLOCKED`).** Backend response structs say
   plain strings while the SDK types amounts as bigint; the inspected source
   does not prove an `n` suffix is added before serialization
   (`[FE] src/handlers/rewards/history.rs:42-53`, `[FE]
   src/handlers/rewards/claimable.rs:22-30`; `[SDK]
   src/general/utils/caller.ts:193-198`).
5. **Public `/api` mounting (`BLOCKED`).** OpenAPI and SDK agree on `/api`, but
   raw Actix macros omit it. The available local nginx file shows an `/af-fe`
   proxy, not the production rewrite, so direct deployment reachability cannot
   be proved from this checkout (`[FE] src/openapi.rs:12-16`, `[FE]
   dev/nginx/nginx.conf:33-38`).
6. **Deep schema parity (`BLOCKED`).** Perpetuals and farms have matching route
   families, but a full nested TypeScript-to-Rust field diff and live response
   check were outside what the two source snapshots can prove.

## Result, sources, and file changed

- **Result: `ISSUES`.** The route families for general config, wallet, dynamic
  gas, prices, auth, core coin endpoints, limits, gas pools, referrals,
  staking, Sui system state, and the inspected pools/farms/perpetuals routes
  have primary-source matches. The concrete missing-route and shape issues
  above prevent a clean `PASS`.
- **Primary sources:** SDK source under `src/`; backend handler source under
  `service-af-fe/src/`; backend registration `[FE] src/main.rs:36-365`; backend
  OpenAPI annotations; SDK guidance `[SDK] docs/DOCUMENTATION_GUIDE.md:1-98`.
- **File changed by this task:** `docs/research/service-api-map.md` only. No SDK
  source file, existing documentation file, or other file under
  `docs/research` was edited.
- **Verification:** after writing this report, the requested file was checked
  for existence and its required `PASS`/`ISSUES`/`BLOCKED`, source, and file
  changed markers were searched. The pre-existing SDK worktree changes remain
  untouched.
