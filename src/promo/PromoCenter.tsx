import { useEffect, useState } from 'react';
import { formatMoney } from '../game/money';
import type { LeaderboardDetails, PromoEvent, PromoState, PublicPromo } from './promoApi';
import './promo.css';

const ICON: Partial<Record<PublicPromo['type'], string>> = {
  FreeBet: '🎁',
  Rain: '🌧️',
  RoundDrop: '🎯',
  MultiplierLeaderboard: '🏆',
  MultiplierRace: '🏁',
  CommunityJackpot: '💰',
  Cashback: '💸',
};
const icon = (t: PublicPromo['type']) => ICON[t] ?? '🎁';

const METRIC: Record<NonNullable<LeaderboardDetails['metric']>, string> = {
  BestMultiple: 'Best cash-out multiplier',
  BestWin: 'Biggest single win',
  TotalWagered: 'Most wagered',
  TotalWon: 'Most won',
  RoundsPlayed: 'Most rounds played',
  Hits: 'Most special hits',
};

/** A leaderboard score as its metric reads: "12.50×", "R250.00", "37". */
function scoreText(metric: LeaderboardDetails['metric'], score: number, currency: string): string {
  if (!metric || metric === 'BestMultiple') return `${score.toFixed(2)}×`;
  if (metric === 'RoundsPlayed' || metric === 'Hits') return String(score);
  return formatMoney(score, currency);
}

/** One line on what the promotion does, in the player's currency. */
export function describePromo(p: PublicPromo, currency: string): string {
  const m = (v: number) => formatMoney(v, currency);
  const d = p.details;
  switch (p.type) {
    case 'FreeBet':
      return `Free bets of ${m(d.stake)} — ${d.stakeReturned ? 'wins pay the whole return' : 'wins pay everything above the stake'}.`;
    case 'Rain':
      return `${m(d.pool)} rains on up to ${d.recipients} players who bet in the last ${d.activeWithinMinutes} minutes.`;
    case 'RoundDrop':
      return `Every round has a ${(d.chance * 100).toFixed(d.chance < 0.01 ? 2 : 0)}% chance to drop ${
        d.prize === 'Cash' ? m(d.amount) : `a ${m(d.amount)} free bet`
      } on ${d.winners === 1 ? 'a random player' : `${d.winners} random players`}.`;
    case 'MultiplierLeaderboard':
      return `${METRIC[(d.metric ?? 'BestMultiple') as keyof typeof METRIC]} wins — ${d.prizes.length} prize${d.prizes.length === 1 ? '' : 's'}, top prize ${m(d.prizes[0])}.`;
    case 'MultiplierRace':
      return `First ${d.winners} to cash out at ${d.targetMultiplier}× or more win ${m(d.prize)} — ${d.remaining} place${d.remaining === 1 ? '' : 's'} left.`;
    case 'CommunityJackpot':
      return `${m(d.pool)} shared by everyone in a round that crashes at ${d.triggerMultiplier}× or more.`;
    case 'Cashback':
      return `${d.percent}% of your net losses back every ${d.period === 'Daily' ? 'day' : 'week'} (up to ${m(d.maxPerPlayer)})${d.days?.length ? ` — on ${d.days.join(', ')}` : ''}.${d.due > 0 ? ` So far: ${m(d.due)} due.` : ''}`;
    default:
      return '';
  }
}

function countdown(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'ending…';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 48 ? `${Math.floor(h / 24)}d left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/** Top-bar button: opens the promo panel; shows how many free bets the player has. */
export function PromoButton({ promos, open, onToggle }: { promos: PromoState | null; open: boolean; onToggle: () => void }) {
  if (!promos || (promos.promotions.length === 0 && promos.freeBets.length === 0)) return null;
  const free = promos.freeBets.length;
  return (
    <button className={`promo-btn glass ${open ? 'open' : ''}`} onClick={onToggle} aria-expanded={open}>
      <span aria-hidden>🎁</span>
      <span className="promo-btn-label">Promos</span>
      {free > 0 && <span className="promo-btn-badge">{free}</span>}
    </button>
  );
}

export function PromoPanel({ promos, currency, onClose }: { promos: PromoState; currency: string; onClose: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="promo-panel glass" aria-label="Promotions">
        <div className="promo-panel-head">
          <span>Promotions</span>
          <button className="promo-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {promos.freeBets.length > 0 && (
          <div className="promo-freebets">
            <div className="promo-freebets-title">🎁 You have {promos.freeBets.length} free bet{promos.freeBets.length === 1 ? '' : 's'}</div>
            <div className="promo-freebets-list">
              {promos.freeBets.map((f) => (
                <span key={f.awardId} className="promo-chip">
                  {formatMoney(f.amount, currency)}
                  {f.expiresAt && <small> · {countdown(f.expiresAt, now)}</small>}
                </span>
              ))}
            </div>
            <div className="promo-hint">Use one with the 🎁 button on a bet slot before the round starts.</div>
          </div>
        )}

        {promos.promotions.map((p) => (
          <section key={p.promotionId} className="promo-card">
            <div className="promo-card-head">
              <span className="promo-icon" aria-hidden>{icon(p.type)}</span>
              <span className="promo-name">{p.name}</span>
              {p.endsAt && p.type !== 'MultiplierLeaderboard' && <span className="promo-ends">{countdown(p.endsAt, now)}</span>}
            </div>
            <p className="promo-desc">{describePromo(p, currency)}</p>
            {p.type === 'MultiplierLeaderboard' && <Leaderboard board={p.details as LeaderboardDetails} currency={currency} now={now} />}
            {p.minStake > 0 && p.type !== 'FreeBet' && <p className="promo-terms">Min stake {formatMoney(p.minStake, currency)}. Free bets don't count.</p>}
            {p.terms && <p className="promo-terms">{p.terms}</p>}
          </section>
        ))}

        {promos.promotions.length === 0 && <p className="promo-desc">No promotions running right now.</p>}
      </aside>
    </>
  );
}

function Leaderboard({ board, currency, now }: { board: LeaderboardDetails; currency: string; now: number }) {
  return (
    <div className="promo-board">
      <div className="promo-board-meta">
        {board.period === 'Once' ? 'Leaderboard' : board.period === 'Daily' ? "Today's board" : "This week's board"}
        {board.periodEndsAt && <span> · {countdown(board.periodEndsAt, now)}</span>}
      </div>
      <ol>
        {board.top.map((r) => (
          <li key={r.rank} className={board.me?.rank === r.rank ? 'me' : ''}>
            <span className="rank">{r.rank}</span>
            <span className="who">{r.player}</span>
            <span className="score">{scoreText(board.metric, r.score, currency)}</span>
            <span className="prize">{r.rank <= board.prizes.length ? formatMoney(board.prizes[r.rank - 1], currency) : ''}</span>
          </li>
        ))}
        {board.top.length === 0 && <li className="empty">No qualifying cash-outs yet — be the first.</li>}
      </ol>
      {board.me && board.me.rank > 10 && (
        <div className="promo-board-me">
          You're #{board.me.rank} with {scoreText(board.metric, board.me.score, currency)}
        </div>
      )}
    </div>
  );
}

/** Big announcement when something happens for everyone (rain, jackpot, race place). */
export function PromoBanner({ event, onDone }: { event: PromoEvent | null; onDone: () => void }) {
  useEffect(() => {
    if (!event) return;
    const t = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(t);
  }, [event, onDone]);
  if (!event) return null;
  return (
    <div className={`promo-banner promo-banner-${event.type}`} role="status" onClick={onDone}>
      <span className="promo-banner-icon" aria-hidden>{icon(event.type)}</span>
      <div>
        <div className="promo-banner-title">{event.name}</div>
        <div className="promo-banner-text">{event.message}</div>
      </div>
    </div>
  );
}
