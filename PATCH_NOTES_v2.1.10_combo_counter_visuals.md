# PATCH NOTES — v2.1.10_combo_counter_visuals

## Goal

Add the first player-facing combo system built around a clear multiplier and varied kill methods.

The previous design direction explored crowd shapes, but in real combat the horde often collapses into one dense mass. This patch deliberately switches the combo idea away from reading enemy formations and toward a more direct arcade/casino loop:

```txt
kill enemies → build COMBO
use different methods → build faster
stop killing too long → combo breaks
take damage → lose part of combo, not all of it
```

## Version

- `VERSION`: `v2.1.10`
- `BUILD_ID`: `combo-counter-visuals`
- Archive: `terminal_casino_roguelike_2.1.10_combo_counter_visuals.zip`

## Files changed

- `shared/sim.v2-1.js`
- `src/hud.v2-1.js`
- `src/audio.v2-1.js`
- `style.css`
- `index.html`
- `shared/protocol.v2-1.js`
- `server/index.js`
- `package.json`

## Combo model

New run-level combo state:

```js
run.combo = {
  score,
  mult,
  count,
  timer,
  window,
  lastMethod,
  recent,
  flash,
  drop,
  best,
  tier,
  lastGain,
  lastLabel
}
```

### Combo sources

Combo grows from kills and key combat actions. Different sources give better growth than repeating the same method.

Current method keys:

- `shotgun`
- `seeker`
- `rocketgun`
- `ricochet`
- `ability`
- `dash`
- `orbital`
- `drone`
- `status`
- `blast`
- `chain`
- `shell`
- `weapon`

### Diversity rule

- Changing method gives a bonus.
- A method not seen in recent combo history gives another bonus.
- Repeating the same method repeatedly gives reduced gain.

This means shotgun-only or rocket-only clearing still builds combo, but mixed play builds faster.

### Damage rule

Taking player damage reduces part of the combo score.

Important: damage does **not** fully reset combo unless the score was already low.

### Timeout rule

If the player stops building combo for too long, combo breaks and returns to x1.0.

Combo timer is extended by new combo events. Stronger enemies and higher combo state can keep the window alive a little longer, but the counter still needs active play.

## HUD / visual design

Added a compact center-bottom combo widget:

```txt
КОМБО x2.7
ДРОБОВИК · РЫВОК · РАКЕТА
[time bar]
```

### Placement

The widget is placed:

- above the bottom HP/XP/weapon UI;
- below the interact prompt area;
- away from the top-right room dossier;
- not over enemies or the portal;
- with `pointer-events: auto` for tooltip support.

### Style

The visual style follows the existing terminal/casino language:

- square frame;
- corner brackets;
- broken counter feel;
- mostly white/cyan/gold/red;
- stepped animation instead of smooth glossy motion;
- no floating text around mobs.

### Tiers

The combo frame changes tone by multiplier tier:

- low combo: white / neutral;
- early combo: cyan;
- stronger combo: gold;
- high combo: gold/red jackpot pressure.

## Audio

Added small dry terminal combo sounds:

- `combo_tick`: short square tick + noise click when combo tier rises or starts;
- `combo_drop`: short low tick when damage cuts combo;
- `combo_break`: short terminal drop when combo expires.

These are intentionally subtle and should not compete with weapon or boss sounds.

## Gameplay impact

This patch does **not** yet multiply damage, loot, or portal progress. It adds the counter, scoring model, visuals, and audio foundation first.

Future patches can safely hook combo multiplier into:

- GLD/EXP payout;
- portal progress;
- short spawn pause;
- dash/Q refund;
- contract objectives;
- room invoice stats.

## Important implementation notes

- Combo state is authoritative in `shared/sim.v2-1.js` and sent in `snapshot.room.combo`.
- HUD only renders the snapshot; it does not calculate combo locally.
- Combo resets on new room start and after room transition into install phase.
- Dev clear-enemies action is intentionally ignored by combo scoring.
- Enemy synergy labels remain filtered out and are not reintroduced.

## QA checklist

Run:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-1.js').then(()=>console.log('sim ok'))"
node -e "import('./src/hud.v2-1.js').then(()=>console.log('hud ok'))"
node -e "import('./src/audio.v2-1.js').then(()=>console.log('audio ok'))"
unzip -t terminal_casino_roguelike_2.1.10_combo_counter_visuals.zip
```

Smoke tests:

1. Start solo run.
2. Kill enemies with one weapon: combo appears and grows.
3. Switch methods: weapon, dash/Q/orbital/drone/status if available; combo should grow faster.
4. Stop killing: combo timer drains and breaks.
5. Take damage: combo drops partially, not fully.
6. Check that combo UI does not overlap top-right room dossier, bottom HP/XP/weapon UI, or center interact prompt.
7. Confirm EN UI says `COMBO`, RU UI says `КОМБО`.
