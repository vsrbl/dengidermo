const { PeerServer } = require('peer');

const PORT = process.env.PORT || 9000;

const peerServer = PeerServer({
    port: PORT,
    path: '/myapp',
    proxied: true,
    corsOptions: {
        origin: [
            'https://nncckkrr.space',
            'https://www.nncckkrr.space',
            'https://vsb1.github.io',
            'http://localhost:5500',
            'http://127.0.0.1:5500'
        ],
        methods: ['GET', 'POST', 'OPTIONS']
    }
});

console.log(`PeerJS server started on ${PORT}`);
