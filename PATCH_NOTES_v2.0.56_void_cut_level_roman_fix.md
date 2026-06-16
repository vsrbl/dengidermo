# PATCH v2.0.56 — VOID CUT LEVEL / ROMAN STYLE FIX

## Fix: VOID CUT upgrades no longer cap at III

`VOID CUT` / `VOID LASER` builder was offered as an infinite/stacking core, but the shared ABL upgrade apply path still capped every non-`SIGNAL SPIKE` core at level III.

Result:
- the player could pick `VOID CUT III → IV`,
- but the stored level stayed at III,
- no extra link point was added,
- HUD/status did not show a higher level.

Fixed:
- `VOID CUT` now upgrades past III correctly.
- Each level adds one real link point/segment.
- HUD Q label now shows `Q: VOID CUT IV [LINK IV]`, `V`, etc.
- Active description now includes `LINK POINTS` for VOID CUT.
- Upgrading VOID CUT clears stale in-progress chain state, resets Q cooldown, and shows a feedback pulse.

## Roman numeral style

Roman level labels are now preserved past III:
- `I`, `II`, `III`, `IV`, `V`, `VI`, etc.
- No more visual fallback to `4`, `5`, etc. for Q core levels.
- ABL upgrade card preview uses roman numerals too.
- VOID LINK segment feedback uses roman numerals.
- Dev Q level selector also displays roman levels.

## Dev mode

- Dev Q level can now set VOID CUT / SIGNAL SPIKE higher than III for testing.
- Normal capped Q cores still remain capped to III in dev mode.

## Checks

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- `void cut upgrade smoke ok`
- `sim import ok`
- `i18n import ok`
- `zip test ok`
