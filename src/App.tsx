import { useEffect, useState } from 'react';
import { useGameState } from './game/useGameState';
import { useLiveClock } from './game/useLiveClock';
import { generateSchedule, type SpawnEvent } from './game/spawnSchedule';
import { GameArena } from './components/GameArena';
import { MultiplierPill } from './components/MultiplierPill';
import { SizeIndicator } from './components/SizeIndicator';
import { GrowthBar } from './components/GrowthBar';
import { HistoryStrip } from './components/HistoryStrip';
import { LiveBets } from './components/LiveBets';
import { Hud } from './components/Hud';
import { GameMenu } from './components/GameMenu';
import { Toasts } from './components/Toasts';

export default function App() {
  const { state, actions } = useGameState();
  const live = useLiveClock(state);
  // The side legend only opens by default when there's room for it beside
  // the arena; on phones it's a bottom sheet that would cover everything.
  const [legendOpen, setLegendOpen] = useState(() => window.innerWidth > 1100);

  // Deterministic swimmer schedule for the current round, derived from the
  // public fairness data — identical to the server's copy.
  const [schedule, setSchedule] = useState<SpawnEvent[] | null>(null);
  const fairness = state.fairness;
  useEffect(() => {
    if (!state.roundId || !fairness) {
      setSchedule(null);
      return;
    }
    let alive = true;
    generateSchedule(fairness.serverSeedHash, fairness.clientSeed, fairness.nonce).then((s) => {
      if (alive) setSchedule(s);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.roundId]);

  // Both slots ride the same shared fish, so their boosts track together —
  // take whichever is present in case only one slot has an active bet.
  const boost = Math.max(state.myBets[0]?.boost ?? 0, state.myBets[1]?.boost ?? 0);

  return (
    <div className="game-root">
      <GameArena state={state} live={live} schedule={schedule} actions={actions} />

      <header className="top-bar">
        <button
          className={`paytable-btn glass ${legendOpen ? 'open' : ''}`}
          onClick={() => setLegendOpen((open) => !open)}
          aria-label="Menu"
          aria-expanded={legendOpen}
        >
          <span className="paytable-icon" aria-hidden>
            <span /><span /><span />
          </span>
          <span className="paytable-label">Menu</span>
        </button>

        <HistoryStrip state={state} />

        <div className="top-right">
          <SizeIndicator state={state} live={live} />
          <div className="conn-badge" title={`connection: ${state.conn}`}>
            <span className={`conn conn-${state.conn}`} />
            {state.me && <span className="conn-user">{state.me.username}</span>}
          </div>
        </div>
      </header>

      {legendOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setLegendOpen(false)} />
          <GameMenu state={state} actions={actions} />
        </>
      )}

      <div className="center-stack">
        <MultiplierPill state={state} live={live} boost={boost} />
        <GrowthBar state={state} live={live} />
      </div>

      <LiveBets state={state} />
      <Hud state={state} live={live} actions={actions} />
      <Toasts toasts={state.toasts} actions={actions} />
    </div>
  );
}
