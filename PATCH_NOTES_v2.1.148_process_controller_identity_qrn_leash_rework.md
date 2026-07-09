# v2.1.148 — process controller identity + QRN leash rework

Build ID: `process_controller_identity_qrn_leash_rework`

## Controller / appearance identity

- Removed hero-like entries from the appearance preset list.
- Appearance selection no longer changes the active hero/core.
- Heroes are chosen only through the hero/core selector.
- Old appearance values named like heroes now fall back to a normal visual appearance instead of switching the run loadout.

## Process Controller commands

- Process Controller keeps the three command slots: `CMD`, `QRN`, `SAW`.
- Confirmed controller starts with `CMD / QRN / SAW` only when the explicit hero is Process Controller.
- `CMD` is now the strong single-target capture command.
- `SAW` is now a weaker multi-target scan/focus command and also redirects controlled processes toward the scanned targets.
- `QRN` remains a wall-targeted quarantine command, not a normal gun.

## Captured processes

- Captured threats now preserve their original kind and size.
- A big captured threat stays big; a runner stays runner-like; ranged threats continue to fire in an adapted controlled form.
- Controlled processes now target infected/corrupted threats instead of the player.
- Controlled processes keep spacing from each other so they do not collapse into one visual clump.
- Controlled-process rendering now uses the original process kind/shape with a control overlay instead of replacing every capture with one generic companion shape.

## QRN quarantine anchor

- QRN no longer behaves like a center-pull field/area.
- QRN now places a small wall marker/root.
- Nearby threats are chained to the marker with electric control links.
- Chained threats can move and fight, but cannot leave their leash distance from the anchor.
- Chained threats keep a spacing gap so they do not merge into a pile.
- QRN visuals now emphasize the marker and control chains instead of a large generic zone.

## New QRN upgrades

- `QRN: ДАЛЬНОСТЬ +` — larger chain acquisition range.
- `QRN: УДЕРЖАНИЕ +` — longer anchor duration.
- `QRN: ЦЕПЬ +1` — one more threat can be chained by one anchor.
- `QRN: РАЗРЯД +` — chained threats take periodic damage.
- `QRN: ЗАЗОР +` — more spacing between chained threats.

## Checks

- JavaScript syntax check passed for all source files.
- Data/protocol imports passed.
- Process Controller startup and command-slot tests passed.
- QRN wall-anchor leash test passed.
