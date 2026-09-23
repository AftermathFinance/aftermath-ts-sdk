---
"aftermath-ts-sdk": patch
---

feat(achievements): add claimAchievement assist stub

Add `claimAchievement()` (`POST /api/achievements/claim`). It returns an unsigned user-pays intent. The caller signs and pays. This client does not mint or sign. `AchievementsMeUnlock` may include `qualifyStatus` and `qualifyDigest`.
