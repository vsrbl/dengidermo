# v2.0.90 — SEK Swarm Targeting, Debt Engine Audit, Price Scaling

## SEK SWARM RMB
- `SEK SWARM RMB` no longer launches the whole swarm into one direction.
- Swarm bullets now pre-lock onto different nearby enemies where possible.
- If there are fewer enemies than bullets, bullets distribute across the available targets instead of collapsing into a single line.
- Each bullet still has normal SEEKER homing fallback if its target dies.

## DEBT ENGINE / Static Rain audit
- Audited the `DEBT ENGINE` interaction with Static Rain.
- Old behavior could feel like Debt Engine jumped to LVL VII because Debt Engine-forced Static Rain rooms were allowed to seed the next room from the number of actual rain strikes.
- New rule: Debt Engine contributes fixed Static Rain stacks; it does not use strike count to cascade itself upward.
- `DEBT ENGINE` from a cursed chest now stacks correctly with the cursed chest's own Static Debt.
  - Example: cursed chest gives `DEBT ENGINE` and the chest adds `CURSE: STATIC DEBT` → next eligible room gets Static Rain LVL II.
- LVL VII is now only expected when real debt/carry/stacks add up to VII, not from Debt Engine runaway.

## Faster price scaling
- Added a separate faster `loopCostMul()` for costs.
- Chests and BET stakes now scale faster than reward payouts.
- Loop 2 WPN chest is no longer pocket change for a player with ~2k GLD.

## QA
- `node --check` on server/shared/src.
- Smoke: SEK SWARM stack 3 creates 15 seeker bullets distributed over multiple targets.
- Smoke: cursed Static Debt + Debt Engine gives LVL II and does not seed to LVL VII from forced strikes.
- Smoke: loop 2 WPN cost is significantly higher.
