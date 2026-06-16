# PATCH NOTES v2.0.65 — skin unlock rate / pity

## Skin unlocks are less impossible

- Raised SKN CACHE room chance substantially.
- Added run-local skin pity: non-boss rooms without a skin increase the next SKN CACHE chance; after several misses it becomes heavily favored, then guaranteed.
- Special rooms, reward pockets, greed/casino/mirror/debt/hunted rooms now push SKN CACHE chance higher.
- Casino SKN outcomes are now more visible:
  - LOW: 2.4% base
  - MID: 3.8% base
  - HIGH: 5.5% base
  - LUCK adds more than before.

## Duplicate protection

- If a skin reward rolls a skin already unlocked locally, the client now converts it into a still-locked skin when possible.
- It prefers the same rarity first, then falls back through the remaining locked non-basic skins.
- Only when every non-basic skin is already unlocked does it show `SKN DUPLICATE`.

Goal: skins should feel collectible and open during normal play, while legendary skins remain exciting. Bad RNG should not hide the skin system for a whole run.
