# v2.1.69 — Chest rarity / slot economy rework

## Chests
- WPN/ABL chests no longer always offer three choices.
- Choice chests now roll a slot count:
  - low/common chests can offer 1–3 slots;
  - rare chests offer 5 slots.
- Chest rarity is baked into the room when it spawns, so price and hover/open behavior stay stable.
- Rarity now appears inside the WPN/ABL chest window.
- The chest window shows rarity, slots, price paid, and the main condition that pushed rarity upward.

## Economy
- Chest price now scales from rarity and slot count.
- Cheap low-slot WPN/ABL chests are cheaper than the old fixed three-choice version.
- Valuable and rare chests cost more because they give more options/better filtering.
- Reward Pocket, Signal Contract, Chill Room, Gold Fever, Casino Virus, Blood Payment, Static Storm, Hunter waves, and later loops can push chest rarity up.

## UX
- WPN/ABL quick-pick hint now matches the actual slot count.
- World hover now includes rarity, slot count, and the main rarity source.
- Reroll keeps the current chest slot count and rarity instead of reverting to a generic three-choice chest.
