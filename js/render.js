import {

    renderState,
    world

} from './entities.js';

export function updateRenderState() {

    for(const id in world.players) {

        const p = world.players[id];

        if(!renderState.players[id]) {

            renderState.players[id] = {

                x:p.x,
                y:p.y
            };
        }

        renderState.players[id].x +=
            (p.x - renderState.players[id].x) * 0.35;

        renderState.players[id].y +=
            (p.y - renderState.players[id].y) * 0.35;
    }
}

export function draw(ctx, canvas) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    for(const id in renderState.players) {

        const p = renderState.players[id];

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            10,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }
}
