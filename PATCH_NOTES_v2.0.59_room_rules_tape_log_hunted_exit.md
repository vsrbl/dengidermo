# nncckkrr.space v2.0.60 — room rules / tape log / hunted exit

## Главная идея

v2.0.58 добавил room identity: музыку, prophecy, invoice, размеры комнат и первые новые modifiers. v2.0.60 делает следующий слой: новые правила комнат должны реально менять бой и оставлять dopamine-след после зачистки.

## Новые room modifiers

### STATIC WIRES

- Новый modifier: `STATIC WIRES`.
- Комната получает 2–4 тонкие static-линии в квадратном terminal-стиле.
- Static wires мягко замедляют игрока, врагов и bullets, которые пересекают линию.
- Линии видны в render как dashed cyan signal wires.
- Лучше всего работает в `LONG LANE` / compact rooms.
- Director чаще подбирает ranged/control packs под этот modifier.

### HUNTED EXIT

- Новый modifier: `HUNTED EXIT`.
- Портал открывается раньше — примерно после 68% quota.
- Игрок может уйти быстро, либо greed-дофармить оставшуюся комнату.
- Если игроки остаются после early portal, комната начинает присылать fast hunter waves: `RUN / CHG / GLT / BNC`.
- Чем дольше overstay, тем жёстче hunter pressure.
- Это даёт понятный выбор: `EXIT NOW` или `GREED MORE`.

## Новые synergy packs

- `STATIC WIRE CROSSFIRE`: static wires + ranged/control mobs.
- `HUNTED EXIT RUSH`: fast hunter pressure для early-exit комнат.

## Tape Log / dopamine hooks

After-room invoice теперь может писать короткие tape-события:

- `NO HIT TAPE`
- `FAST CLEAN`
- `SHELL MARKET REC`
- `GRID DODGED`
- `BLOOD TAX PAID`
- `WIRE GHOST`
- `OVERSTAY SURVIVED`

Это не отдельное меню, а быстрый dopamine-log в `ROOM CHECK`, чтобы комнаты оставляли маленькую историю.

## Маленькие performance rewards

- `NO HIT` теперь даёт небольшой team GLD bonus.
- `FAST CLEAN` теперь даёт небольшой team EXP bonus.
- Бонусы показаны прямо в `ROOM CHECK` как `BONUS GLD` / `BONUS EXP`.
- Бонусы маленькие, чтобы не ломать экономику, но дают приятный micro-reward за хороший clear.

## HUD / audio / render

- `Room prophecy` теперь может показывать `WIRE CTRL` и `EARLY EXIT` reward/risk tags.
- `HUNTED EXIT` даёт отдельный banner/feed сигнал, когда портал открывается рано.
- Adaptive music учитывает `STATIC WIRES` и `HUNTED EXIT`.
- Static wires сериализуются в snapshot и рисуются клиентом.

## Технические проверки

- Обновлены versioned filenames/imports до `v2.0.60`.
- Обновлены `protocol`, `server`, `package`, `index.html` cache query.
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- smoke imports: sim/audio/hud
- smoke generation: found `STATIC WIRES` and `HUNTED EXIT` rooms, snapshot includes wires, early portal opens.
