import {

    PLAYER_SPEED,
    PLAYER_RADIUS,
    WORLD_WIDTH,
    WORLD_HEIGHT

} from './constants.js';

import { world } from './entities.js';

export function ensurePlayer(id) {

    if(world.players[id]) {
        return world.players[id];
    }

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

    return world.players[id];
}

export function applyInput(id, input) {

    const p = ensurePlayer(id);

    p.input = {

        w: !!input.w,
        a: !!input.a,
        s: !!input.s,
        d: !!input.d
    };
}

export function simulatePlayer(player, dt) {

    let dx = 0;
    let dy = 0;

    if(player.input.w) dy--;
    if(player.input.s) dy++;
    if(player.input.a) dx--;
    if(player.input.d) dx++;

    if(dx !== 0 || dy !== 0) {

        const len = Math.hypot(dx, dy);

        dx /= len;
        dy /= len;

        player.x += dx * PLAYER_SPEED * dt;
        player.y += dy * PLAYER_SPEED * dt;
    }

    player.x = Math.max(
        PLAYER_RADIUS,
        Math.min(WORLD_WIDTH - PLAYER_RADIUS, player.x)
    );

    player.y = Math.max(
        PLAYER_RADIUS,
        Math.min(WORLD_HEIGHT - PLAYER_RADIUS, player.y)
    );
}

export function simulateWorld(dt) {

    for(const id in world.players) {

        simulatePlayer(
            world.players[id],
            dt
        );
    }
}
