# v2.1.208 — BOSS BAG / TRI / Q SILENCE / CASINO WPN

## RU

- Боссы теперь выбираются случайно из seed-зависимого набора и не повторяются в пределах полного забега из шести боссов.
- В основной набор добавлен TRI — быстрый босс-гусеница из трёх квадратных сегментов:
  - сегменты соединены в подвижную цепь;
  - урон принимает только первый активный квадрат;
  - второй и третий неуязвимы, пока не разрушены предыдущие;
  - 10 быстрых залпов со всех граней сменяются 5 секундами сильно замедленной стрельбы;
  - обычное фоновое подкрепление босс-комнаты сохранено.
- При входе к первому боссу Q заглушается на 30 секунд. Каждый следующий босс добавляет ещё 10 секунд. Оружие, рывок и R продолжают работать.
- Частота повторного урона от линии VOID CUT снижена в 4 раза: `0.18 → 0.72 сек.`
- Казино WPN исправлено:
  - пара WPN даёт только урон оружия: `+14%` на средней и `+24%` на высокой ставке (`+8%` предусмотрено для совместимости с низкой);
  - три WPN дают случайное применимое улучшение из усиленного пула WPN-сундука;
  - результат и история событий показывают весь список полученных WPN-наград, а не только первую строку.
- Сетевой протокол поднят до 15 для сегментов TRI и таймера Q-сайленса.

## EN

- Bosses now come from a seeded shuffled bag and never repeat during the complete six-boss run.
- TRI joins the main pool: a fast three-square crawler boss.
  - Its segments form a flexible moving chain.
  - Only the first active square can take damage.
  - The next squares stay invulnerable until the previous ones are destroyed.
  - Ten rapid all-edge volleys alternate with five seconds of heavily slowed fire.
  - Standard boss-room background reinforcements remain active.
- Entering the first boss room silences Q for 30 seconds. Every later boss adds 10 seconds. Weapons, dash, and R remain available.
- VOID CUT persistent collision ticks are four times less frequent: `0.18 → 0.72s`.
- Casino WPN rules are corrected:
  - A WPN pair grants weapon damage only: `+14%` at mid stake and `+24%` at high stake (`+8%` remains as a low-stake compatibility value).
  - Three WPN symbols grant one random applicable upgrade from the enhanced WPN-chest pool.
  - The result panel and event history now show every WPN reward, not only the first line.
- Network protocol increased to 15 for TRI segment data and the Q-silence timer.
