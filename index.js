const { PeerServer } = require('peer');

const PORT = process.env.PORT || 9000;

// Список разрешенных адресов (твои сайты)
const ALLOWED_ORIGINS = [
  'https://nncckkrr.space',  // Твой основной домен
  'http://nncckkrr.space',   // На всякий случай (если зайдут без https)
  'http://127.0.0.1:5500',   // Для тестов на твоем компе
  'http://localhost:5500'    // Для тестов на твоем компе
];

const peerServer = PeerServer({
  port: PORT,
  path: '/myapp',
  corsOptions: {
    origin: ALLOWED_ORIGINS, // Пускаем только твой сайт!
    methods: ['GET', 'POST']
  }
});

console.log(`Сигнальный сервер запущен на порту ${PORT}`);
console.log(`Доступ разрешен для:`, ALLOWED_ORIGINS);
