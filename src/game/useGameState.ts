import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import { createGameConnection } from '../api/signalr';
import { getLimits } from '../api/rest';
import { multiplierToMs, msToMultiplier } from './multiplier';
import {
  phaseFromWire,
  type BetAddedDto,
  type BetCashedOutDto,
  type BetDto,
  type BetPlacedDto,
  type CashOutResultDto,
  type ConnectedAsDto,
  type HistoryEntryDto,
  type LimitsDto,
  type Phase,
  type PlayerBetHistoryEntryDto,
  type RoundCrashedDto,
  type RoundStartedDto,
  type RoundStateDto,
} from '../api/types';

export type ConnStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface MyBet {
  amount: number;
  autoCashOut: number | null;
  cashedOutAt: number | null;
  winAmount: number | null;
  lost: boolean;
  /** Multiplier boost earned by eating fish (server-confirmed). */
  boost: number;
  /** True after hitting a bomb — the bet is dead and cannot cash out. */
  dead: boolean;
  /** A promo free bet: a win pays only what's above the stake. */
  free?: boolean;
}

export interface Toast {
  id: number;
  kind: 'error' | 'win' | 'info';
  text: string;
}

export interface GameState {
  conn: ConnStatus;
  me: ConnectedAsDto | null;
  balance: number;
  phase: Phase;
  roundId: string | null;
  /** performance.now() when the waiting countdown ends. */
  waitingEndsAt: number | null;
  /** performance.now() at which the multiplier was 1.00 — drives the local animation clock. */
  flyingAnchor: number | null;
  lastCrash: { multiplier: number; roundId: string } | null;
  bets: BetDto[];
  history: HistoryEntryDto[];
  myBets: (MyBet | null)[];
  /** The calling player's persisted bet history (past sessions included) — from GameHub.GetMyBets. */
  betHistory: PlayerBetHistoryEntryDto[];
  /** Most recent win amount — persists across rounds for the HUD "Win Amount" readout. */
  lastWin: number;
  limits: LimitsDto | null;
  fairness: { serverSeedHash: string; clientSeed: string; nonce: number; serverSeed?: string } | null;
  /** Snapshot of the previous round's revealed fairness data — `fairness` itself gets
   *  overwritten as soon as the next round starts, so this is the only place the last
   *  crash's revealed server seed survives long enough for the Provably Fair menu to show it. */
  lastRoundFairness: {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    crashMultiplier: number;
  } | null;
  toasts: Toast[];
}

const initialState: GameState = {
  conn: 'connecting',
  me: null,
  balance: 0,
  phase: 'waiting',
  roundId: null,
  waitingEndsAt: null,
  flyingAnchor: null,
  lastCrash: null,
  bets: [],
  history: [],
  myBets: [null, null],
  betHistory: [],
  lastWin: 0,
  limits: null,
  fairness: null,
  lastRoundFairness: null,
  toasts: [],
};

type Action =
  | { type: 'conn'; status: ConnStatus }
  | { type: 'connectedAs'; dto: ConnectedAsDto }
  | { type: 'roundState'; dto: RoundStateDto; at: number }
  | { type: 'roundStarted'; dto: RoundStartedDto; at: number }
  | { type: 'multiplier'; value: number; at: number }
  | { type: 'roundCrashed'; dto: RoundCrashedDto }
  | { type: 'betAdded'; dto: BetAddedDto }
  | { type: 'betPlaced'; dto: BetPlacedDto }
  | { type: 'betCashedOut'; dto: BetCashedOutDto }
  | { type: 'cashOutResult'; dto: CashOutResultDto }
  | { type: 'fishEaten'; slot: number; boost: number }
  | { type: 'playerDied'; slot: number }
  | { type: 'history'; entries: HistoryEntryDto[] }
  | { type: 'myBets'; entries: PlayerBetHistoryEntryDto[] }
  | { type: 'limits'; dto: LimitsDto }
  | { type: 'toast'; kind: Toast['kind']; text: string }
  | { type: 'dismissToast'; id: number }
  | { type: 'balance'; value: number };

let toastId = 0;

function pushToast(toasts: Toast[], kind: Toast['kind'], text: string): Toast[] {
  return [...toasts.slice(-4), { id: ++toastId, kind, text }];
}

function updateMyBet(
  myBets: (MyBet | null)[],
  slot: number,
  update: (bet: MyBet) => MyBet,
): (MyBet | null)[] {
  const next = [...myBets];
  const existing = next[slot];
  if (existing) next[slot] = update(existing);
  return next;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'conn':
      return { ...state, conn: action.status };

    case 'connectedAs':
      return { ...state, me: action.dto, balance: action.dto.balance };

    case 'roundState': {
      // Sent on (re)connect — resync everything from the server's snapshot.
      const phase = phaseFromWire(action.dto.phase);
      const flyingAnchor =
        phase === 'flying' && action.dto.elapsedFlyingMs != null
          ? action.at - action.dto.elapsedFlyingMs
          : null;
      const myBets: (MyBet | null)[] = [null, null];
      if (state.me) {
        for (const bet of action.dto.bets) {
          if (bet.playerId === state.me.playerId && bet.slotIndex >= 0 && bet.slotIndex <= 1) {
            myBets[bet.slotIndex] = {
              amount: bet.amount,
              autoCashOut: bet.autoCashOutAt,
              cashedOutAt: bet.cashedOutAt,
              winAmount: bet.winAmount,
              lost: false,
              boost: 0,
              dead: false,
            };
          }
        }
      }
      return {
        ...state,
        phase,
        roundId: action.dto.roundId,
        flyingAnchor,
        waitingEndsAt: phase === 'waiting' ? state.waitingEndsAt : null,
        bets: action.dto.bets,
        myBets,
        fairness: {
          serverSeedHash: action.dto.serverSeedHash,
          clientSeed: action.dto.clientSeed,
          nonce: action.dto.nonce,
        },
      };
    }

    case 'roundStarted':
      return {
        ...state,
        phase: 'waiting',
        roundId: action.dto.roundId,
        waitingEndsAt: action.at + action.dto.waitingSeconds * 1000,
        flyingAnchor: null,
        bets: [],
        myBets: [null, null],
        fairness: {
          serverSeedHash: action.dto.serverSeedHash,
          clientSeed: action.dto.clientSeed,
          nonce: action.dto.nonce,
        },
      };

    case 'multiplier': {
      // Authoritative tick: (re-)anchor the local animation clock.
      const impliedAnchor = action.at - multiplierToMs(action.value);
      if (state.phase !== 'flying' || state.flyingAnchor == null) {
        return { ...state, phase: 'flying', waitingEndsAt: null, flyingAnchor: impliedAnchor };
      }
      // Only correct on real drift so the animation stays silky.
      const local = msToMultiplier(action.at - state.flyingAnchor);
      if (Math.abs(local - action.value) > 0.03) {
        return { ...state, flyingAnchor: impliedAnchor };
      }
      return state;
    }

    case 'roundCrashed': {
      const myBets = state.myBets.map((bet) =>
        bet && bet.cashedOutAt == null ? { ...bet, lost: true } : bet,
      );
      return {
        ...state,
        phase: 'crashed',
        flyingAnchor: null,
        lastCrash: { multiplier: action.dto.crashMultiplier, roundId: action.dto.roundId },
        bets: action.dto.bets,
        history: action.dto.history,
        myBets,
        fairness: {
          serverSeedHash: action.dto.serverSeedHash,
          clientSeed: action.dto.clientSeed,
          nonce: action.dto.nonce,
          serverSeed: action.dto.serverSeed,
        },
        lastRoundFairness: {
          serverSeed: action.dto.serverSeed,
          serverSeedHash: action.dto.serverSeedHash,
          clientSeed: action.dto.clientSeed,
          nonce: action.dto.nonce,
          crashMultiplier: action.dto.crashMultiplier,
        },
      };
    }

    case 'betAdded': {
      if (state.bets.some((b) => b.betId === action.dto.betId)) return state;
      const bets = [
        ...state.bets,
        { ...action.dto, cashedOutAt: null, winAmount: null } as BetDto,
      ];
      let myBets = state.myBets;
      if (state.me && action.dto.playerId === state.me.playerId) {
        myBets = [...state.myBets];
        myBets[action.dto.slotIndex] = {
          amount: action.dto.amount,
          autoCashOut: action.dto.autoCashOutAt,
          cashedOutAt: null,
          winAmount: null,
          lost: false,
          boost: 0,
          dead: false,
        };
      }
      return { ...state, bets, myBets };
    }

    case 'betPlaced':
      return {
        ...state,
        balance: action.dto.balance,
        myBets: action.dto.freeBet
          ? updateMyBet(state.myBets, action.dto.slot, (bet) => ({ ...bet, free: true }))
          : state.myBets,
      };

    case 'betCashedOut': {
      const bets = state.bets.map((b) =>
        b.playerId === action.dto.playerId && b.slotIndex === action.dto.slotIndex
          ? { ...b, cashedOutAt: action.dto.cashedOutAt, winAmount: action.dto.winAmount }
          : b,
      );
      let myBets = state.myBets;
      let lastWin = state.lastWin;
      if (state.me && action.dto.playerId === state.me.playerId) {
        myBets = updateMyBet(state.myBets, action.dto.slotIndex, (bet) => ({
          ...bet,
          cashedOutAt: action.dto.cashedOutAt,
          winAmount: action.dto.winAmount,
        }));
        lastWin = action.dto.winAmount;
      }
      return { ...state, bets, myBets, lastWin };
    }

    case 'cashOutResult':
      return {
        ...state,
        balance: action.dto.balance,
        lastWin: action.dto.winAmount,
        myBets: updateMyBet(state.myBets, action.dto.slot, (bet) => ({
          ...bet,
          winAmount: action.dto.winAmount,
          cashedOutAt: bet.cashedOutAt ?? bet.autoCashOut ?? null,
        })),
        toasts: pushToast(state.toasts, 'win', `Cashed out: +${action.dto.winAmount.toFixed(2)}`),
      };

    case 'fishEaten':
      return {
        ...state,
        myBets: updateMyBet(state.myBets, action.slot, (bet) => ({ ...bet, boost: action.boost })),
      };

    case 'playerDied':
      return {
        ...state,
        myBets: updateMyBet(state.myBets, action.slot, (bet) => ({ ...bet, dead: true, lost: true })),
        toasts: pushToast(state.toasts, 'error', '☄️ Your ship hit an asteroid — bet lost.'),
      };

    case 'history':
      return { ...state, history: action.entries };

    case 'myBets':
      return { ...state, betHistory: action.entries };

    case 'limits':
      return { ...state, limits: action.dto };

    case 'toast':
      return { ...state, toasts: pushToast(state.toasts, action.kind, action.text) };

    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case 'balance':
      return { ...state, balance: action.value };

    default:
      return state;
  }
}

export interface GameActions {
  placeBet: (amount: number, slot: number, autoCashOut: number | null) => void;
  /** Bets one of the player's promo free bets (the server picks it; its value is the stake). */
  placeFreeBet: (slot: number, autoCashOut: number | null) => void;
  cashOut: (slot: number) => void;
  eatFish: (slot: number, fishId: number) => void;
  bombHit: (slot: number, bombId: number) => void;
  refreshMyBets: () => void;
  dismissToast: (id: number) => void;
  /** For promo awards: a toast, and the balance after a promo payout. */
  notify: (kind: Toast['kind'], text: string) => void;
  setBalance: (value: number) => void;
}

export function useGameState(): { state: GameState; actions: GameActions } {
  const [state, dispatch] = useReducer(reducer, initialState);
  const connRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    const conn = createGameConnection();
    connRef.current = conn;

    conn.on('ConnectedAs', (dto: ConnectedAsDto) => dispatch({ type: 'connectedAs', dto }));
    conn.on('RoundState', (dto: RoundStateDto) =>
      dispatch({ type: 'roundState', dto, at: performance.now() }),
    );
    conn.on('RoundStarted', (dto: RoundStartedDto) =>
      dispatch({ type: 'roundStarted', dto, at: performance.now() }),
    );
    conn.on('MultiplierUpdated', (value: number) =>
      dispatch({ type: 'multiplier', value, at: performance.now() }),
    );
    conn.on('RoundCrashed', (dto: RoundCrashedDto) => dispatch({ type: 'roundCrashed', dto }));
    conn.on('BetAdded', (dto: BetAddedDto) => dispatch({ type: 'betAdded', dto }));
    conn.on('BetPlaced', (dto: BetPlacedDto) => dispatch({ type: 'betPlaced', dto }));
    conn.on('BetError', (error: string) => dispatch({ type: 'toast', kind: 'error', text: error }));
    conn.on('BetCashedOut', (dto: BetCashedOutDto) => dispatch({ type: 'betCashedOut', dto }));
    conn.on('CashOutResult', (dto: CashOutResultDto) => dispatch({ type: 'cashOutResult', dto }));
    conn.on('CashOutError', (error: string) =>
      dispatch({ type: 'toast', kind: 'error', text: error }),
    );
    conn.on('History', (entries: HistoryEntryDto[]) => dispatch({ type: 'history', entries }));
    conn.on('MyBets', (entries: PlayerBetHistoryEntryDto[]) =>
      dispatch({ type: 'myBets', entries }),
    );
    conn.on('FishEaten', (dto: { slot: number; fishId: number; boost: number }) =>
      dispatch({ type: 'fishEaten', slot: dto.slot, boost: dto.boost }),
    );
    conn.on('PlayerDied', (dto: { slot: number }) =>
      dispatch({ type: 'playerDied', slot: dto.slot }),
    );

    // Set when this effect is torn down (unmount, or React StrictMode's dev
    // double-mount) — a connection we stopped on purpose must not report
    // "offline" over the one that replaced it.
    let disposed = false;

    conn.onreconnecting(() => dispatch({ type: 'conn', status: 'reconnecting' }));
    conn.onreconnected(() => dispatch({ type: 'conn', status: 'online' }));
    conn.onclose(() => {
      if (!disposed) dispatch({ type: 'conn', status: 'offline' });
    });

    conn
      .start()
      .then(() => {
        if (disposed) return;
        dispatch({ type: 'conn', status: 'online' });
        return Promise.all([conn.invoke('GetHistory'), conn.invoke('GetMyBets')]);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        dispatch({ type: 'conn', status: 'offline' });
        dispatch({ type: 'toast', kind: 'error', text: `Connection failed: ${String(err)}` });
      });

    getLimits()
      .then((dto: LimitsDto) => dispatch({ type: 'limits', dto }))
      .catch(() => {
        /* limits are cosmetic — defaults are fine */
      });

    return () => {
      disposed = true;
      conn.stop().catch(() => undefined);
    };
  }, []);

  const invoke = useCallback((method: string, ...args: unknown[]) => {
    const conn = connRef.current;
    if (!conn || conn.state !== 'Connected') {
      dispatch({ type: 'toast', kind: 'error', text: 'Not connected to game server' });
      return;
    }
    conn.invoke(method, ...args).catch((err: unknown) => {
      dispatch({ type: 'toast', kind: 'error', text: String(err) });
    });
  }, []);

  const actions: GameActions = {
    placeBet: useCallback(
      (amount, slot, autoCashOut) => invoke('PlaceBet', amount, slot, autoCashOut),
      [invoke],
    ),
    placeFreeBet: useCallback((slot, autoCashOut) => invoke('PlaceFreeBet', slot, autoCashOut), [invoke]),
    cashOut: useCallback((slot) => invoke('CashOut', slot), [invoke]),
    eatFish: useCallback((slot, fishId) => invoke('EatFish', slot, fishId), [invoke]),
    bombHit: useCallback((slot, bombId) => invoke('BombHit', slot, bombId), [invoke]),
    refreshMyBets: useCallback(() => invoke('GetMyBets'), [invoke]),
    dismissToast: useCallback((id) => dispatch({ type: 'dismissToast', id }), []),
    notify: useCallback((kind, text) => dispatch({ type: 'toast', kind, text }), []),
    setBalance: useCallback((value) => dispatch({ type: 'balance', value }), []),
  };

  return { state, actions };
}
