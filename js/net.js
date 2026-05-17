import { world } from './entities.js';
import { ensurePlayer, applyInput } from './world.js';

export let peer = null;
export let hostConnection = null;
export let isHost = false;
export let myId = null;
export const peers = {};

const lastSeen = {};
const PEER_TIMEOUT = 20000;

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
    path: '/myapp',
    debug: 2,
    pingInterval: 5000,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};

function setStatus(text) {
    const el = document.getElementById('status');
    if(el) {
        el.innerText = text;
    }
    console.log('[net]', text);
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

function safeSend(conn, packet) {
    if(!conn || !conn.open) {
        return false;
    }

    try {
        conn.send(packet);
        return true;
    } catch(e) {
        console.error('[net] send failed', e);
        return false;
    }
}

function removeRemotePlayer(id) {
    delete peers[id];
    delete lastSeen[id];
    delete world.players[id];
    updateHud();
}

function sendSnapshotTo(conn) {
    safeSend(conn, {
        type: 'snapshot',
        players: clonePlayers()
    });
}

function handleHostPacket(conn, packet) {
    const id = conn.peer;

    lastSeen[id] = performance.now();

    if(packet?.type === 'join') {
        ensurePlayer(id);
        sendSnapshotTo(conn);
        broadcastSnapshot();
        return;
    }

    if(packet?.type === 'input') {
        ensurePlayer(id);
        applyInput(id, packet.input || EMPTY_INPUT);
        return;
    }

    if(packet?.type === 'leave') {
        removeRemotePlayer(id);
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
    console.error('[net] peer error', err);
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
            const id = conn.peer;

            peers[id] = conn;
            lastSeen[id] = performance.now();
            ensurePlayer(id);
            updateHud();

            conn.on('open', () => {
                lastSeen[id] = performance.now();
                sendSnapshotTo(conn);
                broadcastSnapshot();
            });

            conn.on('data', packet => {
                handleHostPacket(conn, packet);
            });

            conn.on('close', () => {
                removeRemotePlayer(id);
                broadcastSnapshot();
            });

            conn.on('error', err => {
                console.error('[net] connection error', err);
                removeRemotePlayer(id);
                broadcastSnapshot();
            });
        });

        peer.on('disconnected', () => {
            setStatus('Signaling disconnected. Reconnecting...');
            try {
                peer.reconnect();
            } catch(e) {
                console.error(e);
            }
        });

        peer.on('error', err => {
            if(!settled) {
                rejectWithPeerError(reject, err);
                return;
            }

            console.error('[net] peer error', err);
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
        let dataConnectionOpened = false;

        const timeout = setTimeout(() => {
            if(settled) {
                return;
            }

            settled = true;
            setStatus('Connection timeout. Check Host ID and keep host tab open.');
            reject(new Error('Connection timeout'));
        }, 12000);

        peer.on('open', id => {
            myId = id;
            ensurePlayer(id);
            setRoomId(hostId);
            setStatus('Connecting to host...');

            hostConnection = peer.connect(hostId, {
                reliable: true,
                serialization: 'json'
            });

            hostConnection.on('open', () => {
                dataConnectionOpened = true;

                safeSend(hostConnection, { type: 'join' });
                safeSend(hostConnection, { type: 'input', input: EMPTY_INPUT });

                clearTimeout(timeout);

                if(!settled) {
                    settled = true;
                    setStatus('Connected');
                    resolve(hostId);
                }

                setTimeout(() => safeSend(hostConnection, { type: 'join' }), 300);
                setTimeout(() => safeSend(hostConnection, { type: 'join' }), 1200);
            });

            hostConnection.on('data', packet => {
                if(packet?.type !== 'snapshot') {
                    return;
                }

                world.players = packet.players || {};
                ensurePlayer(myId);
                updateHud();
            });

            hostConnection.on('close', () => {
                if(!dataConnectionOpened) {
                    return;
                }

                setStatus('Connection closed');
            });

            hostConnection.on('error', err => {
                console.error('[net] host connection error', err);

                if(!settled) {
                    clearTimeout(timeout);
                    settled = true;
                    setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
                    reject(err);
                    return;
                }

                setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
            });
        });

        peer.on('disconnected', () => {
            setStatus('Signaling disconnected. Reconnecting...');
            try {
                peer.reconnect();
            } catch(e) {
                console.error(e);
            }
        });

        peer.on('error', err => {
            if(!settled) {
                clearTimeout(timeout);
                settled = true;
                rejectWithPeerError(reject, err);
                return;
            }

            console.error('[net] peer error', err);
            setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
        });
    });
}

export function sendInput(input) {
    if(!myId) {
        return;
    }

    const safeInput = input || EMPTY_INPUT;

    if(isHost) {
        lastSeen[myId] = performance.now();
        applyInput(myId, safeInput);
        return;
    }

    safeSend(hostConnection, {
        type: 'input',
        input: safeInput
    });
}

export function broadcastSnapshot() {
    if(!isHost) {
        return;
    }

    cleanupTimedOutPlayers();

    const packet = {
        type: 'snapshot',
        players: clonePlayers()
    };

    for(const id in peers) {
        const conn = peers[id];

        if(!safeSend(conn, packet)) {
            removeRemotePlayer(id);
        }
    }

    updateHud();
}

export function leaveGame() {
    if(!isHost && hostConnection?.open) {
        safeSend(hostConnection, { type: 'leave' });
    }

    try {
        hostConnection?.close();
    } catch(e) {}

    try {
        peer?.disconnect();
    } catch(e) {}
}
