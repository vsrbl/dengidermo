# v2.1.154 — process_controller_slot_danger_damage_hotfix

- CMD no longer locks or fills a capture target when the controller has no free process slot.
- SAW now denies cleanly when the process roster is full.
- CMD base cooldown increased from 1.70s to 2.45s so cooldown upgrades matter more.
- Controlled processes now take damage from enemy bullets, boss warning hits, Static Storm strikes, room hazards and damaging fields.
- Controlled processes still ignore plain body contact with enemies.
- Fixed controlled process HP logic so reaching 0 HP actually removes the process and plays the dissolve effect.
- Routed quiet controlled-process hit SFX for the new damage events.
