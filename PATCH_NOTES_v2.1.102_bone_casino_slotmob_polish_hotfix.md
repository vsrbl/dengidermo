# PATCH NOTES v2.1.102 — Bone / casino text / slot mob polish hotfix

## Fixed / Changed

- Reworked `BONE NOISE` skin:
  - darker fossil-circuit body;
  - clean bone frame and cyan cracks;
  - removed the messy horizontal static stripe look.
- Casino terminal result line:
  - keeps a short visible line;
  - long text now uses ellipsis;
  - full result remains readable via hover tooltip / explain panel.
- 5-slot valuable WPN/ABL chests:
  - no longer auto-close just because room phase is not `play`;
  - server offer remains authoritative, so the second pick can stay visible.
- Slot mob staging:
  - first appearance is delayed longer;
  - BET terminal is removed after overload;
  - chest break FX starts after the casino window has time to close;
  - mob remains hidden/non-physical until the break/scatter/gather staging finishes.
- Slot mob visuals:
  - big chunks and fake GLD/EXP/STC/WPN/ABL fragments now use heavier ballistic motion;
  - collapse/gather effect is stronger and more physical.
- Slot mob balance:
  - HP reduced from 2300 to 1530;
  - movement speed raised from 118 to 177.
- Slot mob shooter mode:
  - braces in corners instead of micro-correcting every frame, reducing jitter.
- Slot mob audio:
  - added more layered feedback to overload, rebuild and roll events.
- Cursor:
  - added stronger CSS guard against native pointer cursor leaks, including iframe hover.

## Checks

- `node --check` passed for changed JS modules.
- Imported `shared/protocol`, `shared/data`, and `shared/sim` successfully.
