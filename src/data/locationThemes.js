export const LOCATION_THEME_SCHEMA_VERSION = 1;

function theme(id, label, options = {}) {
  return Object.freeze({
    id,
    label,
    environmentPropSetId: options.environmentPropSetId || "none",
    accent: options.accent || "green",
    gridStep: options.gridStep || 80,
    tags: Object.freeze([...(options.tags || [])]),
    notes: options.notes || ""
  });
}

export const LOCATION_THEMES = Object.freeze({
  black_grid: theme("black_grid", "BLACK GRID", {
    environmentPropSetId: "none",
    accent: "green",
    gridStep: 80,
    tags: ["starter", "open"]
  }),
  cache_pockets: theme("cache_pockets", "CACHE POCKETS", {
    environmentPropSetId: "side_cache_pockets",
    accent: "green",
    gridStep: 76,
    tags: ["exploration", "loot-route"],
    notes: "side pockets create exploration pulls without adding maze pathfinding"
  }),
  broken_cover: theme("broken_cover", "BROKEN COVER", {
    environmentPropSetId: "broken_cover_nodes",
    accent: "green",
    gridStep: 84,
    tags: ["cover", "shooter-readable"]
  }),
  static_strips: theme("static_strips", "STATIC STRIPS", {
    environmentPropSetId: "static_strips",
    accent: "white",
    gridStep: 72,
    tags: ["static", "pressure"]
  }),
  twin_signal: theme("twin_signal", "TWIN SIGNAL", {
    environmentPropSetId: "twin_pillar_signal",
    accent: "green",
    gridStep: 80,
    tags: ["pillar", "cover"]
  })
});

export function getLocationTheme(id = "black_grid") {
  return LOCATION_THEMES[id] || LOCATION_THEMES.black_grid;
}

export function locationThemeSnapshot(id = "black_grid") {
  const theme = getLocationTheme(id);
  return {
    id: theme.id,
    label: theme.label,
    environmentPropSetId: theme.environmentPropSetId,
    accent: theme.accent,
    gridStep: theme.gridStep,
    tags: [...(theme.tags || [])],
    notes: theme.notes || ""
  };
}
