import type { CSSProperties } from 'react';
import type { ShipClass } from '../../game/tiers';
import scoutUrl from '../../assets/space/ship-scout.svg';
import fighterUrl from '../../assets/space/ship-fighter.svg';
import cruiserUrl from '../../assets/space/ship-cruiser.svg';
import destroyerUrl from '../../assets/space/ship-destroyer.svg';
import mothershipUrl from '../../assets/space/ship-mothership.svg';

const SHIPS: Record<ShipClass, string> = {
  probe: scoutUrl,
  scout: scoutUrl,
  fighter: fighterUrl,
  cruiser: cruiserUrl,
  destroyer: destroyerUrl,
  mothership: mothershipUrl,
};

/** Art is 230×244, nose up, engine flame at the bottom. */
const ASPECT = 244 / 230;

/**
 * The player's ship (nose up). `thrust` (0..1) grows the engine glow under
 * the art's own flame — it builds as the multiplier climbs.
 */
export function Ship({
  shipClass,
  width = 130,
  thrust = 0.4,
  className = '',
  style,
}: {
  shipClass: ShipClass;
  width?: number;
  thrust?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`ship ${className}`}
      style={{ width, height: width * ASPECT, '--thrust': thrust, ...style } as CSSProperties}
    >
      {thrust > 0 && <span className="ship-thrust" aria-hidden />}
      <img src={SHIPS[shipClass]} alt={shipClass} draggable={false} />
    </div>
  );
}
