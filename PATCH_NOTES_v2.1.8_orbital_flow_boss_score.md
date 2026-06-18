# PATCH NOTES v2.1.8 — orbital flow + boss score

## Goal

Fix two feel problems reported after v2.1.7:

1. Orbitals looked and behaved like they were magneting into enemies and sitting inside them.
2. Music became too dim after the tonal-lock fixes, especially in boss rooms where the older distinct boss theme feeling was lost.

This patch keeps the v2.1.5/v2.1.6 anti-false-harmony rule, but restores musical presence and a recognizable boss hook.

---

## Changed files

- `shared/sim.v2-1.js`
- `src/render.v2-1.js`
- `src/audio.v2-1.js`
- `shared/protocol.v2-1.js`
- `package.json`
- `index.html`

---

## Orbitals

### Problem

`orbitalPos()` previously calculated a normal circular orbit and then linearly pulled the orbital toward the closest enemy or enemy bullet. Enemy target pull could reach roughly 70%, which made orbitals visually behave like magnetic saws stuck inside targets.

### New behavior

Orbitals now keep their base orbit around the player and use **skimming contact** near targets:

- no hard snap into enemy centers;
- soft repulsion when close to an enemy body;
- tangential slide so contact reads like a fly-by / bounce;
- light orbit wobble so motion is less robotic;
- enemy bullet interception remains possible, but bullet attraction is much softer.

Damage logic remains contact-based and uses the new orbital position. The intent is that orbitals still work mechanically, but visually feel like moving satellites that strike and peel away instead of getting embedded in mobs.

### Render polish

Orbitals now render with:

- a slightly larger outer square frame;
- a smaller active inner square;
- a short dashed trail from the previous frame;
- a faint ghost square at the previous position.

No labels or new UI text were added.

---

## Music

### Problem

The previous tonal-lock pass prevented sour overlaps, but overcorrected the score. It removed too much brightness and reduced boss rooms to a dark bed without a memorable boss entry/theme.

### New score rule

Keep one tonal center, but restore authored musical identity:

- one safe F-based tonal grid for all rooms;
- no detune/pitch drift for musical notes;
- no random key changes on room transitions;
- more notes, registers, rhythm and timbre variation;
- stronger boss hook and drive lines.

### Boss music

Boss rooms now get a dedicated hook:

- immediate phrase trigger on boss room entry;
- higher lead motif;
- darker saw/triangle drive answer;
- stronger pulse/choir/drive/bossLine layers;
- shorter phrase timer in boss rooms so the theme feels active instead of absent.

### Expanded music layers

The active music setup now includes:

- `highPad` — calmer high notes for rest/menu/portal and occasional boss shimmer;
- `drive` — dark motion layer for combat/boss;
- `bossLine` — boss-specific mid/high musical line;
- `needle` — controlled static/casino/chaos noise layer.

The result should be richer and more varied than v2.1.5/v2.1.7, but still safer than the older false-harmony version.

---

## Version

- `VERSION`: `v2.1.8`
- `BUILD_ID`: `orbital-flow-boss-score`
- package version: `2.1.8`

---

## QA performed

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-1.js').then(()=>console.log('sim import ok'))"
node -e "import('./src/i18n.v2-1.js').then(()=>console.log('i18n import ok'))"
node -e "import('./src/hud.v2-1.js').then(()=>console.log('hud import ok'))"
node -e "import('./src/effects.v2-1.js').then(()=>console.log('effects import ok'))"
node -e "import('./src/audio.v2-1.js').then(()=>console.log('audio import ok'))"
unzip -t terminal_casino_roguelike_2.1.8_orbital_flow_boss_score.zip
```

---

## Follow-up risks / tuning

- Orbitals may need damage radius tuning after playtest if the new skimming motion makes hits feel too rare or too strong.
- Boss music may need volume balancing relative to SFX after testing with the music slider high.
- If boss theme is still not obvious enough, add a one-shot boss room entry sting rather than raising all combat music.
