# PATCH v2.0.83 — MODIFIER RULE OVERHAUL

## Summary
Full rule rewrite for the room modifier set. This patch removes modifiers that no longer match the game direction, replaces MIRROR ROOM with moving spiked walls, and gives GREED / HUNTER / CASINO / PRISM / BLOOD / ECHO concrete gameplay identities.

## Removed modifiers
- Removed `DEBT FLOOR` from generation and debug room lab.
- Removed `SHELL MARKET` from generation and debug room lab.
- Removed `HUNTED EXIT` from generation and debug room lab.
- Legacy saves/debug overrides normalize removed modifiers away.
- Legacy `mirror_room` debug value is normalized into `moving_room`.

## GREED SIGNAL rewrite
- GREED rooms are now gold-only rooms.
- Chests in GREED rooms pay individual GLD instead of opening normal reward menus or mixed loot.
- Casino in GREED rooms pays only GLD.
- Damage in GREED rooms does not reduce HP.
- Damage spends the hit player's personal GLD instead.
- Personal GLD can go below zero, creating a debt balance to recover in later rooms.
- Mob GLD/EXP pickups still use the existing shared team pickup rule.
- Chest/casino GREED payouts are individual to the player who opens/spins.
- SKN CACHE is suppressed in GREED rooms so the rule remains “gold only”.

## HUNTER CONTRACT → HUNTER WAVES
- Renamed identity to `HUNTER WAVES`.
- The modifier is forced to a big/wide room layout.
- Normal director spawning is disabled in this modifier; wave logic owns the room.
- Room starts locked with at least 2 waves.
- Higher run depth adds more waves.
- First wave is intentionally weak.
- Each following wave is harder and can include stronger enemies.
- A wave is complete only when all enemies in that wave are dead.
- Portal opens only after every wave is cleared.

## CASINO VIRUS rewrite
- Casino Virus now has its own independent virus slot, not the normal casino/BET slot.
- Virus slot spins every 30 seconds.
- UI/fx uses `CASINO VIRUS` and `SPINS LEFT` language so it does not conflict with normal casino menus/rolls.
- The room requires 3 virus spins before it can finish.
- After 3 spins, normal director spawning stops and the player must clear remaining enemies.
- Portal opens only after 3 spins and no enemies remain.
- Virus events include:
  - extra mob pack;
  - static rain burst;
  - big static rain burst;
  - elite pack;
  - mini-boss / herald signal;
  - GLD jackpot event.

## MIRROR ROOM replaced
- `MIRROR ROOM` is replaced by `SHIFTING WALLS` / `moving_room`.
- Moving spiked rectangular walls are generated in the room.
- Walls move on simple bounded tracks.
- Players and enemies are pushed out of the wall rectangles to avoid trapping bugs.
- Spikes damage players on contact with cooldown.
- Walls can also damage enemies caught against them.
- Snapshot/render now exposes moving wall rectangles and draws them as red square spike blocks.

## PRISM GRID rewrite
- `PRISM GRID` is now `PRISM SLOW GRID`.
- It no longer fires damaging lanes.
- It creates rectangular slow-grid plates.
- Players and enemies standing on the grid are slowed to roughly 1/3 speed.
- Snapshot/render exposes prism slow zones and draws cyan slow-grid rectangles.

## BLOOD TAX rewrite
- Blood Tax no longer creates death-floor/blood damage zones from enemy deaths.
- Any action that normally costs GLD now costs HP instead:
  - chests;
  - casino/BET stakes.
- Blood purchases cannot kill the player; the player must have more HP than the HP cost.
- Blood purchases count toward room stats/tape.

## ECHO WALLS rewrite
- Echo Walls now gives all shots a 50% echo chance.
- Player shots use the existing echo-shot visual marker.
- Enemy shots can also echo.
- Echo-proc projectiles keep the ghost-square visual marker so the player can read that a duplicated shot is from ECHO.

## HUD / TAB / debug lab
- Room modifier hints updated for the new rules.
- Debug room lab modifier list now comes from the updated `ROOM_MODS`, so removed modifiers no longer appear.
- `movingWalls`, `prismZones`, `hunterWave`, and `casinoVirus` are included in snapshots for rendering/UI.
- Room objective text updated:
  - `HUNTER WAVES` explains locked waves.
  - `VIRUS CLEAN` explains 3 spins + cleanup.
  - `GRID WALKER` explains slow-grid clear.
  - `BLOOD PAID` explains HP prices.

## Technical notes
- `normalizeRoomModifiers()` strips removed modifiers and maps legacy `mirror_room` to `moving_room`.
- `quotaCanOpenPortal()` now delegates portal opening to Hunter/Casino rules when those modifiers are active.
- `director()` stops normal spawns in Hunter Wave rooms and stops after Casino Virus has completed all three spins.
- Existing portal-open contract settlement behavior from v2.0.71 is preserved.
