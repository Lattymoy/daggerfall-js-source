// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 5.1): THE HOLD'S FOES - the machine that stands what the ledger calls for.
// A wave's foes at the ward's four gates, drawn off the dungeon's own encounter table (systems/encounters.js
// chooseRandomEnemy, the rest encounter's roll), each held to the ward by the AI's own leash (enemyMotor.js `follow`: past
// it a foe drops the player and walks home). The captain: an elite of the table where elites stand, with its boss traits.
// The word says the wave's deaths and its clear, and the captain's fall; a failed attempt's foes crumble. Not a DFU member
// (Ledger A: DELVE II).
import { holdGates, DELVE_WARD_PAD_M } from '../../net/delve/delveLaw.js';
import { rollBossTraits, giveBossTraits } from '../../systems/bossTraits.js';
import { PLACE_FOE_DEFAULTS } from '../../systems/quest/sceneMount.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';

/** The leash past the ward (m): a foe chases a player this far out of the ward, then walks home. */
export const HOLD_LEASH_PAD_M = 2;
/** A gate's next rank stands this much nearer the heart (m). */
export const HOLD_RANK_STEP_M = 0.9;
/** A fallen foe's leash: the ward and HOLD_LEASH_PAD_M. @param {{ r: number }} site */
export const holdLeashM = (site) => site.r + DELVE_WARD_PAD_M + HOLD_LEASH_PAD_M;

/** Where a wave's `n` foes stand: the four gates in turn, each next rank a step nearer the heart, on the site's floor.
 *  Pure. @param {import('../../net/delve/delveLaw.js').DelveSite} site @param {number} n */
export function holdStandPlaces(site, n) {
  const gates = holdGates(site), out = [];
  for (let j = 0; j < n; j++) {
    const g = gates[j % gates.length], rank = Math.floor(j / gates.length);
    const dx = site.x - g[0], dz = site.z - g[2], d = Math.hypot(dx, dz) || 1;
    out.push([g[0] + (dx / d) * rank * HOLD_RANK_STEP_M, site.y, g[2] + (dz / d) * rank * HOLD_RANK_STEP_M]);
  }
  return out;
}

/**
 * One Hold's foes. `host`: `spawn(mobileType, at, opts)` the dungeon's spawnLooseFoe, `remove(f)` its removeLooseFoe,
 * `pick()` a mobile id of the dungeon's table (-1 none), `elites()` whether an elite may stand, `alive()` the context's
 * life, `rolls` the dice. Answers `on(ev)` for the ledger's events, `word()` for the ledger, `crumble()`, `foes()`.
 * @param {import('../../net/delve/delveLaw.js').DelveSite} site @param {any} host
 */
export function createHoldFoes(site, host) {
  const heart = [site.x, site.y, site.z];
  const all = new Set(), waveFoes = new Set();
  let wave = 0, pending = 0, gen = 0, captain = /** @type {any} */ (null);
  const rolls = host.rolls ?? Math.random;
  const leash = (f) => { if (f?.ai) f.ai.follow = { feet: () => heart, stop: site.r / 2, leash: holdLeashM(site) }; };
  async function standOne(mobileType, pos, opts, myGen) {
    const fly = (ENEMY_BASICS[mobileType]?.behaviour ?? 'General') === 'Flying';
    const at = [pos[0], pos[1] + PLACE_FOE_DEFAULTS.separationDistance + (fly ? 1.5 : 0), pos[2]];
    let f = null;
    try { f = await host.spawn(mobileType, at, { yawRad: Math.atan2(site.x - pos[0], site.z - pos[2]), ...opts }); } catch { f = null; }
    if (!f) return null;
    if (myGen !== gen || !host.alive()) { host.remove(f); return null; }   // the attempt ended while it stood
    f._delve = site.i;
    leash(f);
    all.add(f);
    return f;
  }
  function standWave(w, wz) {
    wave = w; waveFoes.clear();
    const places = holdStandPlaces(site, wz), myGen = gen;
    for (const p of places) {
      const type = host.pick();
      if (!(type >= 0)) continue;
      pending++;
      void standOne(type, p, {}, myGen).then((f) => { pending--; if (f && wave === w && myGen === gen) waveFoes.add(f); });
    }
  }
  function standCaptain(traits) {
    const type = host.pick(), myGen = gen;
    if (!(type >= 0)) return;
    pending++;
    void standOne(type, holdStandPlaces(site, 1)[0], { eliteFoe: !!host.elites() }, myGen).then((f) => {
      pending--;
      if (!f || myGen !== gen) return;
      const e = f.entity;
      if (e) { e.bossTraits = undefined; e.bossWard = undefined; giveBossTraits(e, rollBossTraits(traits, rolls)); }
      captain = f;
    });
  }
  function crumble() {
    gen++; pending = 0;
    for (const f of all) if (!f.dead) host.remove(f);
    all.clear(); waveFoes.clear(); captain = null; wave = 0;
  }
  return {
    /** The ledger's events (net/delve/delveLaw.js): a wave, the captain, the attempt failed or won. */
    on(ev) {
      if (ev.k === 'wave') standWave(ev.w, ev.wz);
      else if (ev.k === 'captain') standCaptain(ev.traits);
      else if (ev.k === 'failed' || ev.k === 'won') crumble();
    },
    /** This machine's word: it stands the foes; the wave's deaths and its clear; the captain's fall. */
    word() {
      let kn = 0;
      for (const f of waveFoes) if (f.dead) kn++;
      const wc = wave > 0 && pending === 0 && waveFoes.size > 0 && kn === waveFoes.size ? wave : 0;
      return { o: 1, kw: wave, kn, wc, cf: captain?.dead ? 1 : 0 };
    },
    crumble,
    foes: () => [...all],
    /** For the tests: what it holds. */
    state: () => ({ wave, pending, gen, wave_: waveFoes.size, all: all.size, captain: !!captain }),
  };
}
