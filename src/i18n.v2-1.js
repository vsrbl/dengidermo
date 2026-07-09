// terminal casino roguelike i18n + player-facing text cleanup
// RU is the default. ENG can be selected from the menu or HUD.
const KEY = 'nnc_lang_v1';
const LANGS = new Set(['ru', 'en']);
const listeners = new Set();

const RU = {
  ui: {
    langTitle: 'ЯЗЫК', langBody: 'Меняет язык интерфейса, подсказок, меню и игровых сообщений.',
    versionTitle: 'ВЕРСИЯ', versionBody: 'Текущая версия игры.',
    roomTitle: 'СЕКТОР', roomBody: 'Код сектора и текущий узел маршрута.',
    loopTitle: 'ЦИКЛ / ГЛУБИНА', loopBody: 'Глубина — очищенные сектора. Цикл делает терминал опаснее.',
    modsTitle: 'ПРАВИЛА СЕКТОРА', modsBody: 'Активные правила этого узла. Подчёркнутые названия можно осмотреть.',
    inspectTitle: 'ОСМОТР', inspectBody: 'Пробел показывает подсказки у сундуков, портала, угроз, подборов и терминала ставок.',
    objectiveTitle: 'ЗАДАЧА', objectiveBody: 'Текущая задача сектора: очистка, главная угроза, контракт или переход через портал.',
    hpTitle: 'ЗДОРОВЬЕ', hpBody: 'Если здоровье падает до 0, игрок выбывает до следующего сектора или перезапуска.',
    xpTitle: 'ОПЫТ', xpBody: 'Опыт повышает уровень. Новый уровень добавляет выбор улучшения между секторами.',
    gldTitle: 'КРЕДИТЫ', gldBody: 'Кредиты для сундуков и терминала ставок. Подборы общие для команды, траты индивидуальные.',
    lvlTitle: 'УРОВЕНЬ / Q', lvlBody: 'Текущий уровень и состояние активной способности Q.',
    installTitle: 'УСТАНОВКА', installBody: 'Очередь модулей. Выбор появляется между секторами.',
    interactTitle: 'ВЗАИМОДЕЙСТВИЕ', interactBody: 'Подойди и нажми E. Здесь показываются сундуки, терминал ставок и портал.',
    runStatusTitle: 'ПАНЕЛЬ ПРОТОКОЛА', runStatusBody: 'Состояние протокола: цикл, глубина, правила сектора, союзники и ресурсы.',
    installPickBody: 'Выбери одно улучшение. Несколько выборов идут по очереди.',
    quickPickTitle: 'БЫСТРЫЙ ВЫБОР', quickPickBody: 'Клавиши 1, 2 и 3 выбирают вариант.',
    choose: 'выбрать', chooseAvailable: 'выбрать доступный вариант', chooseOption: 'выбрать вариант',
    wpnChestTitle: 'ОРУЖЕЙНЫЙ СУНДУК', wpnChestBody: 'Выбери один модуль: новое оружие, свойство оружия или усиление оружия.',
    ablChestTitle: 'СУНДУК ПРОТОКОЛОВ', ablChestBody: 'Выбери один модуль: протокол Q, мутацию Q, усиление Q или подвижность.',
    betTitle: 'ТЕРМИНАЛ СТАВОК', betBody: 'Риск за кредиты: ставка списывается, три окна выплат показывают награду или опасность.',
    lowBetBody: 'Ставка 20 кредитов. Низкий риск для начала забега.',
    midBetBody: 'Ставка 50 кредитов. Средний риск и ощутимая награда.',
    highBetBody: 'Ставка 120 кредитов. Большой риск и шанс на сильный результат.',
    betHintTitle: 'СТАВКА', betHintBody: 'Клавиши 1, 2 и 3 запускают малую, среднюю или высокую ставку.',
    exitTitle: 'ВЫХОД', exitBody: 'ESC закрывает казино, если ставка не рассчитывается.',
    menuSub: 'терминал-казино // до 4 игроков',
    musicLabel: 'МУЗЫКА', sfxLabel: 'ЗВУКИ', filterLabel: 'ФИЛЬТР', filterBody: 'Обработка изображения.', changeSkin: 'СМЕНИТЬ ОБЛИК', hideSkins: 'СКРЫТЬ ОБЛИКИ',
    namePlaceholder: 'ИМЯ', nameTitle: 'ИМЯ', nameBody: 'Имя игрока в комнате и панели. До 12 символов.',
    solo: 'ОДИНОЧНАЯ ИГРА', soloBody: 'Запускает одиночный забег без сети.',
    create: 'СОЗДАТЬ КОМНАТУ', createBody: 'Создаёт комнату для друзей. Поделись четырёхсимвольным кодом.',
    codePlaceholder: 'КОД', codeTitle: 'КОД КОМНАТЫ', codeBody: 'Четырёхсимвольный код комнаты друга.',
    join: 'ВОЙТИ', joinBody: 'Подключиться к комнате по коду.',
    controlsTitle: 'УПРАВЛЕНИЕ', controlsBody: 'WASD/стрелки — движение · ЛКМ — огонь · ПКМ — второй огонь оружия · Пробел — осмотр · Shift — рывок · E — взаимодействие · Q — активка · Tab — панель',
    movement: 'движение', fire: 'огонь', dash: 'рывок', interact: 'действие', qActive: 'активка', panel: 'панель', inspect: 'осмотр',
    skinTitle: 'ОБЛИК', skinBody: 'Готовые облики антивируса. Закрытые видны, но выбрать их нельзя до открытия.',
    prevSkinTitle: 'ПРЕДЫДУЩИЙ ОБЛИК', prevSkinBody: 'Листать назад.', nextSkinTitle: 'СЛЕДУЮЩИЙ ОБЛИК', nextSkinBody: 'Листать вперёд.',
    skinPreset: 'готовый облик', selected: 'ВЫБРАН', unlocked: 'ОТКРЫТ', locked: 'ЗАКРЫТ',
    statusConnecting: 'ПОДКЛЮЧЕНИЕ…', statusOnline: 'В СЕТИ', statusNetReady: 'СЕТЬ ГОТОВА', statusNetSleep: 'СЕТЬ ПРОСЫПАЕТСЯ · ОДИНОЧНАЯ ИГРА ГОТОВА', statusNetDown: 'СЕТЬ НЕДОСТУПНА · ОДИНОЧНАЯ ИГРА ГОТОВА',
    updateRequired: 'НУЖНО ОБНОВИТЬ СТРАНИЦУ', roomCode4: 'КОД КОМНАТЫ: 4 СИМВОЛА', roomNotFound: 'КОМНАТА НЕ НАЙДЕНА', roomFull: 'КОМНАТА ЗАПОЛНЕНА (4/4)', lostConnection: 'СВЯЗЬ ПОТЕРЯНА — ОБНОВИ СТРАНИЦУ',
    noActive: 'НЕТ АКТИВКИ', noActiveDesc: 'У тебя пока нет Q-протокола. Найди сундук протоколов и выбери активку.', qNoneShort: 'Q — НЕТ', qNoneLong: 'Q — НЕТ АКТИВКИ', qCd: 'Q ЗАРЯД', qOver: 'Q РАЗГОН', activeQTitle: 'АКТИВНАЯ СПОСОБНОСТЬ Q', activeQUse: 'Нажми Q, чтобы активировать.',
    dashChargeTitle: 'ЗАРЯД РЫВКА', dashReady: 'Готовый заряд рывка. Shift — рывок.', dashEmpty: 'Пустой заряд рывка скоро восстановится.',
    portalTitle: 'ПОРТАЛ', portalOpenBody: 'Открытый переход: нажми E рядом, чтобы перейти дальше.', portalClosedBody: 'Портал закрыт. Выполни цель сектора.', portalPrompt: 'E — ВОЙТИ В ПОРТАЛ', portalOpen: 'ПОРТАЛ ОТКРЫТ', portalTake: 'E — забрать облик', portalNext: 'E — перейти дальше',
    chestTitle: 'СУНДУК', chestDefault: 'Сундук с наградой.', chestOpened: 'Уже открыт.', chestFree: 'Бесплатно.', chestNeed: 'Нужно {cost} кредитов.', price: 'Цена: {cost} кредитов.',
    betPrompt: 'E — ТЕРМИНАЛ СТАВОК', betInspect: 'Терминал ставок: E открывает малую, среднюю или высокую ставку. Чем дальше забег, тем дороже риск.',
    gldLack: 'НЕДОСТАТОЧНО КРЕДИТОВ', denied: 'ОТКАЗ', noQ: 'НЕТ АКТИВКИ',
    installPhase: 'ФАЗА УЛУЧШЕНИЙ', installPhaseSub: 'выбор модулей', bossFloor: 'УЗЕЛ ГЛАВНОЙ УГРОЗЫ', killBoss: 'УНИЧТОЖИТЬ ГЛАВНУЮ УГРОЗУ', clear: 'ОЧИСТКА',
    playerJoined: 'ПОДКЛЮЧИЛСЯ', playerLeft: 'ВЫШЕЛ', you: 'ТЫ', down: 'ВЫБЫЛ', youDown: 'ТЫ ВЫБЫЛ', carry: 'союзники дотащат до портала',
    eventSignal: 'СИГНАЛ', wave: 'ВОЛНА', skinHidden: 'В СЕКТОРЕ СПРЯТАН ОБЛИК', skinReady: 'ОБЛИК В ОКНЕ УСТАНОВКИ', bossDown: 'ГЛАВНАЯ УГРОЗА УНИЧТОЖЕНА', loot: 'забирай приз',
    contract: 'КОНТРАКТ', contractBody: 'условие сектора активно', contractDone: 'КОНТРАКТ ВЫПОЛНЕН', contractDoneBody: 'условие выполнено; приз появится после сектора', contractPaid: 'ПРИЗ ПОЛУЧЕН', contractPaidBody: 'контракт выдал приз', contractFail: 'КОНТРАКТ ПРОВАЛЕН', contractFailBody: 'награды нет',
    runLost: 'ПРОТОКОЛ ПРОВАЛЕН', restart: 'перезапуск…', noResponse: 'НЕТ ОТВЕТА — СТАВКА НЕ ПОДТВЕРЖДЕНА', betFailed: 'СТАВКА НЕ ПРИНЯТА', invalidStake: 'НЕВЕРНАЯ СТАВКА', jackpot: 'ДЖЕКПОТ', lose: 'проигрыш', staticDebt: 'СТАТИК-ШТОРМ', skin: 'ОБЛИК', nextRoomDebt: 'СТАТИК-ШТОРМ → СЛЕД. СЕКТОР',
    loop: 'ЦИКЛ', depth: 'ГЛУБИНА', room: 'СЕКТОР', code: 'КОД', goal: 'ЗАДАЧА', rules: 'ПРАВИЛА', player: 'ИГРОК', health: 'ЗДОРОВЬЕ', level: 'УРОВЕНЬ', money: 'КРЕДИТЫ', drones: 'СПУТНИКИ', orbitals: 'ОРБИТАЛИ', qAbility: 'АКТИВКА Q', eliminated: 'ВЫБЫЛ',
    available: 'Можно выбрать.', unavailable: 'Недоступно', requiresOtherWeapon: 'требуется другое оружие', upgradeFallback: 'Улучшение персонажа.', weaponRewardFallback: 'Модуль оружейного сундука.', abilityRewardFallback: 'Модуль сундука протоколов.'
  }
};

const EN = {
  ui: {
    langTitle: 'LANGUAGE', langBody: 'Changes UI, tooltips, menus, and in-game messages.',
    versionTitle: 'VERSION', versionBody: 'Current game version.',
    roomTitle: 'SECTOR', roomBody: 'Sector code and current route node.',
    loopTitle: 'LOOP / DEPTH', loopBody: 'Depth is cleared sectors. Loop makes the terminal more dangerous.',
    modsTitle: 'SECTOR RULES', modsBody: 'Active rules in this sector. Hover an underlined rule to inspect it.',
    inspectTitle: 'INSPECT', inspectBody: 'Space toggles hints on world objects: chests, portal, threats, pickups, and BET terminal.',
    objectiveTitle: 'OBJECTIVE', objectiveBody: 'Current sector objective: clean, core threat, contract, or portal transition.',
    hpTitle: 'HEALTH', hpBody: 'If health reaches 0, the player is down until the next sector or restart.',
    xpTitle: 'EXP', xpBody: 'EXP builds levels. Level-ups add install choices between sectors.',
    gldTitle: 'GLD', gldBody: 'Credits for chests and the BET terminal. Normal GLD pickup is shared by the team; spending is individual.',
    lvlTitle: 'LEVEL / Q', lvlBody: 'Current level and Q active ability status.',
    installTitle: 'INSTALL', installBody: 'Module queue. Choices appear between sectors.',
    interactTitle: 'INTERACT', interactBody: 'Move close and press E. Shows chests, BET terminal, and portal.',
    runStatusTitle: 'PROTOCOL STATUS', runStatusBody: 'Protocol overview: loop, depth, sector rules, allies, and resources.',
    installPickBody: 'Choose one of three upgrades. If you have several INSTALL choices, they appear one by one.',
    quickPickTitle: 'QUICK PICK', quickPickBody: 'Keys 1, 2, and 3 pick the matching option.',
    choose: 'choose', chooseAvailable: 'choose available option', chooseOption: 'choose option',
    wpnChestTitle: 'WEAPON CHEST', wpnChestBody: 'Choose one module: new weapon, weapon mod, or weapon power. Grey options require another weapon.',
    ablChestTitle: 'PROTOCOL CHEST', ablChestBody: 'Choose one module: Q protocol, Q mutation, Q power, or mobility.',
    betTitle: 'BET TERMINAL', betBody: 'Risk GLD: pay a stake, spin reels, and get a reward or danger.',
    lowBetBody: 'Stake 20 GLD. Low risk for early runs.',
    midBetBody: 'Stake 50 GLD. Medium risk and better reward.',
    highBetBody: 'Stake 120 GLD. High risk and a chance for stronger results.',
    betHintTitle: 'BET', betHintBody: 'Keys 1, 2, and 3 start LOW, MID, or HIGH bet.',
    exitTitle: 'EXIT', exitBody: 'ESC closes casino when reels are not spinning.',
    menuSub: 'terminal casino // 4 players coop',
    musicLabel: 'MUSIC', sfxLabel: 'SFX', filterLabel: 'FILTER', filterBody: 'Screen look.', changeSkin: 'CHANGE SHELL', hideSkins: 'HIDE SHELLS',
    namePlaceholder: 'NAME', nameTitle: 'NAME', nameBody: 'Player name shown in the room. Up to 12 characters.',
    solo: 'SINGLE PLAYER', soloBody: 'Starts a single-player run without network.',
    create: 'CREATE ROOM', createBody: 'Creates a co-op room for friends. Share the four-symbol code.',
    codePlaceholder: 'CODE', codeTitle: 'ROOM CODE', codeBody: 'Four-symbol room code from a friend.',
    join: 'JOIN', joinBody: 'Join a room by code.',
    controlsTitle: 'CONTROLS', controlsBody: 'WASD/arrows — move · LMB — fire · RMB — weapon secondary fire · Space — inspect · Shift — dash · E — interact · Q — active · TAB — panel',
    movement: 'move', fire: 'fire', dash: 'dash', interact: 'interact', qActive: 'active', panel: 'panel', inspect: 'inspect',
    skinTitle: 'SHELL', skinBody: 'Antivirus shells. Locked shells are visible, but cannot be selected until unlocked.',
    prevSkinTitle: 'PREVIOUS SHELL', prevSkinBody: 'Browse backward.', nextSkinTitle: 'NEXT SHELL', nextSkinBody: 'Browse forward.',
    skinPreset: 'preset shell', selected: 'SELECTED', unlocked: 'UNLOCKED', locked: 'LOCKED',
    statusConnecting: 'CONNECTING…', statusOnline: 'ONLINE', statusNetReady: 'NETWORK READY', statusNetSleep: 'NETWORK WAKING · SINGLE PLAYER READY', statusNetDown: 'NETWORK UNAVAILABLE · SINGLE PLAYER READY',
    updateRequired: 'UPDATE REQUIRED: REFRESH PAGE', roomCode4: 'ROOM CODE MUST BE 4 SYMBOLS', roomNotFound: 'ROOM NOT FOUND', roomFull: 'ROOM FULL (4/4)', lostConnection: 'CONNECTION LOST — REFRESH PAGE',
    noActive: 'NO ACTIVE', noActiveDesc: 'You do not have a Q protocol yet. Find a protocol chest and choose one.', qNoneShort: 'Q — NONE', qNoneLong: 'Q — NO ACTIVE', qCd: 'Q CD', qOver: 'Q OVERCLOCK', activeQTitle: 'Q ACTIVE ABILITY', activeQUse: 'Press Q to activate.',
    dashChargeTitle: 'DASH CHARGE', dashReady: 'Ready dash charge. Shift — dash.', dashEmpty: 'Empty dash charge, will recover soon.',
    portalTitle: 'PORTAL', portalOpenBody: 'Open transition: press E nearby to go deeper.', portalClosedBody: 'Portal is closed. Finish the sector objective.', portalPrompt: 'E — ENTER PORTAL', portalOpen: 'PORTAL OPEN', portalTake: 'E — take skin', portalNext: 'E — go deeper',
    chestTitle: 'CHEST', chestDefault: 'Reward chest.', chestOpened: 'Already opened.', chestFree: 'Free.', chestNeed: 'Need {cost} GLD.', price: 'Cost: {cost} GLD.',
    betPrompt: 'E — BET TERMINAL', betInspect: 'Casino terminal: E opens LOW/MID/HIGH bets. Risk gets more expensive deeper into the run.',
    gldLack: 'NOT ENOUGH GLD', denied: 'DENIED', noQ: 'NO ACTIVE',
    installPhase: 'INSTALL PHASE', installPhaseSub: 'upgrade selection', bossFloor: 'CORE THREAT NODE', killBoss: 'DESTROY THE CORE THREAT', clear: 'CLEAR',
    playerJoined: 'JOINED', playerLeft: 'LEFT', you: 'YOU', down: 'DOWN', youDown: 'YOU ARE DOWN', carry: 'allies can reach the portal',
    eventSignal: 'SIGNAL', wave: 'WAVE', skinHidden: 'HIDDEN SHELL IN THIS SECTOR', skinReady: 'SHELL READY', bossDown: 'CORE THREAT DESTROYED', loot: 'take the prize',
    contract: 'CONTRACT', contractBody: 'sector condition is active', contractDone: 'CONTRACT DONE', contractDoneBody: 'completed; prize appears after the sector', contractPaid: 'PRIZE RECEIVED', contractPaidBody: 'contract prize granted', contractFail: 'CONTRACT FAILED', contractFailBody: 'no reward',
    runLost: 'PROTOCOL FAILED', restart: 'restarting…', noResponse: 'NO ANSWER — BET NOT CONFIRMED', betFailed: 'BET NOT ACCEPTED', invalidStake: 'INVALID STAKE', jackpot: 'JACKPOT', lose: 'loss', staticDebt: 'STATIC STORM', skin: 'SHELL', nextRoomDebt: 'STATIC STORM → NEXT SECTOR',
    loop: 'LOOP', depth: 'DEPTH', room: 'SECTOR', code: 'CODE', goal: 'GOAL', rules: 'RULES', player: 'PLAYER', health: 'HEALTH', level: 'LEVEL', money: 'MONEY', drones: 'DRONES', orbitals: 'ORBITALS', qAbility: 'Q ACTIVE', eliminated: 'DOWN',
    available: 'Available.', unavailable: 'Unavailable', requiresOtherWeapon: 'requires another weapon', upgradeFallback: 'Character upgrade.', weaponRewardFallback: 'Weapon chest module.', abilityRewardFallback: 'Protocol chest module.'
  }
};

const M = { ru: RU, en: EN };

const EN_UPGRADE = {
  dmg: 'All outgoing damage increases.', fire: 'Weapons fire more often.', spd: 'Movement speed increases.', maxhp: 'Maximum health increases.', magnet: 'Pickups are pulled from farther away.', dash: 'Adds one dash charge.', drone: 'Adds an auto-firing drone.', orbital: 'Adds an orbital that damages on contact.', luck: 'Better upgrade and casino outcomes.', proc: 'Bullet hits can create a small blast.', echo: 'Sometimes fires an extra shot.', leech: 'Damage can return health.', goldgun: 'Threats drop more GLD.',
  bullet_ricochet: 'Projectiles bounce off walls one more time.', bullet_range: 'Projectiles travel farther and last longer.', bullet_fire: 'Bullets burn enemies.', bullet_freeze: 'Bullets chill enemies and can briefly stop them.', bullet_poison: 'Bullets poison enemies.', drone_element_link: 'Drones carry your weapon elements.', element_amp: 'Fire, cold, and poison become stronger.', element_spread: 'Enemy deaths can spread status to nearby targets.', bullet_chain: 'Weapon hits can link damage to another nearby enemy.', shg_teeth: 'SHG fires more pellets.', shg_longshot: 'RMB spends loaded SHG charges on one heavy long shot.', sek_split: 'SEK kills release homing fragments.', sek_chain: 'SEK locks on harder and flies longer.', sek_swarm: 'RMB releases a homing bullet swarm.', rkt_cluster: 'RKT explosions create extra mini-blasts.', rkt_mines: 'RKT leaves delayed mines during flight.', rkt_stun: 'RKT explosions can stun enemies.', rkt_scatter: 'RKT explosions throw enemies farther.', rkt_remote: 'RMB detonates launched rockets one by one.', wpn_dmg: 'All weapon damage increases, including weapons unlocked later.', wpn_fire: 'All weapons fire more often.',
  abl_dash: 'Adds one dash charge.', abl_voidstep: 'Dash leaves a damaging void rift along its path.', voidstep: 'Dash leaves a damaging void rift along its path.', dashcut: 'Dash stuns enemies near its path.', dashclone: 'Dash leaves a short damaging aftershock at its start point.', abl_dashcut: 'Dash stuns enemies near its path.', abl_dashclone: 'Dash leaves a short damaging aftershock at its start point.', abl_speed: 'Movement speed increases.', abl_dashflow: 'Dash charges recover faster.',
  q_snap: 'Q pulls enemies inward and deals damage.', q_blood: 'Q spends health for a red square blast.', q_over: 'Q briefly speeds up your weapon fire.',
  combo_gld: 'Combo payout gives GLD when the chain ends.', combo_exp: 'Combo payout gives EXP when the chain ends.', combo_hp: 'Combo payout heals you when the chain ends.',
  sig_quarantine_buffer: '10-second temporary shield at the start of each room.', sig_emergency_cleanse: 'At low health, erases nearby enemy bullets for 20 seconds.', sig_payout_swap: 'Small chance to double GLD or healing.', sig_false_zero: 'Enemy bullets sometimes count as zero and deal no damage.', sig_deaf_command: 'Some enemies receive the start-room order late.', sig_hunt_route: 'Keep moving to gain a small speed trace.', sig_red_overdrive: 'After dash, the next shot hits harder.', sig_aim_glitch: 'After dash, nearby enemy bullets drift off course.', sig_incomplete_delete: 'Strong enemies can leave a small healing fragment.', sig_insurance_process: 'At 10% health, nearby enemies are thrown outward once per room.',
  droneproc: 'Drone bullets can create small blasts.', orbreflect: 'Orbitals still seek nearby enemies. When enemy bullets pass close, they intercept them too.', debtengine: 'Great power and luck. Combat rooms gain extra Static Storm pressure.', overload: 'Much more damage, but lower maximum health.', gamble: 'More luck, but lower movement speed.'
};
const RU_UPGRADE_CLEAN = {
  dmg: 'Весь исходящий урон растёт.', fire: 'Оружие стреляет чаще.', spd: 'Скорость движения растёт.', maxhp: 'Максимальное здоровье растёт.', magnet: 'Подборы притягиваются с большего расстояния.', dash: 'Добавляет один заряд рывка.', drone: 'Добавляет автостреляющего дрона.', orbital: 'Добавляет орбиталь, которая бьёт ближайших угроз.', orb_speed: 'Орбитали быстрее тянутся к угрозам.', orb_range: 'Орбитали замечают угроз и пули дальше.', luck: 'Лучше исходы улучшений и казино.', proc: 'Попадания пуль могут создавать маленький взрыв.', echo: 'Иногда появляется дополнительный выстрел.', leech: 'Часть нанесённого урона возвращает здоровье.', goldgun: 'Угрозы дают больше кредитов при очистке.',
  voidstep: 'Рывок оставляет по траектории опасный разрез пустоты.', abl_voidstep: 'Рывок оставляет по траектории опасный разрез пустоты.', dashcut: 'Рывок оглушает угроз рядом с траекторией.', dashclone: 'После рывка в точке старта остаётся короткий ударный след.', abl_dashcut: 'Рывок оглушает угроз рядом с траекторией.', abl_dashclone: 'После рывка в точке старта остаётся короткий ударный след.',
  q_snap: 'Q стягивает угроз и наносит урон.', q_blood: 'Q тратит здоровье на красный сигнальный взрыв.', q_over: 'Q ненадолго ускоряет стрельбу.',
  bullet_chain: 'Попадание оружием может связать урон с ближайшим угрозуом.', drone_element_link: 'Дроны переносят огонь, холод и яд оружия.', element_spread: 'Статусы с убитых угроз переходят на ближайшие цели.', bullet_ricochet: 'Снаряды получают дополнительный отскок от стен.', bullet_range: 'Снаряды летят дальше и живут дольше.', bullet_fire: 'Пули поджигают угроз.', bullet_freeze: 'Пули охлаждают угроз и могут коротко остановить их.', bullet_poison: 'Пули отравляют угроз.', element_amp: 'Огонь, холод и яд становятся сильнее.',
  shg_teeth: 'Дробовик получает больше дробин.', shg_longshot: 'Правая кнопка тратит заряды дробовика на один дальний тяжёлый выстрел.', sek_split: 'Убийства самонаводчиком выпускают фрагменты.', sek_chain: 'Самонаводчик лучше держит цель и летит дольше.', sek_swarm: 'Правая кнопка выпускает рой самонаводящихся пуль.', rkt_cluster: 'Ракетница добавляет малые взрывы вокруг детонации.', rkt_mines: 'Ракетница оставляет отложенные мины во время полёта.', rkt_stun: 'Взрывы ракетницы могут оглушать угрозы.', rkt_scatter: 'Взрывы ракетницы сильнее разбрасывают угрозы.', rkt_remote: 'Правая кнопка взрывает выпущенные ракеты по одной.',
  wpn_dmg: 'Повышает прямой урон всего оружия.', wpn_fire: 'Всё оружие стреляет чаще.', abl_dash: 'Добавляет один заряд рывка.', abl_speed: 'Скорость движения растёт.', abl_dashflow: 'Заряды рывка восстанавливаются быстрее.',
  combo_gld: 'Комбо при завершении выдаёт кредиты.', combo_exp: 'Комбо при завершении выдаёт опыт.', combo_hp: 'Комбо при завершении лечит.',
  sig_quarantine_buffer: 'В начале каждого сектора включается щит на 10 секунд.', sig_emergency_cleanse: 'При низком здоровье 20 секунд стирает ближайшие вражеские пули.', sig_payout_swap: 'Маленький шанс удвоить кредиты или лечение.', sig_false_zero: 'Вражеские пули иногда считаются нулём и не наносят урон.', sig_deaf_command: 'Часть угроз получает приказ с задержкой.', sig_hunt_route: 'Пока двигаешься, появляется небольшой след скорости.', sig_red_overdrive: 'После рывка следующий выстрел сильнее.', sig_aim_glitch: 'После рывка ближайшие вражеские пули сбиваются с курса.', sig_incomplete_delete: 'Сильные угрозы иногда оставляют небольшой лечебный обломок.', sig_insurance_process: 'При 10% здоровье угрозы разбрасываются в стороны. Один раз за сектор.',
  droneproc: 'Пули дронов могут создавать маленькие взрывы.', orbreflect: 'Орбитали всё ещё тянутся к угрозам, а рядом с вражескими пулями перехватывают их.', debtengine: 'Большой урон и удача. Боевые секторы получают больше статик-давления.', overload: 'Сильно повышает урон, но снижает максимум здоровье.', gamble: 'Даёт больше удачи, но снижает скорость движения.'
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
  static: 'Q leaves a static field that slows enemies and bullets.', blood: 'Q gains extra blood damage. Some uses may cost health.', echo: 'Q leaves a weaker echo after a short pause.', shrapnel: 'Q releases extra bullets from the impact point.', casino: 'Q can trigger a small casino check: reward, repeat, or danger.', void: 'Q gives a short invulnerable phase window.', leech: 'Q hits can return health or GLD.', armor_crack: 'Q breaks enemy protection harder.', anchor: 'Q leaves a heavy square that pulls enemies and slows bullets.', hunger: 'Q creates a hunger zone. More enemies inside it feed a stronger final digital bite.', bad_tape: 'Q leaves two unstable glitch echoes.'
};

const RU_CORE = {
  blood_ring: 'Красное кольцо следует за тобой. Урон: средний частыми импульсами; высокий, если угрозу долго стоит внутри.',
  field_snap: 'Стягивает угроз и подборы к тебе, затем оставляет короткое поле, которое замедляет и глушит пули.',
  bullet_freeze: 'Холодная аура следует за тобой. Угрозы замирают, вражеские пули почти останавливаются.',
  shell_ripper: 'Ломает защиту угроз и делает их уязвимее.',
  void_cut: 'Пускает тонкий луч по прицелу. Луч режет угроз по линии.',
  signal_spike: 'Ставит сигнальный шип в точке прицела. Зона замедляет угроз и глушит пули.',
  black_box: 'Прячет тебя в чёрной области. Угрозы снаружи теряют твой сигнал.',
  debt_pulse: 'Красный статик-взрыв вокруг тебя. Ослабляет угроз и может вызвать статик-шторм.'
};
const RU_MUT = {
  static: 'Q оставляет статик-поле, которое замедляет угроз и пули.', blood: 'Q получает дополнительный кровавый урон. Некоторые применения могут стоить здоровье.', echo: 'Q оставляет слабое эхо после короткой паузы.', shrapnel: 'Q выпускает дополнительные пули из точки удара.', casino: 'Q может запустить маленькую проверку казино: награда, повтор или опасность.', void: 'Q даёт короткое окно неуязвимости.', leech: 'Попадания Q могут вернуть здоровье или кредиты.', armor_crack: 'Q сильнее ломает защиту угроз.', anchor: 'Q оставляет тяжёлую область, которая тянет угроз и тормозит пули.', hunger: 'Q создаёт зону голода. Чем больше угроз внутри, тем сильнее финальный цифровой укус.', bad_tape: 'Q создаёт два слабых искажённых повтора.'
};
const EN_ROLE = { 'FOLLOW DAMAGE':'FOLLOW DAMAGE', 'PULL / CONTROL':'PULL / CONTROL', 'FREEZE / CONTROL':'FREEZE / CONTROL', 'ARMOR / EXPOSE':'ARMOR / EXPOSE', 'THIN LASER':'THIN LASER', 'BUILD LASER':'BUILD LASER', 'DEPLOY NODE':'DEPLOY NODE', 'STEALTH / SAFE':'STEALTH / SAFE', 'RISK BURST':'RISK BURST', FIELD:'FIELD', DAMAGE:'DAMAGE', RECAST:'RECAST', BULLETS:'BULLETS', 'POST-ROLL':'POST-ROLL', PHASE:'PHASE', SUSTAIN:'SUSTAIN', SHELL:'SHELL', 'LOCK ZONE':'LOCK ZONE', SCALING:'SCALING', 'CHARGE BITE':'CHARGE BITE', 'GLITCH REPEAT':'GLITCH REPEAT' };
const RU_ROLE = { 'FOLLOW DAMAGE':'УРОН РЯДОМ', 'PULL / CONTROL':'СТЯЖКА / КОНТРОЛЬ', 'FREEZE / CONTROL':'ЗАМОРОЗКА / КОНТРОЛЬ', 'ARMOR / EXPOSE':'ЗАЩИТА / УЯЗВИМОСТЬ', 'THIN LASER':'ТОНКИЙ ЛУЧ', 'BUILD LASER':'ЛУЧ / ЗВЕНЬЯ', 'DEPLOY NODE':'УСТАНОВКА УЗЛА', 'STEALTH / SAFE':'СКРЫТИЕ / БЕЗОПАСНОСТЬ', 'RISK BURST':'ОПАСНЫЙ ВЗРЫВ', FIELD:'ПОЛЕ', DAMAGE:'УРОН', RECAST:'ПОВТОР', BULLETS:'ПУЛИ', 'POST-ROLL':'ПОСЛЕ Q', PHASE:'ФАЗА', SUSTAIN:'ВЫЖИВАНИЕ', SHELL:'ЩИТЫ', 'LOCK ZONE':'ЗОНА КОНТРОЛЯ', SCALING:'НАКОПЛЕНИЕ', 'CHARGE BITE':'НАКОПЛЕНИЕ / УКУС', 'GLITCH REPEAT':'ИСКАЖЁННЫЙ ПОВТОР' };
const EN_ACTION = { 'ЗАМЕНИТЬ CORE':'REPLACE Q', 'УСТАНОВИТЬ CORE':'INSTALL Q', 'УСИЛИТЬ CORE':'UPGRADE Q', 'ЗАМЕНИТЬ Q':'REPLACE Q', 'УСТАНОВИТЬ Q':'INSTALL Q', 'УСИЛИТЬ Q':'UPGRADE Q', 'ЗАМЕНИТЬ МУТАЦИЮ':'REPLACE MUTATION', 'ДОБАВИТЬ МУТАЦИЮ':'ADD MUTATION', 'SIDE UPGRADE':'SIDE UPGRADE' };
const RU_ACTION = { 'REPLACE CORE':'ЗАМЕНИТЬ Q', 'INSTALL CORE':'УСТАНОВИТЬ Q', 'UPGRADE CORE':'УСИЛИТЬ Q', 'REPLACE Q':'ЗАМЕНИТЬ Q', 'INSTALL Q':'УСТАНОВИТЬ Q', 'UPGRADE Q':'УСИЛИТЬ Q', 'REPLACE MUTATION':'ЗАМЕНИТЬ МУТАЦИЮ', 'ADD MUTATION':'ДОБАВИТЬ МУТАЦИЮ', 'SIDE UPGRADE':'ДОП. УСИЛЕНИЕ' };

const EN_CHEST = {
  BSC: 'Free basic chest: GLD, EXP, and sometimes healing.', WPN: 'Weapon chest: choose a weapon, weapon mod, or weapon stat boost.', ABL: 'Ability chest: Q active, Q upgrade, Q mutation, or mobility.', RAR: 'Rare chest: stronger build upgrade.', CRS: 'Cursed chest: strong reward, but the run becomes more dangerous.'
};
const RU_CHEST = {
  BSC: 'Бесплатный базовый сундук: кредиты, опыт и иногда лечение.', WPN: 'Оружейный сундук: оружие, мод или усиление оружия.', ABL: 'Сундук протоколов: активка Q, улучшение Q, мутация или мобильность.', RAR: 'Редкий сундук: сильное улучшение.', CRS: 'Проклятый сундук: сильная награда, но протокол становится опаснее.'
};
const EN_PICKUP = { GLD: 'Credits for chests and bets. Shared by the team.', EXP: 'Experience toward the next level. Install choices appear between sectors.', HEA: 'Healing pickup. Restores health to the collector.' };
const RU_PICKUP = { GLD: 'Кредиты для сундуков и ставок. Обычный подбор делится с командой.', EXP: 'Опыт для уровней. Улучшения появляются между секторами.', HEA: 'Лечение. Восстанавливает здоровье тому, кто подобрал.' };
const EN_ENEMY = {
  grunt:'Basic chaser with contact damage.', runner:'Fast weak enemy that breaks your position.', tank:'Slow armored wall that soaks damage.', shooter:'Ranged enemy that shoots red projectiles.', charger:'Winds up, then charges in a straight line.', bomber:'Arms a fuse and explodes. Leave the radius.', bouncer:'Pinball enemy that bounces and shoves.', glitch:'Blink attacker that strikes from odd angles.', echo:'Mimic enemy: fires familiar shots from a distance.', orbiter:'Mobile guard with front shield.', anchor:'Control anchor that pulls and slows.', splitter:'Splits into smaller fast enemies on death.', prism:'Fires split prism lanes.', pulse:'Fires forward square-wave pressure.', leech:'Heals wounded enemies. Priority target.', herald:'Summons swarms behind pressure lines.', warden:'Coordinates shell armor links.', damper:'Slow mobile field that stops bullets and shelters nearby enemies.', boss:'Boss floor enemy with bursts and adds.', boss_croupier:'Casino boss: marks stakes on the floor and changes pressure.', boss_anchor_cashier:'Anchor boss: strong pull field and gravity bursts.', boss_hunter_chorus:'Hunter boss: shots, traps, and hunter reinforcements.', boss_q_revisor:'Q Revisor: uses one adapted Q active ability.'
};
const RU_ENEMY = {
  grunt:'Базовая угроза: идёт в контакт.', runner:'Быстрый нарушитель позиции.', tank:'Бронированная угроза: держит линию.', shooter:'Дальний процесс: стреляет красными снарядами.', charger:'Готовит рывок и пробивает линию.', bomber:'Заряжает взрыв. Уходи из радиуса.', bouncer:'Ромб-отбойник: толкает и ломает позицию.', glitch:'Сбойный процесс: мигает и атакует с угла.', echo:'Зеркальный процесс: копирует оружейные сигналы издалека.', orbiter:'Подвижный щитовой процесс.', anchor:'Якорный узел: тянет и замедляет.', splitter:'После удаления делится на малые угрозы.', prism:'Строит призменные линии огня.', pulse:'Давит квадратной волной.', leech:'Ремонтирует раненые угрозы. Приоритетная цель.', herald:'Вызывает рой за линией давления.', warden:'Связывает броню угроз.', damper:'Поле-глушитель: тормозит пули и прикрывает угрозы.', boss:'Главная угроза: залпы и подкрепление.', boss_croupier:'Крупье-ядро: ставит метки и меняет давление.', boss_anchor_cashier:'Кассовый якорь: притяжение и гравитационные удары.', boss_hunter_chorus:'Охотничий хор: выстрелы, ловушки и подкрепление.', boss_q_revisor:'Q-ревизор: использует адаптированный протокол Q.'
};

const EN_WEAPON = {
  SHG: 'Close-range shotgun. Fires in bursts and recovers automatically.', SEK: 'Slow homing square projectile. Strong single-target pressure.', RKT: 'Heavy rocket launcher. Explodes on impact or wall hit.', LVC: 'Living Casino gun. Opens and fires casino sectors.', RLT: 'Roulette gun. A spinning square breaks into smaller squares on impact.', CRD: 'Deck gun. Fast card fan.'
};
const RU_WEAPON = {
  SHG: 'Дробовик ближней очистки. Стреляет залпами и сам заряжается.', SEK: 'Самонаводящийся сигнальный снаряд для одиночных целей.', RKT: 'Тяжёлая ракетница. Взрывается при попадании или ударе о стену.', LVC: 'Казино-пушка. Запускает сектор Живого казино.', RLT: 'Пушка-рулетка. Вращающийся квадрат дробится на меньшие квадраты при ударе.', CRD: 'Пушка-колода. Быстрый веер карт.'
};
const EN_SKIN_NOTE = {
  terminal_mint:'house terminal signal', living_casino:'living casino vector core', debt_red:'debt-fracture signal', void_cyan:'void channel signal', casino_gold:'cashier gleam signal', bruise_purple:'bruised circuit signal', bone_static:'bone-noise signal', black_lime:'lime breach signal', bad_tv:'bad broadcast glare', red_static:'red storm channel', mirror_coin:'false jackpot signal', terminal_ghost:'ghost terminal signal', jackpot_wound:'legendary jackpot wound', dead_channel:'dead channel signal'
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
      .replace(/призрачная область/gi, 'призрачный область')
      .replace(/side-upgrades/gi, 'дополнительные улучшения')
      .replace(/SIDE UPGRADE/gi, 'дополнительное усиление')
      .replace(/contract favor/gi, 'приз контракта')
      .replace(/favor/gi, 'приз')
      .replace(/reroll/gi, 'переброс').replace(/PROC/gi, 'шанс взрыва').replace(/STATIC STACK/gi, 'уровень статик-шторма').replace(/STATIC STORM/gi, 'статик-шторм').replace(/HUNGER CHARGE/gi, 'накопление голода').replace(/DIGITAL BITE/gi, 'цифровой укус')
      .replace(/next room/gi, 'следующий сектор');
  }
  if (langIsEn() && /[А-Яа-яЁё]/.test(s)) {
    const exact = {
      'Весь исходящий урон растёт.': 'All outgoing damage increases.',
      'Перезарядка оружия становится короче.': 'Weapon reload becomes shorter.',
      'Скорость движения растёт.': 'Movement speed increases.',
      'Максимальное здоровье растёт.': 'Maximum health increases.',
      'Радиус притяжения подборов растёт.': 'Pickup attraction radius increases.',
      'Дроны переносят огонь, холод и яд оружия. Хорошо работает с DRONE +1.': 'Drones carry weapon fire, freeze, and poison. Works well with DRONE +1.',
      'Усиливает длительность и силу огня, холода и яда на пулях.': 'Improves the duration and strength of fire, freeze, and poison bullets.',
      'Больше зарядов рывка.': 'Adds more dash charges.',
      'Оружейное усиление.': 'Weapon upgrade.',
      'Награда оружейного сундука.': 'Weapon chest reward.',
      'Награда сундука протоколов.': 'Protocol chest reward.',
      'требуется другое оружие': 'requires another weapon',
      'Уже открыт.': 'Already opened.',
      'Бесплатно.': 'Free.'
    };
    if (exact[s]) s = exact[s];
    s = s
      .replace(/Улучшение RKT: /g, 'RKT upgrade: ')
      .replace(/ракеты?/gi, 'rockets')
      .replace(/взрывы?/gi, 'explosions')
      .replace(/оглушать угроз/gi, 'stun enemies')
      .replace(/разбрасывают угроз/gi, 'scatter enemies')
      .replace(/ПКМ/gi, 'RMB')
      .replace(/самую старую/gi, 'the oldest one')
      .replace(/по одной/gi, 'one by one')
      .replace(/Увеличивает скорость движения[^.]*\./gi, 'Increases movement speed.')
      .replace(/Ускоряет восстановление рывка[^.]*\./gi, 'Dash charges recover faster.')
      .replace(/Даёт дополнительный заряд рывка[^.]*\./gi, 'Adds one dash charge.')
      .replace(/Рывок оглушает угроз[^.]*\./gi, 'Dash stuns enemies near its path.')
      .replace(/Рывок оставляет echo-всплеск[^.]*\./gi, 'Dash leaves an echo burst at the start point.');
    if (/[А-Яа-яЁё]/.test(s)) s = 'This changes how your build works.';
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
      .replace(/SECTOR CHECK/gi, 'room reward')
      .replace(/duplicate was not granted/gi, 'collection is already complete')
      .replace(/numeric room target/gi, 'clear goal');
  } else {
    s = s
      .replace(/before this room starts/gi, 'перед входом в сектор')
      .replace(/banked Static Storm/gi, 'статик в банке')
      .replace(/SECTOR CHECK/gi, 'проверка сектора')
      .replace(/duplicate was not granted/gi, 'коллекция уже полная')
      .replace(/numeric room target/gi, 'цель зачистки')
      .replace(/NET/gi, 'ИТОГ')
      .replace(/WPN/gi, 'ОРУЖИЕ').replace(/ABL/gi, 'ПРОТОКОЛ').replace(/SHOTGUN/gi, 'дробовик').replace(/SEEKER/gi, 'самонаводчик').replace(/ROCKETGUN/gi, 'ракетница').replace(/ZERO/gi, 'ноль').replace(/GUARD/gi, 'защита').replace(/CHAIN/gi, 'цепь').replace(/COPY/gi, 'копия').replace(/GHOST/gi, 'призрак').replace(/TABLE/gi, 'карта').replace(/enemy/gi, 'угроза').replace(/boss/gi, 'главная угроза').replace(/skin/gi, 'облик');
  }
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([.,:;])/g, '$1').trim();
  if (langIsEn() && /[А-Яа-яЁё]/.test(s)) return 'This explains the current game effect.';
  return s;
}
export function localText(ru, en) { return langIsEn() ? en : ru; }

export function denyText(f = {}) {
  const reason = String(f?.reason || '').trim();
  const cost = Number(f?.cost || 0);
  const have = f?.have;
  if (cost > 0) {
    const cur = (have === undefined || have === null) ? '?' : Math.round(Number(have) || 0);
    return f?.hpCost ? localText(`НЕТ ЗДОРОВЬЯ ${cur}/${cost}`, `NO HP ${cur}/${cost}`) : localText(`НЕТ КРЕДИТОВ ${cur}/${cost}`, `NO GLD ${cur}/${cost}`);
  }
  if (f?.label && !reason) return String(f.label);
  if (!reason) return t('denied');
  if (/^SEK CD\s+/i.test(reason)) return localText(`SEK ПЕРЕЗАРЯДКА ${reason.replace(/^SEK CD\s+/i, '')}`, `SEK COOLDOWN ${reason.replace(/^SEK CD\s+/i, '')}`);
  if (/^SHG CD\s+/i.test(reason)) return localText(`SHG ПЕРЕЗАРЯДКА ${reason.replace(/^SHG CD\s+/i, '')}`, `SHG COOLDOWN ${reason.replace(/^SHG CD\s+/i, '')}`);
  if (/^RKT CD\s+/i.test(reason)) return localText(`RKT ПЕРЕЗАРЯДКА ${reason.replace(/^RKT CD\s+/i, '')}`, `RKT COOLDOWN ${reason.replace(/^RKT CD\s+/i, '')}`);
  const map = {
    'NO HP': localText('НЕТ ЗДОРОВЬЯ', 'NO HP'),
    'NO SHG': '',
    'NO SHG CHARGE': '',
    'NO RKT': localText('НЕТ ВЫПУЩЕННЫХ RKT', 'NO RKT ROCKETS'),
    'NO RKT REMOTE': localText('НУЖЕН RKT REMOTE', 'NEED RKT REMOTE'),
    'NO FAVOR REROLL': localText('ПЕРЕБРОСОВ БОЛЬШЕ НЕТ', 'NO REROLLS LEFT'),
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
export function skinNote(skin) { return langIsEn() ? (EN_SKIN_NOTE[skin?.id] || 'preset shell') : (skin?.note || t('skinPreset')); }
export function rarityLabel(meta) { return meta?.label || String(meta || '').toUpperCase(); }
export function activeNoneLabel() { return t('noActive'); }
export function activeNoneDesc() { return t('noActiveDesc'); }
export function activeShort(label) { return label === t('noActive') || label === 'НЕТ АКТИВКИ' || label === 'NO ACTIVE' ? t('qNoneShort') : String(label || '').replace(/^Q:\s*/, 'Q '); }
export function locAction(a) { return langIsEn() ? (EN_ACTION[a] || a) : (RU_ACTION[a] || a); }
export function locRole(r) { return langIsEn() ? (EN_ROLE[r] || r) : (RU_ROLE[r] || r); }
export function chestDesc(label) { return (langIsEn() ? EN_CHEST : RU_CHEST)[label] || t('chestDefault'); }
export function pickupDesc(type) { return (langIsEn() ? EN_PICKUP : RU_PICKUP)[type] || localText('Подбираемая награда.', 'Pickup reward.'); }
export function enemyDesc(kind) { return (langIsEn() ? EN_ENEMY : RU_ENEMY)[kind] || localText('Угроза.', 'Threat.'); }
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
  const kind = String(opt.kind || '');
  if (kind.startsWith('lc_')) {
    const sector = String(opt.sector || '');
    const ru = {
      dmg: 'Казино-пушка запускает самонаводящиеся цифровые пули.', roulette: 'Пушка-рулетка выпускает вращающийся квадрат, который дробится при ударе.', deck: 'Пушка-колода выпускает быстрый веер карт.',
      guard: 'Защита отталкивает угрозы и даёт временный щит.', chain: 'Цепь даёт быстрые фиолетовые рывки.', bet: 'Ставка рискует малой ценой ради случайной выплаты.',
      copy: 'Копия повторяет последнее действие слабее.', ghost: 'Призрак сбивает агро угроз на короткое время.', jackpot: 'Джекпот создаёт импульс вокруг антивируса.', table: 'Карта ставит ловушку под антивирусом.'
    };
    const en = {
      dmg: 'Casino gun launches homing digital shots.', roulette: 'Roulette gun fires a spinning square that splits on impact.', deck: 'Deck gun fires a fast fan of cards.',
      guard: 'Guard pushes threats away and grants a temporary shield.', chain: 'Chain grants fast violet dash charges.', bet: 'Bet risks a small cost for a random payout.',
      copy: 'Copy repeats the last action at lower power.', ghost: 'Ghost briefly drops threat aggro.', jackpot: 'Jackpot creates an impulse around the antivirus.', table: 'Table places a trap under the antivirus.'
    };
    if (kind === 'lc_lvc_auto_fire') return localText('Если казино-пушка выбрана, она сама стреляет после перезарядки.', 'If the casino gun is selected, it fires automatically after reload.');
    if (kind === 'lc_copy_power') return localText('Копия повторяет последнее действие сильнее.', 'Copy repeats the last action with more power.');
    if (kind === 'lc_bet_luck') return localText('Ставка чаще выдаёт сильную выплату и реже сбой.', 'Bet rolls stronger payouts more often and blanks less often.');
    if (kind === 'lc_sector_upgrade') return localText(ru[sector] || cleanPlayerText(opt.desc || ''), en[sector] || cleanPlayerText(opt.desc || ''));
    if (kind === 'lc_sector_add') return localText(ru[sector] || cleanPlayerText(opt.desc || ''), en[sector] || cleanPlayerText(opt.desc || ''));
  }
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
  'DASH +1': 'РЫВОК +1', 'DRONE +1': 'ДРОН +1', 'ORBITAL +1': 'ОРБИТАЛЬ +1', 'ORBITAL SEEK +20%': 'ОРБИТАЛИ: НАВЕДЕНИЕ +20%', 'ORBITAL RANGE +35%': 'ОРБИТАЛИ: РАДИУС +35%', 'LUCK +1': 'УДАЧА +1', 'BLAST PROC 10%': 'ШАНС ВЗРЫВА 10%', 'BLAST CHANCE 10%': 'ШАНС ВЗРЫВА 10%', 'ECHO SHOT 12%': 'ЭХО-ВЫСТРЕЛ 12%', 'LIFESTEAL 2%': 'ВАМПИРИЗМ 2%', 'GLD ON KILL +40%': 'КРЕДИТЫ ЗА ОЧИСТКУ +40%', 'COMBO PAYS GLD': 'КОМБО: КРЕДИТЫ', 'COMBO PAYS EXP': 'КОМБО: ОПЫТ', 'COMBO PAYS HP': 'КОМБО: ЛЕЧЕНИЕ',
  'DASH: VOID RIFT': 'РЫВОК: РАЗРЕЗ ПУСТОТЫ', 'DASH STUN': 'РЫВОК: СТАН', 'DASH CLONE': 'РЫВОК: УДАРНЫЙ СЛЕД', 'DASH ECHO BURST': 'РЫВОК: УДАРНЫЙ СЛЕД', 'DASH AFTERSHOCK': 'РЫВОК: УДАРНЫЙ СЛЕД',
  'DRONES COPY PROC': 'ДРОНЫ: ШАНС ВЗРЫВА', 'DRONE BLAST CHANCE': 'ДРОНЫ: ШАНС ВЗРЫВА', 'ORBITALS REFLECT': 'ОРБИТАЛИ ОТРАЖАЮТ', 'STATIC CORE': 'СТАТИК-ЯДРО', 'DMG +50% / HP -15': 'УРОН +50% / ЗДОРОВЬЕ -15', 'LUCK +3 / SPD -10%': 'УДАЧА +3 / СКР -10%',
  'WEAPON DMG +18%': 'УРОН ОРУЖИЯ +18%', 'WEAPON FIRE +14%': 'СКОРОСТРЕЛЬНОСТЬ ОРУЖИЯ +14%', 'WEAPON RATE +14%': 'СКОРОСТРЕЛЬНОСТЬ ОРУЖИЯ +14%',
  'SEK WEAPON': 'ОРУЖИЕ САМОНАВОДЧИК', 'RKT WEAPON': 'ОРУЖИЕ РАКЕТНИЦА', 'BULLET RICOCHET +1': 'ОТСКОК ПУЛЬ +1', 'BULLET RANGE +22%': 'ДАЛЬНОСТЬ ПУЛЬ +22%',
  'FIRE BULLETS': 'ОГНЕННЫЕ ПУЛИ', 'FREEZE BULLETS': 'ЛЕДЯНЫЕ ПУЛИ', 'POISON BULLETS': 'ЯДОВИТЫЕ ПУЛИ', 'DRONE ELEMENT LINK': 'СТАТУСЫ ДРОНОВ',
  'ELEMENT AMP +25%': 'СТАТУСЫ +25%', 'STATUS SPREAD': 'ПЕРЕНОС СТАТУСОВ', 'BULLET LINK +1': 'СВЯЗЬ ПУЛЬ +1',
  'SHG TEETH +2 PELLETS': 'ДРОБОВИК: +2 ДРОБИНЫ', 'SHG LONGSHOT': 'ДРОБОВИК: ДАЛЬНИЙ ВЫСТРЕЛ', 'SEK SPLIT ON KILL': 'САМОНАВОДЧИК: ФРАГМЕНТЫ', 'SEK CHAIN LOCK': 'САМОНАВОДЧИК: СИЛЬНЫЙ ЗАХВАТ', 'SEK SWARM': 'САМОНАВОДЧИК: РОЙ',
  'RKT CLUSTER +2': 'РАКЕТНИЦА: +2 МИНИ-ВЗРЫВА', 'RKT STATIC MINES': 'РАКЕТНИЦА: СТАТИК-МИНЫ', 'RKT STUN BLAST': 'РАКЕТНИЦА: ОГЛУШЕНИЕ', 'RKT SCATTER BLAST': 'РАКЕТНИЦА: ОТБРОС', 'RKT REMOTE': 'РАКЕТНИЦА: РУЧНОЙ ВЗРЫВ',
  'MOBILITY +12%': 'МОБИЛЬНОСТЬ +12%', 'DASH FLOW +20%': 'РЫВОК: ВОССТАНОВЛЕНИЕ +20%', 'SIDE UPGRADE': 'ДОП. УСИЛЕНИЕ',
  'BOSS CUT': 'ГЛАВНАЯ УГРОЗА-КОНТРАКТ', 'SAFE CASHOUT': 'БЕЗОПАСНЫЙ ВЫХОД', 'HUNTER WAVES': 'ОХОТНИЧЬИ ВОЛНЫ', 'VIRUS CLEAN': 'ОЧИСТКА ВИРУСА',
  'WIRE GHOST': 'ПРОЙТИ БЕЗ ПРОВОДОВ', 'GRID WALKER': 'ПРОЙТИ СЕТКУ', 'BLOOD PAID': 'КРОВАВАЯ ОПЛАТА', 'STATIC CLEAN': 'ЧИСТАЯ СТАТИКА',
  'CACHE CLAIM': 'ЗАБРАТЬ ОБЛИК', 'FAST CLEAN': 'БЫСТРАЯ ЗАЧИСТКА', 'NO HIT TAPE': 'БЕЗ УРОНА', 'CLEAN SIGNAL': 'ЧИСТЫЙ СИГНАЛ',
  'NEXT SECTOR FAVOR': 'ПРИЗ СЛЕДУЮЩЕГО СЕКТОРА', 'NEXT SECTOR PRIZE': 'ПРИЗ СЛЕДУЮЩЕГО СЕКТОРА', 'NEXT SECTOR BONUS': 'БОНУС СЛЕДУЮЩЕГО СЕКТОРА',

  'SHG LONGSHOT RMB': 'ДРОБОВИК: ДАЛЬНИЙ ВЫСТРЕЛ', 'SEK SWARM RMB': 'САМОНАВОДЧИК: РОЙ', 'RKT STUN BLASTS': 'РАКЕТНИЦА: ОГЛУШЕНИЕ', 'RKT SCATTER BLASTS': 'РАКЕТНИЦА: ОТБРОС', 'RKT REMOTE DETONATOR': 'РАКЕТНИЦА: РУЧНОЙ ВЗРЫВ',
  'VIRUS CLEANUP': 'ОЧИСТКА ВИРУСА', 'PRISM CLEANUP': 'ЗАЧИСТКА ПРИЗМЫ', 'BLOOD CLEANUP': 'КРОВАВАЯ ЗАЧИСТКА', 'STATIC CLEANUP': 'ЧИСТАЯ СТАТИКА', 'FAST CLEANUP': 'БЫСТРАЯ ЗАЧИСТКА', 'NO-HIT CLEANUP': 'БЕЗ УРОНА', 'FULL CLEANUP': 'ПОЛНАЯ ЗАЧИСТКА',
  'GRID SLOW CLEAR': 'ЗАЧИСТКА СЕТКИ', 'BLOOD TAX': 'КРОВАВАЯ ОПЛАТА', 'BLOOD PAYMENT': 'КРОВАВАЯ ОПЛАТА', 'STATIC STORM': 'СТАТИК-ШТОРМ', 'STATIC NODE': 'СТАТИК-УЗЕЛ', 'SHIFTING ZONES': 'ДВИЖУЩИЕСЯ ЗОНЫ', 'PRISM GRID': 'ПРИЗМ-СЕТКА', 'GOLD FEVER': 'ЗОЛОТАЯ ЛИХОРАДКА', 'CASINO VIRUS': 'КАЗИНО-ВИРУС', 'ANCHOR GRAVITY': 'ЯКОРЯ ГРАВИТАЦИИ', 'ECHO SHOTS': 'ЭХО-ВЫСТРЕЛЫ', 'BLACKOUT': 'ТЕМНОТА', 'SKN CACHE': 'ТАЙНИК ОБЛИКА',
  'TARGET LOCK': 'ЗАХВАТ ЦЕЛИ', 'REDLINE BOOST': 'КРАСНАЯ ЛИНИЯ', 'GHOST DECOY': 'ПРИЗРАК-ПРИМАНКА', 'REWIND MARK': 'МЕТКА ОТКАТА', 'KILL SWITCH': 'КНОПКА УДАЛЕНИЯ', 'SPAWN HOLD': 'ЗАДЕРЖКА СПАВНА', 'AEGIS PROCESS': 'ЭГИДА', 'MIRROR PAYOUT': 'ЗЕРКАЛЬНЫЙ ПРИЗ', 'NULL REVIVAL': 'НУЛЕВОЕ ВОССТАНОВЛЕНИЕ', 'ROOM WAGER': 'СТАВКА СЕКТОРА', 'BOSS KEY': 'КЛЮЧ ЯДРА', 'THREAT SIGNATURE': 'СИГНАТУРА УГРОЗЫ', 'SIGNATURE EXTRACTED': 'СИГНАТУРА ИЗВЛЕЧЕНА',
  'BASIC': 'ОБЫЧНЫЙ', 'UNCOMMON': 'НЕОБЫЧНЫЙ', 'RARE': 'РЕДКИЙ', 'SUPER RARE': 'СВЕРХРЕДКИЙ', 'LEGENDARY': 'ЛЕГЕНДАРНЫЙ',
  'Q: BLOOD PULSE': 'Q: КРОВАВЫЙ ИМПУЛЬС', 'Q: FIELD SNAP': 'Q: СТЯЖКА ПОЛЯ', 'Q: OVERCLOCK': 'Q: РАЗГОН',
  'BLOOD RING': 'КРОВАВОЕ КОЛЬЦО', 'FIELD SNAP': 'СТЯЖКА ПОЛЯ', 'BULLET FREEZE': 'ЗАМОРОЗКА ПУЛЬ', 'SHELL RIPPER': 'РАЗРЫВ ЩИТА', 'VOID CUT': 'РАЗРЕЗ ПУСТОТЫ', 'SIGNAL SPIKE': 'СИГНАЛЬНЫЙ ШИП', 'BLACK BOX': 'ЧЁРНЫЙ ЯЩИК', 'STATIC PULSE': 'СТАТИК-ИМПУЛЬС',
  'LOCK': 'ФИКСАЦИЯ', 'REEL': 'ЯЧЕЙКА', 'CELL': 'ЯЧЕЙКА', 'NEXT': 'СЛЕД.',
  'SIMPLE': 'ПРОСТОЙ', 'GOOD': 'ЦЕННЫЙ', 'VALUABLE': 'ДОРОГОЙ', 'PREMIUM': 'ПРЕМИУМ', 'WPN GOOD': 'WPN ЦЕННЫЙ', 'WPN VALUABLE': 'WPN ДОРОГОЙ', 'WPN PREMIUM': 'WPN ПРЕМИУМ', 'ABL GOOD': 'ABL ЦЕННЫЙ', 'ABL VALUABLE': 'ABL ДОРОГОЙ', 'ABL PREMIUM': 'ABL ПРЕМИУМ',
  'NEXT CHEST +1 OPTION': 'СЛЕД. СУНДУК +1 ВЫБОР', 'NEXT CHEST +2 OPTION': 'СЛЕД. СУНДУК +2 ВЫБОРА', 'STATIC STORM BANKED': 'СТАТИК-ШТОРМ ОТЛОЖЕН', 'DASH CHARGE': 'ЗАРЯД РЫВКА',
  'STATIC': 'СТАТИК', 'BLOOD': 'КРОВЬ', 'ECHO': 'ЭХО', 'SHRAPNEL': 'ОСКОЛКИ', 'CASINO': 'КАЗИНО', 'VOID': 'ПУСТОТА', 'LEECH': 'ВАМПИРИЗМ', 'ARMOR CRACK': 'РАЗЛОМ БРОНИ', 'ANCHOR': 'ЯКОРЬ', 'HUNGER': 'ГОЛОД', 'BAD TAPE': 'ПЛОХАЯ ПЛЁНКА'
};
const EN_LABEL = Object.fromEntries(Object.entries(RU_LABEL).map(([en, ru]) => [ru, en]));
Object.assign(EN_LABEL, {
  'СТАТИК-ЯДРО': 'STATIC CORE', 'СТАТИК-УЗЕЛ': 'STATIC NODE', 'СКОРОСТРЕЛЬНОСТЬ ОРУЖИЯ +14%': 'WEAPON RATE +14%', 'УРОН ОРУЖИЯ +18%': 'WEAPON DMG +18%',
  'РЫВОК: РУЧНОЙ ВЗРЫВ': 'RKT REMOTE DETONATOR', 'СТАТИК Q': 'STATIC CORE', 'STATIC Q': 'STATIC CORE'
});

const RU_DYNAMIC_LABEL = {
  SHOTGUN: 'ДРОБОВИК', SEEKER: 'САМОНАВОДЧИК', ROCKETGUN: 'РАКЕТНИЦА',
  WPN: 'ОРУЖИЕ', ABL: 'ПРОТОКОЛ', RAR: 'РЕДКИЙ', LUCK: 'УДАЧА',
  GUARD: 'ЗАЩИТА', CHAIN: 'ЦЕПЬ', BET: 'СТАВКА', COPY: 'КОПИЯ', GHOST: 'ПРИЗРАК',
  JACKPOT: 'ДЖЕКПОТ', TABLE: 'КАРТА', ZERO: 'НОЛЬ', AUTOPLAY: 'АВТО-ОГОНЬ',
  POWER: 'СИЛА', ODDS: 'ШАНС', SECTOR: 'СЕКТОР', ACTION: 'ДЕЙСТВИЕ', GUN: 'ПУШКА',
  LIVE: 'ЖИВОЕ', CASINO: 'КАЗИНО', PICK: 'ВЫБОР', CHEST: 'СУНДУК', SELECT: 'ВЫБЕРИ',
  OPTION: 'ВАРИАНТ', OPTIONS: 'ВАРИАНТЫ', SLOTS: 'СЛОТЫ', SLOT: 'СЛОТ',
  ENEMY: 'УГРОЗА', ENEMIES: 'УГРОЗЫ', BOSS: 'ГЛАВНАЯ УГРОЗА', ROOM: 'СЕКТОР', SKIN: 'ОБЛИК'
};
const EN_DYNAMIC_LABEL = Object.assign(Object.fromEntries(Object.entries(RU_DYNAMIC_LABEL).map(([en, ru]) => [ru, en])), {
  'ПУШКА': 'GUN', 'ДЕЙСТВИЕ': 'ACTION', 'ЗАЩИТА': 'GUARD', 'ЦЕПЬ': 'CHAIN', 'СТАВКА': 'BET', 'КОПИЯ': 'COPY', 'ПРИЗРАК': 'GHOST', 'КАРТА': 'TABLE', 'УДАЧА': 'LUCK', 'ОРУЖИЕ': 'WEAPON', 'ПРОТОКОЛ': 'PROTOCOL', 'ГЛАВНАЯ УГРОЗА': 'CORE THREAT', 'УГРОЗА': 'THREAT', 'УГРОЗЫ': 'THREATS', 'ОБЛИК': 'SHELL', 'СЕКТОР': 'SECTOR'
});
function dynamicRuLabel(s) {
  let out = String(s || '');
  const exact = {
    'ПУШКА: LVC': 'ПУШКА: КАЗИНО', 'ПУШКА: RLT': 'ПУШКА: РУЛЕТКА', 'ПУШКА: CRD': 'ПУШКА: КОЛОДА',
    'ДЕЙСТВИЕ: GUARD': 'ДЕЙСТВИЕ: ЗАЩИТА', 'ДЕЙСТВИЕ: CHAIN': 'ДЕЙСТВИЕ: ЦЕПЬ', 'ДЕЙСТВИЕ: BET': 'ДЕЙСТВИЕ: СТАВКА',
    'ДЕЙСТВИЕ: COPY': 'ДЕЙСТВИЕ: КОПИЯ', 'ДЕЙСТВИЕ: GHOST': 'ДЕЙСТВИЕ: ПРИЗРАК', 'ДЕЙСТВИЕ: JACKPOT': 'ДЕЙСТВИЕ: ДЖЕКПОТ', 'ДЕЙСТВИЕ: TABLE': 'ДЕЙСТВИЕ: КАРТА',
    'LVC AUTOPLAY': 'КАЗИНО: АВТО-ОГОНЬ', 'COPY POWER +10%': 'КОПИЯ: СИЛА +10%', 'BET ODDS +1': 'СТАВКА: ШАНС +1',
    'LIVE CASINO': 'ЖИВОЕ КАЗИНО', 'WPN CHEST': 'ОРУЖЕЙНЫЙ СУНДУК', 'ABL CHEST': 'СУНДУК ПРОТОКОЛОВ', 'BOSS SIG OFFER': 'ПРИЗ ГЛАВНОЙ УГРОЗЫ'
  };
  if (exact[out]) return exact[out];
  out = out.replace(/SHOTGUN/g, 'ДРОБОВИК').replace(/SEEKER/g, 'САМОНАВОДЧИК').replace(/ROCKETGUN/g, 'РАКЕТНИЦА')
    .replace(/\bGUARD\b/g, 'ЗАЩИТА').replace(/\bCHAIN\b/g, 'ЦЕПЬ').replace(/\bBET\b/g, 'СТАВКА').replace(/\bCOPY\b/g, 'КОПИЯ').replace(/\bGHOST\b/g, 'ПРИЗРАК').replace(/\bTABLE\b/g, 'КАРТА')
    .replace(/\bZERO\b/g, 'НОЛЬ').replace(/\bAUTOPLAY\b/g, 'АВТО-ОГОНЬ').replace(/\bPOWER\b/g, 'СИЛА').replace(/\bODDS\b/g, 'ШАНС')
    .replace(/\bWPN\b/g, 'ОРУЖИЕ').replace(/\bABL\b/g, 'ПРОТОКОЛ').replace(/\bPICK\b/g, 'ВЫБОР').replace(/\bCHEST\b/g, 'СУНДУК')
    .replace(/\bENEMY\b/g, 'УГРОЗА').replace(/\bENEMIES\b/g, 'УГРОЗЫ').replace(/\bBOSS\b/g, 'ГЛАВНАЯ УГРОЗА').replace(/\bROOM\b/g, 'СЕКТОР').replace(/\bSKIN\b/g, 'ОБЛИК');
  return out;
}
function dynamicEnLabel(s) {
  let out = String(s || '');
  const exact = {
    'ПУШКА: LVC': 'GUN: LVC', 'ПУШКА: RLT': 'GUN: ROULETTE', 'ПУШКА: CRD': 'GUN: DECK',
    'ДЕЙСТВИЕ: GUARD': 'ACTION: GUARD', 'ДЕЙСТВИЕ: CHAIN': 'ACTION: CHAIN', 'ДЕЙСТВИЕ: BET': 'ACTION: BET', 'ДЕЙСТВИЕ: COPY': 'ACTION: COPY', 'ДЕЙСТВИЕ: GHOST': 'ACTION: GHOST', 'ДЕЙСТВИЕ: JACKPOT': 'ACTION: JACKPOT', 'ДЕЙСТВИЕ: TABLE': 'ACTION: TABLE',
    'КАЗИНО: АВТО-ОГОНЬ': 'CASINO AUTOFIRE', 'КОПИЯ: СИЛА +10%': 'COPY POWER +10%', 'СТАВКА: ШАНС +1': 'BET ODDS +1'
  };
  if (exact[out]) return exact[out];
  out = out.replace(/ГЛАВНАЯ УГРОЗА/g, 'CORE THREAT').replace(/УГРОЗЫ/g, 'THREATS').replace(/УГРОЗА/g, 'THREAT').replace(/ОБЛИК/g, 'SHELL').replace(/СЕКТОР/g, 'SECTOR')
    .replace(/ПУШКА/g, 'GUN').replace(/ДЕЙСТВИЕ/g, 'ACTION').replace(/ЗАЩИТА/g, 'GUARD').replace(/ЦЕПЬ/g, 'CHAIN').replace(/СТАВКА/g, 'BET').replace(/КОПИЯ/g, 'COPY').replace(/ПРИЗРАК/g, 'GHOST').replace(/КАРТА/g, 'TABLE')
    .replace(/ДРОБОВИК/g, 'SHOTGUN').replace(/САМОНАВОДЧИК/g, 'SEEKER').replace(/РАКЕТНИЦА/g, 'ROCKETGUN').replace(/ОРУЖИЕ/g, 'WEAPON').replace(/ПРОТОКОЛ/g, 'PROTOCOL')
    .replace(/СУНДУК/g, 'CHEST').replace(/ВЫБОР/g, 'PICK').replace(/УДАЧА/g, 'LUCK');
  return out;
}

export function locLabel(label) {
  const s = String(label || '');
  if (!langIsEn()) return dynamicRuLabel(RU_LABEL[s] || s);
  const exact = EN_LABEL[s] || EN_LABEL[s.toUpperCase?.() || s] || {
    'ВЫБОР WPN': 'WEAPON PICK', 'ВЫБОР ABL': 'PROTOCOL PICK', 'ВЫБОР ОРУЖИЯ': 'WEAPON PICK', 'ВЫБОР Q': 'PROTOCOL PICK', 'УЖЕ ЕСТЬ': 'ALREADY OWNED', 'НЕТ ВАРИАНТА': 'NO OPTION',
    'НЕТ АКТИВКИ': 'NO ACTIVE', 'НЕТ Q': 'NO Q', 'ВЗЯЛ': 'TOOK', 'ЗАМЕНИТЬ': 'REPLACE', 'НУЖЕН': 'NEED',
    'STATIC Q': 'STATIC CORE'
  }[s];
  let out = dynamicEnLabel(exact || s.replace('ВЫБОР WPN', 'WEAPON PICK').replace('ВЫБОР ABL', 'PROTOCOL PICK').replace('ЗАМЕНИТЬ:', 'REPLACE:').replace('НУЖЕН ', 'NEED '));
  if (/[А-Яа-яЁё]/.test(out)) out = 'CHOICE';
  return out;
}
export function locReward(r) { return locLabel(r); }
export function groupLabel(g) { const v = String(g || '').toUpperCase(); if (langIsEn()) return v === 'CORE' ? 'Q' : v; const ru = { CORE: 'Q', MUTATION: 'МУТАЦИЯ', SIDE: 'ДОП.', UPGRADE: 'УСИЛЕНИЕ' }; return ru[v] || v; }
export function disabledReason(reason) {
  const r = String(reason || '');
  if (!langIsEn()) return cleanPlayerText(r || t('requiresOtherWeapon'));
  if (/оруж|weapon/i.test(r)) return t('requiresOtherWeapon');
  if (/услов/i.test(r)) return 'requirement not met';
  const out = r || t('requiresOtherWeapon');
  return /[А-Яа-яЁё]/.test(out) ? t('requiresOtherWeapon') : out;
}
export function objectStateText(opened, cost, currency = 'GLD') {
  if (opened) return t('chestOpened');
  if (cost > 0) {
    const cur = String(currency || 'GLD').toUpperCase();
    if (cur === 'HP') return localText(`Цена: ${cost} здоровья`, `Price: ${cost} HP`);
    return t('price', { cost });
  }
  return t('chestFree');
}
export function priceText(cost, currency = 'GLD') {
  const cur = String(currency || 'GLD').toUpperCase();
  if (cur === 'HP') return localText(`${cost} здоровья`, `${cost} HP`);
  return localText(`${cost} кредитов`, `${cost} GLD`);
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
  setHTML('menu-controls', localText(`<span class="term" data-explain-title="${t('controlsTitle')}" data-explain="${t('controlsBody')}">WASD</span> — ${t('movement')} · <span class="term">ЛКМ</span> — ${t('fire')} · <span class="term">ПКМ</span> — второй огонь · <span class="term">Пробел</span> — ${t('inspect')} · <span class="term">Shift</span> — ${t('dash')} · <span class="term">E</span> — ${t('interact')} · <span class="term">Q</span> — ${t('qActive')} · <span class="term">Tab</span> — ${t('panel')}`, `<span class="term" data-explain-title="${t('controlsTitle')}" data-explain="${t('controlsBody')}">WASD</span> — ${t('movement')} · <span class="term">LMB</span> — ${t('fire')} · <span class="term">RMB</span> — secondary fire · <span class="term">Space</span> — ${t('inspect')} · <span class="term">Shift</span> — ${t('dash')} · <span class="term">E</span> — ${t('interact')} · <span class="term">Q</span> — ${t('qActive')} · <span class="term">Tab</span> — ${t('panel')}`));
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
  setExplainSel('#weapon-modal .hint .term', localText('ВЫБОР ОРУЖИЯ', 'WPN PICK'), t('quickPickBody'));
  const wh = document.querySelector('#weapon-modal .hint'); if (wh) wh.lastChild && (wh.lastChild.textContent = ` — ${t('chooseAvailable')}`);
  setExplainSel('#ability-modal .panel-title', t('ablChestTitle'), t('ablChestBody'));
  setExplainSel('#ability-modal .hint .term', localText('ВЫБОР Q', 'ABL PICK'), t('quickPickBody'));
  const ah = document.querySelector('#ability-modal .hint'); if (ah) ah.lastChild && (ah.lastChild.textContent = ` — ${t('chooseOption')}`);
  setExplainSel('#casino-modal .panel-title', t('betTitle'), t('betBody'), 'red');
  document.querySelectorAll('#casino-stakes button').forEach(btn => {
    delete btn.dataset.explainTitle;
    delete btn.dataset.explain;
    delete btn.dataset.explainTone;
  });
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
  setExplainId('audio-settings', localText('ЗВУК', 'AUDIO'), localText('Раздельная громкость музыки и игровых звуков. Сохраняется на этом устройстве.', 'Separate music and SFX volume. Saved on this device.'));
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
