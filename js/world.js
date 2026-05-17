import {

    PLAYER_SPEED,
    PLAYER_SIZE

} from './constants.js';

import {

    world

} from './entities.js';

export function createPlayer(id, canvas) {

    world.players[id] = {

        x: canvas.width / 2,
        y: canvas.height / 2
    };
}

export function movePlayer(
    p,
    input,
    canvas,
    delta = 1
) {

    let dx = 0;
    let dy = 0;

    if(input.w) dy--;
    if(input.s) dy++;
    if(input.a) dx--;
    if(input.d) dx++;

    if(dx || dy) {

        const len = Math.hypot(dx, dy);

        p.x +=
            (dx / len) *
            PLAYER_SPEED *
            delta;

        p.y +=
            (dy / len) *
            PLAYER_SPEED *
            delta;
    }

    p.x = Math.max(
        PLAYER_SIZE,
        Math.min(canvas.width - PLAYER_SIZE, p.x)
    );

    p.y = Math.max(
        PLAYER_SIZE,
        Math.min(canvas.height - PLAYER_SIZE, p.y)
    );
}
