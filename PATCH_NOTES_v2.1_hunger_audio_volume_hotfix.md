# PATCH NOTES v2.1 — Hunger / Audio Volume Hotfix

## Audio volume response
- Music and SFX sliders now apply volume immediately instead of using a short WebAudio smoothing ramp.
- Music output ceiling is doubled again so the music slider can reach a much louder maximum.
- Moving or clicking a volume slider now plays a short preview sound:
  - Music slider: a short muted music tick routed through the music bus.
  - SFX slider: a dry terminal click routed through the SFX bus.

## HUNGER mutation rework
- HUNGER no longer resolves as a confusing instant hit.
- HUNGER now creates a short charge zone when Q is used.
- Enemies inside the zone feed charge over time.
- When the charge ends, it releases a short red DIGITAL BITE burst.
- The final bite scales with the number of enemies caught during the charge window.
- Added clearer RU/EN descriptions for HUNGER.

## Build
- Menu build label updated to `hunger-audio-volume`.
