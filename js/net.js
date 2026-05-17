import {

    world,
    renderState

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
            delete renderState.players[conn.peer];
        });
    });
}

export function connectToHost(hostId) {

    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {

        myId = id;

        ensurePlayer(id);

        hostConnection =
            peer.connect(hostId);

        hostConnection.on('open', () => {

            document.getElementById('hud-id')
                .innerText = hostId;
        });

        hostConnection.on('data', packet => {

            if(packet.type !== 'snapshot') {
                return;
            }

            for(const id in packet.players) {

                const incoming =
                    packet.players[id];

                ensurePlayer(id);

                if(id === myId) {

                    world.players[id].x =
                        world.players[id].x * 0.5 +
                        incoming.x * 0.5;

                    world.players[id].y =
                        world.players[id].y * 0.5 +
                        incoming.y * 0.5;

                    continue;
                }

                world.players[id].x = incoming.x;
                world.players[id].y = incoming.y;
            }
        });
    });
}

export function sendInput(input) {

    if(isHost) {
        applyInput(myId, input);
        return;
    }

    if(!hostConnection?.open) {
        return;
    }

    hostConnection.send({

        type:'input',
        input
    });
}

export function broadcastSnapshot() {

    const snapshot = {

        type:'snapshot',

        players:{}
    };

    for(const id in world.players) {

        snapshot.players[id] = {

            x:world.players[id].x,
            y:world.players[id].y
        };
    }

    for(const id in peers) {

        if(peers[id].open) {

            peers[id].send(snapshot);
        }
    }
}
