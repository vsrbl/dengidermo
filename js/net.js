import { world } from './entities.js';
import { ensurePlayer, applyInput } from './world.js';

export let socket = null;
export let isHost = false;
export let myId = null;
export const peers = {};

const RELAY_URL = 'wss://dengidermo-1.onrender.com';
const CONNECT_TIMEOUT = 12000;

const EMPTY_INPUT = {
    w:false,
    a:false,
    s:false,
    d:false
};

function setStatus(text) {
    const el = document.getElementById('status');

    if(el) {
        el.innerText = text;
    }

    console.log('[net]', text);
}

function setRoomId(id) {
    const el = document.getElementById('hud-id');

    if(el) {
        el.innerText = id;
    }
}

function updateHud() {
    const el = document.getElementById('hud-count');

    if(el) {
        el.innerText = String(Object.keys(world.players).length);
    }
}

function clearObject(obj) {
    for(const key in obj) {
        delete obj[key];
    }
}

function clonePlayers() {
    return JSON.parse(JSON.stringify(world.players));
}

function send(packet) {
    if(!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
    }

    socket.send(JSON.stringify(packet));
    return true;
}

function connectSocket() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(RELAY_URL);
        socket = ws;

        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));

            try {
                ws.close();
            } catch(e) {}
        }, CONNECT_TIMEOUT);

        ws.onopen = () => {
            clearTimeout(timeout);
            resolve(ws);
        };

        ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Relay connection failed'));
        };
    });
}

export function resetNetworkState() {
    if(!isHost) {
        send({
            type: 'leave'
        });
    }

    try {
        socket?.close();
    } catch(e) {}

    socket = null;
    isHost = false;
    myId = null;

    clearObject(peers);
    clearObject(world.players);

    setRoomId('-');
    updateHud();
}

export async function startHost() {
    resetNetworkState();

    isHost = true;
    setStatus('Creating room...');

    await connectSocket();

    return new Promise((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
            if(settled) {
                return;
            }

            settled = true;
            reject(new Error('Host creation timeout'));
        }, CONNECT_TIMEOUT);

        socket.onmessage = event => {
            const packet = JSON.parse(event.data);

            if(packet.type === 'host-ready') {
                clearTimeout(timeout);

                myId = packet.playerId || 'host';
                ensurePlayer(myId);
                setRoomId(packet.roomId);
                setStatus(`Room ID: ${packet.roomId}`);
                updateHud();

                settled = true;
                resolve(packet.roomId);
                return;
            }

            if(packet.type === 'player-joined') {
                peers[packet.playerId] = true;
                ensurePlayer(packet.playerId);
                updateHud();
                broadcastSnapshot();
                return;
            }

            if(packet.type === 'player-left') {
                delete peers[packet.playerId];
                delete world.players[packet.playerId];
                updateHud();
                broadcastSnapshot();
                return;
            }

            if(packet.type === 'input') {
                applyInput(packet.playerId, packet.input || EMPTY_INPUT);
                return;
            }

            if(packet.type === 'error') {
                setStatus(packet.message || 'Server error');

                if(!settled) {
                    clearTimeout(timeout);
                    settled = true;
                    reject(new Error(packet.message || 'Server error'));
                }
            }
        };

        socket.onclose = () => {
            setStatus('Connection closed');
        };

        send({
            type: 'host'
        });
    });
}

export async function connectToHost(roomId) {
    resetNetworkState();

    isHost = false;
    setStatus('Connecting...');

    await connectSocket();

    return new Promise((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
            if(settled) {
                return;
            }

            settled = true;
            reject(new Error('Connection timeout'));
        }, CONNECT_TIMEOUT);

        socket.onmessage = event => {
            const packet = JSON.parse(event.data);

            if(packet.type === 'joined') {
                clearTimeout(timeout);

                myId = packet.playerId;
                ensurePlayer(myId);
                setRoomId(packet.roomId);
                setStatus('Connected');
                updateHud();

                settled = true;
                resolve(packet.roomId);
                return;
            }

            if(packet.type === 'snapshot') {
                world.players = packet.players || {};
                ensurePlayer(myId);
                updateHud();
                return;
            }

            if(packet.type === 'host-left') {
                setStatus('Host left');
                return;
            }

            if(packet.type === 'error') {
                setStatus(packet.message || 'Could not connect');

                if(!settled) {
                    clearTimeout(timeout);
                    settled = true;
                    reject(new Error(packet.message || 'Could not connect'));
                }
            }
        };

        socket.onclose = () => {
            setStatus('Connection closed');
        };

        send({
            type: 'join',
            roomId
        });
    });
}

export function sendInput(input) {
    if(!myId) {
        return;
    }

    const safeInput = input || EMPTY_INPUT;

    if(isHost) {
        applyInput(myId, safeInput);
        return;
    }

    send({
        type: 'input',
        input: safeInput
    });
}

export function broadcastSnapshot() {
    if(!isHost) {
        return;
    }

    send({
        type: 'snapshot',
        players: clonePlayers()
    });

    updateHud();
}

export function leaveGame() {
    resetNetworkState();
}
