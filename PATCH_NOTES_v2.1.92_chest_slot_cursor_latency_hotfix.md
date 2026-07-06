# PATCH NOTES v2.1.92 — Chest slot / cursor latency hotfix

Date: 2026-07-06

## Fixes

- Simple/GOOD paid choice chests are now compact:
  - WPN / ABL tier 0-1 can roll only 1-2 slots.
  - 3-slot choice windows are reserved for more valuable tier-2 chests.
  - 5-slot / double-pick choice windows remain reserved for the highest tier.
- Added a defensive slot clamp in chest opening logic so older/dev room objects also obey the same cap.
- Reduced cursor/aim sluggishness:
  - input now listens to `pointerrawupdate` when the browser supports it;
  - `pointermove` and `mousemove` remain fallbacks;
  - removed expensive `mix-blend-mode` and `filter: drop-shadow()` from the DOM cursor shell;
  - added `will-change`, `contain`, and explicit no-transition rules for the cursor.

## Validation

- `node --check` passed for changed JS modules.
- Generated-room smoke test confirmed tier 0-1 WPN/ABL chests never exceed 2 slots.
- Archive integrity verified with `unzip -t`.
