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

    connectToHost(hostId);

    startGame();
};

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

    updateRenderPlayers();

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
