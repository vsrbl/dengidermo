# nncckkrr v2.0.92 — weapon secondary fire + echo proc visuals

## Fix: RKT cluster radius

- Reverted the accidental v2.0.74 radius increase on `RKT CLUSTER` mini-blasts.
- `RKT CLUSTER` now only adds extra final-detonation mini-blasts with normal cluster radius.
- The doubled radius remains only on `RKT STATIC MINES`, i.e. the additional blasts dropped during rocket flight.

## New weapon secondary rule

- `RMB` is now a generic current-weapon secondary action.
- `Space` remains inspect mode.
- Controls text now says RMB = ALT / weapon secondary instead of only RKT detonate.

## SEEKER secondary: SEK SWARM RMB

New stackable WPN upgrade:

- `SEK SWARM RMB`
- Requires SEEKER.
- RMB releases a homing seeker swarm immediately.
- Stack 1: 5 homing bullets.
- Stack 2: 10 homing bullets, slightly longer cooldown.
- Stack 3: 15 homing bullets, slightly longer cooldown.
- Continues scaling by +5 bullets per stack.
- Swarm bullets are visually tagged as echo-style shots so the player can read the burst.

## SHOTGUN secondary: SHG LONGSHOT RMB

New stackable WPN upgrade:

- `SHG LONGSHOT RMB`
- Requires SHOTGUN.
- RMB spends all loaded SHG charges on one long slug shot.
- Stack 1: x2 range, x1.2 damage.
- Stack 2: x2.5 range, x1.4 damage.
- Stack 3: x3 range, x1.6 damage.
- Continues scaling by +0.5 range and +0.2 damage per stack.
- The shot applies a reload penalty by pushing SHG charge recovery backward.

## ECHO SHOT readability

- Bullets created by `ECHO SHOT` procs now carry a visible purple ghost-square overlay.
- This makes it clear when a projectile is a real extra echo proc rather than a normal shot.
- The same visual language is reused for SEK SWARM bullets because they are an intentional extra-shot burst.

## Checks

- node --check server/index.js
- node --check shared/*.js
- node --check src/*.js
- Smoke: RKT remote detonation still works.
- Smoke: SEK SWARM stack 3 creates 15 homing bullets.
- Smoke: SHG LONGSHOT stack 3 creates one longshot slug and consumes all charges.
- Smoke: snapshot includes echo-proc and longshot visual flags.
