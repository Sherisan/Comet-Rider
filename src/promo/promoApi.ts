import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { API_BASE } from '../api/base';
import { getToken } from '../api/auth';

// Promotions from the API's /promohub (see FeedingFranzeeAPI Presentation/Hubs/PromoHub.cs).

export type PromoType =
  | 'FreeBet' | 'Rain' | 'RoundDrop' | 'MultiplierLeaderboard' | 'MultiplierRace' | 'CommunityJackpot' | 'Cashback'
  // Card, roulette and blackjack promotions — not shown in crash games, but the hub may name them.
  | 'MysteryPrize' | 'BuyXGetFree' | 'CollectionMission' | 'StreakMission' | 'LuckyNumber' | 'BoostedPayout' | 'HandBonus' | 'HandJackpot';

export interface LeaderboardDetails {
  period: 'Once' | 'Daily' | 'Weekly';
  metric?: 'BestMultiple' | 'BestWin' | 'TotalWagered' | 'TotalWon' | 'RoundsPlayed' | 'Hits';
  periodKey: string;
  periodEndsAt: string | null;
  prizes: number[];
  top: { rank: number; player: string; score: number; gameId: string }[];
  me: { rank: number; score: number } | null;
}

export interface PublicPromo {
  promotionId: number;
  name: string;
  type: PromoType;
  terms: string;
  minStake: number;
  endsAt: string | null;
  // Shape depends on type — see describePromo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
}

export interface FreeBet {
  awardId: string;
  amount: number;
  expiresAt: string | null;
  promotion: string | null;
}

export interface PromoState {
  serverTime: string;
  promotions: PublicPromo[];
  freeBets: FreeBet[];
}

/** To the winner only. */
export interface PromoAward {
  awardId: string;
  promotionId: number;
  promotion: string;
  type: PromoType;
  kind: 'Cash' | 'FreeBet';
  amount: number;
  reason: string;
  status: string;
  expiresAt: string | null;
  balance: number | null;
}

/** To everyone in the game (rain fell, jackpot hit, race place taken, …). */
export interface PromoEvent {
  promotionId: number;
  name: string;
  type: PromoType;
  message: string;
  amount: number;
  winners: string[];
  at: string;
}

export function createPromoConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${API_BASE}/promohub`, { accessTokenFactory: getToken })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();
}
