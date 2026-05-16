import {
    world,
    renderState
} from './entities.js';

import {
    createPlayer,
    movePlayer,
    shootBullet
} from './world.js';

import {
    FIRE_RATE,
    MAX_PLAYERS
} from './constants.js';

export let peer = null;
export let hostConnection = null;
export let connections = {};

export let myId = null;
export let isHost = false;

const PEER_CONFIG = {
    host: 'dengidermo-1.onrender.com',
    secure: true,
    port: 443,
    path: '/myapp',

    config: {
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302'
            }
        ]
    }
};

export function startHost(canvas) {

    isHost = true;

    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {

        myId = id;

        createPlayer(id, canvas);

        console.log('HOST ID:', id);
    });

    peer.on('connection', conn => {

        if (
            Object.keys(connections).length >=
            MAX_PLAYERS - 1
        ) {
            conn.close();
            return;
        }

        connections[conn.peer] = conn;

        createPlayer(conn.peer, canvas);

        console.log('PLAYER JOIN:', conn.peer);

        conn.on('data', data => {

            if(data.type !== 'input') return;

            const p = world.players[conn.peer];

            if(!p) return;

            movePlayer(
                p,
                data.input,
                canvas
            );

            if(data.input.mouseDown) {

                const now = performance.now();

                if(now - p.lastShot > FIRE_RATE) {

                    p.lastShot = now;

                    shootBullet(
                        p,
                        data.input.mouseX,
                        data.input.mouseY
                    );
                }
            }
        });

        conn.on('close', () => {

            console.log('PLAYER LEFT:', conn.peer);

            delete connections[conn.peer];
            delete world.players[conn.peer];
            delete renderState.players[conn.peer];
        });
    });

    peer.on('error', err => {
        console.error(err);
    });
}

export function connectToHost(hostId) {

    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {

        myId = id;

        hostConnection = peer.connect(
            hostId,
            {
                reliable: true,
                serialization: 'json'
            }
        );

        hostConnection.on('open', () => {

            console.log('CONNECTED TO HOST');
        });

        hostConnection.on('data', packet => {

            if(packet.type !== 'snapshot') return;

            world.bullets = packet.bullets;
            world.loot = packet.loot;

            for(let id in packet.players) {

                const sp = packet.players[id];

                if(!renderState.players[id]) {

                    renderState.players[id] = {
                        x:sp.x,
                        y:sp.y,
                        tx:sp.x,
                        ty:sp.y,
                        score:0
                    };
                }

                renderState.players[id].tx = sp.x;
                renderState.players[id].ty = sp.y;
                renderState.players[id].score = sp.score;
            }
        });

        hostConnection.on('close', () => {

            console.log('DISCONNECTED');
        });

        hostConnection.on('error', err => {

            console.error(err);
        });
    });
}

export function sendSnapshot() {

    const packet = {
        type:'snapshot',

        players:{},

        bullets: world.bullets,

        loot: world.loot
    };

    for(let id in world.players) {

        const p = world.players[id];

        packet.players[id] = {
            x:p.x,
            y:p.y,
            score:p.score
        };
    }

    for(let id in connections) {

        const conn = connections[id];

        if(conn?.open) {

            conn.send(packet);
        }
    }
}
