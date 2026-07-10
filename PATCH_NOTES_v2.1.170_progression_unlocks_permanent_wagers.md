# v2.1.170 — Five-loop cleanup, unlock progression and permanent wagers

## Cleanup progression
- A successful run now ends after **5 loops / 20 sectors** instead of 10 loops.
- The final screen uses the player-facing result **CLEANUP COMPLETE / ОЧИСТКА ЗАВЕРШЕНА**.
- Completing the cleanup unlocks **Process Controller** on the current device.

## Antivirus unlocks
- A fresh profile starts with only **Base Antivirus** available.
- **Living Casino** unlocks after the final deletion of the **Hidden Casino Virus**.
- **Process Controller** unlocks after completing the full cleanup.
- Locked cards show their unlock condition in both Russian and English.
- Hero unlocks are saved locally and old selected locked heroes safely fall back to Base Antivirus.

## Hidden Casino Virus
- Final deletion now triggers its own boss-grade victory burst without duplicating the normal boss banner.
- The virus drops a large GLD jackpot scaled by depth, loop economy and current run progression.
- The jackpot is split into a readable burst of pickups and is guaranteed to total the announced amount.
- The result banner reports the deletion, GLD reward and Living Casino availability.

## Permanent sector wagers
- `ROOM WAGER` was removed from every boss-signature reward pool and from debug boss rewards.
- Wagers automatically unlock after the second defeated core threat and remain active until the run ends.
- A wager is generated before every following sector, even when no INSTALL choice is pending.
- Each player gets a 12-second decision with explicit **ACCEPT / SKIP** controls.
- The INSTALL transition waits for every connected player, then continues immediately after all decisions.
- Timeouts safely skip the wager and cannot soft-lock solo or multiplayer runs.
- Wager cards and progress now refresh correctly after switching RU/EN.

## Hero-specific wager pools
- Base Antivirus received weapon-module, fire-rate and weapon-power risks; weapon-switch, no-Q and high-delete conditions; and permanent/loop combat prizes.
- Living Casino received spark-charge, target-channel and spark-channel risks; manual-mark, spark-link and autonomous-clear conditions; and target, spark, damage, duration and range prizes.
- Process Controller received process-release, slot and control risks; command, capture and full-grid conditions; and slot, control, assimilation, fire, integrity and persistence prizes.

## Debug lab
- Added controls to unlock or lock all heroes.
- Added controls to unlock or lock all skins.
- Added wager enable/disable controls and direct Hidden Casino Virus spawning.
- Removed the obsolete wager-as-boss-reward button.

## Verification
- All JavaScript files pass `node --check`.
- Automated simulation checks cover the five-loop target, wager removal from boss rewards, unlock events, wager accept/skip/timeout flow, multiplayer transition locking and hero-specific wager variety.
- HTML duplicate-ID audit passes for `index.html` and `404.html`.
- Signaling server health check reports `v2.1.170`, build `five_loop_unlocks_permanent_wagers`, protocol `5`.
