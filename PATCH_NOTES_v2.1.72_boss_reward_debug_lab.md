# v2.1.72 — Boss Reward Debug Lab

Developer/debug mode now exposes the new boss reward systems for fast testing.

## DEV panel
- Added BOSS REWARD selector for every new boss reward.
- Added GIVE REWARD to apply the selected reward immediately.
- Added OFFER SELECTED to force a two-card boss reward offer containing the selected reward.
- Added R selector and SET R ACTIVE for direct R-active testing.
- Added R READY to reset R cooldown and restore KILL SWITCH charge for testing.
- Added quick buttons:
  - AEGIS +45
  - SPAWN HOLD +1
  - MIRROR +1
  - REVIVE +1
  - BOSS KEY +1
  - ROOM WAGER
  - WAGER OFFER
  - RESET KILL FLAG

## Testing notes
- KILL SWITCH still follows run rules in normal play: once selected, it will not appear again in that run.
- RESET KILL FLAG exists only in DEV mode to retest that flow.
- WAGER OFFER forces an INSTALL-phase wager card for immediate UI testing.
- AEGIS dev grant refreshes the player shell shield immediately.
