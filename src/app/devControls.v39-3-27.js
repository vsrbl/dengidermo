import { SNAPSHOT_RELAY_STATE_LIMIT_BYTES, SNAPSHOT_RELAY_TARGET_BYTES } from "../core/constants.js";
import { makeSnapshot } from "../game/state.js";
import { applyDevCommand, hasDevMode } from "../game/dev.js";

import { buildNetworkStatePacket } from "../game/snapshotBudget.js";

export function createDevControls(app) {
  function broadcastDevSnapshot() {
    const peers = app.players.filter((id) => id && id !== app.playerId);
    if (!peers.length) return;
    const p2pPacket = buildNetworkStatePacket(app.snapshot, { mode: "p2p" });
    const relayPacket = buildNetworkStatePacket(app.snapshot, { mode: "relay", targetBytes: SNAPSHOT_RELAY_TARGET_BYTES, limitBytes: SNAPSHOT_RELAY_STATE_LIMIT_BYTES });
    for (const peerId of peers) {
      const relay = app.transport?.getPeerTransportMode?.(peerId) !== "P2P";
      app.transport?.sendTo(peerId, relay ? relayPacket.packet : p2pPacket.packet, { channel: "state", preferRelay: relay, relayFallback: relay });
    }
  }

  function request(command) {
    if (!app.running || app.role !== "host" || !hasDevMode(app.hostState)) return;
    applyDevCommand(app.hostState, command);
    app.snapshot = makeSnapshot(app.hostState);
    broadcastDevSnapshot();
  }

  return { request };
}
