# v2.1.144 — RUSH boss volley + HP hotfix

## Fixes

- Reduced the charging RUSH boss radial bullet pressure.
- RUSH no longer fires a background radial volley during windup/cooldown, so the charge release reads as one clean row instead of two stacked rings.
- Reduced RUSH radial bullet counts:
  - idle volley: `8–12` → `6–8`;
  - charge release: `10` → `6`.
- Added a readable HP bar with a percentage over the RUSH boss.
- Added the same percent HP bar to the dash fragment boss that shares the charge telegraph path.

## Checks

- JS syntax check.
- ESM import check.
- Server `/health` smoke test.
