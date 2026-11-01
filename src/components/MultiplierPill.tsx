import { useRef, type CSSProperties } from 'react';
import { tierForMultiplier } from '../game/tiers';
import type { GameState } from '../game/useGameState';
import type { LiveClock } from '../game/useLiveClock';

/**
 * Hero status readout above the fish — the big number every crash game is
 * built around. Waiting: countdown with a draining bar. Flying: the live
 * multiplier, tinted by the fish's current tier, plus any eat boost.
 * Crashed: the bust multiplier in red.
 */
export function MultiplierPill({
  state,
  live,
  boost,
}: {
  state: GameState;
  live: LiveClock;
  boost: number;
}) {
  // The countdown length isn't sent separately — remember the largest value
  // seen this round and use it as 100% for the progress bar.
  const waitTotal = useRef({ roundId: null as string | null, seconds: 1 });
  if (state.phase === 'waiting') {
    if (waitTotal.current.roundId !== state.roundId) waitTotal.current = { roundId: state.roundId, seconds: 1 };
    waitTotal.current.seconds = Math.max(waitTotal.current.seconds, live.waitSeconds);
  }

  if (state.phase === 'waiting') {
    const pct = Math.min(100, (live.waitSeconds / waitTotal.current.seconds) * 100);
    return (
      <div className="hero waiting" aria-live="polite">
        <span className="hero-label">Place your bets</span>
        <span className="hero-value">{live.waitSeconds.toFixed(1)}s</span>
        <span className="hero-bar"><span style={{ width: `${pct}%` }} /></span>
      </div>
    );
  }
  if (state.phase === 'crashed' && state.lastCrash) {
    return (
      <div className="hero crashed" aria-live="polite">
        <span className="hero-label">Destroyed at</span>
        <span className="hero-value">{state.lastCrash.multiplier.toFixed(2)}x</span>
      </div>
    );
  }
  const tier = tierForMultiplier(live.multiplier);
  return (
    <div className="hero flying" style={{ '--hero-color': tier.multColor } as CSSProperties}>
      <span className="hero-value">{live.multiplier.toFixed(2)}x</span>
      {boost > 0 && <span className="hero-boost">⚡ +{boost.toFixed(2)}x boost</span>}
    </div>
  );
}
