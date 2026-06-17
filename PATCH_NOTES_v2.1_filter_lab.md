# Terminal Casino Roguelike 2.1 — Filter Lab Hotfix

## Visual filter lab
- Added five selectable full-screen CSS-only digital filters:
  - CRT — terminal green shadow-mask / scanline look.
  - VHS — soft tape bands, horizontal roll, slight RGB drift.
  - JPEG — block-compression surveillance degradation.
  - LCD — cold subpixel matrix display.
  - DIRTY — liminal security-camera dust/vignette.
- Added always-available filter switch button in the bottom-right corner.
- Added F7 hotkey to cycle filters during gameplay.
- Filter selection is saved in localStorage.
- All filters use fixed DOM overlays and CSS backgrounds only: no per-frame canvas/WebGL pass.

## i18n
- Added RU/EN filter labels and tooltip.
- Filter switch updates when language changes.

## Notes
- The filter still overlays all content globally, including menu, HUD, modals, text, and canvas.
