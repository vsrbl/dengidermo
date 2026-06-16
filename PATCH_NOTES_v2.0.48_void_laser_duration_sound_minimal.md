# PATCH NOTES — v2.0.54 void laser duration / sound / minimal pass

- `VOID CUT / VOID LASER` duration increased by +2 seconds at the base formula.
- Kept upgrade scaling: upgrades still increase length, damage, and duration.
- Laser VFX simplified again:
  - almost one thin dirty-white line;
  - very faint purple signal glow;
  - sparse long dash overlay;
  - tiny square muzzle/end outline only;
  - removed extra side sparks/noisy pixel markers.
- Added dedicated `active_void_laser` procedural WebAudio SFX:
  - dry terminal ignition;
  - thin high-pitch laser line;
  - short dirty noise tail;
  - small low square undertone.
- Audio only plays on the owning player cast, not on every repeated visual tick.
