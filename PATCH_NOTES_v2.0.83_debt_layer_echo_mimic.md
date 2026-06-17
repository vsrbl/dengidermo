# v2.0.83 — Debt Engine Layer + Echo Mimic

## Debt Engine clarity

- Debt Engine no longer injects `static_rain` into `room.mods` when it is the only source of rain.
- Debt Engine is now represented as a separate cursed layer:
  - `DEBT ENGINE: +STATIC RAIN LVL 1 THIS ROOM`
  - stacks increase this layer by +1 per stack.
- The core room modifier remains visible and primary.
  - Example: `CASINO VIRUS` stays `CASINO VIRUS`, while Debt Engine appears as a separate layer.
- Current room snapshot now exposes:
  - `room.debtEngineRainStacks`
- Next room preview now exposes:
  - `next.debtEngineRainLevel`
- Normal Static Rain debt/carry still appears as the normal `STATIC RAIN` room modifier.
- Debt Engine rain still works mechanically, but never seeds/cascades into future debt by strike count.

## HUD / NEXT readability

- Current HUD now separates:
  - current normal Static Rain;
  - current Debt Engine rain layer;
  - next normal Static Rain;
  - next Debt Engine rain layer.
- Tooltip text now explicitly says Debt Engine does not replace the room modifier.
- Debt Engine upgrade text now describes it as a separate room layer.

## Echo enemy rework

- Echo enemy now mimics the targeted player's current weapon type instead of firing generic echo bullets.
- It keeps shooter distance and uses slower reload than the player.
- Mimic variants:
  - SHG: fires a short shotgun-like spread.
  - SEK: fires a homing seeker-like projectile at the target player.
  - RKT: fires a slow rocket-like projectile with dangerous AoE.
- Echo enemy stores its current mimicked weapon for debugging/snapshot behavior.

## QA

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- Import smoke: sim, hud, i18n, render, audio
- Smoke: Debt Engine layer does not add `static_rain` to `room.mods`
- Smoke: Debt Engine current and next fields exist
- Smoke: Echo enemy mimics SHG / SEK / RKT
