# PATCH NOTES v2.0.60 — static rain readability / dash radius

- Reworked `STATIC RAIN` into a readable one-room pending debt instead of an unclear cascading chain.
- HUD now shows the current room's `STATIC RAIN LVL X` in the top-right objective block.
- HUD now shows `NEXT STATIC RAIN LVL X` when the next eligible room has pending static debt.
- Static Rain level now follows a simple rule: if a fresh Static Rain room produced 1/2/3 real strikes, the next eligible room gets level 1/2/3, capped at VII.
- Static Rain debt is spent when it creates the next eligible room; strikes in that carried room do not automatically create another chain.
- Static Rain scaling is softer at low levels and only becomes brutal around levels VI–VII.
- Dash upgrade impact radius increased at the base by 3x:
  - `DASH: VOID RIFT` path width base `34 → 102`.
  - `DASH STUN` path radius base `54 → 162`.
  - `DASH CLONE` echo burst radius base `46 → 138`.
