import {
    world
} from './entities.js';

import {
    ensurePlayer,
    applyInput
} from './world.js';

export let peer = null;

export let hostConnection = null;

export let isHost = false;

export let myId = null;

export const peers = {};

const PEER_CONFIG = {

    host:'dengidermo-1.onrender.com',

    secure:true,

    port:443,

    path:'/myapp'
};

export function startHost() {

    isHost = true;

    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {

        myId = id;

        ensurePlayer(id);

        document.getElementById('hud-id')
            .innerText = id;
    });

    peer.on('connection', conn => {

        peers[conn.peer] = conn;

        ensurePlayer(conn.peer);

        conn.on('data', packet => {

            if(packet.type !== 'input') {
                return;
            }

            applyInput(
                conn.peer,
                packet.input
            );
        });

        conn.on('close', () => {

            delete peers[conn.peer];
            delete world.players[conn.peer];
        });
    });
}
}
