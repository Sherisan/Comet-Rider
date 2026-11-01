import planetUrl from '../../assets/space/bg-planet.svg';
import moonUrl from '../../assets/space/bg-moon.svg';
import nebulaUrl from '../../assets/space/bg-nebula.svg';

/** Static deep-space scenery behind the starfield: nebula, a ringed planet and a moon. */
export function Backdrop({ scale }: { scale: number }) {
  return (
    <div className="backdrop" aria-hidden>
      <div className="nebula-glow" />
      <img className="bg-nebula" src={nebulaUrl} width={900 * scale} alt="" draggable={false} />
      <img className="bg-planet" src={planetUrl} width={520 * scale} alt="" draggable={false} />
      <img className="bg-moon" src={moonUrl} width={300 * scale} alt="" draggable={false} />
    </div>
  );
}
