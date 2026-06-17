# nncckkrr v2.0.87 — Contract Portal-Open Settlement

## Goal
Contracts must be resolved when the room objective is actually solved: the moment the portal opens.
Entering the portal is only a transition action and must not change contract state.

## Changes
- Added portal-open contract settlement:
  - `openPortal()` now calls `settleRoomObjectiveAtPortalOpen(run)` immediately after `markRoomSolved()`.
  - The contract result is stored in `run.roomObjectiveSettlement`.
  - A frozen room-stat snapshot is stored in `run.roomObjectiveFrozenStats`.
- All contract status UI now uses the frozen settlement after the portal opens.
- After the portal opens, later damage, wire touches, prism hits, shell breaks, hunter waves, waiting time, pickup collection, or portal-enter delay no longer changes contract `DONE/FAILED`.
- Before the portal opens, contracts stay `ACTIVE`; they no longer become final early.
- Portal-enter / transition now only pays an already-settled contract.
- Added separate feedback events:
  - `CONTRACT DONE` at portal open, no payout numbers.
  - `CONTRACT PAID` after transition / ROOM CHECK, with actual payout numbers.
  - `CONTRACT FAILED` at portal open, with the fail reason.
- Updated Hunted Exit contract from an overstay-after-portal objective to a portal-open-safe objective:
  - `HUNTED EXIT` is locked when the hunted portal opens.
  - This avoids a contract whose success would require actions after the portal has already opened.

## Important rule
`contract status = evaluated at portal open`

`contract payout = awarded later in ROOM CHECK / transition`

These are intentionally separate so players understand:
- when the contract was completed or failed;
- when the reward was actually received.

## QA
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- smoke imports: sim / hud / i18n / audio
- regression: open portal with `NO HIT TAPE` done, then mutate post-open damage/wire stats; contract remains `DONE`; transition pays `PAID` using frozen result.
