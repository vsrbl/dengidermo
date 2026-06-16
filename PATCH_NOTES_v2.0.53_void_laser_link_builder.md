# PATCH NOTES — v2.0.54 void laser link builder

- `VOID CUT / VOID LASER` is now a builder-style beam.
- Level I starts as one shorter segment from the player.
- Every core upgrade adds `+1` available link point/segment.
- After the first Q cast, pressing Q again during the link window continues the beam from the last endpoint toward the new aim point.
- Each segment is clamped to its own segment length and collides against walls.
- Base segment length is shorter than before, but upgrade scaling is much stronger.
- Follow-up link segments do not re-trigger casino/mutation side effects; they only build the laser chain.
- `ABL` core upgrades for `VOID CUT` are now allowed beyond level III, matching the new scaling fantasy.
- Updated RU/ENG player-facing descriptions for `VOID CUT` / `BUILD LASER`.
