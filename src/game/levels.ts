export type Rect = { x: number; y: number; w: number; h: number };
export type Hoop = { x: number; y: number; got: boolean; tight: boolean };

export type Level = {
  name: string;
  start: { x: number; y: number };
  solids: Rect[];
  hoops: Hoop[];
  water: Rect | null;
  grow: { x: number; y: number } | null;
  shrinks: { x: number; y: number }[];
  door: Rect;
  check: { x: number; y: number };
  enemy: { x: number; y: number; vx: number; min: number; max: number } | null;
};

const names = ["Yard", "Grow", "Water", "Spikes"] as const;

export function courseName(index: number) {
  return names[index] ?? "Yard";
}

export function makeLevel(course: number): Level {
  if (course === 2) {
    return {
      name: "Grow",
      start: { x: 28, y: 150 },
      solids: [
        { x: 8, y: 168, w: 304, h: 16 },
        { x: 16, y: 124, w: 72, h: 14 },
        { x: 148, y: 56, w: 70, h: 14 },
        { x: 230, y: 112, w: 78, h: 14 },
      ],
      hoops: [
        { x: 180, y: 38, got: false, tight: false },
        { x: 48, y: 156, got: false, tight: true },
      ],
      water: null,
      grow: { x: 200, y: 156 },
      shrinks: [{ x: 176, y: 48 }],
      door: { x: 268, y: 84, w: 18, h: 28 },
      check: { x: 52, y: 112 },
      enemy: null,
    };
  }
  if (course === 3) {
    return {
      name: "Water",
      start: { x: 32, y: 132 },
      solids: [
        { x: 8, y: 150, w: 72, h: 16 },
        { x: 236, y: 150, w: 76, h: 16 },
        { x: 244, y: 96, w: 64, h: 14 },
      ],
      hoops: [
        { x: 156, y: 128, got: false, tight: false },
        { x: 270, y: 78, got: false, tight: false },
      ],
      water: { x: 80, y: 146, w: 156, h: 54 },
      grow: { x: 36, y: 138 },
      shrinks: [],
      door: { x: 274, y: 68, w: 18, h: 28 },
      check: { x: 40, y: 136 },
      enemy: null,
    };
  }
  if (course === 4) {
    return {
      name: "Spikes",
      start: { x: 28, y: 148 },
      solids: [
        { x: 8, y: 168, w: 96, h: 16 },
        { x: 200, y: 168, w: 112, h: 16 },
        { x: 24, y: 124, w: 52, h: 12 },
        { x: 132, y: 92, w: 48, h: 12 },
        { x: 220, y: 58, w: 72, h: 12 },
      ],
      hoops: [
        { x: 48, y: 108, got: false, tight: false },
        { x: 154, y: 74, got: false, tight: false },
      ],
      water: null,
      grow: null,
      shrinks: [
        { x: 118, y: 176 },
        { x: 134, y: 176 },
        { x: 150, y: 176 },
      ],
      door: { x: 258, y: 30, w: 18, h: 28 },
      check: { x: 46, y: 112 },
      enemy: { x: 70, y: 156, vx: 36, min: 24, max: 88 },
    };
  }
  return {
    name: "Yard",
    start: { x: 26, y: 30 },
    solids: [
      { x: 8, y: 44, w: 36, h: 124 },
      { x: 44, y: 84, w: 64, h: 14 },
      { x: 8, y: 168, w: 72, h: 16 },
      { x: 136, y: 96, w: 56, h: 14 },
      { x: 200, y: 52, w: 112, h: 14 },
      { x: 208, y: 152, w: 80, h: 14 },
      { x: 296, y: 52, w: 16, h: 114 },
    ],
    hoops: [
      { x: 164, y: 72, got: false, tight: false },
      { x: 236, y: 36, got: false, tight: false },
    ],
    water: { x: 112, y: 160, w: 88, h: 40 },
    grow: { x: 96, y: 156 },
    shrinks: [
      { x: 220, y: 144 },
      { x: 234, y: 144 },
      { x: 248, y: 144 },
      { x: 262, y: 144 },
    ],
    door: { x: 268, y: 24, w: 18, h: 28 },
    check: { x: 124, y: 140 },
    enemy: null,
  };
}
