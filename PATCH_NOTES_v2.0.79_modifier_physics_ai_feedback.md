# PATCH v2.0.87 — Modifier Physics / AI / Feedback Pass

## Modifier physics
- ANCHOR GRAVITY now pulls players, enemies, pickups, and every projectile type toward room sockets.
- PRISM SLOW GRID now slows projectiles in addition to players and enemies.
- STATIC WIRES is fully removed from room modifier generation and debug-room lab via ROOM_MODS removal / normalize filtering.
- ECHO WALLS has been renamed to ECHO SHOTS while keeping the internal id for save/protocol compatibility.

## CASINO VIRUS
- Casino Virus spin status is now visible in the HUD: spins left, next spin timer, and active virus static level.
- Static Rain rolled by Casino Virus now becomes persistent virus rain for the rest of the fight instead of one isolated strike.
- Big Static Rain rolls raise that persistent virus rain to a higher level.
- Virus rain strikes do not seed next-room Static Rain debt.

## BLOOD TAX / GREED feedback
- BLOOD TAX chest prompts, hover text, BET buttons, and denial text now show HP cost instead of GLD.
- GREED SIGNAL damage now has a visible + audible GLD-hit feedback: gold burst marker, balance float, feed line, and debt sound.

## AI / enemy synergy
- SHIFTING WALLS adds a mild enemy steering penalty near moving spike walls, so mobs try to avoid getting shoved into them without becoming too smart.
- DMP now acts more like a real protected nest: nearby shooters/prisms/pulses/echo enemies orbit it, heralds prefer it as a summon nest, and bruisers rally nearby.

## Herald visual path
- HRD summon/cast line is now a broken floor path from Herald to player.
- The path attempts to route around blocking walls using simple corner detours and visually fills along the path while tracking the player.

## Validation
- Syntax checks for server/shared/src.
- Smoke tests: removed Static Wires, Echo Shots label, Anchor pulls player bullets, Slow Grid slows bullets, Casino Virus persistent rain appears in snapshot.
