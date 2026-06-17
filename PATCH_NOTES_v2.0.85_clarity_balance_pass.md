# PATCH NOTES v2.0.90 — clarity balance pass

## Q active descriptions

- Rewrote every Q core description for player clarity.
- FIELD SNAP now clearly says it pulls enemies/pickups, deals medium snap damage, then leaves weak control damage.
- Q descriptions now include damage feel: none / low / medium / high where useful.
- Removed CORE/MUTATIONS/LINK POINTS/CHARGES dev-style labels from the Russian active tooltip; it now uses player-facing wording.
- Cleaned Q mutation wording in RU/EN so it explains gameplay only.

## Anchor Gravity room

- Anchor Gravity room pull is now much stronger.
- Players inside a gravity socket are pulled hard toward the center and slowed heavily near the core.
- Player and enemy bullets bend toward gravity wells.
- Bullets that pass too close are swallowed by the field.

## Room dossier hover fix

- Fixed top-right hover explanations sticking to old rows like GOAL/ЦЕЛЬ.
- HUD now refreshes tooltip text from the element under the cursor each mouse move, even though the room dossier is rebuilt every frame.

## Blood Tax casino and chest clarity

- Blood Tax chest costs now display the real HP cost in object snapshots and prompts.
- Blood Tax casino results now show `-HP`, not `-GLD`.
- Blood Tax casino HP costs are compressed and capped for playability:
  - LOW/MID/HIGH are playable around normal HP pools;
  - high stake is capped around 100 HP even in later loops.

## Hidden skin text clarity

- Reworded confusing `SKN CACHE` player-facing text.
- Room/banner/feed wording now uses clearer text like `HIDDEN SKIN` / `СКРЫТЫЙ СКИН` and `SKIN READY` / `СКИН МОЖНО ЗАБРАТЬ`.
- Internal `skin_cache` id remains unchanged for compatibility.

## Shifting Walls enemy behavior

- Enemies now avoid moving spiked walls from farther away.
- Wall danger is weighted much higher in enemy steering.
- Spiked walls no longer delete mobs too easily: enemy wall damage is now occasional chip damage, with cooldown and push-away.

## QA

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- Smoke imports: sim, hud, i18n, render, effects, audio
- Smoke: FIELD SNAP description mentions medium damage
- Smoke: Blood Tax casino high stake is HP and capped below 100
- Smoke: Blood Tax casino result includes hpStake
- Smoke: Anchor Gravity pulls player strongly and bends/swallows bullets
