# v2.0.44 — active balance / visual clarity pass

## Intent
Active abilities from v2.0.31 were too hard: too much radius, duration, slow, damage and visual noise. This patch cuts active power back and makes the visual language consistent/readable.

## Balance
- Global active ability duration/radius/pull/line width/range are reduced by ~1.5x via a shared active scale.
- Active damage and shell-crack power are reduced by ~1.5x.
- EXPOSED duration/multiplier are softened.
- Active slow/damp effects are softened so freeze/black-box/control fields are not hard-stops by default.
- Blood Ring no longer grows outward; it is now a stable follow aura.
- Signal Spike / Anchor fields are smaller and less oppressive.
- Void Cut remains a line-field, but the line is shorter/narrower/weaker and no longer reads like a dash attack.

## Visuals
- Radius effects are now stable square auras, not expanding waves from the player.
- Active ticks no longer create circular/ring waves.
- Signal Spike and Anchor fields draw a visible square node with a static aura around it.
- Dash/active explosion visuals use square rocket-style blasts instead of soft circular rings.
- Void mutation feedback is a square void burst, not an extra dash-looking slash.
- Void Cut line is a stable segmented digital tear with less pulsing.

## Version
- Bumped to `v2.0.44`.
- Module filenames updated from `v2-0-31` to `v2-0-44`.
