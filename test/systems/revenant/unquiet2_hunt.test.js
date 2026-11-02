// UNQUIET II (bible/06-Systems/Revenants.md section 47; the owner, 2026-10-18: "Keep building", of UNQUIET's "we need to
// go deeper on the experience"). THE TRAIL: an escape with a lair to go to leaves a warm trail - its lair known at once,
// and found there within twelve hours it is still wounded, at 60% of its health. OMENS: the day it is due, a card says it
// is coming, in its ambition's words. THE DREAD'S TROPHY: Legendary always. Pinned: the numbers; the trail through the
// real deed (who leaves one, who never does), saved; the escape's card; the stand found on it and the trail followed; the
// hunt's line and the page's; the omen through the real notice step (once a due day, by ambition, never for the out, the
// Dread, the sworn, the held or the switch off); the Dread's trophy; the card's edge.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const U = await import('../../../src/systems/revenant/revenantUnquiet.js');
const PG = await import('../../../src/ui/revenant/revenantPage.js');
const { revenantTrophy } = await import('../../../src/systems/revenant/revenantTrophy.js');
const { REVENANT_CARD_CSS } = await import('../../../src/ui/revenant/revenantCard.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');

const DAY = 1440;
const me = (id = 'char-unquiet2') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const foe = (over = {}) => ({ mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster', ...over });
const LAIR = Object.freeze({ px: 106, py: 100, name: 'Tomb of Vaness', region: 3 });
const HERE = { px: 100, py: 100, dungeons: [{ px: LAIR.px, py: LAIR.py, name: LAIR.name, region: LAIR.region }] };

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(DAY * 10);
});
/** The door with a lair about it, as the open world's (its map pixel and the dungeons in reach). */
const door = (here = HERE) => setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, lairHere: () => here });
function made(p, { deedName = 'fled', personality = 'brutal', now = DAY * 10 } = {}) {
  const r = N.revenantDeed(p, foe(), deedName, { mobileType: M.Orc, rolls: () => 0, now });
  assert.ok(r, 'born');
  r.personality = personality;
  return r;
}
const again = (p, r, deedName, now) => N.revenantDeed(p, foe({ revenant: { id: r.id } }), deedName, { mobileType: M.Orc, rolls: () => 0, now });

test('UNQUIET II THE NUMBERS: a trail warm twelve hours, its stand at 60% of its health; warm, its hours rounded up; read back whole (mutants: each number; the Dread\'s trail warm; the hours down)', () => {
  assert.deepEqual({ ...U.HUNT }, { MINUTES: 720, HEALTH: 0.6 });
  assert.deepEqual([U.trailWarm({ trail: 100 }, 99), U.trailWarm({ trail: 100 }, 100), U.trailWarm({ trail: 0 }, -5), U.trailWarm({ trail: 100, dread: true }, 0), U.trailWarm(null, 0)], [true, false, false, false, false]);
  assert.deepEqual([U.trailHours({ trail: 720 }, 0), U.trailHours({ trail: 720 }, 659), U.trailHours({ trail: 720 }, 660), U.trailHours({ trail: 720 }, 720)], [12, 2, 1, 0]);
  assert.deepEqual([U.sanitizeTrail(100.7), U.sanitizeTrail(-1), U.sanitizeTrail('9'), U.sanitizeTrail(undefined)], [100, 0, 0, 0]);
});

test('UNQUIET II THE TRAIL: an escape with a lair leaves it warm for twelve hours and its lair known; a kill, my flight or no lair leave none; the Dread\'s escape none, nor its ascent; the trail rides the save (mutants: the trail unset; the lair unknown; on a kill; with no lair; the Dread\'s; unsaved)', () => {
  const p = me();
  door();
  const r = made(p, { now: DAY * 10 });
  assert.equal(r.trail, DAY * 10 + U.HUNT.MINUTES, 'born of flight: its trail');
  assert.equal(r.lairKnown, true, 'its lair known at once');
  assert.deepEqual(r.lair, { ...LAIR });
  restoreModSaveRecords(modSaveRecords());
  assert.equal(N.revenantsFor(p).find((x) => x.id === r.id).trail, DAY * 10 + U.HUNT.MINUTES, 'saved');
  const k = made(p, { deedName: 'slew', now: DAY * 11 });
  assert.deepEqual([k.trail, k.lairKnown], [0, false], 'a kill: no trail');
  const q = N.revenantsFor(p).find((x) => x.id === r.id);
  q.trail = 0; q.lairKnown = false;
  again(p, q, 'routed', DAY * 12);
  assert.deepEqual([q.trail, q.lairKnown], [0, false], 'my flight: none');
  N._resetRevenantForTests(); _store.clear();
  setPlayerDoor(null);
  const n = made(p, { now: DAY * 10 });
  assert.deepEqual([n.lair, n.trail], [null, 0], 'no lair to go to: no trail');
  // the Dread: its ascent leaves none, nor any escape after
  door();
  const d = made(p, { now: DAY * 20 });
  d.rank = 5; d.trail = 0;
  again(p, d, 'fled', DAY * 21);
  assert.equal(d.dread, true);
  assert.equal(d.trail, 0, 'ascended: at home for good, no trail');
  again(p, d, 'fled', DAY * 22);
  assert.equal(d.trail, 0, 'the Dread never leaves one');
});

test('UNQUIET II THE ESCAPE\'S CARD: where its trail leads, after its wound; a cold trail says none (mutants: unsaid; said cold)', () => {
  const p = me();
  door();
  setWorldMinutes(DAY * 10);
  const r = made(p, { now: DAY * 10 });
  const ev = N.revenantEscapeEvent(r, 'Ayla', { rolls: () => 0 });
  // PIN MOVED (AUDIT UNQUIET, section 49): it recovers - "heal" is its wounds' word, on their own law
  assert.ok(ev.body.endsWith(' Its trail leads to Tomb of Vaness, where it has gone to ground to recover. Catch it before it is whole again.'), ev.body);
  assert.ok(ev.line.endsWith('Catch it before it is whole again.'), 'the line too');
  setWorldMinutes(DAY * 10 + U.HUNT.MINUTES);
  assert.ok(!N.revenantEscapeEvent(r, 'Ayla', { rolls: () => 0 }).body.includes('trail'), 'cold');
});

test('UNQUIET II FOUND ON ITS TRAIL: entering its lair while the trail is warm it is there, at 60% of its health - the trail followed whatever comes of it; cold, it stands whole (mutants: the health unread; the trail kept; cold stood wounded)', () => {
  const p = me();
  door();
  const r = made(p, { now: DAY * 10 });
  r.dueAt = DAY * 30;
  const home = N.revenantForLair(p, { px: LAIR.px, py: LAIR.py }, { now: DAY * 10 + 60 });
  assert.equal(home?.id, r.id, 'there - its lair known by its trail, though not due');
  const e = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100 };
  N.applyRevenant(e, r, { now: DAY * 10 + 60 });
  assert.equal(e.health, Math.round(e.maxHealth * U.HUNT.HEALTH), 'not yet healed');
  assert.equal(e.revenant.wounded, undefined, 'PIN MOVED (AUDIT UNQUIET): no flag nothing read - its health says it');
  assert.equal(r.trail, 0, 'the trail followed');
  // cold: whole
  const q = made(p, { now: DAY * 11 });
  const g = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100 };
  N.applyRevenant(g, q, { now: DAY * 11 + U.HUNT.MINUTES });
  assert.equal(g.health, g.maxHealth, 'healed');
  assert.equal(q.trail, 0);
});

test('UNQUIET II THE HUNT AND THE PAGE: while the trail is warm its hunt says so with the hours left, and the page says "Weakened" - gone to ground, and where; cold, neither; held, the page says held (mutants: the hunt\'s line unsaid; the page\'s; held overridden)', () => {
  const p = me();
  door();
  const r = made(p, { now: DAY * 10 });
  r.dueAt = DAY * 30;
  const hunt = (now) => N.revenantHuntEntries({ px: 100, py: 100 }, { now }).find((h) => h.id.endsWith(r.id));
  const lines = (now) => hunt(now).messages[0].map((l) => l.text);
  // PIN MOVED (AUDIT UNQUIET, section 49): "Weakened", recovering - its wounds are the player's, healing on their own law
  assert.ok(lines(DAY * 10).includes('Weakened, it went to ground here to recover. It will be whole again in 12 hours.'));
  assert.ok(lines(DAY * 10 + 690).includes('Weakened, it went to ground here to recover. It will be whole again in 1 hour.'));
  assert.ok(!lines(DAY * 10 + U.HUNT.MINUTES).some((l) => l.startsWith('Weakened')), 'cold');
  const w = PG.comeWords(r, DAY * 10 + 60, false);
  assert.deepEqual(w, { tag: 'Weakened', cls: '', line: 'Recovering in Tomb of Vaness, whole again in 11 hours. Find it there.' });
  assert.notEqual(PG.comeWords(r, DAY * 10 + U.HUNT.MINUTES, false).tag, 'Weakened', 'cold');
  assert.equal(PG.comeWords(r, DAY * 10 + 60, true).tag, 'Held', 'held: none found in its lair either');
});

test('UNQUIET II OMENS: the day it is due the notice step says it is coming, in its ambition\'s words - once a due day, again at its next; a card waiting first; never one out, the Dread, the sworn, held or the switch off (mutants: no omen; every tick; the ambition unread; each exclusion dropped)', () => {
  const p = me();
  const r = made(p, { personality: 'brutal' });
  r.dueAt = DAY * 12; r.notice = null;
  assert.equal(N.takeRevenantNotice(p, { now: DAY * 11 }), null, 'not due');
  const ev = N.takeRevenantNotice(p, { now: DAY * 12 });
  assert.equal(ev.kind, 'omen');
  assert.equal(ev.kicker, 'An omen');
  assert.equal(ev.body, `You feel eyes on your back. ${r.given} is hunting you again.`);
  assert.equal(ev.line, ev.body);
  assert.equal(N.takeRevenantNotice(p, { now: DAY * 12 + 30 }), null, 'once a due day');
  restoreModSaveRecords(modSaveRecords());
  assert.equal(N.takeRevenantNotice(p, { now: DAY * 12 + 60 }), null, 'remembered through the save');
  const x = N.revenantsFor(p).find((y) => y.id === r.id);
  x.dueAt = DAY * 15;
  assert.ok(N.takeRevenantNotice(p, { now: DAY * 15 }), 'its next due day: again');
  for (const [a, words] of [['cold', `Word reaches you that ${x.given} is ready to face you again.`], ['witty', `Travelers speak of ${x.given} on the roads again. It is coming for you.`]]) {
    x.personality = a; x.dueAt += DAY;
    assert.equal(N.takeRevenantNotice(p, { now: x.dueAt }).body, words, a);
  }
  // a card waiting is said first
  x.dueAt += DAY; x.notice = 'festered';
  assert.equal(N.takeRevenantNotice(p, { now: x.dueAt }).kind, 'festered');
  assert.equal(N.takeRevenantNotice(p, { now: x.dueAt }).kind, 'omen', 'then the omen');
  // never for these
  const none = (fn) => { x.dueAt += DAY; fn(); return N.takeRevenantNotice(p, { now: x.dueAt }); };
  assert.equal(none(() => { x.out = true; }), null, 'out');
  x.out = false;
  assert.equal(none(() => { x.dread = true; }), null, 'the Dread');
  x.dread = false;
  assert.equal(none(() => setPref('lootRarity', false)), null, 'the switch off');
  setPref('lootRarity', true);
  assert.equal(none(() => { x.sworn = true; }), null, 'sworn');
});

test('UNQUIET II THE DREAD\'S TROPHY: Legendary always; another\'s by its rank (mutants: the Dread unread)', () => {
  const n = (dread) => revenantTrophy({ id: 'trophy-x', rank: 5, mobileType: M.Orc, dread, given: 'Grushnak' }, { level: 10, rolls: () => 0.999 });
  assert.equal(n(true).rarity, 'legendary');
  assert.notEqual(n(false).rarity, 'legendary', 'the same rolls: another is no Legendary');
});

test('UNQUIET II THE CARD\'S EDGE: an omen a dusk blue (mutants: the edge lost)', () => {
  assert.match(REVENANT_CARD_CSS, /\.rvncard\.is-omen \{ border-left-color: #5c6f94; \}/);
});
