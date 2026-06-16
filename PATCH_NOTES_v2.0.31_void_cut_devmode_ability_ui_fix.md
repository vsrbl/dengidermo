# v2.0.43 — void cut line field / dev mode / compact ability UI

## Main fixes

- `VOID CUT` no longer teleports/dashes the player.
- `VOID CUT` now creates a long lingering line-field from player to aim/cursor.
- Enemies standing on or crossing the line take repeated active damage and slow.
- Enemy bullets touching the line are damped/erased.
- The line renders as a dirty segmented purple digital tear, not a clean circle or dash.

## Ability chest UI

- ABL cards are compact again.
- Cards show only:
  - hotkey number;
  - reward name;
  - action label;
  - type/role tags.
- Long descriptions moved back into hover tooltip.
- Tooltip text supports paragraph breaks.
- Modal is narrower, centered and cleaner.

## Developer mode

Press `F2` in-game to open/close DEV MODE.

Dev panel currently supports SOLO/HOST testing:

- choose active core;
- choose Q level I/II/III;
- choose up to 3 mutations;
- apply Q instantly;
- reset cooldown / HP / dash charges;
- open ABL offer;
- spawn test enemy pack;
- clear enemies and enemy bullets;
- give all weapons;
- give GLD/EXP;
- unlock all skins locally;
- toggle god mode.

Guest clients cannot run host dev commands.

## Checks

- `node --check` on server/shared/src files.
- Smoke import for sim/local.
- Active/dev command smoke test.
