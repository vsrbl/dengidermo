import { VIEW, WORLD } from "./core/constants.js";
import { clamp, lerp } from "./core/math.js";

export function createCamera() {
  return { x: 0, y: 0, ready: false };
}

export function updateCamera(camera, target, dt, instant = false) {
  if (!target) return;
  const tx = clamp(target.x - VIEW.w / 2, 0, WORLD.w - VIEW.w);
  const ty = clamp(target.y - VIEW.h / 2, 0, WORLD.h - VIEW.h);
  if (!camera.ready || instant) {
    camera.x = tx;
    camera.y = ty;
    camera.ready = true;
    return;
  }
  const t = Math.min(1, dt * 10);
  camera.x = lerp(camera.x, tx, t);
  camera.y = lerp(camera.y, ty, t);
}
