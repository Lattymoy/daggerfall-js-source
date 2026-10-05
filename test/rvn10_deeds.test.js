// RVN10 - NEW DEEDS (bible/12-Enhanced-AI/Feud-Arc.md section 21; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). FELLED: a special foe whose blow knocked out my companion (a sworn
// revenant, a crew hand ashore) - the knock-out arm of both damage doors notes the striker, the companion layer hands it
// on, the world host makes the deed on it with the companion's name ("Bane of Borgakh"), and it stands out. ROUTED: a
// special foe on me, its harm within 30 s, when I get 70 m from it (the street pool, before its cull) or a jump (a
// Recall, a teleport) takes me out of its pool - and a hurt in that fight left me under half: the deed (it learns
// Relentless), the foe gone. Never after my death, never a load's.
// Pinned: the numbers and the banks; the felling's deed and its gates; the knock-out arms, the layer and the hosts; the
// fight's law (opened, carried, lapsed; the low since its start; ended by a death, a load, a judging); the rout's gates
// one by one, its deed and its lesson; the street's distance before the cull; the jump's sweep and its exclusions; the
// cards, the page's words, the save's ally.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const H = await import('../src/systems/harmMark.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { hurtPlayer, setAvoidDeathHook } = await import('../src/characters/playerEntity.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const { historyWords } = await import('../src/ui/revenantPage.js');
const { createCrewAshore } = await import('../src/scenes/crewAshore.js');
const { createCompanions } = await import('../src/systems/naval/crewCompanions.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const me = (id = 'char-rvn10') => ({
  isPlayer: true, name: 'Ayla Stormwind', characterId: id, items: [], stats: stats(), skills: new Array(35).fill(30), level: 10,
  career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const orc = (over = {}) => ({ mobileType: M.Orc, level: 6, health: 60, maxHealth: 60, team: 'Orcs', champion: 'mighty', ...over });
/** A pool's record as the doors and the door's foes hold it: on me, hostile, detecting me. */
const rec = (over = {}, ai = {}) => ({ mobileType: M.Orc, gender: 'male', archive: null, dead: false, entity: orc(), ai: { isHostile: true, detected: true, targetIsLocalPlayer: true, ...ai }, ...over });
const T0 = 1_000_000;

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setAvoidDeathHook(null); H._resetHarmMarkForTests();
});

/** The fight a rout reads: `f`'s harm on me at T0, a hurt under half at T0 + 1 s. */
function fought(f, { low = true, at = T0 } = {}) {
  H.markPlayerHarm(f.entity, { now: at });
  if (low) H.markPlayerLow(at + 1000);
}

// ── the law ─────────────────────────────────────────────────────────

test('RVN10 THE LAW: 70 m and under half; a fight carried on a harm within 30 s; the two epithet banks, the companion named (mutants: any number moved; a bank changed)', () => {
  assert.deepEqual({ ...F.ROUT }, { DISTANCE: 70, LOW: 0.5 });
  assert.equal(H.HARM_FIGHT_MS, 30000);
  assert.deepEqual([...N.REVENANT_EPITHETS.felled], ['Bane of {a}', 'the Companion-Killer', 'Breaker of Oaths']);
  assert.deepEqual([...N.REVENANT_EPITHETS.routed], ['Who Made {p} Run', 'the Pursuer']);
  assert.equal(N.revenantEpithet('felled', 1, 'Ayla', () => 0, null, 'Borgakh'), 'Bane of Borgakh', 'the companion by name');
  assert.equal(N.revenantEpithet('felled', 1, 'Ayla', () => 0), 'the Companion-Killer', 'no name: an epithet naming one passed over');
  assert.equal(N.revenantEpithet('routed', 1, 'ayla stormwind', () => 0), 'Who Made Ayla Run');
  assert.ok(N.REVENANT_EPITHETS.risen.map((e) => e.replace('{p}', 'Ayla')).includes(N.revenantEpithet('felled', 3, 'Ayla', () => 0, null, 'Borgakh')), 'from rank 3 the risen, whatever the deed');
});

// ── felled ──────────────────────────────────────────────────────────

test('RVN10 FELLED: the deed on its striker, the companion named on the deed and in its epithet; it stands out; no kill and no escape counted; a revenant already ranks up (mutants: not out; an escape counted; the name dropped)', () => {
  const p = me();
  const by = rec();
  const r = N.revenantFelled(p, by, 'Borgakh', { now: 500, rolls: () => 0 });
  assert.ok(r, 'made');
  assert.equal(r.epithet, 'Bane of Borgakh');
  assert.equal(r.name, `${r.given}, Bane of Borgakh`);
  assert.deepEqual(r.history.at(-1), { deed: 'felled', at: 500, ally: 'Borgakh' });
  assert.equal(r.out, true, 'it still stands');
  assert.deepEqual([r.kills, r.escapes, r.notice], [0, 0, null]);
  assert.equal(by.entity.revenant.id, r.id, 'the striker wears its name at once');
  const again = N.revenantFelled(p, by, 'Aldric', { now: 600, rolls: () => 0 });
  assert.equal(again, r);
  assert.equal(r.rank, 2, 'a revenant already ranks up');
  assert.equal(r.epithet, 'Bane of Aldric', 'never the one it wears');
});

test('RVN10 FELLED\'S GATES: no striker, a striker dead or down, a companion unnamed, a plain foe, an ally, the switch off - no deed (mutants: each gate dropped)', () => {
  const p = me();
  assert.equal(N.revenantFelled(p, null, 'Borgakh'), null, 'a spell\'s knock-out names no striker');
  assert.equal(N.revenantFelled(p, rec({ dead: true }), 'Borgakh'), null, 'dead');
  assert.equal(N.revenantFelled(p, rec({ entity: orc({ health: 0 }) }), 'Borgakh'), null, 'down');
  assert.equal(N.revenantFelled(p, rec(), '  '), null, 'unnamed');
  assert.equal(N.revenantFelled(p, rec({ entity: orc({ champion: undefined }) }), 'Borgakh'), null, 'a plain foe');
  assert.equal(N.revenantFelled(p, rec({ entity: orc({ team: 'PlayerAlly' }) }), 'Borgakh'), null, 'my own ally');
  setPref('lootRarity', false);
  assert.equal(N.revenantFelled(p, rec(), 'Borgakh'), null, 'off');
  assert.equal(N.allRevenants().length, 0);
});

test('RVN10 FELLED, THE DOORS: the knock-out arm of both damage doors notes the blow that knocked him down (never a later one); the layer hands it on; the world\'s two parties make the deed and tell it (mutants: unnoted; a later blow renamed; unhanded; unwired)', async () => {
  for (const [file, v] of [['src/scenes/exteriorFoes.js', 'f'], ['src/scenes/dungeonContext.js', 'foe']]) {
    assert.match(read(file), new RegExp(`if \\(${v}\\.companion != null\\) \\{ ${v}\\.entity\\.health = 1; if \\(!${v}\\._knockedOut\\) ${v}\\._knockedBy = striker; ${v}\\._knockedOut = true; return; \\}`), file);
  }
  // the layer, run: his body knocked out by a striker - onKnocked hears him and it
  const party = createCompanions();
  party.take(7, { name: 'Borgakh', role: 'Bosun', mobile: 144, gender: 'male' }, 0);
  const pool = { key: 'street', live: [] };
  pool.spawn = (mobile, feet, o) => { const r = { mobile, ai: { feet: [...feet], yaw: o.yaw }, entity: { health: 40, maxHealth: 40 }, dead: false }; pool.live.push(r); return Promise.resolve(r); };
  pool.remove = (r) => { r.dead = true; pool.live = pool.live.filter((x) => x !== r); };
  pool.has = (r) => pool.live.includes(r);
  const heard = [];
  const layer = createCrewAshore({ party: () => party, place: () => pool, leader: () => ({ feet: [0, 0, 0], yaw: 0, grounded: true }), now: () => 0, onKnocked: (c, by) => heard.push([c.name, by]) });
  layer.frame(); await new Promise((r) => setImmediate(r));
  const body = pool.live[0];
  const striker = rec();
  body._knockedOut = true; body._knockedBy = striker;
  layer.frame();
  assert.deepEqual(heard, [['Borgakh', striker]]);
  const w = read('src/scenes/world.js');
  assert.match(w, /onKnocked: \(c, by\) => \{ naval\?\.companionKnocked\?\.\(c\); felledBy\(by, c\.name\); \}/, 'the crew: the hand by his name');
  assert.match(w, /felledBy\(by, revenantRecord\(playerEntity, c\.name\)\?\.given \?\? null\);/, 'the sworn: its given name');
  assert.match(w, /const felledBy = \(by, ally\) => \{\n\s*const r = by \? revenantFelled\(playerEntity, by, ally\) : null;\n\s*if \(r\) revenantSay\(revenantFelledEvent\(r, ally, /);
});

// ── the fight ───────────────────────────────────────────────────────

test('RVN10 THE FIGHT: a foe\'s harm opens its fight and carries it on within 30 s; past that a new one opens; the low counts from the fight\'s start; a judged foe\'s fight ends (mutants: the fight never carried; never lapsed; a low before the fight counted)', () => {
  const e = orc();
  assert.equal(H.harmFightSince(e, T0), null, 'no harm, no fight');
  H.markPlayerHarm(e, { now: T0 });
  H.markPlayerHarm(e, { now: T0 + 20000 });
  assert.equal(H.harmFightSince(e, T0 + 20000), T0, 'carried on');
  assert.equal(H.harmFightSince(e, T0 + 50000), T0, 'its last harm 30 s ago: still on');
  assert.equal(H.harmFightSince(e, T0 + 50001), null, 'lapsed');
  H.markPlayerHarm(e, { now: T0 + 51000 });
  assert.equal(H.harmFightSince(e, T0 + 51000), T0 + 51000, 'a new fight');
  H.markPlayerLow(T0 + 50999);
  assert.equal(H.playerLowSince(T0 + 51000), false, 'a low before it is not this fight\'s');
  H.markPlayerLow(T0 + 51000);
  assert.equal(H.playerLowSince(T0 + 51000), true, 'from its start');
  assert.equal(H.playerLowSince(null), false);
  H.clearPlayerHarm(e);
  assert.equal(H.harmFightSince(e, T0 + 51000), null, 'judged: its fight over');
  const o = orc();
  H.markPlayerHarm(o, { now: T0 });
  H.endPlayerFights();
  assert.deepEqual([H.harmFightSince(o, T0), H.playerLowSince(T0)], [null, false], 'every fight ended: its start and the low both gone');
});

test('RVN10 THE LOW, THROUGH THE REAL HURT: a hurt that leaves me under half is the low (at half, not); my death ends every fight; a load ends them (mutants: the low unmarked; at half counted; the death\'s end dropped; the load\'s)', () => {
  const p = me();
  const f = rec();
  H.markPlayerHarm(f.entity);
  hurtPlayer(p, 50);
  assert.equal(N.revenantRoutable(f), false, 'at half: not under it');
  hurtPlayer(p, 1);
  assert.equal(N.revenantRoutable(f), true, 'under half');
  hurtPlayer(p, 100);
  assert.equal(N.revenantRoutable(f), false, 'my death: every fight over');
  const q = me('char-rvn10b');
  H.markPlayerHarm(f.entity);
  hurtPlayer(q, 60);
  assert.equal(N.revenantRoutable(f), true);
  restoreModSaveRecords(modSaveRecords());
  assert.equal(N.revenantRoutable(f), false, 'a load: no fight carried over');
});

// ── routed ──────────────────────────────────────────────────────────

test('RVN10 ROUTABLE\'S GATES: a special foe of mine, alive, hostile, detecting me and on me, neither kneeling nor running, its fight live and low (mutants: each gate dropped)', () => {
  const ok = rec();
  fought(ok);
  assert.equal(N.revenantRoutable(ok, { now: T0 + 2000 }), true);
  const each = {
    dead: rec({ dead: true }), down: rec({ entity: orc({ health: 0 }) }), routed: rec({ _routed: true }), kneeling: rec({ yielded: {} }),
    running: rec({ fleeing: true }), calm: rec({}, { isHostile: false }), unaware: rec({}, { detected: false }), onAPeer: rec({}, { targetIsLocalPlayer: false }),
    plain: rec({ entity: orc({ champion: undefined }) }), quest: rec({ questBehaviour: {} }), noAi: rec({ ai: null }),
  };
  for (const [k, f] of Object.entries(each)) { fought(f); assert.equal(N.revenantRoutable(f, { now: T0 + 2000 }), false, k); }
  const lapsed = rec(); fought(lapsed);
  assert.equal(N.revenantRoutable(lapsed, { now: T0 + 30001 }), false, 'its harm older than 30 s');
  H.endPlayerFights();   // the low is the player's, not the foe's - none yet
  const high = rec(); fought(high, { low: false });
  assert.equal(N.revenantRoutable(high, { now: T0 + 2000 }), false, 'never under half');
  const unharmed = rec(); H.markPlayerLow(T0);
  assert.equal(N.revenantRoutable(unharmed, { now: T0 + 2000 }), false, 'it never reached me');
  setPref('lootRarity', false);
  assert.equal(N.revenantRoutable(ok, { now: T0 + 2000 }), false, 'off');
});

test('RVN10 ROUTED: the deed (no escape counted, not out), my name in its epithet, and Relentless learned before its leading scar; marked so it is asked once (mutants: out; an escape counted; the lesson by order; unmarked)', () => {
  const p = me();
  const f = rec();
  const r = N.revenantRouted(p, f, { now: 700, rolls: () => 0 });
  assert.equal(f._routed, true);
  assert.equal(r.history.at(-1).deed, 'routed');
  assert.equal(r.epithet, 'Who Made Ayla Run');
  assert.deepEqual([r.out, r.kills, r.escapes], [false, 0, 0]);
  assert.deepEqual(r.learned, ['relentless']);
  assert.equal(F.lessonOf(['blade', 'routed'], [], M.Orc), 'relentless', 'before the blade');
  assert.equal(F.lessonOf(['blade', 'routed'], ['relentless'], M.Orc), 'mailed', 'held: the lesson passes on');
  assert.equal(F.lessonOf(['blade'], [], M.Orc), 'mailed', 'no rout: as ever');
  fought(f);
  assert.equal(N.revenantRoutable(f, { now: T0 + 2000 }), false, 'asked once');
});

test('RVN10 THE JUMP\'S SWEEP: the engaged specials of the pool I leave routed, each once; the rest untouched (mutants: everyone routed; a second sweep routs again)', () => {
  const p = me();
  const a = rec(), b = rec(), calm = rec({}, { detected: false });
  fought(a); H.markPlayerHarm(b.entity, { now: T0 }); fought(calm);
  const out = N.revenantRoutSweep(p, [a, b, calm, null], { wall: T0 + 2000, rolls: () => 0 });
  assert.deepEqual(out.map((x) => x.f), [a, b]);
  assert.ok(out.every((x) => x.r.history.at(-1).deed === 'routed'));
  assert.deepEqual(N.revenantRoutSweep(p, [a, b, calm], { wall: T0 + 2000 }), [], 'once');
  setPlayerDoor({ foes: () => [calm] });
  assert.deepEqual(N.revenantRoutSweep(p), [], 'the door\'s pool by default');
});

test('RVN10 THE HOSTS: the street pool routs past 70 m before its cull, gone as the cull takes a foe and told; a jump routs (never a load\'s) before the sweep, a Recall before a mode\'s teardown (both hosts that cast one); the respawn ends every fight first (mutants: each seam unwired; the load routing)', () => {
  const x = read('src/scenes/exteriorFoes.js');
  const at = x.indexOf('if (_playerDist > ROUT.DISTANCE && revenantRoutable(f)) { routFoe(f); continue; }');
  assert.ok(at > 0 && at < x.indexOf('if (!f.placed && !f.managed && _playerDist > _cullAt'), 'before the cull');
  assert.match(x, /function routFoe\(f\) \{\n\s*scatterBand\(f\);\n\s*releaseFoeBatch\(f\);\n\s*f\.dead = true;\n\s*f\.escaped = true;\n\s*if \(f\.ai\?\.detected\) setEnemyAlert\(playerEntity, false\);\n\s*const r = revenantRouted\(playerEntity, f\);\n\s*if \(r\) revenantSay\(revenantRoutedEvent\(r, \{ archive: f\.archive \}\), say\);/);
  const w = read('src/scenes/world.js');
  const tp = w.slice(w.indexOf('async function _teleportToPixel('));
  assert.ok(tp.indexOf("if (modEvent !== 'load') routByJump();") < tp.indexOf('exteriorFoes.clearLive();') && tp.indexOf("if (modEvent !== 'load') routByJump();") > 0, 'the teleport, before its sweep');
  const rc = w.slice(w.indexOf('async function recallToAnchor()'));
  assert.ok(rc.indexOf('routByJump();') > 0 && rc.indexOf('routByJump();') < rc.indexOf('modes?.forceExitToExterior('), 'the Recall, before the mode\'s teardown');
  assert.ok(rc.indexOf("if (plan.kind === 'same-interior')") < rc.indexOf('routByJump();'), 'a Recall within the same room leaves no pool');
  assert.match(w, /function routByJump\(\) \{\n\s*for \(const \{ r, f \} of revenantRoutSweep\(playerEntity\)\) revenantSay\(revenantRoutedEvent\(r, /);
  assert.match(w, /_respawning = true;\n\s*endPlayerFights\(\);/, 'the respawn: every fight over before its jump');
  // the single-location host: its Recall leaves a mode's pool only (the street stays - the distance judges a jump in it)
  const e = read('src/scenes/exterior.js');
  const er = e.slice(e.indexOf('async function recallToAnchor()'));
  assert.match(er, /if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) \{\n(?:\s*\/\/[^\n]*\n)*\s*for \(const \{ r, f \} of revenantRoutSweep\(playerEntity\)\) revenantSay\(revenantRoutedEvent\(r, [^\n]*\n\s*modes\?\.forceExitToExterior\(/, 'exterior.js: before the mode\'s teardown');
});

// ── the words, the save ─────────────────────────────────────────────

test('RVN10 THE CARDS, THE PAGE, THE SAVE: Felled and Routed told; the page says the companion by name; the ally rides the save, trimmed, a bad one dropped (mutants: a kicker missing; the page\'s name dropped; the ally unsaved)', () => {
  const p = me();
  const r = N.revenantFelled(p, rec(), 'Borgakh', { now: 500, rolls: () => 0 });
  const ev = N.revenantFelledEvent(r, 'Borgakh');
  assert.deepEqual([ev.kind, ev.kicker, ev.body, ev.line], ['felled', 'Felled', `${r.given} felled Borgakh. It will remember this.`, `${r.name} felled Borgakh.`]);
  r.rank = 3;
  assert.equal(N.revenantFelledEvent(r, 'Borgakh').body, `${r.given} felled Borgakh. Now rank III - it will remember this.`);
  assert.equal(N.revenantFelledEvent(r, null).line, `${r.name} felled your companion.`);
  const q = N.revenantRouted(p, rec(), { now: 600, rolls: () => 0 });
  const rv = N.revenantRoutedEvent(q);
  assert.deepEqual([rv.kind, rv.kicker, rv.body], ['routed', 'Routed', `You ran from ${q.given}. It will remember this.`]);
  q.rank = 2;
  assert.equal(N.revenantRoutedEvent(q).body, `You ran from ${q.given}. Now rank II - it will remember this.`);
  assert.equal(historyWords({ deed: 'felled', at: 1, ally: 'Borgakh' }), 'felled Borgakh');
  assert.equal(historyWords({ deed: 'felled', at: 1 }), 'felled your companion');
  assert.equal(historyWords({ deed: 'routed', at: 1 }), 'routed you');
  // the save: the ally kept, a long one trimmed, a bad one dropped
  r.history.push({ deed: 'felled', at: 9, ally: 'X'.repeat(60) }, { deed: 'felled', at: 10, ally: 7 });
  restoreModSaveRecords(modSaveRecords());
  const back = N.revenantsFor(p).find((x) => x.id === r.id);
  assert.deepEqual(back.history.filter((d) => d.deed === 'felled'), [{ deed: 'felled', at: 500, ally: 'Borgakh' }, { deed: 'felled', at: 9, ally: 'X'.repeat(40) }, { deed: 'felled', at: 10 }]);
});
