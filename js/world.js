import {

    PLAYER_SPEED,
    PLAYER_SIZE,
    WORLD_WIDTH,
    WORLD_HEIGHT

} from './constants.js';

import {

    world

} from './entities.js';

export function createPlayer(id) {

    world.players[id] = {

        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,

        input: {

            w:false,
            a:false,
            s:false,
            d:false
        }
    };
}

export function applyInput(player, input) {

    player.input = {

        w: !!input.w,
        a: !!input.a,
        s: !!input.s,
        d: !!input.d
    };
}

export function movePlayer(
    player,
    delta
) {

    const input = player.input;

    let dx = 0;
    let dy = 0;

    if(input.w) dy--;
    if(input.s) dy++;
    if(input.a) dx--;
    if(input.d) dx++;

    if(dx || dy) {

        const len = Math.hypot(dx, dy);

        player.x +=
            (dx / len) *
            PLAYER_SPEED *
            delta;

        player.y +=
            (dy / len) *
            PLAYER_SPEED *
            delta;
    }

    player.x = Math.max(
        PLAYER_SIZE,
        Math.min(WORLD_WIDTH - PLAYER_SIZE, player.x)
    );

    player.y = Math.max(
        PLAYER_SIZE,
        Math.min(WORLD_HEIGHT - PLAYER_SIZE, player.y)
    );
}
