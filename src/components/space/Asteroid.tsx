import carbonUrl from '../../assets/space/asteroid-carbon.svg';
import ironUrl from '../../assets/space/asteroid-iron.svg';
import fracturedUrl from '../../assets/space/asteroid-fractured.svg';

const ROCKS = [carbonUrl, ironUrl, fracturedUrl];

/** Asteroid — touching one destroys the ship. `seed` picks the rock type and spin speed. */
export function Asteroid({ width = 56, seed = 1, spin = true }: { width?: number; seed?: number; spin?: boolean }) {
  const spinS = 6 + ((seed * 7) % 11);
  return (
    <img
      src={ROCKS[Math.abs(seed) % ROCKS.length]}
      width={width}
      className={`asteroid ${spin ? 'spin' : ''}`}
      style={{ animationDuration: `${spinS}s`, animationDirection: seed % 2 ? 'reverse' : 'normal' }}
      alt="asteroid"
      draggable={false}
    />
  );
}
