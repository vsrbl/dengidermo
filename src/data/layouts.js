import { CENTER, WORLD } from "../core/constants.js";
import { getEnvironmentPropSet } from "./environmentProps.js";

export const DEFAULT_LAYOUT_ID = "open_arena";
export const LAYOUT_VERSION = 3;

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
const props = (setId) => Object.freeze((getEnvironmentPropSet(setId).props || []).map((item) => Object.freeze({ ...item, tags: Object.freeze([...(item.tags || [])]) })));

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

  // v39.0.0 activates twin_pillars through room data only. The roomPlan
  // geometry contract, spawn anchors, collision, and renderer consume the
  // layout without gameplay special-cases.
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
    tags: Object.freeze(["obstacle", "controlled", "v39"])
  }),


  side_pockets: Object.freeze({
    id: "side_pockets",
    name: "SIDE POCKETS",
    kind: "pockets",
    bounds: Object.freeze({ x: 0, y: 0, w: WORLD.w, h: WORLD.h }),
    walls: props("side_cache_pockets"),
    hazards: Object.freeze([]),
    spawnAnchors: Object.freeze([
      anchor("north_gate", CENTER.x, 150, ["edge", "far", "north"]),
      anchor("south_gate", CENTER.x, WORLD.h - 150, ["edge", "far", "south"]),
      anchor("west_mid", 170, CENTER.y, ["edge", "flank", "west"]),
      anchor("east_mid", WORLD.w - 170, CENTER.y, ["edge", "flank", "east"]),
      anchor("boss_anchor", CENTER.x, 190, ["boss"])
    ]),
    portal: Object.freeze({ x: WORLD.w - 190, y: CENTER.y }),
    tags: Object.freeze(["pockets", "loot-route", "v39-3-22"])
  }),

  broken_cover: Object.freeze({
    id: "broken_cover",
    name: "BROKEN COVER",
    kind: "cover",
    bounds: Object.freeze({ x: 0, y: 0, w: WORLD.w, h: WORLD.h }),
    walls: props("broken_cover_nodes"),
    hazards: Object.freeze([]),
    spawnAnchors: Object.freeze([
      anchor("north_west", CENTER.x - 360, 145, ["edge", "far", "north"]),
      anchor("north_east", CENTER.x + 360, 145, ["edge", "far", "north"]),
      anchor("south_west", CENTER.x - 360, WORLD.h - 145, ["edge", "far", "south"]),
      anchor("south_east", CENTER.x + 360, WORLD.h - 145, ["edge", "far", "south"]),
      anchor("boss_anchor", CENTER.x, 185, ["boss"])
    ]),
    portal: Object.freeze({ x: WORLD.w - 190, y: CENTER.y }),
    tags: Object.freeze(["cover", "shooter-readable", "v39-3-22"])
  }),

  static_strips: Object.freeze({
    id: "static_strips",
    name: "STATIC STRIPS",
    kind: "strips",
    bounds: Object.freeze({ x: 0, y: 0, w: WORLD.w, h: WORLD.h }),
    walls: props("static_strips"),
    hazards: Object.freeze([]),
    spawnAnchors: Object.freeze([
      anchor("west_flank", 185, CENTER.y, ["edge", "flank", "west"]),
      anchor("east_flank", WORLD.w - 185, CENTER.y, ["edge", "flank", "east"]),
      anchor("north_gate", CENTER.x, 145, ["edge", "far", "north"]),
      anchor("south_gate", CENTER.x, WORLD.h - 145, ["edge", "far", "south"]),
      anchor("boss_anchor", CENTER.x, 185, ["boss"])
    ]),
    portal: Object.freeze({ x: WORLD.w - 190, y: CENTER.y }),
    tags: Object.freeze(["static", "strip", "v39-3-22"])
  }),

  // Reserved for a later content pass; do not enable until enemy navigation
  // and room-specific QA prove that lane blockers remain readable.
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
