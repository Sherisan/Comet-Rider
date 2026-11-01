import type { GameState } from '../game/useGameState';

/** Crash-game colour bands for past results: low / mid / high. */
function band(multiplier: number): 'low' | 'mid' | 'high' {
  return multiplier < 2 ? 'low' : multiplier < 10 ? 'mid' : 'high';
}

/** Recent crash multipliers, newest first — the strip along the top of every crash game. */
export function HistoryStrip({ state }: { state: GameState }) {
  if (state.history.length === 0) return null;
  return (
    <div className="history-strip" aria-label="Recent results">
      {state.history.slice(0, 20).map((entry, i) => (
        <span key={entry.roundId} className={`history-chip ${band(entry.crashMultiplier)} ${i === 0 ? 'latest' : ''}`}>
          {entry.crashMultiplier.toFixed(2)}x
        </span>
      ))}
    </div>
  );
}
