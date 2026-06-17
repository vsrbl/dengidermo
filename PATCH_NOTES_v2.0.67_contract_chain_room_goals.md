# PATCH NOTES v2.0.83 — contract chain / room goals

## Room contracts

- Room objectives are now treated as `CONTRACT` in player-facing HUD/TAB language.
- Completing contracts in consecutive rooms builds a `CONTRACT CHAIN`.
- Failing a contract resets the chain.
- Chain starts paying extra GLD/EXP from x2 onward.
- Higher chains create Tape Log entries such as `CONTRACT CHAIN x3`.

## TAB / Run Memory

- TAB Run Memory now shows:
  - current contract chain;
  - best contract chain;
  - total contract payout;
  - completed/seen contract count.
- Current and next room cards show `CONTRACT` instead of generic `OBJ`.
- Contract tooltip explains progress, reward, and chain behavior.

## Room invoice

- `ROOM CHECK` now shows:
  - completed contract bonus;
  - contract chain bonus;
  - chain multiplier line when the chain is at least x2.

## Fixes / cleanup

- Run Memory total GLD/EXP now includes objective and contract-chain payouts, not only pickup/streak bonuses.
- Contract chain resets correctly on run reset.
