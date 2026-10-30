// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 5, DLV4): THE PIECES A PARTY STRIKES, GUARDS AND CARRIES. A Wellsprings'
// sources and the seals are bodies the context's crystal seam meets (a swing, an arrow, a spell - scenes/dungeonContext.js
// gateCrystalBodies): the game's own law strikes a stand-in (world/gate/gateBoss.js crystalStandIn) and the number goes to
// the ledger, whose caps decide what lands. The Vigil's relic is quarry its own foes hunt first (characters/enemy/
// enemyTargets.js huntsStar). A carried piece slows its carrier (player/motor.js registerFootSpeedMod), puts the weapon
// up (player/carryStep.js), and falls to a blow. Not a DFU member (Ledger A: DELVE II).
import { crystalStandIn } from '../../world/gate/gateBoss.js';
import { registerFootSpeedMod } from '../../player/motor.js';
import { registerPlayerHurtListener } from '../../characters/playerEntity.js';
import { carryStep } from '../../player/carryStep.js';
import {
  DP,
  SPRING_R,
  SPRING_H,
  SEAL_R,
  SEAL_H,
  VIGIL_RELIC_H,
  DELVE_BURDEN,
  breakSpots,
} from '../../net/delve/delveLaw.js';
import { DELVE_PIECE_TEXT } from '../../systems/delve/delveWords.js';

/** A piece's number on the crystal seam: past every court's crystals, sixteen a site. Pure. */
export const DELVE_CRYSTAL_C0 = 1000;
export const delveCrystalC = (i, j) => DELVE_CRYSTAL_C0 + i * 16 + j;
/** The site and piece a seam number names, or null for none of a delve's. Pure. */
export function delveCrystalOf(c) {
  if (!Number.isInteger(c) || c < DELVE_CRYSTAL_C0 || c >= DELVE_CRYSTAL_C0 + 16 * 16) return null;
  return { i: Math.floor((c - DELVE_CRYSTAL_C0) / 16), j: (c - DELVE_CRYSTAL_C0) % 16 };
}
/** Whether a seam number is a delve piece's. Pure. */
export const isDelveCrystal = (c) => delveCrystalOf(c) != null;
/** The crystals a blow can meet in a dungeon: the court's (a Reckoning's) and the encounters' pieces, numbered apart. Both,
 *  never the first that answers: outside a Reckoning the court answers an empty list, not none. Pure. */
export function dungeonCrystals(court, pieces) {
  const a = Array.isArray(court) ? court : [],
    b = Array.isArray(pieces) ? pieces : [];
  return !a.length ? b : !b.length ? a : [...a, ...b];
}
/** The mark a Vigil's foes carry, and its relic's: the Starfall's quarry rule reads the two equal (huntsStar). */
export const delveHuntSite = (i) => `delve:${i}`;
/** The stand-in's look: the Court's crystals' own (scenes/eliteGates/egFight.js drawStruck). */
const STAND_LOOK = Object.freeze({ mobile: 31, scale: 1 });

/** The pieces a blow can break at a site now, as the crystal seam reads them (`{ c, feet, height, radius, entity, delve }`),
 *  pushed into `out`: a Wellsprings' sources while they pour, the seals while they stand; `standIn(c, kind)` the
 *  piece's stand-in. Pure but for `out` and the stand-ins. @param {any} site @param {any} view */
export function breakTargets(site, view, standIn, out = []) {
  if (
    !view ||
    !((site.kind === 'wellsprings' && view.p === DP.spring) || (site.kind === 'seals' && view.p === DP.work))
  )
    return out;
  const seal = site.kind === 'seals';
  breakSpots(site, view).forEach((p, j) => {
    if (view.hp?.[j] > 0)
      out.push({
        c: delveCrystalC(site.i, j),
        feet: p,
        height: seal ? SEAL_H : SPRING_H,
        radius: seal ? SEAL_R : SPRING_R,
        entity: standIn(delveCrystalC(site.i, j), site.kind),
        delve: true,
      });
  });
  return out;
}
/** Each piece's stand-in, made once: a crystal's (unarmoured, nothing dodges), named for the piece. */
export function createStandIns() {
  const made = new Map();
  return (c, kind) => {
    let e = made.get(c);
    if (!e) {
      e = crystalStandIn(STAND_LOOK, c);
      e.name = kind === 'seals' ? DELVE_PIECE_TEXT.seal() : DELVE_PIECE_TEXT.source();
      made.set(c, e);
    }
    return e;
  };
}

/** THE VIGIL'S RELIC as a body its own foes hunt before the party - the Starfall's star's shape (scenes/starfall/
 *  starfallHost.js makeWard): `onBlow()` each foe's blow that lands on it. @param {any} site */
export function makeRelic(site, onBlow) {
  return {
    starWard: true,
    site: delveHuntSite(site.i),
    living: true,
    ai: {
      feet: [site.x, site.y, site.z],
      height: VIGIL_RELIC_H,
      centreOffset: VIGIL_RELIC_H / 2,
      radius: 0.6,
      target: null,
      isHostile: false,
      wouldBeSpawned: true,
      yaw: 0,
    },
    entity: { team: 'Civilian', mobileTeam: 'Civilian', health: 1000, maxHealth: 1000 },
    hurtFromFoe() {
      onBlow();
      return 1;
    },
  };
}

/**
 * THE PIECE I CARRY: its burden on my step, my weapon put up while I carry it (readied again, it is let go - the Ketch's
 * law, one for every carry), and a blow on me letting it fall. `set(on, drop)`: `drop(why)` ('hurt' or 'let') answers
 * whether the piece went. `weapon()` the player's weapon, `player()` the entity, `say(key)` the carry's line.
 */
let carries = 0;
export function createDelveCarry({
  player = () => null,
  weapon = () => null,
  say = (/** @type {string} */ _k) => {},
} = {}) {
  let carrying = false,
    forced = false,
    letGoAt = -Infinity,
    drop = /** @type {((why: string) => boolean)|null} */ (null);
  const name = `delve-carry:${++carries}`; // its own: one dungeon's teardown never takes the next one's
  registerFootSpeedMod(name, () => (carrying ? DELVE_BURDEN : 1));
  registerPlayerHurtListener(name, (e, hurt) => {
    if (carrying && e === player() && hurt?.dmg > 0) drop?.('hurt');
  });
  return {
    set(on, onDrop = null) {
      carrying = !!on;
      drop = carrying ? onDrop : null;
      if (!carrying) forced = false;
    },
    carrying: () => carrying,
    /** A frame of the hands full, at `t` ms. */
    frame(t) {
      const pw = weapon();
      const s = carryStep(
        { carrying: carrying && !!pw, sheathed: pw?.sheathed, forced, letGoAt },
        t,
        () => !!drop?.('let'),
      );
      forced = s.forced;
      if (s.letGoAt != null) letGoAt = s.letGoAt;
      if (s.sheathe && pw) pw.sheathed = true;
      if (s.say) say(s.say);
    },
    destroy() {
      carrying = false;
      drop = null;
      registerFootSpeedMod(name, null);
      registerPlayerHurtListener(name, null);
    },
  };
}
