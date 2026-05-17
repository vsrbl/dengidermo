import {

    renderState

} from './entities.js';

import {

    PLAYER_SIZE

} from './constants.js';

export function updateRenderPlayers(myId) {

    for(let id in renderState.players) {

        if(id === myId) continue;

        const p = renderState.players[id];

        p.x += (p.tx - p.x) * 0.18;
        p.y += (p.ty - p.y) * 0.18;
    }
}

export function draw(ctx, canvas, myId) {

    ctx.fillStyle = '#000';

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    for(let id in renderState.players) {

        const p = renderState.players[id];

        if(id === myId) {

            ctx.fillStyle = '#fff';

            ctx.fillRect(
                p.x - PLAYER_SIZE,
                p.y - PLAYER_SIZE,
                PLAYER_SIZE * 2,
                PLAYER_SIZE * 2
            );

        } else {

            ctx.strokeStyle = '#fff';

            ctx.strokeRect(
                p.x - PLAYER_SIZE,
                p.y - PLAYER_SIZE,
                PLAYER_SIZE * 2,
                PLAYER_SIZE * 2
            );
        }
    }
}
