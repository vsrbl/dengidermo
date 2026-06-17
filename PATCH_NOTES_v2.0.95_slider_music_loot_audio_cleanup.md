# nncckkrr v2.0.100 — slider/music/loot/audio cleanup

Base: v2.0.94_ui_audio_combat_polish

## Changes

- Simplified the MUSIC/SFX sliders:
  - thinner square terminal tracks;
  - smaller square handles;
  - fixed fill calculation staying aligned to the value.
- Made the main-menu skin drawer layout stable:
  - opening/closing CHANGE SKIN no longer reflows the whole menu or pushes buttons.
- Music pass:
  - bass/sub/pulse layers are quieter and move into the background;
  - dirge/pad/choir/lead layers are more audible;
  - motifs were made darker and more descending, avoiding cheerful movement;
  - tonal center stays locked to the bass root so layers do not fight each other.
- BSC chest loot now scales with loop economy:
  - GLD/EXP drops grow with the same economy curve that makes prices rise;
  - BSC loot label shows the current multiplier.
- Reduced unwanted combat sounds:
  - enemy combo/director-wave/damper bullet-stop noise no longer triggers extra SFX;
  - enemy echo shots stay visual but do not play the player echo sound;
  - player echo shots now get the echo-shot SFX only when the player actually creates extra shots.

## Checks

- node --check server/index.js
- node --check shared/*.js
- node --check src/*.js
- import checks: sim, i18n, hud, audio
- zip -T
