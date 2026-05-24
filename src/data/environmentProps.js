import { CENTER, WORLD } from "../core/constants.js";

export const ENVIRONMENT_PROP_SCHEMA_VERSION = 1;

function prop(id, role, x, y, w, h, tags = []) {
  return Object.freeze({
    id,
    kind: "solid",
    role,
    shape: "rect",
    x,
    y,
    w,
    h,
    tags: Object.freeze(tags)
  });
}

export const ENVIRONMENT_PROP_SETS = Object.freeze({
  none: Object.freeze({
    id: "none",
    label: "NOISE EMPTY",
    gameplay: "open baseline arena",
    props: Object.freeze([]),
    tags: Object.freeze(["open"])
  }),

  twin_pillar_signal: Object.freeze({
    id: "twin_pillar_signal",
    label: "TWIN SIGNAL",
    gameplay: "two readable cover pillars without maze pressure",
    props: Object.freeze([
      prop("pillar_west", "cover", CENTER.x - 260, CENTER.y - 170, 72, 340, ["pillar", "cover", "solid"]),
      prop("pillar_east", "cover", CENTER.x + 188, CENTER.y - 170, 72, 340, ["pillar", "cover", "solid"])
    ]),
    tags: Object.freeze(["cover", "pillar"])
  }),

  side_cache_pockets: Object.freeze({
    id: "side_cache_pockets",
    label: "CACHE POCKETS",
    gameplay: "wide side pockets that pull players off the center line for loot decisions",
    props: Object.freeze([
      prop("west_pocket_top", "cover", CENTER.x - 610, CENTER.y - 245, 88, 180, ["pocket", "west", "solid"]),
      prop("west_pocket_bottom", "cover", CENTER.x - 610, CENTER.y + 65, 88, 180, ["pocket", "west", "solid"]),
      prop("east_pocket_top", "cover", CENTER.x + 522, CENTER.y - 245, 88, 180, ["pocket", "east", "solid"]),
      prop("east_pocket_bottom", "cover", CENTER.x + 522, CENTER.y + 65, 88, 180, ["pocket", "east", "solid"])
    ]),
    tags: Object.freeze(["pocket", "loot-route"])
  }),

  broken_cover_nodes: Object.freeze({
    id: "broken_cover_nodes",
    label: "BROKEN COVER",
    gameplay: "small isolated blockers that create shooter cover without maze pathing",
    props: Object.freeze([
      prop("cover_nw", "cover", CENTER.x - 430, CENTER.y - 240, 76, 76, ["cover", "node", "solid"]),
      prop("cover_ne", "cover", CENTER.x + 354, CENTER.y - 236, 76, 76, ["cover", "node", "solid"]),
      prop("cover_sw", "cover", CENTER.x - 360, CENTER.y + 196, 64, 64, ["cover", "node", "solid"]),
      prop("cover_se", "cover", CENTER.x + 296, CENTER.y + 202, 64, 64, ["cover", "node", "solid"])
    ]),
    tags: Object.freeze(["cover", "shooter-readable"])
  }),

  static_strips: Object.freeze({
    id: "static_strips",
    label: "STATIC STRIPS",
    gameplay: "thin readable strip blockers that bend movement without becoming corridors",
    props: Object.freeze([
      prop("strip_north", "signal", CENTER.x - 360, 232, 720, 24, ["signal", "strip", "solid"]),
      prop("strip_south", "signal", CENTER.x - 360, WORLD.h - 256, 720, 24, ["signal", "strip", "solid"])
    ]),
    tags: Object.freeze(["signal", "strip"])
  })
});

export function getEnvironmentPropSet(id = "none") {
  return ENVIRONMENT_PROP_SETS[id] || ENVIRONMENT_PROP_SETS.none;
}

export function environmentPropSnapshot(id = "none") {
  const set = getEnvironmentPropSet(id);
  return {
    id: set.id,
    label: set.label,
    gameplay: set.gameplay,
    props: (set.props || []).map((item) => ({ ...item, tags: [...(item.tags || [])] })),
    tags: [...(set.tags || [])]
  };
}
