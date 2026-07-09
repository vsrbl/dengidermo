# v2.1.153 — process_controller_proc_damage_sfx_expire_hotfix

Process Controller follow-up hotfix focused on controlled-process damage scaling and missing subordinate audio/expiry feedback.

## Changes

- Controller WPN/command chest can now offer a Controller-safe damage stat:
  - `CTRL: УРОН ПРОЦЕССОВ +18%`.
  - It applies the existing weapon damage multiplier to controlled processes, not to forbidden hero guns.
- Clarified the generic `DMG +15%` and WPN damage text so it is explicit that controlled processes benefit from outgoing damage scaling.
- Restored quiet controlled-process SFX:
  - controlled shooters now make a soft subordinate shot sound when they fire;
  - controlled process damage/hits now make a soft impact sound;
  - no loud hero weapon beep is used.
- Added controlled-process disappearance feedback:
  - when a process expires or dies, it emits a `ctrl_proc_expire` FX;
  - the client plays a quiet decay sound and shows a square terminal-style dissolve marker.

## Checks

- `node --check` passes for all JS files.
- ESM imports pass for sim/data/hud/render/effects/audio/main with browser stubs.
