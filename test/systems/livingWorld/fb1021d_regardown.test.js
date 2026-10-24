// FIELD BUGS 2026-10-21d REGARD-OWN (lumin, the Discord's #bug-reports, "Family System appears to be broken": "I cannot
// raise the disposition of NPCs at all by talking to them. I can raise it, then after a while it resets back to
// baseline"). A resident's regard eased half a point a day apart and a word counted once a day - in the SKY's days, which
// online are a real hour each and run while the player is away: an evening's friendship was nought by the next evening,
// the Courtship row's +40 (legacy/marriage.js FRIEND_AT) never reached, a word counted once a real hour. Now the regard
// counts the character's own days (systems/livingWorld/regardClock.js), which stand while they are away (LIVED1).
// The record: bible/01-Overview/bugs/Field-Bugs-2026-10-21d.md.
//
// The real street (LivingTown over the test town, its talk path handing the relations the sky's living day) on the real
// online sky (net/skyLaw.js skyClassicMinutes at wall instants), beside the character's own clock: twelve of its minutes a
// real second while played, standing while logged off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { skyClassicMinutes } from '../../../src/net/skyLaw.js';
import { synthTown } from '../../lwTown.mjs';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../../../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { createRelations, FRIEND_AT, EVENTS } from '../../../src/systems/livingWorld/relations.js';
import { characterRelations, regardDayOf, REGARD_CLOCK, FRIENDS_SAID_MAX } from '../../../src/systems/livingWorld/regardClock.js';
import { toneTaste } from '../../../src/systems/talk/talkTopics.js';
import { friendLine, friendCards } from '../../../src/systems/livingWorld/friendWord.js';
import { residentOfId } from '../../../src/systems/livingWorld/people.js';
import { createTownTalk } from '../../../src/scenes/townTalk.js';
import { ChoiceWindow } from '../../../src/ui/talkWindow.js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const H = 3600e3;
const OWN_PER_REAL_H = 12 * 60;   // the character's own minutes a real hour played (TimeScale 12)
const RATE = 24 / 60;   // the sky's classic minutes a real second online

/** The own clock's first minute of its day 416 (a regard's day starts at 04:00). */
const DAY_416 = 240 + 416 * 1440;
/** A word in the tone townsfolk take kindly (TONE-TASTE: Blunt - DFU's streetwise table, a commoner's group). */
const BLUNT = toneTaste(2, 0);

/** An evening's street in Daggerfall, online: the sky at the wall's instant, the own clock run while played. */
function street(own = DAY_416 + 720) {
  const at = { wall: Date.UTC(2026, 9, 21, 18, 35, 0), own };
  const sky = () => skyClassicMinutes(at.wall);
  const relations = characterRelations(null, () => at.own, true);
  const { nav, buildings, doors } = synthTown();
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
    clock: sky, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, relations: () => relations, playerName: () => 'Lumin', townName: 'Synth', regionName: 'Daggerfall',
  });
  const SQ = [96 * 1.6 + 0.8, 0, 96 * 1.6 + 0.8];
  let seats = [];
  for (let i = 0; i < 120; i++) { at.wall += 1000 / 30; seats = town.update(1 / 30, SQ, 0, SQ, true, () => false); }
  const person = seats.map((s) => s.person).find((p) => p.living?.res?.roll === 'h' && !p.living.res.guard);
  assert.ok(person, 'a resident on the square');
  /** Played: the wall and the own clock together. Away: the wall alone. */
  const play = (h) => { at.wall += h * H; at.own += h * OWN_PER_REAL_H; };
  const away = (h) => { at.wall += h * H; };
  return { at, sky, town, person, id: person.living.id, relations, play, away };
}

test('REGARD-OWN: the report - an evening of words, a day logged off, and the regard stands where it was left; ten evenings of a word a day reach a friend (the Courtship row) - on the sky every evening began at nought (mutants: the wrapper reading the caller\'s sky day, the host on createRelations)', () => {
  const s = street();
  for (let h = 0; h < 3; h++) { s.town.talked(s.person); s.play(1); }
  const left = s.relations.regard(s.id);
  // three real hours from mid-day 416: a word on day 416 (3), on 417 (eased a day apart, 2.5 + 3), the third on 417
  // again (once a day), read on 418 (5.5 eased half a point)
  assert.equal(left, 2 * EVENTS.talk - 2 * 0.5, `two own days of words in three real hours: ${left}`);
  s.away(24);
  assert.equal(s.relations.regard(s.id), left, 'a day logged off: the sky ran a day of days, the regard stands');
  assert.equal(s.town.regardCard(s.person).regard, left, 'and the street reads it so - its card hands in the sky\'s day');
  // the same evenings, three real hours each and the rest of the day away: the regard at each login
  const trail = [];
  for (let night = 0; night < 12; night++) {
    for (let h = 0; h < 3; h++) { s.town.talked(s.person); s.town.toned(s.person, BLUNT); s.play(1); }
    s.away(21);
    trail.push(Math.trunc(s.relations.regard(s.id)));
  }
  assert.ok(trail.every((r, i) => i === 0 || r >= trail[i - 1]), `it climbs: ${trail.join(' ')}`);
  assert.ok(trail.some((r) => r >= FRIEND_AT), `a friend - the Courtship row - within twelve evenings: ${trail.join(' ')}`);
  // the sky's days, as the host counted them before: the same evenings come back to nought every login
  const sky = createRelations();
  let wall = s.at.wall;
  const skyDay = (w) => Math.floor((skyClassicMinutes(w) - 240) / 1440);
  const before = [];
  for (let night = 0; night < 12; night++) {
    for (let h = 0; h < 3; h++) { sky.note(s.id, 'talk', skyDay(wall)); sky.note(s.id, 'polite', skyDay(wall)); wall += H; }
    wall += 21 * H;
    before.push(Math.trunc(sky.regard(s.id, skyDay(wall))));
  }
  assert.ok(before.every((r) => r === 0), `on the sky: ${before.join(' ')}`);
});

test('REGARD-OWN: a word counts once a day of the CHARACTER\'s - two words a real hour apart (a whole sky day on, the same own day) count once', () => {
  const s = street(DAY_416 + 10);
  s.town.talked(s.person);
  const one = s.relations.regard(s.id);
  const skyDay = Math.floor((s.sky() - 240) / 1440);
  s.play(1);
  assert.equal(Math.floor((s.sky() - 240) / 1440), skyDay + 1, 'a real hour: the next sky day');
  assert.equal(regardDayOf(s.at.own), 416, 'and the same own day');
  s.town.talked(s.person);
  assert.equal(s.relations.regard(s.id), one, 'the same own day: nothing more');
  s.play(1);
  assert.equal(regardDayOf(s.at.own), 417);
  s.town.talked(s.person);
  assert.equal(s.relations.regard(s.id), one - 0.5 + EVENTS.talk, 'the next own day: the word counts');
});

test('REGARD-OWN: offline the own clock is the sky - the seam is the relations it wraps, step for step; the save carries the mark', () => {
  let m = 500000;
  const wrapped = characterRelations(null, () => m, false);
  const plain = createRelations();
  const day = () => regardDayOf(m);
  for (let i = 0; i < 40; i++) {
    const kind = ['talk', 'polite', 'insulted', 'gift'][i % 4];
    if (kind in EVENTS) { wrapped.note('L1.a', kind, -999); plain.note('L1.a', kind, day()); }
    m += 700;
    assert.equal(wrapped.regard('L1.a'), plain.regard('L1.a', day()), `step ${i}`);
    assert.equal(wrapped.standing('L1.a'), plain.standing('L1.a', day()));
  }
  const snap = wrapped.snapshot();
  assert.equal(snap.clock, REGARD_CLOCK);
  assert.deepEqual({ ...snap, clock: undefined }, { ...plain.snapshot(), clock: undefined });
});

test('REGARD-OWN: a save stamped on the sky, loaded online, is rebased once to today - the regard as last written stands and eases from now; a marked save, or one loaded offline, is read as it is (mutants: the rebase dropped, every save rebased)', () => {
  const skyRecord = { v: 1, people: { 'L1.a': { r: 30, met: 99000, seen: 99000, talked: 99000, polite: 99000 } } };
  let own = 700000;
  const online = characterRelations(skyRecord, () => own, true);
  assert.equal(online.regard('L1.a'), 30, 'as last written');
  own += 4 * 1440;
  assert.equal(online.regard('L1.a'), 28, 'four own days apart: two points');
  assert.equal(online.note('L1.a', 'talk', 0) > 28, true, 'a word today counts (the sky day\'s once-a-day mark let go)');
  // marked: its days are the own clock's, read as they are
  const marked = characterRelations({ ...skyRecord, clock: REGARD_CLOCK, people: { 'L1.a': { r: 30, met: regardDayOf(700000) - 10, seen: regardDayOf(700000) - 10, talked: -1 } } }, () => 700000, true);
  assert.equal(marked.regard('L1.a'), 25, 'ten own days apart since it was seen');
  // offline: the sky's days were the one clock's
  const offline = characterRelations({ v: 1, people: { 'L1.a': { r: 30, met: regardDayOf(700000) - 10, seen: regardDayOf(700000) - 10, talked: -1 } } }, () => 700000, false);
  assert.equal(offline.regard('L1.a'), 25);
});

test('REGARD-OWN, its feedback: the relations count the friend a word or its tone makes, once, at the crossing - and the line names where to court them when the Courtship row is theirs (mutants: counted at every word, the court line never, the crossing uncounted)', () => {
  const s = street();
  const made = [];
  for (let night = 0; night < 14 && !made.length; night++) {
    for (let h = 0; h < 3; h++) { s.town.talked(s.person); made.push(...s.relations.friendsMade()); s.town.toned(s.person, BLUNT); made.push(...s.relations.friendsMade()); s.play(1); }
    s.away(21);
  }
  assert.deepEqual(made, [s.id], 'one friend, counted once');
  s.town.talked(s.person); s.play(24);
  s.town.talked(s.person);
  assert.deepEqual(s.relations.friendsMade(), [], 'a friend already: nothing more');
  assert.equal(friendLine({ name: 'Ysabel Lark', court: true }), 'Ysabel Lark counts you a friend now. You can court them: ask about Courtship under Tell me about.');
  assert.equal(friendLine({ name: 'Sir Ada', court: false }), 'Sir Ada counts you a friend now.', 'one of the watch, or no house: no Courtship named');
  assert.match(readFileSync(join(ROOT, 'src/scenes/legacyHost.js'), 'utf8'), /topicsFor\(family, me, res, ctx\.regard \| 0\)\.map\(\(t\) => \(\{\n\s+topic: t,/);
});

test('REGARD-OWN (AUDIT FB1021d RO-4): a DEED that makes a friend is counted too - a life saved, a keepsake carried home (`note`, any kind) - and a regard handed down is not (`inherit`: a family\'s friends met as such); a friend lost again before the line is read is not said; one deed\'s crowd is said at most FRIENDS_SAID_MAX (mutants: deeds uncounted, inherit counted, the lapse unread, the crowd uncapped)', () => {
  let own = 700000;
  const rel = characterRelations(null, () => own, true);
  rel.note('L1.a', 'gift', 0);
  assert.deepEqual(rel.friendsMade(), [], 'a gift: not yet a friend');
  rel.note('L1.a', 'saved', 0);
  rel.note('L1.b', 'helped', 0); rel.note('L1.b', 'helped', 0);
  rel.inherit('L1.c', 60, 0);
  assert.deepEqual(rel.friendsMade(), ['L1.a', 'L1.b'], 'a life saved after a gift, two blows struck for them: the deeds\' friends, not the inherited one');
  assert.equal(rel.standing('L1.c'), 'friend', 'though it is one');
  rel.note('L1.d', 'talk', 0, 41);
  rel.note('L1.d', 'insulted', 0, -10);
  assert.deepEqual(rel.friendsMade(), [], 'lost again before it was said');
  for (let i = 0; i < FRIENDS_SAID_MAX + 3; i++) rel.note(`L2.${i}`, 'talk', 0, 50);
  assert.equal(rel.friendsMade().length, FRIENDS_SAID_MAX);
  own += 1440;
  assert.deepEqual(rel.friendsMade(), [], 'read once');
});

test('REGARD-OWN (AUDIT FB1021d RO-1): townTalk says a friend made once nothing covers the HUD - never under the talk window, whose open seconds the HUD\'s lines would have run out in - and world.js names them from the relations (mutants: said under the window, said under another host\'s cover, the frames unwired, the host unwired)', () => {
  const canvas = { width: 320, height: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }), requestPointerLock() {}, dispatchEvent() {}, ownerDocument: { defaultView: { dispatchEvent() {} } } };
  const queue = [];
  let covered = false;
  const tt = createTownTalk({ renderer: { uploadTexture: () => ({}) }, canvas, fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] }, regionIndex: 0, otherHudCovered: () => covered,
    livingTalk: { friendsMade: () => queue.splice(0) } });
  const said = [];
  tt.hudMessageSink = (l) => said.push(l);
  const win = new ChoiceWindow({ lines: ['Well met.'], options: [{ code: 'Escape', label: 'Esc - goodbye', action: () => {} }] });
  tt.showOverlay(win);
  queue.push({ name: 'Ysabel Lark', court: true });
  for (let i = 0; i < 300; i++) tt.hudFrame(1 / 30, null);   // ten seconds of the conversation (the interior arm's frame keeps a font-less window)
  assert.deepEqual(said, [], 'under the talk window: not said');
  assert.equal(queue.length, 1, 'and not read away');
  win.done = true;
  tt.frame(1 / 30);
  assert.equal(tt.overlay, null, 'the window closed');
  covered = true;
  tt.frame(1 / 30);
  assert.deepEqual(said, [], 'under another host\'s window: not yet');
  covered = false;
  tt.frame(1 / 30);
  assert.deepEqual(said, ['Ysabel Lark counts you a friend now. You can court them: ask about Courtship under Tell me about.'], 'the HUD clear: said');
  queue.push({ name: 'Sir Ada', court: false });
  tt.hudFrame(1 / 30, null);
  assert.equal(said.at(-1), 'Sir Ada counts you a friend now.', 'indoors too');
  const W = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
  assert.match(W, /friendsMade: \(\) => friendCards\(livingRelations\.friendsMade\(\), livingTownOfId, legacyTopicRows\),/);
});

test('REGARD-OWN (AUDIT FB1021d RO-4): a friend\'s card is their resident minted again from their town, and the Courtship row read for them; an id of no known town is not named', () => {
  const town = { mapId: 12345, blocks: 9, region: 17, people: 3, port: false };
  const s = street();
  const res = residentOfId(s.id, (m) => (m === 12345 ? town : null));
  assert.ok(res, 'the street\'s resident, minted again');
  const cards = friendCards([s.id, 'L999999.h3'], (m) => (m === 12345 ? town : null), (p) => (p.living.res.name === res.name ? [{ topic: 'court' }] : []));
  assert.deepEqual(cards, [{ name: res.name, court: true }]);
  assert.deepEqual(friendCards([s.id], (m) => (m === 12345 ? town : null), () => [{ topic: 'family' }]), [{ name: res.name, court: false }]);
});

test('REGARD-OWN (AUDIT FB1021d RO-2): every door of the wrapper counts the character\'s own day and none the caller\'s - a far day handed in (the street\'s greeting hands the sky\'s) changes nothing (mutants: seen, standing, inherit or regard on the caller\'s day)', () => {
  let own = 700000;
  const day = () => regardDayOf(own);
  const rel = characterRelations(null, () => own, true);
  const plain = createRelations();
  rel.note('L1.a', 'talk', 0, 50); plain.note('L1.a', 'talk', day(), 50);
  own += 3 * 1440;
  const FAR = day() + 600;   // an online sky day stands some 600 ahead of an own day
  assert.equal(rel.regard('L1.a', FAR), plain.regard('L1.a', day()), 'regard');
  assert.equal(rel.standing('L1.a', FAR), 'friend', 'standing');
  rel.seen('L1.a', FAR); plain.seen('L1.a', day());
  assert.equal(rel.regard('L1.a'), plain.regard('L1.a', day()), 'seen: eased to today, not to the far day\'s nought');
  own += 2 * 1440;
  rel.inherit('L1.b', 20, FAR); plain.inherit('L1.b', 20, day());
  own += 1440;
  assert.equal(rel.regard('L1.b'), plain.regard('L1.b', day()), 'inherit');
  rel.note('L1.c', 'talk', FAR); plain.note('L1.c', 'talk', day());
  own += 1440;
  assert.equal(rel.regard('L1.c'), plain.regard('L1.c', day()), 'note');
});

test('REGARD-OWN (AUDIT FB1021d RO-3): a sky-stamped save\'s grudge comes back as the old sky had eased it by the load - never as it was written - while its friendships come back as written (mutants: grudges restored whole, friendships eased, the sky unread)', () => {
  const SKY_DAY = 1100, OWN = 240 + 530 * 1440;
  const record = { v: 1, people: { 'L1.kin': { r: -75, met: SKY_DAY - 60, seen: SKY_DAY - 60, talked: -1 }, 'L1.pal': { r: 40, met: SKY_DAY - 60, seen: SKY_DAY - 60, talked: -1 }, 'L1.foe': { r: -90, met: SKY_DAY - 10, seen: SKY_DAY - 10, talked: -1 } } };
  const rel = characterRelations(record, () => OWN, true, () => 240 + SKY_DAY * 1440 + 600);
  assert.equal(rel.regard('L1.kin'), -45, 'sixty sky days eased: an enemy, not hostile');
  assert.equal(rel.standing('L1.kin'), 'enemy');
  assert.equal(rel.regard('L1.foe'), -85, 'ten sky days eased');
  assert.equal(rel.regard('L1.pal'), 40, 'a friendship as last written - the reported loss given back');
});

test('REGARD-OWN (AUDIT FB1021d RO-5): an online save from before REGARD-OWN copied offline keeps its sky days - stamps ahead of the character\'s own day - and is rebased too; a save of offline\'s own days is read as it is (mutants: the offline copy unrebased, every offline save rebased)', () => {
  const OWN = 240 + 530 * 1440, AHEAD = 1100;
  const copied = characterRelations({ v: 1, people: { 'L1.a': { r: 30, met: AHEAD, seen: AHEAD, talked: AHEAD } } }, () => OWN, false);
  assert.equal(copied.regard('L1.a'), 30);
  const later = characterRelations(copied.snapshot(), () => OWN + 4 * 1440, false);
  assert.equal(later.regard('L1.a'), 28, 'it eases from the load, four own days: two points (unrebased it stood frozen)');
  const own = characterRelations({ v: 1, people: { 'L1.a': { r: 30, met: 520, seen: 520, talked: -1 } } }, () => OWN, false);
  assert.equal(own.regard('L1.a'), 25, 'offline\'s own days: ten apart');
});
