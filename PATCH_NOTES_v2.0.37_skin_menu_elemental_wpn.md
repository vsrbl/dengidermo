# v2.0.39 — skin menu alignment + elemental WPN upgrades

## Skin selector

- Fixed the skin selector layout so it matches the width of the rest of the main menu.
- The selector now uses a stable full-width box with fixed height.
- Switching skins no longer shifts the menu horizontally or vertically.
- Skin name is one fixed line.
- Skin rarity/status is one fixed line.
- Locked skins still show their real name, rarity, visible preset, and `LOCKED` status.

## New WPN chest upgrades

Added a new elemental bullet layer to WPN chest rewards:

- `FIRE BULLETS`
  - Player bullets apply `BURN`.
  - Burn deals short damage-over-time.
  - Fire hitting frozen enemies triggers `THERMAL CRACK` bonus damage and breaks part of the freeze.

- `FREEZE BULLETS`
  - Player bullets apply chill and can briefly `FROZEN` lock enemies.
  - This is control, not direct damage.

- `POISON BULLETS`
  - Player bullets apply `POISON`.
  - Poison deals longer damage-over-time.

- `DRONE ELEMENT LINK`
  - Drones inherit fire/freeze/poison bullet effects.
  - Without this upgrade, elemental effects stay on primary weapon/projectile fire.

- `ELEMENT AMP +25%`
  - Stronger/longer fire, freeze and poison bullet effects.

- `STATUS SPREAD`
  - Statused enemies spread part of their burn/freeze/poison state on death.

## Elemental synergies

- `FIRE + POISON` → `VOLATILE MIX`
  - Periodic extra square damage tick.

- `FIRE + FREEZE` → `THERMAL CRACK`
  - Fire shots crack frozen enemies for bonus damage and reduce their freeze time.

- `FREEZE + POISON` → `SLOW ROT`
  - Poisoned enemies stay slowed/chilled longer.

- `STATUS SPREAD`
  - A WPN upgrade that lets elemental kills infect nearby enemies.

## Visuals

- Elemental bullets get readable overlays:
  - red square rim for fire;
  - cyan dashed lock for freeze;
  - green toxic rails for poison.
- Enemies show `BURN`, `POISON`, or `VOLATILE` labels and simple square status frames.
- WPN chest options show compact tags for elemental rewards.

## Checks

```txt
node --check server/index.js
node --check shared/*.js
node --check src/*.js
sim import ok
local import ok
element upgrades smoke ok
```
