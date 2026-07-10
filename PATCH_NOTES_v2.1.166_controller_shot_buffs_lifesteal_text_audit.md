# v2.1.166 — controller_shot_buffs_lifesteal_text_audit

## Process Controller

- Controlled shooter processes now inherit general projectile modules from the owner:
  - echo shots;
  - projectile range;
  - ricochet/bounce;
  - blast proc;
  - projectile chain/seeker fragments where applicable;
  - thermal/cryo/corrosive projectile status;
  - fire-rate scaling.
- Weapon damage and existing CTRL process damage scaling continue to apply to controlled process damage.
- Lifesteal now intentionally works through controlled-process damage because their attacks keep the owner id.
- RMB focus targets and current capture targets are included in the snapshot lock map so the red target frame appears again.

## Weapon chest / naming

- Controller WPN chest can roll general shooting modules again.
- Drone status channel remains a separate upgrade path; drones are tuned independently from controlled processes.
- Renamed old fire/freeze/poison projectile labels into setting-style names:
  - Thermal projectiles;
  - Cryo projectiles;
  - Corrosive projectiles.

## Cursed chest / Static Storm

- Cursed chest now adds one Static Storm debt source instead of two at high tiers.
- This removes the confusing double `Cursed Chest` feel in storm information.

## Text / localization

- Added EN/RU label fallbacks for new projectile and controller shooting modules.
- Added extra runtime HUD/FX label localization for common Russian labels in EN mode.
- Cleaned several player-facing descriptions to avoid technical notes, repetition, and chat-style slang.

## Checks

- JS syntax check passed.
- ESM/browser-stub imports passed.
- Label smoke test passed for EN/RU projectile/controller labels.
- Static simulation markers passed for control echo/status/projectile modules, focus target frame, and single cursed chest debt.
- Server `/health` reports v2.1.166.
