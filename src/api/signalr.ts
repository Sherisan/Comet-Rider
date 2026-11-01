import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { API_BASE } from './base';
import { getToken } from './auth';

export function createGameConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${API_BASE}/gamehub`, { accessTokenFactory: getToken })
    .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build();
}
