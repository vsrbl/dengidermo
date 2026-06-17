# terminal casino roguelike.space v2.0.65 — HUD safe zones / feed cleanup

This is a small clarity hotfix after v2.0.61 room dossier.

## Fixed

- Gameplay feed messages no longer spawn in the same top-right HUD zone as room intel.
- Feed moved to a dedicated top-left safe zone under the run metadata.
- Room dossier / next room prophecy stay top-right.
- Feed lines are capped and clipped so reward/install/combat messages cannot create a long vertical wall over important room information.
- Added responsive HUD safeguards for smaller screens: metadata, dossier, and feed each get their own space.

## UX rule going forward

HUD zones are now treated as separate lanes:

- top-left: run metadata + transient feed
- top-right: current room dossier + next room intel
- center: major banners only
- bottom-left: HP / XP / GLD / level
- bottom-right: dash + weapon slots

Do not put feed/toast messages back into the top-right lane.
