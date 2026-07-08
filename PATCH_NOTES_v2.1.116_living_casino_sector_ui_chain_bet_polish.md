# PATCH NOTES v2.1.116 — Living Casino Sector UI / CHAIN / BET Polish

## Living Casino — sector selection

- RMB now opens/closes the Living Casino sector selection ring.
- While the ring is open, aim direction previews the sector.
- Press RMB again to lock the highlighted sector.
- LMB activates the locked sector.
- The ring now looks like attached UI panels rather than loose orbiting blocks:
  - panel backplates;
  - connector lines from player core to each sector;
  - selected-sector lock label;
  - cooldown seconds directly on the panel.

## CHAIN sector

- CHAIN dash charges are now a separate resource from base dash charges.
- CHAIN charges are always consumed before normal dash charges.
- Normal base dashes no longer become purple because of CHAIN.
- Living Casino's default skin dash color was moved away from purple; purple is reserved for CHAIN dash.
- CHAIN activation now has its own SFX and purple charge glow.
- Each CHAIN dash now has its own thin purple line FX and SFX.
- While CHAIN charges are available, the player core gets a purple frame/readout.

## BET sector

- BET now shows an explicit roll/result above the player instead of only a generic mutation pulse.
- BET displays stake, paid amount, WIN/LOSE, reward type and reward amount.
- BET has a distinct roll SFX.

## Validation

- `node --check` passed for all JS files.
- Smoke-tested:
  - RMB ring open/close;
  - locked sector selection;
  - CHAIN activation grants separate extra dashes;
  - CHAIN dash consumes extra charge before base dash;
  - base dash count remains intact during CHAIN dash;
  - BET emits `lc_bet_roll` result FX.
