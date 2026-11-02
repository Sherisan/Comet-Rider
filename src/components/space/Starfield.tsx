import { useEffect, useRef } from 'react';
import driftUrl from '../../assets/space/stars-drift.svg';
import cruiseUrl from '../../assets/space/stars-cruise.svg';
import warpUrl from '../../assets/space/stars-warp.svg';

/**
 * Tile layers: drift is always on; cruise and warp fade in as speed builds.
 * The streak layers are drawn at a larger tile `scale` (fewer streaks per
 * screen) and capped at `maxOpacity` so they read as speed, not rain.
 * Tile art is 224×160.
 */
const LAYERS = [
  { url: driftUrl, scale: 2, rate: 0.35, fadeFrom: -1, fadeTo: 0, maxOpacity: 1 },
  { url: cruiseUrl, scale: 3.5, rate: 1, fadeFrom: 220, fadeTo: 700, maxOpacity: 0.4 },
  { url: warpUrl, scale: 4.5, rate: 1.8, fadeFrom: 1100, fadeTo: 1600, maxOpacity: 0.3 },
];
const ART_W = 224;
const ART_H = 160;

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
        offsets[i] = (offsets[i] + current * layer.rate * dt) % (ART_H * layer.scale);
        el.style.backgroundPosition = `0 ${offsets[i].toFixed(1)}px`;
        const fade = layer.fadeFrom < 0 ? 1 : (current - layer.fadeFrom) / (layer.fadeTo - layer.fadeFrom);
        el.style.opacity = String(Math.max(0, Math.min(1, fade)) * layer.maxOpacity);
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
          style={{
            backgroundImage: `url("${layer.url}")`,
            backgroundSize: `${ART_W * layer.scale}px ${ART_H * layer.scale}px`,
          }}
        />
      ))}
    </div>
  );
}
