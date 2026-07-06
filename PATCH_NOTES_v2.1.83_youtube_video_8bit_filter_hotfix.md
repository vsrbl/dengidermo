# PATCH NOTES v2.1.83 — YouTube Video 8BIT Filter Hotfix

Дата: 2026-07-06

## Что изменено

- 8BIT toggle теперь влияет не только на звук/маску, но и на само окно YouTube-видео.
- Добавлен визуальный 8-bit фильтр на `#youtube-player-wrap`:
  - iframe рендерится в уменьшенном размере и масштабируется обратно для грубой пикселизации;
  - добавлен SVG color-quantize filter с дискретными каналами;
  - добавлены scanline/grid overlay и terminal tint;
  - в углу окна появляется маленькая метка `8BIT VIDEO FILTER`, когда режим активен.
- Состояние visual 8BIT синхронизируется с существующей кнопкой `8BIT` в верхнем mini-player HUD.
- Обновлён fallback `404.html`, чтобы GitHub Pages отдавал ту же версию и тот же фильтр.

## Технически

- Добавлен SVG filter `#tcr-yt-8bit-color-filter` в `index.html`.
- `bindYouTubeMiniControlsV2180()` теперь переключает классы:
  - `html.yt-video-8bit`
  - `#youtube-music.yt-video-8bit`
  - `#youtube-player-wrap.yt-video-8bit`
- CSS-фильтр сделан визуальным, потому что YouTube iframe остаётся cross-origin и не может быть напрямую прогнан через WebAudio/Canvas без ограничений браузера.

## Проверки

- `node --check src/main.v2-1.js` — OK
- `node --check src/audio.v2-1.js` — OK
- `node --check shared/protocol.v2-1.js` — OK
- `node --check server/index.js` — OK
