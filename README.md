# DengiDermo P2P starter

Готовая база под:

- GitHub Pages: статический клиент из корня репозитория
- Custom domain: `nncckkrr.com`
- Render Free: WebSocket signaling server в папке `server`
- WebRTC DataChannel: игровые сообщения напрямую между двумя игроками

## Что внутри

```txt
.
├── index.html              # клиент для GitHub Pages
├── style.css
├── CNAME                   # nncckkrr.com
├── js/
│   ├── config.js           # адрес Render-сервера
│   ├── main.js             # UI, комнаты, подключение
│   ├── signaling.js        # WebSocket signaling
│   ├── peer.js             # WebRTC P2P
│   └── game.js             # простой canvas-прототип
├── server/
│   ├── package.json
│   └── src/index.js        # Render signaling server
└── render.yaml             # Blueprint для Render
```

## Как залить в твою репу

Репа: <https://github.com/vsrbl/dengidermo/tree/main>

1. Распакуй архив.
2. Скопируй файлы в корень репозитория `dengidermo`.
3. Закоммить и запушь:

```bash
git add .
git commit -m "restart p2p roguelike base"
git push
```

## Локальный запуск

### 1. Сервер

```bash
cd server
npm install
npm run dev
```

Сервер будет тут:

```txt
ws://localhost:10000
```

### 2. Клиент

Можно открыть `index.html` через любой локальный статический сервер. Самый простой вариант:

```bash
python3 -m http.server 5173
```

Потом открыть:

```txt
http://localhost:5173
```

Открой две вкладки. В первой создай комнату, во второй введи код комнаты и подключись.

## Деплой сервера на Render

Вариант A — через Blueprint:

1. На Render нажми `New` → `Blueprint`.
2. Подключи GitHub-репу.
3. Render увидит `render.yaml`.
4. Создай сервис.

Вариант B — вручную:

```txt
Type: Web Service
Root Directory: server
Build Command: npm install
Start Command: npm start
Health Check Path: /health
Plan: Free
```

После деплоя Render даст адрес вида:

```txt
https://dengidermo-1.onrender.com
```

В `js/config.js` замени:

```js
"wss://dengidermo-1.onrender.com"
```

на реальный адрес своего Render-сервиса.

Важно: на сайте с HTTPS надо использовать именно `wss://`, не `ws://`.

## GitHub Pages

В настройках репозитория:

```txt
Settings → Pages → Deploy from a branch → main → /root
```

Для домена:

```txt
Custom domain: nncckkrr.com
```

Файл `CNAME` уже лежит в архиве.

## Что уже работает

- создание комнаты;
- подключение второго игрока;
- обмен WebRTC offer/answer/ice через Render;
- P2P DataChannel;
- тестовый ping;
- простая canvas-арена;
- передача позиции игрока;
- тестовый босс с HP.

## Следующий правильный шаг

После проверки подключения надо сделать нормальный игровой протокол:

```js
{
  type: "player-input",
  tick,
  input: { up, down, left, right, attack }
}

{
  type: "world-snapshot",
  tick,
  players,
  enemies,
  boss
}
```

И затем перейти к схеме:

- host = авторитетный мир;
- client отправляет только input;
- host считает врагов, босса, урон, комнаты;
- client получает snapshots.
