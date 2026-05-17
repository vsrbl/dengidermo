import {

    world,
    renderState

} from './entities.js';

import {

    createPlayer,
    applyInput

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

export function startHost() {

    isHost = true;

    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {

        myId = id;

        createPlayer(id);

        const p = world.players[id];

        renderState.players[id] = {

            x:p.x,
            y:p.y,

            tx:p.x,
            ty:p.y
        };

        document.getElementById('hud-id')
            .innerText = id;

        document.getElementById('hud-count')
            .innerText = '1';
    });

    peer.on('connection', conn => {

        connections[conn.peer] = conn;

        createPlayer(conn.peer);

        const p = world.players[conn.peer];

        renderState.players[conn.peer] = {

            x:p.x,
            y:p.y,

            tx:p.x,
            ty:p.y
        };

        document.getElementById('hud-count')
            .innerText =
            Object.keys(world.players).length;

        conn.on('data', data => {

            if(data.type !== 'input')
                return;

            const player =
                world.players[conn.peer];

            if(!player) return;

            applyInput(
                player,
                data.input
            );
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

    peer.on('open', id => {

        myId = id;

        renderState.players[id] = {

            x:640,
            y:360,

            tx:640,
            ty:360,

            input: {

                w:false,
                a:false,
                s:false,
                d:false
            }
        };

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

                if(id !== myId) continue;

                renderState.players[id].x +=
                    (p.x - renderState.players[id].x) * 0.35;

                renderState.players[id].y +=
                    (p.y - renderState.players[id].y) * 0.35;
            }
        });
    });
}

export function sendSnapshot() {

    const players = {};

    for(const id in world.players) {

        const p = world.players[id];

        players[id] = {

            x:p.x,
            y:p.y
        };
    }

    const packet = {

        players,

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
