import { VIEW } from "./core/constants.js";
import { emptyInput, inputAimFromMouse } from "./game/simulation.js";

const moveCodes = new Map([
  ["KeyW", "up"], ["ArrowUp", "up"],
  ["KeyS", "down"], ["ArrowDown", "down"],
  ["KeyA", "left"], ["ArrowLeft", "left"],
  ["KeyD", "right"], ["ArrowRight", "right"]
]);

function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function createInput(canvas, { onEsc, onWeaponSlot, onWeaponCycle, onDevCommand, isGameActive = () => true } = {}) {
  const pressed = new Set();
  const mouse = { x: VIEW.w / 2, y: VIEW.h / 2, down: false, inside: false, worldX: 0, worldY: 0 };

  function resetKeys() {
    pressed.clear();
    mouse.down = false;
  }

  function activeForKeyboard(e) {
    return isGameActive() && !isEditableTarget(e.target);
  }

  function setMouseFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * VIEW.w;
    mouse.y = ((e.clientY - r.top) / r.height) * VIEW.h;
  }

  window.addEventListener("keydown", (e) => {
    if (!activeForKeyboard(e)) return;

    if (e.code === "Escape") {
      e.preventDefault();
      onEsc?.();
      return;
    }


    if (!e.repeat) {
      const devHotkeys = {
        F6: "toggle-spawns",
        F7: "clear-hostiles",
        F8: "toggle-god",
        F9: "toggle-calm",
        F10: "ready-portal"
      };
      const command = devHotkeys[e.code];
      if (command) {
        e.preventDefault();
        onDevCommand?.(command);
        return;
      }
    }

    if (!e.repeat && /^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      onWeaponSlot?.(Number(e.code.slice(5)) - 1);
      return;
    }

    if (!e.repeat && (e.code === "KeyQ" || e.code === "KeyE")) {
      e.preventDefault();
      onWeaponCycle?.(e.code === "KeyQ" ? -1 : 1);
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
    if (!isGameActive()) return;
    const key = moveCodes.get(e.code);
    if (key) pressed.delete(key);
    if (e.code === "Space" || e.code === "Enter") mouse.down = false;
  });

  window.addEventListener("blur", resetKeys);
  document.addEventListener("visibilitychange", () => { if (document.hidden) resetKeys(); });

  canvas.addEventListener("mousemove", (e) => {
    if (!isGameActive()) return;
    mouse.inside = true;
    setMouseFromEvent(e);
  });
  canvas.addEventListener("mouseenter", (e) => {
    if (!isGameActive()) return;
    mouse.inside = true;
    setMouseFromEvent(e);
  });
  canvas.addEventListener("mouseleave", () => {
    mouse.inside = false;
    mouse.down = false;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (!isGameActive() || e.button !== 0) return;
    mouse.down = true;
    mouse.inside = true;
    setMouseFromEvent(e);
  });
  window.addEventListener("mouseup", () => { mouse.down = false; });
  canvas.addEventListener("wheel", (e) => {
    if (!isGameActive()) return;
    e.preventDefault();
    onWeaponCycle?.(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
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
