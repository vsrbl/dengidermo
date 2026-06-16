# nncckkrr.space v2.0.63 — room dossier / encounter grammar

Фокус патча: игрок должен постоянно понимать, **что за комната сейчас**, **что в ней опасно**, **за что она награждает**, и **что ждёт дальше**.

## Room dossier HUD

- Верхний правый блок теперь показывает больше полезной информации:
  - `NOW`: размер комнаты + модификаторы.
  - `DANGER`: численный уровень риска `0–5` + короткий label.
  - `THREAT`: основные угрозы комнаты, например `LANES`, `STATIC LVL 2`, `OVERSTAY HUNTERS`, `ARMOR WALL`.
  - `REWARD`: наградный сигнал, например `GLD↑`, `BET↑`, `SHELL GLD`, `EARLY EXIT`.
  - `TIP`: короткий practical hint под конкретное правило комнаты.

## NEXT room intel

- `NEXT` теперь показывает не только размер/моды, но и:
  - danger level;
  - threat tags;
  - reward tags;
  - tooltip с коротким советом.
- Если следующий Static Rain уже banked/payoff, danger следующей комнаты учитывает этот Static level.

## TAB panel улучшен

- TAB теперь показывает current room dossier и next room dossier:
  - NOW size / danger / threat / reward;
  - NEXT size / danger / threat / reward / tip.
- Это нужно для планирования билда и принятия решений перед порталом.

## Encounter grammar

- Enemy director теперь учитывает room archetype при выборе pack:
  - `PANIC BOX`: чаще swarm/chaos, реже ranged/director.
  - `WIDE FIELD`: чаще ranged/control/director.
  - `LONG LANE`: чаще ranged/control/chaos.
  - `COMPACT`: больше swarm/chaos/armor pressure.
- Дополнительный fit multiplier связывает room modifiers с pack intent:
  - `PRISM GRID` → ranged/control.
  - `ANCHOR GRAVITY` → control/ranged.
  - `SHELL MARKET` → armor/support.
  - `BLOOD TAX` → swarm/chaos.
  - `ECHO WALLS` → mirror/ranged.
  - `STATIC WIRES` → control/ranged.
  - `HUNTED EXIT` → chaos/swarm.

## Room entry feedback

- При входе в комнату banner/feed теперь сообщает:
  - danger;
  - threat tags;
  - reward tags;
  - короткий room tip.

## Проверки

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- smoke imports: `sim`, `audio`, `i18n`
- simulation smoke: start room → step sim → snapshot contains current/next intel
- `unzip -t` архива
