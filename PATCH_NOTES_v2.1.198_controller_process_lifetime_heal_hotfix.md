# v2.1.198 — CONTROLLER PROCESS LIFETIME HEAL

- `CTRL: ВОЗВРАТ HP` теперь срабатывает не только при боевой гибели процесса.
- Естественное завершение срока контроля освобождает слот и восстанавливает HP герою.
- Истечение того же таймера во время INSTALL также считается завершением срока и выдаёт лечение.
- Уничтожение по HP и самоподрыв подконтрольного бомбера продолжают лечить как раньше.
- Принудительная потеря процесса через ставку/контракт и удаление на переходе не выдают лечение.
- Размер лечения по-прежнему считается от максимального HP завершившегося процесса: 2%, 5%, 9%, 14%, 20% и далее.
- Обновлены короткие RU/EN-описания улучшения.
- Проверены синтаксис и полная регрессия `v2.1.181–v2.1.198`.

## English

- `CTRL HP RETURN` now triggers when a controlled process naturally completes its control lifetime and frees its slot.
- The same lifetime timeout during INSTALL also restores HP.
- HP destruction and controlled bomber self-destruction still qualify; contract release and portal removal do not.
