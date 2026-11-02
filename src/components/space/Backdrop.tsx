import { useEffect, useRef } from 'react';
import planetUrl from '../../assets/space/bg-planet.svg';
import moonUrl from '../../assets/space/bg-moon.svg';
import nebulaUrl from '../../assets/space/bg-nebula.svg';

/**
 * Parallax scenery. Each piece slides down at a fraction (`rate`) of the
 * starfield speed — far things slowest — and wraps back in above the top once
 * it has left the bottom. `startY` is where it sits on first paint, as a
 * fraction of the arena height.
 */
const SCENERY = [
  { url: nebulaUrl, className: 'bg-nebula', width: 900, rate: 0.03, startY: 0.14 },
  { url: planetUrl, className: 'bg-planet', width: 520, rate: 0.06, startY: 0.5 },
  { url: moonUrl, className: 'bg-moon', width: 300, rate: 0.1, startY: 0.44 },
];

/** Deep-space scenery behind the starfield: nebula, a ringed planet and a moon, drifting past. */
export function Backdrop({ scale, speed }: { scale: number; speed: () => number }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    // Distance travelled by each piece since mount, in px.
    const travelled = SCENERY.map(() => 0);
    let raf = 0;
    let last = performance.now();
    let current = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      current += (speedRef.current() - current) * Math.min(1, dt * 3);
      const arenaH = rootRef.current?.clientHeight ?? 0;
      SCENERY.forEach((item, i) => {
        const el = imgRefs.current[i];
        if (!el || arenaH === 0) return;
        travelled[i] += current * item.rate * dt;
        const h = el.offsetHeight;
        // Cycle through [-h, arenaH): fully above the top → fully below the bottom.
        const span = arenaH + h;
        const y = ((((item.startY * arenaH + h + travelled[i]) % span) + span) % span) - h;
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="backdrop" aria-hidden>
      <div className="nebula-glow" />
      {SCENERY.map((item, i) => (
        <img
          key={item.className}
          ref={(el) => (imgRefs.current[i] = el)}
          className={item.className}
          src={item.url}
          width={item.width * scale}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}
