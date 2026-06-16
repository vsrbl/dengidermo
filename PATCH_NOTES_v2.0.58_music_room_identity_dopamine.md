# PATCH NOTES v2.0.63 — music / room identity / dopamine pass

Main goal: make rooms feel like authored micro-scenarios instead of only random waves.

## Adaptive procedural music

- Added WebAudio background music director.
- No external assets: synth/noise layers are generated in browser.
- Music reacts to:
  - combat intensity;
  - enemy count;
  - bullet pressure;
  - low HP;
  - boss rooms;
  - chill/casino rooms;
  - static/prism/anchor/shell/echo room identity.
- Layers include:
  - low drone;
  - sub danger pulse;
  - square bass pulse;
  - noise-hat combat layer;
  - broken casino layer;
  - dirty choir/support layer.

## Room prophecy / next-room preview

- HUD objective block now shows `NEXT` room preview:
  - room size archetype;
  - next modifier labels;
  - reward signal tags;
  - next Static Rain level when relevant.
- This is intentionally player-facing, not debug text.

## After-room invoice

- Clearing / leaving a room now emits `ROOM CHECK`:
  - kills;
  - collected GLD;
  - collected EXP;
  - damage taken;
  - NO HIT / FAST / STATIC PAID flags when earned.
- This is a dopamine receipt after every room, without changing economy rules.

## Room size archetypes

Room generation now chooses a room archetype and applies playable-area walls:

- `PANIC BOX`
- `COMPACT`
- `STANDARD`
- `WIDE FIELD`
- `LONG LANE`
- `CASINO LOUNGE`
- `BOSS FLOOR`

These archetypes influence room feel without rewriting the full map generator.

## New room modifiers

Added five new room rules:

- `PRISM GRID`
  - periodic square lane strikes;
  - synergizes with PRS / PLS / SHT / ANC.
- `BLOOD TAX`
  - enemies drop extra GLD;
  - some deaths leave delayed red tax blasts.
- `SHELL MARKET`
  - more shell/armor pressure;
  - breaking shells can drop GLD shards.
- `ECHO WALLS`
  - rooms bias toward mirror/echo pressure;
  - player echo-shot chance gets the same room boost as mirror rooms.
- `ANCHOR GRAVITY`
  - visible square gravity sockets bend enemies, enemy bullets and pickups.

## Enemy synergy packs

Added modifier-specific encounter packs:

- `PRISM GRID CAGE`
- `BLOOD TAX PANIC`
- `SHELL MARKET WALL`
- `ECHO WALL SCRAMBLE`
- `ANCHOR GRAVITY CAGE`

Each pack follows the core/guard/displacer/tax structure instead of random mob soup.

## UI / readability

- Room banner now includes room size archetype.
- TAB rules line includes room size archetype.
- New modifier names are included in explanation text.

## Checks

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- smoke imports: sim/audio/hud
- room-generation smoke: archetypes and new modifiers appear across generated rooms
- simulation smoke: start room, step sim, build snapshot
