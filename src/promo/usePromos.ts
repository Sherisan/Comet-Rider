import { useCallback, useEffect, useRef, useState } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import { createPromoConnection, type PromoAward, type PromoEvent, type PromoState } from './promoApi';

/**
 * Live promotions for this game and the player's free bets, kept fresh from /promohub. Promotions are optional:
 * if the hub can't be reached the game plays on without them.
 */
export function usePromos(handlers: { onAward: (a: PromoAward) => void }) {
  const [promos, setPromos] = useState<PromoState | null>(null);
  const [announcement, setAnnouncement] = useState<PromoEvent | null>(null);
  const connRef = useRef<HubConnection | null>(null);
  const onAward = useRef(handlers.onAward);
  onAward.current = handlers.onAward;

  const refresh = useCallback(() => {
    const conn = connRef.current;
    if (!conn || conn.state !== 'Connected') return;
    conn
      .invoke<PromoState>('GetState')
      .then(setPromos)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const conn = createPromoConnection();
    connRef.current = conn;
    let disposed = false;

    conn.on('PromoChanged', refresh);
    conn.on('PromoAward', (a: PromoAward) => {
      onAward.current(a);
      refresh();
    });
    conn.on('PromoEvent', (e: PromoEvent) => {
      setAnnouncement(e);
      refresh(); // race places / leaderboard moved
    });
    conn.onreconnected(refresh);

    conn
      .start()
      .then(() => !disposed && refresh())
      .catch(() => undefined);

    // Leaderboard standings and race places change with other players' wins.
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      conn.stop().catch(() => undefined);
    };
  }, [refresh]);

  const dismissAnnouncement = useCallback(() => setAnnouncement(null), []);
  return { promos, announcement, dismissAnnouncement, refresh };
}
