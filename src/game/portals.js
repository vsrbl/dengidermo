import { clamp, dist2 } from "../core/math.js";
import { beginRoomTransition, createExitPortal, currentLocation, initLocation, makePortalTransitionEffect, moveTeamToNextLocation, PORTAL_MARGIN } from "./roomFlow.js";
import { canOpenPortal } from "./director.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";

export { createExitPortal, currentLocation, initLocation, moveTeamToNextLocation };

export function updatePortals(state, dt) {
  if (!state.portals || !Object.keys(state.portals).length) createExitPortal(state);
  const alive = Object.values(state.players).filter((p) => p.hp > 0);
  const loc = currentLocation(state);

  for (const portal of Object.values(state.portals)) {
    // v38.3+: portal activation is gated by the director phase contract,
    // not raw room time. v38.5: transition orchestration belongs to roomFlow.
    const nextActive = canOpenPortal(state);
    portal.active = nextActive;
    if (!nextActive) {
      portal.openStableFor = 0;
    } else {
      portal.openStableFor = (portal.openStableFor || 0) + dt;
    }
    if (portal.active && (portal.openStableFor || 0) >= 0.18 && !portal.openMomentFired) {
      portal.openMomentFired = true;
      pushEvent(state, {
        type: "portal",
        action: "exit_open",
        portalId: portal.id,
        locationId: loc.id || state.locationId || null,
        locationName: loc.name || state.locationName || null,
        runDepth: state.runDepth ?? state.locationIndex ?? null,
        loopIndex: state.loopIndex ?? state.roomPlan?.loopIndex ?? null,
        x: Math.round(portal.x),
        y: Math.round(portal.y)
      });
      pushVisualEffect(state, {
        type: "portal",
        x: portal.x,
        y: portal.y,
        radius: portal.radius + 72,
        color: "#00ff66",
        life: 0.58,
        maxLife: 0.58
      });
    }
    if (!portal.active || alive.length === 0) {
      portal.progress = Math.max(0, portal.progress - dt * 0.9);
      continue;
    }

    const allInside = alive.every((p) => {
      const r = portal.radius + p.radius + PORTAL_MARGIN;
      return dist2(p.x, p.y, portal.x, portal.y) <= r * r;
    });

    if (allInside) portal.progress += dt;
    else portal.progress = Math.max(0, portal.progress - dt * 0.7);

    const need = state.portalHold ?? loc.portalHold ?? 1.15;
    if (portal.progress >= need) {
      portal.progress = need;
      beginRoomTransition(state, "portal", {
        fx: makePortalTransitionEffect(portal),
        nextRunDepth: portal.targetDepth ?? portal.targetIndex
      });
      return;
    }
  }
}

export function portalSnapshot(state) {
  const hold = state.portalHold || currentLocation(state).portalHold || 1.15;
  return Object.values(state.portals || {}).map((p) => ({
    id: p.id,
    kind: p.kind,
    x: Math.round(p.x),
    y: Math.round(p.y),
    radius: p.radius,
    active: !!p.active,
    progress: Number(clamp((p.progress || 0) / hold, 0, 1).toFixed(3)),
    targetIndex: p.targetIndex,
    targetDepth: p.targetDepth ?? p.targetIndex
  }));
}
