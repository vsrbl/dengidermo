# PATCH NOTES — v2.0.54 elemental status hotfix

- Починен весь путь elemental WPN effects: bullet upgrade → bullet data → hit → enemy status → snapshot → render.
- `FIRE BULLETS` теперь на каждом попадании явно ставит `BURN`, показывает hit-VFX и рамку `BURN` на враге.
- `POISON BULLETS` теперь на каждом попадании явно ставит `POISON`, показывает hit-VFX и toxic outline.
- `FREEZE BULLETS` теперь всегда даёт видимый `CHILL` на враге, а сильный `FROZEN` остаётся отдельным proc.
- Добавлен `chillT` в enemy snapshot/render, чтобы замораживающие атаки были видны даже без полного freeze-lock.
- Elemental эффекты применяются до прямого bullet damage, чтобы hit не пропадал визуально, если цель умерла от самого попадания.
- Добавлен fallback: если projectile по какой-то причине потерял `elem`, он восстанавливается из stats владельца.
- Bullet overlays fire/freeze/poison сделаны ярче и читаемее.
