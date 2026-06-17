# nncckkrr v2.0.94 — square portal green burst

## Goal
Portal opening must match the game's hard terminal/casino-square visual language. It should not look like a soft round circle/ring.

## Changes
- Replaced `portal_open` circular `ring` effect with a green square signal burst.
- Added layered square portal animation:
  - expanding dashed square frames;
  - hard cardinal square shock plates;
  - small pleasant green square core flash;
  - short square-block burst layer.
- No circular `ctx.arc()` is used for `portal_open` anymore.
- Portal itself remains a square object in the world.
- Contract/portal timing logic unchanged: contracts still settle only when the portal opens.

## QA
- Portal-open visual should read as a square green explosion.
- No round halo should appear on portal open.
- Static Rain / contract / portal transition logic must remain unchanged.
