# PATCH NOTES — v2.1.9_modifier_spawn_gates_hunter_hud

## Summary

This patch makes all modifier/event-driven enemy spawns respect the current loop/difficulty tier, and adds clear Hunter Waves progress to the HUD.

The main player-facing problem was that special room modifiers could sometimes inject late-loop enemies too early. Normal director packs were already mostly gated by `spawnPool()` and pack `minLoop`, but forced events such as `HUNTER WAVES`, `CASINO VIRUS`, and Herald summon lines had their own hardcoded pools. Those hardcoded pools could bypass the room difficulty curve.

## Changed files

- `shared/sim.v2-1.js`
- `src/hud.v2-1.js`
- `shared/protocol.v2-1.js`
- `package.json`
- `index.html`

## Version

- Game version: `v2.1.9`
- Build ID: `modifier-spawn-gates-hunter-hud`
- Protocol: unchanged (`2`)

---

## Modifier enemy spawn gates

Added a new internal modifier/event spawn gate system:

```js
const MODIFIER_ENEMY_MIN_LOOP = {
  grunt: 0,
  runner: 0,
  shooter: 0,
  charger: 0,
  bomber: 1,
  bouncer: 1,
  splitter: 1,
  tank: 2,
  glitch: 2,
  anchor: 2,
  leech: 2,
  pulse: 2,
  damper: 2,
  warden: 2,
  echo: 3,
  orbiter: 3,
  prism: 3,
  herald: 3
};
```

New helper functions:

- `modifierLoop(run)`
- `enemyAllowedForModifier(run, kind)`
- `filterModifierEnemyPool(run, requested, fallback)`
- `modifierEnemyKind(run, requested, fallback)`

These are stricter than normal director selection because modifier/event spawns can stack on top of room rules.

## Why

The first loop should teach the room and modifier, not surprise the player with late-loop bodies. Forced events should create pressure appropriate to the loop:

- Loop 0: readable, mostly basic bodies.
- Loop 1: adds mid-tier chaos bodies.
- Loop 2: adds heavier support/control enemies.
- Loop 3+: allows late-loop elites and Herald-style pressure.

---

## Hunter Waves tuning

`HUNTER WAVES` now filters each wave pool through the modifier gate.

Before, later hunter waves could include enemies such as:

```txt
runner / shooter / charger / bouncer / glitch / tank / herald
```

Now those kinds are allowed only when the current loop supports them.

Examples:

- Loop 0 hunter waves stay mostly `grunt / runner / shooter / charger`.
- Loop 1 can add `bomber / bouncer / splitter` if requested.
- Loop 2 can add heavier support/control enemies.
- Loop 3+ can add late pressure like `herald`.

Also changed early hunter armor/elite behavior:

- Loop 0 hunter spawns are forced non-elite and no-armor.
- Elite chance begins only after loop 0.

## Hunter Waves HUD

Added a top-right HUD line for Hunter Waves rooms.

Examples:

```txt
HUNTER WAVES · 0/3 · START 2s
HUNTER WAVES · WAVE 2/4 · 2 LEFT
HUNTER WAVES · CLEARED
```

RU:

```txt
ВОЛНЫ ОХОТНИКОВ · 0/3 · СТАРТ 2с
ВОЛНЫ ОХОТНИКОВ · ВОЛНА 2/4 · ОСТАЛОСЬ 2
ВОЛНЫ ОХОТНИКОВ · ЗАЧИЩЕНО
```

The line uses the existing room modifier explanation tooltip and does not add world-space labels over enemies.

---

## Casino Virus tuning

`CASINO VIRUS` event outcomes now scale by loop.

### Loop 0

- No mini-boss Herald event.
- No `BIG STATIC STORM`.
- Elite pack is downgraded to a small guard pack with filtered enemies.
- Static outcome uses lower stacks.

### Loop 1

- Still no Herald mini-boss.
- Event pools remain filtered.
- Elite packs are smaller and only use loop-valid enemies.

### Loop 2+

- Bigger static storms can appear, but stacks scale with loop.
- Elite packs use filtered pools and grow gradually.

### Loop 3+

- Herald mini-boss event can appear.

## Herald summons

Herald summon pools now pass through the same modifier/event gate.

This prevents a Herald-related event from spawning late-loop enemies in an early-loop context if the Herald appears through a special case in future content.

---

## What was not changed

- Normal director encounter pack definitions were not rewritten.
- Existing removed/stale room modifier descriptions were not cleaned up, per user request.
- No enemy world-space debug labels were added.
- No changes to player damage, weapon damage, or room economy.
- No changes to boss music/orbital flow from v2.1.8 except versioning.

## QA checklist

Passed locally:

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- import `shared/sim.v2-1.js`
- import `src/i18n.v2-1.js`
- import `src/hud.v2-1.js`
- import `src/effects.v2-1.js`
- import `src/audio.v2-1.js`
- `unzip -t terminal_casino_roguelike_2.1.9_modifier_spawn_gates_hunter_hud.zip`

Recommended gameplay smoke tests:

1. Start loop 0 Hunter Waves room via dev override or RNG and confirm no Herald/Warden/Damper/Prism spawns.
2. Confirm Hunter Waves HUD shows current wave and waves left.
3. Confirm Casino Virus loop 0 does not roll Herald mini-boss or big static storm.
4. Confirm loop 2+ Casino Virus can still spawn stronger packs, but only loop-valid enemies.
5. Confirm loop 3+ can still produce late threat events.
6. Confirm normal director rooms still spawn usual encounter packs.
