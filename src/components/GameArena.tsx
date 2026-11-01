import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { SHIP_TIERS, playerScale, tierForMultiplier, type ShipTier } from '../game/tiers';
import { msToMultiplier } from '../game/multiplier';
import { swimmerPosition, TIER_BOOSTS, type SpawnEvent } from '../game/spawnSchedule';
import type { GameActions, GameState } from '../game/useGameState';
import type { LiveClock } from '../game/useLiveClock';
import { Ship } from './space/Ship';
import { FuelCell } from './space/FuelCell';
import { Asteroid } from './space/Asteroid';
import { Starfield } from './space/Starfield';
import { Backdrop } from './space/Backdrop';
import explosionUrl from '../assets/space/fx-explosion.svg';
import impactUrl from '../assets/space/fx-impact.svg';
import debrisUrl from '../assets/space/fx-debris.svg';
import energyUrl from '../assets/space/icon-energy.svg';
import tapUrl from '../assets/space/icon-tap.svg';

const SLOTS = [0, 1];
/** Ship's resting spot — lower middle, so objects fall toward it from the top. */
const HOME = { x: 50, y: 70 };
/** Player ship width in px at scale 1 (before class scaling). */
const PLAYER_PX = 120;
/** Fuel capsule width in px by schedule tier (0–3), at scale 1. */
const CELL_PX = [42, 50, 60, 72];
const ASTEROID_PX = 68;
/** Spring stiffness (1/s) — higher follows the pointer more tightly. */
const FOLLOW_OMEGA = 7.5;
/** Ship sits this far above a finger on touch screens so it isn't hidden. */
const TOUCH_LIFT_PX = 80;

interface Floatie {
  key: number;
  x: number;
  y: number;
  text: string;
}

interface Motion {
  /** Position in arena percent. */
  x: number;
  y: number;
  /** Velocity in px/s. */
  vx: number;
  vy: number;
  /** Bank angle in degrees (right turn positive). */
  bank: number;
}

let floatieKey = 0;

/**
 * Where a scheduled object is on screen. The shared schedule (identical to the
 * server's) describes horizontal swimmers; Comet Rider flies vertically, so its
 * lane becomes the column and its progress the fall from top to bottom. The
 * server only validates that an object exists at that moment, never where it
 * was drawn, so this is purely presentation.
 */
function screenPos(ev: SpawnEvent, elapsedMs: number): { x: number; y: number } | null {
  const p = swimmerPosition(ev, elapsedMs);
  if (!p) return null;
  return {
    x: 6 + ((p.y - 7) / 76) * 88,
    y: ev.dir === 1 ? p.x : 100 - p.x,
  };
}

/** Arena size → one scale factor for every sprite, so phones and 4K screens both look right. */
function useArenaScale(ref: RefObject<HTMLDivElement>) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(1.25, Math.max(0.55, Math.min(width / 1280, height / 760))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

/**
 * Fullscreen space canvas, flying upward. Two ways to play:
 * - passive: classic crash game, the ship cruises near the bottom centre;
 * - interactive: move the mouse (or drag a finger) to fly the ship — grab
 *   fuel cells your class can carry for multiplier boosts, dodge asteroids.
 */
export function GameArena({
  state,
  live,
  schedule,
  actions,
}: {
  state: GameState;
  live: LiveClock;
  schedule: SpawnEvent[] | null;
  actions: GameActions;
}) {
  const arenaRef = useRef<HTMLDivElement>(null);
  const scale = useArenaScale(arenaRef);
  const tier = tierForMultiplier(live.multiplier);
  const playerTierIdx = SHIP_TIERS.indexOf(tier);
  // One shared ship serves both bet slots — flyable as long as either slot
  // still has a live, uncashed bet riding this round.
  const hasLiveBet = SLOTS.some((s) => {
    const b = state.myBets[s];
    return b != null && b.cashedOutAt == null && !b.lost;
  });

  // Upgrade flash when the ship moves up a class mid-flight.
  const prevClass = useRef(tier.id);
  const [upgraded, setUpgraded] = useState<ShipTier | null>(null);
  useEffect(() => {
    if (state.phase !== 'flying') {
      prevClass.current = 'scout';
      return;
    }
    if (tier.id !== prevClass.current) {
      prevClass.current = tier.id;
      setUpgraded(tier);
      const timer = setTimeout(() => setUpgraded(null), 1700);
      return () => clearTimeout(timer);
    }
  }, [tier, state.phase]);

  // ── Interactive control ────────────────────────────────────────────
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const motion = useRef<Motion>({ ...HOME, vx: 0, vy: 0, bank: 0 });
  const [engaged, setEngaged] = useState(false);
  const engagedRef = useRef(false);
  engagedRef.current = engaged;
  const [steered, setSteered] = useState(false);
  const collectedRef = useRef<Set<number>>(new Set());
  const [floaties, setFloaties] = useState<Floatie[]>([]);
  const [blast, setBlast] = useState<{ x: number; y: number } | null>(null);
  // Witnessed locally the instant an asteroid collision is detected — independent
  // of per-slot server state, since only one ship is ever on screen.
  const [shipDown, setShipDown] = useState(false);
  const canInteract = state.phase === 'flying' && hasLiveBet && !shipDown;

  // Fresh arena state each round.
  useEffect(() => {
    collectedRef.current = new Set();
    targetRef.current = null;
    motion.current = { ...HOME, vx: 0, vy: 0, bank: 0 };
    setShipDown(false);
    setEngaged(false);
    setSteered(false);
    setFloaties([]);
    setBlast(null);
  }, [state.roundId]);

  /** Flyable box in arena percent — below the multiplier readout, above the bet panel. */
  const bounds = useCallback(() => {
    const arena = arenaRef.current?.getBoundingClientRect();
    const hud = document.querySelector('.hud-bar')?.getBoundingClientRect();
    let maxY = 88;
    if (arena && hud && arena.height > 0) {
      maxY = Math.min(88, ((hud.top - arena.top) / arena.height) * 100 - 9);
    }
    return { minX: 6, maxX: 94, minY: 30, maxY: Math.max(40, maxY) };
  }, []);

  const onPointer = useCallback(
    (e: ReactPointerEvent) => {
      if (!canInteract) return;
      const rect = arenaRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Touch: only steer while the finger is down; keep the ship above it.
      if (e.pointerType === 'touch' && e.buttons === 0 && e.type !== 'pointerdown') return;
      const lift = e.pointerType === 'touch' ? TOUCH_LIFT_PX : 0;
      const b = bounds();
      targetRef.current = {
        x: Math.min(b.maxX, Math.max(b.minX, ((e.clientX - rect.left) / rect.width) * 100)),
        y: Math.min(b.maxY, Math.max(b.minY, ((e.clientY - lift - rect.top) / rect.height) * 100)),
      };
      setEngaged(true);
      setSteered(true);
    },
    [canInteract, bounds],
  );
  const disengage = useCallback(() => setEngaged(false), []);

  // Everything the animation loop needs, refreshed every render.
  const latest = useRef({ canInteract, schedule, flyingAnchor: state.flyingAnchor, scale, actions });
  latest.current = { canInteract, schedule, flyingAnchor: state.flyingAnchor, scale, actions };

  // ── Flight + collision loop ────────────────────────────────────────
  // Spring-follow toward the pointer, frame-rate independent; the ship banks
  // into its turns.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = arenaRef.current?.getBoundingClientRect();
      const L = latest.current;
      const m = motion.current;
      if (rect && rect.width > 0) {
        const b = bounds();
        let target = L.canInteract ? targetRef.current : null;
        if (!target) {
          // Idle: lazy weave around the bottom centre.
          const t = now / 1000;
          target = { x: HOME.x + Math.sin(t * 0.5) * 7, y: HOME.y + Math.sin(t * 0.9) * 2 };
        }
        const tx = Math.min(b.maxX, Math.max(b.minX, target.x));
        const ty = Math.min(b.maxY, Math.max(b.minY, target.y));

        // Critically-damped spring in px space.
        const dxPx = ((tx - m.x) / 100) * rect.width;
        const dyPx = ((ty - m.y) / 100) * rect.height;
        const w = FOLLOW_OMEGA;
        m.vx += (w * w * dxPx - 2 * w * m.vx) * dt;
        m.vy += (w * w * dyPx - 2 * w * m.vy) * dt;
        const maxSpeed = 1500 * L.scale;
        const speed = Math.hypot(m.vx, m.vy);
        if (speed > maxSpeed) {
          m.vx *= maxSpeed / speed;
          m.vy *= maxSpeed / speed;
        }
        m.x += ((m.vx * dt) / rect.width) * 100;
        m.y += ((m.vy * dt) / rect.height) * 100;

        // Bank into sideways movement (max ±28°), settling back level.
        const goal = Math.max(-28, Math.min(28, (m.vx / (700 * L.scale)) * 28));
        m.bank += (goal - m.bank) * Math.min(1, dt * 8);

        // Collisions only while the player is actively flying a live bet —
        // a hands-off player plays the classic crash game and can't hit an asteroid.
        if (L.canInteract && engagedRef.current && L.schedule && L.flyingAnchor != null) {
          const elapsed = now - L.flyingAnchor;
          const mult = msToMultiplier(elapsed);
          const tierIdx = SHIP_TIERS.indexOf(tierForMultiplier(mult));
          const px = (m.x / 100) * rect.width;
          const py = (m.y / 100) * rect.height;
          const playerR = PLAYER_PX * L.scale * playerScale(mult) * 0.3;
          for (const ev of L.schedule) {
            if (collectedRef.current.has(ev.id)) continue;
            const pos = screenPos(ev, elapsed);
            if (!pos) continue;
            const size = (ev.isBomb ? ASTEROID_PX : CELL_PX[ev.tier]) * L.scale;
            const dist = Math.hypot(px - (pos.x / 100) * rect.width, py - (pos.y / 100) * rect.height);
            if (dist > playerR + size * 0.38) continue;

            if (ev.isBomb) {
              collectedRef.current.add(ev.id);
              setBlast({ x: m.x, y: m.y });
              setShipDown(true);
              // Notify both slots — the server only actually kills whichever ones
              // still have a live bet, so this is safe even if only one is active.
              SLOTS.forEach((s) => L.actions.bombHit(s, ev.id));
              break;
            }
            if (ev.tier < tierIdx) {
              collectedRef.current.add(ev.id);
              setFloaties((f) => [
                ...f.slice(-5),
                { key: ++floatieKey, x: pos.x, y: pos.y, text: `+${TIER_BOOSTS[ev.tier].toFixed(2)}x` },
              ]);
              SLOTS.forEach((s) => L.actions.eatFish(s, ev.id));
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bounds]);

  // Expire boost floaties.
  useEffect(() => {
    if (floaties.length === 0) return;
    const timer = setTimeout(() => setFloaties((f) => f.slice(1)), 900);
    return () => clearTimeout(timer);
  }, [floaties]);

  // Starfield speed: slow drift between rounds, rushing faster as the multiplier climbs.
  const speedRef = useRef(40);
  speedRef.current =
    state.phase === 'flying' && !shipDown
      ? 140 + 520 * Math.log(Math.max(1, live.multiplier))
      : state.phase === 'waiting'
        ? 40
        : 10;
  const starSpeed = useCallback(() => speedRef.current, []);

  // Live objects for this frame (App re-renders ~60fps via the live clock).
  const elapsedMs =
    state.phase === 'flying' && state.flyingAnchor != null
      ? performance.now() - state.flyingAnchor
      : -1;
  const objects =
    schedule && elapsedMs >= 0
      ? schedule
          .filter((ev) => !collectedRef.current.has(ev.id))
          .map((ev) => ({ ev, pos: screenPos(ev, elapsedMs) }))
          .filter((o): o is { ev: SpawnEvent; pos: { x: number; y: number } } => o.pos != null)
      : [];

  const crashed = state.phase === 'crashed' && state.lastCrash;
  // On a round crash the ship stays up for a beat so the falling asteroid visibly hits it.
  const showPlayer = !shipDown;
  const m = motion.current;
  const s = scale;
  const thrust = state.phase === 'flying' ? Math.min(1, 0.35 + Math.log(live.multiplier) / 2.5) : 0.15;
  const blastAt = blast ?? { x: m.x, y: m.y };

  return (
    <div
      ref={arenaRef}
      className={`space ${state.phase === 'crashed' || blast ? 'shake' : ''} ${canInteract ? 'steerable' : ''}`}
      onPointerDown={onPointer}
      onPointerMove={onPointer}
      onPointerLeave={disengage}
      onPointerUp={(e) => e.pointerType === 'touch' && disengage()}
      onPointerCancel={disengage}
    >
      <Backdrop scale={s} />
      <Starfield speed={starSpeed} />

      {/* Scheduled objects — same deterministic set the server validates. */}
      {objects.map(({ ev, pos }) => {
        const collectible = !ev.isBomb && ev.tier < playerTierIdx;
        return (
          <div
            key={ev.id}
            className={`space-obj ${ev.isBomb ? 'rock' : collectible ? 'collectible' : 'locked'} ${canInteract && ev.isBomb ? 'danger' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            {ev.isBomb ? (
              <Asteroid width={ASTEROID_PX * s} seed={ev.id} />
            ) : (
              <FuelCell tier={ev.tier} width={CELL_PX[ev.tier] * s} />
            )}
          </div>
        );
      })}

      {floaties.map((f) => (
        <span key={f.key} className="floatie" style={{ left: `${f.x}%`, top: `${f.y}%` }}>
          <img src={energyUrl} alt="" width={16} />
          {f.text}
        </span>
      ))}

      {showPlayer && (
        <div
          className={`player-ship ${engaged ? 'controlled' : ''} ${crashed ? 'doomed' : ''}`}
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            transform: `translate(-50%, -50%) scale(${state.phase === 'waiting' ? 0.8 : playerScale(live.multiplier) * 1.3})`,
          }}
        >
          <div className="player-ship-body" style={{ transform: `rotate(${m.bank.toFixed(1)}deg)` }}>
            <Ship shipClass={state.phase === 'waiting' ? 'scout' : tier.id} width={PLAYER_PX * s} thrust={thrust} />
          </div>
          {upgraded && <span className="upgrade-ring" style={{ borderColor: upgraded.accent }} />}
        </div>
      )}

      {canInteract && !steered && (
        <div className="steer-hint">
          <img className="steer-hint-icon" src={tapUrl} alt="" width={18} />
          Move or drag to fly · grab fuel cells · dodge asteroids
        </div>
      )}

      {/* Destroyed — by an asteroid you flew into, or the round's crash. */}
      {(crashed || shipDown) && (
        <div className={`explosion ${shipDown ? '' : 'on-impact'}`} style={{ left: `${blastAt.x}%`, top: `${blastAt.y}%` }}>
          <img className="fx-impact" src={impactUrl} alt="" width={200 * s} />
          <img className="fx-explosion" src={explosionUrl} alt="" width={220 * s} />
          <img className="fx-debris" src={debrisUrl} alt="" width={260 * s} />
        </div>
      )}

      {crashed && (
        <div className="impact-rock" style={{ left: `${m.x}%`, '--hit': `${m.y}%` } as CSSProperties}>
          <Asteroid width={200 * s} seed={2} spin={false} />
        </div>
      )}

      {upgraded && (
        <div className="upgrade-toast" style={{ color: upgraded.accent }}>
          UPGRADED — {upgraded.name.toUpperCase()} x{upgraded.multiplier}
        </div>
      )}
    </div>
  );
}
