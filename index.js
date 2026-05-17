const { PeerServer } = require('peer');

const PORT = process.env.PORT || 9000;

PeerServer({
    port: PORT,
    path: '/myapp',
    proxied: true,
    corsOptions: {
        origin: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: false
    }
});

console.log(`PeerJS server started on ${PORT}`);
