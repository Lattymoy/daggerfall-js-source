// Party travel must commit a supported landing, never an ocean terrain fallback.
import { BESIDE_OFFSETS, BESIDE_LEVEL, BESIDE_REACH } from './partyTravelLaw.js';
import { CAPSULE_HEIGHT } from '../../player/motor.js';

export const PARTY_ARRIVAL_WAIT_MS = 4000;
export const PARTY_ARRIVAL_POLL_MS = 100;
export const PARTY_ARRIVAL_TEXT = Object.freeze({
  waiting: 'Waiting for a safe party landing...',
  returned: 'No safe landing found. You were sent back and not charged.',
});
export class PartyArrivalUnavailable extends Error {
  constructor() { super('No supported party arrival'); this.name = 'PartyArrivalUnavailable'; }
}

/** Probe a COPY with the actual player capsule. A ray alone can miss a deck
 * seam or reject a supported stair position. Never accept an unresolved body,
 * a ceiling hit, a shove sideways, or an unrelated level below the leader. */
export function supportedPartyPosition(collider, at, minimumY = -Infinity) {
  if (!at?.every(Number.isFinite)) return null;
  const pos = new Float32Array(at);
  const hit = collider.move(pos, 0, -BESIDE_LEVEL, 0, CAPSULE_HEIGHT, true);
  if (!hit.grounded || hit.hitCeiling || Math.hypot(pos[0] - at[0], pos[2] - at[2]) > 0.15
      || Math.abs(pos[1] - at[1]) > BESIDE_LEVEL || pos[1] < minimumY) return null;
  return { pos: [...pos], groundKey: hit.groundKey ?? null };
}

export function partyArrivalBeside(at, collider, seat = 0, minimumY = -Infinity) {
  if (!at?.every(Number.isFinite)) return null;
  const start = Number.isInteger(seat) && seat > 0 ? seat % BESIDE_OFFSETS.length : 0;
  for (const scale of [1, 0.5, 2]) for (let i = 0; i < BESIDE_OFFSETS.length; i++) {
    const [ox, oz] = BESIDE_OFFSETS[(start + i) % BESIDE_OFFSETS.length];
    const dx = ox * scale, dz = oz * scale;
    const distance = Math.hypot(dx, dz);
    const blocked = collider.raycast([at[0], at[1] + 1, at[2]], [dx / distance, 0, dz / distance], distance + BESIDE_REACH);
    if (Number.isFinite(blocked) && blocked < distance + BESIDE_REACH) continue;
    const fit = supportedPartyPosition(collider, [at[0] + dx, at[1], at[2] + dz], minimumY);
    if (fit) return { ...fit, yaw: Math.atan2(-dx, -dz) };
  }
  const own = supportedPartyPosition(collider, at, minimumY);
  return own ? { ...own, yaw: null } : null;
}

/** Bounded retries, including when a background tab's clock stalls. The caller
 * samples the leader AND hull on every attempt. Nothing is placed by a retry. */
export async function waitForPartyArrival(probe, {
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => performance.now(), onWait = () => {},
} = {}) {
  const start = now(), attempts = Math.ceil(PARTY_ARRIVAL_WAIT_MS / PARTY_ARRIVAL_POLL_MS);
  for (let i = 0; i <= attempts; i++) {
    const landing = probe();
    if (landing) return landing;
    if (i === attempts || now() - start >= PARTY_ARRIVAL_WAIT_MS) break;
    if (i === 0) onWait();
    await wait(PARTY_ARRIVAL_POLL_MS);
  }
  throw new PartyArrivalUnavailable();
}
