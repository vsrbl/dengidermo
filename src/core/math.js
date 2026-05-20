import { VIEW } from "./constants.js";

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const len = (x, y) => Math.hypot(x, y);
export const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
export const angleToVec = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
export const vecToAngle = (x, y) => Math.atan2(y, x);
export const approach = (a, b, maxStep) => {
  if (Math.abs(b - a) <= maxStep) return b;
  return a + Math.sign(b - a) * maxStep;
};

export function segmentCircleHitT(ax, ay, bx, by, cx, cy, radius) {
  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;
  const ab2 = abx * abx + aby * aby || 0.0001;
  const t = clamp((acx * abx + acy * aby) / ab2, 0, 1);
  const px = ax + abx * t;
  const py = ay + aby * t;
  return dist2(px, py, cx, cy) <= radius * radius ? t : null;
}

export function segmentCircleHit(ax, ay, bx, by, cx, cy, radius) {
  return segmentCircleHitT(ax, ay, bx, by, cx, cy, radius) !== null;
}

export function isVisible(obj, cam, pad = 80) {
  return obj.x >= cam.x - pad && obj.x <= cam.x + VIEW.w + pad && obj.y >= cam.y - pad && obj.y <= cam.y + VIEW.h + pad;
}
