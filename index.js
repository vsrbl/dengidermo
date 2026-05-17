const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 9000;
const rooms = new Map();

function makeRoomId() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';

    for(let i = 0; i < 6; i++) {
        id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return id;
}

function send(ws, packet) {
    if(!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    try {
        ws.send(JSON.stringify(packet));
        return true;
    } catch(e) {
        return false;
    }
}

function broadcastToClients(room, packet) {
    for(const client of room.clients.values()) {
        send(client.ws, packet);
    }
}

function closeRoom(roomId) {
    const room = rooms.get(roomId);

    if(!room) {
        return;
    }

    broadcastToClients(room, {
        type: 'host-left'
    });

    rooms.delete(roomId);
}

function cleanupSocket(ws) {
    if(!ws.roomId) {
        return;
    }

    const room = rooms.get(ws.roomId);

    if(!room) {
        return;
    }

    if(ws.role === 'host') {
        closeRoom(ws.roomId);
        return;
    }

    if(ws.role === 'client') {
        room.clients.delete(ws.playerId);

        send(room.host, {
            type: 'player-left',
            playerId: ws.playerId
        });
    }
}

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
    });

    res.end('nncckkrr.space relay server: debug button fix');
});

const wss = new WebSocketServer({
    server
});

wss.on('connection', ws => {
    ws.isAlive = true;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', raw => {
        let packet;

        try {
            packet = JSON.parse(raw.toString());
        } catch(e) {
            send(ws, {
                type: 'error',
                message: 'Bad packet'
            });
            return;
        }

        if(packet.type === 'host') {
            let roomId = makeRoomId();

            while(rooms.has(roomId)) {
                roomId = makeRoomId();
            }

            const room = {
                id: roomId,
                host: ws,
                clients: new Map(),
                nextPlayerNumber: 2
            };

            rooms.set(roomId, room);

            ws.role = 'host';
            ws.roomId = roomId;
            ws.playerId = 'host';

            send(ws, {
                type: 'host-ready',
                roomId,
                playerId: 'host'
            });

            return;
        }

        if(packet.type === 'join') {
            const roomId = String(packet.roomId || '').trim().toUpperCase();
            const room = rooms.get(roomId);

            if(!room || !room.host || room.host.readyState !== WebSocket.OPEN) {
                send(ws, {
                    type: 'error',
                    message: 'Room not found'
                });
                return;
            }

            const playerId = `p${room.nextPlayerNumber++}`;

            ws.role = 'client';
            ws.roomId = roomId;
            ws.playerId = playerId;

            room.clients.set(playerId, {
                ws,
                playerId
            });

            send(ws, {
                type: 'joined',
                roomId,
                playerId
            });

            send(room.host, {
                type: 'player-joined',
                playerId
            });

            return;
        }

        if(!ws.roomId) {
            send(ws, {
                type: 'error',
                message: 'Not in room'
            });
            return;
        }

        const room = rooms.get(ws.roomId);

        if(!room) {
            send(ws, {
                type: 'error',
                message: 'Room closed'
            });
            return;
        }

        if(ws.role === 'client' && packet.type === 'input') {
            send(room.host, {
                type: 'input',
                playerId: ws.playerId,
                input: packet.input || {}
            });
            return;
        }

        if(ws.role === 'client' && packet.type === 'leave') {
            cleanupSocket(ws);
            ws.close();
            return;
        }

        if(ws.role === 'host' && packet.type === 'snapshot') {
            broadcastToClients(room, {
                type: 'snapshot',
                players: packet.players || {}
            });
            return;
        }
    });

    ws.on('close', () => {
        cleanupSocket(ws);
    });

    ws.on('error', () => {
        cleanupSocket(ws);
    });
});

const heartbeat = setInterval(() => {
    for(const ws of wss.clients) {
        if(ws.isAlive === false) {
            cleanupSocket(ws);
            ws.terminate();
            continue;
        }

        ws.isAlive = false;
        ws.ping();
    }
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeat);
});

server.listen(PORT, () => {
    console.log(`nncckkrr.space relay server started on ${PORT}`);
});
