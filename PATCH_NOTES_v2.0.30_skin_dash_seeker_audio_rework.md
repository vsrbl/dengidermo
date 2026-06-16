# nncckkrr.space v2.0.41_skin_dash_seeker_audio_rework

Focus: unlocked skins were too jittery/laggy on the player body. Skin personality now lives in dash effects and legendary dash audio, while the player silhouette stays stable/readable.

## Skin fixes

- Removed animated rarity pulsing/jitter from in-game player bodies.
- Removed animated skin preview core movement in the menu.
- Kept authored static markings so presets still read differently without noisy motion.
- Locked skin display stays hidden/minimal.

## Dash now carries skin personality

Every skin now has dash metadata:

- `dash` color
- `dashAlt` secondary color
- `dashStyle`
- optional `legendarySfx`

Dash FX now uses the selected skin id from the authoritative sim event:

- basic skins get clean colored dash cuts;
- uncommon/rare skins get extra broken square packets;
- superrare skins get heavier signal trails;
- legendary skins get stronger visual treatment and separate audio.

Legendary dash SFX:

- `JACKPOT WOUND` → slot-machine bite / red cut sound.
- `DEAD CHANNEL` → dead-TV sync-loss dash sound.

Legendary skin unlock also has a stronger unlock sound/visual sweep.

## Seeker rework

- Replaced the old bubbly/organic `SEK` shot sound with dry stepped digital square chirps.
- Updated the seeker projectile from a simple soft square into a harder digital packet:
  - rectangular packet body;
  - inner white data cell;
  - segmented cyan trail;
  - small packet blocks behind it.

## Technical

- Version bumped to `v2.0.41`.
- Versioned module filenames changed from `v2-0-29` to `v2-0-41`.
- `dash` FX packets now include skin id, rarity, dash colors/style, and optional legendary SFX id.
- No bullet skin system was added; only seeker itself was visually/audio tuned.
