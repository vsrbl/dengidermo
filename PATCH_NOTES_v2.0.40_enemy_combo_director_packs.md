# v2.0.41_enemy_combo_director_packs

Цель патча: режиссёр должен чаще собирать осмысленные боевые связки врагов, а не просто кидать одиночные роли рядом. Главный пример: `DMP` должен быть сильной защитной основой для `HRD`, а рядом должны работать вращающиеся стрелки.

## Новые / усиленные encounter packs

### HERALD DAMPER CHOIR
- `DMP` создаёт bullet-safe nest.
- `HRD` стоит внутри/рядом и готовит summon.
- `SHT / PRS / PLS` получают rotary-guard поведение и держатся вокруг nest-core.
- `RUN / GLT` работают как экран, чтобы игроку было опаснее просто влететь в саппортов.
- Цель: игрок должен решить, как пробить DMP-зону, не получив summon за спиной.

### ANCHOR PRISM CAGE
- `ANC` тянет/держит игрока.
- `PRS / PLS` крутятся вокруг anchor-core как lane guards.
- `CHG / BNC` ломают выходы из клетки.
- Цель: не просто crossfire, а маленькая control-пазл-комната.

### WARDEN BATTERY WALL
- `WRD` как armor coordinator.
- `TNK / CHG / BNC` могут прийти как linked shell carriers.
- `GRT / RUN` читаются как batteries.
- Иногда `LCH` поддерживает стену.
- Цель: игрок видит shell puzzle, а не случайный жир.

### LEECH BRUISER WALL
- `LCH` держит живыми `TNK / CHG / BNC`.
- `SHT / PLS` добавляют ranged pressure.
- Цель: фронт нужно пробивать/обходить, а не просто кайтить назад.

### SPLITTER HERALD FLOOD
- `HRD` вызывает delayed back-spawn.
- `SPL` создаёт фронтовой flood.
- `RUN / GRT / GLT` усиливают хаос.
- Цель: игрок чувствует два давления — перед собой и за спиной.

### ECHO GLITCH SCRAMBLE
- `ECH` даёт mirror fire.
- `GLT` ломает safe-positioning.
- `BNC / RUN / SHT` добавляют noise pressure.
- Цель: mirror/chaos rooms становятся менее плоскими.

## Новая formation-логика

Для специальных packs добавлена лёгкая `rotary guard` формация:
- `SHT / PRS / PLS` могут получать anchor id;
- они держатся вокруг `DMP`, `HRD` или `ANC` на орбите;
- при этом продолжают стрелять по игроку;
- если anchor умирает, враг возвращается к обычному поведению.

## Enemy role hints

В `ENEMIES` аккуратно добавлены role/combo подсказки:
- `DMP` — bullet-safe nest, лучший protection core для `HRD`;
- `HRD` — summon director, сильнее всего в DMP nest;
- `SHT / PRS / PLS` — ranged/lanes/guards;
- `ANC` — control core;
- `WRD` — armor coordinator;
- `LCH` — sustain support;
- `SPL` — swarm seed;
- `GLT / ECH / BNC` — chaos/scramble роли.

Эти поля не лезут в HUD и не перегружают экран, но остаются в data как дизайн-заметки для будущих патчей.

## Fixes

- В `MIRROR ECHO` убран несуществующий enemy id `seeker` из списка кандидатов; теперь используются только реальные enemy kinds.

## Checks

```txt
node --check server/index.js
node --check shared/*.js
node --check src/*.js
sim import ok
director smoke ok
deep director smoke ok
zip test ok
```
