# PATCH NOTES v2.0.66 — room objectives / instant TAB

## Main idea

v2.0.66 adds a small objective layer to rooms so each room has an extra readable mini-goal beyond just clearing quota. Objectives are shown in HUD/TAB and pay a small GLD/EXP bonus plus a Tape Log record when completed.

## TAB UX

- Removed TAB open animation completely.
- Removed the `tabdrop` keyframes from CSS.
- TAB now appears instantly with no slide/fade/drop.

## Room objectives

Each room now receives one objective:

- `NO HIT TAPE` — clear without damage.
- `FAST CLEAN` — clear fast.
- `WIRE GHOST` — clear without touching static wires.
- `GRID GHOST` — clear without prism lane hits.
- `SHELL BREAKER` — break 3 shells.
- `BLOOD PAID` — trigger 3 blood tax drops and survive.
- `STATIC CLEAN` — clear Static Rain with low damage taken.
- `OVERSTAY TAPE` — survive at least one Hunted Exit hunter wave.
- `CACHE CLAIM` — clear and claim SKN CACHE.
- `CLEAN SIGNAL` — simple fallback objective.

## HUD / TAB

- Current room HUD now shows `OBJ` with progress and reward.
- Next room prophecy also shows its upcoming `OBJ`.
- TAB current/next room cards include the objective.
- RUN MEMORY now tracks objective count and objective bonus totals.

## Rewards

- Completed objectives pay small bonus GLD/EXP on room transition.
- Completed objectives write `OBJ <label>` into Tape Log.
- Objective bonus is listed in `ROOM CHECK` invoice.

## Checks

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- smoke import: `sim`, `hud`, `i18n`
- simulation smoke: start room → step → snapshot includes current and next objectives
- `zip -t`
