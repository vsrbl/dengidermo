# PATCH NOTES v2.0.79 — contract status / reward clarity

## Player-facing contract clarity

Contracts now have explicit states so the player can understand the room goal without guessing:

- `ACTIVE` — contract is still in progress.
- `DONE` — the condition has been satisfied, but payout is not granted until room transition / ROOM CHECK.
- `FAILED` — contract condition is broken, with a short fail reason such as `DAMAGE TAKEN`, `TIME LOST`, `WIRE TOUCHED`, `LANE HIT`, etc.
- `PAID` — shown only in ROOM CHECK after the bonus has actually been granted.

## Reward display rule

Contract reward amounts are no longer shown as if they were already obtained.

- Current room HUD and NEXT preview show contract name, status and progress only.
- Exact `+GLD/+EXP/+SKN` payout appears only in `ROOM CHECK` after it has been applied to players.
- Failed contracts are explicitly shown in ROOM CHECK as `CONTRACT FAILED ...`, with no payout.
- Paid contracts are shown as `CONTRACT PAID ... +XG +YXP`.

## UI / tooltip cleanup

- Contract tooltip now explains status, progress and payout timing.
- Contract chain explanation clarifies that the chain grows only after actual payout and resets on failed contract.
- Generic old hunter-contract text like “rare upgrade installed” was replaced with neutral payout text.
