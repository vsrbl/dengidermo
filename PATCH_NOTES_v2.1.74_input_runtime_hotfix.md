# v2.1.74 — Input Runtime Hotfix

- Fixed a runtime input crash introduced with the new R-active system.
- Added the missing `takeRActive()` input consumer used by the main game loop.
- Stopped `Q` active input consumption from clearing the pending `R` input edge.
- Movement, fire, dash, interact, Q and R controls should now keep working after the boss reward/R-active update.

Checks:
- `node --check` for main input/game files.
- Module imports for input/main protocol-adjacent files.
- Archive integrity with `unzip -t`.
