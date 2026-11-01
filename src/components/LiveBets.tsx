import { formatMoney } from '../game/money';
import type { GameState } from '../game/useGameState';

/** Masks other players' names ("player123" → "p***3"); your own shows as "You". */
function displayName(name: string, mine: boolean): string {
  if (mine) return 'You';
  return name.length <= 2 ? `${name[0] ?? '?'}***` : `${name[0]}***${name[name.length - 1]}`;
}

/** Everyone's bets this round, biggest first, with who has cashed out. Wide screens only. */
export function LiveBets({ state }: { state: GameState }) {
  const meId = state.me?.playerId;
  const currency = state.me?.currency ?? 'ZAR';
  const bets = [...state.bets].sort((a, b) => b.amount - a.amount);
  const total = bets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <aside className="live-bets glass">
      <div className="live-bets-head">
        <span>Live bets</span>
        <span className="live-bets-count">{bets.length}</span>
      </div>
      <div className="live-bets-total">
        Total <strong>{formatMoney(total, currency)}</strong>
      </div>
      <div className="live-bets-list">
        {bets.length === 0 && <div className="live-bets-empty">No bets yet this round</div>}
        {bets.slice(0, 40).map((b) => {
          const mine = b.playerId === meId;
          const won = b.cashedOutAt != null;
          return (
            <div key={b.betId} className={`live-bet ${won ? 'won' : ''} ${mine ? 'mine' : ''}`}>
              <span className="live-bet-name">{displayName(b.username, mine)}</span>
              <span className="live-bet-amt">{formatMoney(b.amount, b.currency)}</span>
              <span className="live-bet-x">{won ? `${b.cashedOutAt!.toFixed(2)}x` : ''}</span>
              <span className="live-bet-win">{won && b.winAmount != null ? formatMoney(b.winAmount, b.currency) : ''}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
