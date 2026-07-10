# v2.1.175 — Enemy navigation and Controller capture rework

## Navigation
- Added size-aware grid pathfinding for enemies and controlled processes.
- Narrow passages are used only by bodies that physically fit.
- Large bodies choose wider available routes.
- Unreachable targets lead to the nearest reachable position instead of wall jitter.
- Path grids are cached by room and body size to limit runtime cost.
- Separation and knockback no longer push controlled processes through walls.

## Process Controller
- Capture failures now report the exact gate: shell, range, blocked signal, protection, unstable spawn, missing assimilation tier, or full slots.
- Elite processes become capturable through Assimilation and preserve elite state.
- Captured processes preserve source speed, damage, armor, preferred range, projectile speed, attack cadence, charge, blink, healing, field, pull, summon, and damping properties where applicable.
- Special ranged process logic now takes priority over the generic ranged fallback.
- Failed command capture consumes no cooldown.
- Processes clear vanished focus targets and resume autonomous attacks.
- Capture and disappearance events always include the process name.

## SAW
- Captures every currently available target in its area until process slots are full.
- Protected or unavailable targets are ignored and do not cancel valid captures.
- Zero captures consume no cooldown.

## Quarantine Anchor
- Removed the total target cap.
- Acquisition upgrades add +2, then +3, then +4 new links per scan.
- Duration and discharge upgrades now scale more strongly.
- Anchor separation remains wall-safe.
