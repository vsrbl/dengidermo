# v2.1.173 — BET Terminal rework

## Core result rules

- Every useful reel now pays on its own; a roll no longer needs an exact triple to matter.
- Two matching useful reels form a pair and pause the terminal for a decision:
  - take the pair reward;
  - or pay 40% of the original stake to reroll only the third reel.
- Three matching reels grant the strongest form of that symbol.
- Three different useful symbols grant a small mixed payout.
- The WPN + ABL + RAR trio opens a direct choice between a weapon, protocol, or rare prize.
- BAD affects only its own reel. A complete no-reward result loses the stake and resets HEAT.

## Stake identities

- LOW favors GLD, EXP, and HEA with the lowest static-debt risk.
- MID favors build growth: WPN, ABL, RAR, and LOCK.
- HIGH always exposes at least one useful symbol and has the strongest premium-symbol odds.
- A successful LOW or MID payout adds 1 HEAT.
- A successful HIGH payout adds 2 HEAT.

## HEAT and EDGE

- HEAT increases only after a successful payout.
- A no-reward or penalty-only result resets HEAT to zero.
- A successful payout while already at HEAT 3 pays first, then overloads the terminal and releases the slot threat.
- EDGE rises after no-reward results:
  - EDGE 2 guarantees a useful reel;
  - EDGE 4 guarantees a pair.
- Both meters are visible in the terminal.

## Manual LOCK

- LOCK now grants a manual lock charge instead of transforming itself into a random prize.
- After a resolved roll, click a useful reel to hold it.
- Up to two reels can be held at once.
- Held reels persist between bets and clear when leaving the terminal.

## Symbol rewards

- GLD: partial return, profitable pair, large triple payout.
- EXP: experience; a triple also queues an INSTALL choice.
- HEA: healing; a pair fully heals; a triple also grants a short guard pulse.
- WPN: one reel boosts weapon power; a pair opens a weapon choice; a triple adds a stronger boost.
- ABL: one reel reduces active recovery; a pair opens a protocol choice; a triple gives the stronger recovery result.
- RAR: one reel advances RAR signal; a pair opens a rare choice; a triple opens an enhanced rare choice.
- SKN: one reel advances SKN signal; a pair grants a locked skin; a triple offers up to three locked skins to choose from.
- JCK: GLD and EXP multiplier payout, scaling strongly with pairs and triples.
- STC: adds static debt and grants no payout by itself.
- BAD: empty reel.

## Interface and localization

- Added visible HEAT, EDGE, and LOCK counters.
- Added pair TAKE/REROLL controls.
- Added in-terminal prize and skin selection controls.
- Rewrote LOW/MID/HIGH descriptions around their actual reward profiles.
- Updated RU and EN terminal help, controls, outcomes, and reward readouts.

## Validation

- All JavaScript files pass `node --check`.
- Monte Carlo checks cover LOW, MID, and HIGH reward, pair, triple, and premium-symbol rates.
- Simulation tests cover pair take/reroll, WPN/ABL/RAR choices, mixed premium choice, manual locks, full healing, forced INSTALL, SKN choice, HEAT growth/reset, HIGH double heat, and overload removal.
- `index.html` and `404.html` contain no duplicate IDs.
