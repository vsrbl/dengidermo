# v2.1.168 — ctrl_assimilation_capture

- CTRL capture now preserves unusual mob behavior instead of flattening every capture into a generic process.
- Added WPN upgrade `CTRL: АССИМИЛЯЦИЯ +`: capture unlocks progress smoothly by enemy pool tier; the fourth stack enables boss capture.
- Shielded enemies cannot be captured while the shield is active; after capture, enemy shield data is stripped so allied mobs do not carry unnecessary shields.
- Captured splitters now split into allied small processes, and those children use bonus slots so they can appear even when normal process slots are full.
- Captured heralds now summon allied temporary processes against enemy targets.
- Captured damper, warden, leech, glitch, bouncer, ranged anomalies, and bosses now apply ally-side behavior against enemies or support allied processes as appropriate.
- CTRL HUD now shows bonus-slot allied children instead of hiding anything beyond the regular slot cap.
