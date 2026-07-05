# v2.1.75 — Menu YouTube + Loudness Hotfix

- Fixed the main menu version plate so it only shows the short stable version string.
- Moved network/checking text out of the version plate visually by keeping `#menu-version` short.
- Rebuilt the YouTube playlist UI into two stable rows: title/status and input/buttons.
- Fixed cramped YouTube URL input, LOAD/PLAY button alignment and status text overflow.
- Made the YouTube iframe fit the menu width instead of forcing a narrow offset block.
- Increased global game loudness roughly x2 by raising the master WebAudio gain.
- Boosted YouTube iframe volume mapping so the music slider reaches louder playback sooner.
