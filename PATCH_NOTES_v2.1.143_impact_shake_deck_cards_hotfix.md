# Patch v2.1.143 — impact_shake_deck_cards_hotfix

## Impact / vibration pass

- Added stronger camera vibration when the player's projectiles ricochet from walls.
- Added wall-impact vibration for player shots that die on a wall.
- Added Roulette wall-split vibration so RLT wall breaks feel heavier.
- Added big-damage vibration when the player's hit deals a high damage number.
- Added combo-tier vibration when the combo reaches relatively high multipliers.

## CRD / Deck balance

- Base Deck projectile length was reduced by half:
  - `life: 0.82 → 0.41`
  - `maxDist: 610 → 305`
- Base Deck card count was reduced:
  - `pellets: 3 → 2`
- Added a new WPN upgrade:
  - `CRD: КАРТЫ +1` — Deck fires one more card in each fan.

## Technical notes

- Damage hit FX now carry the owning player id so client-side vibration only triggers for the player's own big hits.
- Wall impact and ricochet FX now carry the owning player id for local impact feedback.
