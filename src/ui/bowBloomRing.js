// @ts-check
// BOW-BLOOM's ring: a circle round the screen's centre the size of the bow's bloom, drawn while it is open. Started
// by the first bloomed shot (bowShotAim), so no host wires it. A departure: DFU has no bloom.
import { bowBloomNow, bowBloomShot } from '../combat/bowBloom.js';
import { fieldOfView } from './viewSettings.js';

/** The ring's diameter in pixels for a bloom of `deg` on a view `height` tall at vertical field of view `fov` (radians). */
export const bloomRingPx = (deg, height, fov) => Math.round((2 * (height / 2) * Math.tan((deg * Math.PI) / 180)) / Math.tan(fov / 2));

let _ring = /** @type {HTMLElement | null} */ (null);

/** Draw the ring now: shown at the bloom's size, hidden once it closes. */
export function paintBowBloomRing(ring, deg, height, fov) {
  const px = deg > 0.05 ? bloomRingPx(deg, height, fov) : 0;
  ring.style.display = px >= 4 ? 'block' : 'none';
  if (px >= 4) Object.assign(ring.style, { width: `${px}px`, height: `${px}px` });
}

function startRing() {
  if (_ring || typeof document === 'undefined' || !document.body || typeof requestAnimationFrame === 'undefined') return;
  const ring = document.createElement('div');
  Object.assign(ring.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%',
    border: '2px solid rgba(240, 230, 210, 0.75)', boxShadow: '0 0 2px rgba(0, 0, 0, 0.8)', pointerEvents: 'none', zIndex: '30', display: 'none' });
  document.body.appendChild(ring);
  _ring = ring;
  const frame = () => { paintBowBloomRing(ring, bowBloomNow(), window.innerHeight, fieldOfView()); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}

/** A player's bow shot along `dir`: where it flies (combat/bowBloom.js), the ring started. */
export function bowShotAim(dir) {
  startRing();
  return bowBloomShot(dir);
}
