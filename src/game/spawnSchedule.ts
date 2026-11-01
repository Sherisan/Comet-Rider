// Deterministic swimmer schedule — MUST stay bit-for-bit identical to
// Domain/SpawnSchedule.cs on the server. Both sides seed sfc32 from
// SHA-256(serverSeedHash:clientSeed:nonce) — all public at RoundStarted —
// so the fish/bombs the player sees are exactly what the server validates.

export interface SpawnEvent {
  id: number;
  timeMs: number;
  isBomb: boolean;
  /** 0=sardine, 1=clownfish, 2=grouper, 3=tuna */
  tier: number;
  durationMs: number;
  /** Vertical lane, percent of arena height. */
  y0: number;
  /** 1 = swims left→right, -1 = right→left. */
  dir: 1 | -1;
  /** Sine-wave amplitude, percent. */
  amp: number;
  phase: number;
}

/** Boost per eaten fish by tier — mirror of SpawnSchedule.TierBoosts. */
export const TIER_BOOSTS = [0.02, 0.05, 0.12, 0.25];
export const MAX_BOOST = 2.0;

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export async function generateSchedule(
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
): Promise<SpawnEvent[]> {
  const bytes = new TextEncoder().encode(`${serverSeedHash}:${clientSeed}:${nonce}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const dv = new DataView(digest);
  const next = sfc32(
    dv.getUint32(0, true),
    dv.getUint32(4, true),
    dv.getUint32(8, true),
    dv.getUint32(12, true),
  );

  const events: SpawnEvent[] = [];
  let t = 1500;
  let id = 0;
  while (t < 120000 && id < 400) {
    const r1 = next();
    const isBomb = r1 < 0.16;
    const r2 = next();
    const tier = r2 < 0.45 ? 0 : r2 < 0.75 ? 1 : r2 < 0.92 ? 2 : 3;
    const r3 = next();
    const durationMs = isBomb ? 14000 + r3 * 8000 : 9000 + r3 * 8000;
    const r4 = next();
    const y0 = 12 + r4 * 66;
    const r5 = next();
    const dir: 1 | -1 = r5 < 0.5 ? 1 : -1;
    const r6 = next();
    const amp = r6 * 5;
    const r7 = next();
    const phase = r7 * Math.PI * 2;

    events.push({ id, timeMs: t, isBomb, tier, durationMs, y0, dir, amp, phase });
    id++;

    const r8 = next();
    const interval = (2400 / (1 + t / 20000)) * (0.6 + 0.8 * r8);
    t += Math.max(280, interval);
  }
  return events;
}

/** Swimmer position at a given round time, in arena percent coords. Null when off-stage. */
export function swimmerPosition(ev: SpawnEvent, elapsedMs: number): { x: number; y: number } | null {
  const progress = (elapsedMs - ev.timeMs) / ev.durationMs;
  if (progress < 0 || progress > 1) return null;
  const x = ev.dir === 1 ? -8 + progress * 116 : 108 - progress * 116;
  const y = ev.y0 + ev.amp * Math.sin(progress * 8 + ev.phase);
  return { x, y };
}
