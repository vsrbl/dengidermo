const http = require('http');
const { WebSocketServer } = require('ws');

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
    if(ws.readyState !== ws.OPEN) {
        return;
    }

    ws.send(JSON.stringify(packet));
}

function broadcastToRoom(room, packet) {
    for(const client of room.clients.values()) {
        send(client.ws, packet);
    }
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
        broadcastToRoom(room, {
            type: 'host-left'
        });

        rooms.delete(ws.roomId);
        return;
    }

    if(ws.role === 'client') {
        room.clients.delete(ws.playerId);

        if(room.host && room.host.readyState === room.host.OPEN) {
            send(room.host, {
                type: 'player-left',
                playerId: ws.playerId
            });
        }
    }
}

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
    });

    res.end('nncckkrr.space relay server');
});

const wss = new WebSocketServer({
    server
});

wss.on('connection', ws => {
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

            if(!room || !room.host || room.host.readyState !== room.host.OPEN) {
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
            return;
        }

        const room = rooms.get(ws.roomId);

        if(!room) {
            return;
        }

        if(ws.role === 'client' && packet.type === 'input') {
            if(room.host && room.host.readyState === room.host.OPEN) {
                send(room.host, {
                    type: 'input',
                    playerId: ws.playerId,
                    input: packet.input || {}
                });
            }

            return;
        }

        if(ws.role === 'client' && packet.type === 'leave') {
            cleanupSocket(ws);
            ws.close();
            return;
        }

        if(ws.role === 'host' && packet.type === 'snapshot') {
            broadcastToRoom(room, {
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

server.listen(PORT, () => {
    console.log(`nncckkrr.space relay server started on ${PORT}`);
});
