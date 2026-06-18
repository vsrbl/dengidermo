# PATCH NOTES v2.1.19 — new bosses + Q Revisor

## Goal
Add new boss-room variety without tying boss mechanics to the combo system.

## Added bosses

### CROUPIER / Крупье Сбоя
- New casino-style boss for boss rooms.
- Places delayed floor stakes near the player.
- Some stakes become damage zones; later casts can bring small add packs.
- Uses aimed shots between stake patterns.
- No combo synergy or combo-specific reward hooks.

### ANCHOR+ / Якорный Кассир
- New anchor-style boss.
- Creates a strong pull field around itself.
- Pulls and slows the player inside the field.
- Bends enemy bullets while its field is active.
- Uses gravity burst zones and radial shots.
- No combo synergy.

### HNT / Хор Охотников
- New hunter-style boss.
- Alternates between aimed shot fans, line traps, and hunter reinforcements.
- Reinforcements use existing enemies and loop gating.
- No combo synergy.

### QREV / Q-ревизор
- New boss that can spawn with one adapted player Q active ability.
- It randomly chooses from the current Q cores:
  - BLOOD RING
  - FIELD SNAP
  - BULLET FREEZE
  - SHELL RIPPER
  - VOID CUT
  - SIGNAL SPIKE
  - BLACK BOX
  - STATIC PULSE
- Each Q is adapted for boss use so it stays readable and does not rely on player-only code.

## Boss rotation
- Boss rooms now rotate through:
  1. CROUPIER
  2. ANCHOR+
  3. HNT
  4. QREV
- The old generic boss behavior remains as a fallback, but the new rotation uses the new bosses.

## Visuals
- Added distinct square silhouettes and labels for the new bosses.
- CROUPIER uses red/gold casino geometry.
- ANCHOR+ uses purple gravity-field geometry.
- HNT uses three-mask hunter geometry.
- QREV uses cyan/purple Q-core geometry.

## Protocol/version
- `VERSION` → `v2.1.19`
- `BUILD_ID` → `new_bosses_q_revisor`
- `PROTOCOL` → `3`
  - This is intentionally bumped because enemy-kind indices changed with the new bosses.
