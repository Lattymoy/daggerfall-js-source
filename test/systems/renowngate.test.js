// RENOWN-GATE (2026-10-12, bible/06-Systems/Revenants.md section 39; the owner: "I want to gate elite/revenant spawns
// behind renown level and also slighty reduce the spawn rate of revnants"; asked: "Elites 5, revenants 10", offline
// "Unchanged offline", a shared dungeon "Room's pick stands", the rate "Return chance 50% → 40%").
//
// Pinned: the numbers; the one door (systems/sigil/sigil.js renownOpens - offline open, online from the Renown, never before
// the page knows it); the elites a player stands as its own - the open world's roll, through the real spawn pool, and a
// search's - and the shared dungeon's pick untouched; the revenants held - none made or run, none returned, at home,
// spoken of, marked, hunted or festering, the sworn's days still running and the held days uncounted; the page that
// says so; the hosts, which read the gate only through the laws.

import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

// the app's storage: a plain map in node
const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../src/systems/revenant/revenant.js');
const { ambitionOf, AMBITION } = await import('../../src/systems/revenant/revenantUnquiet.js');   // UNQUIET: the return's share by its ambition
const P = await import('../../src/ui/revenant/revenantPage.js');
const E = await import('../../src/systems/eliteFoes.js');
const { rollSearchElite } = await import('../../src/systems/searchables.js');
const { setSigilOnline, setSigilRenown, renownOpens, _resetSigilForTests } = await import('../../src/systems/sigil/sigil.js');
const { setPref, _resetForTests } = await import('../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../src/systems/worldTick.js');
const { LOYALTY } = await import('../../src/systems/revenant/revenantFeud.js');
const { MOBILE_TYPES: M } = await import('../../src/characters/mobile/mobileTypes.js');
const { createExteriorFoes } = await import('../../src/scenes/exteriorFoes.js');

const read = (p) => hostText(p);
const DAY = 1440;
const me = (id = 'char-renowngate') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const orc = (over = {}) => ({ mobileType: M.Orc, level: 6, health: 5, maxHealth: 50, team: 'Monster', champion: 'mighty', unquiet: true, ...over });
/** The page's door, as scenes/world.js sets it: offline, or online with the Renown it knows (null: not yet). */
const offline = () => setSigilOnline(false);
const online = (renown = null) => { setSigilOnline(true); setSigilRenown(renown); };
/** A revenant made while the gate is open (offline), then left as the test needs it. */
function made(p, { rank = 2, dueAt = 0, lair = null, known = false } = {}) {
  offline();
  const r = N.revenantDeed(p, orc(), 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.rank = rank; r.dueAt = dueAt; r.out = false; r.lair = lair ? { ...lair } : null; r.lairKnown = known;
  return r;
}
const LAIR = Object.freeze({ px: 40, py: 41, name: 'The Pit', region: 5 });
const HERE = Object.freeze({ px: 40, py: 41, region: 5 });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); _resetSigilForTests(); setWorldMinutes(DAY * 5);
});

test('RENOWN-GATE THE NUMBERS: elites at Renown 5, revenants at 10, a due revenant on two encounter rolls in five (mutants: any number moved)', () => {
  assert.deepEqual([E.ELITE_FOE_MIN_RENOWN, N.REVENANT_MIN_RENOWN, N.REVENANT_RETURN_CHANCE], [5, 10, 0.4]);
  assert.ok(N.REVENANT_MIN_RENOWN >= E.ELITE_FOE_MIN_RENOWN, 'a returning elite always finds elites standing');
  assert.equal(E.ELITE_FOE_OVERWORLD_CHANCE, 0.05, 'the open world\'s rate is ELITE-RATES\' - the gate holds it back, it does not thin it');
});

test('RENOWN-GATE THE DOOR: offline always open; online open from the Renown on, never before the page knows it - injected and through the page\'s own door (mutants: offline shut; unknown open; the Renown itself shut)', () => {
  // injected: the law alone
  assert.equal(renownOpens(5, { online: false, renown: null }), true, 'offline: Renown is online\'s own - offline keeps what it had');
  assert.equal(renownOpens(5, { online: false, renown: 1 }), true);
  assert.equal(renownOpens(5, { online: true, renown: null }), false, 'online before the first token: nothing ahead of the Renown behind it');
  assert.equal(renownOpens(5, { online: true, renown: 4 }), false);
  assert.equal(renownOpens(5, { online: true, renown: 5 }), true, 'the Renown itself opens it');
  assert.equal(renownOpens(5, { online: true, renown: 50 }), true);
  // the page's door (sigil.js setSigilOnline / setSigilRenown, which scenes/world.js sets), read with no word passed
  const both = () => [E.eliteRenownOpen(), N.revenantHeld()];
  assert.deepEqual(both(), [true, false], 'offline: elites stand, revenants come');
  online(null); assert.deepEqual(both(), [false, true], 'online, the Renown not known yet: both held');
  online(4); assert.deepEqual(both(), [false, true]);
  online(5); assert.deepEqual(both(), [true, true], 'Renown 5: elites');
  online(9); assert.deepEqual(both(), [true, true]);
  online(10); assert.deepEqual(both(), [true, false], 'Renown 10: revenants too');
  offline(); assert.deepEqual(both(), [true, false], 'offline again: the door forgets the Renown, and nothing is held');
});

test('RENOWN-GATE THE OPEN WORLD\'S ROLL: one in twenty from Renown 5 online, as ever offline - the roll drawn either way (mutants: the gate dropped; the gate before the draw; the revenants\' Renown read)', () => {
  let draws = 0;
  const at = (v) => () => { draws++; return v; };
  assert.equal(E.rollOverworldElite(at(0)), true, 'offline');
  online(4);
  assert.equal(E.rollOverworldElite(at(0)), false, 'online under Renown 5: none');
  online(null);
  assert.equal(E.rollOverworldElite(at(0)), false, 'online, not known yet: none');
  online(5);
  assert.equal(E.rollOverworldElite(at(0.0499)), true, 'Renown 5: the one in twenty');
  assert.equal(E.rollOverworldElite(at(0.05)), false, 'strict');
  assert.equal(draws, 5, 'every ask draws once, held or not - the same dice either way');
});

// the open world's pool on a crafted MONSTER.BSA (test/systems/bal_arc.test.js's rig): an Orc Warlord (base level 16 - past
// ELITE-FLOOR) built in the wilds, `inLocation` false, with Math.random low enough for the one in twenty
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const out = new Uint8Array(4 + records.reduce((a, [, b]) => a + b.length, 0) + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const BSA = craftMonsterBsa([['ENEMY024.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const wildsPool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (f) => f },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return BSA; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 12, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: stats() },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  inLocation: () => false,
});
const withRandom = async (v, fn) => { const old = Math.random; Math.random = () => v; try { return await fn(); } finally { Math.random = old; } };
const stand = (opts = {}) => withRandom(0.01, () => wildsPool().spawnFoe(24, [10, 0, 10], { feetGiven: true, champion: null, ...opts }));

test('RENOWN-GATE THE OPEN WORLD BY EXECUTION: the real spawn pool stands an elite offline and from Renown 5 online, a plain foe under it and before the Renown is known; a saved foe\'s word stands whatever the Renown (mutants: the gate dropped; a saved elite re-rolled)', async () => {
  const off = await stand();
  assert.equal(off.entity.eliteFoe, true, 'offline: BAL4\'s elite, as ever');
  online(4);
  const under = await stand();
  assert.ok(under?.entity, 'the foe stands');
  assert.equal(!!under.entity.eliteFoe, false, 'online under Renown 5: plain');
  // the wilds' place scales both after the promotion and rounds, so the health is read off what was stood on the kind's
  // own (TELL1's healthMult - the place never writes it) and the blows off the ratio
  assert.equal(off.entity.healthMult ?? 1, E.ELITE_FOE_HEALTH_MULT * (under.entity.healthMult ?? 1), 'the five times not stood');
  const blows = (f) => (Number.isFinite(f.entity.damageScale) ? f.entity.damageScale : 1);
  assert.ok(Math.abs(blows(off) / blows(under) - E.ELITE_FOE_DAMAGE_MULT) < 1e-9, 'nor the three times');
  online(null);
  assert.equal(!!(await stand()).entity.eliteFoe, false, 'online, the Renown not known yet: plain');
  online(5);
  assert.equal((await stand()).entity.eliteFoe, true, 'Renown 5: the elite');
  online(1);
  assert.equal((await stand({ eliteFoe: true })).entity.eliteFoe, true, 'a save\'s word is its own - never re-rolled, so never held');
});

test('RENOWN-GATE A SEARCH\'S ROLL: a woken elite from the searcher\'s Renown 5 online, as ever offline, never with the ladder off - the roll drawn either way (mutants: the gate dropped)', () => {
  let draws = 0;
  const roll0 = () => { draws++; return 0; };
  assert.equal(rollSearchElite(roll0), true, 'offline, the ladder on');
  online(4);
  assert.equal(rollSearchElite(roll0), false, 'online under Renown 5: none');
  online(5);
  assert.equal(rollSearchElite(roll0), true, 'Renown 5');
  setPref('lootRarity', false);
  online(50);
  assert.equal(rollSearchElite(roll0), false, 'the ladder off: none, whatever the Renown');
  assert.equal(draws, 4, 'one draw an ask - a search\'s dice the same either way');
});

test('RENOWN-GATE THE SHARED DUNGEON\'S PICK STANDS: every client builds it alike and the room carries no elite word, so no Renown reads it - the same records at Renown 1 as offline (mutants: the pick held)', () => {
  const list = () => Array.from({ length: 14 }, () => ({ mobileType: 24, x: 0, y: 0, z: 0 }));
  const picked = (enemies) => enemies.flatMap((e, i) => (e.eliteFoe ? [i] : []));
  offline();
  const a = list(); const na = E.pickDungeonElites(a, 'dungeon-7', { elite: true });
  online(1);
  const b = list(); const nb = E.pickDungeonElites(b, 'dungeon-7', { elite: true });
  assert.ok(na >= E.ELITE_FOE_DUNGEON_MIN, 'an Elite Dungeon\'s three or four');
  assert.equal(nb, na);
  assert.deepEqual(picked(b), picked(a), 'the room\'s pick, whoever builds it');
});

test('RENOWN-GATE HELD, NONE IS MADE OR RUNS: under Renown 10 online no special foe becomes a revenant, flees or keeps a ledger - a flight that could make none would only rob a kill; at 10 and offline, as ever (mutants: the candidate\'s gate dropped)', () => {
  const p = me();
  online(9);
  assert.equal(N.revenantCandidate(orc()), false, 'a champion: held');
  assert.equal(N.revenantCandidate(orc({ champion: undefined, eliteFoe: true })), false, 'an elite: held');
  assert.equal(N.rollRevenantFlee(orc(), () => 0), false, 'none runs');
  const f = { entity: orc(), ai: { isHostile: true, feet: [0, 0, 0], fleeLeft: 0, flee() { f.ran = true; } } };
  assert.equal(N.revenantFleeStep(f, [1, 0, 1], { rolls: () => 0 }), null, 'under its line it fights on');
  assert.equal(!!f.ran || !!f.fleeing, false);
  assert.equal(N.revenantDeed(p, orc(), 'slew', { mobileType: M.Orc, rolls: () => 0 }), null, 'its kill makes none');
  assert.equal(N.livingRevenants().length, 0);
  online(10);
  assert.equal(N.revenantCandidate(orc()), true, 'Renown 10');
  assert.equal(N.revenantFleeStep(f, [1, 0, 1], { rolls: () => 0 }), 'start', 'and now it runs');
  assert.ok(N.revenantDeed(p, orc(), 'slew', { mobileType: M.Orc, rolls: () => 0 }), 'and a kill makes one');
  offline();
  assert.equal(N.revenantCandidate(orc()), true, 'offline: as ever');
});

test('RENOWN-GATE HELD, NONE RETURNS: a due revenant takes no roll and is never claimed under Renown 10; from 10 on two rolls in five (mutants: the return\'s gate dropped; the chance moved either way)', () => {
  const p = me();
  const r = made(p, { dueAt: 0 });
  r.personality = 'cold';   // AUDIT UNQUIET (Revenants.md section 49): one ambition, every run - not vengeance, its share REVENANT_RETURN_CHANCE
  const now = DAY * 9;
  online(9);
  assert.equal(N.revenantToReturn(p, { now, rolls: () => 0 }), null, 'held');
  assert.equal(r.out, false, 'and not claimed');
  online(10);
  assert.notEqual(ambitionOf(r.personality), 'vengeance');
  const chance = N.REVENANT_RETURN_CHANCE;   // UNQUIET (Revenants.md section 46): a revenant of vengeance takes more of the rolls (AMBITION.VENGEANCE_RETURN - unquiet.test.js)
  assert.equal(N.revenantToReturn(p, { now, rolls: () => chance }), null, 'the roll at its share passes it by');
  assert.equal(r.out, false);
  assert.equal(N.revenantToReturn(p, { now, rolls: () => chance - 0.01 }), r, 'under it, it comes');
  assert.equal(r.out, true, 'claimed');
  N.releaseRevenantStand(r);
  offline();
  assert.equal(N.revenantToReturn(p, { now, rolls: () => 0.39 }), r, 'offline: as ever, at the same two in five');
});

test('RENOWN-GATE HELD, NONE AT HOME: entering its lair, a rest\'s ask too, stands none and claims none under Renown 10 (mutants: the lair\'s gate dropped)', () => {
  const p = me();
  const r = made(p, { dueAt: 0, lair: LAIR, known: true });
  online(9);
  assert.equal(N.revenantForLair(p, HERE, { now: DAY * 9 }), null, 'held: not at home');
  assert.equal(N.revenantForLair(p, HERE, { now: DAY * 9, dueOnly: true }), null, 'a rest\'s ask: held too');
  assert.equal(r.out, false, 'never claimed');
  online(10);
  assert.equal(N.revenantForLair(p, HERE, { now: DAY * 9 }), r, 'Renown 10: at home');
});

test('RENOWN-GATE HELD, NO WORD, NO MARK, NO HUNT: the towns say nothing of a held one (the person\'s answer unspent, the lair unlearned), the maps mark no lair, the log holds no hunt; from Renown 10 all three (mutants: each gate dropped)', () => {
  const p = me();
  const r = made(p, { dueAt: 0, lair: LAIR, known: true });
  const q = made(p, { dueAt: 0, lair: { px: 42, py: 41, name: 'Old Barrow', region: 5 }, known: false });
  online(9);
  const s = { numAnswersGivenTellMeAboutOrRumors: 0, isSpyMaster: false };
  assert.equal(N.revenantRumor(HERE, s, { rolls: () => 0 }), null, 'no word - the mill\'s turn');
  assert.equal(s.numAnswersGivenTellMeAboutOrRumors, 0, 'the person\'s one answer unspent');
  assert.equal(q.lairKnown, false, 'nothing learned');
  assert.deepEqual(N.revenantMapMarks(), [], 'no lair on the maps');
  assert.deepEqual(N.revenantHuntEntries({ px: 30, py: 30 }), [], 'no hunt in the log');
  online(10);
  assert.deepEqual(N.revenantMapMarks().map((m) => m.id), [r.id], 'Renown 10: the known lair marked');
  assert.deepEqual(N.revenantHuntEntries({ px: 30, py: 30 }).map((h) => h.name), [`Hunt: ${r.name}`]);
  assert.match(N.revenantRumor(HERE, s, { rolls: () => 0 }) ?? '', /They say/, 'and the towns speak of one');
});

test('RENOWN-GATE HELD, NONE FESTERS: a held one gains no wrath on its days and its held days are not caught up when the gate opens; the sworn\'s days run all the while (mutants: the hunters\' loop ungated; the held days counted later)', () => {
  const p = me();
  const r = made(p, { rank: 1, dueAt: DAY * 10 + 300 });   // due day 10: a wrath on days 13, 16, 19...
  r.wrath = 0;
  const e = orc();
  const sworn = N.revenantDeed(p, e, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(N.revenantSpared(p, { revenant: { id: sworn.id } }, { state: 'with' }), 'one sworn, walking with me');
  const start = sworn.companion.loyalty;
  const at = (day) => ({ now: DAY * day + 60, rolls: () => 0.99 });   // no desertion roll lands
  N.revenantFester(p, at(14));   // the first count: from here
  online(9);
  N.revenantFester(p, at(16));
  assert.equal(r.wrath, 0, 'day 16 held: no wrath');
  assert.equal(sworn.companion.loyalty, Math.min(100, start + 2 * LOYALTY.DAY_WITH), 'the sworn\'s two days ran');
  online(10);
  N.revenantFester(p, at(17));
  assert.equal(r.wrath, 0, 'the gate opens on day 17: the held day 16 is not caught up');
  N.revenantFester(p, at(19));
  assert.equal(r.wrath, 1, 'day 19: festering again, on its own days');
});

test('RENOWN-GATE HELD, NONE TURNS: a sworn one at the edge of betrayal stays sworn under Renown 10 - its turning would stand a hostile revenant beside me - and turns from 10 on; a desertion stands nothing, and runs (mutants: the betrayal\'s gate dropped)', () => {
  const p = me();
  const r = made(p, { rank: 1 });
  assert.ok(N.revenantSpared(p, { revenant: { id: r.id } }, { state: 'with' }), 'sworn');
  online(9);
  assert.equal(N.revenantBetrays(p, r, { now: DAY * 6, rolls: () => 0 }), null, 'held: no turning');
  assert.equal(r.sworn, true, 'still at my side');
  online(10);
  assert.equal(N.revenantBetrays(p, r, { now: DAY * 6, rolls: () => 0 }), r, 'Renown 10: it turns');
  assert.equal(r.sworn, false);
  const d = made(p, { rank: 1 });
  assert.ok(N.revenantSpared(p, { revenant: { id: d.id } }, { state: 'with' }));
  online(9);
  assert.equal(N.revenantDeserts(p, d, { now: DAY * 6, rolls: () => 0 }), d, 'a desertion leaves - it stands no foe, and its return is held');
  assert.equal(N.revenantToReturn(p, { now: DAY * 99, rolls: () => 0 }), null, 'held');
});

test('RENOWN-GATE THE PAGE SAYS SO: a held one is Held, "not before Renown 10" - never Hunting on any road nor coming in days; its lair promised on no map nor by the towns; none, and the page says from when (mutants: the held words dropped; the door unread; the lair\'s words; the note)', () => {
  const r = { dueAt: -1, lair: { name: 'The Pit' }, lairKnown: true };
  assert.deepEqual(P.comeWords(r, 0, true), { tag: 'Held', cls: 'is-waiting', line: 'It will not come for you before Renown 10.' });
  assert.equal(P.comeWords({ dueAt: 2 * DAY }, 0, true).tag, 'Held', 'not "in about 2 days" either');
  assert.equal(P.comeWords({ out: true }, 0, true).tag, 'Abroad', 'one standing is standing');
  assert.equal(P.comeWords(r, 0, false).tag, 'Hunting', 'open: as ever');
  online(9); assert.equal(P.comeWords(r, 0).tag, 'Held', 'the page\'s door read');
  online(10); assert.equal(P.comeWords(r, 0).tag, 'Hunting');
  assert.equal(P.lairWords(r, true), 'Lair: The Pit.', 'held: no map promised');
  assert.equal(P.lairWords({ lair: { name: 'The Pit' }, lairKnown: false }, true), 'Lair: unknown.', 'nor the towns');
  assert.equal(P.lairWords(r, false), 'Lair: The Pit, marked on your map.');
  online(9); assert.equal(P.lairWords(r), 'Lair: The Pit.', 'the page\'s door read');
  online(10); assert.equal(P.lairWords(r), 'Lair: The Pit, marked on your map.');
  // none: the note
  const note = () => {
    const kids = [];
    const node = (text = '') => ({ text, children: kids, append: (...c) => kids.push(...c) });
    const el = (tag, cls, text) => ({ tag, cls, textContent: text ?? '', append() {} });
    const detail = node();
    P.drawRevenantsPage(detail, () => {}, { el, divider: (w) => el('div', 'px-divider', w), player: me('char-none') });
    return kids.map((k) => k.textContent).join(' | ');
  };
  online(9);
  assert.match(note(), /No foe has earned your name yet\. From Renown 10, an elite or champion marked Unquiet that escapes you, or kills you, will remember you and come back for you\./);   // UNQUIET (Revenants.md section 46): only the marked rise
  online(10);
  assert.match(note(), /No foe has earned your name yet\. An elite or champion marked Unquiet that escapes you/);
});

test('RENOWN-GATE THE HOSTS: the gate lives in the laws - the open world\'s call and a save\'s word in the pool, both searches\' one roll, the dungeon\'s pick never asked; the page\'s door set by the streaming world alone, the bench offline, the interiors\' one elite the arena\'s bout; no host reads the gate itself', () => {
  const pool = read('src/scenes/exteriorFoes.js');
  assert.match(pool, /\(revenant \? revenant\.elite : rollOverworldElite\(Math\.random\)\)\) promoteEliteFoe\(entity\);/, 'the open world: the roll the gate lives in; a revenant as what it was');
  assert.match(pool, /if \(eliteFoe === true && !allied\) promoteEliteFoe\(entity\);/, 'a save\'s word: never re-rolled');
  const world = hostText('src/scenes/world.js'), dc = read('src/scenes/dungeonContext.js'), grave = read('src/scenes/searchPartyHost.js');   // PIN MOVED (FIELD BUGS 2026-10-16b GRAVE-PARTY): the headstone's search left world.js's bootWorld for scenes/searchPartyHost.js
  for (const [name, src] of [['searchPartyHost.js', grave], ['dungeonContext.js', dc]]) assert.match(src, /const elite = rollSearchElite\(\);/, `${name}: a search's one roll`);
  const pick = dc.split('\n').find((l) => l.includes('pickDungeonElites(enemies'));
  assert.ok(pick && /elitesAllowed\(\{ onlinePage: isOnlinePage\(\), inRoom: opts\.selfId\?\.\(\) != null \}\)\) pickDungeonElites\(/.test(pick), 'the dungeon\'s pick, the room\'s');
  assert.match(world, /setSigilOnline\(params\.has\('online'\)\);/, 'the door: online from the page\'s word');
  assert.match(world, /setSigilRenown\(level\);/, 'and the Renown as it is adopted');
  assert.doesNotMatch(read('src/scenes/exterior.js'), /setSigilOnline\(/, 'the bench never goes online: open, as offline is');
  const modes = read('src/scenes/worldModes.js');
  assert.doesNotMatch(modes, /rollOverworldElite|rollSearchElite|pickDungeonElites/, 'the interiors roll no elite of their own');
  assert.equal((modes.match(/eliteFoe: !!o\.elite \}\) \?\? null,   \/\/ AUDIT ARENA-LADDER: a tier champion stands as an elite/g) ?? []).length, 2, 'the arena\'s bout: its tier champion, the sand\'s and the pit\'s');
  for (const f of readdirSync(new URL('../../src/scenes/', import.meta.url), { recursive: true }).filter((x) => x.endsWith('.js'))) {
    assert.doesNotMatch(read(`src/scenes/${f}`), /\b(renownOpens|eliteRenownOpen|revenantHeld)\(/, `${f} reads the gate only through the laws`);
  }
});
