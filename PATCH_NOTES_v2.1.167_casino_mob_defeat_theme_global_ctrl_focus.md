# v2.1.167 — casino_mob_defeat_theme_global_ctrl_focus

## Audio
- Added a short 5-second internal-score stinger for the final defeat of the Slot Overload casino mob.
- The event is triggered by the authoritative `casino_mob_defeated` fx and layers a low broken-slot resolve over the existing victory SFX.

## Process Controller
- Fixed fixed-target orders so they are now standing commands.
- If a controlled-process target is set with RMB, processes captured after that command immediately inherit the same target.
- The standing target clears when the target dies or when the player gives another command.

## Technical
- Final Slot Overload death now emits a dedicated `casino_mob_defeated` fx.
- Audio bus schedules a five-second casino-mob stinger and holds a brief resolve layer while it plays.
- New controlled processes inherit `focusTargetId`, `focusTargetLabel`, and command coordinates when the controller has a live ordered target.
