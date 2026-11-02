import { useEffect, useState } from 'react';
import type { GameState } from '../game/useGameState';
import { Ship } from './space/Ship';
import planetUrl from '../assets/space/bg-planet.svg';
import moonUrl from '../assets/space/bg-moon.svg';
import nebulaUrl from '../assets/space/bg-nebula.svg';

/** Shortest time the splash stays up, so it never just flickers. */
const MIN_SHOW_MS = 1600;
/** Give up waiting on the server after this long — the game shows its own offline state. */
const MAX_WAIT_MS = 10000;
const FADE_MS = 600;

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
}

const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  top: `${(i * 29 + (i % 7) * 11) % 100}%`,
  size: 1 + (i % 3),
  delay: `${(i * 0.37) % 3}s`,
}));

/**
 * Full-screen loading splash. Takes over from the static boot splash in
 * index.html once the bundle has run, and stays up until the backdrop art and
 * fonts are loaded and the game server connection has settled (online, or
 * given up) — then fades out over the live game.
 */
export function SplashScreen({ state }: { state: Pick<GameState, 'conn' | 'roundId'> }) {
  const [assetsDone, setAssetsDone] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    document.getElementById('boot-splash')?.remove();

    const tasks = [
      preloadImage(nebulaUrl),
      preloadImage(planetUrl),
      preloadImage(moonUrl),
      document.fonts.ready,
    ];
    let alive = true;
    tasks.forEach((t) => t.then(() => alive && setAssetsDone((n) => n + 1)));

    const min = setTimeout(() => setMinElapsed(true), MIN_SHOW_MS);
    const max = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => {
      alive = false;
      clearTimeout(min);
      clearTimeout(max);
    };
  }, []);

  const assetsReady = assetsDone >= 4;
  const connected = state.conn === 'online' && state.roundId != null;
  const connSettled = connected || state.conn === 'offline' || timedOut;
  const ready = assetsReady && connSettled && minElapsed;

  useEffect(() => {
    if (!ready) return;
    setFading(true);
    const t = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [ready]);

  if (gone) return null;

  // 15% for the bundle having loaded at all, assets 11.25% each, server the rest.
  const progress = 15 + assetsDone * 11.25 + (connSettled ? 40 : 0);
  const status = !assetsReady
    ? 'Charging engines…'
    : !connSettled
      ? 'Contacting mission control…'
      : 'Ready for launch!';

  return (
    <div className={`splash ${fading ? 'splash-out' : ''}`} role="status" aria-live="polite">
      <div className="splash-stars" aria-hidden>
        {STARS.map((s, i) => (
          <span
            key={i}
            style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
          />
        ))}
      </div>

      <div className="splash-center">
        <div className="splash-ship">
          <Ship shipClass="fighter" width={120} thrust={0.8} />
        </div>
        <h1 className="splash-title">
          <span>COMET</span>
          <span className="splash-title-accent">RIDER</span>
        </h1>
        <div className="splash-bar">
          <div className="splash-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="splash-status">{status}</p>
      </div>
    </div>
  );
}
