# PATCH NOTES v2.1.99 — RAR / Casino Result / Slot Mob Polish Hotfix

## RAR chest economy

- Valuable/rare `RAR` chest bonus GLD now scales against the actual paid chest cost.
- If a `RAR` chest costs a lot, its attached GLD bonus is guaranteed to be a little higher than the paid GLD cost instead of tiny values like `+45 GLD` on a `700 GLD` chest.
- Free/key/blood-tax edge cases still fall back to the normal loop economy payout.

## BET terminal result text

- The short result line inside the casino terminal now describes the exact thing the player received/lost.
- Removed confusing duplicate words like `ВЫИГРЫШ` under an already-clear result title.
- Removed vague wording like `ПРОТОКОЛ` from the casino result line.
- Weapon results now read like `НОВОЕ ОРУЖИЕ: ...` or `УСИЛЕНИЕ ОРУЖИЯ: ...`.
- Ability results still use `МУТАЦИЯ: ...`.
- The full result is available on hover via the result line tooltip/explain text, so long rewards are readable even when the compact line is ellipsized.

## Slot mob polish

- `SLOT MOB` base HP increased x10 from the previous value.
- `SLOT MOB` speed and fire-rate were roughly doubled.
- Removed constant 5-second mode rerolls from prior versions; mode is chosen only after the internal slot roll.
- Charger form now has a red charge guide line like the original charger.
- The protective visual around slot mob is square/terminal-shaped, not circular.
- Death/rebuild flow was staged:
  - on kill, the slot mob stops acting and cannot be hit;
  - it breaks into four square chunks and fake GLD/EXP/STC/WPN/ABL particles;
  - particles cannot be picked up;
  - particles collapse back into the center;
  - the mob appears with a 3-second protected internal slot spin;
  - when the roll selects a mode, a result sound plays and combat resumes.
- First appearance after casino overload now uses the same assemble/roll presentation after the terminal break effect.

## Version

- Build bumped to `v2.1.99`.
