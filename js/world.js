import {
    PLAYER_SPEED,
    PLAYER_SIZE,
    BULLET_SPEED
} from './constants.js';

import { world } from './entities.js';

let bulletId = 0;

export function createPlayer(id, canvas) {

    world.players[id] = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        score:0,
        hp:100,
        lastShot:0
    };
}

export function movePlayer(p, input, canvas) {

    let dx = 0;
    let dy = 0;

    if(input.w) dy--;
    if(input.s) dy++;
    if(input.a) dx--;
    if(input.d) dx++;

    if(dx || dy) {

        const len = Math.hypot(dx, dy);

        p.x += (dx / len) * PLAYER_SPEED;
        p.y += (dy / len) * PLAYER_SPEED;
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

export function shootBullet(player, mx, my) {

    const angle = Math.atan2(
        my - player.y,
        mx - player.x
    );

    world.bullets.push({
        id: bulletId++,
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED
    });
}

export function updateBullets(canvas) {

    for(let b of world.bullets) {

        b.x += b.vx;
        b.y += b.vy;
    }

    world.bullets = world.bullets.filter(b =>

        b.x > 0 &&
        b.y > 0 &&
        b.x < canvas.width &&
        b.y < canvas.height
    );
}
