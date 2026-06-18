# PATCH NOTES v2.1.16 — combo payout prizes

## Summary

This patch turns the combo counter into a real reward system.

Before this patch, combo only tracked kills, multiplier, timer, and recent methods. When the timer expired, the chain disappeared without any economy effect.

Now combo pays a prize when it ends:

```txt
combo prize = kills in combo × combo multiplier
```

The prize can be GLD, EXP, or HP depending on the selected INSTALL upgrade.

## Player-facing changes

### Combo now pays out

When combo ends by timer, it pays a prize.

If the player leaves the room before the timer burns out, the combo also pays before the next room starts, so a good chain is not lost just because the portal was used quickly.

### Combo prize formula

For GLD and EXP:

```txt
amount = round(kills × combo multiplier × loop economy multiplier)
```

The loop economy multiplier is used so late-loop combo rewards do not become meaningless.

For HP:

```txt
amount = round(kills × combo multiplier × 0.1)
```

This follows the requested rule: HP is 0.1 per killed enemy, multiplied by combo, then rounded to a whole number.

### New INSTALL upgrades

Added three new hero-level upgrades:

```txt
COMBO PAYS GLD
COMBO PAYS EXP
COMBO PAYS HP
```

Each one changes the combo payout type for that player.

Default payout type is GLD.

### Combo damage penalty changed

Damage still removes part of combo, but it should not wipe the entire combo from one hit.

The damage penalty is now capped to a partial score loss.

### Better method names

Combo method names now use the actual weapon/style names:

```txt
SHOTGUN
SEEKER
ROCKETGUN
DASH
Q
ORBITAL
DRONE
RICOCHET / ОТСКОК
BURN / ПОДЖОГ
POISON / ЯД
FREEZE / ЗАМОРОЗКА
```

RU UI keeps core weapon names like `SHOTGUN`, `SEEKER`, `ROCKETGUN`, as requested.

Status kills now report the specific status instead of the generic `STATUS`:

- burn damage kill → `ПОДЖОГ` / `BURN`
- poison damage kill → `ЯД` / `POISON`
- freeze/thermal crack kill → `ЗАМОРОЗКА` / `FREEZE`

## Implementation notes

### Files changed

- `shared/data.v2-1.js`
  - added combo payout upgrade definitions;
  - added `comboPrize` to `defaultStats()`.

- `shared/sim.v2-1.js`
  - added combo payout helpers;
  - combo now stores last actor id;
  - combo pays out on timer break;
  - combo pays out on room transition if still active;
  - combo damage loss is partial;
  - status damage sources now distinguish fire/poison/freeze.

- `src/hud.v2-1.js`
  - updated combo method labels;
  - added combo payout feed message;
  - updated combo explanation text.

- `src/i18n.v2-1.js`
  - added upgrade descriptions and RU labels for combo payout upgrades.

- `shared/protocol.v2-1.js`
  - version bumped to `v2.1.16`;
  - build id set to `combo_payout_prizes`.

- `package.json`, `index.html`, `404.html`
  - version/cache text bumped to `2.1.16`.

## QA checks

Run:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-1.js').then(()=>console.log('sim ok'))"
node -e "import('./src/hud.v2-1.js').then(()=>console.log('hud ok'))"
node -e "import('./src/i18n.v2-1.js').then(()=>console.log('i18n ok'))"
unzip -t terminal_casino_roguelike_2.1.16_combo_payout_prizes.zip
```

## Follow-up risks

- Combo payout balance may need tuning after live testing, especially GLD/EXP with late-loop economy scaling.
- In co-op, the payout type is based on the player who most recently extended the combo. If this feels unclear, future work can make combo payout type a team-level setting instead.
- HP combo payouts can round to 0 on tiny low-multiplier chains. This matches the requested rounding rule, but may feel weak for very short combos.
