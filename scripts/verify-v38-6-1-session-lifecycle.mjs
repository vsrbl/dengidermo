import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustInclude(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`missing ${label}`);
}

const main = read("src/main.js");
const transport = read("src/net/transport.js");
const server = read("server/server.js");
const constants = read("src/core/constants.js");

mustInclude(constants, 'VERSION = "v38.6.2"', "v38.6.2 frontend version");
mustInclude(main, 'if (msg.t === "leave" && from)', "host app-level leave handling");
mustInclude(main, "dropRemotePlayer(from);", "host removes app-level leaver");
mustInclude(transport, "sendLeaveNotice()", "transport explicit leave notice");
mustInclude(transport, 'this.sendToHost({ t: "leave" }, { preferRelay: true });', "guest leave relay fallback");
mustInclude(transport, "setTimeout(doClose, 50)", "socket close flush window");
mustInclude(transport, "if (wasKnown) this.callbacks.onPlayerLeft?.(joinedId);", "stale id reset before rejoin");
mustInclude(transport, 'if (msg.type === "room_closed")', "room closed handling");
mustInclude(server, "function pruneClosedPlayers(room)", "server stale socket pruning");
mustInclude(server, "if (ws.nnRoom || ws.nnPlayerId) leave(ws);", "server rejoins leave old session first");
mustInclude(server, "closeRoom(room, \"host_missing\")", "server rejects hostless rooms");
mustInclude(server, 'nncckkrr signaling v38.6.2', "v38.6.2 server banner");

console.log("v38.6.2 session lifecycle checks passed");
