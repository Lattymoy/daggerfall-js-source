// @ts-check
// FISH-BOATS (2026-10-27; bible/03-World/Naval-Combat.md FISH-BOATS) - A PORT'S FISHING BOATS, STOOD: the naval host's
// half of systems/naval/fishingBoats.js (navalHost.js wires it). The player who rolls the port stands its day's boats
// where the day finds them; every other player meets them on the wire. Past HARBOUR_LEAVE they fade, stood again the
// same on return; one sunk or taken today is not.
//   h = { sea, harbours, launch(spec), retire(e), adopt(e), grid(hull), isWater(x, z, hull), where(), rolls(mouth),
//         feet(), seaStates, reach: { stand, leave } }
import { classById } from '../../systems/naval/navalShips.js';
import { fishersOf, fishingWaters, fishingErrand, fisherCatch, fisherPlace } from '../../systems/naval/fishingBoats.js';
import { mintMaterialItem } from '../../systems/professions/profItems.js';
import { addItem } from '../../systems/inventory.js';

/** @param {any} h */
export function createFishingFleet(h) {
  /** The harbours whose boats stand (by their sounding - one found again is rolled anew). */
  let rolled = new WeakSet();
  /** The seeds sunk or taken from each port today - key -> { day, seeds } (kept across the sea's clear). */
  const lostByPort = new Map();
  const lostOf = (key, day) => {
    let d = lostByPort.get(key);
    if (!d || d.day !== day) lostByPort.set(key, (d = { day, seeds: new Set() }));
    return d.seeds;
  };
  const afloat = (e) => e.ship.damage.state === h.seaStates.afloat;

  /** Her water and her errand where the day finds her, in harbour `hb` - or null where it keeps no room for her. */
  function placed(hb, f, lights) {
    const cls = classById(f.classId);
    if (!cls) return null;
    const waters = fishingWaters({
      harbour: hb.harbour,
      i: f.i,
      seed: f.seed,
      hull: cls.hull,
      isWater: h.isWater,
      grid: h.grid(cls.hull),
    });
    return waters ? fishingErrand({ key: hb.key, waters, lights }) : null;
  }

  /** The boats of the harbours near the player, each frame (navalHost.js harbourFrame's shape and reach). */
  function frame(seaY) {
    const feet = h.feet(),
      w = h.where(),
      day = w.day ?? 0,
      lights = !!w.cityLights;
    for (const e of h.sea.values()) if (e.fisher && !e.owner && !afloat(e)) lostOf(e.fisher, day).add(e.ship.seed); // sunk or struck: not stood again today
    for (const hb of h.harbours.values()) {
      if (!hb.harbour) continue;
      const d = Math.hypot(hb.harbour.mouth[0] - feet[0], hb.harbour.mouth[1] - feet[2]);
      if (d > h.reach.leave) {
        if (rolled.has(hb.harbour))
          for (const e of [...h.sea.values()]) if (!e.owner && e.fisher === hb.key && afloat(e)) h.retire(e); // SHIP-FADE
        rolled.delete(hb.harbour);
        continue;
      }
      if (d > h.reach.stand || !h.rolls(hb.harbour.mouth)) continue;
      const fleet = fishersOf(hb.key, day);
      if (rolled.has(hb.harbour)) {
        // AUDIT BAY A20's law: the port's own a player sailing off lets go of - taken over where they lie by the one who
        // rolls the port now
        const own = new Set(fleet.map((f) => f.seed));
        for (const e of [...h.sea.values()])
          if (e.owner && e.retiring && own.has(e.ship.seed) && afloat(e)) {
            h.adopt(e);
            e.retiring = false;
          }
        continue;
      }
      rolled.add(hb.harbour);
      const lost = lostOf(hb.key, day);
      for (const f of fleet) {
        const back = [...h.sea.values()].find(
          (x) => !x.owner && x.retiring && x.ship.seed === f.seed && x.fisher === hb.key,
        );
        if (back) {
          back.retiring = false;
          continue;
        } // SHIP-FADE: still fading, she stays
        if (
          lost.has(f.seed) ||
          [...h.sea.values()].some((x) => x.ship.seed === f.seed && x.ship.damage.state !== h.seaStates.sunk)
        )
          continue; // anyone's copy of her already
        const at = placed(hb, f, lights);
        if (!at) continue;
        const e = h.launch({
          seed: f.seed,
          classId: f.classId,
          variant: 0,
          pos: [at.pos[0], seaY, at.pos[1]],
          yaw: at.yaw,
          errand: at.errand,
          phase: (f.seed % 628) / 100,
        }); // her bob off her seed: no draw on the sea's own stream
        if (!e) continue;
        e.fisher = hb.key;
        if (lights) {
          e.ship.sails = 0;
          e.ship.sailsWant = 0;
        } // at anchor, her canvas stowed
      }
    }
  }

  /** Her errand drawn again where she lies - a boat of the fleet taken over from another player (her errand never rides
   *  the word): her harbour and slot found off her seed, today's or yesterday's, her day's errand from where she is. */
  function errandOf(ship) {
    const day = h.where().day ?? 0,
      lights = !!h.where().cityLights;
    const hs = [...h.harbours.values()].filter((x) => x.harbour);
    const place = fisherPlace(ship.seed, hs, [day, day - 1]);
    const hb = place ? hs.find((x) => x.key === place.key) : null;
    const at = hb ? placed(hb, { i: place.i, seed: ship.seed, classId: ship.cls.id }, lights) : null;
    if (!at) return null;
    if (!lights) return { ...at.errand, kind: 'fish' }; // working: to her ground from wherever she lies
    return {
      ...at.errand,
      kind: Math.hypot(ship.pos[0] - at.errand.to[0], ship.pos[2] - at.errand.to[1]) <= 20 ? 'anchor' : 'home',
    };
  }

  /** Her catch, minted: the fish in her hold (fishingBoats.js fisherCatch), stacked as a pack stacks them. */
  function catchOf(cls, seed) {
    const out = [];
    const { count } = fisherCatch(cls.id, seed);
    for (let i = 0; i < count; i++) {
      const it = mintMaterialItem('food:fish');
      if (it) addItem(out, it);
    }
    return out;
  }

  /** The sea cleared: every harbour rolled anew where it is found next. */
  function clear() {
    rolled = new WeakSet();
  }

  return { frame, errandOf, catchOf, clear };
}
