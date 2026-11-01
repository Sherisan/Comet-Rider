import { useEffect, useState } from 'react';
import { msToMultiplier } from './multiplier';
import type { GameState } from './useGameState';

export interface LiveClock {
  /** Locally animated multiplier while flying; last crash value while crashed; 1.00 otherwise. */
  multiplier: number;
  /** Seconds until the round launches (waiting phase), else 0. */
  waitSeconds: number;
}

/**
 * requestAnimationFrame clock derived from the reducer's anchors, so the
 * multiplier climbs at 60fps between the server's authoritative ticks.
 */
export function useLiveClock(state: GameState): LiveClock {
  const [clock, setClock] = useState<LiveClock>({ multiplier: 1, waitSeconds: 0 });
  const { phase, flyingAnchor, waitingEndsAt, lastCrash } = state;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      if (phase === 'flying' && flyingAnchor != null) {
        setClock({ multiplier: msToMultiplier(now - flyingAnchor), waitSeconds: 0 });
      } else if (phase === 'waiting' && waitingEndsAt != null) {
        setClock({ multiplier: 1, waitSeconds: Math.max(0, (waitingEndsAt - now) / 1000) });
      } else if (phase === 'crashed' && lastCrash) {
        setClock({ multiplier: lastCrash.multiplier, waitSeconds: 0 });
      } else {
        setClock({ multiplier: 1, waitSeconds: 0 });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, flyingAnchor, waitingEndsAt, lastCrash]);

  return clock;
}
