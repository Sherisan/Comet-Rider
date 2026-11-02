import { useEffect, useRef, useState } from 'react';
import { formatMoney, formatMultiplier } from '../game/money';
import type { GameActions, GameState } from '../game/useGameState';
import type { LiveClock } from '../game/useLiveClock';
import { BetSlot } from './BetSlot';

/**
 * Bottom HUD — collapsible balance handle + two independent bet slots.
 * On narrow screens only one slot renders at a time (BET 1 / BET 2 tabs) so
 * its action button is always fully on-screen instead of risking getting
 * clipped by a scrollable two-card stack; wide screens show both side by
 * side and the tabs disappear (see the bet-slot-hidden media query).
 *
 * The panel folds away when a round starts so it doesn't cover the arena,
 * and reopens for the next betting window. While folded, each live bet gets
 * a one-tap CASH OUT button right in the handle.
 */
export function Hud({
  state,
  live,
  actions,
}: {
  state: GameState;
  live: LiveClock;
  actions: GameActions;
}) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const currency = state.me?.currency ?? 'ZAR';
  const toggle = () => setExpanded((e) => !e);

  // Only react to phase *changes*, so a manual open/close mid-phase sticks.
  const lastPhase = useRef(state.phase);
  useEffect(() => {
    if (state.phase === lastPhase.current) return;
    lastPhase.current = state.phase;
    if (state.phase === 'flying') setExpanded(false);
    else if (state.phase === 'waiting') setExpanded(true);
  }, [state.phase]);

  const online = state.conn === 'online';
  const liveBets = [0, 1].filter((i) => {
    const bet = state.myBets[i];
    return bet != null && state.phase === 'flying' && bet.cashedOutAt == null && !bet.lost && !bet.dead;
  });

  return (
    <div className="hud-zone">
      <div className={`hud-bar glass ${expanded ? '' : 'collapsed'}`}>
        <div className="hud-handle">
          <button className="hud-handle-stat" onClick={toggle}>
            <span className="hud-label">Balance</span>
            <span className="hud-value">{formatMoney(state.balance, currency)}</span>
          </button>

          {!expanded && liveBets.length > 0 && (
            <div className="quick-cashouts">
              {liveBets.map((i) => {
                const bet = state.myBets[i]!;
                const effective = live.multiplier + (bet.boost ?? 0);
                return (
                  <button
                    key={i}
                    className="main-btn cashout quick-cashout"
                    disabled={!online}
                    onClick={() => actions.cashOut(i)}
                  >
                    <span className="main-btn-sub">
                      CASH OUT{liveBets.length > 1 ? ` BET ${i + 1}` : ''} {formatMultiplier(effective)}
                    </span>
                    <span>{formatMoney(bet.amount * effective, currency)}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            className={`hud-chevron ${expanded ? 'up' : 'down'}`}
            onClick={toggle}
            aria-label={expanded ? 'Hide bets' : 'Show bets'}
          />
        </div>

        {/* Always mounted — just hidden while folded (see .hud-bar.collapsed) — so
            each slot's auto-play, auto-cashout and queued bet survive the fold
            that happens at every round start. */}
        <div className="bet-tabs">
          {[0, 1].map((i) => (
            <button
              key={i}
              className={`bet-tab ${activeTab === i ? 'active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              BET {i + 1}
              {state.myBets[i] && <span className="bet-tab-dot" aria-hidden />}
            </button>
          ))}
        </div>
        <div className="bet-slots-grid">
          <div className={activeTab === 0 ? 'bet-slot-visible' : 'bet-slot-hidden'}>
            <BetSlot slot={0} state={state} live={live} actions={actions} />
          </div>
          <div className={activeTab === 1 ? 'bet-slot-visible' : 'bet-slot-hidden'}>
            <BetSlot slot={1} state={state} live={live} actions={actions} />
          </div>
        </div>
      </div>
    </div>
  );
}
