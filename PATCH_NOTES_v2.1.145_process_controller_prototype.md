# v2.1.145 — process_controller_prototype

## Third antivirus prototype

- Added the third selectable antivirus core: **КОНТРОЛЁР ПРОЦЕССОВ / PROCESS CONTROLLER**.
- Added the third card to the main menu hero selector.
- The controller starts with its own three left-mouse weapon modules:
  - **CMD / Командный импульс** — control pulse for weakening and seizing corrupted processes.
  - **QRN / Карантинный якорь** — anchor shot that attaches to walls and creates a quarantine field.
  - **SAW / Пила процесса** — heavier process-cutting control shot.
- The controller does not use the Living Casino ring and does not receive base antivirus weapon offers.

## Process control loop

- CMD and SAW can seize weakened non-boss, non-slot threats and convert them into controlled processes.
- Controlled processes become cyan/green helper nodes and fire at visible threats.
- Right mouse button now gives an order point to all controlled processes.
- Controlled processes orbit the player when no order is active and push toward the ordered point when commanded.
- Added a compact CTRL HUD panel showing process count and command status.

## Quarantine anchor prototype

- QRN sticks to walls instead of behaving like a normal projectile impact.
- On wall contact it creates a quarantine field that:
  - pulls nearby threats toward the anchor,
  - slows and briefly interrupts them,
  - keeps them leashed around the wall field for a short duration,
  - deals small periodic damage.

## Controller WPN upgrades

- Added new WPN upgrades:
  - **CTRL: ПРОЦЕСС +1** — one more controlled process slot.
  - **CTRL: ПРИКАЗ +** — stronger capture/control power.
  - **CTRL: ТЕМП ПРОЦЕССОВ +** — controlled processes fire more often.
  - **QRN: ЗОНА +** — wider quarantine field.
  - **QRN: УДЕРЖАНИЕ +** — longer/stronger quarantine pull.

## Technical notes

- Added controller weapon rendering and controlled-process companion rendering.
- Added controller-specific weapon pool filtering for WPN/casino choices.
- Added process-controller snapshot data for the client HUD.
- This is a first playable prototype, not the final full controller kit.
