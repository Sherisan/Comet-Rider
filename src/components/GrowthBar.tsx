import { levelForTier, progressToNext, tierForMultiplier } from '../game/tiers';
import type { GameState } from '../game/useGameState';
import type { LiveClock } from '../game/useLiveClock';

/** Upgrade progress bar under the multiplier — "LVL 1: SCOUT · 65% TO FIGHTER". */
export function GrowthBar({ state, live }: { state: GameState; live: LiveClock }) {
  const multiplier = state.phase === 'waiting' ? 1 : live.multiplier;
  const tier = tierForMultiplier(multiplier);
  const { progress, next } = progressToNext(multiplier);
  const pct = Math.round(progress * 100);

  return (
    <div className="growth-bar">
      <div className="growth-labels">
        <span className="growth-level" style={{ color: tier.accent }}>LVL {levelForTier(tier)}: {tier.tier}</span>
        <span className="growth-next">
          {next ? `${pct}% TO ${next.tier}` : 'MAX CLASS'}
        </span>
      </div>
      <div className="growth-track">
        <div className="growth-fill" style={{ width: `${next ? pct : 100}%`, background: tier.accent, boxShadow: `0 0 8px ${tier.accent}` }} />
      </div>
    </div>
  );
}
