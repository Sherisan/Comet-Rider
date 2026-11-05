// Mirrors Worldiator.Server DTOs. SignalR + MVC both serialize camelCase;
// enums arrive as numbers (GamePhase: 0=Waiting, 1=Flying, 2=Crashed).

export type Phase = 'waiting' | 'flying' | 'crashed';

export function phaseFromWire(p: number | string): Phase {
  if (typeof p === 'string') return p.toLowerCase() as Phase;
  return p === 1 ? 'flying' : p === 2 ? 'crashed' : 'waiting';
}

export interface BetDto {
  betId: string;
  roundId: string;
  playerId: string;
  username: string;
  slotIndex: number;
  amount: number;
  currency: string;
  placedAt: string;
  autoCashOutAt: number | null;
  cashedOutAt: number | null;
  winAmount: number | null;
}

export interface BetAddedDto {
  betId: string;
  roundId: string;
  playerId: string;
  username: string;
  slotIndex: number;
  amount: number;
  currency: string;
  placedAt: string;
  autoCashOutAt: number | null;
}

export interface BetCashedOutDto {
  playerId: string;
  slotIndex: number;
  cashedOutAt: number;
  winAmount: number;
}

export interface HistoryEntryDto {
  roundId: string;
  crashMultiplier: number;
  crashedAt: string | null;
}

export interface RoundStateDto {
  roundId: string;
  phase: number | string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  bets: BetDto[];
  elapsedFlyingMs: number | null;
}

export interface RoundStartedDto {
  roundId: string;
  phase: number | string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  waitingSeconds: number;
}

export interface RoundCrashedDto {
  roundId: string;
  crashMultiplier: number;
  crashedAt: string | null;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  bets: BetDto[];
  history: HistoryEntryDto[];
}

export interface ConnectedAsDto {
  playerId: string;
  username: string;
  currency: string;
  balance: number;
}

export interface BetPlacedDto {
  slot: number;
  amount: number;
  balance: number;
  success: boolean;
  /** Placed with a promo free bet. */
  freeBet?: boolean;
}

export interface CashOutResultDto {
  slot: number;
  winAmount: number;
  balance: number;
  roundId: string;
  success: boolean;
}

export interface ChatMessageDto {
  playerId: string;
  username: string;
  text: string;
  sentAt: string;
}

export interface LimitsDto {
  minBet: number;
  maxBet: number;
  maxWin: number;
}

/** A single persisted bet from the player's own history — from GameHub.GetMyBets ("MyBets" event). */
export interface PlayerBetHistoryEntryDto {
  roundId: string;
  slotIndex: number;
  amount: number;
  currency: string;
  cashedOutAt: number | null;
  winAmount: number | null;
  placedAt: string;
}
