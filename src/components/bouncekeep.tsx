import { useEffect, useRef, useState } from "react";
import {
  WORLD_H,
  WORLD_W,
  createSim,
  doorOpen,
  hoopCount,
  placeAtCheck,
  placeAtStart,
  step,
  type Sim,
  type StepInput,
} from "@/game/sim";

const SAVE_KEY = "bouncekeep-v1";
const CONTINUE_COST = 40;

type Save = {
  v: 1;
  coins: number;
  lives: number;
  course: number;
  streak: number;
  last: string;
  pass: boolean;
  freeLifeDay: string;
  check: boolean;
};

type Modal =
  | { kind: "none" }
  | { kind: "fall" }
  | { kind: "empty" }
  | { kind: "clear"; last: boolean }
  | { kind: "note"; text: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday() {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function defaultSave(): Save {
  return {
    v: 1,
    coins: 40,
    lives: 3,
    course: 1,
    streak: 1,
    last: "",
    pass: false,
    freeLifeDay: "",
    check: false,
  };
}

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return touchStreak(defaultSave());
    const parsed = JSON.parse(raw) as Save;
    if (parsed.v !== 1) return touchStreak(defaultSave());
    return touchStreak(parsed);
  } catch {
    return touchStreak(defaultSave());
  }
}

function touchStreak(save: Save): Save {
  const t = today();
  if (save.last === t) return save;
  const next = { ...save };
  if (save.last === yesterday() || save.pass) next.streak = save.streak + 1;
  else next.streak = 1;
  next.last = t;
  next.coins += 10 + next.streak * 3;
  if (next.pass && next.freeLifeDay !== t) {
    next.lives = Math.min(5, next.lives + 1);
    next.freeLifeDay = t;
  }
  return next;
}

function draw(ctx: CanvasRenderingContext2D, sim: Sim, lives: number, checkOn: boolean) {
  const { level, ball } = sim;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#b9e2f5";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  if (level.water) {
    ctx.fillStyle = "#3aa0e0";
    ctx.fillRect(level.water.x, level.water.y, level.water.w, level.water.h);
    ctx.fillStyle = "#7ec8f0";
    ctx.fillRect(level.water.x, level.water.y, level.water.w, 3);
  }

  for (const r of level.solids) {
    ctx.fillStyle = "#c4473a";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#8d342c";
    for (let y = r.y + 4; y < r.y + r.h; y += 4) ctx.fillRect(r.x, y, r.w, 1);
    ctx.fillStyle = "#e07a62";
    ctx.fillRect(r.x, r.y, r.w, 1);
  }

  ctx.strokeStyle = "#f5c451";
  ctx.lineWidth = 2;
  for (const h of level.hoops) {
    if (h.got) continue;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, h.tight ? 5 : 7, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (level.grow) {
    ctx.fillStyle = "#37b24d";
    ctx.beginPath();
    ctx.moveTo(level.grow.x, level.grow.y - 8);
    ctx.lineTo(level.grow.x + 7, level.grow.y + 4);
    ctx.lineTo(level.grow.x - 7, level.grow.y + 4);
    ctx.fill();
  }

  ctx.fillStyle = "#e03131";
  for (const s of level.shrinks) {
    ctx.beginPath();
    ctx.moveTo(s.x - 4, s.y + 4);
    ctx.lineTo(s.x, s.y - 5);
    ctx.lineTo(s.x + 4, s.y + 4);
    ctx.fill();
  }

  ctx.fillStyle = checkOn ? "#e03131" : "#f5c451";
  ctx.beginPath();
  ctx.moveTo(level.check.x, level.check.y - 6);
  ctx.lineTo(level.check.x + 5, level.check.y);
  ctx.lineTo(level.check.x, level.check.y + 6);
  ctx.lineTo(level.check.x - 5, level.check.y);
  ctx.fill();

  if (level.enemy) {
    ctx.fillStyle = "#1b2430";
    ctx.beginPath();
    ctx.arc(sim.enemyX, level.enemy.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  const open = doorOpen(sim);
  ctx.fillStyle = open ? "#ced4da" : "#868e96";
  ctx.fillRect(level.door.x, level.door.y, level.door.w, level.door.h);
  ctx.fillStyle = "#1b2430";
  ctx.fillRect(level.door.x + 7, level.door.y + 10, 4, 6);

  ctx.fillStyle = ball.big ? "#4dabf7" : "#ff3b30";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(ball.x - 2, ball.y - 3, 2, 2);

  for (let i = 0; i < lives; i++) {
    ctx.fillStyle = "#ff3b30";
    ctx.beginPath();
    ctx.arc(12 + i * 12, WORLD_H - 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function Bouncekeep() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const saveRef = useRef<Save>(defaultSave());
  const heldRef = useRef({ l: false, r: false, j: false });
  const keysRef = useRef(new Set<string>());
  const jumpEdge = useRef(false);
  const [hud, setHud] = useState({ coins: 40, lives: 3, streak: 1, course: 1, hoops: 0, need: 2, big: false, pass: false });
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const modalRef = useRef<Modal>({ kind: "none" });

  function persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveRef.current));
  }

  function syncHud() {
    const sim = simRef.current;
    const s = saveRef.current;
    if (!sim) return;
    setHud({
      coins: s.coins,
      lives: s.lives,
      streak: s.streak,
      course: s.course,
      hoops: hoopCount(sim),
      need: sim.level.hoops.length,
      big: sim.ball.big,
      pass: s.pass,
    });
  }

  function show(next: Modal) {
    modalRef.current = next;
    setModal(next);
    if (simRef.current) simRef.current.paused = next.kind !== "none" && next.kind !== "note";
  }

  useEffect(() => {
    const save = loadSave();
    saveRef.current = save;
    persist();
    const sim = createSim(save.course);
    simRef.current = sim;
    syncHud();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const leftCodes = new Set(["ArrowLeft", "Digit4", "Numpad4", "KeyA"]);
    const rightCodes = new Set(["ArrowRight", "Digit6", "Numpad6", "KeyD"]);
    const jumpCodes = new Set(["ArrowUp", "Digit2", "Numpad2"]);

    function input(): StepInput {
      const keys = keysRef.current;
      const pad = heldRef.current;
      let left = pad.l;
      let right = pad.r;
      let jump = false;
      for (const code of keys) {
        if (leftCodes.has(code)) left = true;
        if (rightCodes.has(code)) right = true;
        if (jumpCodes.has(code)) jump = true;
      }
      const edge = (jump || pad.j) && !jumpEdge.current;
      jumpEdge.current = jump || pad.j;
      return { left, right, jump: edge };
    }

    const onKey = (e: KeyboardEvent) => {
      if (leftCodes.has(e.code) || rightCodes.has(e.code) || jumpCodes.has(e.code)) e.preventDefault();
      if (e.type === "keydown") keysRef.current.add(e.code);
      else keysRef.current.delete(e.code);
    };
    const clear = () => keysRef.current.clear();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", clear);

    window.__controlsTest = {
      getX: () => simRef.current?.ball.x ?? 0,
      getYaw: () => simRef.current?.ball.x ?? 0,
      getSpeed: () => Math.abs(simRef.current?.ball.vx ?? 0),
      setKeys: (codes: string[]) => {
        keysRef.current = new Set(codes);
      },
      debug: () => ({
        keys: [...keysRef.current],
        x: simRef.current?.ball.x ?? 0,
        vx: simRef.current?.ball.vx ?? 0,
        paused: simRef.current?.paused ?? false,
        modal: modalRef.current.kind,
      }),
    };

    let last = performance.now();
    let acc = 0;
    let hudTick = 0;
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const simNow = simRef.current;
      if (!simNow) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      const stepDt = 1 / 60;
      while (acc >= stepDt) {
        acc -= stepDt;
        if (modalRef.current.kind === "none" || modalRef.current.kind === "note") {
          const ev = step(simNow, input(), stepDt, saveRef.current.check);
          if (ev === "hoop") {
            saveRef.current.coins += 3;
            persist();
          } else if (ev === "check") {
            saveRef.current.check = true;
            saveRef.current.coins += 4;
            persist();
          } else if (ev === "die") {
            show({ kind: "fall" });
          } else if (ev === "win") {
            const lastCourse = saveRef.current.course >= 4;
            saveRef.current.coins += 20 + hoopCount(simNow) * 4;
            if (!lastCourse) saveRef.current.course += 1;
            saveRef.current.check = false;
            persist();
            show({ kind: "clear", last: lastCourse });
          }
        }
      }
      draw(ctx, simNow, saveRef.current.lives, saveRef.current.check);
      hudTick += dt;
      if (hudTick > 0.15) {
        hudTick = 0;
        syncHud();
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", clear);
      delete window.__controlsTest;
    };
  }, []);

  function spendLife() {
    const sim = simRef.current;
    if (!sim) return;
    saveRef.current.lives -= 1;
    persist();
    if (saveRef.current.lives <= 0) {
      show({ kind: "empty" });
      syncHud();
      return;
    }
    if (saveRef.current.check) placeAtCheck(sim);
    else placeAtStart(sim);
    show({ kind: "none" });
    syncHud();
  }

  function buyContinue() {
    const sim = simRef.current;
    if (!sim || saveRef.current.coins < CONTINUE_COST) return;
    saveRef.current.coins -= CONTINUE_COST;
    persist();
    if (saveRef.current.check) placeAtCheck(sim);
    else placeAtStart(sim);
    show({ kind: "none" });
    syncHud();
  }

  function nextCourse() {
    const sim = simRef.current;
    if (!sim) return;
    if (modal.kind === "clear" && modal.last) saveRef.current.course = 1;
    const fresh = createSim(saveRef.current.course);
    simRef.current = fresh;
    saveRef.current.check = false;
    persist();
    show({ kind: "none" });
    syncHud();
  }

  function buy(pack: "life" | "check" | "pass") {
    const s = saveRef.current;
    if (pack === "life") s.lives = Math.min(5, s.lives + 1);
    if (pack === "check") s.check = true;
    if (pack === "pass") {
      s.pass = true;
      s.coins += 40;
    }
    persist();
    if (modalRef.current.kind === "empty" && s.lives > 0) {
      const sim = simRef.current;
      if (sim) {
        if (s.check) placeAtCheck(sim);
        else placeAtStart(sim);
      }
      show({ kind: "none" });
    } else {
      show({ kind: "note", text: "Demo only. Nothing was charged." });
    }
    syncHud();
  }

  function hold(which: "l" | "r" | "j", down: boolean) {
    heldRef.current[which] = down;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-2 bg-sky px-3 py-3 text-ink">
      <header className="flex items-end justify-between gap-2">
        <h1 className="text-lg font-extrabold tracking-wide">BOUNCEKEEP</h1>
        <p className="text-sm font-bold">
          {hud.coins} coins · {hud.streak}
          {hud.pass ? " pass" : ""}
        </p>
      </header>
      <canvas
        ref={canvasRef}
        width={WORLD_W}
        height={WORLD_H}
        className="w-full border-4 border-mortar bg-sky [image-rendering:pixelated]"
      />
      <p className="flex justify-between text-sm font-bold">
        <span>
          {hud.course} · {["Yard", "Grow", "Water", "Spikes"][hud.course - 1]}
        </span>
        <span>
          Hoops {hud.hoops}/{hud.need}
        </span>
        <span>{hud.big ? "Big" : "Small"}</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Pad label="4" onDown={() => hold("l", true)} onUp={() => hold("l", false)} />
        <Pad label="2" onDown={() => hold("j", true)} onUp={() => hold("j", false)} />
        <Pad label="6" onDown={() => hold("r", true)} onUp={() => hold("r", false)} />
      </div>
      <section className="grid gap-2">
        <Offer title="Life token" detail="One extra ball, max 5" price="$0.99" onBuy={() => buy("life")} />
        <Offer title="Checkpoint" detail="Mark the diamond" price="$1.99" onBuy={() => buy("check")} />
        <Offer title="Bounce pass" detail="Streak shield and a daily life" price="$4.99" onBuy={() => buy("pass")} />
      </section>
      <p className="text-xs text-muted">4 and 6 roll. 2 jumps. The ball only moves when you do. Gravity does the rest.</p>

      {modal.kind !== "none" && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-ink/50 px-4">
          <div className="w-full max-w-sm rounded-lg border-4 border-mortar bg-panel p-4 text-ink">
            {modal.kind === "fall" && (
              <>
                <h2 className="text-lg font-extrabold">Missed it</h2>
                <p className="mt-1 text-sm text-muted">Continue keeps your hoops. A life sends you back.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="min-h-11 flex-1 rounded-md bg-panel px-2 py-3 font-extrabold" onClick={spendLife}>
                    Spend a life
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-md bg-gold px-2 py-3 font-extrabold disabled:opacity-40"
                    disabled={hud.coins < CONTINUE_COST}
                    onClick={buyContinue}
                  >
                    Continue · {CONTINUE_COST}
                  </button>
                </div>
              </>
            )}
            {modal.kind === "empty" && (
              <>
                <h2 className="text-lg font-extrabold">No balls left</h2>
                <p className="mt-1 text-sm text-muted">A life token puts you back on this course.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-md bg-panel px-2 py-3 font-extrabold"
                    onClick={() => {
                      saveRef.current.lives = 3;
                      saveRef.current.course = Math.max(1, saveRef.current.course);
                      const fresh = createSim(saveRef.current.course);
                      simRef.current = fresh;
                      saveRef.current.check = false;
                      persist();
                      show({ kind: "none" });
                      syncHud();
                    }}
                  >
                    Restart
                  </button>
                  <button type="button" className="min-h-11 flex-1 rounded-md bg-gold px-2 py-3 font-extrabold" onClick={() => buy("life")}>
                    Life token
                  </button>
                </div>
              </>
            )}
            {modal.kind === "clear" && (
              <>
                <h2 className="text-lg font-extrabold">{modal.last ? "Yard clear" : "Door open"}</h2>
                <p className="mt-1 text-sm text-muted">
                  {modal.last ? "Replay from the brick yard." : "Next course adds the next rule."}
                </p>
                <button type="button" className="mt-3 min-h-11 w-full rounded-md bg-gold py-3 font-extrabold" onClick={nextCourse}>
                  {modal.last ? "Replay" : "Next"}
                </button>
              </>
            )}
            {modal.kind === "note" && (
              <>
                <p className="text-sm">{modal.text}</p>
                <button type="button" className="mt-3 min-h-11 w-full rounded-md bg-gold py-3 font-extrabold" onClick={() => show({ kind: "none" })}>
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Pad({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      type="button"
      className="min-h-14 rounded-md border-[3px] border-mortar bg-panel text-lg font-extrabold"
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      {label}
    </button>
  );
}

function Offer({ title, detail, price, onBuy }: { title: string; detail: string; price: string; onBuy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border-2 border-mortar bg-panel/70 px-3 py-2">
      <div>
        <b className="block text-sm">{title}</b>
        <span className="text-xs text-muted">{detail}</span>
      </div>
      <button type="button" className="min-h-11 rounded-md bg-gold px-3 font-extrabold" onClick={onBuy}>
        {price}
      </button>
    </div>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      debug?: () => { keys: string[]; x: number; vx: number; paused: boolean; modal: string };
    };
  }
}
