import { world } from './entities.js';
import { ensurePlayer, applyInput } from './world.js';

export let peer = null;
export let hostConnection = null;
export let isHost = false;
export let myId = null;
export const peers = {};

const lastSeen = {};
const PEER_TIMEOUT = 10000;

const EMPTY_INPUT = {
    w:false,
    a:false,
    s:false,
    d:false
};

const PEER_CONFIG = {
    host: 'dengidermo-1.onrender.com',
    secure: true,
    port: 443,
    path: '/myapp'
};

function setStatus(text) {
    const el = document.getElementById('status');
    if (el) el.innerText = text;
}

function updateHud() {
    const count = document.getElementById('hud-count');
    if(count) {
        count.innerText = String(Object.keys(world.players).length);
    }
}

function setRoomId(id) {
    const room = document.getElementById('hud-id');
    if(room) {
        room.innerText = id;
    }
}

function clonePlayers() {
    return JSON.parse(JSON.stringify(world.players));
}

function removeRemotePlayer(id) {
    delete peers[id];
    delete lastSeen[id];
    delete world.players[id];
    updateHud();
}

function sendSnapshotTo(conn) {
    if(!conn?.open) {
        return;
    }

    conn.send({
        type: 'snapshot',
        players: clonePlayers()
    });
}

function handleHostPacket(conn, packet) {
    lastSeen[conn.peer] = performance.now();

    if(packet?.type === 'input') {
        applyInput(conn.peer, packet.input || EMPTY_INPUT);
        return;
    }

    if(packet?.type === 'leave') {
        removeRemotePlayer(conn.peer);
        broadcastSnapshot();
        return;
    }

    if(packet?.type === 'join') {
        ensurePlayer(conn.peer);
        sendSnapshotTo(conn);
    }
}

function cleanupTimedOutPlayers() {
    const now = performance.now();

    for(const id in peers) {
        const conn = peers[id];
        const timedOut = lastSeen[id] && now - lastSeen[id] > PEER_TIMEOUT;

        if(!conn?.open || timedOut) {
            try {
                conn?.close();
            } catch(e) {}

            removeRemotePlayer(id);
        }
    }
}

function rejectWithPeerError(reject, err) {
    console.error(err);
    setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
    reject(err);
}

export function startHost() {
    isHost = true;
    peer = new Peer(PEER_CONFIG);

    setStatus('Creating room...');

    return new Promise((resolve, reject) => {
        let settled = false;

        peer.on('open', id => {
            myId = id;
            ensurePlayer(id);
            lastSeen[id] = performance.now();
            setRoomId(id);
            setStatus(`Room ID: ${id}`);
            updateHud();

            settled = true;
            resolve(id);
        });

        peer.on('connection', conn => {
            peers[conn.peer] = conn;
            lastSeen[conn.peer] = performance.now();
            ensurePlayer(conn.peer);
            updateHud();

            conn.on('open', () => {
                lastSeen[conn.peer] = performance.now();
                sendSnapshotTo(conn);
            });

            conn.on('data', packet => {
                handleHostPacket(conn, packet);
            });

            conn.on('close', () => {
                removeRemotePlayer(conn.peer);
                broadcastSnapshot();
            });

            conn.on('error', () => {
                removeRemotePlayer(conn.peer);
                broadcastSnapshot();
            });

            sendSnapshotTo(conn);
        });

        peer.on('error', err => {
            if(!settled) {
                rejectWithPeerError(reject, err);
                return;
            }

            console.error(err);
            setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
        });
    });
}

export function connectToHost(hostId) {
    isHost = false;
    peer = new Peer(PEER_CONFIG);

    setStatus('Connecting...');

    return new Promise((resolve, reject) => {
        let settled = false;

        peer.on('open', id => {
            myId = id;
            ensurePlayer(id);
            setRoomId(hostId);
            setStatus('Connecting to host...');

            hostConnection = peer.connect(hostId, { reliable: true });

            hostConnection.on('open', () => {
                hostConnection.send({ type: 'join' });
                hostConnection.send({ type: 'input', input: EMPTY_INPUT });

                if(!settled) {
                    settled = true;
                    setStatus('Connected');
                    resolve(hostId);
                }
            });

            hostConnection.on('data', packet => {
                if(packet?.type !== 'snapshot') {
                    return;
                }

                world.players = packet.players || {};
                ensurePlayer(myId);
                updateHud();

                if(!settled) {
                    settled = true;
                    setStatus('Connected');
                    resolve(hostId);
                }
            });

            hostConnection.on('close', () => {
                setStatus('Connection closed');
                if(!settled) {
                    settled = true;
                    reject(new Error('Connection closed'));
                }
            });

            hostConnection.on('error', err => {
                if(!settled) {
                    settled = true;
                    rejectWithPeerError(reject, err);
                    return;
                }

                console.error(err);
                setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
            });
        });

        peer.on('error', err => {
            if(!settled) {
                settled = true;
                rejectWithPeerError(reject, err);
                return;
            }

            console.error(err);
            setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
        });
    });
}

export function sendInput(input) {
    if(!myId) return;

    const safeInput = input || EMPTY_INPUT;

    if(isHost) {
        lastSeen[myId] = performance.now();
        applyInput(myId, safeInput);
        return;
    }

    if(hostConnection?.open) {
        hostConnection.send({
            type: 'input',
            input: safeInput
        });
    }
}

export function broadcastSnapshot() {
    if(!isHost) return;

    cleanupTimedOutPlayers();

    const packet = {
        type: 'snapshot',
        players: clonePlayers()
    };

    for(const id in peers) {
        const conn = peers[id];

        if(conn?.open) {
            try {
                conn.send(packet);
            } catch(e) {
                removeRemotePlayer(id);
            }
        } else {
            removeRemotePlayer(id);
        }
    }

    updateHud();
}

export function leaveGame() {
    if(!isHost && hostConnection?.open) {
        try {
            hostConnection.send({ type: 'leave' });
        } catch(e) {}
    }

    try {
        hostConnection?.close();
    } catch(e) {}

    try {
        peer?.disconnect();
    } catch(e) {}
}
