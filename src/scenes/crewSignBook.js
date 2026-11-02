// @ts-check
// CREW-SIGNED (2026-10-27; bible/03-World/Shipyards.md CREW-SIGNED) - A CREW HALL'S RECRUIT SIGNED ONCE ONLINE, the
// client's half: a hire asks the account service first (server-account/src/crewSigns.js), and the first character to
// sign a recruit holds him for his day - every ask names it (`character`, AUDIT HORIZONTAL C8). Built by
// scenes/shipyardHost.js.
//   taken(town, day) - the slots others hold, as last read, and the read in flight (`wait`);
//   sign(id) - `{ ok, fresh }`, or `{ ok: false, text }`; a service with no hall (`not-found`) is not asked again;
//   release(id) - a recruit this account holds let go. Offline, nothing is asked.
import { accountCrewSigns } from '../net/accountClient.js';
import { crewSignOf } from '../net/crewSignLaw.js';
import { appStorage } from '../systems/appStorage.js';
import { CREW_HALL_TEXT, CREW_SIGN_TEXT } from '../systems/crewHall.js';

/** A hall read is asked again when it is this old (ms). */
export const CREW_HALL_FRESH_MS = 20_000;
/** The halls kept read at once. */
export const CREW_HALLS_KEPT = 8;
const NONE = Object.freeze(new Set());

/** @param {{ live?: () => boolean, character?: () => string | null, door?: any, now?: () => number }} [deps] */
export function createCrewSignBook(deps = {}) {
  const now = () => Number(deps.now?.()) || Date.now();
  let door = deps.door ?? null,
    off = false;
  const doorNow = () => (door ??= accountCrewSigns({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }));
  /** @type {Map<string, { slots: Set<number>, at: number, wait: Promise<void>|null }>} */
  const halls = new Map();
  const live = () => !off && !!deps.live?.();
  const character = () => deps.character?.() ?? null;

  function taken(town, day) {
    if (!live()) return { slots: NONE, wait: null };
    const key = `${town >>> 0}:${day}`;
    let h = halls.get(key);
    if (!h) {
      if (halls.size >= CREW_HALLS_KEPT) halls.delete(halls.keys().next().value);
      h = { slots: new Set(), at: -Infinity, wait: null };
      halls.set(key, h);
    }
    if (!h.wait && now() - h.at >= CREW_HALL_FRESH_MS) {
      const hall = h;
      hall.wait = doorNow()
        .hall({ town: town >>> 0, day, character: character() })
        .catch(() => null)
        .then((r) => {
          if (r?.ok) hall.slots = new Set((r.data?.taken ?? []).filter((s) => Number.isInteger(s)));
          else if (r?.error === 'not-found') off = true;
          hall.at = now(); // a refused read waits as a good one does
          hall.wait = null;
        });
    }
    return { slots: h.slots, wait: h.wait };
  }

  async function sign(id) {
    if (!live()) return { ok: true, fresh: false };
    const r = await doorNow()
      .sign({ id, character: character() })
      .catch(() => null);
    if (r?.ok) return { ok: true, fresh: !!r.data?.fresh };
    if (r?.error === 'not-found') {
      off = true;
      return { ok: true, fresh: false };
    }
    if (r?.error === 'crew-taken') {
      const s = crewSignOf(id);
      if (s) halls.get(`${s.town}:${s.day}`)?.slots.add(s.slot);
      return { ok: false, text: CREW_HALL_TEXT.gone };
    }
    if (r?.error === 'crew-day') return { ok: false, text: CREW_HALL_TEXT.newDay };
    return { ok: false, text: r?.error === 'crew-many' ? CREW_SIGN_TEXT.many : CREW_SIGN_TEXT.unread };
  }

  /** Let `id` go - answers whether the service held it for this account. */
  function release(id) {
    if (!live() || !crewSignOf(id)) return Promise.resolve(false);
    return Promise.resolve(doorNow().release({ id, character: character() })).then(
      (r) => !!r?.ok && !!r.data?.released,
      () => false,
    );
  }

  return { live, taken, sign, release };
}
