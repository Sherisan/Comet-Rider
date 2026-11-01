import { FUEL_CELLS } from '../../game/tiers';
import microUrl from '../../assets/space/fuel-micro.svg';
import powerUrl from '../../assets/space/fuel-power.svg';
import plasmaUrl from '../../assets/space/fuel-plasma.svg';
import quantumUrl from '../../assets/space/fuel-quantum.svg';

const CELLS = [microUrl, powerUrl, plasmaUrl, quantumUrl];

/** Fuel capsule — collecting it adds a multiplier boost. Tier 0–3 = Micro / Power / Plasma / Quantum. */
export function FuelCell({ tier, width = 40 }: { tier: number; width?: number }) {
  return (
    <img
      src={CELLS[tier] ?? CELLS[0]}
      width={width}
      className="fuel-cell"
      alt={FUEL_CELLS[tier]?.name ?? 'fuel cell'}
      draggable={false}
    />
  );
}
