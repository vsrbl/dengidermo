# v2.0.94 — UI/audio/combat polish

- Rewrote room modifier explanations into player-facing language instead of internal technical notes.
- Moved the contract prize plaque to the top-left HUD under the version/room line and tightened top HUD layout.
- Fixed contract prize filtering: double next prize no longer appears when the next room has no contract target.
- Fixed local chest reroll display so uses decrement immediately and do not visually repeat x2 after spending.
- Added echo-shot SFX and clearer echo-shot visuals; enemy echo seeker/rocket shots are red and distinct from player echoes.
- Made enemy shield regeneration glow brighter than the full shield state.
- Reduced DMP escort jitter further by keeping guard orbit state stable and making DMP hold position during protected nest behavior.
- Reworked Herald cast lines into slower broken/jagged paths; Herald holds position while casting and paths reroute instead of being canceled by dash movement.
- Improved red shifting zone hit visuals to show the whole zone pulse instead of a center-only blast.
- Chill rooms now use normal run price scaling rather than extra chill-room premiums.
- Skin duplicate/all-owned case now opens an upgrade-window card explaining that all skins are already unlocked.
- Menu audio sliders are square terminal-style controls with accurate fill.
- Menu button clicks now play UI sounds.
- Music tonal center is locked to the bass root to reduce dissonance; variation now comes from motif, rhythm, density, filters, danger, enemy count, and damage pressure.
