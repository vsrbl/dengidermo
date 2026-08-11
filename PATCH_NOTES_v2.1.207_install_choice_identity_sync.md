# v2.1.207 — INSTALL CHOICE SYNC

## RU

- Исправлен редкий поздний рассинхрон INSTALL: старое сетевое предложение больше не может заменить уже показанный новый набор.
- Выбор теперь проверяется не только по позиции карточки, но и по точному ID показанного улучшения. Сервер не применит другую карточку на том же месте.
- Запоздалое закрытие старого предложения больше не закрывает следующее окно INSTALL.
- После последнего выбора окно INSTALL закрывается сразу. Отдельная ставка следующего сектора больше не выглядит как зависшее ожидание INSTALL.
- Исправлена скрытая ставка поздней комнаты: UI читал неверное поле и падал на отсутствующем языковом помощнике, поэтому карточка не появлялась, хотя её таймер уже шёл. Теперь после INSTALL сразу видны кнопки принять/пропустить, и переход ждёт реального решения.
- Во время подтверждения отображается название выбранного улучшения.
- Проверена очередь из 80 последовательных улучшений поздней игры: позиции, названия, применение и номера предложений остаются синхронными.
- Исправлен WALL JUMPER: он существовал в данных, но отсутствовал во всех наборах директора и был случайно исключён из третьего цикла.
- С третьего цикла появилась отдельная `WALL AMBUSH`. Игра гарантирует хотя бы одну такую засаду за поздний цикл, но только в комнате с валидной стеной.
- WALL JUMPER сразу выбирает реальную поверхность до предупреждения о спавне; комнаты без подходящей стены его не получают.
- Огненные движущиеся стены перепроверены: активная красная зона наносит герою урон по HP, замедляет и показывает попадание; без модификатора эта геометрия безопасна.

## EN

- Fixed a rare late-run INSTALL desync: an old network offer can no longer replace a newer visible set.
- Picks are now validated by both card position and the exact displayed upgrade ID. The server cannot apply another card occupying the same position.
- A delayed close from an older offer can no longer close the next INSTALL window.
- The INSTALL window closes immediately after the final pick. A separate next-room wager no longer looks like a stuck INSTALL wait.
- Fixed the hidden late-room wager: the UI read a nonexistent state field and crashed on a missing language helper, so its timer ran without showing the card. After INSTALL, accept/skip is now visible and room transition waits for the actual decision.
- The selected upgrade name is shown while the node confirms the pick.
- Stress-tested an 80-pick late-run queue for card order, labels, application, and monotonic offer identities.
- Fixed WALL JUMPER: it existed in data but was absent from every director pack and accidentally excluded from the third-cycle pool.
- A dedicated `WALL AMBUSH` now appears from the third cycle onward. At least one is guaranteed per late cycle when a room has a valid wall.
- WALL JUMPER binds to a real surface before its spawn warning; rooms without a valid wall never receive this encounter.
- Rechecked moving fire walls: an active red danger zone damages hero HP, applies its slow, and emits hit feedback; the same geometry is harmless without the modifier.
