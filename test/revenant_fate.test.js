// REVENANT-FATE + REVENANT-TROPHY (2026-10-02, Mac: "Players should have the option to kill or spare. Killing should
// show a unique animation where you destroy your foe, which drops a unique weapon random rarity weapon specific to the
// enemy, with their name included in the weapon name. Spare should allow you to free the enemy, which then adds them as
// a companion"; "the choice popup should reuse the loot menu").
//
// The trophy's law (its kind's or its own weapon, named for it, never Common, better with rank); the choice's model;
// THE REAL OPEN-WORLD POOL on crafted careers: a beaten revenant yields (held at 1, untouchable, nobody's target), its
// choice opens, KILL plays the execution and drops the pile with the trophy, SPARE swears it and takes it through a
// portal, hesitation lets it slip away; the wire carries the kneel and the burning; the loot window's FATE side.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
const N = await import('../src/systems/revenant.js');
const T = await import('../src/systems/revenantTrophy.js');
const F = await import('../src/systems/revenantFate.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { createExteriorFoes } = await import('../src/scenes/exteriorFoes.js');
const { validFoeRecord } = await import('../src/net/wire.js');
const { fateColumn, fateKey } = await import('../src/ui/revenantFateView.js');
const { remoteModel, REMOTE_TITLE } = await import('../src/ui/enhancedInventory.js');
const { WEAPONS_ENUM: W } = await import('../src/combat/enemyEquipment.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const player = (id = 'char-fate') => ({
  isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [],
  activeEffects: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, crimeCommitted: 4,
  health: 100, maxHealth: 100,
});
function fresh() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  // the module registered its own count at import - the reset forgot it; say it again
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
}
/** A record as a special foe's flight makes it. */
function revenantOf(me, { mobileType = 2, rank = 1 } = {}) {
  const r = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType, rolls: () => 0 });
  r.rank = rank;
  return r;
}

// ── the crafted world (test/elitefloor_foetitle.test.js's): one monster career, a texture stub ──────────────────
const careers = (() => {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  const NAME_FIELD = 14, ENTRY = 18, out = new Uint8Array(4 + b.length + ENTRY), dv = new DataView(out.buffer);
  dv.setInt16(0, 1, true); dv.setUint16(2, 0x0100, true); out.set(b, 4);
  const name = 'ENEMY002.CFG';
  for (let i = 0; i < name.length; i++) out[4 + b.length + i] = name.charCodeAt(i);
  dv.setInt32(4 + b.length + NAME_FIELD, b.length, true);
  return out;
})();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20, getFrameCount: () => 5 };
function rig(me, { fates = true } = {}) {
  const drops = [], shakes = [], said = [], made = [];
  const renderer = {
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, conceal: undefined, dissolve: undefined, origin: null }; made.push(b); return b; },
    destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(),
    uploadTexture: () => ({}), uploadEmissionTexture: () => ({}),
  };
  const pool = createExteriorFoes({
    renderer,
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: me, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: (l) => said.push(l),
    fates, dropLoot: (items, feet) => drops.push({ items, feet }), shake: (k) => shakes.push(k),
  });
  return { pool, drops, shakes, said, made };
}
const frame = (pool, dt = 0.016) => pool.update(dt, [0, 0, 3], [0, 1.6, 3]);

// ── THE TROPHY ─────────────────────────────────────────────────────────────────────────────────────────────────
test('REVENANT-TROPHY its weapon, named for it: its kind\'s (an orc an axe, a lich a staff), a person\'s by class, the blade it carried first; "<given>\'s <noun>", the same every time; never Common, the better tiers likelier with rank (mutants: the carried blade ignored; the name without its owner; a Common trophy; the rank unread)', () => {
  fresh();
  setPref('lootRarity', true);
  const orc = { id: 'orc-1', given: 'Grushnak', mobileType: MOBILE_TYPES.Orc, rank: 1 };
  assert.ok([W['War Axe'], W['Battle Axe']].includes(T.trophyTemplate(orc)), 'an orc\'s axe');
  assert.equal(T.trophyTemplate({ id: 'l', mobileType: MOBILE_TYPES.Lich }), W.Staff, 'a lich\'s staff');
  assert.equal(T.trophyTemplate({ id: 'b', mobileType: MOBILE_TYPES.Barbarian }), W.Claymore, 'a Barbarian\'s claymore');
  assert.equal(T.trophyTemplate({ id: 'a', mobileType: MOBILE_TYPES.Assassin }), W.Tanto, 'an Assassin\'s tanto');
  const carrying = { items: [{ group: 'Weapons', templateIndex: W.Dagger, value: 10 }, { group: 'Weapons', templateIndex: W.Katana, value: 900 }, { group: 'Weapons', templateIndex: 131, value: 9999 }] };
  assert.equal(T.trophyTemplate(orc, carrying), W.Katana, 'the best blade it carried (never an arrow)');
  assert.equal(T.trophyName(orc, W['War Axe']), T.trophyName(orc, W['War Axe']), 'one revenant, one name');
  assert.match(T.trophyName(orc, W['War Axe']), /^Grushnak's (Reaver|Axe)$/);
  assert.equal(T.trophyName({ id: 'x', given: 'Varis' }, W.Dagger).startsWith("Varis' "), true, 'a name in s takes the apostrophe alone');
  for (let i = 0; i < 40; i++) {
    const it = T.revenantTrophy({ ...orc, id: `orc-${i}` }, { level: 12, rolls: Math.random });
    assert.ok(it && it.group === 'Weapons', 'a weapon');
    assert.ok(['magic', 'rare', 'legendary'].includes(it.rarity), `never Common (${it.rarity})`);
    assert.match(it.name, /^Grushnak's /, 'its owner\'s name in it');
    assert.match(T.trophyKindWords(it), /^(Magic|Rare|Legendary) (War Axe|Battle Axe)$/);
  }
  let low = 0, high = 0;
  for (let i = 0; i < 4000; i++) { const x = (i + 0.5) / 4000; if (T.trophyRarity(1, () => x) !== 'magic') low++; if (T.trophyRarity(5, () => x) !== 'magic') high++; }
  assert.ok(high > low, `rank five likelier better (${high} vs ${low})`);
  assert.equal(T.trophyRarity(1, () => 0), 'legendary'); assert.equal(T.trophyRarity(1, () => 0.99), 'magic');
});

// ── THE POOL: yield, kill ──────────────────────────────────────────────────────────────────────────────────────
test('REVENANT-FATE the real pool: a revenant\'s death blow leaves it KNEELING - at 1, its trophy rolled, its plea said, its record\'s deed; no blow lands after, no foe targets it, the save leaves it out; activated, its choice is the loot window\'s model (mutants: it dies as before; a blow kills it kneeling; a foe still hunts it)', async () => {
  fresh();
  const me = player();
  const r = revenantOf(me);
  const { pool, said } = rig(me);
  const f = await pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  assert.ok(f.entity.revenant?.id === r.id, 'it stands as the revenant');
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(f.dead, false, 'beaten, not dead');
  assert.ok(f.yielded, 'it yields');
  assert.equal(f.entity.health, 1);
  assert.ok(f.trophy && /^[A-Z][^']*'s? /.test(f.trophy.name), 'its trophy rolled at the yield');
  assert.equal(N.revenantById(r.id).history.at(-1).deed, 'yielded');
  assert.ok(said.some((l) => l.startsWith(r.name)), 'its plea said');
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(f.entity.health, 1, 'kneeling, it takes no blow');
  assert.match(read('src/characters/enemyTargets.js'), /if \(c === self \|\| \(targetAi && targetAi === ai\)\) continue;\n[^\n]*\n[^\n]*\n\s*if \(!isPlayer && \(c\.yielded \|\| c\.executing \|\| c\.sparing \|\| c\.leaving\)\) continue;/, 'nobody hunts a kneeling one (nor a body in its portal)');
  assert.equal(pool.snapshotWorld((p) => ({ x: p[0], z: p[2] })).length, 0, 'never in the save');
  const m = pool.fateFor(f);
  assert.equal(m.kind, 'fate'); assert.equal(m.name, r.name); assert.deepEqual(m.options.map((o) => o.id), ['kill', 'spare']);
  assert.equal(m.trophy, f.trophy, 'KILL shows the very weapon it will drop');
  assert.match(m.options[0].detail, new RegExp(`It drops ${f.trophy.name.replace(/[.*+?^${}()|[\]\\']/g, '\\$&')}`));
  assert.equal(m.live(), true);
});

test('REVENANT-FATE KILL: the execution - its last words, the blow felt, then the burst (blood, a harder kick) and the body burning away in embers from the feet up; done, it is gone with NO body and its pile drops where it knelt, its trophy in it; its record closed, executed (mutants: no pile; the trophy left out; a body left; the record open)', async () => {
  fresh();
  const me = player();
  const r = revenantOf(me);
  const { pool, drops, shakes, made } = rig(me);
  const f = await pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  frame(pool);
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  const trophy = f.trophy;
  const carried = f.entity.items.length;
  assert.equal(pool.chooseFate(f, 'kill'), true);
  assert.ok(f.executing && !f.yielded, 'the execution begun');
  assert.deepEqual(shakes, [1.4], 'the blow felt');
  frame(pool);
  assert.equal(F.fateDissolve(f, Date.now()), null, 'whole until the burst');
  f.executing.at -= F.EXECUTION_MS.burst + 10;
  frame(pool);
  assert.ok(f.executing.burst, 'the burst');
  assert.deepEqual(shakes, [1.4, 3], '...a harder kick');
  pool.batches();
  assert.ok(f.batch.dissolve && f.batch.dissolve[0] > 0 && f.batch.dissolve[1] === 1, 'burning away in ember');
  f.executing.at -= F.EXECUTION_MS.end;
  frame(pool);
  assert.equal(f.dead, true); assert.equal(f.executed, true);
  assert.equal(f.corpse, undefined, 'no body');
  assert.equal(drops.length, 1, 'one pile');
  assert.ok(drops[0].items.includes(trophy), 'its trophy in the pile');
  assert.ok(drops[0].items.length >= carried + 1, 'and all it carried');
  const rec = N.revenantById(r.id);
  assert.equal(rec.defeated, true); assert.equal(rec.fate, 'executed'); assert.equal(rec.history.at(-1).deed, 'executed');
  assert.ok(made.length > 0);
});

test('REVENANT-FATE SPARE: sworn - at the player\'s side while a slot is free (else away), the kneeling body gathers into a portal and is gone; never in the hunt again, never returning; full retinue: the row is refused (mutants: the sworn left hunting; the slots unread; the spare when the retinue is full)', async () => {
  fresh();
  const me = player();
  const r = revenantOf(me);
  const { pool, made } = rig(me);
  const f = await pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(pool.fateFor(f).options[1].disabled, false);
  assert.match(pool.fateFor(f).options[1].detail, /joins you as a companion \(1 of 3\)/);
  assert.equal(pool.chooseFate(f, 'spare'), true);
  const rec = N.revenantById(r.id);
  assert.equal(rec.sworn, true); assert.equal(rec.fate, 'sworn'); assert.equal(rec.companion.state, 'with');
  assert.ok(!N.livingRevenants().includes(rec), 'it hunts nobody');
  assert.ok(made.some((b) => b.archive === 'fxportal'), 'a portal opens where it knelt');
  f.sparing.at -= F.SPARING_MS + 10;
  frame(pool);
  assert.equal(f.dead, true, 'through the portal');
  assert.equal(N.revenantToReturn(me, { now: 1e9, rolls: () => 0 }), null, 'a sworn one never returns as a foe');
  // the slots full: a second spared one waits away
  S.registerCompanionCount('crew', () => 2);
  const r2 = revenantOf(me);
  const g = await pool.spawnFoe(2, [2, 0, 0], { feetGiven: true, level: 6, revenant: r2 });
  pool.damageFoe(g, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.match(pool.fateFor(g).options[1].detail, /waits until you call it/);
  pool.chooseFate(g, 'spare');
  assert.equal(N.revenantById(r2.id).companion.state, 'away', 'no slot: away');
  // the retinue full: the row refused
  for (let i = 0; i < RC.REVENANT_RETINUE_MAX; i++) { const x = revenantOf(me); N.revenantSpared(me, { revenant: { id: x.id } }, { state: 'away' }); }
  const r3 = revenantOf(me);
  const h = await pool.spawnFoe(2, [4, 0, 0], { feetGiven: true, level: 6, revenant: r3 });
  pool.damageFoe(h, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(pool.fateFor(h).options[1].disabled, true, 'no room in the retinue');
  assert.equal(pool.chooseFate(h, 'spare'), false);
  S.registerCompanionCount('crew', null);
});

test('REVENANT-FATE HESITATION: kneeling past its wait (the world\'s own time - a window that pauses holds it), or the player walking off, it SLIPS AWAY - an escape, its rank up, its words about the hesitation (mutants: the wait on the wall clock; no slip)', async () => {
  fresh();
  const me = player();
  const r = revenantOf(me);
  const { pool, said } = rig(me);
  const f = await pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  const rank = N.revenantById(r.id).rank;
  f.yielded.at -= F.REVENANT_YIELD_MS * 2;   // the wall clock alone moves nothing
  frame(pool);
  assert.ok(f.yielded && !f.dead, 'still kneeling: no world time passed');
  pool.update(F.REVENANT_YIELD_MS / 1000 + 1, [0, 0, 3], [0, 1.6, 3]);
  assert.equal(f.dead, true); assert.equal(f.escaped, true);
  assert.equal(N.revenantById(r.id).rank, rank + 1, 'its rank up');
  assert.ok(said.some((l) => l.startsWith(r.name)), 'its words');
  const g = await pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: N.revenantById(r.id) });
  pool.damageFoe(g, 99999, [0, 0, 3], null, { fromPlayer: true });
  pool.update(0.016, [0, 0, F.REVENANT_YIELD_REACH + 5], [0, 1.6, 3]);
  assert.equal(g.escaped, true, 'walked off: it slips away');
});

test('REVENANT-FATE no door, no yield; a kill is a kill; a puppet and a companion never yield (mutants: a host without the window still kneels them; a Disintegrate held)', async () => {
  fresh();
  const me = player();
  const r = revenantOf(me);
  const { pool } = rig(me, { fates: false });
  const f = await pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(f.dead, true, 'a host that cannot open the choice: it dies as ever');
  const { pool: p2 } = rig(me);
  const g = await p2.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: revenantOf(me) });
  p2.damageFoe(g, 99999, [0, 0, 3], null, { fromPlayer: true, whole: true });
  assert.equal(g.dead, true, 'a kill is a kill');
  assert.equal(F.revenantMayYield({ entity: { revenant: { id: 'x' } }, puppet: 'peer' }), false);
  assert.equal(F.revenantMayYield({ entity: { revenant: { id: 'x' } }, companion: 'rv:x' }), false);
});

// ── the wire, the activation, the hosts ────────────────────────────────────────────────────────────────────────
test('REVENANT-FATE the wire and the doors: a record says `yd` kneeling and `ex` burning (1 or absent); the pool writes both, a puppet kneels and burns from them; activating a kneeling one opens its choice at the treasure\'s reach; every host hands its door (mutants: a bad flag let through; the puppet standing; the door unasked)', () => {
  assert.deepEqual(validFoeRecord({ i: 3, yd: 1, ex: 1 }), { i: 3, yd: 1, ex: 1 });
  assert.equal(validFoeRecord({ i: 3, yd: 2 }), null);
  assert.equal(validFoeRecord({ i: 3, ex: true }), null);
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /\.\.\.\(f\.yielded \? \{ yd: 1 \} : \{\}\), \.\.\.\(f\.executing \? \{ ex: 1 \} : \{\}\)/);
  assert.match(x, /f\._pupYield = r\.yd === 1;/);
  assert.match(x, /if \(\(f\._pupYield \|\| f\._pupExec\) && f\.mobile\.heldPose\) f\._mout = f\.mobile\.heldPose\('hurt', -1/);
  const act = read('src/player/mobileEnemyActivate.js');
  assert.match(act, /if \(foe\.yielded && !foe\.puppet && openFate\) \{\n\s*if \(!\(distance <= TREASURE_ACTIVATION_DISTANCE\)\) \{ midScreen\?\.\(TOO_FAR_AWAY_TEXT\); return true; \}[^\n]*\n\s*openFate\(foe\);/);
  const w = read('src/scenes/world.js'), m = read('src/scenes/worldModes.js'), d = read('src/scenes/dungeonContext.js');
  assert.match(w, /openFate: \(rec\) => openRevenantFate\(rec\),/, 'the street');
  assert.equal((m.match(/openFate: \(rec\) => !!host\.openRevenantFate\?\.\(rec\),/g) ?? []).length, 2, 'a building and a dungeon');
  assert.match(w, /const w = makeInventoryWindow\(\{ fate: model, loot: \{ items: \(\) => \[\], playerOwned: false \} \}\);/, 'the loot window itself');
  // PIN MOVED (RVN3: an unbroken will tears away instead - the same gate)
  assert.match(d, /if \(opts\.fates && !_whole && \(!onlineRoom\(\) \|\| !isRoomFoe\(foe\)\) && revenantMayYield\(foe\)\) \{ if \(revenantWillHolds\(foe\)\) tearAwayDungeonFoe\(foe\); else yieldDungeonFoe\(foe\); return; \}/, 'underground: the player\'s alone');
  // underground a held foe decides nothing and animates nothing of its own, but is still DRAWN - the kneel, the burn
  const arm = d.slice(d.indexOf('      if (f.mobile) {\n'), d.indexOf('_mobileBatches.push(f.batch);'));
  assert.match(arm, /^      if \(f\.mobile\) \{\n[\s\S]*?\n        if \(!_fateHeld\) \{[^\n]*\n\s*\/\/ A5 - DaedraSeducerMobileBehaviour/, 'the mobile arm draws a held foe; only its own update is skipped');
  assert.match(arm, /const _dv = f\.executing \|\| f\.sparing \|\| f\.portalFx \? fateDissolve\(f, Date\.now\(\)\) : null;/, 'and burns it away as it draws');
});

// ── THE LOOT WINDOW'S FATE SIDE ────────────────────────────────────────────────────────────────────────────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '',
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const byClass = (root, cls) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.classList?.contains(cls)) out.push(c); walk(c); } }; walk(root); return out; };

test('REVENANT-FATE the loot window\'s FATE side: the loot frame\'s own head (its name, what it is, its personality), its plea, KILL a row of the trophy as a looted weapon\'s tile and SPARE a row of its portrait; a pick asks to confirm, a second press does it; K, S, Enter and Back (mutants: one click decides; the trophy\'s tile not drawn; Back closes over a pick)', () => {
  const chosen = [], picks = [], tiles = [];
  const model = {
    kind: 'fate', name: 'Grushnak the Butcher', sub: 'Rank II · Orc', mood: 'Witty', plea: { speech: 'I concede.', body: null }, portrait: null,
    trophy: { name: "Grushnak's Reaver" },
    options: [
      { id: 'kill', key: 'K', label: 'Kill', verb: 'Execute', tone: 'warn', title: 'Kill Grushnak', detail: "It drops Grushnak's Reaver - Rare War Axe", confirm: 'Destroy it?', disabled: false },
      { id: 'spare', key: 'S', label: 'Spare', verb: 'Spare', tone: 'primary', title: 'Spare Grushnak', detail: 'It joins you', confirm: 'Spare it?', disabled: false },
    ],
  };
  const kit = { el, trophyTile: (row, item) => { tiles.push(item); row.append(el('span', 'tile')); }, portrait: () => false, onPick: (id) => picks.push(id), onChoose: (id) => chosen.push(id) };
  let col = fateColumn(model, null, kit);
  assert.equal(byClass(col, 'remotehead').length, 1, 'the loot frame\'s head');
  assert.match(byClass(col, 'remotewho')[0].textContent, /Grushnak the Butcher/);
  assert.equal(byClass(col, 'fate-mood')[0].textContent, 'Witty');
  assert.equal(byClass(col, 'fate-plea')[0].textContent, '“I concede.”');
  const rows = byClass(col, 'itemrow');
  assert.equal(rows.length, 2, 'two rows, the loot list\'s own');
  assert.deepEqual(tiles, [model.trophy], 'KILL drawn as the looted weapon is');
  assert.equal(byClass(rows[1], 'fate-face').length, 1, 'SPARE its portrait\'s well');
  rows[0].onclick();
  assert.deepEqual(picks, ['kill'], 'one click picks');
  assert.deepEqual(chosen, [], '...and decides nothing');
  col = fateColumn(model, 'kill', kit);
  assert.equal(byClass(col, 'fate-confirm').length, 1, 'the pick asks');
  byClass(col, 'itemrow')[0].onclick();
  assert.deepEqual(chosen, ['kill'], 'the second press does it');
  byClass(byClass(col, 'fate-confirm')[0], 'act')[0].onclick();
  assert.deepEqual(chosen, ['kill', 'kill'], 'so does the confirm');
  const keys = [];
  const hooks = { onPick: (id) => keys.push(['pick', id]), onChoose: (id) => keys.push(['choose', id]) };
  assert.equal(fateKey({ key: 's' }, model, null, hooks), true);
  assert.equal(fateKey({ key: 's' }, model, 'spare', hooks), true);
  assert.equal(fateKey({ key: 'Enter' }, model, 'kill', hooks), true);
  assert.equal(fateKey({ key: 'Escape' }, model, 'kill', hooks), true, 'Back steps out of a pick');
  assert.equal(fateKey({ key: 'Escape' }, model, null, hooks), false, '...and with none it is the window\'s (it closes, the foe kneels on)');
  assert.deepEqual(keys, [['pick', 'spare'], ['choose', 'spare'], ['choose', 'kill'], ['pick', null]]);
  assert.equal(REMOTE_TITLE.fate, 'Fate');
  assert.deepEqual(remoteModel({ fate: model, loot: { items: () => [{ name: 'x' }] } }, {}), { kind: 'fate', title: 'Grushnak the Butcher', items: [], count: 0, weight: 0, capacity: null, pile: null }, 'the remote side is the fate, never the body\'s list');
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /if \(remote\.kind === 'fate'\) return fateCol\(\);/);
  assert.match(inv, /loot-win\$\{remote\.count > LOOT_ONE_COLUMN \? ' wide' : ''\}\$\{remote\.kind === 'fate' \? ' fate' : ''\}/, 'the loot window\'s own frame');
  const door = read('src/ui/inventoryDoor.js');
  assert.match(door, /if \(deps\.fate\) return isEnhanced\(\) && typeof document !== 'undefined' \? enhancedInventoryOverlay\(deps\) : classicFateWindow\(deps\.fate\);/, 'the classic skin a keyed box');
  // AUDIT (2026-10-02): the judgement comes before the beast's refusal, on both skins
  assert.ok(door.indexOf('if (deps.fate) return') < door.indexOf('const sup = racialSuppressInventory(deps.entity);'), 'a beast-form player still judges');
});
