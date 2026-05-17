import {

    world,
    renderState

} from './entities.js';

import {

    createPlayer,
    movePlayer

} from './world.js';

export let isHost = false;

export let myId = null;

export let hostConnection = null;

export let connections = {};

let peer = null;

const PEER_CONFIG = {

    host: 'dengidermo-1.onrender.com',

    secure: true,

    port: 443,

    path: '/myapp'
};

export function startHost(canvas) {

    isHost = true;

    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {

        myId = id;

        createPlayer(id, canvas);

        renderState.players[id] = {

            x: canvas.width / 2,
            y: canvas.height / 2,

            tx: canvas.width / 2,
            ty: canvas.height / 2
        };

        document.getElementById('hud-id')
            .innerText = id;

        document.getElementById('hud-count')
            .innerText = '1';
    });

    peer.on('connection', conn => {

        connections[conn.peer] = conn;

        createPlayer(conn.peer, canvas);

        renderState.players[conn.peer] = {

            x: canvas.width / 2,
            y: canvas.height / 2,

            tx: canvas.width / 2,
            ty: canvas.height / 2
        };

        document.getElementById('hud-count')
            .innerText =
            Object.keys(world.players).length;

        conn.on('data', data => {

            const p = world.players[conn.peer];

            if(!p) return;

            movePlayer(
                p,
                data,
                canvas
            );

            renderState.players[conn.peer].tx = p.x;
            renderState.players[conn.peer].ty = p.y;
        });

        conn.on('close', () => {

            delete connections[conn.peer];

            delete world.players[conn.peer];

            delete renderState.players[conn.peer];

            document.getElementById('hud-count')
                .innerText =
                Object.keys(world.players).length;
        });
    });
}

export function connectToHost(hostId) {

    peer = new Peer(PEER_CONFIG);

    peer.on('open', () => {

        hostConnection =
            peer.connect(hostId);

        hostConnection.on('open', () => {

            document.getElementById('hud-id')
                .innerText = hostId;
        });

        hostConnection.on('data', packet => {

            document.getElementById('hud-count')
                .innerText = packet.playerCount;

            for(let id in packet.players) {

                const p = packet.players[id];

                if(!renderState.players[id]) {

                    renderState.players[id] = {

                        x:p.x,
                        y:p.y,

                        tx:p.x,
                        ty:p.y
                    };
                }

                renderState.players[id].tx = p.x;
                renderState.players[id].ty = p.y;
            }
        });
    });
}

export function sendSnapshot() {

    const packet = {

        players: world.players,

        playerCount:
            Object.keys(world.players).length
    };

    for(let id in connections) {

        const conn = connections[id];

        if(conn.open) {

            conn.send(packet);
        }
    }
}
