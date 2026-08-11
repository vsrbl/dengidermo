# TERMINAL CASINO ROGUELIKE — v2.1.209

## RU

### Исправления

- **STATIC STRIKE:** зона предупреждения исчезает точно в момент удара. После урона больше не остаётся ложной области или коллизии.
- **STATIC CORE:** его STATIC STORM сохраняется на протяжении забега, работает и в комнатах боссов и отключается только призом очищения. Одноразовые штормы из CRS, казино и модификаторов больше не смешиваются с постоянным источником.
- **ROOM WAGER:** предложение ставки больше не перекрывает выбор после босса. Оно открывается отдельным окном на 30 секунд, а принятая ставка остаётся видимой до своей комнаты.
- Карточка прокачки больше не появляется у игрока, если у него нет доступного уровня/выбора. Вместо неё при необходимости показывается компактное ожидание других игроков.

### Контракты и INSTALL

- Когда следующей комнате положен контракт, слева от INSTALL предлагаются **три разных контракта** с условием и точным призом.
- Выбранный контракт и его приз больше не меняются после подтверждения.
- Добавлены согласованные призы: **WPN CLEARANCE, ABL CLEARANCE, RAR CLEARANCE, MOD VETO, CREDIT PASS, SALVAGE PROTOCOL**.
- **SALVAGE PROTOCOL:** первые 10 убийств следующей комнаты дают командные GLD/EXP-награды ×5.
- Удалены **SYSTEM OVERCLOCK** и **CLOCK BOOST**.
- Карточки контракта, модификаторов и STATIC STORM появляются последовательно с короткой анимацией и звуком.

### Боссы и сигнатуры

- В одном случайном бою с боссом после первого появляется **ROOT LOCKDOWN**: увеличенная комната и четыре удалённых друг от друга узла. Босс получает урон только после уничтожения всех четырёх.
- **MIRROR PAYOUT** явно добавляет ещё одно применение скопированной R-активке.
- **KILL SWITCH** поддерживает любое накопленное число применений без искусственного лимита и тратит ровно одно за активацию.

### Визуальная синхронизация

- STATIC STORM во всех интерфейсах и казино использует единый фиолетовый цвет CRS.
- Источник и срок действия каждого STATIC STORM понятнее указаны в HUD и INSTALL.

## EN

### Fixes

- **STATIC STRIKE:** its warning disappears exactly on impact; no residual area or collision remains after damage.
- **STATIC CORE:** its STATIC STORM persists for the run, remains active in boss rooms, and ends only after the cleansing reward. Temporary CRS, casino, and modifier storms stay separate.
- **ROOM WAGER:** the wager no longer overlaps the post-boss choice. It gets a separate 30-second window and remains visible after acceptance until its target room.
- Upgrade cards no longer open for players without a pending level or choice; a compact waiting message is used when needed.

### Contracts and INSTALL

- Eligible INSTALL screens now offer **three distinct contracts**, each showing its condition and exact reward.
- The selected contract and reward remain fixed after confirmation.
- Added the agreed rewards: **WPN CLEARANCE, ABL CLEARANCE, RAR CLEARANCE, MOD VETO, CREDIT PASS, SALVAGE PROTOCOL**.
- **SALVAGE PROTOCOL:** the first 10 kills in the next room grant ×5 team GLD/EXP drops.
- Removed **SYSTEM OVERCLOCK** and **CLOCK BOOST**.
- Contract, modifier, and STATIC STORM cards enter sequentially with a short animation and sound.

### Bosses and signatures

- One random post-first boss fight becomes **ROOT LOCKDOWN**: a larger arena with four separated nodes. The boss can take damage only after all four are destroyed.
- **MIRROR PAYOUT** clearly grants one additional use of the copied R active.
- **KILL SWITCH** has no artificial charge cap and consumes exactly one charge per activation.

### Visual consistency

- STATIC STORM now uses the CRS purple color across the HUD and casino.
- HUD and INSTALL labels more clearly identify each STATIC STORM source and duration.

## Verification

- JavaScript syntax: **16/16 files passed**.
- Regression suite: **29/29 tests passed**.
- Covered: contract selection, ROOT LOCKDOWN reachability and unlock, Static Storm source lifetime, Room Wager sequencing, empty upgrade-card guard, MIRROR/KILL SWITCH charges, and zero-residue STATIC STRIKE.
