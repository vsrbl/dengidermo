# Patch v2.1.147 — process_controller_start_version_fix

## Fixed

- Process Controller core selection is now authoritative even when it comes through the older appearance/core preset path.
- Starting a run with the Process Controller now normalizes the hero before snapshot weapon labels are collected, so the first visible slot is `CMD`, not `SHG`.
- Core presets `living_casino` and `process_controller` now force the matching hero when used as selected shell ids.
- Menu/cache version strings were advanced to `v2.1.147` in both `index.html` and `404.html`.

## Verification

- `createPlayer(..., { id: 'process_controller' })` starts as `process_controller` with `CMD / QRN / SAW`.
- `createPlayer(..., { id: 'process_controller', hero: 'base' })` still starts as `process_controller`, preventing stale/base hero payloads from causing SHG starts.
- Process Controller snapshots are normalized before player weapon labels are emitted.
