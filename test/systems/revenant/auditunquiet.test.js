// AUDIT UNQUIET (bible/06-Systems/Revenants.md section 49; the owner, 2026-10-18: "Audit everything and ensure absolute
// perfection"): five read-only lanes over UNQUIET I-III, every finding fixed or decided. Pinned here, each against the
// fix it needs: the birth's gate (a peer's puppet, a forgotten one, the cap read after the mirror, a rite's faithful);
// one Dread, not counted; the tear-away's count; the blood a rank spends; a slip never ascending; the trail only to the
// den its escape chose; the Dread's drop and hoard; an heir's clocks; the clocks held to the character's; a forgotten
// lair's trail; the wound said once; one lesson a catch-up and never an element; the old "the Dread" name; every
// getting-away's card ending as the escape's; the omen kept through a pushback, seeded on an older record, never a
// Night-stalker's by day; the cap's race, the craft on the pool's clock, the blinker standing to its rift, the marked
// foe's bolt, the smoke lifted; the mark never on the zone's or the sand's; the page's healing, held and Dread; the
// pools' seams by source; and the craft through the real street pool, held by a still pool.
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
const U = await import('../../../src/systems/revenant/revenantUnquiet.js');
const F = await import('../../../src/systems/revenant/revenantFeud.js');
const FT = await import('../../../src/systems/revenant/revenantFate.js');
const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../../src/systems/companionSlots.js');
const PG = await import('../../../src/ui/revenant/revenantPage.js');
const { isUnquiet } = await import('../../../src/systems/revenant/unquietMark.js');
const { foeTitle } = await import('../../../src/systems/foeTitle.js');
const { feudOf } = await import('../../../src/systems/feudLedger.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setRevenantPresenter } = await import('../../../src/systems/revenant/revenantVoice.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');
const { createExteriorFoes } = await import('../../../src/scenes/exteriorFoes.js');
const { Collider } = await import('../../../src/player/collider.js');
const { setTacticsClock, resetTactics } = await import('../../../src/ai/tactics.js');
const { resetBlows } = await import('../../../src/ai/foeBlows.js');
const { setSigilOnline, setSigilRenown } = await import('../../../src/systems/sigil/sigil.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DAY = 1440;
const me = (id = 'char-auq') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, reflexes: 2, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(40).fill(40), skillUses: new Array(40).fill(0), career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const foe = (over = {}) => ({ mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster', activeEffects: [], ...over });
const LAIR = Object.freeze({ px: 106, py: 100, name: 'Tomb of Vaness', region: 3 });
const HERE = { px: 100, py: 100, dungeons: [{ ...LAIR }] };
let shown = [];
let T = 0;
setTacticsClock(() => T);

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', false);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(DAY * 10); shown = []; T = 0; resetTactics(); resetBlows();
  setRevenantPresenter((ev) => { shown.push(ev); return true; });
});
/** The door with a lair about it, as the open world's (its map pixel and the dungeons in reach). */
const door = (here = HERE) => setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, lairHere: () => here });
function made(p, { deedName = 'fled', personality = 'brutal', now = DAY * 10, mobileType = M.Orc, over = {} } = {}) {
  const r = N.revenantDeed(p, foe({ mobileType, ...over }), deedName, { mobileType, rolls: () => 0, now });
  assert.ok(r, 'born');
  r.personality = personality;
  return r;
}
const body = (r, over = {}) => foe({ mobileType: r.mobileType, revenant: { id: r.id, rank: r.rank }, ...over });
const again = (p, r, deedName, { now = DAY * 11, unbroken = false, slip = false, last = null } = {}) => {
  const e = body(r);
  if (last) feudOf(e).last = last;
  return N.revenantDeed(p, e, deedName, { mobileType: r.mobileType, rolls: () => 0, now, unbroken, slip });
};
/** A foe record as a pool keeps one, its motor's flee a recorder. */
const rec = (entity) => ({ entity, mobileType: entity.mobileType, ai: { feet: [0, 0, 0], isHostile: true, fleeLeft: 0, fleePace: 1, flee(_from, s, pace) { this.fleeLeft = s; this.fleePace = pace; } } });

// ── the birth's gate (A1, A7, rite) ─────────────────────────────────

test('AUQ A1 A BIRTH IS THE MARK\'S AND THE CAP\'S AT THE DEED: a peer\'s puppet (its owner\'s name, no id of mine) kills me - no revenant; a forgotten one\'s id, unmarked or at the cap - none; room and the mark, a new one under a new id (mutants: the deed\'s gate dropped; its mark unread; its cap unread)', () => {
  const p = me();
  const pup = foe({ unquiet: false, revenant: { id: null, name: 'Grushnak the Butcher', rank: 0 } });
  assert.equal(N.revenantDeed(p, pup, 'slew', { mobileType: M.Orc, rolls: () => 0, now: DAY * 10 }), null, 'a peer\'s puppet is never mine');
  assert.equal(N.livingRevenants().length, 0);
  assert.equal(N.revenantDeed(p, foe({ unquiet: false, revenant: { id: 'gone-1' } }), 'fled', { mobileType: M.Orc, rolls: () => 0 }), null, 'a forgotten one, unmarked: none');
  made(p); made(p); made(p);
  assert.equal(N.revenantDeed(p, foe({ revenant: { id: 'gone-2' } }), 'slew', { mobileType: M.Orc, rolls: () => 0 }), null, 'marked, at the cap: none');
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX, 'none past the cap');
  N.revenantSlain(p, { revenant: { id: N.livingRevenants()[0].id } });
  const r = N.revenantDeed(p, foe({ revenant: { id: 'gone-3' } }), 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(r, 'room and the mark: born');
  assert.notEqual(r.id, 'gone-3');
});

test('AUQ A1 NEVER ANOTHER CLIENT\'S, NEVER A RITE\'S: a puppet\'s record or a rite\'s faithful is no candidate, marked or not (mutants: the puppet read as mine; the rite\'s)', () => {
  assert.equal(N.revenantCandidate(foe()), true);
  assert.equal(N.revenantCandidate(foe(), { puppet: 'peer-1' }), false, 'another client\'s foe');
  assert.equal(N.revenantCandidate(foe(), { riteRole: 'summoner' }), false, 'the rite\'s Summoner');
  assert.equal(N.revenantCandidate(foe(), { riteRole: 'faithful' }), false, 'its faithful');
});

test('AUQ A7 THE CAP IS COUNTED AFTER THE MIRROR: three living kept in my mirror, a fresh session\'s first deed reads them in first - and none rises past them (mutants: the cap counted before the mirror)', () => {
  const p = me('char-a7');
  made(p); made(p); made(p);
  N._resetRevenantForTests();   // a fresh session: the list empty, the mirror kept
  assert.equal(N.revenantDeed(p, foe(), 'fled', { mobileType: M.Orc, rolls: () => 0 }), null);
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX, 'the three, read in - and no fourth');
});

// ── one Dread, not counted (D2) ─────────────────────────────────────

function dreadOf(p, personality = 'brutal') {
  door();
  const r = made(p, { personality });
  r.rank = 5;
  again(p, r, 'fled', { now: DAY * 12 });
  assert.equal(r.dread, true);
  return r;
}

test('AUQ D2 ONE DREAD, NOT COUNTED: the Dread hunts no one - three more rise beside it; a second rank-V escape while it waits stays rank V, unascended (mutants: the Dread counted; DREAD.MAX unread)', () => {
  assert.equal(U.DREAD.MAX, 1);
  assert.deepEqual([U.mayAscend({ rank: 5, lair: LAIR }, 5, 0), U.mayAscend({ rank: 5, lair: LAIR }, 5, 1)], [true, false]);
  const p = me();
  const d = dreadOf(p);
  assert.deepEqual([N.livingRevenants().length, N.huntingRevenants().length], [1, 0]);
  const a = made(p), b = made(p), c = made(p);
  assert.deepEqual([N.livingRevenants().length, N.huntingRevenants().length], [4, 3], 'three hunt beside it');
  assert.equal(N.revenantCandidate(foe()), false, 'and no fourth hunter');
  c.rank = 5;
  again(p, c, 'fled', { now: DAY * 13 });
  assert.deepEqual([c.rank, c.dread], [5, false], 'one Dread at a time');
  assert.ok([a, b, d].every((x) => !x.gone));
});

// ── the tear-away, the blood (D4, A2) ───────────────────────────────

test('AUQ D4 THE TEAR-AWAY COUNTS: its will\'s tear-away ranks it every second time (TEAR_RANK), a plain escape every time; the count spent by a rank, kept through the save, read back under TEAR_RANK; the page says one more will (mutants: every tear-away ranking; never; the count unspent; unsaved; the page unsaid)', () => {
  assert.equal(U.TEAR_RANK, 2);
  assert.deepEqual([U.deedRanks('fled', 0, { unbroken: true, tears: 1 }), U.deedRanks('fled', 0, { unbroken: true, tears: 2 }), U.deedRanks('fled', 0)], [false, true, true]);
  assert.deepEqual([U.sanitizeTears(1), U.sanitizeTears(5), U.sanitizeTears(-1), U.sanitizeTears('1')], [1, 1, 0, 0]);
  const p = me();
  const r = made(p);
  r.rank = 2;
  again(p, r, 'fled', { unbroken: true });
  assert.deepEqual([r.rank, r.tears], [2, 1], 'one tear-away: counted');
  restoreModSaveRecords(modSaveRecords());
  const q = N.revenantsFor(p).find((x) => x.id === r.id);
  assert.equal(q.tears, 1, 'saved');
  assert.equal(PG.tearLine(q), 'If its will holds at your killing blow once more, it grows bolder.');
  assert.deepEqual([PG.tearLine({ tears: 0, rank: 2 }), PG.tearLine({ tears: 1, rank: 5 })], ['', '']);
  again(p, q, 'fled', { unbroken: true, now: DAY * 12 });
  assert.deepEqual([q.rank, q.tears], [3, 0], 'the second: ranked, the count spent');
  again(p, q, 'fled', { now: DAY * 13 });
  assert.equal(q.rank, 4, 'a plain escape: every time');
});

test('AUQ A2 A RANK SPENDS WHAT IT COUNTED: festering into a rank, or turning on me, its blood and its tear-aways go back to none (mutants: either kept)', () => {
  const p = me();
  const r = made(p, { personality: 'brutal' });
  r.dueAt = DAY * 10; r.blood = 1; r.tears = 1; r.wrath = F.WRATH_MAX - 1;
  N.revenantFester(p, { now: DAY * 12 + 60, rolls: () => 0.99 });
  N.revenantFester(p, { now: DAY * 13 + 60, rolls: () => 0.99 });
  assert.equal(r.rank, 2, 'festered into a rank');
  assert.deepEqual([r.blood, r.tears], [0, 0]);
  RC.setRetinuePlayer(p);
  const s = made(p);
  N.revenantSpared(p, { revenant: { id: s.id } }, { state: 'with' });
  const x = N.revenantById(s.id);
  x.blood = 1; x.tears = 1; x.personality = 'brutal';
  assert.ok(N.revenantBetrays(p, x, { now: DAY * 14 }));
  assert.deepEqual([x.rank, x.blood, x.tears], [2, 0, 0], 'turned: ranked, spent');
});

test('AUQ A2 WOUNDS HEAL FROM THE DAY IT IS HUNTED AGAIN: an oath stood their count - a deserter\'s or a betrayer\'s wounds heal from the day it left me (mutants: the deserter\'s day kept; the betrayer\'s)', () => {
  const p = me();
  RC.setRetinuePlayer(p);
  const a = made(p), b = made(p);
  for (const x of [a, b]) { N.revenantSpared(p, { revenant: { id: x.id } }, { state: 'away' }); const y = N.revenantById(x.id); y.wounds = ['bled']; y.woundDay = 3; y.personality = 'brutal'; }
  assert.ok(N.revenantDeserts(p, N.revenantById(a.id), { now: DAY * 20 + 5 }));
  assert.ok(N.revenantBetrays(p, N.revenantById(b.id), { now: DAY * 21 + 5 }));
  assert.deepEqual([N.revenantById(a.id).woundDay, N.revenantById(b.id).woundDay], [20, 21]);
});

// ── the Dread's ways (D3) ───────────────────────────────────────────

test('AUQ D3 A SLIP NEVER ASCENDS: a rank-V one slipping away from the choice stays rank V; an escape makes it the Dread (mutants: the slip unread)', () => {
  const p = me();
  door();
  const r = made(p);
  r.rank = 5;
  again(p, r, 'fled', { slip: true });
  assert.deepEqual([r.rank, r.dread], [5, false], 'held beaten, it slipped - no ascent');
  again(p, r, 'fled', { now: DAY * 12 });
  assert.equal(r.dread, true, 'got away: the Dread');
});

test('AUQ D3 THE TRAIL ONLY TO ITS DEN: an escape underground goes to ground in that dungeon - no trail (it was found there weakened again and again); in the open with no den in reach its old lair stands - no trail to it (mutants: the trail on any lair)', () => {
  const p = me();
  const under = { underground: { px: 50, py: 60, name: 'Castle Hollowmere', region: 2 } };
  door(under);
  const r = made(p);
  assert.deepEqual([r.lair?.name, r.trail, r.lairKnown], ['Castle Hollowmere', 0, false], 'underground: its dungeon, no trail');
  again(p, r, 'fled', { now: DAY * 11 });
  assert.equal(r.trail, 0, 'and again: none');
  door({ px: 900, py: 900, dungeons: [] });
  again(p, r, 'fled', { now: DAY * 12 });
  assert.deepEqual([r.lair?.name, r.trail], ['Castle Hollowmere', 0], 'no den in reach: its old lair, no trail');
  door();
  again(p, r, 'fled', { now: DAY * 13 });
  assert.deepEqual([r.lair?.name, r.trail], [LAIR.name, DAY * 13 + U.HUNT.MINUTES], 'a den in reach: its trail');
});

test('AUQ D3 THE DREAD\'S DROP AND HOARD: its hoard the Dread\'s or a plunderer\'s days, the more - never the two multiplied; its drop its rank\'s, no Legendary forced (mutants: the hoards multiplied; a Legendary forced)', () => {
  assert.deepEqual([U.hoardOf(true, 1), U.hoardOf(true, 3), U.hoardOf(true, 4), U.hoardOf(false, 2.5), U.hoardOf(false, 1), U.hoardOf(false, NaN)], [3, 3, 4, 2.5, 1, 1]);
  const p = me();
  const d = dreadOf(p, 'witty');
  d.dueAt = DAY * 1;
  const e = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100, stats: { speed: 50 } };
  N.applyRevenant(e, d, { now: DAY * 30 });
  assert.equal(e.revenant.hoard, U.DREAD.GOLD, 'a plunderer\'s most (x3) is not multiplied by the Dread\'s (x3)');
  e.items = [];
  N.grantRevenantLoot(e, 10, () => 0.999);
  assert.equal(e.items.filter((it) => it.rarity === 'legendary').length, 0, 'its Legendary is its trophy');
});

// ── an heir's clocks; the clocks held (A3, E1, E8, E9, E11) ─────────

test('AUQ A3 THE HEIR\'S CLOCKS: a kinsman\'s killer handed on keeps its wounds but heals them from the heir\'s day; no trail, no omen; due on vengeance\'s days; joins the heir\'s three - none forgotten for it - loaded or not (mutants: the fallen\'s woundDay, trail or omen kept; the plain days; a burial)', () => {
  const fallen = me('char-fallen');
  const k = made(fallen, { personality: 'brutal' });
  Object.assign(k, { wounds: ['bled', 'lamed'], woundDay: 900, trail: DAY * 999, omen: 5 });
  const recd = JSON.parse(JSON.stringify(k));
  N._resetRevenantForTests(); _store.clear();
  const heir = me('char-heir');
  made(heir); made(heir); made(heir);
  assert.equal(N.inheritRevenant(heir, recd, { now: DAY * 20 + 30, rolls: () => 0 }), true);
  const r = N.revenantById(recd.id);
  assert.deepEqual([r.wounds, r.woundDay, r.trail, r.omen], [['bled', 'lamed'], 20, 0, 0], 'the heir\'s clocks');
  assert.equal(r.dueAt, DAY * 20 + 30 + U.AMBITION.VENGEANCE_DUE[0], 'vengeance: one to two days');
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX + 1, 'none of the heir\'s forgotten for it');
  // not loaded: the same
  N._resetRevenantForTests(); _store.clear();
  const other = me('char-heir2');
  made(other); made(other); made(other);
  N._resetRevenantForTests();
  assert.equal(N.inheritRevenant(other, recd, { now: DAY * 20 + 30, rolls: () => 0 }), true);
  const all = N.revenantsFor(other);
  const q = all.find((x) => x.id === recd.id);
  assert.deepEqual([q.woundDay, q.trail, q.omen, all.filter((x) => !x.defeated && !x.gone && !x.sworn).length], [20, 0, 0, N.REVENANT_MAX + 1]);
});

test('AUQ A3 THE CLOCKS HELD TO THE CHARACTER\'S: a trail further off than HUNT.MINUTES, or a wound\'s day after today (an older save under a newer mirror), is brought back at the day\'s ask - even on a day already counted; the page\'s hours never past twelve (mutants: unheld; held only on a new day; the hours unclamped)', () => {
  const p = me();
  const r = made(p);
  N.revenantFester(p, { now: DAY * 10 + 60 });   // the first count
  r.trail = DAY * 30; r.woundDay = 25; r.wounds = ['bled'];
  N.revenantFester(p, { now: DAY * 10 + 120 });
  assert.deepEqual([r.trail, r.woundDay], [DAY * 10 + 120 + U.HUNT.MINUTES, 10]);
  assert.equal(U.trailHours({ trail: DAY * 30 }, DAY * 10), 12, 'the page never says more than its twelve hours');
});

// ── a lair forgotten, a wound told once (A9, A10) ───────────────────

test('AUQ A9 A HUNT GIVEN UP: its lair forgotten, its trail with it (mutants: the trail kept)', () => {
  const p = me();
  door();
  const r = made(p);
  assert.ok(r.trail > 0 && r.lairKnown);
  assert.equal(N.forgetRevenantLair(r.id), true);
  assert.deepEqual([r.lairKnown, r.trail], [false, 0]);
  assert.equal(PG.comeWords(r, DAY * 10 + 60, false).tag !== 'Weakened', true, 'the page sends me nowhere');
});

test('AUQ A10 A WOUND TOLD ONCE, AND ONLY ITS OWN: an escape that left no wound forgets one an earlier escape left untold (mutants: the stale wound named)', () => {
  const p = me();
  const r = made(p);
  again(p, r, 'fled', { last: 'arrow', now: DAY * 11 });   // a wound, its card never asked
  again(p, r, 'fled', { now: DAY * 12 });   // none this time
  const ev = N.revenantEscapeEvent(r, 'Ayla', { rolls: () => 0 });
  assert.ok(!ev.body.includes('the wound you left'), ev.body);
});

// ── training (A8, A11) ──────────────────────────────────────────────

test('AUQ A8 TRAINING DRILLS NO ELEMENT: scars of fire most, it trains against the next habit, never Fireproof (a fight teaches a resistance - RVN2\'s career guard); none but elements, none (mutants: an element trained)', () => {
  const base = { personality: 'cold', rank: 2, learned: [], mobileType: M.Orc };
  assert.equal(U.trainLesson({ ...base, scars: [{ k: 'fire', at: 1 }, { k: 'fire', at: 2 }, { k: 'blade', at: 3 }] }), 'mailed');
  assert.equal(U.trainLesson({ ...base, scars: [{ k: 'frost', at: 1 }, { k: 'shock', at: 2 }, { k: 'poison', at: 3 }, { k: 'magic', at: 4 }] }), null);
});

test('AUQ A11 ONE LESSON A CATCH-UP: two training days caught up at once teach one lesson - its one card says one (mutants: a lesson each day)', () => {
  const p = me();
  const r = made(p, { personality: 'cold' });
  r.rank = 3; r.learned = []; r.dueAt = DAY * 10;
  r.scars = [{ k: 'blade', at: 1 }, { k: 'blade', at: 2 }, { k: 'axe', at: 3 }];
  N.revenantFester(p, { now: DAY * 11 + 60, rolls: () => 0.99 });   // the first count
  N.revenantFester(p, { now: DAY * 14 + 60, rolls: () => 0.99 });   // days 12 and 14: two of mastery's
  assert.deepEqual(r.learned, ['mailed']);
  assert.equal(r.notice, 'trained');
});

// ── the old name (A12) ──────────────────────────────────────────────

test('AUQ A12 "THE DREAD" IS THE ASCENDED\'S: an older save\'s living one wearing it unascended is given a risen name again, drawn from its id (the same every load), its name with it; the Dread and the sworn keep theirs (mutants: kept; drawn at random; the name unbuilt)', () => {
  const p = me();
  const r = made(p);
  r.rank = 4; r.epithet = 'the Dread'; r.name = `${r.given} the Dread`;
  const s = made(p);
  RC.setRetinuePlayer(p);
  N.revenantSpared(p, { revenant: { id: s.id } }, { state: 'away' });
  const sw = N.revenantById(s.id);
  sw.epithet = 'the Dread'; sw.name = `${sw.given} the Dread`;
  const d = dreadOf(p);
  const raw = JSON.parse(JSON.stringify(modSaveRecords()));
  restoreModSaveRecords(raw);
  const all = N.revenantsFor(p);
  const back = all.find((x) => x.id === r.id);
  assert.notEqual(back.epithet, 'the Dread');
  assert.ok(N.REVENANT_EPITHETS.risen.includes(back.epithet) && !back.epithet.includes('{p}'), back.epithet);
  assert.equal(back.name, `${back.given} ${back.epithet}`);
  for (let i = 0; i < 6; i++) {
    N._resetRevenantForTests(); _store.clear();
    restoreModSaveRecords(raw);
    assert.equal(N.revenantsFor(p).find((x) => x.id === r.id).epithet, back.epithet, 'the same every load');
  }
  assert.equal(all.find((x) => x.id === s.id).epithet, 'the Dread', 'the sworn keep theirs');
  assert.equal(all.find((x) => x.id === d.id).epithet, 'the Dread');
  // twenty older records: never a risen name with the player's in it (the save keeps no player's name)
  const src = JSON.parse(JSON.stringify(N.revenantById(r.id)));
  const list = Array.from({ length: 20 }, (_, i) => ({ ...src, id: `old-dread-${i}`, rev: 0, epithet: 'the Dread', name: `${src.given} the Dread`, dread: false }));
  N._resetRevenantForTests(); _store.clear();
  restoreModSaveRecords({ ...raw, Revenant: { v: 1, list, lastDay: null } });
  const olds = N.revenantsFor(p).filter((x) => x.id.startsWith('old-dread-'));
  assert.equal(olds.length, 20);
  assert.ok(olds.every((x) => x.epithet !== 'the Dread' && !x.epithet.includes('{p}') && N.REVENANT_EPITHETS.risen.includes(x.epithet)), olds.map((x) => x.epithet).join(', '));
});

// ── every getting-away's card (A5, D8) ──────────────────────────────

test('AUQ A5 EVERY GETTING-AWAY\'S CARD: a tear-away that makes it the Dread is the ascension\'s card; another tear-away\'s and a slip\'s end with the wound it got away with and its trail (mutants: the ascension silent; the tails dropped)', () => {
  const p = me();
  door();
  const r = made(p);
  r.rank = 5; r.tears = 1;
  again(p, r, 'fled', { unbroken: true, last: 'blade' });
  assert.equal(r.dread, true, 'its will held a second time: the Dread');
  assert.equal(N.revenantUnbrokenEvent(r, 'Ayla', { rolls: () => 0 }).kind, 'ascended');
  const q = made(p);
  q.rank = 2;
  again(p, q, 'fled', { unbroken: true, last: 'blade', now: DAY * 12 });
  const ev = N.revenantUnbrokenEvent(q, 'Ayla', { rolls: () => 0 });
  assert.equal(ev.kind, 'unbroken');
  assert.ok(ev.body.startsWith(`${q.given} staggers into the smoke, unbroken. It bears the wound you left: Bled. Its trail leads to Tomb of Vaness, where it has gone to ground to recover.`), ev.body);
  again(p, q, 'fled', { slip: true, last: 'axe', now: DAY * 13 });
  setWorldMinutes(DAY * 13);
  const sl = FT.slipEvent(p, q, { rolls: () => 0 });
  assert.ok(sl.body.includes('It bears the wound you left: Maimed.') && sl.body.includes('Its trail leads to Tomb of Vaness, where it has gone to ground to recover.'), sl.body);
});

// ── the omen (E10) ──────────────────────────────────────────────────

test('AUQ E10 THE OMEN: an older record (no omen kept) is foretold already - a load is no burst of omens; a stand gone unfought keeps its omen through the pushback; held, none (C13); a Night-stalker\'s never by day (mutants: unseeded; the pushback foretelling again; held unread; the night unread)', () => {
  const p = me();
  const r = made(p);
  r.dueAt = DAY * 10;
  const raw = modSaveRecords();
  const json = JSON.parse(JSON.stringify(raw));
  for (const v of Object.values(json)) for (const x of v?.list ?? []) delete x.omen;
  restoreModSaveRecords(json);
  assert.equal(N.takeRevenantNotice(p, { now: DAY * 10 + 60 }), null, 'an older record: foretold already');
  N._resetRevenantForTests(); _store.clear();
  const q = made(p);
  q.dueAt = DAY * 10;
  assert.equal(N.takeRevenantNotice(p, { now: DAY * 10 + 60 })?.kind, 'omen');
  q.out = true; q.outAt = 0;
  N.revenantPresence([], { now: DAY * 10 + 120, wall: 60000 });
  assert.ok(q.dueAt > DAY * 10 && q.omen === q.dueAt, 'pushed back: still foretold');
  assert.equal(N.takeRevenantNotice(p, { now: q.dueAt + 1 }), null, 'never twice an absence');
  // C13: held under its Renown (online, under 10), none is foretold
  N._resetRevenantForTests(); _store.clear();
  const h = made(p);
  h.dueAt = DAY * 10;
  setSigilOnline(true); setSigilRenown(9);
  try { assert.equal(N.takeRevenantNotice(p, { now: DAY * 10 + 60 }), null, 'held: no omen'); } finally { setSigilOnline(false); setSigilRenown(null); }
  assert.equal(N.takeRevenantNotice(p, { now: DAY * 10 + 60 })?.kind, 'omen', 'the gate open: foretold');
  N._resetRevenantForTests(); _store.clear();
  setWorldMinutes(DAY * 10 + 720);   // noon
  const n = made(p);
  n.dueAt = DAY * 10; n.learned = ['nightStalker'];
  assert.equal(N.takeRevenantNotice(p, { now: DAY * 10 + 720 }), null, 'by day: a Night-stalker is not coming');
});

// ── the flight (B1, B2, B3, D1, D6) ─────────────────────────────────

test('AUQ B2 THE CAP\'S RACE: a marked foe running when the cap fills behind it turns and fights - no escape that could make nothing (mutants: it escapes into nothing)', () => {
  const p = me();
  made(p); made(p);
  const f = rec(foe({ health: 10, maxHealth: 50 }));
  assert.equal(N.revenantFleeStep(f, [0, 0, 3], { rolls: () => 0 }), 'start');
  assert.equal(f.ai.fleePace, N.REVENANT_FLEE_PACE_MARKED, 'AUQ D1: a marked foe bolts');
  made(p);
  assert.equal(N.revenantFleeStep(f, [0, 0, 3]), 'cornered');
  assert.deepEqual([f.fleeing, f.ai.fleeLeft], [false, 0]);
});

test('AUQ D1 D6 THE PACES: a marked foe runs at 2.5 (a bolt\'s); a blinker stands to its rift at 0.5 - put down (struck as it fades) it runs plain (mutants: the marked pace; the rift\'s; the run unrestored)', () => {
  assert.deepEqual([N.REVENANT_FLEE_PACE_MARKED, U.CRAFT.BLINK_PACE, U.craftPace('blink', 2)], [2.5, 0.5, 0.5]);
  const p = me();
  const r = made(p, { mobileType: M.Mage });
  r.rank = 2;
  const f = rec(body(r, { health: 5, maxHealth: 50 }));
  assert.equal(N.revenantFleeStep(f, [0, 0, 3], { rolls: () => 0, now: 0 }), 'start');
  assert.equal(f.ai.fleePace, 0.5, 'standing to its rift');
  N.revenantFleeStep(f, [0, 0, 3], { now: 0, dt: 0.9 });
  assert.ok(f._craft.fired, 'the rift open');
  f.entity.health -= 1;
  N.revenantFleeStep(f, [0, 0, 3], { now: 0, dt: 0.016 });
  assert.deepEqual([f._craft.kind, f.ai.fleePace], ['run', N.REVENANT_FLEE_PACE], 'struck as it faded: it runs');
});

test('AUQ B1 THE CRAFT ON THE POOL\'S CLOCK: a still pool (dt 0) holds a blink or a sink however long the wall runs; frames carry it through, its look drawn on the same time; with no dt, the wall\'s (mutants: the wall read with dt; the look unsynced)', () => {
  const f = { entity: { mobileType: M.Mage, health: 10, activeEffects: [] }, ai: { feet: [0, 0, 0] } };
  U.beginCraft(f, 'blink', { now: 0 });
  assert.equal(U.craftStep(f, 100000, 0), null);
  assert.equal(f._craft.fired, 0, 'a still pool: never fired');
  for (let i = 0; i < 8; i++) U.craftStep(f, 100000, 0.1);
  assert.ok(f._craft.fired > 0, 'eight tenths of the pool\'s time: fired');
  U.craftStep(f, 100000, 0.3);
  assert.equal(f.portalFx.at, 100000 - 300, 'its look on the pool\'s time');
  assert.equal(U.craftStep(f, 100000, 0.3), 'gone');
  const s = { entity: { mobileType: M.Zombie, health: 10, activeEffects: [] }, ai: { feet: [0, 0, 0] } };
  U.beginCraft(s, 'sink', { now: 0 });
  assert.equal(U.craftStep(s, 1e6, 0), null, 'a still pool: not under');
  U.craftStep(s, 1e6, 1);
  assert.equal(s.portalFx.at, 1e6 - 1000);
  assert.equal(U.craftStep(s, 1e6, 0.6), 'gone');
  const w = { entity: { mobileType: M.Zombie, health: 10, activeEffects: [] }, ai: { feet: [0, 0, 0] } };
  U.beginCraft(w, 'sink', { now: 0 });
  assert.equal(U.craftStep(w, 1600), 'gone', 'no dt: the wall\'s');
});

test('AUQ B3 THE SMOKE LIFTED: a craft put down takes its smoke off it - a kneeling one in smoke is drawn (mutants: the smoke kept)', () => {
  const f = { entity: { mobileType: M.Thief, health: 10, activeEffects: [] }, ai: { feet: [0, 0, 0] } };
  U.beginCraft(f, 'smoke', { now: 0 });
  assert.ok(f.entity.activeEffects.some((a) => a.kind === 'chameleonNormal'));
  f.entity.activeEffects.push({ kind: 'paralyze', bundleId: -7 });
  U.endCraft(f);
  assert.deepEqual(f.entity.activeEffects.map((a) => a.kind), ['paralyze'], 'its smoke alone lifted');
});

// ── the mark's reach (B5, B8) ───────────────────────────────────────

test('AUQ B5 B8 THE MARK\'S REACH: never on the zone\'s or the sand\'s - tagged after the draw, they wear no "Unquiet" and are no candidate; the dungeon clears a puppet\'s (its owner\'s word) at both builders (mutants: the zone\'s marked; the sand\'s; a builder unwired)', () => {
  for (const over of [{ wildFoe: true }, { wildGiant: true }, { bout: 'b1' }]) {
    const e = foe(over);
    assert.equal(isUnquiet(e), false, JSON.stringify(over));
    assert.ok(!/Unquiet/.test(foeTitle(e, 'Orc')), JSON.stringify(over));
  }
  assert.equal(isUnquiet(foe()), true);
  assert.equal(foeTitle(foe(), 'Orc'), 'Unquiet Mighty Orc');
  const d = read('src/scenes/dungeonContext.js');
  assert.equal(d.split('applyEliteScaling(entity, e); if (puppet) entity.unquiet = false;').length - 1, 2);
});

// ── the page (A4, C18) ──────────────────────────────────────────────

test('AUQ A4 THE PAGE HEALS ONLY WHERE THEY HEAL: no healing said of the Dread, one out in the world, or while held; a held Dread says held; the cap\'s count is of those that hunt (mutants: each said)', () => {
  const w = { wounds: ['lamed'], woundDay: 10 };
  assert.ok(PG.woundLine(w, DAY * 11, false).endsWith('unless you find it first.'));
  for (const x of [{ ...w, dread: true }, { ...w, out: true }]) assert.equal(PG.woundLine(x, DAY * 11, false), 'Wounds you left: Lamed (a lamed leg, so it runs slower).');
  assert.equal(PG.woundLine(w, DAY * 11, true), 'Wounds you left: Lamed (a lamed leg, so it runs slower).', 'held');
  assert.equal(PG.comeWords({ dread: true, lair: LAIR, dueAt: 0 }, 0, true).tag, 'Held');
  assert.match(read('src/ui/revenant/revenantPage.js'), /divider\(`Revenants \(\$\{living\.filter\(\(r\) => !r\.dread\)\.length\} of \$\{REVENANT_MAX\}\)`\)/);
});

// ── the pools (B1's seam, B11) ──────────────────────────────────────

test('AUQ THE POOLS\' SEAMS: both hand the flee law the foe\'s own frame and the escape its slip (mutants: a seam unwired)', () => {
  assert.ok(read('src/scenes/dungeonContext.js').includes("foeDeps.isLocalPlayerTarget(f.ai.target), dt: foeFrameDt(dt) }) : null;"));
  assert.ok(read('src/scenes/exteriorFoes.js').includes('|| !f.ai._armedTargeting, dt: foeFrameDt(dt) }) : null;'));
});

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
    renderer, collider: new Collider(() => 0),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: p, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    fates: true, dropLoot: () => {}, shake: () => {},
  });
}

test('AUQ B11 THE CRAFT THROUGH THE REAL STREET POOL: a rank-II spriggan breaks and sinks; while the pool stands still (no frame time) it stays, however long the wall runs; frames carry it under - escaped, its record ranked, its card said (mutants: the pool\'s dt unpassed; the craft unrun)', async () => {
  const p = me();
  const r = made(p, { mobileType: M.Spriggan });
  r.rank = 2;
  const pool = rig(p);
  const f = await pool.spawnFoe(M.Spriggan, [0, 0, 6], { feetGiven: true, level: 6, revenant: r });
  const step = (dt) => { T += dt; pool.update(dt, [0, 0, 3], [0, 1.6, 3]); };
  step(0.016);
  f.entity.health = Math.round(f.entity.maxHealth * 0.1);
  const random = Math.random, now = Date.now;
  Math.random = () => 0;
  try { step(0.016); } finally { Math.random = random; }
  assert.ok(f.fleeing, 'it breaks');
  assert.equal(f._craft?.kind, 'sink', 'and sinks');
  const wall = now();
  Date.now = () => wall + 60000;   // a minute of the wall's, the pool held still
  try { for (let i = 0; i < 5; i++) step(0); } finally { Date.now = now; }
  assert.equal(f.dead, false, 'held with the pool');
  for (let i = 0; i < 120 && !f.dead; i++) step(0.016);
  assert.equal(f.escaped, true, 'under: gone');
  assert.equal(N.revenantById(r.id).rank, 3, 'ranked');
  assert.ok(shown.some((e) => e.kind === 'escape'), 'said');
});
