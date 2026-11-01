import { useEffect, useRef } from 'react';
import driftUrl from '../../assets/space/stars-drift.svg';
import cruiseUrl from '../../assets/space/stars-cruise.svg';
import warpUrl from '../../assets/space/stars-warp.svg';

/** Tile layers: drift is always on; cruise and warp fade in as speed builds. */
const LAYERS = [
  { url: driftUrl, rate: 0.35, fadeFrom: -1, fadeTo: 0 },
  { url: cruiseUrl, rate: 1, fadeFrom: 120, fadeTo: 360 },
  { url: warpUrl, rate: 1.8, fadeFrom: 520, fadeTo: 900 },
];
/** Tile size (art is 224×160) — drawn at 2× so the stars aren't tiny on big screens. */
const TILE_W = 448;
const TILE_H = 320;

/**
 * Vertical scrolling starfield built from the drift / cruise / warp tiles.
 * `speed()` (px/s) is read every frame, so the stars rush past faster — and the
 * cruise and warp streak layers fade in — as the multiplier climbs.
 */
export function Starfield({ speed }: { speed: () => number }) {
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const offsets = LAYERS.map(() => 0);
    let raf = 0;
    let last = performance.now();
    let current = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Ease toward the target speed so launches and crashes don't jump.
      current += (speedRef.current() - current) * Math.min(1, dt * 3);
      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i];
        if (!el) return;
        offsets[i] = (offsets[i] + current * layer.rate * dt) % TILE_H;
        el.style.backgroundPosition = `0 ${offsets[i].toFixed(1)}px`;
        const fade = layer.fadeFrom < 0 ? 1 : (current - layer.fadeFrom) / (layer.fadeTo - layer.fadeFrom);
        el.style.opacity = String(Math.max(0, Math.min(1, fade)));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="starfield" aria-hidden>
      {LAYERS.map((layer, i) => (
        <div
          key={layer.url}
          ref={(el) => (layerRefs.current[i] = el)}
          className="starfield-layer"
          style={{ backgroundImage: `url("${layer.url}")`, backgroundSize: `${TILE_W}px ${TILE_H}px` }}
        />
      ))}
    </div>
  );
}
