import {

    sendInput,
    broadcastSnapshot,
    startHost,
    connectToHost,
    leaveGame,
    resetNetworkState,
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

function sendCurrentInput() {
    sendInput(input);
}

window.addEventListener('keydown', () => {
    setTimeout(sendCurrentInput, 0);
});

window.addEventListener('keyup', () => {
    setTimeout(sendCurrentInput, 0);
});

window.addEventListener('blur', () => {
    resetInput();
    sendCurrentInput();
});

document.addEventListener('visibilitychange', () => {
    if(document.hidden) {
        resetInput();
        sendCurrentInput();
    }
});

window.addEventListener('beforeunload', () => {
    resetInput();
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
        setMenuStatus('Room ID copied');

        return;
    }

    const textarea =
        document.createElement('textarea');

    textarea.value = roomId;

    document.body.appendChild(textarea);

    textarea.select();

    document.execCommand('copy');

    textarea.remove();

    setMenuStatus('Room ID copied');
};

const hostButton = document.getElementById('btn-host');
const joinButton = document.getElementById('btn-join');
const roomInput = document.getElementById('input-id');
const statusEl = document.getElementById('status');

function setMenuStatus(text) {
    statusEl.innerText = text;
}

function setMenuLocked(locked) {
    hostButton.disabled = locked;
    joinButton.disabled = locked;
    roomInput.disabled = locked;
}

function showMenu(message = '') {
    gameStarted = false;

    if(animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    accumulator = 0;
    resetInput();
    resetRenderState();
    resetNetworkState();

    document.getElementById('ui')
        .style.display = 'flex';

    document.getElementById('hud')
        .style.display = 'none';

    canvas.style.display = 'none';

    setMenuLocked(false);
    setMenuStatus(message);
}

window.addEventListener('keydown', e => {
    if(e.code === 'Escape' && gameStarted) {
        showMenu('Left game');
    }
});

hostButton.onclick = async () => {

    setMenuLocked(true);
    setMenuStatus('Creating room...');

    try {
        await startHost();
        start();
    } catch(e) {
        console.error(e);
        setMenuLocked(false);
        setMenuStatus(e?.message || 'Could not create room. Check Render.');
    }
};

joinButton.onclick = async () => {

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
        setMenuStatus(e?.message || 'Could not connect. Check Room ID / Render.');
    }
};

let accumulator = 0;

let previous =
    performance.now();

let lastNetworkTick = 0;

let gameStarted = false;

let animationFrameId = null;

function tick(now) {

    if(!gameStarted) {
        animationFrameId = null;
        return;
    }

    const frameTime =
        Math.min(now - previous, 250);

    previous = now;

    accumulator += frameTime;

    while(accumulator >= PHYSICS_RATE) {

        sendInput(input);

        if(isHost) {
            simulateWorld(FIXED_DELTA);
        }

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

    animationFrameId = requestAnimationFrame(tick);
}

function start() {

    if(gameStarted) {
        return;
    }

    gameStarted = true;

    document.getElementById('ui')
        .style.display = 'none';

    document.getElementById('hud')
        .style.display = 'block';

    canvas.style.display = 'block';

    previous = performance.now();
    accumulator = 0;

    animationFrameId = requestAnimationFrame(tick);
}
