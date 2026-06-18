# Terminal Casino Roguelike 2.1 — Orbital / Economy / Static Hotfix

## Economy
- Casino BET price scaling is now 1.75x slower across depth/loops.
- Chest price scaling is now 1.25x slower across depth/loops.
- Chill-room chest prices remain intentionally low and do not inherit late-loop spikes.

## Gold Fever / Blood Payment text
- Gold Fever copy now clearly says the room is about GLD: enemies/chests pay more gold, and mistakes cost gold instead of HP.
- Blood Payment copy now says HP buys can be lethal and Death Insurance can save lethal payments.

## Orbitals
- ORBITAL +1 is stronger: orbitals now lean toward and attack nearby enemies instead of only rotating passively.
- ORBITALS REFLECT now makes orbitals lean toward nearby enemy bullets and erase them in a small radius.
- Added ORBITAL SEEK +20% upgrade.
- Added ORBITAL RANGE +35% upgrade.
- Orbital behavior remains deliberately short-range and not over-fast at base level.

## Rocketgun
- Rocketgun base damage doubled.
- Cluster blasts, mines, remote detonation and all rocket upgrade explosions inherit the doubled rocket damage.

## Contract Favor
- Fixed DOUBLE NEXT PRIZE so it doubles the next room contract payout instead of rolling itself into the doubled prize.
- When DOUBLE NEXT PRIZE is active, the doubled payout cannot be DOUBLE NEXT PRIZE again.

## Static Storm
- Fixed storm carry self-stacking: next-room carry is now based on actual player hits, not every warning/strike event.
- Pending storm strikes are cleared when rooms reset/open portal so old strikes cannot leak into the next room.
- Storm warning radius/damage scaling is now flattened at high levels so storm zones cannot become screen-sized.
- Static source label changed from “previous strikes” / “удары прошлой комнаты” to “storm carry” / “остаточный шторм”.
