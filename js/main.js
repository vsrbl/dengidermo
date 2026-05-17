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

setupInput();

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

document.getElementById('btn-host')
.onclick = () => {

    startHost();

    start();
};

document.getElementById('btn-join')
.onclick = () => {

    const hostId =
        document.getElementById('input-id')
        .value
        .trim();

    if(!hostId) {
        return;
    }

    connectToHost(hostId);

    start();
};

let accumulator = 0;

let previous =
    performance.now();

let lastNetworkTick = 0;

function tick(now) {

    const frameTime =
        now - previous;

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

    document.getElementById('ui')
        .style.display = 'none';

    document.getElementById('hud')
        .style.display = 'block';

    canvas.style.display = 'block';

    requestAnimationFrame(tick);
}
