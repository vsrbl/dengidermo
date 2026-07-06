# PATCH NOTES v2.1.89 — Contract Prize Display hotfix

## Fixes

- Contract prize HUD no longer shows misleading `+ ещё N` / `+ N more` text.
- Contract reroll prizes no longer look like they add extra reward options.
- Multiple contract prizes now render as separate chips in the HUD:
  - `ПЕРЕБРОС ВЫБОРА · 1 заряд`
  - `ДВА ПЕРЕБРОСА ВЫБОРА · 2 заряда`
  - `СТРАХОВКА ОТ СМЕРТИ · 1 защита`
  - etc.
- Contract prize tooltip now lists every stored prize with its real meaning and compact status.
- The favor HUD can wrap cleanly instead of clipping into a confusing ellipsis.

## Notes

This is UI-only. It does not change contract prize logic, reroll charges, or reward pools.
