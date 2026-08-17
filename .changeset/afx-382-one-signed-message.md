---
"aftermath-ts-sdk": minor
---

Move to one cached Terms and Conditions signature

af-fe now verifies a single signed message in one place and no longer passes it to the services behind it. The message is the plain string `"Aftermath Terms and Conditions"`, signed once per session and reused everywhere.

- `UserData.createTermsAndConditionsMessage()` (and `UserData.termsAndConditionsMessage`) returns that canonical string to sign. The old `createSignTermsAndConditionsMessageToSign()` (JSON `{action}`) is deprecated; the backend now rejects the wrapper with error 2034.
- Fields that used to ride inside the per-action signed message now travel in the request body: `refCode` on `createReferralLink` and `setReferrer`; `orderObjectIds` on `cancelLimitOrder` and `closeDcaOrder`.
- The per-action `...MessageToSign` helpers (referrals create/link, limit cancel, dca cancel) are deprecated.
- `PerpetualsSponsorConfig.bytes`/`signature` now carry the cached T&C signature, and `walletAddress` must be the connected wallet (docs only; shape unchanged).
