# TERMINAL CASINO ROGUELIKE — v2.1.210

## TRI boss

- Removed the extra diamond outlines and rotating diamond-like details.
- Preserved the cyan active-section and purple locked-section colors.
- Every square now has its own clearly visible HP bar; TRI no longer displays a shared boss HP bar.
- Damage is limited to the active square and cannot spill into the next section.
- Only the active square fires. Its attack is now the basic boss ten-way radial volley.
- Removed the old per-edge bullets and misleading red circular shot effect.
- Added a strong square-fragment destruction animation, screen response, `SECTION DESTROYED` cue, and layered destruction sound for every section, including the final one.
- Increased TRI movement speed by exactly 15%: `154 → 177.1`.

## ROOM WAGER

- The wager choice has no decision timer and remains open until the player presses **ACCEPT** or **SKIP**.
- INSTALL continues waiting for that explicit decision; the wager is never declined automatically because time passed.
- Added distinct immediate terminal click sounds for **ACCEPT** and **SKIP**.

## Проверка

- Полная регрессия: **30/30 тестов пройдено**.
- Проверены отдельные HP трёх секций, отсутствие переноса урона, все три уничтожения, радиальный залп из активной секции, отсутствие старых красных кругов и ромбов, скорость +15%, вечное окно ставки и звуки обеих кнопок.
- Выполнен визуальный прогон в браузере: TRI отображается тремя прямыми квадратами с отдельными полосками HP; окно ROOM WAGER показывается без таймера и корректно закрывается только после выбора.
