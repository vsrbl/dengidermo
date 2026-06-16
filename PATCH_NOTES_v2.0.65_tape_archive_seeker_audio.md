# PATCH NOTES v2.0.65 — tape archive / seeker audio polish

## Focus

This patch adds the next dopamine/progression layer after room dossier and skin pity: a run-level memory log that lives in TAB instead of cluttering combat HUD. It also adjusts SEEKER audio per request.

## SEEKER audio

- `shot_sek` is now pitched higher.
- `shot_sek` volume components are reduced by 50%.
- Kept the dry terminal snap identity.
- Avoided bubble/chirp character.

## Run Memory / Tape Archive

- Added run-level memory tracking:
  - rooms cleared;
  - total kills;
  - total GLD collected through room checks;
  - total EXP collected through room checks;
  - total damage taken;
  - current and best `NO HIT` streak;
  - current and best `FAST` streak;
  - static rooms paid;
  - skin rooms seen;
  - shell breaks and hunted waves.

- Added `TAPE LOG`:
  - stores the latest meaningful room tapes;
  - examples: `NO HIT TAPE`, `FAST CLEAN`, `SHELL MARKET REC`, `WIRE GHOST`, `SKN CACHE RARE`;
  - keeps the latest 10 entries in the run state;
  - snapshot sends the latest entries to the HUD.

## TAB panel

- TAB now has more useful run-level information:
  - current room dossier;
  - next room dossier;
  - run status;
  - run memory;
  - tape log.
- Wide-screen TAB uses a wider 5-card layout.
- Tape/memory explanations are available on hover.
- Combat HUD remains cleaner: the archive lives in TAB rather than adding more popups.

## Technical

- Updated versioned filenames/imports to `v2.0.65`.
- Updated protocol/build/package/index cache query to `v2.0.65`.
