# v2.1.178 — ACTIVE TARGETING / VOID BUILDER / QA

## Q active confirmation

- Radius-based Q modules no longer fire on the first key press.
- The first Q press opens a persistent in-world area preview.
- The second Q press confirms the cast and only then spends cooldown or charge.
- The preview follows the player for self-centered modules.
- SIGNAL SPIKE previews its actual placement zone at the aim point.
- Expired previews, death, INSTALL, room transitions, and core replacement clear targeting without spending the ability.
- Normal aim decoration is hidden while a Q placement preview is active.

## VOID CUT

- The first Q press now places the initial VOID CUT node at the aim point instead of firing from the hero.
- A dashed preview is drawn from the selected node toward the current aim.
- The next Q press commits that segment.
- Further Q presses repeat the same flow from the previous segment endpoint until all available links are used.
- The preview and the committed segment use the same wall clipping, so the final beam no longer differs from the guide.
- Cooldown starts only when the first segment is committed, not when the initial node is selected.

## R radius preview

- An active REWIND MARK now displays the real return/stun area before the second R press.

## Network and UI

- Added authoritative active-targeting data to player snapshots.
- Remote players can see active placement previews.
- Local self-centered previews follow predicted movement to avoid visible lag.
- Protocol increased to 6 to prevent mixed-version sessions.
- Updated Russian and English active descriptions.

## Verification

- Tested all radius-based Q cores for arm/confirm behavior.
- Tested SIGNAL SPIKE charge spending.
- Tested VOID CUT with one and multiple links.
- Tested preview/cast wall-clipping parity.
- Tested preview expiration and INSTALL cleanup.
- Checked all JavaScript files, module import paths, snapshot layout, signaling health endpoint, and archive integrity.
