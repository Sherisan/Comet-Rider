import { useEffect, useRef, useState } from 'react';
import { currencySymbol, formatMoney, formatMultiplier } from '../game/money';
import type { GameActions, GameState } from '../game/useGameState';
import type { LiveClock } from '../game/useLiveClock';
import type { FreeBet } from '../promo/promoApi';

const AUTOPLAY_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '∞', value: null },
];

/** Quick-pick amounts; only those inside the table limits are shown (first four). */
const QUICK_AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 500, 1000];

/**
 * One betting slot, crash-game style: amount + quick picks on the left, one
 * big action button on the right whose label always says what it will do
 * (FEED R5.00 / CASH OUT R7.35 / FEED next round / CANCEL).
 */
export function BetSlot({
  slot,
  state,
  live,
  actions,
  freeBet,
}: {
  slot: number;
  state: GameState;
  live: LiveClock;
  actions: GameActions;
  /** The player's next promo free bet, if they have one. */
  freeBet?: FreeBet | null;
}) {
  const [amount, setAmount] = useState(5);
  const [draft, setDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<'bet' | 'auto'>('bet');
  const [autoCashOn, setAutoCashOn] = useState(false);
  const [autoCashValue, setAutoCashValue] = useState(2);
  const [autoPlayPreset, setAutoPlayPreset] = useState<number | null>(10);
  const [autoPlayOn, setAutoPlayOn] = useState(false);
  const [roundsLeft, setRoundsLeft] = useState<number | null>(null);
  // Bet armed between rounds — placed as soon as the next betting window opens.
  const [queued, setQueued] = useState(false);
  const lastPlacedRound = useRef<string | null>(null);

  const currency = state.me?.currency ?? 'ZAR';
  const minBet = state.limits?.minBet ?? 1;
  const maxBet = state.limits?.maxBet ?? 10000;
  const myBet = state.myBets[slot];
  const online = state.conn === 'online';
  const boost = myBet?.boost ?? 0;
  const settled = myBet != null && (myBet.cashedOutAt != null || myBet.lost || myBet.dead);
  const betRiding = myBet != null && !settled;

  const clamp = (v: number) => Math.min(maxBet, Math.max(minBet, Math.round(v * 100) / 100));
  const step = (dir: 1 | -1) =>
    setAmount((a) => clamp(a + dir * (a >= 100 ? 25 : a >= 20 ? 5 : 1)));
  const betMax = () => setAmount(clamp(Math.min(maxBet, Math.floor(state.balance))));
  const chips = QUICK_AMOUNTS.filter((v) => v >= minBet && v <= maxBet).slice(0, 4);
  const controlsLocked = betRiding || autoPlayOn || queued;
  const autoCashOut = autoCashOn ? Math.max(1.01, autoCashValue) : null;

  const commitDraft = () => {
    if (draft == null) return;
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) setAmount(clamp(parsed));
    setDraft(null);
  };

  // Place a queued or auto-play bet as soon as a betting window opens.
  useEffect(() => {
    if (!queued && !autoPlayOn) return;
    if (state.phase !== 'waiting' || myBet != null) return;
    if (!state.roundId || lastPlacedRound.current === state.roundId) return;
    if (autoPlayOn && roundsLeft === 0) {
      setAutoPlayOn(false);
      return;
    }
    const betAmt = clamp(amount);
    if (betAmt > state.balance) {
      setAutoPlayOn(false);
      setQueued(false);
      return;
    }
    lastPlacedRound.current = state.roundId;
    actions.placeBet(betAmt, slot, autoCashOut);
    if (autoPlayOn) setRoundsLeft((r) => (r == null ? r : r - 1));
    setQueued(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, autoPlayOn, state.phase, state.roundId, myBet]);

  const toggleAutoPlay = () => {
    setAutoPlayOn((on) => {
      if (!on) setRoundsLeft(autoPlayPreset);
      return !on;
    });
  };

  const placeNow = () => {
    lastPlacedRound.current = state.roundId;
    actions.placeBet(clamp(amount), slot, autoCashOut);
  };

  const renderMainButton = () => {
    if (betRiding && state.phase === 'flying') {
      const effective = live.multiplier + boost;
      return (
        <button className="main-btn cashout" disabled={!online} onClick={() => actions.cashOut(slot)}>
          <span className="main-btn-title">CASH OUT</span>
          <span className="main-btn-amount">{formatMoney(myBet!.amount * effective - (myBet!.free ? myBet!.amount : 0), currency)}</span>
          <span className="main-btn-meta">{formatMultiplier(effective)}{boost > 0 ? ' ⚡' : ''}{myBet!.free ? ' · FREE BET' : ''}</span>
        </button>
      );
    }
    if (betRiding) {
      return (
        <button className="main-btn placed" disabled>
          <span className="main-btn-title">PLACED ✓</span>
          <span className="main-btn-meta">waiting for launch</span>
        </button>
      );
    }
    if (autoPlayOn) {
      return (
        <button className="main-btn stop" onClick={() => setAutoPlayOn(false)}>
          <span className="main-btn-title">STOP AUTO</span>
          <span className="main-btn-meta">{roundsLeft == null ? '∞' : roundsLeft} rounds left</span>
        </button>
      );
    }
    if (queued) {
      return (
        <button className="main-btn stop" onClick={() => setQueued(false)}>
          <span className="main-btn-title">CANCEL</span>
          <span className="main-btn-meta">waiting for next round</span>
        </button>
      );
    }
    const affordable = clamp(amount) <= state.balance;
    if (state.phase === 'waiting' && myBet == null) {
      return (
        <button className="main-btn feed" disabled={!online || !affordable} onClick={placeNow}>
          <span className="main-btn-title">LAUNCH</span>
          <span className="main-btn-amount">{formatMoney(clamp(amount), currency)}</span>
        </button>
      );
    }
    return (
      <button className="main-btn feed next" disabled={!online || !affordable} onClick={() => setQueued(true)}>
        <span className="main-btn-title">LAUNCH</span>
        <span className="main-btn-meta">next round · {formatMoney(clamp(amount), currency)}</span>
      </button>
    );
  };

  const result = myBet?.dead
    ? { kind: 'lost', text: '☄️ ASTEROID HIT' }
    : myBet?.cashedOutAt != null && (myBet.winAmount ?? 0) > 0
      ? { kind: 'won', text: `+${formatMoney(myBet.winAmount!, currency)} @ ${formatMultiplier(myBet.cashedOutAt)}` }
      : myBet?.lost
        ? { kind: 'lost', text: 'DESTROYED' }
        : null;

  return (
    <div className={`bet-slot ${betRiding ? 'riding' : ''}`}>
      <div className="bet-slot-controls">
        <div className="bet-slot-head">
          <span className="bet-slot-label">BET {slot + 1}</span>
          <div className="seg" role="tablist">
            <button className={mode === 'bet' ? 'on' : ''} onClick={() => setMode('bet')}>Bet</button>
            <button className={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>
              Auto{autoPlayOn || autoCashOn ? ' •' : ''}
            </button>
          </div>
          {boost > 0 && <span className="bet-slot-boost">⚡ +{boost.toFixed(2)}x</span>}
        </div>

        <div className="bet-slot-row">
          <button className="step-btn" disabled={controlsLocked} onClick={() => step(-1)} aria-label="Decrease bet">−</button>
          <label className="bet-amount">
            <span className="bet-amount-cur">{currencySymbol(currency)}</span>
            <input
              inputMode="decimal"
              value={draft ?? clamp(amount).toFixed(2)}
              disabled={controlsLocked}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              aria-label="Bet amount"
            />
          </label>
          <button className="step-btn" disabled={controlsLocked} onClick={() => step(1)} aria-label="Increase bet">+</button>
        </div>

        {mode === 'bet' ? (
          <div className="chip-row quick">
            {chips.map((v) => (
              <button
                key={v}
                className={`amt-chip ${clamp(amount) === v ? 'on' : ''}`}
                disabled={controlsLocked}
                onClick={() => setAmount(clamp(v))}
              >
                {v}
              </button>
            ))}
            <button className="amt-chip" disabled={controlsLocked} onClick={() => setAmount((a) => clamp(a * 2))}>×2</button>
            <button className="amt-chip max" disabled={controlsLocked} onClick={betMax}>MAX</button>
          </div>
        ) : (
          <div className="chip-row">
            <label className={`mini-chip ${autoCashOn ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={autoCashOn}
                disabled={betRiding}
                onChange={(e) => setAutoCashOn(e.target.checked)}
              />
              <span>Cash out at</span>
              <input
                type="number"
                min={1.01}
                step={0.1}
                value={autoCashValue}
                disabled={!autoCashOn || betRiding}
                onChange={(e) => setAutoCashValue(Number(e.target.value) || 1.01)}
              />
              <span className="mini-chip-x">x</span>
            </label>
            <label className={`mini-chip ${autoPlayOn ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={autoPlayOn}
                disabled={betRiding && !autoPlayOn}
                onChange={toggleAutoPlay}
              />
              <span>Auto-play</span>
              <select
                value={autoPlayPreset ?? 'inf'}
                disabled={autoPlayOn}
                onChange={(e) => setAutoPlayPreset(e.target.value === 'inf' ? null : Number(e.target.value))}
              >
                {AUTOPLAY_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value ?? 'inf'}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="bet-slot-action">
        {renderMainButton()}
        {freeBet && state.phase === 'waiting' && myBet == null && !autoPlayOn && !queued && (
          <button
            className="free-bet-btn"
            disabled={!online}
            onClick={() => {
              lastPlacedRound.current = state.roundId;
              actions.placeFreeBet(slot, autoCashOut);
            }}
          >
            🎁 FREE BET {formatMoney(freeBet.amount, currency)}
          </button>
        )}
        {result && <span className={`bet-slot-result ${result.kind}`}>{result.text}</span>}
      </div>
    </div>
  );
}
