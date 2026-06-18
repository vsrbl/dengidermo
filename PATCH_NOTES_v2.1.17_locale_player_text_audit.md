# PATCH NOTES v2.1.17 — locale player text audit

## Goal
Clean up player-facing language after the combo payout patch:

- English mode must not display Russian/Cyrillic text.
- Russian mode should use Russian text where the UI is explanatory/player-facing.
- Technical/developer-facing wording should not leak into normal player UI.
- Keep intentional game codes/names such as `GLD`, `EXP`, `HP`, `Q`, `WPN`, `ABL`, `BET`, `SHOTGUN`, `SEEKER`, `ROCKETGUN`.

## Changed files

- `shared/protocol.v2-1.js`
- `package.json`
- `index.html`
- `404.html`
- `src/i18n.v2-1.js`
- `src/hud.v2-1.js`
- `src/effects.v2-1.js`

## Version

- `VERSION` → `v2.1.17`
- `BUILD_ID` → `locale_player_text_audit`
- package version → `2.1.17`
- HTML cache query strings updated to `2.1.17`.

## Localization cleanup

### English audit

- Checked all `localText(ru, en)` English branches for Cyrillic leakage.
- Checked the main `EN` UI translation block for Cyrillic values.
- Confirmed key `locLabel()` paths still convert Russian labels to English in English mode.
- English output for common Russian labels such as `КОМБО: ПРИЗ GLD`, `БЫСТРАЯ ЗАЧИСТКА`, `СТАТИК-ЯДРО`, and `ОГНЕННЫЕ ПУЛИ` resolves to English labels.

### Russian cleanup

Converted or softened player-facing Russian UI where it was still too English/technical:

- `INSTALL` → `УЛУЧШЕНИЕ` in normal Russian HUD/menu text.
- `LOOP / DEPTH` → `ЦИКЛ / ГЛУБИНА` in Russian HUD text.
- `co-op`/`coop` removed from Russian menu text.
- `Q CD` → `Q ЗАРЯД`.
- `Q OVERCLOCK` → `Q РАЗГОН`.
- `апгрейд` → `улучшение` / `усиление` in normal Russian explanations.
- Static HTML Russian fallback text in `index.html` and `404.html` updated too, so the first paint before JavaScript localization is cleaner.

## Combo text cleanup

- Simplified combo upgrade descriptions:
  - no longer exposes the full formula in the upgrade card;
  - the card now says the combo gives `GLD`, `EXP`, or healing when the chain ends.
- Combo tooltip now explains the system in player language:
  - combo stays active while the player keeps killing;
  - it pays the selected prize when the chain ends;
  - damage removes part of the combo.
- Weapon/method names remain intentional game names/codes:
  - `SHOTGUN`, `SEEKER`, `ROCKETGUN`, `Q`, `GLD`, `EXP`, `HP`.

## Weapon chest readability cleanup

- WPN role tags are now localized in Russian:
  - `NEW` → `НОВОЕ`
  - `DPS` → `УРОН`
  - `RANGE` → `ДАЛЬНОСТЬ`
  - `STATUS` → `СТАТУС`
  - `CONTROL` → `КОНТРОЛЬ`
  - `SYNERGY` → `СВЯЗКА`
  - `ECONOMY` → `РЕСУРСЫ`
- Element tags are now localized in Russian:
  - `FIRE` → `ОГОНЬ`
  - `FREEZE` → `ХОЛОД`
  - `POISON` → `ЯД`
  - `DRONE` → `ДРОН`
- Kept weapon names themselves as intended game names: `SHOTGUN`, `SEEKER`, `ROCKETGUN`.

## Technical/developer wording cleanup

- Normal Russian interface no longer exposes `INSTALL`, `LOOP`, `DEPTH`, `co-op`, or `апгрейд` in the main places players see most.
- Existing network/deployment status strings remain English by design:
  - `NETWORK READY`
  - `CONNECTING…`
  - `UPDATE REQUIRED`
  - `ROOM NOT FOUND`
  - `ROOM FULL`

These are still treated as deployment/network signals and were not translated.

## QA checks

Passed:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-1.js').then(()=>console.log('sim ok'))"
node -e "import('./src/i18n.v2-1.js').then(()=>console.log('i18n ok'))"
node -e "import('./src/hud.v2-1.js').then(()=>console.log('hud ok'))"
node -e "import('./src/effects.v2-1.js').then(()=>console.log('effects ok'))"
```

Additional audit:

- `localText()` English branch Cyrillic scan: OK.
- Main `EN` UI object Cyrillic value scan: OK.
- Zip integrity check: OK.

## Notes for next chat

The game still intentionally keeps some English-style game codes in Russian mode: `GLD`, `EXP`, `HP`, `Q`, `WPN`, `ABL`, `BET`, `SHOTGUN`, `SEEKER`, `ROCKETGUN`. Do not translate those unless the user explicitly changes that rule.
