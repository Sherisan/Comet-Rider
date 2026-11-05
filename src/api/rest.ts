import { API_BASE } from './base';
import type { HistoryEntryDto, LimitsDto } from './types';

export async function getLimits(): Promise<LimitsDto> {
  const res = await fetch(`${API_BASE}/api/game/limits?gameId=comet-rider`);
  if (!res.ok) throw new Error(`limits failed: ${res.status}`);
  return res.json();
}

export async function getHistory(count = 20): Promise<HistoryEntryDto[]> {
  const res = await fetch(`${API_BASE}/api/game/history?count=${count}`);
  if (!res.ok) throw new Error(`history failed: ${res.status}`);
  return res.json();
}

export interface EvolutionTierDto {
  level: number;
  code: string;
  name: string;
  multiplier: number;
}

/** Evolution multipliers set in the Game Back Office. */
export async function getEvolution(gameId: string): Promise<EvolutionTierDto[]> {
  const res = await fetch(`${API_BASE}/api/games/${encodeURIComponent(gameId)}/evolution`);
  if (!res.ok) throw new Error(`evolution failed: ${res.status}`);
  return res.json();
}
