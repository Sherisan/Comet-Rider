// Exact mirror of GameEngine.MsToMultiplier so every client shows the same
// live multiplier the server will settle at. Server formula:
//   Math.Max(1.00, Math.Floor(100 * Math.Exp(0.00006 * ms)) / 100.0)
export const GROWTH_RATE = 0.00006;

export function msToMultiplier(ms: number): number {
  return Math.max(1, Math.floor(100 * Math.exp(GROWTH_RATE * ms)) / 100);
}

// Inverse (pre-floor) — used to re-anchor the local animation clock on
// authoritative MultiplierUpdated ticks and RoundState.elapsedFlyingMs.
export function multiplierToMs(multiplier: number): number {
  return Math.log(Math.max(1, multiplier)) / GROWTH_RATE;
}
