# v2.1.73 — YouTube ambient + drone status hotfix

## Fixed
- Drone bullets no longer inherit fire/freeze/poison from the weapon by default.
- Drone bullets now mark their projectile source as `drone`.
- Element fallback logic now respects drone source, so `DRONE ELEMENT LINK` is required for drones to carry weapon statuses.

## Music
- Internal procedural music is now dark ambient only.
- Removed active techno/melody/drum/acid scheduling from the final music update.
- Internal ambient fades out when the YouTube player is actively playing.

## YouTube playlist player
- Added a YouTube playlist input in the audio settings.
- Accepts playlist URL or playlist ID.
- Uses the official YouTube IFrame Player API.
- Music volume slider also controls the YouTube player volume.
- Playlist ID is saved locally on the device.

## Notes
- YouTube playback needs internet access and a user click.
- Some playlists/videos may be unavailable for embedding depending on YouTube restrictions.
