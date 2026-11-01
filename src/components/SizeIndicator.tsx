import { SHIP_TIERS, tierForMultiplier } from '../game/tiers';
import type { GameState } from '../game/useGameState';
import type { LiveClock } from '../game/useLiveClock';
import { Ship } from './space/Ship';

/** Top-right ship class indicator — Scout → Mothership, current class highlighted. */
export function SizeIndicator({ state, live }: { state: GameState; live: LiveClock }) {
  const current = tierForMultiplier(state.phase === 'waiting' ? 1 : live.multiplier);
  const classes = SHIP_TIERS.slice(1);

  return (
    <div className="size-panel glass">
      <span className="size-label">Class</span>
      <div className="size-slots">
        {classes.map((tier) => (
          <div
            key={tier.id}
            className={`size-slot ${tier === current ? 'active' : ''}`}
            title={`${tier.name} ×${tier.multiplier}`}
            style={tier === current ? { borderColor: tier.accent, boxShadow: `0 0 10px ${tier.accent}` } : undefined}
          >
            <Ship shipClass={tier.id} width={24} thrust={0} />
          </div>
        ))}
      </div>
      <span className="size-current" style={{ color: current.accent }}>{current.tierLabel}</span>
    </div>
  );
}
