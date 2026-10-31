---
"aftermath-ts-sdk": patch
---

feat(achievements): add read-only achievements client stubs

Add `Aftermath.Achievements()` with `getDefinitions()` (`GET /api/achievements/definitions`)
and `getMe()` (`POST /api/achievements/me`). Types follow the achievements
service `DefinitionView` and `MeResponse` camelCase fields. No mint helpers.
