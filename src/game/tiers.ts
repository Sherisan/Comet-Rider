// Comet Rider ship classes. The multiplier is the round multiplier at which the
// player's ship upgrades to that class. Index 0 isn't a ship — it keeps the
// table aligned with the server's tier numbering (fuel cell tier 0 = index 0).

export type ShipClass = 'probe' | 'scout' | 'fighter' | 'cruiser' | 'destroyer' | 'mothership';

export interface ShipTier {
  id: ShipClass;
  name: string;
  /** Short class label shown in the HUD ("Scout", "Mothership"). */
  tierLabel: string;
  /** Upper-case form for the growth bar ("SCOUT"). */
  tier: string;
  multiplier: number;
  /** Accent colour for the class (engine glow, legend, upgrade toast). */
  accent: string;
  /** Colour of the multiplier value in the legend / hero readout. */
  multColor: string;
}

export const SHIP_TIERS: ShipTier[] = [
  { id: 'probe',      name: 'Probe',      tierLabel: 'Probe',      tier: 'PROBE',      multiplier: 0.5, accent: '#8fa8c8', multColor: '#8fa8c8' },
  { id: 'scout',      name: 'Scout',      tierLabel: 'Scout',      tier: 'SCOUT',      multiplier: 1,   accent: '#2de2ff', multColor: '#2de2ff' },
  { id: 'fighter',    name: 'Fighter',    tierLabel: 'Fighter',    tier: 'FIGHTER',    multiplier: 2,   accent: '#ff8a3d', multColor: '#7cf5ff' },
  { id: 'cruiser',    name: 'Cruiser',    tierLabel: 'Cruiser',    tier: 'CRUISER',    multiplier: 5,   accent: '#5b8cff', multColor: '#b9a2ff' },
  { id: 'destroyer',  name: 'Destroyer',  tierLabel: 'Destroyer',  tier: 'DESTROYER',  multiplier: 10,  accent: '#ffd84d', multColor: '#ffd84d' },
  { id: 'mothership', name: 'Mothership', tierLabel: 'Mothership', tier: 'MOTHERSHIP', multiplier: 25,  accent: '#ff4fd8', multColor: '#ff7ae4' },
];

/** Fuel cells by schedule tier (0–3) — boost values mirror the server's TierBoosts. */
export const FUEL_CELLS = [
  { name: 'Micro Cell',   color: '#6de9d5' },
  { name: 'Power Cell',   color: '#d3ec79' },
  { name: 'Plasma Cell',  color: '#ffb45f' },
  { name: 'Quantum Core', color: '#b69aff' },
];

/** The class the player currently flies, given the live multiplier (starts as Scout at 1.00x). */
export function tierForMultiplier(multiplier: number): ShipTier {
  let current = SHIP_TIERS[1];
  for (const tier of SHIP_TIERS) {
    if (tier.multiplier >= 1 && multiplier >= tier.multiplier) current = tier;
  }
  return current;
}

/** 1-based level for the "LVL n: CLASS" growth label (Scout = 1 … Mothership = 5). */
export function levelForTier(tier: ShipTier): number {
  return SHIP_TIERS.indexOf(tier);
}

/** Progress (0..1) from the current class's threshold to the next one's. */
export function progressToNext(multiplier: number): { progress: number; next: ShipTier | null } {
  const current = tierForMultiplier(multiplier);
  const idx = SHIP_TIERS.indexOf(current);
  const next = idx < SHIP_TIERS.length - 1 ? SHIP_TIERS[idx + 1] : null;
  if (!next) return { progress: 1, next: null };
  const span = next.multiplier - current.multiplier;
  return {
    progress: Math.min(1, Math.max(0, (multiplier - current.multiplier) / span)),
    next,
  };
}

/** Visual scale of the player ship: 1.00x → 0.6, 25x+ → ~1.7, log growth. */
export function playerScale(multiplier: number): number {
  return Math.min(1.7, 0.6 + 0.28 * Math.log(Math.max(1, multiplier)) / Math.log(2.4));
}
