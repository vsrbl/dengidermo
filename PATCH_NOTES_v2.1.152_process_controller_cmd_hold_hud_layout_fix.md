# v2.1.152 — process_controller_cmd_hold_hud_layout_fix

## Process Controller / CMD hold capture
- CMD no longer captures instantly on click.
- Holding LMB locks the first valid target under the cursor, then fills a capture bar over time.
- The locked target is marked in red and can keep being captured even if the cursor drifts off it, as long as the target remains valid/in range/line of sight.
- Small and damaged threats capture faster; larger/elite threats require longer hold time.
- `CTRL: КОНТРОЛЬ +` now directly speeds up the hold-capture bar and still boosts controlled-process attacks.
- CMD cooldown is slower (`0.42 -> 1.70`) so reload pacing and reload upgrades matter more.

## Visual feedback
- Added capture progress data to the controller HUD snapshot.
- The custom cursor becomes a red capture square with a fill meter while CMD is holding a target.
- Enemy snapshots now include controller lock/progress fields; the renderer draws a red capture outline and mini progress bar around the locked target.

## HUD layout / Process Controller only
- Process chips are always shown for the Process Controller, even when empty, as gray free slots.
- Dash pips are forced above process chips, process chips sit directly above the CTRL command HUD.
- The CTRL command HUD and command slots now share the same panel background and have no visible separating strip between them.
- These layout/style changes are scoped to `body.process-controller-mode`, so other heroes keep their existing HUD layout.

## Checks
- `node --check` on all JS files passed.
- ESM imports for protocol/data/hud/render/sim passed.
- Quick CMD hold smoke test passed: target locks first, capture progress appears, capture completes only after holding.
