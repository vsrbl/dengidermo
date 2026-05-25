import { makeSnapshot } from "../game/state.js";
import { applyDevCommand, hasDevMode } from "../game/dev.js";

import { buildNetworkStatePacket } from "../game/snapshotBudget.js";

export function createDevControls(app) {
  function request(command) {
    if (!app.running || app.role !== "host" || !hasDevMode(app.hostState)) return;
    applyDevCommand(app.hostState, command);
    app.snapshot = makeSnapshot(app.hostState);
    app.transport?.broadcast(buildNetworkStatePacket(app.snapshot).packet);
  }

  return { request };
}
