# v2.1.159 — process_controller_dash_order_cleanup

## Fixes
- Process Controller command slots no longer show numeric key prefixes in the bottom-right command HUD; CMD/QRN/SAW are shown as clean command labels.
- Removed the `QRN: ЗАЗОР +` upgrade from the command chest and runtime stat pool. QRN keeps a fixed internal spacing guard without exposing a confusing upgrade.
- Controlled shooter processes now fire one projectile per attack instead of an unintended double shot.
- Controlled-process fire/hit SFX are raised to a more audible level while still using the subordinate-process sound profile instead of the hero weapon shot.

## Dash upgrades
- Added `DASH LENGTH +18%` as a normal INSTALL upgrade.
- Added `DASH LENGTH +18%` to ABL side-upgrades.
- Server-authoritative dash distance now scales with the new stat and is included in player snapshots so client prediction uses the same dash length.

## Process Controller RMB orders
- RMB now checks the cursor command zone for an enemy.
- If an enemy is under the cursor, all currently controlled processes receive a fixed focus target.
- Focused processes keep attacking that target until it dies or the player issues another RMB order.
- Processes captured after the order do not inherit that old focus target.
- If no enemy is under the cursor, RMB remains a position/area order and clears focus for the currently controlled processes.

## Verification
- `node --check` on all JavaScript files.
- ESM import smoke for protocol/data/sim/hud/render/state/audio/main(browser-stub).
- Custom sim smoke: `DASH LENGTH +18%` increases server dash distance.
- Custom sim smoke: Process Controller command chest no longer offers `qrn_gap`.
- Custom sim smoke: RMB focus applies only to existing controlled processes; later captures do not inherit it.
- Custom sim smoke: controlled shooter produces one `ctrl_shot` bullet per attack.
- Server `/health` reports `v2.1.159 / process_controller_dash_order_cleanup`.
- Archive test: `unzip -t`.
