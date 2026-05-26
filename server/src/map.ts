export const MAP = [
  '################################################',
  '#..............................................#',
  '#...............####...........................#',
  '#..............................................#',
  '#.....######.................######............#',
  '#..............................................#',
  '#.....................####.....................#',
  '#..............................................#',
  '#..........####................................#',
  '#..............................................#',
  '#.................................#####........#',
  '#..............................................#',
  '#........#####.................................#',
  '#..............................................#',
  '#..................######......................#',
  '#..............................................#',
  '#....####......................................#',
  '#..............................................#',
  '################################################',
] as const;

export const MAP_WIDTH = MAP[0].length;
export const MAP_HEIGHT = MAP.length;

export type Point = {
  x: number;
  y: number;
};

export const SPAWN_POINTS: readonly Point[] = [
  { x: 4.5, y: 3.5 },
  { x: 42.5, y: 3.5 },
  { x: 4.5, y: 15.5 },
  { x: 42.5, y: 15.5 },
];

export function isWallAtCell(x: number, y: number): boolean {
  if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) {
    return true;
  }

  return MAP[y]?.[x] === '#';
}

export function isBlockedWorld(x: number, y: number): boolean {
  return isWallAtCell(Math.floor(x), Math.floor(y));
}

export function moveWithCollision(x: number, y: number, dx: number, dy: number): Point {
  let nextX = x;
  let nextY = y;

  const candidateX = x + dx;
  if (!isBlockedWorld(candidateX, y)) {
    nextX = candidateX;
  }

  const candidateY = y + dy;
  if (!isBlockedWorld(nextX, candidateY)) {
    nextY = candidateY;
  }

  return { x: clamp(nextX, 1.05, MAP_WIDTH - 1.05), y: clamp(nextY, 1.05, MAP_HEIGHT - 1.05) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
