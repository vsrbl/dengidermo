# Patch v2.1.146 — process_controller_protocol_cleanup

## Controller identity cleanup

- Reframed the Process Controller's three LMB slots as **control commands**, not guns:
  - `CMD` — capture command;
  - `QRN` — wall quarantine anchor;
  - `SAW` — process dismantle command.
- The controller no longer fires physical projectiles from those slots.
- Controller LMB now runs discrete command protocols:
  - `CMD` builds control instability on a target near the cursor and captures it when the threshold is reached;
  - `SAW` sweeps a short control line and builds instability on processes along it;
  - `QRN` places a quarantine anchor only when the aim ray reaches a wall.
- Controller capture now works through a control-instability meter instead of relying only on low HP wording.

## WPN / command cache rules

- Process Controller WPN offers are now controller-only command upgrades.
- SHG / SEK / RKT, LVC / RLT / CRD and their projectile/status branches are blocked from the controller's WPN pool.
- Controller WPN modal is renamed to a command cache when all choices are controller commands.
- Generic WPN chest text now says it adapts to the selected core.

## Text cleanup

- Replaced “three control guns” wording with “three control commands”.
- Replaced controller weapon descriptions with command/protocol descriptions.
- Menu controls now say LMB uses weapon/command and RMB uses the core's special action.
