// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 5.1): THE HOLD'S FOES - the machine that stands what the ledger calls for.
// A wave's foes at the ward's four gates, drawn off the dungeon's own encounter table (systems/encounters.js
// chooseRandomEnemy, as the dungeon rolls its own), each a foe like any other (no leash: a follower's leash turns the
// Enhanced AI's fighting off - ai/tactics.js). The captain: an elite of the table where elites stand, with its boss
// traits. Each foe carries its stamp (`_delve`), which a body taking its place takes (the context's replace doors: the
// Wabbajack's change, a rebuild in its slot), so the count is read off the pool. Not a DFU member (Ledger A: DELVE II).
import { holdGates } from '../../net/delve/delveLaw.js';
import { rollBossTraits, giveBossTraits } from '../../systems/bossTraits.js';
import { PLACE_FOE_DEFAULTS } from '../../systems/quest/sceneMount.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';

/** A gate's next rank stands this much nearer the heart (m). */
export const HOLD_RANK_STEP_M = 0.9;
/** A foe that will not stand is asked again, a fresh pick each time, this many times in all. */
export const HOLD_STAND_TRIES = 3;
/** A captain gone without its fall (or never stood) is stood again this long after (ms, the encounter clock). */
export const HOLD_RESTAND_MS = 2_000;

/** Where a wave's `n` foes stand: the four gates in turn, each next rank a step nearer the heart, on the site's floor.
 *  Pure. @param {import('../../net/delve/delveLaw.js').DelveSite} site @param {number} n */
export function holdStandPlaces(site, n) {
  const gates = holdGates(site),
    out = [];
  for (let j = 0; j < n; j++) {
    const g = gates[j % gates.length],
      rank = Math.floor(j / gates.length);
    const dx = site.x - g[0],
      dz = site.z - g[2],
      d = Math.hypot(dx, dz) || 1;
    out.push([g[0] + (dx / d) * rank * HOLD_RANK_STEP_M, site.y, g[2] + (dz / d) * rank * HOLD_RANK_STEP_M]);
  }
  return out;
}

/** Whether a foe went down to the fight - killed, executed, spared or put to flight - and not removed by another hand
 *  (a Wabbajack's change, a dispel, a mod's). Pure. */
export const holdDowned = (f) => !!f?.dead && (f.entity?.health <= 0 || !!f.executed || !!f._swornAway || !!f.escaped);

/**
 * One site's foes. `host`: `spawn(mobileType, at, opts)` the dungeon's spawnLooseFoe, `remove(f)` its removeLooseFoe,
 * `pick()` a mobile id of the dungeon's table (-1 none), `elites()` whether an elite may stand, `alive()` the context's
 * life, `foes()` its pool, `now()` the encounter clock (ms), `rolls` the dice, `mark(f)` each foe as it stands (the
 * Vigil's hunt its relic). `frame()` reads the pool once a frame; `word(out)` fills the ledger's word from it. DLV4: a
 * Wellsprings' source pours one at a time (`pour`) and a rite's foes drift in (`drift`), each counted apart.
 * @param {import('../../net/delve/delveLaw.js').DelveSite} site @param {any} host
 */
export function createHoldFoes(site, host) {
  const rolls = host.rolls ?? Math.random;
  let gen = 0,
    wave = 0,
    pending = 0,
    stood = 0,
    traits = 0,
    askedAt = -Infinity;
  let live = 0,
    kn = 0,
    capLive = false,
    capDown = false,
    driftLive = 0;
  const srcLive = new Map(),
    srcPending = new Map();
  const ours = (f) => f?._delve?.i === site.i;
  async function standOne(pos, opts, stamp) {
    const fly = (type) => (ENEMY_BASICS[type]?.behaviour ?? 'General') === 'Flying';
    let f = null;
    for (let k = 0; k < HOLD_STAND_TRIES && !f && stamp.g === gen; k++) {
      const type = host.pick();
      if (!(type >= 0)) return null;
      const at = [pos[0], pos[1] + PLACE_FOE_DEFAULTS.separationDistance + (fly(type) ? 1.5 : 0), pos[2]];
      try {
        f = await host.spawn(type, at, { yawRad: Math.atan2(site.x - pos[0], site.z - pos[2]), ...opts });
      } catch {
        f = null;
      }
    }
    if (!f) return null;
    if (stamp.g !== gen || !host.alive()) {
      host.remove(f);
      return null;
    } // the attempt ended while it stood
    f._delve = stamp;
    host.mark?.(f);
    return f;
  }
  /** Stand `n` foes for wave `w`, each counted in flight until it stands (or never will). */
  function standWave(w, n) {
    wave = w;
    stood = 0;
    const myGen = gen;
    for (const p of holdStandPlaces(site, n)) {
      pending++;
      void standOne(p, {}, { i: site.i, g: myGen, w, cap: false }).then((f) => {
        if (myGen !== gen) return; // a later attempt's count is its own
        pending--;
        if (f && wave === w) stood++;
      });
    }
  }
  function standCaptain() {
    const myGen = gen;
    pending++;
    askedAt = host.now();
    void standOne(
      holdStandPlaces(site, 1)[0],
      { eliteFoe: !!host.elites() },
      { i: site.i, g: myGen, w: 0, cap: true },
    ).then((f) => {
      if (myGen !== gen) return;
      pending--;
      const e = f?.entity;
      if (e) {
        e.bossTraits = undefined;
        e.bossWard = undefined;
        giveBossTraits(e, rollBossTraits(traits, rolls));
      }
    });
  }
  /** One foe at `at` for source `j` (`src`) or drifting in (`drift`), counted in flight on its own until it stands. */
  function standLoose(at, extra, inFlight) {
    const myGen = gen,
      key = extra.src ?? 'drift';
    inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
    void standOne(at, {}, { i: site.i, g: myGen, w: 0, cap: false, ...extra }).then(() => {
      if (myGen !== gen) return;
      inFlight.set(key, Math.max(0, (inFlight.get(key) ?? 0) - 1));
    });
  }
  const driftFlight = new Map();
  /** Every living foe of this site's goes, whatever attempt stood it (a load's revived ones too). */
  function crumble() {
    gen++;
    pending = 0;
    wave = 0;
    stood = 0;
    traits = 0;
    live = 0;
    kn = 0;
    capLive = false;
    capDown = false;
    driftLive = 0;
    srcLive.clear();
    srcPending.clear();
    driftFlight.clear();
    for (const f of [...(host.foes() ?? [])]) if (ours(f) && !f.dead) host.remove(f);
  }
  return {
    /** The ledger's events (net/delve/delveLaw.js): a wave, the captain, the attempt failed or won. */
    on(ev) {
      if (ev.k === 'wave') standWave(ev.w, ev.wz);
      else if (ev.k === 'captain') {
        traits = ev.traits;
        standCaptain();
      } else if (ev.k === 'failed' || ev.k === 'won') crumble();
    },
    /** The pool read once: this attempt's living foes, the wave's downed, the captain's state - and a captain gone
     *  without its fall stood again. */
    frame() {
      live = 0;
      kn = 0;
      capLive = false;
      capDown = false;
      driftLive = 0;
      srcLive.clear();
      for (const f of host.foes() ?? []) {
        const s = f?._delve;
        if (!s || s.i !== site.i || s.g !== gen) continue;
        if (!f.dead && s.src != null) {
          srcLive.set(s.src, (srcLive.get(s.src) ?? 0) + 1);
          continue;
        }
        if (!f.dead && s.drift) {
          driftLive++;
          continue;
        }
        if (!f.dead) {
          if (s.cap) capLive = true;
          else if (s.w === wave) live++;
        } else if (holdDowned(f)) {
          if (s.cap) capDown = true;
          else if (s.w === wave) kn++;
        }
      }
      if (traits && !capDown && !capLive && pending === 0 && host.now() - askedAt >= HOLD_RESTAND_MS) standCaptain();
    },
    /** This machine's word (filled into `out`): it stands the foes; the wave's downed and its clear (each of its foes
     *  down or gone, none still coming); the captain's fall. */
    word(out = {}) {
      out.o = 1;
      out.kw = wave;
      out.kn = kn;
      out.wc = wave > 0 && pending === 0 && stood > 0 && live === 0 ? wave : 0;
      out.cf = capDown ? 1 : 0;
      return out;
    },
    /** DLV4: one foe poured from source `j` at `at`. */
    pour(j, at) {
      standLoose(at, { src: j }, srcPending);
    },
    /** DLV4: one foe drifting in at `at`. */
    drift(at) {
      standLoose(at, { drift: true }, driftFlight);
    },
    /** A source's own foes alive and on their way; the drifting ones'. */
    sourceLive: (j) => (srcLive.get(j) ?? 0) + (srcPending.get(j) ?? 0),
    driftLive: () => driftLive + (driftFlight.get('drift') ?? 0),
    crumble,
    foes: () => (host.foes() ?? []).filter((f) => ours(f) && f._delve.g === gen),
    /** For the tests: what it holds. */
    state: () => ({ wave, pending, gen, stood, live, captain: traits > 0 }),
  };
}
