import { VIEW } from "./core/constants.js";
import { emptyInput, inputAimFromMouse } from "./game/simulation.js";

const moveCodes = new Map([
  ["KeyW", "up"], ["ArrowUp", "up"],
  ["KeyS", "down"], ["ArrowDown", "down"],
  ["KeyA", "left"], ["ArrowLeft", "left"],
  ["KeyD", "right"], ["ArrowRight", "right"]
]);

export function createInput(canvas, { onEsc }) {
  const pressed = new Set();
  const mouse = { x: VIEW.w / 2, y: VIEW.h / 2, down: false, inside: false, worldX: 0, worldY: 0 };

  function resetKeys() {
    pressed.clear();
    mouse.down = false;
  }

  function setMouseFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * VIEW.w;
    mouse.y = ((e.clientY - r.top) / r.height) * VIEW.h;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      e.preventDefault();
      onEsc?.();
      return;
    }
    const key = moveCodes.get(e.code);
    if (key) {
      e.preventDefault();
      pressed.add(key);
    }
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      mouse.down = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    const key = moveCodes.get(e.code);
    if (key) pressed.delete(key);
    if (e.code === "Space" || e.code === "Enter") mouse.down = false;
  });

  window.addEventListener("blur", resetKeys);
  document.addEventListener("visibilitychange", () => { if (document.hidden) resetKeys(); });

  canvas.addEventListener("mousemove", (e) => {
    mouse.inside = true;
    setMouseFromEvent(e);
  });
  canvas.addEventListener("mouseenter", (e) => {
    mouse.inside = true;
    setMouseFromEvent(e);
  });
  canvas.addEventListener("mouseleave", () => {
    mouse.inside = false;
    mouse.down = false;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouse.down = true;
    mouse.inside = true;
    setMouseFromEvent(e);
  });
  window.addEventListener("mouseup", () => { mouse.down = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function sample(localPose, camera) {
    const input = emptyInput();
    input.left = pressed.has("left");
    input.right = pressed.has("right");
    input.up = pressed.has("up");
    input.down = pressed.has("down");
    input.fire = mouse.down;
    mouse.worldX = camera.x + mouse.x;
    mouse.worldY = camera.y + mouse.y;
    input.aimAngle = localPose ? inputAimFromMouse(localPose, { x: mouse.worldX, y: mouse.worldY }) : 0;
    if (localPose) {
      input.px = Math.round(localPose.x);
      input.py = Math.round(localPose.y);
    }
    return input;
  }

  return { mouse, sample, resetKeys };
}
