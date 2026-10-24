// RVN-ARTS (bible/06-Systems/Revenants.md section 41; the owner, 2026-10-17: "Give revenants the chance to have unique
// telegraphed abilities, magic abilities like healing or other buffs, etc (Must be balanced)"). One revenant in
// ARTS_CHANCE is born with an art, drawn on its id from its family's pool. Hunting me (from rank II, the Enhanced AI switch
// on): Mending, Ward and War Cry CHANNEL - a disc in the art's colour about its own feet, broken by any blow that lands -
// once a fight; Siphon, Barrage and Nova are THROWN - the brain's own shapes at or about me, my feet's verdict at the
// landing, a blast through the host's door, COOLDOWN apart. Sworn, each helps me: a heal when I fall low, a Shield or my
// Strength as it goes into a fight, a strike at its foe through the scene's door.
// Pinned: the law; the draw; each channel (whole, broken, once); each thrown art (its marks, its verdicts, its blast, its
// cooldown); every gate; the sworn halves through the real wiring (swornFightStep, the hurt listener); the words; the
// pools' wiring. AUDIT RVN (Revenants.md section 43): its marks on the ground; a foe that cannot act, a silenced one, one
// at peace; a foe the pool stops stepping; the blasts' exact weights; the ward's stamp; the channel's disc and its break;
// the siphon's draught; the sworn strikes' foes, reach, sight and rank; the sworn ward's words.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const A = await import('../../../src/systems/revenant/revenantArts.js');
const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../../src/systems/companionSlots.js');
const F = await import('../../../src/systems/revenant/revenantFeud.js');
const B = await import('../../../src/ai/foeBlows.js');
const { setTacticsClock } = await import('../../../src/ai/tacticsClock.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { hurtPlayer } = await import('../../../src/characters/playerEntity.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
let now = 0, me, list;
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); A._resetArtsForTests(); B.resetBlows(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvnarts', level: 10, health: 100, maxHealth: 100, items: [] };
  RC.setRetinuePlayer(me);
  setWorldMinutes(14400);
  now = 100; setTacticsClock(() => now);
  setPlayerDoor(null);
  list = [];
});
/** A record whose id draws `art` (a save's, as the game reads one back). */
function withArt(art, { mobileType = M.Orc, rank = 2, sworn = false } = {}) {
  let id = null;
  for (let i = 0; i < 20000 && !id; i++) { const c = `rvart-${list.length}-${art}-${mobileType}-${i}`; if (A.drawArt(c, mobileType) === art) id = c; }   // one id a record
  const r = { id, rev: 1, mobileType, gender: 'male', given: 'Grushnak', epithet: 'the Butcher', name: 'Grushnak the Butcher', rank, born: 0, dueAt: 0, ...(sworn ? { sworn: true, fate: 'sworn', companion: { state: 'with' } } : {}) };
  list.push(r);
  restoreModSaveRecords({ [N.REVENANT_SAVE]: { v: 1, list, lastDay: null } });
  return N.revenantById(id);
}
/** Its body in a pool - the record a pool's frame passes (`entity.revenant` its stand's stamp). */
function foe(r, { health = 100, at = [0, 0, 0] } = {}) {
  return {
    mobileType: r.mobileType, dead: false,
    entity: { mobileType: r.mobileType, level: 10, health, maxHealth: 100, damageScale: 1, revenant: { id: r.id, name: r.name, rank: r.rank, edge: F.adaptEdge(['unflinching'], 'axe') } },
    ai: { feet: [...at], yaw: 0, detected: true, inSight: true },
  };
}
/** A pool's door, and my feet (`c.feet` - moved as I move). Its strike answers the health it took from me (`c.took`). */
function ctxOf(feet, extra = {}) {
  const out = { feet, took: 25, struck: [], said: [], sounds: [] };
  out.ctx = { strike: (sp) => { out.struck.push(sp); return out.took; }, say: (ev) => out.said.push(ev), sfx: (el) => out.sounds.push(el), rolls: () => 0, ...extra };
  return out;
}
/** A pool's frame of its art. */
const go = (f, c) => A.revenantArtFrame(f, c.feet, c.ctx);
/** A spell's mean magnitude at `level` - DFU's GetMagnitude (the base range, and the level's range a MagnitudePerLevel). */
const meanOf = (sp, level) => { const e = sp.effects[0]; return (e.magnitudeBaseLow + e.magnitudeBaseHigh) / 2 + Math.floor(level / e.magnitudePerLevel) * (e.magnitudeLevelBase + e.magnitudeLevelHigh) / 2; };
const artBlows = () => [...B.liveBlows().values()].filter((b) => b.art);
/** The pool's frames from now to `t` - one at most every FOE_MAX_FRAME_DT, as a pool steps its foes (a foe not stepped
 *  past BLOW_STALE has its marks cut) - answering the last thing that happened. */
function to(f, c, t) { t += 1e-6; let out = null; while (now < t) { now = Math.min(t, now + 0.05); const r = go(f, c); if (r != null) out = r; } return out; }
const by = (f, c, dt) => to(f, c, now + dt);

// ── the law ─────────────────────────────────────────────────────────

test('RVN-ARTS THE LAW: six arts, one in ARTS_CHANCE, from rank II; each family\'s pool; every number; colours never a blow\'s ember or iron (mutants: any number moved; a pool moved)', () => {
  assert.deepEqual([...A.ARTS], ['mending', 'warding', 'warcry', 'siphon', 'barrage', 'nova']);
  assert.deepEqual([A.ARTS_CHANCE, A.ART_RANK], [0.35, 2]);
  assert.deepEqual(JSON.parse(JSON.stringify(A.ART_POOL)), { blade: ['warding', 'warcry', 'siphon', 'mending'], beast: ['warcry', 'mending', 'nova'], brute: ['warcry', 'nova', 'warding'], caster: ['mending', 'warding', 'barrage', 'siphon', 'nova'] });
  assert.deepEqual(JSON.parse(JSON.stringify(A.ART_LAW)), {
    MEND: { AT: 0.5, CHANNEL: 2, HEAL: 0.2 }, WARD: { AT: 0.75, CHANNEL: 1.5, TAKEN: 0.65, SECONDS: 10 }, CRY: { REACH: 20, CHANNEL: 1, BLOWS: 1.2, SECONDS: 12 },
    SIPHON: { REACH: 8.5, WINDUP: 1.3, MULT: 1 }, BARRAGE: { REACH: 12, WINDUP: 1.1, STEP: 0.45, COUNT: 3, MULT: 0.6 }, NOVA: { REACH: 3.8, WINDUP: 1.4, MULT: 1.2 },
    COOLDOWN: [14, 20], FIRST: [3, 6],
    SWORN_MEND: { AT: 0.4, SHARE: 0.12, PER_RANK: 0.02, COOLDOWN: 120, SIDE: 0.5 }, SWORN_TAUGHT: 0.75, SWORN_WARD: { BASE: 6, PER_RANK: 3, ROUNDS: 6, COOLDOWN: 90 }, SWORN_CRY: { BASE: 4, PER_RANK: 2, ROUNDS: 6, COOLDOWN: 90 },
    SWORN_STRIKE: { COOLDOWN: [16, 22], SIPHON: 1, SIPHON_HEAL: 1 / 4, BARRAGE: 1.5, NOVA: 0.8, NOVA_REACH: 5, REACH: 12, RANK: [0.5, 0.1] },
  });
  for (const c of Object.values(A.ART_COLORS)) { assert.notDeepEqual([...c], [...B.BLOW_COLOR]); assert.notDeepEqual([...c], [...B.IRON_COLOR]); assert.notDeepEqual([...c], [...F.SIG.COLOR]); }
});

test('RVN-ARTS AUDIT RVN B3 THE BLASTS\' WEIGHTS: each thrown art\'s spell its multiple of the pyre\'s mean at every level - no per-level term rounded up to the pyre\'s own - and a barrage\'s three together, a siphon and a nova each lighter than the signature\'s x2, measured on the spells the door casts (mutants: the pyre\'s own spell back; a level\'s term rounded; a weight moved)', () => {
  for (const lvl of [1, 5, 10, 20, 30, 50]) {
    const sig = meanOf(F.pyreSpell('Pyre', 4, F.SIG.MULT), lvl);
    for (const [art, mult, count] of [['Siphon', A.ART_LAW.SIPHON.MULT, 1], ['Barrage', A.ART_LAW.BARRAGE.MULT, A.ART_LAW.BARRAGE.COUNT], ['Nova', A.ART_LAW.NOVA.MULT, 1]]) {
      const sp = A.artSpell(art, 4, lvl, mult);
      assert.deepEqual([sp.rangeType, sp.effects[0].type, sp.effects[0].subType, sp.effects[0].magnitudeLevelBase, sp.effects[0].magnitudeLevelHigh], [2, 4, 0, 0, 0], `${art} at ${lvl}: at range, Damage Health, no level's term`);
      assert.ok(Math.abs(meanOf(sp, lvl) - A.artMagnitude(lvl, mult)) <= 0.5, `${art} at ${lvl}: ${meanOf(sp, lvl)} against ${A.artMagnitude(lvl, mult)}`);
      assert.ok(meanOf(sp, lvl) * count < sig, `${art} x${count} at ${lvl}: ${meanOf(sp, lvl) * count} under the signature's ${sig}`);
    }
  }
  assert.equal(meanOf(A.artSpell('Barrage', 4, 30, 0.6), 30), 21, 'level 30: three fifths of the pyre\'s 34.5 - not the 33 its own spell rounded to');
});

test('RVN-ARTS THE DRAW: on its id - the same every read; about one in three born with one; each from its family\'s pool, every art reachable; a record\'s art its id\'s (mutants: the chance moved; the family unread; the draw on the shared dice)', () => {
  assert.equal(A.drawArt('rv-a', M.Orc), A.drawArt('rv-a', M.Orc));
  let n = 0;
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const a = A.drawArt(`rv-draw-${i}`, M.Orc);
    if (a) { n++; seen.add(a); assert.ok(A.ART_POOL.blade.includes(a)); }
  }
  assert.ok(n / 4000 > 0.32 && n / 4000 < 0.38, `${n} of 4000`);
  assert.deepEqual([...seen].sort(), [...A.ART_POOL.blade].sort());
  for (const [mt, fam] of [[M.GrizzlyBear, 'beast'], [M.Giant, 'brute'], [M.Lich, 'caster'], [M.Mage, 'caster'], [M.Warrior, 'blade']]) {
    for (let i = 0; i < 300; i++) { const a = A.drawArt(`rv-fam-${i}`, mt); if (a) assert.ok(A.ART_POOL[fam].includes(a), `${mt}: ${a} of ${fam}`); }
  }
  const r = withArt('nova', { mobileType: M.Lich });
  assert.equal(A.artOf(r), 'nova');
  assert.equal(A.drawArt(null, M.Orc), null);
});

// ── hunting me: the channels ────────────────────────────────────────

test('RVN-ARTS MENDING: under half its health it channels - a disc of its colour about its own feet, called once - and whole it heals a fifth of its health; once a fight (mutants: the line moved; the heal moved; healed twice; no disc)', () => {
  const r = withArt('mending');
  const f = foe(r, { health: 55 });
  const c = ctxOf([3, 0, 0]);
  assert.equal(go(f, c), null, 'over half: nothing');
  f.entity.health = 40;
  assert.equal(go(f, c), 'start');
  const [b] = artBlows();
  assert.deepEqual([b.kind, b.ahead, b.art, b.land - b.start, [...b.color]], ['pyre', 0, 'mending', 2, [...A.ART_COLORS.mending]]);
  assert.ok(B.inBlow(b, 0, 0) && !B.inBlow(b, 3, 0), 'a disc about its own feet');
  assert.equal(c.said.length, 1);
  assert.deepEqual([c.said[0].kind, c.said[0].kicker], ['art', 'Art']);
  assert.match(c.said[0].line, /Grushnak calls on its Mending! Strike it to break the spell!/);
  assert.equal(by(f, c, 1.9), null);
  assert.equal(f.entity.health, 40, 'not yet');
  assert.equal(by(f, c, 0.1), 'landed');
  assert.equal(f.entity.health, 60, 'a fifth of its health');
  by(f, c, 0.4);
  assert.equal(artBlows().length, 0, 'its mark gone after its flash');
  f.entity.health = 30; now += 30;
  assert.equal(go(f, c), null, 'once a fight');
});

test('RVN-ARTS A CHANNEL BROKEN: any blow that lands on it while it channels breaks it - its disc shatters, its words, the art spent (mutants: the blow unread; the shatter skipped; a broken channel healing)', () => {
  const r = withArt('mending');
  const f = foe(r, { health: 40 });
  const c = ctxOf([3, 0, 0]);
  go(f, c);
  by(f, c, 1); f.entity.health = 34;
  assert.equal(by(f, c, 0.05), 'broken');
  assert.equal(artBlows().length, 0, 'out of the live marks');
  assert.ok(B.drawableBlows(now).some((d) => d.blow.art === 'mending' && d.phase.shatter > 0), 'shattering');
  assert.match(c.said.at(-1).line, /Grushnak's Mending is broken!/);
  by(f, c, 2);
  assert.equal(f.entity.health, 34, 'no heal');
  now += 5; f.entity.health = 20;
  assert.equal(go(f, c), null, 'spent');
});

test('RVN-ARTS WARD: under three quarters it channels; whole, its blows taken at 0.65 for ten seconds - never past an adaptation\'s own less, never its weakness - then its edge as it was (mutants: the ward never lifts; its weakness warded; the adaptation overridden)', () => {
  const r = withArt('warding');
  const f = foe(r, { health: 70 });
  const was = f.entity.revenant.edge;
  const c = ctxOf([3, 0, 0]);
  assert.equal(go(f, c), 'start');
  assert.equal(by(f, c, 1.5), 'landed');
  const w = f.entity.revenant.edge;
  assert.deepEqual({ ...w.taken }, { h2h: 0.6, blade: 0.65, blunt: 0.65, arrow: 0.65 }, 'Unflinching keeps its 0.6; its axe weakness unwarded');
  assert.equal(w.weak, 'axe');
  by(f, c, 9.9);
  assert.equal(f.entity.revenant.edge, w, 'still warded');
  by(f, c, 0.2);
  assert.equal(f.entity.revenant.edge, was, 'its own edge again');
  f.entity.health = 10; now += 20;
  assert.equal(go(f, c), null, 'once a fight');
});

test('RVN-ARTS WAR CRY: as it joins the fight (in sight, within 20 m) it roars; whole, it and its band strike a fifth harder for twelve seconds, then as they were; once (mutants: the band unread; the cry never ends; a cry each frame)', () => {
  const r = withArt('warcry');
  const f = foe(r, { health: 100 });
  const kin = { dead: false, retinueOf: r.id, entity: { damageScale: 1.1 } };
  const other = { dead: false, retinueOf: 'someone', entity: { damageScale: 1 } };
  const c = ctxOf([25, 0, 0], { foes: () => [f, kin, other] });
  assert.equal(go(f, c), null, 'beyond its reach');
  c.feet = [10, 0, 0];
  assert.equal(go(f, c), 'start');
  assert.equal(by(f, c, 1), 'landed');
  assert.equal(f.entity.damageScale, 1.2);
  assert.ok(Math.abs(kin.entity.damageScale - 1.32) < 1e-9, 'its band');
  assert.equal(other.entity.damageScale, 1, 'another\'s band');
  by(f, c, 12);
  assert.ok(Math.abs(f.entity.damageScale - 1) < 1e-9 && Math.abs(kin.entity.damageScale - 1.1) < 1e-9, 'as they were');
  now += 30; assert.equal(go(f, c), null, 'once');
});

// ── hunting me: the thrown arts ─────────────────────────────────────

test('RVN-ARTS BARRAGE: three discs at my feet, each made and aimed as it is cast, each landing a blast of its element at three fifths through the host\'s door; a disc I left lands on nothing; the next one COOLDOWN off (mutants: one disc; the aim locked at the first; the weight moved; no cooldown)', () => {
  const r = withArt('barrage', { mobileType: M.Lich });
  const f = foe(r);
  const c = ctxOf([6, 0, 0]);
  now = 200;
  assert.equal(go(f, c), null, 'its first a few seconds into the fight');
  now = 203;
  assert.equal(go(f, c), 'start');
  assert.equal(artBlows().length, 1, 'the first cast');
  c.feet = [0, 0, 6]; to(f, c, 203.46);
  assert.equal(artBlows().length, 2, 'the second, cast');
  const second = artBlows()[1];
  assert.ok(B.inBlow(second, 0, 6), 'aimed at my feet as it was cast');
  c.feet = [0, 0, -6]; to(f, c, 203.92);
  assert.equal(artBlows().length, 3);
  c.feet = [6, 0, 0];
  assert.equal(to(f, c, 204.11), 'hit', 'the first: I stood in it');
  c.feet = [20, 0, 20];
  assert.equal(to(f, c, 204.57), 'missed');
  c.feet = [0, 0, -6];
  assert.equal(to(f, c, 205.03), 'hit');
  assert.equal(c.struck.length, 2);
  assert.deepEqual(c.struck[0], A.artSpell('Barrage', F.pyreElement(M.Lich), 10, 0.6), 'its element, three fifths of the pyre');
  by(f, c, 1);
  assert.equal(artBlows().length, 0);
  now = 203 + 13.9; assert.equal(go(f, c), null, 'cooling');
  now = 203 + 14; assert.equal(go(f, c), 'start', 'COOLDOWN\'s low end (the rolls\' 0)');
});

test('RVN-ARTS SIPHON AND NOVA: a lane at me (the charge\'s shape) that drinks what it drew from me - at most the pyre\'s mean, nothing from a blast I saved (AUDIT RVN B10); a ring where it stands - safe at its heart, for the one who backs off - a blast of its element (mutants: the siphon drinks nothing; it drinks what it never drew; the ring\'s hole closed)', () => {
  const r = withArt('siphon');
  const f = foe(r, { health: 50 });
  const c = ctxOf([0, 0, 6]);
  now = 300; go(f, c);
  now = 303; assert.equal(go(f, c), 'start');
  assert.equal(artBlows()[0].kind, 'charge');
  assert.equal(by(f, c, 1.3), 'hit');
  assert.deepEqual(c.struck[0], A.artSpell('Siphon', 4, 10, 1), 'magic, the pyre\'s weight');
  assert.equal(f.entity.health, 50 + Math.round(A.artMagnitude(10, 1)), 'it drew 25: it drinks the pyre\'s mean at most');
  now += 20; f.entity.health = 50; c.took = 6;
  assert.equal(go(f, c), 'start');
  assert.equal(by(f, c, 1.3), 'hit');
  assert.equal(f.entity.health, 56, 'what it drew');
  now += 20; c.took = 0;
  assert.equal(go(f, c), 'start');
  assert.equal(by(f, c, 1.3), 'hit');
  assert.equal(f.entity.health, 56, 'a blast I saved, resisted or turned back draws nothing');
  const n = withArt('nova', { mobileType: M.Giant });
  const g = foe(n);
  const c2 = ctxOf([1, 0, 0]);
  now = 400; go(g, c2);
  now = 404; assert.equal(go(g, c2), 'start');
  assert.equal(artBlows().find((b) => b.art === 'nova').kind, 'ring');
  assert.equal(by(g, c2, 1.4), 'missed', 'at its heart: safe');
  now += 20;
  assert.equal(go(g, c2), 'start');
  c2.feet = [3, 0, 0];
  assert.equal(by(g, c2, 1.4), 'hit', 'in the ring');
  assert.deepEqual(c2.struck[0], A.artSpell('Nova', F.pyreElement(M.Giant), 10, 1.2));
});

test('RVN-ARTS THE GATES: rank I, the Enhanced AI switch off, a sworn one, one running, kneeling or nobody\'s fight, nothing; a live art cut when it may throw no more; any wind-up near me holds one back, and one live holds back every foe\'s (mutants: a gate dropped; the one-at-a-time rule unread)', () => {
  const young = withArt('mending', { rank: 1 });
  assert.equal(go(foe(young, { health: 10 }), ctxOf([2, 0, 0])), null, 'rank I');
  const r = withArt('mending');
  setPref('enhancedAI', false);
  assert.equal(go(foe(r, { health: 10 }), ctxOf([2, 0, 0])), null, 'the switch off');
  setPref('enhancedAI', true);
  const s = foe(r, { health: 10 }); s.entity.revenant.sworn = true;
  assert.equal(go(s, ctxOf([2, 0, 0])), null, 'a sworn one');
  for (const k of ['fleeing', 'yielded', 'roaring', 'scattering', 'puppet']) { const x = foe(r, { health: 10 }); x[k] = true; assert.equal(go(x, ctxOf([2, 0, 0])), null, k); }
  const blind = foe(r, { health: 10 }); blind.ai.inSight = false;
  assert.equal(go(blind, ctxOf([2, 0, 0])), null, 'not in its fight');
  const notMe = foe(r, { health: 10 });
  assert.equal(go(notMe, ctxOf([2, 0, 0], { onMe: () => false })), null, 'its fight another\'s');
  const held = foe(r, { health: 10 }); held.ai.canAct = false;
  assert.equal(go(held, ctxOf([2, 0, 0])), null, 'AUDIT RVN B2: paralysed - the motor\'s CanAct down');
  const hushed = foe(r, { health: 10 }); hushed.entity.isSilenced = true;
  assert.equal(go(hushed, ctxOf([2, 0, 0])), null, 'AUDIT RVN B2: silenced - its art a spell');
  const calm = foe(r, { health: 10 }); calm.ai.isHostile = false;
  assert.equal(go(calm, ctxOf([2, 0, 0])), null, 'AUDIT RVN B11: at peace with me');
  // one at a time
  const other = { _tac: { seen: now } };
  B.setLiveBlow(other, B.makeBlow('slam', [1, 0, 0], 0, now));
  const f = foe(r, { health: 10 });
  assert.equal(go(f, ctxOf([2, 0, 0])), null, 'a wind-up near me: it waits');
  B.setLiveBlow(other, null);
  assert.equal(go(f, ctxOf([2, 0, 0])), 'start');
  assert.equal(B.windupNear([2, 0, 0], now, {}), true, 'its art is a wind-up near me: no other foe winds one');
  f.fleeing = true;
  go(f, ctxOf([2, 0, 0]));
  assert.equal(artBlows().length, 0, 'it runs: its art cut');
  B.resetBlows();
  const p = foe(r, { health: 10 });
  assert.equal(go(p, ctxOf([2, 0, 0])), 'start');
  p.ai.canAct = false; go(p, ctxOf([2, 0, 0]));
  assert.equal(artBlows().length, 0, 'AUDIT RVN B2: paralysed mid-channel - cut');
  B.resetBlows();
  const roar = withArt('warcry');
  const loud = foe(roar); loud.entity.isSilenced = true;
  assert.equal(go(loud, ctxOf([5, 0, 0])), 'start', 'a cry is no spell: silence holds none');
});

test('RVN-ARTS AUDIT RVN B4 A FOE NOT STEPPED: the open world\'s pool steps a revenant\'s art before its run\'s and its scatter\'s own frames (a running one\'s ward and cry ran on, and its marks stood); a foe the pool stopped stepping (a kneeling one) has its live marks cut at its next frame - never landed late, unseen (mutants: the call back after the run\'s exits; the stale cut gone)', () => {
  const ext = read('src/scenes/exteriorFoes.js');
  assert.match(ext, /const _flee = [^\n]*\n\s+if \(f\.entity\.revenant\?\.id\) artFrame\(f, playerFeet\);[^\n]*\n\s+if \(_flee === 'escape'\)/, 'between the flee step and its exits');
  assert.equal((ext.match(/\) artFrame\(f, playerFeet\);/g) ?? []).length, 1, 'once a frame');
  const r = withArt('siphon');
  const f = foe(r);
  const c = ctxOf([0, 0, 6]);
  now = 500; go(f, c);
  now = 503; assert.equal(go(f, c), 'start');
  now += 1.0;   // a second of frames the pool never stepped it (it knelt) - its lane's landing among them
  assert.equal(go(f, c), null);
  assert.equal(c.struck.length, 0, 'cut, never landed');
  assert.equal(artBlows().length, 0);
});

test('RVN-ARTS AUDIT RVN B1, B8, B9, B10 THE CHANNEL: its disc on the ground it marks and about its feet wherever they go; broken by any harm since the last frame (a heal between never hides a blow); the ward\'s edge back on the stamp it warded alone - a stamp made since keeps its own (mutants: no fit; the disc left behind; a heal masking the blow; the old edge on the new stamp)', () => {
  const ground = { raycast: (o) => o[1] - 1.75 };   // the floor 1.75 m under any point: a stair's tread
  const r = withArt('mending');
  const f = foe(r, { health: 40 }); f.ai.collider = ground;
  const c = ctxOf([3, 0, 0]);
  assert.equal(go(f, c), 'start');
  const [b] = artBlows();
  assert.equal(b.origin[1], 1.75, 'on the ground it marks');
  f.ai.feet = [1, 0, 1]; now += 0.2; go(f, c);
  assert.deepEqual([b.origin[0], b.origin[2]], [1, 1], 'about its feet as it walks');
  f.entity.health = 46; now += 0.2; go(f, c);
  f.entity.health = 43; now += 0.2;
  assert.equal(go(f, c), 'broken', 'healed to 46, struck to 43 - over its start, still a blow');
  const w = withArt('warding');
  const g = foe(w, { health: 70 });
  const c2 = ctxOf([3, 0, 0]);
  go(g, c2); by(g, c2, 1.5);
  const lesson = F.adaptEdge(['mailed'], 'blunt');
  g.entity.revenant = { ...g.entity.revenant, edge: lesson };   // a deed re-stamps it mid-ward (revenant.js revenantDeed)
  now += 11; go(g, c2);
  assert.equal(g.entity.revenant.edge, lesson, 'the new stamp\'s lesson stands');
});

// ── sworn: for me ───────────────────────────────────────────────────

test('RVN-ARTS SWORN WARD AND WAR CRY: as it goes into a fight (through swornFightStep - the layer\'s frame), a Shield of 6 + 3 a rank or my Strength 4 + 2 a rank on me for six rounds, every ninety seconds (mutants: never cast; the size moved; no cooldown; cast every frame of a fight)', () => {
  const casts = [];
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: (b) => casts.push(b), player: () => me });
  const w = withArt('warding', { rank: 3, sworn: true });
  const body = { revenantCompanion: w.id, dead: false, entity: { health: 50, maxHealth: 50 }, ai: { target: null } };
  const tgt = { dead: false, entity: { health: 10 } };
  RC.swornFightStep(body);
  assert.equal(casts.length, 0, 'no fight');
  body.ai.target = tgt;
  RC.swornFightStep(body); RC.swornFightStep(body);
  assert.equal(casts.length, 1, 'once as it goes in');
  assert.deepEqual(casts[0], A.shieldBundle(15, 6));
  assert.equal(casts[0].effects[0].type, 35);
  body.ai.target = null; RC.swornFightStep(body);
  now += 60; body.ai.target = tgt; RC.swornFightStep(body);
  assert.equal(casts.length, 1, 'cooling');
  body.ai.target = null; RC.swornFightStep(body);
  now += 31; body.ai.target = tgt; RC.swornFightStep(body);
  assert.equal(casts.length, 2);
  const c = withArt('warcry', { rank: 5, sworn: true });
  const cb = { revenantCompanion: c.id, dead: false, entity: { health: 50, maxHealth: 50 }, ai: { target: tgt } };
  RC.swornFightStep(cb);
  assert.deepEqual(casts[2], A.mightBundle(14, 6));
  assert.deepEqual([casts[2].effects[0].type, casts[2].effects[0].subType], [9, 0], 'Fortify Strength');
});

test('RVN-ARTS SWORN STRIKES: in a fight, its Siphon on its foe (the pyre\'s weight at my level, a quarter of it to me - AUDIT RVN-STARS S7), its Barrage (x1.5), its Nova (every foe within 5 m, x0.8) - through the scene\'s door, a foe my harm may reach only, its cooldown between (mutants: a foe the door does not offer struck; my third unpaid; the cooldown gone)', () => {
  const hurt = [];
  const tgt = { dead: false, entity: { health: 80 }, ai: { feet: [2, 0, 0] } };
  const far = { dead: false, entity: { health: 80 }, ai: { feet: [9, 0, 0] } };
  let offered = [tgt, far];
  me.health = 50;
  setPlayerDoor({ foes: () => offered, feet: () => [0, 0, 0], hurtFoe: (t, n) => hurt.push([t, n]), castOnPlayer: () => {}, player: () => me });
  const s = withArt('siphon', { sworn: true });
  const body = { revenantCompanion: s.id, dead: false, entity: { health: 50, maxHealth: 50 }, ai: { target: tgt, feet: [0, 0, 0] } };
  RC.swornFightStep(body);
  assert.equal(hurt.length, 0, 'a few seconds into the fight');
  now += 6; RC.swornFightStep(body);
  const n = Math.round(A.artMagnitude(10, 1) * (0.5 + 0.1 * 2));   // AUDIT RVN E8: rank II's weight
  assert.deepEqual(hurt, [[tgt, n]]);
  assert.equal(me.health, 50 + Math.floor(n / 4), 'a quarter to me');
  now += 15.9; RC.swornFightStep(body);
  assert.equal(hurt.length, 1, 'cooling');
  now += 6.2; RC.swornFightStep(body);
  assert.equal(hurt.length, 2);
  offered = [far];
  now += 30; RC.swornFightStep(body);
  assert.equal(hurt.length, 2, 'a foe the door does not offer (a town\'s defender) is never struck');
  const nv = withArt('nova', { mobileType: M.Giant, sworn: true });
  offered = [tgt, far];
  const nb = { revenantCompanion: nv.id, dead: false, entity: { health: 50, maxHealth: 50 }, ai: { target: tgt, feet: [0, 0, 0] } };
  RC.swornFightStep(nb); now += 6; RC.swornFightStep(nb);
  assert.deepEqual(hurt.slice(2), [[tgt, Math.round(A.artMagnitude(10, 0.8) * 0.7)]], 'within five metres alone');
});

test('RVN-ARTS AUDIT RVN B5, B6, B7, E8 THE SWORN STRIKE\'S FOES AND ITS WORDS: a Nova strikes hostile foes alone - never a foe at peace, an ally of mine, itself - and none behind a wall; a Siphon or a Barrage waits on a foe past its reach or out of sight; its weight its rank\'s (rank V the pyre\'s whole); a Ward\'s and a War Cry\'s words said (a local named `t` threw them away) (mutants: the filter gone; the reach unread; the wall unread; the rank unread; the words lost)', () => {
  const hurt = [];
  const at = (x) => ({ dead: false, entity: { health: 80 }, ai: { feet: [x, 0, 0] } });
  const foeA = at(2), calm = { ...at(2), ai: { feet: [2, 0, 0], isHostile: false } }, ally = { ...at(3), entity: { health: 80, team: 'PlayerAlly' } };
  let wall = false;
  const door = { foes: () => [foeA, calm, ally], feet: () => [0, 0, 0], hurtFoe: (x, n) => hurt.push([x, n]), castOnPlayer: () => {}, player: () => me, clear: () => !wall };
  const nv = withArt('nova', { mobileType: M.Giant, rank: 5, sworn: true });
  const body = { revenantCompanion: nv.id, dead: false, entity: { health: 50 }, ai: { target: foeA, feet: [0, 0, 0] } };
  door.foes = () => [foeA, calm, ally, body];
  A.swornArtStep(body, nv, door, { rolls: () => 0 }); now += 3;
  assert.equal(A.swornArtStep(body, nv, door, { rolls: () => 0 }), 'nova');
  assert.deepEqual(hurt, [[foeA, Math.round(A.artMagnitude(10, 0.8))]], 'the hostile foe alone, at rank V\'s whole weight');
  const sp = withArt('siphon', { rank: 1, sworn: true });
  const far = at(13);
  const sb = { revenantCompanion: sp.id, dead: false, entity: { health: 50 }, ai: { target: far, feet: [0, 0, 0] } };
  door.foes = () => [far, foeA];
  A.swornArtStep(sb, sp, door, { rolls: () => 0 }); now += 3;
  assert.equal(A.swornArtStep(sb, sp, door, { rolls: () => 0 }), null, 'past its reach');
  sb.ai.target = foeA; wall = true;
  assert.equal(A.swornArtStep(sb, sp, door, { rolls: () => 0 }), null, 'behind a wall');
  wall = false;
  assert.equal(A.swornArtStep(sb, sp, door, { rolls: () => 0 }), 'siphon');
  assert.deepEqual(hurt.at(-1), [foeA, Math.round(A.artMagnitude(10, 1) * 0.6)], 'rank I: three fifths');
  const said = [];
  const wd = withArt('warding', { rank: 2, sworn: true });
  const wb = { revenantCompanion: wd.id, dead: false, entity: { health: 50 }, ai: { target: foeA, feet: [0, 0, 0] } };
  assert.equal(A.swornArtStep(wb, wd, door, { say: (l) => said.push(l) }), 'warding');
  assert.deepEqual(said, ['Grushnak wards you.']);
});

test('RVN-ARTS SWORN MENDING: a hurt that leaves me under two fifths (through hurtPlayer - the hurt listener) is mended by a sworn one at my side whose body stands here - 12% and 2% a rank of my health - every two minutes (mutants: the listener unregistered; the line moved; the share moved; no cooldown; one away mends)', () => {
  const m = withArt('mending', { rank: 3, sworn: true });
  let standing = true;
  RC.setRetinueBodies((id) => (id === m.id && standing ? { health: 40 } : null));
  me.health = 60;
  hurtPlayer(me, 10);
  assert.equal(me.health, 50, 'over two fifths: nothing');
  hurtPlayer(me, 15);
  assert.equal(me.health, 35 + 18, 'mended by 18 of 100');
  hurtPlayer(me, 20);
  assert.equal(me.health, 33, 'cooling');
  now += 121; standing = false;
  hurtPlayer(me, 5);
  assert.equal(me.health, 28, 'its body not here');
  standing = true; hurtPlayer(me, 1);
  assert.equal(me.health, 27 + 18);
  assert.equal(A.swornMendStep({ isPlayer: true, peer: true, health: 10, maxHealth: 100 }, 10, [N.revenantById(m.id)], () => true), null, 'a peer is no one it mends');
});

test('RVN-ARTS THE WORDS: the page says what its art does - to me while it hunts (and from Rank II, with Enhanced AI), for me once sworn - and no line for one without (mutants: a side\'s words swapped; the rank\'s note gone)', () => {
  const r = withArt('barrage', { mobileType: M.Lich, rank: 1 });
  assert.equal(A.artWords(r), 'Art: Barrage - 3 blasts at your feet, one after another. Keep moving (from Rank II).');
  setPref('enhancedAI', false);
  r.rank = 2;
  assert.equal(A.artWords(r), 'Art: Barrage - 3 blasts at your feet, one after another. Keep moving (with Enhanced AI).');
  const sy = withArt('siphon', { rank: 2, sworn: true });
  assert.equal(A.artWords(sy), 'Art: Siphon - now and then it draws its foe\'s life and gives you 25% of it.', 'AUDIT RVN D13: its share its constant\'s');
  const s = withArt('mending', { rank: 2, sworn: true });
  assert.equal(A.artWords(s), 'Art: Mending - when you fall under 40% of your health it heals 16% of it (every 120 seconds).', 'AUDIT RVN-STARS S9: in seconds');
  const w = withArt('warding', { rank: 4, sworn: true });
  assert.equal(A.artWords(w), 'Art: Ward - as it goes into a fight it shields you for 18 (every 90 seconds).');
  let none = null;
  for (let i = 0; i < 100 && !none; i++) if (!A.drawArt(`rv-none-${i}`, M.Orc)) none = { id: `rv-none-${i}`, mobileType: M.Orc, rank: 3 };
  assert.equal(A.artWords(none), null);
  assert.match(read('src/ui/revenant/revenantPage.js'), /const art = fallen \? '' : artWords\(r\);/, 'the Revenants page says it');
  assert.match(read('src/ui/companionRoster.js'), /const art = artWords\(r, \{ sworn: true \}\);/, 'the Companions page says it');
});

test('RVN-ARTS THE POOLS: the open world\'s pool (street and building) and the dungeon\'s each step a revenant\'s art beside its signature, through their own spell doors - the dungeon\'s for a foe of mine alone, REVENANT-DUNGEON\'s gate (mutants: a pool unwired; the dungeon\'s gate gone)', () => {
  const ext = read('src/scenes/exteriorFoes.js');
  assert.match(ext, /if \(f\.entity\.revenant\?\.id\) artFrame\(f, playerFeet\);/);
  assert.match(ext, /revenantArtFrame\(f, playerFeet, f\._artDoor \?\?= \{/, 'its door made once a stand');
  assert.match(ext, /strike: \(sp\) => \{ const h = playerEntity\?\.health \?\? 0; magicHooks\?\.strikePlayer\?\.\(sp, f\.entity\.level \?\? 1, f\); return Math\.max\(0, h - \(playerEntity\?\.health \?\? h\)\); \}/, 'the health it took');
  const dun = read('src/scenes/dungeonContext.js');
  assert.match(dun, /if \(f\.entity\?\.revenant\?\.id && \(!onlineRoom\(\) \|\| !_roomFoe\)\) revenantArtFrame\(f, _pf, f\._artDoor \?\?= \{[^\n]*strike: \(sp\) => \{ const h = playerEntity\.health \?\? 0; magic\.strikePlayerFrom\(sp, f\.entity\.level \?\? 1, f\); return Math\.max\(0, h - \(playerEntity\.health \?\? h\)\); \}/);
});
