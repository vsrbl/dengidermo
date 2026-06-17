# v2.0.88 — Contract Favors Next-Room

## Main goal
Replace contract GLD/EXP payouts with short-lived contract favors that apply only to the next room.

## Contract reward model
- Removed direct contract GLD/EXP objective payouts.
- Removed contract-chain GLD/EXP payouts.
- Completing a contract now grants one or two Contract Favors for the next room only.
- Favors move through the lifecycle:
  - `pending` after contract payout;
  - `active` when the next room starts;
  - expired when that room ends.
- Unused favors do not persist for the whole run.

## Favor pool
Kept:
- `FREE REROLL` — one WPN/ABL chest reroll next room.
- `CLEAR 1 DEBT` — removes one Static Rain debt stack before the next room starts.
- `SKIN SIGNAL` — boosts hidden skin chance in the next room.
- `PORTAL INSURANCE` — one lethal hit next room restores the player to 50 HP instead of downing them.
- `EPIC REROLL` — two WPN/ABL chest rerolls next room.
- `DOUBLE FAVOR` — if the next room contract succeeds, it grants two favors; no downside.

Removed/avoided:
- `NEXT CHEST -50%`.
- `SAFE ROOM INTEL`.
- `ONE ROOM IMMUNITY`.
- `BLACK REROLL` name and downside.
- Negative side of `DOUBLE`.

## UI
- Contract card now says `NEXT ROOM FAVOR` instead of GLD/EXP style rewards.
- Contract payout banner now says `FAVOR EARNED` / `УСЛУГА ПОЛУЧЕНА`.
- TAB shows active and pending favors.
- WPN/ABL choice modals show a gold Contract Favor reroll button when a reroll favor is active.

## Checks
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- imports: sim, hud, i18n, local
- smoke: clear debt lowers next-room Static Rain, Epic Reroll has 2 uses and decrements on WPN reroll.
