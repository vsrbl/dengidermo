import { CENTER, WORLD } from "../core/constants.js";

export const DEFAULT_LAYOUT_ID = "open_arena";
export const LAYOUT_VERSION = 2;

const wall = (id, x, y, w, h, tags = []) => Object.freeze({
  id,
  kind: "solid",
  shape: "rect",
  x,
  y,
  w,
  h,
  tags: Object.freeze(tags)
});

const anchor = (id, x, y, tags = []) => Object.freeze({ id, x, y, tags: Object.freeze(tags) });

export const ROOM_LAYOUTS = Object.freeze({
  open_arena: Object.freeze({
    id: "open_arena",
    name: "OPEN ARENA",
    kind: "open",
    bounds: Object.freeze({ x: 0, y: 0, w: WORLD.w, h: WORLD.h }),
    walls: Object.freeze([]),
    hazards: Object.freeze([]),
    // Baseline rooms intentionally keep no anchors so v38.9.1 can prove the
    // fallback edge-spawn path still behaves exactly like the current game.
    spawnAnchors: Object.freeze([]),
    portal: Object.freeze({ x: WORLD.w - 190, y: CENTER.y }),
    tags: Object.freeze(["open", "baseline"])
  }),

  // v38.8 foundation layouts are intentionally unused by the baseline room
  // sequence. They define the data contract for future level-design content
  // without changing current gameplay.
  twin_pillars: Object.freeze({
    id: "twin_pillars",
    name: "TWIN PILLARS",
    kind: "obstacle",
    bounds: Object.freeze({ x: 0, y: 0, w: WORLD.w, h: WORLD.h }),
    walls: Object.freeze([
      wall("pillar_west", CENTER.x - 260, CENTER.y - 170, 72, 340, ["pillar"]),
      wall("pillar_east", CENTER.x + 188, CENTER.y - 170, 72, 340, ["pillar"])
    ]),
    hazards: Object.freeze([]),
    spawnAnchors: Object.freeze([
      anchor("north_gate", CENTER.x, 150, ["edge", "far", "north"]),
      anchor("south_gate", CENTER.x, WORLD.h - 150, ["edge", "far", "south"]),
      anchor("west_flank", 180, CENTER.y, ["edge", "flank", "west"]),
      anchor("east_flank", WORLD.w - 180, CENTER.y, ["edge", "flank", "east"]),
      anchor("boss_anchor", CENTER.x, 190, ["boss"])
    ]),
    portal: Object.freeze({ x: WORLD.w - 190, y: CENTER.y }),
    tags: Object.freeze(["obstacle", "future"])
  }),

  split_lanes: Object.freeze({
    id: "split_lanes",
    name: "SPLIT LANES",
    kind: "lanes",
    bounds: Object.freeze({ x: 0, y: 0, w: WORLD.w, h: WORLD.h }),
    walls: Object.freeze([
      wall("mid_bar_top", CENTER.x - 34, 280, 68, 380, ["divider"]),
      wall("mid_bar_bottom", CENTER.x - 34, WORLD.h - 660, 68, 380, ["divider"])
    ]),
    hazards: Object.freeze([]),
    spawnAnchors: Object.freeze([
      anchor("west_lane", 150, CENTER.y, ["edge", "lane", "west"]),
      anchor("east_lane", WORLD.w - 150, CENTER.y, ["edge", "lane", "east"]),
      anchor("north_corner", CENTER.x - 420, 150, ["edge", "corner", "north"]),
      anchor("south_corner", CENTER.x + 420, WORLD.h - 150, ["edge", "corner", "south"]),
      anchor("boss_anchor", CENTER.x, 180, ["boss"])
    ]),
    portal: Object.freeze({ x: WORLD.w - 190, y: CENTER.y }),
    tags: Object.freeze(["lanes", "future"])
  })
});

export function getLayout(layoutId = DEFAULT_LAYOUT_ID) {
  return ROOM_LAYOUTS[layoutId] || ROOM_LAYOUTS[DEFAULT_LAYOUT_ID];
}

function wallSnapshot(rect) {
  return {
    id: rect.id,
    kind: rect.kind || "solid",
    shape: rect.shape || "rect",
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    tags: [...(rect.tags || [])]
  };
}

export function layoutSnapshot(layoutId = DEFAULT_LAYOUT_ID) {
  const layout = getLayout(layoutId);
  return {
    id: layout.id,
    name: layout.name,
    kind: layout.kind,
    bounds: { ...(layout.bounds || {}) },
    walls: (layout.walls || []).map(wallSnapshot),
    hazards: [...(layout.hazards || [])],
    spawnAnchors: [...(layout.spawnAnchors || [])].map((a) => ({ ...a, tags: [...(a.tags || [])] })),
    portal: { ...(layout.portal || {}) },
    tags: [...(layout.tags || [])]
  };
}

function stableGeometryPayload(layout) {
  return JSON.stringify({
    id: layout.id || DEFAULT_LAYOUT_ID,
    bounds: layout.bounds || {},
    walls: (layout.walls || []).map((w) => ({
      id: w.id,
      kind: w.kind || "solid",
      shape: w.shape || "rect",
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      tags: [...(w.tags || [])]
    })),
    hazards: [...(layout.hazards || [])],
    spawnAnchors: [...(layout.spawnAnchors || [])].map((a) => ({ id: a.id, x: a.x, y: a.y, tags: [...(a.tags || [])] })),
    portal: layout.portal || {}
  });
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function layoutGeometryHash(layoutId = DEFAULT_LAYOUT_ID) {
  const layout = getLayout(layoutId);
  return `geo:${layout.id}:${LAYOUT_VERSION}:${hashString(stableGeometryPayload(layout))}`;
}

export function layoutIdentitySnapshot(layoutId = DEFAULT_LAYOUT_ID) {
  const layout = getLayout(layoutId);
  return {
    layoutId: layout.id,
    layoutVersion: LAYOUT_VERSION,
    geometryHash: layoutGeometryHash(layout.id)
  };
}
