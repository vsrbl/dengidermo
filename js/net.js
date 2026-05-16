import Peer from 'peerjs';

import {
    NET_TICK,
    FIRE_RATE,
    MAX_PLAYERS
} from './constants.js';

import {
    world,
    renderState
} from './entities.js';

import {
    createPlayer,
    movePlayer,
    shootBullet
} from './world.js';

export let peer = null;

export let hostConnection = null;

export let connections = {};

export let myId = null;

export let isHost = false;

const peerConfig = {
    host: 'dengidermo-1.onrender.com',
    port: 443,
    path: '/myapp',
    secure: true
};

export function startHost(canvas) {

    isHost = true;

    peer = new Peer(peerConfig);

    peer.on('open', id => {

        myId = id;

        createPlayer(id, canvas);
    });

    peer.on('connection', conn => {

        if(
            Object.keys(connections).length >=
            MAX_PLAYERS - 1
        ) {
            conn.close();
            return;
        }

        connections[conn.peer] = conn;

        createPlayer(conn.peer, canvas);

        conn.on('data', data => {

            if(data.type === 'input') {

                const p = world.players[conn.peer];

                if(!p) return;

                movePlayer(p, data.input, canvas);

                if(data.input.mouseDown) {

                    const now = Date.now();

                    if(now - p.lastShot > FIRE_RATE) {

                        p.lastShot = now;

                        shootBullet(
                            p,
                            data.input.mouseX,
                            data.input.mouseY
                        );
                    }
                }
            }
        });
    });
}

export function connectToHost(hostId) {

    peer = new Peer(peerConfig);

    peer.on('open', id => {

        myId = id;

        hostConnection = peer.connect(hostId, {
            reliable:true
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
    });
}

export function sendSnapshot() {

    const packet = {
        type:'snapshot',
        players:{},
        bullets:world.bullets,
        loot:world.loot
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

        if(connections[id].open) {

            connections[id].send(packet);
        }
    }
}
