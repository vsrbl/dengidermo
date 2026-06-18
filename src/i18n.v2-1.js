// terminal casino roguelike i18n + player-facing text cleanup
// RU is the default. ENG can be selected from the menu or HUD.
const KEY = 'nnc_lang_v1';
const LANGS = new Set(['ru', 'en']);
const listeners = new Set();

const RU = {
  ui: {
    langTitle: 'ЯЗЫК', langBody: 'Меняет язык интерфейса, подсказок, меню и игровых сообщений.',
    versionTitle: 'ВЕРСИЯ', versionBody: 'Текущая версия игры. Для совместной игры у всех должна быть одна версия.',
    roomTitle: 'КОМНАТА', roomBody: 'Код комнаты и текущая локация забега.',
    loopTitle: 'ЦИКЛ / ГЛУБИНА', loopBody: 'Глубина — пройденные комнаты. Цикл делает комнаты опаснее.',
    modsTitle: 'ПРАВИЛА КОМНАТЫ', modsBody: 'Активные модификаторы этой комнаты. Наведи курсор на подчёркнутое название модификатора, чтобы увидеть подробное правило.',
    inspectTitle: 'ОСМОТР', inspectBody: 'Пробел включает подсказки у объектов мира: сундуков, портала, врагов, подборов и BET-терминала.',
    objectiveTitle: 'ЗАДАЧА', objectiveBody: 'Текущая задача комнаты: зачистка, босс, контракт или переход через портал.',
    hpTitle: 'ЗДОРОВЬЕ', hpBody: 'Если здоровье падает до 0, игрок выбывает до следующей комнаты или перезапуска.',
    xpTitle: 'ОПЫТ', xpBody: 'Опыт копит уровни. Повышение уровня добавляет INSTALL-выбор между комнатами.',
    gldTitle: 'GLD', gldBody: 'Деньги для сундуков и BET-терминала. Обычный подбор GLD общий для команды, траты индивидуальные.',
    lvlTitle: 'УРОВЕНЬ / Q', lvlBody: 'Текущий уровень и статус активной способности Q.',
    installTitle: 'INSTALL', installBody: 'Очередь апгрейдов. Выбор появляется между комнатами.',
    interactTitle: 'ВЗАИМОДЕЙСТВИЕ', interactBody: 'Подойди и нажми E. Здесь показываются сундуки, BET-терминал и портал.',
    runStatusTitle: 'ПАНЕЛЬ ЗАБЕГА', runStatusBody: 'Состояние забега: цикл, глубина, правила комнаты, союзники и ресурсы.',
    installPickBody: 'Выбери один из трёх апгрейдов. Если накоплено несколько INSTALL, выборы идут по очереди.',
    quickPickTitle: 'БЫСТРЫЙ ВЫБОР', quickPickBody: 'Клавиши 1, 2 и 3 выбирают соответствующий вариант.',
    choose: 'выбрать', chooseAvailable: 'выбрать доступный вариант', chooseOption: 'выбрать вариант',
    wpnChestTitle: 'WPN-СУНДУК', wpnChestBody: 'Выбери одну награду: новое оружие, оружейный мод или усиление оружия. Серый вариант требует другое оружие.',
    ablChestTitle: 'ABL-СУНДУК', ablChestBody: 'Выбери одну награду: Q-активку, мутацию Q, усиление Q или мобильность.',
    betTitle: 'BET-ТЕРМИНАЛ', betBody: 'Риск за GLD: ставка списывается, барабаны крутятся, результат даёт награду или опасность.',
    lowBetBody: 'Ставка 20 GLD. Низкий риск для начала забега.',
    midBetBody: 'Ставка 50 GLD. Средний риск и ощутимая награда.',
    highBetBody: 'Ставка 120 GLD. Большой риск и шанс на сильный результат.',
    betHintTitle: 'СТАВКА', betHintBody: 'Клавиши 1, 2 и 3 запускают LOW, MID или HIGH ставку.',
    exitTitle: 'ВЫХОД', exitBody: 'ESC закрывает казино, если барабаны не крутятся.',
    menuSub: 'terminal casino // 4 players coop',
    musicLabel: 'МУЗЫКА', sfxLabel: 'ЗВУКИ', filterLabel: 'ФИЛЬТР', filterBody: 'Цифровая обработка экрана.', changeSkin: 'СМЕНИТЬ СКИН', hideSkins: 'СКРЫТЬ СКИНЫ',
    namePlaceholder: 'ИМЯ', nameTitle: 'ИМЯ', nameBody: 'Имя игрока в комнате и TAB-панели. До 12 символов.',
    solo: 'СОЛО', soloBody: 'Запускает локальный забег без сети. Удобно для тренировки и быстрой игры.',
    create: 'СОЗДАТЬ КОМНАТУ', createBody: 'Создаёт co-op комнату для друзей. Поделись четырёхсимвольным кодом.',
    codePlaceholder: 'КОД', codeTitle: 'КОД КОМНАТЫ', codeBody: 'Четырёхсимвольный код комнаты друга.',
    join: 'ВОЙТИ', joinBody: 'Подключиться к комнате по коду.',
    controlsTitle: 'УПРАВЛЕНИЕ', controlsBody: 'WASD/стрелки — движение · ЛКМ — огонь · ПКМ — вторичный огонь оружия · Пробел — осмотр · Shift — рывок · E — взаимодействие · Q — активка · TAB — панель',
    movement: 'движение', fire: 'огонь', dash: 'рывок', interact: 'взаимодействие', qActive: 'активка', panel: 'панель', inspect: 'осмотр',
    skinTitle: 'СКИН', skinBody: 'Готовые облики. Закрытые видны, но выбрать их нельзя до открытия.',
    prevSkinTitle: 'ПРЕДЫДУЩИЙ СКИН', prevSkinBody: 'Листать назад.', nextSkinTitle: 'СЛЕДУЮЩИЙ СКИН', nextSkinBody: 'Листать вперёд.',
    skinPreset: 'готовый облик', selected: 'ВЫБРАН', unlocked: 'ОТКРЫТ', locked: 'ЗАКРЫТ',
    statusConnecting: 'CONNECTING…', statusOnline: 'ONLINE', statusNetReady: 'NETWORK READY', statusNetSleep: 'NETWORK WAKING · SOLO READY', statusNetDown: 'NETWORK UNAVAILABLE · SOLO READY',
    updateRequired: 'UPDATE REQUIRED: REFRESH PAGE', roomCode4: 'ROOM CODE MUST BE 4 SYMBOLS', roomNotFound: 'ROOM NOT FOUND', roomFull: 'ROOM FULL (4/4)', lostConnection: 'CONNECTION LOST — REFRESH PAGE',
    noActive: 'НЕТ АКТИВКИ', noActiveDesc: 'У тебя пока нет Q-способности. Найди ABL-сундук и выбери активку.', qNoneShort: 'Q — НЕТ', qNoneLong: 'Q — НЕТ АКТИВКИ', qCd: 'Q CD', qOver: 'Q OVERCLOCK', activeQTitle: 'АКТИВНАЯ СПОСОБНОСТЬ Q', activeQUse: 'Нажми Q, чтобы активировать.',
    dashChargeTitle: 'ЗАРЯД РЫВКА', dashReady: 'Готовый заряд рывка. Shift — рывок.', dashEmpty: 'Пустой заряд рывка скоро восстановится.',
    portalTitle: 'ПОРТАЛ', portalOpenBody: 'Открытый переход: нажми E рядом, чтобы перейти дальше.', portalClosedBody: 'Портал закрыт. Выполни цель комнаты.', portalPrompt: 'E — ВОЙТИ В ПОРТАЛ', portalOpen: 'ПОРТАЛ ОТКРЫТ', portalTake: 'E — забрать скин', portalNext: 'E — перейти дальше',
    chestTitle: 'СУНДУК', chestDefault: 'Сундук с наградой.', chestOpened: 'Уже открыт.', chestFree: 'Бесплатно.', chestNeed: 'Нужно {cost} GLD.', price: 'Цена: {cost} GLD.',
    betPrompt: 'E — BET TERMINAL', betInspect: 'Казино-терминал: E открывает ставки LOW/MID/HIGH. Чем дальше забег, тем дороже риск.',
    gldLack: 'НЕДОСТАТОЧНО GLD', denied: 'ОТКАЗ', noQ: 'НЕТ АКТИВКИ',
    installPhase: 'INSTALL-ФАЗА', installPhaseSub: 'выбор апгрейдов', bossFloor: 'ЭТАЖ БОССА', killBoss: 'УНИЧТОЖИТЬ БОССА', clear: 'ЗАЧИСТКА',
    playerJoined: 'ПОДКЛЮЧИЛСЯ', playerLeft: 'ВЫШЕЛ', you: 'ТЫ', down: 'ВЫБЫЛ', youDown: 'ТЫ ВЫБЫЛ', carry: 'союзники дотащат до портала',
    eventSignal: 'СИГНАЛ', wave: 'ВОЛНА', skinHidden: 'В КОМНАТЕ СПРЯТАН СКИН', skinReady: 'СКИН В ОКНЕ УЛУЧШЕНИЙ', bossDown: 'БОСС УНИЧТОЖЕН', loot: 'забирай лут',
    contract: 'КОНТРАКТ', contractBody: 'условие комнаты активно', contractDone: 'КОНТРАКТ ВЫПОЛНЕН', contractDoneBody: 'условие выполнено; приз появится после комнаты', contractPaid: 'ПРИЗ ПОЛУЧЕН', contractPaidBody: 'контракт выдал приз', contractFail: 'КОНТРАКТ ПРОВАЛЕН', contractFailBody: 'награды нет',
    runLost: 'ЗАБЕГ ПРОВАЛЕН', restart: 'перезапуск…', noResponse: 'НЕТ ОТВЕТА — СТАВКА НЕ ПОДТВЕРЖДЕНА', betFailed: 'СТАВКА НЕ ПРИНЯТА', invalidStake: 'НЕВЕРНАЯ СТАВКА', jackpot: 'ДЖЕКПОТ', lose: 'проигрыш', staticDebt: 'СТАТИК-ШТОРМ', skin: 'СКИН', nextRoomDebt: 'СТАТИК-ШТОРМ → СЛЕД. КОМНАТА',
    loop: 'LOOP', depth: 'DEPTH', room: 'КОМНАТА', code: 'КОД', goal: 'ЗАДАЧА', rules: 'ПРАВИЛА', player: 'ИГРОК', health: 'ЗДОРОВЬЕ', level: 'УРОВЕНЬ', money: 'ДЕНЬГИ', drones: 'ДРОНЫ', orbitals: 'ОРБИТАЛИ', qAbility: 'АКТИВКА Q', eliminated: 'ВЫБЫЛ',
    available: 'Можно выбрать.', unavailable: 'Недоступно', requiresOtherWeapon: 'требуется другое оружие', upgradeFallback: 'Усиление персонажа.', weaponRewardFallback: 'Награда оружейного сундука.', abilityRewardFallback: 'Награда сундука способностей.'
  }
};

const EN = {
  ui: {
    langTitle: 'LANGUAGE', langBody: 'Changes UI, tooltips, menus, and in-game messages.',
    versionTitle: 'VERSION', versionBody: 'Current game version. Co-op players should use the same version.',
    roomTitle: 'ROOM', roomBody: 'Room code and current run location.',
    loopTitle: 'LOOP / DEPTH', loopBody: 'Depth is cleared rooms. Loop makes rooms more dangerous.',
    modsTitle: 'ROOM RULES', modsBody: 'Active modifiers in this room. Hover an underlined modifier name to see the exact rule.',
    inspectTitle: 'INSPECT', inspectBody: 'Space toggles hints on world objects: chests, portal, enemies, pickups, and BET terminal.',
    objectiveTitle: 'OBJECTIVE', objectiveBody: 'Current room objective: clear, boss, or portal transition.',
    hpTitle: 'HEALTH', hpBody: 'If health reaches 0, the player is down until the next room or restart.',
    xpTitle: 'EXP', xpBody: 'EXP builds levels. Level-ups add INSTALL choices between rooms.',
    gldTitle: 'GLD', gldBody: 'Money for chests and BET terminal. Normal GLD pickup is shared by the team; spending is individual.',
    lvlTitle: 'LEVEL / Q', lvlBody: 'Current level and Q active ability status.',
    installTitle: 'INSTALL', installBody: 'Upgrade queue. Choices appear between rooms.',
    interactTitle: 'INTERACT', interactBody: 'Move close and press E. Shows chests, BET terminal, and portal.',
    runStatusTitle: 'RUN STATUS', runStatusBody: 'Run overview: loop, depth, room rules, allies, and resources.',
    installPickBody: 'Choose one of three upgrades. If you have several INSTALL choices, they appear one by one.',
    quickPickTitle: 'QUICK PICK', quickPickBody: 'Keys 1, 2, and 3 pick the matching option.',
    choose: 'choose', chooseAvailable: 'choose available option', chooseOption: 'choose option',
    wpnChestTitle: 'WPN CHEST', wpnChestBody: 'Choose one reward: new weapon, weapon mod, or weapon power. Grey options require another weapon.',
    ablChestTitle: 'ABL CHEST', ablChestBody: 'Choose one reward: Q active, Q mutation, Q power, or mobility.',
    betTitle: 'BET TERMINAL', betBody: 'Risk GLD: pay a stake, spin reels, and get a reward or danger.',
    lowBetBody: 'Stake 20 GLD. Low risk for early runs.',
    midBetBody: 'Stake 50 GLD. Medium risk and better reward.',
    highBetBody: 'Stake 120 GLD. High risk and a chance for stronger results.',
    betHintTitle: 'BET', betHintBody: 'Keys 1, 2, and 3 start LOW, MID, or HIGH bet.',
    exitTitle: 'EXIT', exitBody: 'ESC closes casino when reels are not spinning.',
    menuSub: 'terminal casino // 4 players coop',
    musicLabel: 'MUSIC', sfxLabel: 'SFX', filterLabel: 'FILTER', filterBody: 'Digital screen treatment.', changeSkin: 'CHANGE SKIN', hideSkins: 'HIDE SKINS',
    namePlaceholder: 'NAME', nameTitle: 'NAME', nameBody: 'Player name in room and TAB panel. Up to 12 characters.',
    solo: 'SOLO', soloBody: 'Starts a local run without network. Good for practice and quick play.',
    create: 'CREATE ROOM', createBody: 'Creates a co-op room for friends. Share the four-symbol code.',
    codePlaceholder: 'CODE', codeTitle: 'ROOM CODE', codeBody: 'Four-symbol room code from a friend.',
    join: 'JOIN', joinBody: 'Join a room by code.',
    controlsTitle: 'CONTROLS', controlsBody: 'WASD/arrows — move · LMB — fire · RMB — weapon secondary fire · Space — inspect · Shift — dash · E — interact · Q — active · TAB — panel',
    movement: 'move', fire: 'fire', dash: 'dash', interact: 'interact', qActive: 'active', panel: 'panel', inspect: 'inspect',
    skinTitle: 'SKIN', skinBody: 'Preset skins. Locked skins are visible, but cannot be selected until unlocked.',
    prevSkinTitle: 'PREVIOUS SKIN', prevSkinBody: 'Browse backward.', nextSkinTitle: 'NEXT SKIN', nextSkinBody: 'Browse forward.',
    skinPreset: 'preset skin', selected: 'SELECTED', unlocked: 'UNLOCKED', locked: 'LOCKED',
    statusConnecting: 'CONNECTING…', statusOnline: 'ONLINE', statusNetReady: 'NETWORK READY', statusNetSleep: 'NETWORK WAKING · SOLO READY', statusNetDown: 'NETWORK UNAVAILABLE · SOLO READY',
    updateRequired: 'UPDATE REQUIRED: REFRESH PAGE', roomCode4: 'ROOM CODE MUST BE 4 SYMBOLS', roomNotFound: 'ROOM NOT FOUND', roomFull: 'ROOM FULL (4/4)', lostConnection: 'CONNECTION LOST — REFRESH PAGE',
    noActive: 'NO ACTIVE', noActiveDesc: 'You do not have a Q ability yet. Find an ABL chest and choose one.', qNoneShort: 'Q — NONE', qNoneLong: 'Q — NO ACTIVE', qCd: 'Q CD', qOver: 'Q OVERCLOCK', activeQTitle: 'Q ACTIVE ABILITY', activeQUse: 'Press Q to activate.',
    dashChargeTitle: 'DASH CHARGE', dashReady: 'Ready dash charge. Shift — dash.', dashEmpty: 'Empty dash charge, will recover soon.',
    portalTitle: 'PORTAL', portalOpenBody: 'Open transition: press E nearby to go deeper.', portalClosedBody: 'Portal is closed. Finish the room objective.', portalPrompt: 'E — ENTER PORTAL', portalOpen: 'PORTAL OPEN', portalTake: 'E — take skin', portalNext: 'E — go deeper',
    chestTitle: 'CHEST', chestDefault: 'Reward chest.', chestOpened: 'Already opened.', chestFree: 'Free.', chestNeed: 'Need {cost} GLD.', price: 'Cost: {cost} GLD.',
    betPrompt: 'E — BET TERMINAL', betInspect: 'Casino terminal: E opens LOW/MID/HIGH bets. Risk gets more expensive deeper into the run.',
    gldLack: 'NOT ENOUGH GLD', denied: 'DENIED', noQ: 'NO ACTIVE',
    installPhase: 'INSTALL PHASE', installPhaseSub: 'upgrade selection', bossFloor: 'BOSS FLOOR', killBoss: 'DESTROY THE BOSS', clear: 'CLEAR',
    playerJoined: 'JOINED', playerLeft: 'LEFT', you: 'YOU', down: 'DOWN', youDown: 'YOU ARE DOWN', carry: 'allies can reach the portal',
    eventSignal: 'SIGNAL', wave: 'WAVE', skinHidden: 'HIDDEN SKIN IN THIS ROOM', skinReady: 'SKIN READY', bossDown: 'BOSS DESTROYED', loot: 'take the loot',
    contract: 'CONTRACT', contractBody: 'room condition is active', contractDone: 'CONTRACT DONE', contractDoneBody: 'completed; prize appears after the room', contractPaid: 'PRIZE RECEIVED', contractPaidBody: 'contract prize granted', contractFail: 'CONTRACT FAILED', contractFailBody: 'no reward',
    runLost: 'RUN FAILED', restart: 'restarting…', noResponse: 'NO ANSWER — BET NOT CONFIRMED', betFailed: 'BET NOT ACCEPTED', invalidStake: 'INVALID STAKE', jackpot: 'JACKPOT', lose: 'loss', staticDebt: 'STATIC STORM', skin: 'SKIN', nextRoomDebt: 'STATIC STORM → NEXT ROOM',
    loop: 'LOOP', depth: 'DEPTH', room: 'ROOM', code: 'CODE', goal: 'GOAL', rules: 'RULES', player: 'PLAYER', health: 'HEALTH', level: 'LEVEL', money: 'MONEY', drones: 'DRONES', orbitals: 'ORBITALS', qAbility: 'Q ACTIVE', eliminated: 'DOWN',
    available: 'Available.', unavailable: 'Unavailable', requiresOtherWeapon: 'requires another weapon', upgradeFallback: 'Character upgrade.', weaponRewardFallback: 'Weapon chest reward.', abilityRewardFallback: 'Ability chest reward.'
  }
};

const M = { ru: RU, en: EN };

const EN_UPGRADE = {
  dmg: 'All outgoing damage increases.', fire: 'Weapons fire more often.', spd: 'Movement speed increases.', maxhp: 'Maximum health increases.', magnet: 'Pickups are pulled from farther away.', dash: 'Adds one dash charge.', drone: 'Adds an auto-firing drone.', orbital: 'Adds an orbital that damages on contact.', luck: 'Better upgrade and casino outcomes.', proc: 'Bullet hits can create a small blast.', echo: 'Sometimes fires an extra shot.', leech: 'Damage can return health.', goldgun: 'Enemies drop more GLD.',
  bullet_ricochet: 'Projectiles bounce off walls one more time.', bullet_range: 'Projectiles travel farther and last longer.', bullet_fire: 'Bullets burn enemies.', bullet_freeze: 'Bullets chill enemies and can briefly stop them.', bullet_poison: 'Bullets poison enemies.', drone_element_link: 'Drones carry your weapon elements.', element_amp: 'Fire, cold, and poison become stronger.', element_spread: 'Enemy deaths can spread status to nearby targets.', bullet_chain: 'Weapon hits can link damage to another nearby enemy.', shg_teeth: 'SHG fires more pellets.', shg_longshot: 'RMB spends loaded SHG charges on one heavy long shot.', sek_split: 'SEK kills release homing fragments.', sek_chain: 'SEK locks on harder and flies longer.', sek_swarm: 'RMB releases a homing bullet swarm.', rkt_cluster: 'RKT explosions create extra mini-blasts.', rkt_mines: 'RKT leaves delayed mines during flight.', rkt_stun: 'RKT explosions can stun enemies.', rkt_scatter: 'RKT explosions throw enemies farther.', rkt_remote: 'RMB detonates launched rockets one by one.', wpn_dmg: 'All weapon damage increases.', wpn_fire: 'All weapons fire more often.',
  abl_dash: 'Adds one dash charge.', abl_voidstep: 'Dash leaves a damaging void rift along its path.', voidstep: 'Dash leaves a damaging void rift along its path.', dashcut: 'Dash stuns enemies near its path.', dashclone: 'Dash leaves a short damaging aftershock at its start point.', abl_dashcut: 'Dash stuns enemies near its path.', abl_dashclone: 'Dash leaves a short damaging aftershock at its start point.', abl_speed: 'Movement speed increases.', abl_dashflow: 'Dash charges recover faster.',
  q_snap: 'Q pulls enemies inward and deals damage.', q_blood: 'Q spends HP for a red square blast.', q_over: 'Q briefly speeds up your weapon fire.',
  droneproc: 'Drone bullets can create small blasts.', orbreflect: 'Orbitals still seek nearby enemies. When enemy bullets pass close, they intercept them too.', debtengine: 'Great power and luck. Combat rooms gain extra Static Storm pressure.', overload: 'Much more damage, but lower maximum HP.', gamble: 'More luck, but lower movement speed.'
};
const RU_UPGRADE_CLEAN = {
  dmg: 'Весь исходящий урон растёт.', fire: 'Оружие стреляет чаще.', spd: 'Скорость движения растёт.', maxhp: 'Максимальное здоровье растёт.', magnet: 'Подборы притягиваются с большего расстояния.', dash: 'Добавляет один заряд рывка.', drone: 'Добавляет автостреляющего дрона.', orbital: 'Добавляет орбиталь, которая бьёт ближайших врагов.', orb_speed: 'Орбитали быстрее тянутся к угрозам.', orb_range: 'Орбитали замечают врагов и пули дальше.', luck: 'Лучше исходы апгрейдов и казино.', proc: 'Попадания пуль могут создавать маленький взрыв.', echo: 'Иногда появляется дополнительный выстрел.', leech: 'Часть нанесённого урона возвращает здоровье.', goldgun: 'Враги дают больше GLD при смерти.',
  voidstep: 'Рывок оставляет по траектории опасный разрез пустоты.', abl_voidstep: 'Рывок оставляет по траектории опасный разрез пустоты.', dashcut: 'Рывок оглушает врагов рядом с траекторией.', dashclone: 'После рывка в точке старта остаётся короткий ударный след.', abl_dashcut: 'Рывок оглушает врагов рядом с траекторией.', abl_dashclone: 'После рывка в точке старта остаётся короткий ударный след.',
  q_snap: 'Q стягивает врагов и наносит урон.', q_blood: 'Q тратит HP на красный сигнальный взрыв.', q_over: 'Q ненадолго ускоряет стрельбу.',
  bullet_chain: 'Попадание оружием может связать урон с ближайшим врагом.', drone_element_link: 'Дроны переносят огонь, холод и яд оружия.', element_spread: 'Статусы с убитых врагов переходят на ближайшие цели.', bullet_ricochet: 'Снаряды получают дополнительный отскок от стен.', bullet_range: 'Снаряды летят дальше и живут дольше.', bullet_fire: 'Пули поджигают врагов.', bullet_freeze: 'Пули охлаждают врагов и могут коротко остановить их.', bullet_poison: 'Пули отравляют врагов.', element_amp: 'Огонь, холод и яд становятся сильнее.',
  shg_teeth: 'SHOTGUN получает больше дробин.', shg_longshot: 'ПКМ тратит заряды SHOTGUN на один дальний тяжёлый выстрел.', sek_split: 'Убийства SEEKER выпускают самонаводящиеся фрагменты.', sek_chain: 'SEEKER лучше держит цель и летит дольше.', sek_swarm: 'ПКМ выпускает рой самонаводящихся SEEKER-пуль.', rkt_cluster: 'ROCKETGUN добавляет мини-взрывы вокруг детонации.', rkt_mines: 'ROCKETGUN оставляет отложенные мины во время полёта.', rkt_stun: 'Взрывы ROCKETGUN могут оглушать врагов.', rkt_scatter: 'Взрывы ROCKETGUN сильнее разбрасывают врагов.', rkt_remote: 'ПКМ взрывает выпущенные ракеты по одной.',
  wpn_dmg: 'Повышает прямой урон всего оружия.', wpn_fire: 'Всё оружие стреляет чаще.', abl_dash: 'Добавляет один заряд рывка.', abl_speed: 'Скорость движения растёт.', abl_dashflow: 'Заряды рывка восстанавливаются быстрее.',
  droneproc: 'Пули дронов могут создавать маленькие взрывы.', orbreflect: 'Орбитали всё ещё тянутся к врагам, а рядом с вражескими пулями перехватывают их.', debtengine: 'Большой урон и удача. Боевые комнаты получают больше статик-давления.', overload: 'Сильно повышает урон, но снижает максимум HP.', gamble: 'Даёт больше удачи, но снижает скорость движения.'
};
const EN_CORE = {
  blood_ring: 'Follows you as a red square ring. Enemies inside keep taking blood damage.',
  field_snap: 'Pulls enemies and pickups inward, then leaves a short slowing field that weakens bullets.',
  bullet_freeze: 'Cold aura follows you. Enemies freeze, and enemy bullets almost stop.',
  shell_ripper: 'Breaks enemy protection and exposes targets to extra damage.',
  void_cut: 'Fires a thin void beam toward your aim. The beam cuts through enemies in a line.',
  signal_spike: 'Places a square signal spike at your aim point. The area slows enemies and jams bullets.',
  black_box: 'Hides you inside a black square. Enemies outside lose your signal.',
  debt_pulse: 'A red static blast around you. It exposes enemies and may call a Static Storm.'
};
const EN_MUT = {
  static: 'Q leaves a static field that slows enemies and bullets.', blood: 'Q gains extra blood damage. Some uses may cost HP.', echo: 'Q leaves a weaker echo after a short pause.', shrapnel: 'Q releases extra bullets from the impact point.', casino: 'Q can trigger a small casino check: reward, repeat, or danger.', void: 'Q gives a short invulnerable phase window.', leech: 'Q hits can return HP or GLD.', armor_crack: 'Q breaks enemy protection harder.', anchor: 'Q leaves a heavy square that pulls enemies and slows bullets.', hunger: 'Q creates a hunger zone. More enemies inside it feed a stronger final digital bite.', bad_tape: 'Q leaves two unstable glitch echoes.'
};

const RU_CORE = {
  blood_ring: 'Красное кольцо следует за тобой. Урон: средний частыми импульсами; высокий, если враг долго стоит внутри.',
  field_snap: 'Стягивает врагов и подборы к тебе, затем оставляет короткое поле, которое замедляет и глушит пули.',
  bullet_freeze: 'Холодная аура следует за тобой. Враги замирают, вражеские пули почти останавливаются.',
  shell_ripper: 'Ломает защиту врагов и делает их уязвимее.',
  void_cut: 'Пускает тонкий луч по прицелу. Луч режет врагов по линии.',
  signal_spike: 'Ставит сигнальный шип в точке прицела. Зона замедляет врагов и глушит пули.',
  black_box: 'Прячет тебя в чёрной области. Враги снаружи теряют твой сигнал.',
  debt_pulse: 'Красный статик-взрыв вокруг тебя. Ослабляет врагов и может вызвать статик-шторм.'
};
const RU_MUT = {
  static: 'Q оставляет статик-поле, которое замедляет врагов и пули.', blood: 'Q получает дополнительный кровавый урон. Некоторые применения могут стоить HP.', echo: 'Q оставляет слабое эхо после короткой паузы.', shrapnel: 'Q выпускает дополнительные пули из точки удара.', casino: 'Q может запустить маленькую казино-проверку: награда, повтор или опасность.', void: 'Q даёт короткое окно неуязвимости.', leech: 'Попадания Q могут вернуть HP или GLD.', armor_crack: 'Q сильнее ломает защиту врагов.', anchor: 'Q оставляет тяжёлую область, которая тянет врагов и тормозит пули.', hunger: 'Q создаёт зону голода. Чем больше врагов внутри, тем сильнее финальный цифровой укус.', bad_tape: 'Q создаёт два слабых глючных повтора.'
};
const EN_ROLE = { 'FOLLOW DAMAGE':'FOLLOW DAMAGE', 'PULL / CONTROL':'PULL / CONTROL', 'FREEZE / CONTROL':'FREEZE / CONTROL', 'ARMOR / EXPOSE':'ARMOR / EXPOSE', 'THIN LASER':'THIN LASER', 'BUILD LASER':'BUILD LASER', 'DEPLOY NODE':'DEPLOY NODE', 'STEALTH / SAFE':'STEALTH / SAFE', 'RISK BURST':'RISK BURST', FIELD:'FIELD', DAMAGE:'DAMAGE', RECAST:'RECAST', BULLETS:'BULLETS', 'POST-ROLL':'POST-ROLL', PHASE:'PHASE', SUSTAIN:'SUSTAIN', SHELL:'SHELL', 'LOCK ZONE':'LOCK ZONE', SCALING:'SCALING', 'CHARGE BITE':'CHARGE BITE', 'GLITCH REPEAT':'GLITCH REPEAT' };
const RU_ROLE = { 'FOLLOW DAMAGE':'УРОН РЯДОМ', 'PULL / CONTROL':'СТЯЖКА / КОНТРОЛЬ', 'FREEZE / CONTROL':'ЗАМОРОЗКА / КОНТРОЛЬ', 'ARMOR / EXPOSE':'ЗАЩИТА / УЯЗВИМОСТЬ', 'THIN LASER':'ТОНКИЙ ЛУЧ', 'BUILD LASER':'ЛУЧ / ЗВЕНЬЯ', 'DEPLOY NODE':'УСТАНОВКА УЗЛА', 'STEALTH / SAFE':'СКРЫТИЕ / БЕЗОПАСНОСТЬ', 'RISK BURST':'РИСКОВЫЙ ВЗРЫВ', FIELD:'ПОЛЕ', DAMAGE:'УРОН', RECAST:'ПОВТОР', BULLETS:'ПУЛИ', 'POST-ROLL':'ПОСЛЕ Q', PHASE:'ФАЗА', SUSTAIN:'ВЫЖИВАНИЕ', SHELL:'ЩИТЫ', 'LOCK ZONE':'ЗОНА КОНТРОЛЯ', SCALING:'НАКОПЛЕНИЕ', 'CHARGE BITE':'НАКОПЛЕНИЕ / УКУС', 'GLITCH REPEAT':'ГЛИТЧ-ПОВТОР' };
const EN_ACTION = { 'ЗАМЕНИТЬ CORE':'REPLACE Q', 'УСТАНОВИТЬ CORE':'INSTALL Q', 'УСИЛИТЬ CORE':'UPGRADE Q', 'ЗАМЕНИТЬ Q':'REPLACE Q', 'УСТАНОВИТЬ Q':'INSTALL Q', 'УСИЛИТЬ Q':'UPGRADE Q', 'ЗАМЕНИТЬ МУТАЦИЮ':'REPLACE MUTATION', 'ДОБАВИТЬ МУТАЦИЮ':'ADD MUTATION', 'SIDE UPGRADE':'SIDE UPGRADE' };
const RU_ACTION = { 'REPLACE CORE':'ЗАМЕНИТЬ Q', 'INSTALL CORE':'УСТАНОВИТЬ Q', 'UPGRADE CORE':'УСИЛИТЬ Q', 'REPLACE Q':'ЗАМЕНИТЬ Q', 'INSTALL Q':'УСТАНОВИТЬ Q', 'UPGRADE Q':'УСИЛИТЬ Q', 'REPLACE MUTATION':'ЗАМЕНИТЬ МУТАЦИЮ', 'ADD MUTATION':'ДОБАВИТЬ МУТАЦИЮ', 'SIDE UPGRADE':'ДОП. УСИЛЕНИЕ' };

const EN_CHEST = {
  BSC: 'Free basic chest: GLD, EXP, and sometimes HEA.', WPN: 'Weapon chest: choose a weapon, weapon mod, or weapon stat boost.', ABL: 'Ability chest: Q active, Q upgrade, Q mutation, or mobility.', RAR: 'Rare chest: stronger build upgrade.', CRS: 'Cursed chest: strong reward, but the run becomes more dangerous.'
};
const RU_CHEST = {
  BSC: 'Бесплатный базовый сундук: GLD, EXP и иногда HEA.', WPN: 'Оружейный сундук: оружие, мод или усиление оружия.', ABL: 'Сундук способностей: активка Q, улучшение Q, мутация или мобильность.', RAR: 'Редкий сундук: сильный апгрейд.', CRS: 'Проклятый сундук: сильная награда, но забег становится опаснее.'
};
const EN_PICKUP = { GLD: 'Money for chests and BET. Shared by the team.', EXP: 'Experience toward the next level. INSTALL choices appear between rooms.', HEA: 'Healing pickup. Restores health to the collector.' };
const RU_PICKUP = { GLD: 'Деньги для сундуков и BET. Обычный GLD делится с командой.', EXP: 'Опыт для уровней. Апгрейды появляются между комнатами.', HEA: 'Лечение. Восстанавливает здоровье тому, кто подобрал.' };
const EN_ENEMY = {
  grunt:'Basic chaser with contact damage.', runner:'Fast weak enemy that breaks your position.', tank:'Slow armored wall that soaks damage.', shooter:'Ranged enemy that shoots red projectiles.', charger:'Winds up, then charges in a straight line.', bomber:'Arms a fuse and explodes. Leave the radius.', bouncer:'Pinball enemy that bounces and shoves.', glitch:'Blink attacker that strikes from odd angles.', echo:'Mimic enemy: fires familiar shots from a distance.', orbiter:'Mobile guard with front shield.', anchor:'Control anchor that pulls and slows.', splitter:'Splits into smaller fast enemies on death.', prism:'Fires split prism lanes.', pulse:'Fires forward square-wave pressure.', leech:'Heals wounded enemies. Priority target.', herald:'Summons swarms behind pressure lines.', warden:'Coordinates shell armor links.', damper:'Slow mobile field that stops bullets and shelters nearby enemies.', boss:'Boss floor enemy with bursts and adds.'
};
const RU_ENEMY = {
  grunt:'Базовый преследователь с контактным уроном.', runner:'Быстрый слабый враг, ломает позицию.', tank:'Медленный бронированный враг-стена.', shooter:'Дальний враг, стреляет красными снарядами.', charger:'Готовится, затем делает рывок по линии.', bomber:'Готовится к взрыву. Уходи из радиуса.', bouncer:'Отскакивающий враг: толкает и ломает позицию.', glitch:'Мигающий враг: телепортируется и бьёт.', echo:'Враг-копия: стреляет оружием выбранного игрока, но медленнее и с дистанции.', orbiter:'Подвижный защитник с фронтальным щитом.', anchor:'Ядро контроля: тянет и замедляет.', splitter:'После смерти делится на мелких врагов.', prism:'Стреляет призменными линиями.', pulse:'Давит областьной волной.', leech:'Лечит раненых врагов. Приоритетная цель.', herald:'Призывает рой за линией давления.', warden:'Связывает броню врагов.', damper:'Медленное подвижное поле, тормозит пули и прикрывает ближайших врагов.', boss:'Босс: залпы и подкрепление.'
};

const EN_WEAPON = {
  SHG: 'Close-range shotgun. Fires in bursts and recovers automatically.', SEK: 'Slow homing square projectile. Strong single-target pressure.', RKT: 'Heavy rocket launcher. Explodes on impact or wall hit.'
};
const RU_WEAPON = {
  SHG: 'Ближний дробовик. Стреляет залпами и сам восстанавливается.', SEK: 'Медленный самонаводящийся сигнальный снаряд.', RKT: 'Тяжёлая ракетница. Взрывается при попадании или столкновении со стеной.'
};
const EN_SKIN_NOTE = {
  terminal_mint:'clean green signal', debt_red:'red static signal', void_cyan:'cold void signal', casino_gold:'gold casino frame', bruise_purple:'purple bruised signal', bone_static:'bone static signal', black_lime:'black lime signal', bad_tv:'bad TV glare', red_static:'red broken channel', mirror_coin:'mirror coin signal', terminal_ghost:'ghost terminal signal', jackpot_wound:'legendary casino wound', dead_channel:'dead TV channel'
};

export function getLang() {
  try { const v = localStorage.getItem(KEY); if (LANGS.has(v)) return v; } catch {}
  return 'ru';
}
export function setLang(lang) {
  const l = LANGS.has(lang) ? lang : 'ru';
  try { localStorage.setItem(KEY, l); } catch {}
  document.documentElement.lang = l;
  applyStaticI18n();
  for (const fn of listeners) { try { fn(l); } catch {} }
  return l;
}
export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function t(key, vars = {}) {
  const l = getLang();
  let s = M[l]?.ui?.[key] ?? M.ru.ui[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = String(s).replaceAll(`{${k}}`, String(v));
  return s;
}
export function langIsEn() { return getLang() === 'en'; }
export function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function cleanPlayerText(text) {
  let s = String(text || '');
  s = s.replace(/сервер-связной/g, 'сеть').replace(/связной/g, 'сеть').replace(/хост/g, 'комната').replace(/Хост/g, 'Комната');
  s = s.replace(/браузер ведёт симуляцию[^.]*\.?/gi, 'Ты создаёшь комнату для друзей.');
  s = s.replace(/депло[яй][^.]*/gi, 'обновления').replace(/кэш[а-я]*/gi, 'обновление');
  s = s.replace(/Render|GitHub|protocol|snapshot|client|server|sim/gi, '');
  if (!langIsEn()) {
    s = s.replace(/damage-over-time/gi, 'периодический урон')
      .replace(/cooldown/gi, 'перезарядка')
      .replace(/freeze-lock/gi, 'остановка')
      .replace(/eligible combat/gi, 'боевая')
      .replace(/cursed/gi, 'проклятый')
      .replace(/stacks/gi, 'уровни')
      .replace(/stack/gi, 'уровень')
      .replace(/pickups/gi, 'подборы')
      .replace(/unlock/gi, 'открытия')
      .replace(/ghost-square/gi, 'призрачный область')
      .replace(/side-upgrades/gi, 'дополнительные апгрейды')
      .replace(/SIDE UPGRADE/gi, 'дополнительное усиление')
      .replace(/contract favor/gi, 'приз контракта')
      .replace(/favor/gi, 'приз')
      .replace(/reroll/gi, 'реролл').replace(/PROC/gi, 'шанс взрыва').replace(/STATIC STACK/gi, 'уровень статик-шторма').replace(/STATIC STORM/gi, 'статик-шторм').replace(/HUNGER CHARGE/gi, 'накопление голода').replace(/DIGITAL BITE/gi, 'цифровой укус')
      .replace(/next room/gi, 'следующая комната');
  }
  if (langIsEn() && /[А-Яа-яЁё]/.test(s)) {
    const exact = {
      'Весь исходящий урон растёт.': 'All outgoing damage increases.',
      'Перезарядка оружия становится короче.': 'Weapon reload becomes shorter.',
      'Скорость движения растёт.': 'Movement speed increases.',
      'Максимальное здоровье растёт.': 'Maximum health increases.',
      'Радиус притяжения pickups растёт.': 'Pickup attraction radius increases.',
      'Дроны переносят огонь, холод и яд оружия. Хорошо работает с DRONE +1.': 'Drones carry weapon fire, freeze, and poison. Works well with DRONE +1.',
      'Усиливает длительность и силу огня, холода и яда на пулях.': 'Improves the duration and strength of fire, freeze, and poison bullets.',
      'Больше зарядов рывка.': 'Adds more dash charges.',
      'Оружейный апгрейд.': 'Weapon upgrade.',
      'Награда оружейного сундука.': 'Weapon chest reward.',
      'Награда сундука способностей.': 'Ability chest reward.',
      'требуется другое оружие': 'requires another weapon',
      'Уже открыт.': 'Already opened.',
      'Бесплатно.': 'Free.'
    };
    if (exact[s]) s = exact[s];
    s = s
      .replace(/Апгрейд RKT: /g, 'RKT upgrade: ')
      .replace(/ракеты?/gi, 'rockets')
      .replace(/взрывы?/gi, 'explosions')
      .replace(/оглушать врагов/gi, 'stun enemies')
      .replace(/разбрасывают врагов/gi, 'scatter enemies')
      .replace(/ПКМ/gi, 'RMB')
      .replace(/самую старую/gi, 'the oldest one')
      .replace(/по одной/gi, 'one by one')
      .replace(/Увеличивает скорость движения[^.]*\./gi, 'Increases movement speed.')
      .replace(/Ускоряет восстановление рывка[^.]*\./gi, 'Dash charges recover faster.')
      .replace(/Даёт дополнительный заряд рывка[^.]*\./gi, 'Adds one dash charge.')
      .replace(/Рывок оглушает врагов[^.]*\./gi, 'Dash stuns enemies near its path.')
      .replace(/Рывок оставляет echo-всплеск[^.]*\./gi, 'Dash leaves an echo burst at the start point.');
    if (/[А-Яа-яЁё]/.test(s)) s = 'This changes how your build works. Check the choice title for the main effect.';
  }

  // Final player-facing cleanup pass: remove patch-note/dev phrasing from any fallback text.
  s = s
    .replace(/как было\s*\/\s*как стало/gi, '')
    .replace(/как было/gi, '')
    .replace(/как стало/gi, '')
    .replace(/до патча|после патча|патч\s*ноут|patch notes?|hotfix|регресс(?:ия)?|fixed|bugfix/gi, '')
    .replace(/no longer/gi, '')
    .replace(/now\s+/gi, '')
    .replace(/instead of/gi, 'rather than')
    .replace(/браузерн[а-я]*|депло[яй][а-я]*|cache|render|github|protocol|snapshot|client|server|sim/gi, '')
    .replace(/спавн|квота|фоллбек|fallback|debug|dev|техническ[а-я]*|внутренн[а-я]*/gi, '');
  if (langIsEn()) {
    s = s
      .replace(/before this room starts/gi, 'before entering the room')
      .replace(/banked Static Storm/gi, 'stored Static Storm')
      .replace(/ROOM CHECK/gi, 'room reward')
      .replace(/duplicate was not granted/gi, 'collection is already complete')
      .replace(/numeric room target/gi, 'clear goal');
  } else {
    s = s
      .replace(/before this room starts/gi, 'перед входом в комнату')
      .replace(/banked Static Storm/gi, 'статик в банке')
      .replace(/ROOM CHECK/gi, 'проверка комнаты')
      .replace(/duplicate was not granted/gi, 'коллекция уже полная')
      .replace(/numeric room target/gi, 'цель зачистки')
      .replace(/NET/gi, 'ИТОГ');
  }
  return s.replace(/\s{2,}/g, ' ').replace(/\s+([.,:;])/g, '$1').trim();
}
export function localText(ru, en) { return langIsEn() ? en : ru; }

export function denyText(f = {}) {
  const reason = String(f?.reason || '').trim();
  const cost = Number(f?.cost || 0);
  const have = f?.have;
  if (cost > 0) {
    const cur = (have === undefined || have === null) ? '?' : Math.round(Number(have) || 0);
    return f?.hpCost ? localText(`НЕТ HP ${cur}/${cost}`, `NO HP ${cur}/${cost}`) : localText(`НЕТ GLD ${cur}/${cost}`, `NO GLD ${cur}/${cost}`);
  }
  if (f?.label && !reason) return String(f.label);
  if (!reason) return t('denied');
  if (/^SEK CD\s+/i.test(reason)) return localText(`SEK ПЕРЕЗАРЯДКА ${reason.replace(/^SEK CD\s+/i, '')}`, `SEK COOLDOWN ${reason.replace(/^SEK CD\s+/i, '')}`);
  if (/^SHG CD\s+/i.test(reason)) return localText(`SHG ПЕРЕЗАРЯДКА ${reason.replace(/^SHG CD\s+/i, '')}`, `SHG COOLDOWN ${reason.replace(/^SHG CD\s+/i, '')}`);
  if (/^RKT CD\s+/i.test(reason)) return localText(`RKT ПЕРЕЗАРЯДКА ${reason.replace(/^RKT CD\s+/i, '')}`, `RKT COOLDOWN ${reason.replace(/^RKT CD\s+/i, '')}`);
  const map = {
    'NO HP': localText('НЕТ HP', 'NO HP'),
    'NO SHG': '',
    'NO SHG CHARGE': '',
    'NO RKT': localText('НЕТ ВЫПУЩЕННЫХ RKT', 'NO RKT ROCKETS'),
    'NO RKT REMOTE': localText('НУЖЕН RKT REMOTE', 'NEED RKT REMOTE'),
    'NO FAVOR REROLL': localText('РЕРОЛЛОВ БОЛЬШЕ НЕТ', 'NO REROLLS LEFT'),
    'NO SEK SWARM': localText('НУЖЕН SEK SWARM', 'NEED SEK SWARM'),
    'NO SHG LONGSHOT': localText('НУЖЕН SHG LONGSHOT', 'NEED SHG LONGSHOT'),
    'NO ACTIVE': t('qNoneLong'),
    'missing': t('qNoneLong'),
    'charges': localText('НЕТ ЗАРЯДОВ Q', 'NO Q CHARGES'),
    'NO SPIKE CHARGES': localText('НЕТ ЗАРЯДОВ SPIKE', 'NO SPIKE CHARGES'),
    'cooldown': localText('ЖДИ', 'WAIT')
  };
  return map[reason] || String(f?.label || reason || t('denied'));
}

export function labelStatus(status) { const m = { SELECTED: t('selected'), UNLOCKED: t('unlocked'), LOCKED: t('locked') }; return m[status] || status; }
export function skinNote(skin) { return langIsEn() ? (EN_SKIN_NOTE[skin?.id] || 'preset skin') : (skin?.note || t('skinPreset')); }
export function rarityLabel(meta) { return meta?.label || String(meta || '').toUpperCase(); }
export function activeNoneLabel() { return t('noActive'); }
export function activeNoneDesc() { return t('noActiveDesc'); }
export function activeShort(label) { return label === t('noActive') || label === 'НЕТ АКТИВКИ' || label === 'NO ACTIVE' ? t('qNoneShort') : String(label || '').replace(/^Q:\s*/, 'Q '); }
export function locAction(a) { return langIsEn() ? (EN_ACTION[a] || a) : (RU_ACTION[a] || a); }
export function locRole(r) { return langIsEn() ? (EN_ROLE[r] || r) : (RU_ROLE[r] || r); }
export function chestDesc(label) { return (langIsEn() ? EN_CHEST : RU_CHEST)[label] || t('chestDefault'); }
export function pickupDesc(type) { return (langIsEn() ? EN_PICKUP : RU_PICKUP)[type] || localText('Подбираемая награда.', 'Pickup reward.'); }
export function enemyDesc(kind) { return (langIsEn() ? EN_ENEMY : RU_ENEMY)[kind] || localText('Враг.', 'Enemy.'); }
export function weaponDesc(wd, shgCharges = 4) {
  if (!wd) return localText('Слот оружия.', 'Weapon slot.');
  const base = (langIsEn() ? EN_WEAPON : RU_WEAPON)[wd.label] || wd.name || wd.label;
  if (wd.label === 'SHG') return base;
  return base;
}
export function upgradeDesc(id, fallback = '') {
  if (langIsEn()) return EN_UPGRADE[id] || EN_UPGRADE[String(id || '').replace(/^abl_/, 'abl_')] || cleanPlayerText(fallback) || t('upgradeFallback');
  return RU_UPGRADE_CLEAN[id] || cleanPlayerText(fallback) || t('upgradeFallback');
}
export function coreDesc(id, fallback = '') { return langIsEn() ? (EN_CORE[id] || cleanPlayerText(fallback)) : (RU_CORE[id] || cleanPlayerText(fallback)); }
export function mutationDesc(id, fallback = '') { return langIsEn() ? (EN_MUT[id] || cleanPlayerText(fallback)) : (RU_MUT[id] || cleanPlayerText(fallback)); }
export function optionDesc(opt = {}) {
  if (opt.core) return coreDesc(opt.core, opt.desc || opt.preview || '');
  if (opt.mutation) return mutationDesc(opt.mutation, opt.desc || opt.preview || '');
  const id = opt.upgrade || opt.id;
  return upgradeDesc(id, opt.desc || opt.preview || '');
}
export function activeDescFrom(label, fallback = '') {
  const s = String(label || '');
  if (!langIsEn()) return cleanPlayerText(fallback || activeNoneDesc());
  const key = Object.keys(EN_CORE).find(id => s.includes(coreLabelById(id)));
  if (key) return EN_CORE[key];
  return cleanPlayerText(fallback || activeNoneDesc());
}
function coreLabelById(id) {
  const m = { blood_ring:'BLOOD RING', field_snap:'FIELD SNAP', bullet_freeze:'BULLET FREEZE', shell_ripper:'SHELL RIPPER', void_cut:'VOID CUT', signal_spike:'SIGNAL SPIKE', black_box:'BLACK BOX', debt_pulse:'STATIC PULSE' };
  return m[id] || id;
}
const RU_LABEL = {
  'DMG +15%': 'УРОН +15%', 'FIRE RATE +12%': 'СКОРОСТРЕЛЬНОСТЬ +12%', 'SPD +8%': 'СКОРОСТЬ +8%', 'HP +20': 'ЗДОРОВЬЕ +20', 'MAGNET +40%': 'МАГНИТ +40%',
  'DASH +1': 'РЫВОК +1', 'DRONE +1': 'ДРОН +1', 'ORBITAL +1': 'ОРБИТАЛЬ +1', 'ORBITAL SEEK +20%': 'ОРБИТАЛИ: НАВЕДЕНИЕ +20%', 'ORBITAL RANGE +35%': 'ОРБИТАЛИ: РАДИУС +35%', 'LUCK +1': 'УДАЧА +1', 'BLAST PROC 10%': 'ШАНС ВЗРЫВА 10%', 'BLAST CHANCE 10%': 'ШАНС ВЗРЫВА 10%', 'ECHO SHOT 12%': 'ЭХО-ВЫСТРЕЛ 12%', 'LIFESTEAL 2%': 'ВАМПИРИЗМ 2%', 'GLD ON KILL +40%': 'GLD ЗА УБИЙСТВО +40%',
  'DASH: VOID RIFT': 'РЫВОК: РАЗРЕЗ ПУСТОТЫ', 'DASH STUN': 'РЫВОК: СТАН', 'DASH CLONE': 'РЫВОК: УДАРНЫЙ СЛЕД', 'DASH ECHO BURST': 'РЫВОК: УДАРНЫЙ СЛЕД', 'DASH AFTERSHOCK': 'РЫВОК: УДАРНЫЙ СЛЕД',
  'DRONES COPY PROC': 'ДРОНЫ: ШАНС ВЗРЫВА', 'DRONE BLAST CHANCE': 'ДРОНЫ: ШАНС ВЗРЫВА', 'ORBITALS REFLECT': 'ОРБИТАЛИ ОТРАЖАЮТ', 'STATIC CORE': 'СТАТИК-ЯДРО', 'DMG +50% / HP -15': 'УРОН +50% / HP -15', 'LUCK +3 / SPD -10%': 'УДАЧА +3 / СКР -10%',
  'WEAPON DMG +18%': 'УРОН ОРУЖИЯ +18%', 'WEAPON FIRE +14%': 'СКОРОСТРЕЛЬНОСТЬ ОРУЖИЯ +14%', 'WEAPON RATE +14%': 'СКОРОСТРЕЛЬНОСТЬ ОРУЖИЯ +14%',
  'SEK WEAPON': 'ОРУЖИЕ SEEKER', 'RKT WEAPON': 'ОРУЖИЕ ROCKETGUN', 'BULLET RICOCHET +1': 'ОТСКОК ПУЛЬ +1', 'BULLET RANGE +22%': 'ДАЛЬНОСТЬ ПУЛЬ +22%',
  'FIRE BULLETS': 'ОГНЕННЫЕ ПУЛИ', 'FREEZE BULLETS': 'ЛЕДЯНЫЕ ПУЛИ', 'POISON BULLETS': 'ЯДОВИТЫЕ ПУЛИ', 'DRONE ELEMENT LINK': 'СТАТУСЫ ДРОНОВ',
  'ELEMENT AMP +25%': 'СТАТУСЫ +25%', 'STATUS SPREAD': 'ПЕРЕНОС СТАТУСОВ', 'BULLET LINK +1': 'СВЯЗЬ ПУЛЬ +1',
  'SHG TEETH +2 PELLETS': 'SHG: +2 ДРОБИНЫ', 'SHG LONGSHOT': 'SHG: ДАЛЬНИЙ ВЫСТРЕЛ', 'SEK SPLIT ON KILL': 'SEK: ФРАГМЕНТЫ ЗА УБИЙСТВО', 'SEK CHAIN LOCK': 'SEK: СИЛЬНЫЙ ЗАХВАТ', 'SEK SWARM': 'SEK: РОЙ',
  'RKT CLUSTER +2': 'RKT: +2 МИНИ-ВЗРЫВА', 'RKT STATIC MINES': 'RKT: СТАТИК-МИНЫ', 'RKT STUN BLAST': 'RKT: ОГЛУШЕНИЕ', 'RKT SCATTER BLAST': 'RKT: ОТБРОС', 'RKT REMOTE': 'RKT: РУЧНОЙ ВЗРЫВ',
  'MOBILITY +12%': 'МОБИЛЬНОСТЬ +12%', 'DASH FLOW +20%': 'РЫВОК: ВОССТАНОВЛЕНИЕ +20%', 'SIDE UPGRADE': 'ДОП. УСИЛЕНИЕ',
  'BOSS CUT': 'БОСС-КОНТРАКТ', 'SAFE CASHOUT': 'БЕЗОПАСНЫЙ ВЫХОД', 'HUNTER WAVES': 'ОХОТНИЧЬИ ВОЛНЫ', 'VIRUS CLEAN': 'ОЧИСТКА ВИРУСА',
  'WIRE GHOST': 'ПРОЙТИ БЕЗ ПРОВОДОВ', 'GRID WALKER': 'ПРОЙТИ СЕТКУ', 'BLOOD PAID': 'КРОВАВАЯ ОПЛАТА', 'STATIC CLEAN': 'ЧИСТАЯ СТАТИКА',
  'CACHE CLAIM': 'ЗАБРАТЬ СКИН', 'FAST CLEAN': 'БЫСТРАЯ ЗАЧИСТКА', 'NO HIT TAPE': 'БЕЗ УРОНА', 'CLEAN SIGNAL': 'ЧИСТЫЙ СИГНАЛ',
  'NEXT ROOM FAVOR': 'ПРИЗ СЛЕДУЮЩЕЙ КОМНАТЫ', 'NEXT ROOM PRIZE': 'ПРИЗ СЛЕДУЮЩЕЙ КОМНАТЫ', 'NEXT ROOM BONUS': 'БОНУС СЛЕДУЮЩЕЙ КОМНАТЫ'
};
export function locLabel(label) {
  const s = String(label || '');
  if (!langIsEn()) return RU_LABEL[s] || s;
  const m = {
    'ВЫБОР WPN': 'WPN PICK', 'ВЫБОР ABL': 'ABL PICK', 'УЖЕ ЕСТЬ': 'ALREADY OWNED', 'НЕТ ВАРИАНТА': 'NO OPTION',
    'НЕТ АКТИВКИ': 'NO ACTIVE', 'НЕТ Q': 'NO Q', 'ВЗЯЛ': 'TOOK', 'ЗАМЕНИТЬ': 'REPLACE', 'НУЖЕН': 'NEED', 'УРОН +15%': 'DMG +15%', 'СКОРОСТРЕЛЬНОСТЬ +12%': 'FIRE RATE +12%', 'СКОРОСТЬ +8%': 'SPD +8%', 'ЗДОРОВЬЕ +20': 'HP +20', 'МАГНИТ +40%': 'MAGNET +40%', 'РЫВОК +1': 'DASH +1', 'ДРОН +1': 'DRONE +1', 'ОРБИТАЛЬ +1': 'ORBITAL +1', 'ОРБИТАЛИ: НАВЕДЕНИЕ +20%': 'ORBITAL SEEK +20%', 'ОРБИТАЛИ: РАДИУС +35%': 'ORBITAL RANGE +35%', 'УДАЧА +1': 'LUCK +1', 'ВЗРЫВЫ 10%': 'BLAST CHANCE 10%', 'ШАНС ВЗРЫВА 10%': 'BLAST CHANCE 10%', 'ЭХО-ВЫСТРЕЛ 12%': 'ECHO SHOT 12%', 'ВАМПИРИЗМ 2%': 'LIFESTEAL 2%', 'СТАТИК-ЯДРО': 'STATIC CORE', 'STATIC Q': 'СТАТИК-ЯДРО', 'УРОН ОРУЖИЯ +18%': 'WEAPON DMG +18%', 'СКОРОСТРЕЛЬНОСТЬ ОРУЖИЯ +14%': 'WEAPON RATE +14%'
  };
  if (m[s]) return m[s];
  return s.replace('ВЫБОР WPN', 'WPN PICK').replace('ВЫБОР ABL', 'ABL PICK').replace('ЗАМЕНИТЬ:', 'REPLACE:').replace('НУЖЕН ', 'NEED ');
}
export function locReward(r) { return locLabel(r); }
export function groupLabel(g) { const v = String(g || '').toUpperCase(); if (langIsEn()) return v === 'CORE' ? 'Q' : v; const ru = { CORE: 'Q', MUTATION: 'МУТАЦИЯ', SIDE: 'ДОП.', UPGRADE: 'УСИЛЕНИЕ' }; return ru[v] || v; }
export function disabledReason(reason) {
  const r = String(reason || '');
  if (!langIsEn()) return cleanPlayerText(r || t('requiresOtherWeapon'));
  if (/оруж|weapon/i.test(r)) return t('requiresOtherWeapon');
  if (/услов/i.test(r)) return 'requirement not met';
  return r || t('requiresOtherWeapon');
}
export function objectStateText(opened, cost, currency = 'GLD') {
  if (opened) return t('chestOpened');
  if (cost > 0) {
    const cur = String(currency || 'GLD').toUpperCase();
    if (cur === 'HP') return localText(`Цена: ${cost} HP`, `Price: ${cost} HP`);
    return t('price', { cost });
  }
  return t('chestFree');
}
export function priceText(cost, currency = 'GLD') {
  const cur = String(currency || 'GLD').toUpperCase();
  if (cur === 'HP') return localText(`${cost} HP`, `${cost} HP`);
  return `${cost} GLD`;
}

function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function setPlaceholder(id, text) { const el = document.getElementById(id); if (el) el.placeholder = text; }
function setExplainSel(sel, title, body, tone = '') { const el = document.querySelector(sel); if (!el) return; el.dataset.explainTitle = title; el.dataset.explain = body; if (tone) el.dataset.explainTone = tone; else delete el.dataset.explainTone; }
function setExplainId(id, title, body, tone = '') { setExplainSel(`#${id}`, title, body, tone); }

export function applyStaticI18n() {
  const l = getLang(); document.documentElement.lang = l;
  setText('menu-sub', t('menuSub'));
  setText('btn-solo', t('solo'));
  setText('btn-create', t('create'));
  setText('btn-join', t('join'));
  setPlaceholder('name-input', t('namePlaceholder'));
  setPlaceholder('room-input', t('codePlaceholder'));
  setHTML('menu-controls', `<span class="term" data-explain-title="${t('controlsTitle')}" data-explain="${t('controlsBody')}">WASD</span> — ${t('movement')} · <span class="term">LMB</span> — ${t('fire')} · <span class="term">RMB</span> — ALT · <span class="term">SPACE</span> — ${t('inspect')} · <span class="term">SHIFT</span> — ${t('dash')} · <span class="term">E</span> — ${t('interact')} · <span class="term">Q</span> — ${t('qActive')} · <span class="term">TAB</span> — ${t('panel')}`);
  setExplainId('hud-version', t('versionTitle'), t('versionBody'));
  setExplainId('hud-room', t('roomTitle'), t('roomBody'));
  setExplainId('hud-loop', t('loopTitle'), t('loopBody'));
  setExplainId('hud-mods', t('modsTitle'), t('modsBody'));
  setExplainId('hud-inspect', t('inspectTitle'), t('inspectBody'));
  setText('hud-inspect', t('inspect').toUpperCase());
  setExplainId('hud-objective', t('objectiveTitle'), t('objectiveBody'));
  setExplainId('hp-text', t('hpTitle'), t('hpBody'));
  setExplainId('xp-text', t('xpTitle'), t('xpBody'));
  setExplainId('hud-gld', t('gldTitle'), t('gldBody'));
  setExplainId('hud-lvl', t('lvlTitle'), t('lvlBody'));
  setExplainId('hud-install', t('installTitle'), t('installBody'));
  setExplainId('hud-prompt', t('interactTitle'), t('interactBody'));
  setExplainSel('#tab-panel .panel-title', t('runStatusTitle'), t('runStatusBody'));
  setExplainSel('#install-modal .panel-title', t('installTitle'), t('installPickBody'));
  setExplainSel('#install-modal .hint .term', t('quickPickTitle'), t('quickPickBody'));
  const installHint = document.querySelector('#install-modal .hint'); if (installHint) installHint.lastChild && (installHint.lastChild.textContent = ` — ${t('choose')}`);
  setExplainSel('#weapon-modal .panel-title', t('wpnChestTitle'), t('wpnChestBody'));
  setExplainSel('#weapon-modal .hint .term', localText('ВЫБОР WPN', 'WPN PICK'), t('quickPickBody'));
  const wh = document.querySelector('#weapon-modal .hint'); if (wh) wh.lastChild && (wh.lastChild.textContent = ` — ${t('chooseAvailable')}`);
  setExplainSel('#ability-modal .panel-title', t('ablChestTitle'), t('ablChestBody'));
  setExplainSel('#ability-modal .hint .term', localText('ВЫБОР ABL', 'ABL PICK'), t('quickPickBody'));
  const ah = document.querySelector('#ability-modal .hint'); if (ah) ah.lastChild && (ah.lastChild.textContent = ` — ${t('chooseOption')}`);
  setExplainSel('#casino-modal .panel-title', t('betTitle'), t('betBody'), 'red');
  const stakeBodies = { low: t('lowBetBody'), mid: t('midBetBody'), high: t('highBetBody') };
  document.querySelectorAll('#casino-stakes button').forEach(btn => { const k = btn.dataset.stake; if (stakeBodies[k]) { btn.dataset.explainTitle = `${String(k).toUpperCase()} BET`; btn.dataset.explain = stakeBodies[k]; } });
  setExplainSel('#casino-modal .hint .term', t('betHintTitle'), t('betHintBody'));
  const escTerm = document.querySelector('#casino-modal .hint .term:last-of-type'); if (escTerm) { escTerm.dataset.explainTitle = t('exitTitle'); escTerm.dataset.explain = t('exitBody'); }
  setExplainId('name-input', t('nameTitle'), t('nameBody'));
  setExplainId('btn-solo', t('solo'), t('soloBody'));
  setExplainId('btn-create', t('create'), t('createBody'));
  setExplainId('room-input', t('codeTitle'), t('codeBody'));
  setExplainId('btn-join', t('join'), t('joinBody'));
  setExplainId('menu-controls', t('controlsTitle'), t('controlsBody'));
  const audioLabels = document.querySelectorAll('#audio-settings label span');
  if (audioLabels[0]) audioLabels[0].textContent = t('musicLabel');
  if (audioLabels[1]) audioLabels[1].textContent = t('sfxLabel');
  const filterSwitch = document.getElementById('filter-switch');
  if (filterSwitch) {
    const presetName = filterSwitch.dataset.filterName || 'CRT';
    filterSwitch.textContent = `${t('filterLabel')}: ${presetName}`;
    filterSwitch.dataset.explainTitle = t('filterLabel');
    filterSwitch.dataset.explain = t('filterBody');
  }
  setExplainId('audio-settings', localText('ЗВУК', 'AUDIO'), localText('Раздельная громкость музыки и игровых звуков. Сохраняется в браузере.', 'Separate music and SFX volume. Saved in this browser.'));
  const skinToggle = document.getElementById('btn-skin-toggle');
  const skinEditor = document.getElementById('skin-editor');
  if (skinToggle) skinToggle.textContent = skinEditor && !skinEditor.classList.contains('collapsed') ? t('hideSkins') : t('changeSkin');
  setExplainId('btn-skin-toggle', t('changeSkin'), t('skinBody'));
  setExplainId('skin-editor', t('skinTitle'), t('skinBody'));
  setExplainId('skin-prev', t('prevSkinTitle'), t('prevSkinBody'));
  setExplainId('skin-next', t('nextSkinTitle'), t('nextSkinBody'));
  setExplainId('lang-row', t('langTitle'), t('langBody'));
  document.querySelectorAll('[data-lang-btn]').forEach(b => b.classList.toggle('active', b.dataset.langBtn === l));
}

export function setupLanguageButtons() {
  document.querySelectorAll('[data-lang-btn]').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.langBtn));
  });
  applyStaticI18n();
}
