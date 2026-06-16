# PATCH NOTES — v2.0.50 connection script hotfix

## Fix
- Исправлен критический stale script reference в `index.html`.
- В v2.0.46 UI показывал `v2.0.46`, но главный module script всё ещё указывал на `src/main.v2-0-43.js?v=2.0.43`.
- Из-за этого сайт мог грузить старый/битый клиент, ловить mismatch или бесконечно висеть на подключении, хотя GitHub Pages и Render health выглядели OK.

## Now
- `index.html` подключает `src/main.v2-0-50.js?v=2.0.50`.
- Все module filenames/imports обновлены на `v2-0-50`.
- Server/protocol/package version обновлены на `v2.0.50`.
