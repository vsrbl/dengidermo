# PATCH NOTES v2.1.81 — Casino LOCK / 8BIT / HUD hotfix

Точечный hotfix без внедрения новых концептов.

## HUD / YouTube controls

- In-game YouTube mini controls moved above the top-left HUD block.
- Top-left HUD content now sits below the player controls when they are visible.
- Event history feed moved lower and aligned with the left edge of the language/version block.
- Play/pause mini button now uses text labels `PLAY` / `PAUSE` instead of the crooked pause glyph.
- Clicking the in-game YouTube mini controls no longer starts player shooting.

## 8BIT audio

- 8BIT toggle now applies a real WebAudio bitcrusher route to in-game audio output.
- YouTube iframe audio still cannot be routed through the game WebAudio graph, so the YouTube side keeps a stronger chiptune mask overlay.
- The 8BIT mask layer is louder and more obvious.

## Casino / BET terminal

- Removed the external right-side LOCK badge.
- LOCK is now represented directly inside the slot cells.
- When a LOCK cell drops, it briefly shows `LOCK`, dissolves, then turns into the stored random symbol.
- A stored LOCK symbol is shown as an in-slot fixed cell while the casino panel is open.
- Spins with an active LOCK keep the first cell colored instead of grey spinning noise.
- Active LOCK now always resolves through its stored symbol instead of being a hidden chance.
- Casino denials, losses, static failures, skin/rare/lock results and all prize details are now included in event history.
- Jackpot SFX changed from a short stab to a small victory melody.

## Text cleanup

- Removed the fallback `ROOM ROLL` chest rarity reason.
