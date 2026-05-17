import {

    NET_TICK

} from './constants.js';

import {

    input,
    setupInput

} from './input.js';

import {

    renderState,
    world

} from './entities.js';

import {

    movePlayer

} from './world.js';

import {

    updateRenderPlayers,
    draw

} from './render.js';

import {

    startHost,
    connectToHost,
    sendSnapshot,
    isHost,
    hostConnection,
    myId

} from './net.js';

const canvas =
    document.getElementById('gameCanvas');

const ctx =
    canvas.getContext('2d');

setupInput();

document.getElementById('btn-host')
.onclick = () => {

    startHost(canvas);

    startGame();
};

document.getElementById('btn-join')
.onclick = () => {

    const hostId =
        document.getElementById('input-id')
        .value
        .trim();

    if(!hostId) return;

    connectToHost(hostId);

    startGame();
};

const hudId =
    document.getElementById('hud-id');

hudId.addEventListener('click', async () => {

    const id = hudId.innerText;

    if(!id || id === '-') return;

    await navigator.clipboard.writeText(id);

    const oldText = hudId.innerText;

    hudId.innerText = 'COPIED';

    setTimeout(() => {

        hudId.innerText = oldText;

    }, 1000);
});

let lastNetTick = 0;

function loop(timestamp) {

    if(isHost) {

        const me =
            world.players[myId];

        if(me) {

            movePlayer(
                me,
                input,
                canvas
            );

            renderState.players[myId].x =
                me.x;

            renderState.players[myId].y =
                me.y;

            renderState.players[myId].tx =
                me.x;

            renderState.players[myId].ty =
                me.y;
        }
    }

    if(timestamp - lastNetTick >= NET_TICK) {

        lastNetTick = timestamp;

        if(isHost) {

            sendSnapshot();

        } else if(hostConnection?.open) {

            hostConnection.send(input);
        }
    }

    updateRenderPlayers(myId);

    draw(
        ctx,
        canvas,
        myId
    );

    requestAnimationFrame(loop);
}

function startGame() {

    document.getElementById('ui')
        .style.display = 'none';

    document.getElementById('hud')
        .style.display = 'block';

    canvas.style.display = 'block';

    requestAnimationFrame(loop);
}
