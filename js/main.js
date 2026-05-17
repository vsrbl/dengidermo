import {

    PHYSICS_RATE,
    NETWORK_RATE,
    FIXED_DELTA

} from './constants.js';

import {

    setupInput,
    input

} from './input.js';

import {

    simulateWorld

} from './world.js';

import {

    updateRenderState,
    draw

} from './render.js';

import {

    sendInput,
    broadcastSnapshot,
    startHost,
    connectToHost,
    leaveGame,
    isHost

} from './net.js';


const isMobileDevice =
    window.matchMedia('(hover: none), (pointer: coarse), (max-width: 900px)').matches ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);

if(isMobileDevice) {

    document.body.classList.add('mobile-blocked');

    throw new Error('only for pc');
}

const canvas =
    document.getElementById('gameCanvas');

const ctx =
    canvas.getContext('2d');

const ui =
    document.getElementById('ui');

const hud =
    document.getElementById('hud');

const statusEl =
    document.getElementById('status');

const hostButton =
    document.getElementById('btn-host');

const joinButton =
    document.getElementById('btn-join');

const roomInput =
    document.getElementById('input-id');

setupInput();

function setMenuStatus(text) {
    statusEl.innerText = text;
}

function setMenuLocked(locked) {
    hostButton.disabled = locked;
    joinButton.disabled = locked;
    roomInput.disabled = locked;
}

function sendCurrentInput() {
    sendInput(input);
}

window.addEventListener('blur', sendCurrentInput);
document.addEventListener('visibilitychange', () => {
    if(document.hidden) {
        sendCurrentInput();
    }
});

window.addEventListener('beforeunload', () => {
    sendCurrentInput();
    leaveGame();
});

document.getElementById('hud-id')
.onclick = async () => {

    const roomId =
        document.getElementById('hud-id')
        .innerText
        .trim();

    if(!roomId || roomId === '-') {
        return;
    }

    if(navigator.clipboard) {

        await navigator.clipboard.writeText(roomId);

        return;
    }

    const textarea =
        document.createElement('textarea');

    textarea.value = roomId;

    document.body.appendChild(textarea);

    textarea.select();

    document.execCommand('copy');

    textarea.remove();
};

hostButton.onclick = async () => {

    if(gameStarted) {
        return;
    }

    setMenuLocked(true);
    setMenuStatus('Creating room...');

    try {
        await startHost();
        start();
    } catch(e) {
        console.error(e);
        setMenuLocked(false);
        setMenuStatus('Could not create room. Try again.');
    }
};

joinButton.onclick = async () => {

    if(gameStarted) {
        return;
    }

    const hostId =
        roomInput
        .value
        .trim();

    if(!hostId) {
        setMenuStatus('Enter a Host ID.');
        return;
    }

    setMenuLocked(true);
    setMenuStatus('Connecting...');

    try {
        await connectToHost(hostId);
        start();
    } catch(e) {
        console.error(e);
        setMenuLocked(false);
        setMenuStatus('Could not connect. Check the Host ID.');
    }
};

let accumulator = 0;

let previous =
    performance.now();

let lastNetworkTick = 0;

let gameStarted = false;

function tick(now) {

    const frameTime =
        Math.min(now - previous, 250);

    previous = now;

    accumulator += frameTime;

    while(accumulator >= PHYSICS_RATE) {

        sendInput(input);

        simulateWorld(FIXED_DELTA);

        accumulator -= PHYSICS_RATE;
    }

    if(now - lastNetworkTick >= NETWORK_RATE) {

        lastNetworkTick = now;

        if(isHost) {

            broadcastSnapshot();
        }
    }

    updateRenderState();

    draw(ctx, canvas);

    requestAnimationFrame(tick);
}

function start() {

    if(gameStarted) {
        return;
    }

    gameStarted = true;

    ui.style.display = 'none';

    hud.style.display = 'block';

    canvas.style.display = 'block';

    previous = performance.now();

    requestAnimationFrame(tick);
}
