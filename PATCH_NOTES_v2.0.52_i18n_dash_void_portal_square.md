# PATCH NOTES — v2.0.55 i18n dash void portal square

- Player-facing text audit pass:
  - removed remaining technical/internal wording from tooltips and offer previews;
  - added extra EN localization fallbacks for dynamic WPN/ABL rewards, chest feed lines, ability labels and no-option/disabled strings;
  - cleaned static `index.html` fallback text so initial load does not show deployment/cache/host internals.
- `DASH: VOID STEP` reworked into `DASH: VOID RIFT`:
  - the entire dash path is now the damage zone;
  - enemies along the full dash segment take direct void damage;
  - stacks increase rift width and damage;
  - added a minimal purple/dirty-white dash-rift line VFX along the full path.
- Portal open VFX:
  - removed round ring burst on portal open;
  - replaced it with square, dashed portal-open pulse in the game’s terminal/casino square style.
