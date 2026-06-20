# Music licenses / v2.1.55

The game uses licensed external music tracks and supports local files if they are later added under `assets/music/`.

## Tracks

- `Fireflies All Over the Sky` — Yoiyami — CC0 — https://opengameart.org/content/fireflies-all-over-the-sky-%E2%80%94-yoiyami-core-breakcore-fusion
- `Shortcuts` — Zane Little Music — CC0 — https://opengameart.org/content/shortcuts
- `Passing Timeline` — tricksntraps — CC0 — https://opengameart.org/content/free-rhythm-game-music-pack-1
- `Psychic` — tricksntraps — CC0 — https://opengameart.org/content/free-rhythm-game-music-pack-1

## Implementation note

The audio files are played through plain `HTMLAudioElement` without `crossOrigin`, because v2.1.54 could fail silently when the host did not provide anonymous CORS headers. The code tries local files first and falls back to OpenGameArt direct URLs.
