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

function getConnectionPlayerId(conn) {
    return conn.playerId || conn.peer;
}

function registerConnectionPlayer(conn, playerId) {
    const id = playerId || conn.peer;

    if(conn.playerId && conn.playerId !== id) {
        delete peers[conn.playerId];
        delete lastSeen[conn.playerId];
        delete world.players[conn.playerId];
    }

    conn.playerId = id;
    peers[id] = conn;
    lastSeen[id] = performance.now();
    ensurePlayer(id);
    updateHud();

    return id;
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

function sendWelcomeTo(conn) {
    if(!conn?.open) {
        return;
    }

    const id = registerConnectionPlayer(conn, getConnectionPlayerId(conn));

    conn.send({
        type: 'welcome',
        yourId: id,
        players: clonePlayers()
    });
}

function handleHostPacket(conn, packet) {
    const packetId = packet?.clientId;
    const id = registerConnectionPlayer(conn, packetId || getConnectionPlayerId(conn));

    if(packet?.type === 'input') {
        applyInput(id, packet.input || EMPTY_INPUT);
        sendSnapshotTo(conn);
        return;
    }

    if(packet?.type === 'leave') {
        removeRemotePlayer(id);
        broadcastSnapshot();
        return;
    }

    if(packet?.type === 'join') {
        sendWelcomeTo(conn);
        broadcastSnapshot();
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
            registerConnectionPlayer(conn, conn.peer);

            conn.on('open', () => {
                registerConnectionPlayer(conn, getConnectionPlayerId(conn));
                sendWelcomeTo(conn);

                setTimeout(() => sendWelcomeTo(conn), 250);
                setTimeout(() => sendWelcomeTo(conn), 750);
                setTimeout(() => sendWelcomeTo(conn), 1500);

                broadcastSnapshot();
            });

            conn.on('data', packet => {
                handleHostPacket(conn, packet);
            });

            conn.on('close', () => {
                removeRemotePlayer(getConnectionPlayerId(conn));
                broadcastSnapshot();
            });

            conn.on('error', () => {
                removeRemotePlayer(getConnectionPlayerId(conn));
                broadcastSnapshot();
            });

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
            setRoomId(hostId);
            setStatus('Loading world...');

            hostConnection = peer.connect(hostId, { reliable: true });

            hostConnection.on('open', () => {
                hostConnection.send({ type: 'join', clientId: myId });
                hostConnection.send({ type: 'input', clientId: myId, input: EMPTY_INPUT });

                setTimeout(() => {
                    if(!settled && hostConnection?.open) {
                        hostConnection.send({ type: 'join', clientId: myId });
                        hostConnection.send({ type: 'input', clientId: myId, input: EMPTY_INPUT });
                    }
                }, 1000);

                setTimeout(() => {
                    if(!settled && hostConnection?.open) {
                        settled = true;
                        setStatus('Connected');
                        resolve(hostId);
                    }
                }, 2500);
            });

            hostConnection.on('data', packet => {
                if(packet?.type !== 'snapshot' && packet?.type !== 'welcome') {
                    return;
                }

                if(packet.type === 'welcome' && packet.yourId) {
                    myId = packet.yourId;
                }

                world.players = packet.players || {};
                updateHud();

                if(packet.type === 'welcome' && world.players[myId] && !settled) {
                    settled = true;
                    setStatus('Connected');
                    resolve(hostId);
                    return;
                }

                if(packet.type === 'snapshot' && !settled) {
                    if(world.players[myId]) {
                        settled = true;
                        setStatus('Connected');
                        resolve(hostId);
                    } else {
                        setStatus('Loading world...');
                    }
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
            clientId: myId,
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
            hostConnection.send({ type: 'leave', clientId: myId });
        } catch(e) {}
    }

    try {
        hostConnection?.close();
    } catch(e) {}

    try {
        peer?.disconnect();
    } catch(e) {}
}
