# v2.1.156 — YouTube watch-link loading hotfix

Исправлен YouTube mini player:

- Ссылки вида `watch?v=VIDEO&list=RDVIDEO&start_radio=1` теперь грузятся как конкретное видео, а не как radio-playlist.
- Чистые playlist-ссылки по-прежнему грузятся как playlist.
- Добавлен общий парсер YouTube source: `video`, `playlist`, `youtu.be`, `shorts`, `embed`, raw video ID, raw playlist ID.
- При нажатии `LOAD` и `PLAY` теперь сразу появляется статус `LOADING...` / `BUFFERING...`.
- Кнопки LOAD/PLAY временно блокируются во время загрузки, чтобы не слать несколько команд в iframe.
- Статусы ошибок стали понятнее, включая `YT ERR 2 · BAD LINK`.
- Подписи UI изменены с playlist-only на `YOUTUBE VIDEO / PLAYLIST`.

Проверки:

- `node --check` по всем JS.
- ESM imports audio/main/hud/render/sim.
- Парсер проверен на ссылке `https://www.youtube.com/watch?v=undDbYudQ_Q&list=RDundDbYudQ_Q&start_radio=1`: результат `video: undDbYudQ_Q`.
- Stub smoke: `playYouTube()` вызывает `loadVideoById`, а не `loadPlaylist`, для watch+RD ссылки.
- Серверный `/health` показывает `v2.1.156`.
- `unzip -t` OK.
