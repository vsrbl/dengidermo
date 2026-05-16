import { world, renderState } from './entities.js';

import { PLAYER_SIZE } from './constants.js';

export function updateRenderPlayers() {

    for(let id in renderState.players) {

        const p = renderState.players[id];

        p.x += (p.tx - p.x) * 0.2;
        p.y += (p.ty - p.y) * 0.2;
    }
}

export function draw(ctx, canvas, myId) {

    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = '#fff';

    for(let l of world.loot) {

        ctx.fillRect(l.x - 4, l.y - 1, 8, 2);
        ctx.fillRect(l.x - 1, l.y - 4, 2, 8);
    }

    for(let b of world.bullets) {

        ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    }

    ctx.font = "14px monospace";

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

        ctx.fillStyle = '#fff';

        ctx.fillText(
            p.score,
            p.x - 10,
            p.y - 18
        );
    }
}
