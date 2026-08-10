# v2.1.181 — CORE CLEANUP / SPAWN GUARD

## RU

- `FIELD SNAP` больше не наносит урон базовым импульсом или оставленным полем. Стяжка, замедление, торможение вражеских пуль и притягивание предметов сохранены.
- Общий баланс остальных Q-протоколов не менялся.
- Добавлена осторожная проверка точки появления обычных врагов: моб не появляется в изолированном кармане, недоступном игрокам.
- Проверка работает только при выборе точки спавна и не меняет навигацию, стены, геометрию комнат или коллизии.
- Боссы и `WALL JUMPER` сохраняют специальную постановку на арену/стену.
- В игре 6 циклов; первый отображаемый цикл теперь `1`, а не `0`.
- Убраны подсказка при наведении на комбо и режим осмотра по `Space`.
- `СТАВКА СЕКТОРА` переименована в `СТАВКА НА СЛЕДУЮЩИЙ СЕКТОР`.
- В окне INSTALL слева показываются модификаторы следующего сектора. Контракт показывается только тогда, когда он действительно есть.
- Рамки ручных целей Живого казино стали ярче. Метки `LVC/SPK ×2`, `×3` и далее показывают число каналов на цели.
- Если доступна только одна угроза, все свободные каналы Живого казино складываются на ней.
- Захват босса Контролёром получил крупную двойную рамку, прогресс и подпись.
- Описание коррозии уточнено на RU/EN: каждый уровень быстрее разрушает броню. Эффект теперь применяется к урону снарядов по броне.
- `STATIC STORM` удалён из комбо-наград.
- Существующее улучшение `КАНАЛ СПУТНИКОВ`, разрешающее дронам переносить статусы, сохранено без изменения базового поведения дронов.
- Сохранены изменения `v2.1.178–v2.1.180`: двухэтапные активки и `VOID CUT`, `ТРОЯН`, приватные предпросмотры и `WALL JUMPER`.
- Сетевой протокол обновлён до `8`.

## EN

- `FIELD SNAP` no longer deals damage through its initial pulse or lingering field. Pull, slow, enemy-bullet damping, and pickup utility remain intact.
- No global balance changes were made to other Q protocols.
- Added a conservative spawn-point guard for regular enemies: mobs cannot spawn inside isolated pockets unreachable by players.
- The guard only validates spawn selection; pathfinding, walls, room geometry, and collisions are unchanged.
- Bosses and `WALL JUMPER` retain their special arena/wall placement.
- Runs now contain 6 loops; the first displayed loop is `1`, not `0`.
- Removed the combo hover tooltip and the `Space` world-inspect mode.
- `SECTOR WAGER` is now labeled `NEXT-SECTOR WAGER`.
- INSTALL shows next-sector modifiers on the left. A contract line appears only when a contract actually exists.
- Living Casino manual target frames are brighter. `LVC/SPK ×2`, `×3`, and higher labels show the channels stacked on each target.
- If only one threat is available, every free Living Casino channel stacks on it.
- Process Controller boss capture now has a large double frame, progress bar, and label.
- Corrosion text now explains in RU/EN that each stack strips armor faster. Projectile damage against armor now applies that effect.
- `STATIC STORM` was removed from combo rewards.
- The existing `DRONE ELEMENT LINK` upgrade remains the only bridge that lets drones carry weapon statuses; default drone behavior is unchanged.
- Changes from `v2.1.178–v2.1.180` remain intact: two-stage actives and `VOID CUT`, `TROJAN`, private previews, and `WALL JUMPER`.
- Network protocol increased to `8`.

## QA

- JavaScript syntax checked across the full source tree.
- Shared simulation/data/map/protocol modules imported successfully.
- Spawn validation passed 3,840 generated points across all six loops.
- A sealed-pocket fixture was rejected and relocated to the player's reachable component.
- The explicit special-placement bypass was verified for `WALL JUMPER` behavior.
- Patch invariants checked for Field Snap damage, loop count, combo rewards, RU/EN corrosion text, disabled inspect mode, and build version.
