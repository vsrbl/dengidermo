# v2.1.180 — WALL JUMPER

## RU

- Добавлен новый противник **Стеновой прыгун** (`WJP`).
- Появляется в поздних секторах, ползёт по стенам и заранее показывает направление прыжка.
- При перекрытой линии атаки перебирается на другую поверхность вместо движения по полу.
- Учитывает геометрию комнаты, не проваливается в стены и не участвует в обычном раздвигании мобов, пока держится за поверхность.
- После Ассимиляции II Контролёр может перехватить его.
- Подконтрольный WJP сохраняет стеновое движение и атакует угрозы прыжком.
- Добавлены отдельные визуальные состояния, телеграф атаки и описания RU/EN.
- Сетевой протокол обновлён до `7` из-за нового индекса типа врага.

## EN

- Added a new enemy: **Wall Jumper** (`WJP`).
- It appears in later sectors, crawls along walls, and telegraphs its leap direction.
- When the attack line is blocked, it relocates to another surface instead of walking on the floor.
- It respects room geometry, cannot sink into walls, and is excluded from regular enemy separation while attached.
- Process Controller can capture it after Assimilation II.
- A controlled WJP keeps its wall movement and attacks threats with leaps.
- Added dedicated render states, attack telegraph, and RU/EN descriptions.
- Network protocol increased to `7` because the enemy type index table changed.
