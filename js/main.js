import {

    NET_TICK,
    PHYSICS_TICK,
    FIXED_DELTA

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

    applyInput,
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

    startHost();

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

    try {

        await navigator.clipboard.writeText(id);

        const oldText = hudId.innerText;

        hudId.innerText = 'COPIED';

        setTimeout(() => {

            hudId.innerText = oldText;

        }, 1000);

    } catch(err) {

        console.error(err);
    }
});

let lastFrame = performance.now();

let accumulator = 0;

let lastNetTick = 0;

function updatePhysics() {

    if(isHost) {

        for(const id in world.players) {

            movePlayer(
                world.players[id],
                FIXED_DELTA
            );

            const p =
                world.players[id];

            if(!renderState.players[id]) {

                renderState.players[id] = {

                    x:p.x,
                    y:p.y,

                    tx:p.x,
                    ty:p.y
                };
            }

            renderState.players[id].tx = p.x;
            renderState.players[id].ty = p.y;

            if(id === myId) {

                renderState.players[id].x = p.x;
                renderState.players[id].y = p.y;
            }
        }

    } else {

        const me =
            renderState.players[myId];

        if(me) {

            applyInput(me, input);

            movePlayer(
                me,
                FIXED_DELTA
            );
        }
    }
}

function updateNetwork() {

    if(isHost) {

        sendSnapshot();

    } else if(hostConnection?.open) {

        hostConnection.send({
            type:'input',
            input
        });
    }
}

function loop(timestamp) {

    const deltaMs =
        timestamp - lastFrame;

    lastFrame = timestamp;

    accumulator += deltaMs;

    while(accumulator >= PHYSICS_TICK) {

        updatePhysics();

        accumulator -= PHYSICS_TICK;
    }

    if(timestamp - lastNetTick >= NET_TICK) {

        lastNetTick = timestamp;

        updateNetwork();
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
