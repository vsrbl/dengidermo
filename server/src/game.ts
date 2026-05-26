import { MAP, moveWithCollision, SPAWN_POINTS } from './map.js';
import type { ClientInputMessage, PlayerSnapshot, ServerSnapshotMessage, ServerWelcomeMessage } from './protocol.js';

export const TICK_RATE = 60;
export const SNAPSHOT_RATE = 30;
export const MAX_PLAYERS = 4;
export const PLAYER_SPEED_CELLS_PER_SECOND = 7.2;

export type PlayerInput = {
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type Player = {
  id: string;
  name: string;
  x: number;
  y: number;
  input: PlayerInput;
  connectedAt: number;
};

export class GameRoom {
  private readonly players = new Map<string, Player>();
  private tickCounter = 0;
  private nextSpawnIndex = 0;

  get size(): number {
    return this.players.size;
  }

  get tick(): number {
    return this.tickCounter;
  }

  canJoin(): boolean {
    return this.players.size < MAX_PLAYERS;
  }

  addPlayer(id: string, name: string): ServerWelcomeMessage {
    if (!this.canJoin()) {
      throw new Error('room_full');
    }

    const spawn = SPAWN_POINTS[this.nextSpawnIndex % SPAWN_POINTS.length];
    this.nextSpawnIndex += 1;

    if (spawn === undefined) {
      throw new Error('spawn_missing');
    }

    const player: Player = {
      id,
      name,
      x: spawn.x,
      y: spawn.y,
      input: emptyInput(),
      connectedAt: Date.now(),
    };

    this.players.set(id, player);

    return {
      t: 'welcome',
      id,
      tickRate: TICK_RATE,
      snapshotRate: SNAPSHOT_RATE,
      serverTick: this.tickCounter,
      map: [...MAP],
    };
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  setInput(id: string, message: ClientInputMessage): void {
    const player = this.players.get(id);
    if (player === undefined) return;

    if (message.seq < player.input.seq) {
      return;
    }

    player.input = {
      seq: message.seq,
      up: message.up,
      down: message.down,
      left: message.left,
      right: message.right,
    };
  }

  step(dtSeconds: number): void {
    this.tickCounter += 1;

    for (const player of this.players.values()) {
      const axis = inputToAxis(player.input);
      if (axis.x === 0 && axis.y === 0) continue;

      const length = Math.hypot(axis.x, axis.y);
      const vx = axis.x / length;
      const vy = axis.y / length;
      const distance = PLAYER_SPEED_CELLS_PER_SECOND * dtSeconds;
      const moved = moveWithCollision(player.x, player.y, vx * distance, vy * distance);

      player.x = moved.x;
      player.y = moved.y;
    }
  }

  snapshot(): ServerSnapshotMessage {
    return {
      t: 'snapshot',
      tick: this.tickCounter,
      players: [...this.players.values()].map(toSnapshot),
    };
  }
}

function emptyInput(): PlayerInput {
  return { seq: 0, up: false, down: false, left: false, right: false };
}

function inputToAxis(input: PlayerInput): { x: number; y: number } {
  return {
    x: Number(input.right) - Number(input.left),
    y: Number(input.down) - Number(input.up),
  };
}

function toSnapshot(player: Player): PlayerSnapshot {
  return {
    id: player.id,
    name: player.name,
    x: round3(player.x),
    y: round3(player.y),
    seq: player.input.seq,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
