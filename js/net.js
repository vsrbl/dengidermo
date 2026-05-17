import { world } from './entities.js';
import { ensurePlayer, applyInput } from './world.js';

export let peer = null;
export let hostConnection = null;
export let isHost = false;
export let myId = null;
export const peers = {};

const lastSeen = {};
const PEER_TIMEOUT = 15000;
const CONNECT_TIMEOUT = 7000;
const CONNECT_ATTEMPTS = 3;

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
    if(el) {
        el.innerText = text;
    }
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
        return false;
    }
}

function getPlayerIdFromConn(conn) {
    return conn.playerId || conn.peer;
}

function setPlayerIdForConn(conn, id) {
    const oldId = conn.playerId;

    if(oldId && oldId !== id) {
        delete peers[oldId];
        delete lastSeen[oldId];
        delete world.players[oldId];
    }

    conn.playerId = id;
    peers[id] = conn;
    lastSeen[id] = performance.now();
    ensurePlayer(id);
    updateHud();

    return id;
}

function removeRemotePlayer(id) {
    delete peers[id];
    delete lastSeen[id];
    delete world.players[id];
    updateHud();
}

function makeSnapshotPacket() {
    return {
        type: 'snapshot',
        players: clonePlayers()
    };
}

function sendWelcomeTo(conn) {
    const id = setPlayerIdForConn(conn, getPlayerIdFromConn(conn));

    safeSend(conn, {
        type: 'welcome',
        yourId: id,
        players: clonePlayers()
    });
}

function handleHostPacket(conn, packet) {
    const id = setPlayerIdForConn(
        conn,
        packet?.clientId || getPlayerIdFromConn(conn)
    );

    if(packet?.type === 'join') {
        sendWelcomeTo(conn);
        broadcastSnapshot();
        return;
    }

    if(packet?.type === 'input') {
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
    console.error(err);
    setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
    reject(err);
}

function sendJoinAndInput() {
    safeSend(hostConnection, {
        type: 'join',
        clientId: myId
    });

    safeSend(hostConnection, {
        type: 'input',
        clientId: myId,
        input: EMPTY_INPUT
    });
}

function connectDataChannel(hostId, resolve, reject, attempt = 1) {
    setStatus(`Connecting to host... ${attempt}/${CONNECT_ATTEMPTS}`);

    try {
        hostConnection?.close();
    } catch(e) {}

    hostConnection = peer.connect(hostId, {
        reliable: true,
        serialization: 'json',
        metadata: {
            clientId: myId
        }
    });

    let opened = false;

    const timeout = setTimeout(() => {
        if(opened) {
            return;
        }

        try {
            hostConnection?.close();
        } catch(e) {}

        if(attempt < CONNECT_ATTEMPTS) {
            connectDataChannel(hostId, resolve, reject, attempt + 1);
            return;
        }

        setStatus('Could not open connection. Check Host ID and keep host tab open.');
        reject(new Error('Connection timeout'));
    }, CONNECT_TIMEOUT);

    hostConnection.on('open', () => {
        opened = true;
        clearTimeout(timeout);

        sendJoinAndInput();

        setStatus('Connected');
        resolve(hostId);

        setTimeout(sendJoinAndInput, 250);
        setTimeout(sendJoinAndInput, 1000);
    });

    hostConnection.on('data', packet => {
        if(packet?.type !== 'snapshot' && packet?.type !== 'welcome') {
            return;
        }

        if(packet.type === 'welcome' && packet.yourId) {
            myId = packet.yourId;
        }

        if(packet.players) {
            world.players = packet.players;
            updateHud();
        }
    });

    hostConnection.on('close', () => {
        clearTimeout(timeout);

        if(!opened) {
            return;
        }

        setStatus('Connection closed');
    });

    hostConnection.on('error', err => {
        console.error(err);
        clearTimeout(timeout);

        if(!opened && attempt < CONNECT_ATTEMPTS) {
            connectDataChannel(hostId, resolve, reject, attempt + 1);
            return;
        }

        if(!opened) {
            setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
            reject(err);
            return;
        }

        setStatus(`Connection error: ${err.type || err.message || 'unknown'}`);
    });
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
            const initialId = conn.metadata?.clientId || conn.peer;
            setPlayerIdForConn(conn, initialId);

            conn.on('open', () => {
                const id = conn.metadata?.clientId || getPlayerIdFromConn(conn);
                setPlayerIdForConn(conn, id);
                sendWelcomeTo(conn);
                broadcastSnapshot();

                setTimeout(() => sendWelcomeTo(conn), 250);
                setTimeout(() => sendWelcomeTo(conn), 1000);
            });

            conn.on('data', packet => {
                handleHostPacket(conn, packet);
            });

            conn.on('close', () => {
                removeRemotePlayer(getPlayerIdFromConn(conn));
                broadcastSnapshot();
            });

            conn.on('error', () => {
                removeRemotePlayer(getPlayerIdFromConn(conn));
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

        const wrappedResolve = value => {
            if(settled) {
                return;
            }

            settled = true;
            resolve(value);
        };

        const wrappedReject = error => {
            if(settled) {
                return;
            }

            settled = true;
            reject(error);
        };

        peer.on('open', id => {
            myId = id;
            setRoomId(hostId);
            connectDataChannel(hostId, wrappedResolve, wrappedReject);
        });

        peer.on('error', err => {
            if(!settled) {
                rejectWithPeerError(wrappedReject, err);
                return;
            }

            console.error(err);
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
        clientId: myId,
        input: safeInput
    });
}

export function broadcastSnapshot() {
    if(!isHost) {
        return;
    }

    cleanupTimedOutPlayers();

    const packet = makeSnapshotPacket();

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
        safeSend(hostConnection, {
            type: 'leave',
            clientId: myId
        });
    }

    try {
        hostConnection?.close();
    } catch(e) {}

    try {
        peer?.disconnect();
    } catch(e) {}
}
