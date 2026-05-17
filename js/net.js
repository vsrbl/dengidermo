import { world } from './entities.js';
import { ensurePlayer, applyInput } from './world.js';

export let peer = null;
export let hostConnection = null;
export let isHost = false;
export let myId = null;
export const peers = {};

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
    document.getElementById('hud-count').innerText = String(Object.keys(world.players).length);
}

export function startHost() {
    isHost = true;
    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {
        myId = id;
        ensurePlayer(id);
        document.getElementById('hud-id').innerText = id;
        setStatus(`ID комнаты: ${id}`);
        updateHud();
    });

    peer.on('connection', conn => {
        peers[conn.peer] = conn;
        ensurePlayer(conn.peer);
        updateHud();

        conn.on('data', packet => {
            if (packet?.type === 'input') {
                applyInput(conn.peer, packet.input);
            }
        });

        conn.on('close', () => {
            delete peers[conn.peer];
            delete world.players[conn.peer];
            updateHud();
        });
    });

    peer.on('error', err => {
        console.error(err);
        setStatus(`Ошибка PeerJS: ${err.type || err.message}`);
    });
}

export function connectToHost(hostId) {
    isHost = false;
    peer = new Peer(PEER_CONFIG);

    peer.on('open', id => {
        myId = id;
        ensurePlayer(id);
        document.getElementById('hud-id').innerText = hostId;

        hostConnection = peer.connect(hostId, { reliable: true });

        hostConnection.on('open', () => {
            setStatus('Подключено');
        });

        hostConnection.on('data', packet => {
            if (packet?.type === 'snapshot') {
                world.players = packet.players || {};
                updateHud();
            }
        });

        hostConnection.on('close', () => {
            setStatus('Соединение закрыто');
        });
    });

    peer.on('error', err => {
        console.error(err);
        setStatus(`Ошибка PeerJS: ${err.type || err.message}`);
    });
}

export function sendInput(input) {
    if (!myId) return;

    if (isHost) {
        applyInput(myId, input);
        return;
    }

    if (hostConnection?.open) {
        hostConnection.send({
            type: 'input',
            input
        });
    }
}

export function broadcastSnapshot() {
    if (!isHost) return;

    const packet = {
        type: 'snapshot',
        players: world.players
    };

    for (const id in peers) {
        const conn = peers[id];
        if (conn.open) {
            conn.send(packet);
        }
    }

    updateHud();
}
