// RVN3 - THE WEAKNESS AND THE WILL (bible/12-Enhanced-AI/Feud-Arc.md section 14; Mac, 2026-10-04: "more complex, less
// easy to accomplish and more detailed", then "Go"). Every revenant hides one WEAKNESS, drawn on its id (RVN1): a blow
// of it lands x1.5 (a weapon class, a metal), an element's on the saving throw at -50, the daylight's x1.25 on every
// blow while the sky reads day, and on a wind-up it weighs twice. The first blow of it REVEALS it (the "Weakness" word,
// a hiss, the card); under half its health, unknown, it FLINCHES from it (a hint). From rank 3 its WILL must be broken
// - its weakness struck, or staggered twice in the fight (FEUD BALANCE: once, or a perfect dodge of its blow) - or at the
// killing blow it does not kneel: it TEARS AWAY into
// the smoke, an escape (it ranks up and learns). Disintegrate's kill is a kill.
// Pinned: the law; through the REAL formulas, both landings and the REAL saving throw; the poise door's x2 (a spell's
// element threaded to it); the reveal from the real strike and the real spell landing; the flinch; the will; on the
// REAL street pool the tear-away (held, ashing, escaped, ranked, its words), the kneel once broken, Disintegrate; the
// dungeon's seams and every host's sink; the page.
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
const L = await import('../src/systems/feudLedger.js');
const F = await import('../src/systems/revenantFeud.js');
const FT = await import('../src/systems/revenantFate.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { calculateAttackDamage } = await import('../src/combat/formulas.js');
const { createWeapon } = await import('../src/combat/enemyEquipment.js');
const { makeEnemyEntity } = await import('../src/characters/enemyEntity.js');
const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { WEAPONS: W } = await import('../src/characters/weapons.js');
const { savingThrow, EFFECT_FLAGS } = await import('../src/systems/spellcast.js');
const { computeEntityMods, entityResistMod } = await import('../src/systems/entityMods.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setRevenantPresenter } = await import('../src/systems/revenantVoice.js');
const { createPlayerMagic } = await import('../src/scenes/hostMagic.js');
const { createExteriorFoes } = await import('../src/scenes/exteriorFoes.js');
const { TELL } = await import('../src/ai/tells.js');
const { setTacticsClock, resetTactics, noteLocalPlayer } = await import('../src/ai/tactics.js');
const { liveBlows, resetBlows } = await import('../src/ai/foeBlows.js');
const { windupDoor } = await import('../src/scenes/hostCombat.js');
const { Collider } = await import('../src/player/collider.js');
const { EnemyAI } = await import('../src/characters/enemyMotor.js');
const { EnemyAttack } = await import('../src/characters/enemyAttack.js');
const { MobileUnit } = await import('../src/characters/mobileUnit.js');
const { SOUND } = await import('../src/systems/soundClips.js');
const { weaknessWords, willWords } = await import('../src/ui/revenantPage.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const me = (id = 'char-rvn3') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, reflexes: 2, stats: stats(), skills: new Array(40).fill(40), skillUses: new Array(40).fill(0), career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 100, armorValues: new Array(7).fill(100), crimeCommitted: 4 });
const foe = ({ mobileType = M.Orc, level = 6, plain = false } = {}) => {
  const e = makeEnemyEntity(mobileType, ENEMY_BASICS[mobileType], { ...stats(), attackModifierFlags: 0 }, level, () => 0.5);
  if (!plain) e.champion = 'mighty';
  return e;
};
/** A stand-in revenant of weakness `weak` (its stand's stamp, systems/revenant.js revenantStamp's shape). */
const weakTo = (weak, learned = [], o = {}) => { const e = foe(o); e.revenant = { id: null, name: 'X', rank: 3, learned, weak, edge: F.adaptEdge(learned, weak) }; return e; };
const said = [];
let shown = [];
const NOON = 12 * 60, TWO_AM = 1440 + 120;

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(TWO_AM); said.length = 0; shown = [];
  setRevenantPresenter((ev) => { shown.push(ev); return true; });
});

// ── the law ─────────────────────────────────────────────────────────

test('RVN3 THE LAW: a blow of its weakness - its class, its metal; the daylight\'s every blow by day and none by night; the will broken by its weakness struck or one stagger or perfect dodge (FEUD BALANCE), from rank 3; fourteen flinch lines and names, one a weakness (mutants: a metal unread; the daylight by night; the will\'s line moved; a weakness with no line)', () => {
  assert.deepEqual({ ...F.WEAK }, { STRUCK: 1.5, DAYLIGHT: 1.25, RESIST: -50 });
  assert.equal(F.isWeakBlow('blade', 'blade'), true);
  assert.equal(F.isWeakBlow('blade', 'axe'), false);
  assert.equal(F.isWeakBlow('dwarven', 'blunt', 'dwarven'), true);
  assert.equal(F.isWeakBlow('dwarven', 'blunt', 'elven'), false);
  assert.equal(F.isWeakBlow('fire', 'fire'), true, 'a spell\'s element by its class');
  assert.equal(F.isWeakBlow('daylight', 'blade', null, true), true);
  assert.equal(F.isWeakBlow('daylight', 'blade', null, false), false);
  assert.equal(F.isWeakBlow('nonsense', 'nonsense'), false);
  assert.deepEqual([2, 3, 4, 1, 0].map((m) => F.metalOf({ material: m })), ['silver', 'elven', 'dwarven', null, null]);
  assert.equal(F.metalOf(null), null);
  assert.equal(F.willMatters(2), false);
  assert.equal(F.willMatters(3), true);
  assert.equal(F.willBroken(null), false);
  // PIN MOVED (FEUD BALANCE, Feud-Arc.md OPEN 22 - Mac: one stagger or one perfect dodge breaks it)
  assert.equal(F.willBroken({ weak: 0, staggers: 0, perfect: 0 }), false);
  assert.equal(F.willBroken({ weak: 0, staggers: 1 }), true);
  assert.equal(F.willBroken({ weak: 0, staggers: 0, perfect: 1 }), true);
  assert.equal(F.willBroken({ weak: 1, staggers: 0 }), true);
  assert.deepEqual(Object.keys(F.FLINCH_LINES).sort(), [...F.WEAKNESSES].sort(), 'one line a weakness');
  assert.equal(new Set(Object.values(F.FLINCH_LINES)).size, 14, 'fourteen, each its own');
  assert.deepEqual(Object.keys(F.WEAK_NAMES).sort(), [...F.WEAKNESSES].sort());
  assert.equal(F.FLINCH_HEALTH, 0.5);
});

// ── struck ──────────────────────────────────────────────────────────

test('RVN3 STRUCK through the REAL formulas\' tail: its class x1.5, its metal x1.5, anything else as ever; the daylight\'s every blow x1.25 by day, none by night - and no adaptation takes from a blow of it (mutants: the class unweighed; the metal unweighed; the daylight by night; an adaptation taking from it)', () => {
  const p = me();
  const hit = (t, w) => calculateAttackDamage(p, t, { weapon: w, rolls: () => 0.2 });
  const sword = createWeapon(W.Longsword, 1, () => 0.5);
  const plain = hit(weakTo(null), sword);
  assert.ok(plain > 2);
  assert.equal(hit(weakTo('blade'), sword), Math.round(plain * 1.5));
  assert.equal(hit(weakTo('axe'), sword), plain);
  const elven = createWeapon(W.Longsword, 3, () => 0.5);
  assert.equal(hit(weakTo('elven'), elven), Math.round(hit(weakTo(null), elven) * 1.5));
  assert.equal(hit(weakTo('elven', ['mailed']), elven), Math.round(hit(weakTo(null), elven) * 1.5), 'Mailed takes nothing from a blow of its weakness');
  setWorldMinutes(NOON);
  assert.equal(hit(weakTo('daylight'), sword), Math.round(plain * 1.25), 'by day');
  assert.equal(hit(weakTo('daylight', ['mailed']), sword), Math.round(plain * 1.25), 'by day its weakness: Mailed takes nothing');
  setWorldMinutes(TWO_AM);
  assert.equal(hit(weakTo('daylight'), sword), plain, 'by night: nothing');
});

const magicFor = (pe) => createPlayerMagic({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
  getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
  collider: { raycast: () => Infinity }, playerEntity: pe,
  playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
  say() {}, surfacePlayer() {}, foes: () => [], foeSinks: () => ({}), absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99, startCastAnim: null,
});
const fx = (type, subType, o = {}) => ({ type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1, ...o });
const EMPTY = { type: -1, subType: -1 };
const FIRE = { name: 'Fireball', index: 60, element: 0, rangeType: 1, effects: [fx(4, 0, { magnitudeBaseLow: 10, magnitudeBaseHigh: 10, durationBase: 0 }), EMPTY, EMPTY] };

test('RVN3 AN ELEMENT: -50 on the REAL saving throw (its adaptation\'s +25 never touching it); a spell landing by day on a daylight-weak one x1.25; the landing\'s element rides to the door (mutants: the fold\'s -50 dropped; the daylight\'s spell untouched; the element unthreaded)', () => {
  const e = weakTo('fire', ['fireproof']);
  computeEntityMods(e);
  assert.equal(entityResistMod(e, ['fire']), -50);
  const plain = weakTo(null);
  computeEntityMods(plain);
  const roll = () => 0.3;
  assert.ok(savingThrow(0, EFFECT_FLAGS.Fire, plain, 0, roll) < 100, 'a plain body saves part at this roll');
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, e, 0, roll), 100, 'its weakness: the full burn');
  // the landing: by day a daylight-weak body takes x1.25 of a spell too
  const magic = magicFor(me());
  const land = (t) => { const got = []; magic.applySpellToFoe(FIRE, 5, { entity: t }, null, undefined, { hurt: (n, o) => got.push([n, o?.element]) }); return got[0]; };
  setWorldMinutes(NOON);
  const [day, el] = land(weakTo('daylight'));
  setWorldMinutes(TWO_AM);
  const [night] = land(weakTo('daylight'));
  assert.equal(day, Math.round(night * 1.25), `by day x1.25 (${day} / ${night})`);
  assert.equal(el, 0, 'the element rides the sink\'s options');
  // every host's player spell sink forwards it to its pool's door
  for (const [file, re] of [
    ['src/scenes/world.js', /exteriorFoes\.damageFoe\(g, n, player\.pos, null, \{ fromPlayer: fp, kind: 'spell', whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\)/],
    ['src/scenes/exterior.js', /exteriorFoes\.damageFoe\(g, n, player\.pos, null, \{ fromPlayer: fp, kind: 'spell', whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\)/],
    ['src/scenes/worldModes.js', /interiorFoes\?\.damageFoe\(foe, n, player\.pos, null, \{ fromPlayer: fp, kind: 'spell', whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\)/],
    ['src/scenes/dungeonContext.js', /hurt: \(n, o\) => damageFoe\(f, n, null, null, \{ kind: 'spell', fromPlayer: o\?\.fromPlayer \?\? fromPlayer, whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\)/],
  ]) assert.match(read(file), re, file);
  for (const file of ['src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(read(file), /wc, fromPlayer, element,   \/\/ TELL8/, `${file}: to the poise door`);
  }
});

// ── the poise door ──────────────────────────────────────────────────

const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
function brainFoe(weak) {
  const c = new Collider(() => 0);
  const ent = { health: 100, maxHealth: 100, mobileType: M.Orc, level: 12, revenant: { id: null, name: 'B', rank: 2, learned: [], weak, edge: F.adaptEdge([], weak) } };
  const ai = new EnemyAI(c, [0, 0, 2.5], Math.PI, { vitals: () => ent, liveSpeed: () => 50 });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  const mobile = new MobileUnit(M.Orc, ENEMY_BASICS[M.Orc], () => 8, () => 0.99);
  return { ai, atk, ent, mobile, entity: ent, _seq: 0 };
}
function windup(f) {
  const player = [0, 0, 0];
  const r = Math.random; Math.random = () => 0.05;
  try {
    for (let s = 0; s < 3600; s++) {
      T += DT;
      noteLocalPlayer(player, [0, 0, 1]);
      f.ai.update(DT, player); f.atk.update(DT, f.ai, player);
      if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai);
    }
  } finally { Math.random = r; }
  return null;
}

test('RVN3 ON A WIND-UP a blow of its weakness weighs x2 (TELL\'s POISE_WEAK) - mine by its weapon, a spell by its element (mutants: the weight unread; the element unread)', () => {
  const weigh = (weak, opts) => {
    resetTactics(); resetBlows(); T = 0;
    const f = brainFoe(weak);
    const b = windup(f);
    assert.ok(b, 'a wind-up');
    const ahead = [b.origin[0] + Math.sin(b.yaw) * 2, 0, b.origin[2] + Math.cos(b.yaw) * 2];
    windupDoor(f, 1, { from: ahead, weight: 300, ...opts });
    return b.taken;
  };
  const sword = createWeapon(W.Longsword, 1, () => 0.5);
  assert.ok(Math.abs(weigh('blade', { kind: 'melee', weapon: sword }) - weigh('axe', { kind: 'melee', weapon: sword }) * TELL.POISE_WEAK) < 1e-9);
  assert.ok(Math.abs(weigh('fire', { kind: 'spell', element: 0 }) - weigh('frost', { kind: 'spell', element: 0 }) * TELL.POISE_WEAK) < 1e-9);
  assert.equal(TELL.POISE_WEAK, 2);
});

// ── the reveal and the flinch ───────────────────────────────────────

test('RVN3 THE REVEAL: my first blow of its weakness - the real strike - counts in the ledger, tells the record (known), its card once and the hiss where it stands; a second blow no second card; my spell of its element reveals it too (mutants: never counted; never known; the card every blow; no hiss; the spell\'s unnoticed)', async () => {
  const p = me();
  const o = foe();
  o._voiceId = 'rvn3-reveal';
  const r = N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  N.applyRevenant(o, r);
  const sfx = [], lines = [];
  setPlayerDoor({ foes: () => [{ entity: o, ai: { feet: [1, 0, 2] } }], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, sfx: (id, at) => sfx.push([id, at]), say: (l) => lines.push(l) });
  r.weak = 'blade'; o.revenant = { ...o.revenant, weak: 'blade', edge: F.adaptEdge(r.learned, 'blade') };
  let d = 0;
  for (let i = 0; i < 20 && !(d > 0); i++) d = calculateAttackDamage(p, o, { weapon: createWeapon(W.Longsword, 1, () => 0.5), rolls: () => 0.2 });
  assert.ok(d > 0);
  assert.equal(o._feud.weak, 1, 'counted');
  assert.equal(N.revenantById(r.id).weakKnown, 2, 'known');
  assert.deepEqual(sfx, [[SOUND.Burning, [1, 0, 2]]], 'the hiss where it stands');
  const cards = shown.filter((e) => e.kind === 'weakness');
  assert.equal(cards.length, 1);
  assert.match(cards[0].body, /^Blades - its weakness, laid bare\.$/);
  assert.equal(cards[0].kicker, 'Weakness');
  calculateAttackDamage(p, o, { weapon: createWeapon(W.Longsword, 1, () => 0.5), rolls: () => 0.2 });
  assert.equal(shown.filter((e) => e.kind === 'weakness').length, 1, 'no second card');
  assert.equal(sfx.length, 1, 'no second hiss');
  assert.ok(o._feud.weak >= 2);
  // a spell of its element: the landing notes it - weak, revealed
  const q = foe();
  q._voiceId = 'rvn3-spell';
  const rq = N.revenantDeed(p, q, 'fled', { rolls: () => 0.5 });
  N.applyRevenant(q, rq);
  rq.weak = 'fire'; q.revenant = { ...q.revenant, weak: 'fire', edge: F.adaptEdge([], 'fire') };
  magicFor(p).applySpellToFoe(FIRE, 5, { entity: q }, null, undefined, { hurt() {} });
  assert.equal(q._feud.weak, 1);
  assert.equal(N.revenantById(rq.id).weakKnown, 2);
  // a metal weakness through the real strike: the blade's own metal counts
  const m = foe();
  m._voiceId = 'rvn3-metal';
  const rm = N.revenantDeed(p, m, 'fled', { rolls: () => 0.5 });
  N.applyRevenant(m, rm);
  rm.weak = 'elven'; m.revenant = { ...m.revenant, weak: 'elven', edge: F.adaptEdge([], 'elven') };
  let dm = 0;
  for (let i = 0; i < 20 && !(dm > 0); i++) dm = calculateAttackDamage(p, m, { weapon: createWeapon(W.Longsword, 3, () => 0.5), rolls: () => 0.2 });
  assert.ok(dm > 0);
  assert.equal(m._feud.weak, 1, 'an elven blade on an elven-weak one');
  assert.match(read('src/systems/revenant.js'), /Promise\.resolve\(\)\.then\(\(\) => \{ try \{ tagHit\(entity, HIT_TAGS\.weakness\); \}/, 'the word, after the number its blow raises');
});

test('RVN3 THE FLINCH: under half its health, its weakness unknown - the narrator\'s line, the record hinted, once a stand; above half, nothing; known, nothing (mutants: the line at any health; hinted twice; a known one flinching)', () => {
  const p = me();
  const o = foe();
  const r = N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  const f = { entity: o };
  o.health = o.maxHealth * 0.6;
  assert.equal(N.revenantFlinch(f), null, 'above half');
  assert.equal(f._flinched, undefined);
  o.health = o.maxHealth * 0.4;
  const ev = N.revenantFlinch(f);
  assert.equal(ev.kind, 'weakness');
  assert.equal(ev.body, F.FLINCH_LINES[r.weak]);
  assert.equal(ev.speech, null, 'the narrator\'s, in no voice');
  assert.equal(N.revenantById(r.id).weakKnown, 1, 'hinted');
  assert.equal(N.revenantFlinch(f), null, 'once a stand');
  const g = { entity: foe() };
  const r2 = N.revenantDeed(p, g.entity, 'fled', { rolls: () => 0.5 });
  r2.weakKnown = 2;
  g.entity.health = 1;
  assert.equal(N.revenantFlinch(g), null, 'known: nothing to shy from');
  assert.equal(r2.weakKnown, 2);
  // both pools ask it beside the taunt
  assert.match(read('src/scenes/exteriorFoes.js'), /if \(f\.entity\.revenant\?\.id && !f\._flinched\) \{ const ev = revenantFlinch\(f, \{ archive: f\.archive \}\); if \(ev\) revenantSay\(ev, say\); \}/);
  assert.match(read('src/scenes/dungeonContext.js'), /if \(f\.entity\?\.revenant\?\.id && !f\._flinched\) \{ const ev = revenantFlinch\(f, \{ archive: f\.mobileArchive \}\); if \(ev\) revenantSay\(ev, \(l\) => hudText\.add\(l\)\); \}/);
});

// ── the will, on the real pool ──────────────────────────────────────

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
function rig(p) {
  const renderer = {
    createBillboardBatch: (archive, record, size) => ({ archive, record, size, conceal: undefined, dissolve: undefined, origin: null }),
    destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}),
  };
  return createExteriorFoes({
    renderer, collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: p, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: (l) => said.push(l),
    fates: true, dropLoot: () => {}, shake: () => {},
  });
}
const frame = (pool) => pool.update(0.016, [0, 0, 3], [0, 1.6, 3]);
/** A rank-`rank` record as a flight makes one (an imp - mobile 2, the rig's career). */
function revenantOf(p, rank) {
  const r = N.revenantDeed(p, { mobileType: 2, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: 2, rolls: () => 0 });
  r.rank = rank;
  return r;
}

test('RVN3 THE WILL: from rank 3 a revenant my fight has not broken does not kneel - at the killing blow it TEARS AWAY: held at 1, untouchable, ashing out in ember, then gone - an escape (ranked up, `fled`, its words "unbroken"); broken (one stagger - FEUD BALANCE, or its weakness struck) it kneels; at rank 2 it kneels; Disintegrate kills (mutants: the will unread; it kneels unbroken; no ember; the escape unranked; a broken one tearing away; the whole kill withheld)', async () => {
  const p = me();
  // unbroken, rank 3
  const r = revenantOf(p, 3);
  const pool = rig(p);
  const f = await pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  frame(pool);
  f._lastStood = true;   // PIN MOVED (RVN4: a rank-3 one's last stand comes first - stood already, the will alone is asked)
  assert.equal(FT.revenantWillHolds(f), true);
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(f.yielded, undefined, 'it does not kneel');
  assert.ok(f.leaving, 'it tears away');
  assert.equal(f.entity.health, 1);
  assert.equal(f.dead, false);
  const going = f.leaving;
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(f.entity.health, 1, 'untouchable as it goes');
  assert.equal(f.leaving, going, 'no second blow reaches it (its going not begun again)');
  f.portalFx.at -= 400; f.leaving.at -= 400;
  frame(pool);
  pool.batches();
  assert.ok(f.batch.dissolve && f.batch.dissolve[0] > 0 && f.batch.dissolve[1] === 1, 'ashing out in ember');
  f.leaving.at -= 1000;
  frame(pool);
  assert.equal(f.dead, true); assert.equal(f.escaped, true);
  const rec = N.revenantById(r.id);
  assert.equal(rec.rank, 4, 'ranked up');
  assert.equal(rec.history.at(-1).deed, 'fled');
  assert.equal(rec.defeated, false);
  const ev = shown.find((e) => e.kind === 'unbroken');
  assert.ok(ev, 'its words');
  assert.equal(ev.body, `${rec.given} staggers into the smoke, unbroken.`);
  assert.equal(ev.kicker, 'Unbroken');
  // broken by its staggers: it kneels
  N._resetRevenantForTests();
  const r2 = revenantOf(p, 3);
  const pool2 = rig(p);
  const g = await pool2.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r2 });
  frame(pool2);
  g._lastStood = true;
  L.noteFeud(g.entity, 'staggers');   // PIN MOVED (AUDIT FEUD 2: one stagger - FEUD BALANCE's law; two told the laws apart from nothing)
  pool2.damageFoe(g, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(g.yielded, 'broken, it kneels');
  // its weakness struck: it kneels
  const r3 = revenantOf(p, 3);
  const h = await pool2.spawnFoe(2, [1, 0, 0], { feetGiven: true, level: 6, revenant: r3 });
  frame(pool2);
  h._lastStood = true;
  L.noteFeudHarm(h.entity, h.entity.revenant.weak === 'daylight' ? 'blade' : (F.WEAKNESS_METALS.includes(h.entity.revenant.weak) ? 'blade' : h.entity.revenant.weak), 5, { metal: F.WEAKNESS_METALS.includes(h.entity.revenant.weak) ? h.entity.revenant.weak : null });
  if (h.entity.revenant.weak === 'daylight') h.entity._feud.weak++;   // the sky's: struck by day (the rig's clock is the night's)
  assert.ok(h.entity._feud.weak > 0);
  pool2.damageFoe(h, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(h.yielded, 'its weakness struck, it kneels');
  // rank 2: the will is no matter
  const r4 = revenantOf(p, 2);
  const k = await pool2.spawnFoe(2, [2, 0, 0], { feetGiven: true, level: 6, revenant: r4 });
  frame(pool2);
  pool2.damageFoe(k, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(k.yielded, 'rank 2 kneels');
  // a Disintegrate's kill is a kill
  const r5 = revenantOf(p, 3);
  const z = await pool2.spawnFoe(2, [3, 0, 0], { feetGiven: true, level: 6, revenant: r5 });
  frame(pool2);
  z._lastStood = true;
  pool2.damageFoe(z, 99999, [0, 0, 3], null, { fromPlayer: true, whole: true });
  assert.equal(z.leaving, undefined);
  assert.equal(z.yielded, undefined);
  assert.equal(N.revenantById(r5.id).defeated, true, 'slain outright');
});

test('RVN3 the dungeon\'s doors: the will at its yield seam, the tear-away its escape, the fate-held refusal (mutants: any unwired)', () => {
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /revenantMayYield\(foe\)\) \{ if \(revenantWillHolds\(foe\)\) tearAwayDungeonFoe\(foe\); else yieldDungeonFoe\(foe\); return; \}/);
  assert.match(d, /function tearAwayDungeonFoe\(f\) \{[\s\S]{0,300}beginTearAway\(f, \(\) => escapeDungeonFoe\(f, \{ unbroken: true \}\)\);/);
  assert.match(d, /if \(foe\.yielded \|\| foe\.executing \|\| foe\.sparing \|\| foe\.leaving \|\| foe\.roaring\) return;/);   // PIN MOVED (RVN4: nor one roaring)
  assert.match(d, /unbroken \? revenantUnbrokenEvent\(r, playerEntity\?\.name, \{ archive: f\.mobileArchive \}\)/);
});

test('RVN3 the page: its weakness as I know it - unknown, its kind, what it is; from rank 3 the will\'s rule (mutants: a hint named; the rule at rank 2)', () => {
  assert.equal(weaknessWords({ weak: 'fire', weakKnown: 0 }), 'Weakness: unknown.');
  assert.equal(weaknessWords({ weak: 'fire', weakKnown: 1 }), 'Weakness: An element.');
  assert.equal(weaknessWords({ weak: 'silver', weakKnown: 1 }), 'Weakness: A metal.');
  assert.equal(weaknessWords({ weak: 'daylight', weakKnown: 1 }), 'Weakness: The sun.');
  assert.equal(weaknessWords({ weak: 'axe', weakKnown: 2 }), 'Weakness: Axes.');
  assert.equal(willWords({ rank: 2 }), '');
  assert.equal(willWords({ rank: 3 }), 'Its will must be broken - strike its weakness, stagger it, or dodge its blow perfectly.');   // PIN MOVED (FEUD BALANCE, OPEN 22)
});
