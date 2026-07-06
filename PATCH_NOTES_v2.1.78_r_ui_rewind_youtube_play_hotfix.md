# v2.1.78 — R UI / REWIND / YouTube play hotfix

- R-active HUD no longer uses the oversized separate card; it now matches the simple Q/LVL status line style.
- REWIND MARK now has a visible tether line from the player to the return point.
- REWIND MARK and REWIND RETURN now emit explicit sound cues and screen/world effects.
- YouTube playlist PLAY now starts the playlist with `loadPlaylist()` from the click handler and retries `playVideo()` shortly after.
