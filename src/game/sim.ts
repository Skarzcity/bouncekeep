import { makeLevel, type Level } from "./levels";

export const WORLD_W = 320;
export const WORLD_H = 200;

const GRAV = 520;
const JUMP = 210;
const RUN_BONUS = 48;
const BIG_BONUS = 36;
const ACCEL = 320;
const MAX_VX = 96;

export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  big: boolean;
};

export type Sim = {
  course: number;
  level: Level;
  ball: Ball;
  grounded: boolean;
  paused: boolean;
  enemyX: number;
  enemyVx: number;
};

export function freshBall(level: Level, big = false): Ball {
  return {
    x: level.start.x,
    y: level.start.y,
    vx: 0,
    vy: 0,
    r: big ? 9 : 6,
    big,
  };
}

export function createSim(course: number): Sim {
  const level = makeLevel(course);
  return {
    course,
    level,
    ball: freshBall(level),
    grounded: false,
    paused: false,
    enemyX: level.enemy?.x ?? 0,
    enemyVx: level.enemy?.vx ?? 0,
  };
}

export function hoopCount(sim: Sim) {
  return sim.level.hoops.filter((h) => h.got).length;
}

export function doorOpen(sim: Sim) {
  return sim.level.hoops.every((h) => h.got);
}

function setBig(ball: Ball, big: boolean) {
  ball.big = big;
  ball.r = big ? 9 : 6;
}

export function respawn(sim: Sim) {
  const c = sim.level.check;
  if (c && sim.level.hoops) {
    /* checkpoint flag lives outside; caller sets position */
  }
  const at = sim.ball;
  at.vx = 0;
  at.vy = 0;
  setBig(at, false);
}

export function placeAtStart(sim: Sim) {
  sim.ball.x = sim.level.start.x;
  sim.ball.y = sim.level.start.y;
  respawn(sim);
}

export function placeAtCheck(sim: Sim) {
  sim.ball.x = sim.level.check.x;
  sim.ball.y = sim.level.check.y - 14;
  respawn(sim);
}

export type StepInput = { left: boolean; right: boolean; jump: boolean };

export type StepEvent = "hoop" | "check" | "die" | "win" | "grow" | "shrink";

export function step(sim: Sim, input: StepInput, dt: number, checkOn: boolean): StepEvent | null {
  if (sim.paused) return null;
  const ball = sim.ball;
  const level = sim.level;

  if (input.left) ball.vx -= ACCEL * (ball.big ? 0.72 : 1) * dt;
  if (input.right) ball.vx += ACCEL * (ball.big ? 0.72 : 1) * dt;
  if (!input.left && !input.right) ball.vx *= Math.pow(0.05, dt);
  const cap = ball.big ? MAX_VX * 0.72 : MAX_VX;
  ball.vx = Math.max(-cap, Math.min(cap, ball.vx));

  const wet =
    level.water &&
    ball.x > level.water.x &&
    ball.x < level.water.x + level.water.w &&
    ball.y > level.water.y;

  if (wet && ball.big && level.water) {
    const surface = level.water.y - ball.r;
    if (ball.y > surface) {
      ball.vy = -90;
      ball.y += (surface - ball.y) * Math.min(1, dt * 8);
    } else {
      ball.vy += GRAV * 0.35 * dt;
    }
  } else {
    ball.vy += (wet ? GRAV * 1.6 : GRAV) * dt;
  }

  if (input.jump && sim.grounded) {
    const run = Math.min(1, Math.abs(ball.vx) / 70);
    ball.vy = -(JUMP + run * RUN_BONUS + (ball.big ? BIG_BONUS : 0));
    sim.grounded = false;
  }

  const prevY = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = 0;
  }
  if (ball.x > WORLD_W - ball.r) {
    ball.x = WORLD_W - ball.r;
    ball.vx = 0;
  }

  sim.grounded = false;
  for (const p of level.solids) {
    const over =
      ball.x > p.x - 2 &&
      ball.x < p.x + p.w + 2 &&
      ball.y + ball.r >= p.y &&
      ball.y + ball.r <= p.y + 12 &&
      ball.vy >= 0 &&
      prevY + ball.r <= p.y + 6;
    if (over) {
      ball.y = p.y - ball.r;
      ball.vy = 0;
      sim.grounded = true;
    }
  }

  if (wet && ball.big && level.water && ball.y >= level.water.y - ball.r - 1 && ball.vy >= 0) {
    ball.y = level.water.y - ball.r;
    ball.vy = 0;
    sim.grounded = true;
  }

  let event: StepEvent | null = null;

  if (level.grow && Math.hypot(ball.x - level.grow.x, ball.y - level.grow.y) < 12) {
    if (!ball.big) event = "grow";
    setBig(ball, true);
  }
  for (const s of level.shrinks) {
    if (Math.hypot(ball.x - s.x, ball.y - s.y) < 10) {
      if (ball.big) event = "shrink";
      setBig(ball, false);
    }
  }

  if (!checkOn && Math.hypot(ball.x - level.check.x, ball.y - level.check.y) < 12) {
    event = "check";
  }

  for (const h of level.hoops) {
    if (h.got) continue;
    const reach = h.tight ? 8 : 12;
    if (Math.abs(ball.x - h.x) < reach && Math.abs(ball.y - h.y) < reach + 2) {
      if (h.tight && ball.big) continue;
      h.got = true;
      event = "hoop";
    }
  }

  if (level.enemy) {
    sim.enemyX += sim.enemyVx * dt;
    if (sim.enemyX < level.enemy.min || sim.enemyX > level.enemy.max) sim.enemyVx *= -1;
    if (Math.hypot(ball.x - sim.enemyX, ball.y - level.enemy.y) < ball.r + 8) {
      return "die";
    }
  }

  const door = level.door;
  if (
    doorOpen(sim) &&
    ball.x > door.x &&
    ball.x < door.x + door.w &&
    ball.y > door.y &&
    ball.y < door.y + door.h
  ) {
    return "win";
  }

  if (ball.y > WORLD_H + 16) return "die";
  return event;
}
