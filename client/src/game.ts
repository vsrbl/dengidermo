import type { InputMessage, PlayerSnapshot, SnapshotMessage, WelcomeMessage } from './protocol';

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type RenderPlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  seq: number;
};

export class ClientGame {
  readonly players = new Map<string, RenderPlayer>();
  localId: string | null = null;
  map: string[] = [];
  serverTick = 0;
  lastCorrection = 0;

  private localSeq = 0;
  private lastSentSignature = '';

  applyWelcome(message: WelcomeMessage): void {
    this.localId = message.id;
    this.map = message.map;
    this.serverTick = message.serverTick;
  }

  applySnapshot(message: SnapshotMessage): void {
    this.serverTick = message.tick;
    const live = new Set<string>();

    for (const snapshot of message.players) {
      live.add(snapshot.id);
      this.upsertPlayer(snapshot);
    }

    for (const id of this.players.keys()) {
      if (!live.has(id)) {
        this.players.delete(id);
      }
    }
  }

  buildInput(input: InputState): InputMessage | null {
    const signature = `${Number(input.up)}${Number(input.down)}${Number(input.left)}${Number(input.right)}`;
    if (signature === this.lastSentSignature) return null;

    this.lastSentSignature = signature;
    this.localSeq += 1;

    return {
      t: 'input',
      seq: this.localSeq,
      up: input.up,
      down: input.down,
      left: input.left,
      right: input.right,
    };
  }

  buildInputHeartbeat(input: InputState): InputMessage {
    this.localSeq += 1;
    return {
      t: 'input',
      seq: this.localSeq,
      up: input.up,
      down: input.down,
      left: input.left,
      right: input.right,
    };
  }

  predictLocal(input: InputState, dtSeconds: number): void {
    if (this.localId === null) return;
    const player = this.players.get(this.localId);
    if (player === undefined) return;

    const axisX = Number(input.right) - Number(input.left);
    const axisY = Number(input.down) - Number(input.up);
    if (axisX === 0 && axisY === 0) return;

    const length = Math.hypot(axisX, axisY);
    const distance = 7.2 * dtSeconds;
    const next = moveWithCollision(this.map, player.x, player.y, (axisX / length) * distance, (axisY / length) * distance);

    player.x = next.x;
    player.y = next.y;
  }

  interpolate(dtSeconds: number): void {
    for (const player of this.players.values()) {
      const isLocal = player.id === this.localId;
      const strength = isLocal ? 12 : 18;
      const alpha = 1 - Math.exp(-strength * dtSeconds);
      player.x += (player.targetX - player.x) * alpha;
      player.y += (player.targetY - player.y) * alpha;
    }
  }

  private upsertPlayer(snapshot: PlayerSnapshot): void {
    const existing = this.players.get(snapshot.id);

    if (existing === undefined) {
      this.players.set(snapshot.id, {
        id: snapshot.id,
        name: snapshot.name,
        x: snapshot.x,
        y: snapshot.y,
        targetX: snapshot.x,
        targetY: snapshot.y,
        seq: snapshot.seq,
      });
      return;
    }

    existing.name = snapshot.name;
    existing.targetX = snapshot.x;
    existing.targetY = snapshot.y;
    existing.seq = snapshot.seq;

    if (snapshot.id === this.localId) {
      const distance = Math.hypot(existing.x - snapshot.x, existing.y - snapshot.y);
      if (distance > 0.8) {
        existing.x = snapshot.x;
        existing.y = snapshot.y;
        this.lastCorrection = distance;
      } else {
        this.lastCorrection = distance;
      }
    }
  }
}

function moveWithCollision(map: string[], x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  let nextX = x;
  let nextY = y;

  const candidateX = x + dx;
  if (!isBlocked(map, candidateX, y)) nextX = candidateX;

  const candidateY = y + dy;
  if (!isBlocked(map, nextX, candidateY)) nextY = candidateY;

  return { x: nextX, y: nextY };
}

function isBlocked(map: string[], x: number, y: number): boolean {
  const cellY = Math.floor(y);
  const cellX = Math.floor(x);
  const row = map[cellY];
  if (row === undefined) return true;
  return row[cellX] === '#' || row[cellX] === undefined;
}
