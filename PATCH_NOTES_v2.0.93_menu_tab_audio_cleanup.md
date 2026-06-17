# v2.0.94 — menu skin toggle, TAB cleanup, audio settings

- Main menu skin selector is collapsed by default behind `CHANGE SKIN / СМЕНИТЬ СКИН`.
- Added separate music and SFX volume sliders in the main menu, saved to localStorage.
- Menu music now plays after audio unlock; the dark dirge layer is active before starting a run.
- Music reacts more strongly to room danger, enemy count, bullet pressure, low HP and recent damage events.
- Skin claim card no longer depends on pending INSTALL level-up; skin-only INSTALL modal stays open until claimed.
- Center banners/roll overlays are hidden while chest/upgrade/casino modals are open so no text appears behind panels.
- TAB cards are equal-sized, less crooked, with more underlined terms and shorter hover text.
- Top-right room dossier wrapping/spacing adjusted to reduce overlap with target/contract/Casino Virus roll UI.
- Static Storm explanation clarified: banked level, spent level and what the storm actually does.
- FIELD SNAP now pulls once on cast; the lingering field only slows, damps bullets and deals low control damage.
- Dev `CLEAR` now kills enemies through kill logic instead of simply deleting them.
