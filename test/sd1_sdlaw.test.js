// SD1 (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most.
// Only one can be active at a time." ... "The Super dungeon collapses when the feat is done."): THE SUPER DUNGEON'S
// LAW (net/sdLaw.js) - its slot, its record's life, where it rises, its name, its room. bible/11-Multiplayer/
// Super-Dungeons.md sections 2-4. Pure, and the relay's: the hub stores one record (`sdev`) and moves it on with one
// function per move, each refusing a move its phase does not allow; every phase is derived from the record's own
// instants, so the hub and every client read the same life from the same record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_LIFETIME_MS, SD_COLLAPSE_MS, SD_COOLDOWN_MS, SD_FIRST_RISE_MS, SD_CENSUS_MIN, SD_REGION_COUNT, SD_SALT, SD_SLOT_MAX,
  SD_PHASES, SD_FOUND_RADIUS_M, SD_FIGHTERS_MAX, validSdRecord, sdPhase, sdStands, sdMarked, sdAdmits, sdHolds, sdFirst,
  sdRise, sdFind, sdFell, sdGone, sdDue, sdRoll, pickSdRegion, sdFindBelieved, SD_NAMES, sdNameOf, sdRoomKey, isSdRoom,
  sdSlotOfRoom, sdFoundLine, sdFellLine, sdFadeLine, SD_CAST_OUT_LINE,
} from '../src/net/sdLaw.js';
import { REGION_NAMES, worldCoordToMapPixel } from '../src/formats/mapsFile.js';
import { gateHash, PIXEL_M } from '../src/net/gateLaw.js';
import { PIXEL_UNITS, sanitizeName } from '../src/net/wire.js';
import { graph } from './importGraph.mjs';

const H = 3600 * 1000, M = 60 * 1000;

test('SD1: the numbers - two days standing, three minutes collapsing, two hours resting, ten minutes before the first; the census\'s minimum and the Bay\'s regions', () => {
  assert.equal(SD_LIFETIME_MS, 48 * H);
  assert.equal(SD_COLLAPSE_MS, 3 * M);
  assert.equal(SD_COOLDOWN_MS, 2 * H);
  assert.equal(SD_FIRST_RISE_MS, 10 * M);
  assert.equal(SD_CENSUS_MIN, 2);
  assert.equal(SD_REGION_COUNT, REGION_NAMES.length, 'pinned equal to MAPS.BSA\'s regions (not imported: the relay\'s graph)');
  assert.equal(SD_SALT, 0x5d01);
  assert.equal(SD_SLOT_MAX, 999_999_999);
  assert.deepEqual([...SD_PHASES], ['risen', 'found', 'fell', 'gone']);
  assert.ok(Object.isFrozen(SD_PHASES));
  assert.equal(SD_FOUND_RADIUS_M, 160);
  assert.equal(SD_FIGHTERS_MAX, 256);
});

test('SD1: the record as the law admits it - at both ends, projected; a find and a fall said with their instants, slot 0 the hub\'s first beat alone', () => {
  const base = { s: 3, ph: 'risen', r: 17, at: 1000, until: 1000 + SD_LIFETIME_MS, next: 1000 + SD_LIFETIME_MS + SD_COOLDOWN_MS };
  assert.deepEqual(validSdRecord(base), base);
  assert.deepEqual(validSdRecord({ ...base, junk: 'x', extra: { deep: 1 } }), base, 'projected: what the law names and nothing else');
  assert.equal(validSdRecord({ ...base, r: -1 }).r, -1, 'the Bay\'s great cities');
  const found = { ...base, ph: 'found', foundAt: 2000, fb: '  Mara <b>  ' };
  assert.equal(validSdRecord(found).fb, sanitizeName('  Mara <b>  '), 'a name is the wire\'s name');
  const fell = { ...found, ph: 'fell', fellAt: 3000, top: 'Mara', n: 4 };
  assert.deepEqual(validSdRecord(fell), { ...fell, fb: sanitizeName(found.fb) });
  for (const bad of [
    null, 'x', [base], {},
    { ...base, s: -1 }, { ...base, s: 1.5 }, { ...base, s: SD_SLOT_MAX + 1 },
    { ...base, ph: 'open' }, { ...base, r: -2 }, { ...base, r: SD_REGION_COUNT }, { ...base, r: 1.5 },
    { ...base, at: -1 }, { ...base, until: NaN }, { ...base, next: 'soon' }, { ...base, at: 1.5 },
    { ...base, s: 0 }, { ...base, ph: 'found' }, { ...base, ph: 'fell', foundAt: 2000 },
    { ...found, foundAt: -5 }, { ...fell, fellAt: Infinity }, { ...fell, n: 257 }, { ...fell, n: -1 }, { ...fell, n: 2.5 },
  ]) assert.equal(validSdRecord(bad), null, JSON.stringify(bad));
  assert.deepEqual(validSdRecord(sdFirst(500)), { s: 0, ph: 'gone', r: -1, at: 500, until: 500, next: 500 + SD_FIRST_RISE_MS }, 'the first beat is a record');
});

test('SD1: a Hollow\'s life, derived from its own instants - standing until it fades or until the collapse after the kill, then gone', () => {
  const r = sdRise(sdFirst(0), SD_FIRST_RISE_MS, 5);
  const at = SD_FIRST_RISE_MS;
  assert.equal(sdPhase(r, at), 'risen');
  assert.equal(sdPhase(r, at + SD_LIFETIME_MS - 1), 'risen');
  assert.equal(sdPhase(r, at + SD_LIFETIME_MS), 'gone', 'unbeaten, it fades');
  const f = sdFind(r, at + H, 'Mara');
  assert.equal(sdPhase(f, at + H), 'found');
  assert.equal(sdPhase(f, at + SD_LIFETIME_MS), 'gone', 'found and unbeaten, it fades too');
  const k = sdFell(f, at + 2 * H, { top: 'Mara', n: 3 });
  assert.equal(sdPhase(k, at + 2 * H), 'fell');
  assert.equal(sdPhase(k, at + 2 * H + SD_COLLAPSE_MS - 1), 'fell');
  assert.equal(sdPhase(k, at + 2 * H + SD_COLLAPSE_MS), 'gone', 'the collapse ends it');
  assert.equal(sdPhase({ ...k, until: at + 2 * H + 1 }, at + 2 * H + 10), 'fell', 'a kill past its time still collapses on its own clock');
  assert.equal(sdPhase(null, 0), 'gone');
  assert.equal(sdPhase(sdFirst(0), 0), 'gone', 'nothing has risen');
  assert.equal(sdPhase({ ...f, ph: 'gone' }, at + H), 'gone', 'a record that says gone is gone');
  // what each phase means to the world
  assert.deepEqual(['risen', 'found', 'fell', 'gone'].map(sdStands), [true, true, true, false]);
  assert.deepEqual(['risen', 'found', 'fell', 'gone'].map(sdMarked), [false, true, true, false], 'a find before it is found; news after');
  assert.equal(sdAdmits(r, at), false, 'unfound: the Rift takes nobody');
  assert.equal(sdAdmits(f, at + H), true);
  assert.equal(sdAdmits(k, at + 2 * H), false, 'its boss fallen: nobody new');
  assert.equal(sdHolds(k, at + 2 * H), true, 'but those inside stay for the spoils');
  assert.equal(sdHolds(k, at + 2 * H + SD_COLLAPSE_MS), false);
  assert.equal(sdHolds(r, at), false);
});

test('SD1: the moves - each refusing what its phase does not allow; the slots counting on, the rest after each end', () => {
  const first = sdFirst(0);
  assert.equal(sdRise(first, SD_FIRST_RISE_MS - 1, 5), null, 'not before the first rise');
  const r1 = sdRise(first, SD_FIRST_RISE_MS, 5);
  assert.deepEqual(r1, { s: 1, ph: 'risen', r: 5, at: SD_FIRST_RISE_MS, until: SD_FIRST_RISE_MS + SD_LIFETIME_MS, next: SD_FIRST_RISE_MS + SD_LIFETIME_MS + SD_COOLDOWN_MS });
  assert.equal(sdRise(r1, SD_FIRST_RISE_MS + H, 7), null, 'one at a time: never over a standing Hollow');
  assert.equal(sdRise({ ...r1, next: r1.at }, r1.at + 1, 7), null, '...whatever its record says of the rest (a record the law admits may carry an early `next`)');
  assert.equal(sdRise(null, 0, 5)?.s, 1, 'no record at all: the first slot');
  for (const r of [-2, SD_REGION_COUNT, 1.5, NaN]) assert.equal(sdRise(first, SD_FIRST_RISE_MS, r), null, `region ${r}`);
  assert.equal(sdRise({ ...first, s: SD_SLOT_MAX }, SD_FIRST_RISE_MS, 5), null, 'past the last slot: none');
  // found: only while risen, once
  assert.equal(sdFind(r1, r1.at + 1, 'Mara').fb, 'Mara');
  assert.equal(sdFind(sdFind(r1, r1.at + 1, 'Mara'), r1.at + 2, 'Ilse'), null, 'found once');
  assert.equal(sdFind(r1, r1.until, 'Mara'), null, 'not once it has faded');
  assert.equal(sdFind(null, 0, 'x'), null);
  // fell: only while found
  const f1 = sdFind(r1, r1.at + 1, 'Mara');
  assert.equal(sdFell(r1, r1.at + 2, { top: 'Mara', n: 2 }), null, 'an unfound Hollow has no fight to fall');
  const k1 = sdFell(f1, r1.at + 2, { top: 'Mara', n: 999 });
  assert.equal(k1.n, SD_FIGHTERS_MAX, 'the count bounded');
  assert.equal(k1.next, r1.at + 2 + SD_COLLAPSE_MS + SD_COOLDOWN_MS, 'the rest from the collapse\'s end');
  assert.equal(sdFell(k1, r1.at + 3, { top: 'Ilse' }), null, 'one fall');
  assert.equal(sdFell(f1, r1.at + 2, { top: 'Mara', n: 1.5 }).n, 0, 'a count that is no count is none');
  // gone: only once its time has run, and once
  assert.equal(sdGone(k1, r1.at + 3), null, 'still collapsing');
  const g1 = sdGone(k1, r1.at + 2 + SD_COLLAPSE_MS);
  assert.equal(g1.ph, 'gone');
  assert.equal(sdGone(g1, r1.at + 2 + SD_COLLAPSE_MS + 1), null, 'gone once');
  assert.equal(sdGone(first, 1), null, 'the first beat is no Hollow to end');
  // and the next rises after the rest, in the next slot
  assert.equal(sdRise(g1, g1.next - 1, 9), null, 'resting');
  const r2 = sdRise(g1, g1.next, 9);
  assert.equal(r2.s, 2);
  assert.equal(r2.r, 9);
});

test('SD1: the director\'s step - first, gone, rise, or nothing until the next instant it must act at', () => {
  assert.deepEqual(sdDue(null, 5), { act: 'first' });
  const first = sdFirst(0);
  assert.deepEqual(sdDue(first, 1), { act: null, at: SD_FIRST_RISE_MS });
  assert.deepEqual(sdDue(first, SD_FIRST_RISE_MS), { act: 'rise' });
  const r = sdRise(first, SD_FIRST_RISE_MS, 3);
  assert.deepEqual(sdDue(r, r.at + 1), { act: null, at: r.until }, 'standing: wake at its fading');
  assert.deepEqual(sdDue(r, r.until), { act: 'gone' }, 'faded: say so');
  const g = sdGone(r, r.until);
  assert.deepEqual(sdDue(g, r.until + 1), { act: null, at: g.next }, 'resting: wake at the rise');
  assert.deepEqual(sdDue(g, g.next), { act: 'rise' });
  const k = sdFell(sdFind(r, r.at + 1, 'Mara'), r.at + 2, { top: 'Mara', n: 1 });
  assert.deepEqual(sdDue(k, r.at + 3), { act: null, at: r.at + 2 + SD_COLLAPSE_MS }, 'collapsing: wake at its end');
  assert.deepEqual(sdDue(k, r.at + 2 + SD_COLLAPSE_MS), { act: 'gone' });
});

test('SD1: the census\'s region - the fullest at the minimum or more, a tie broken by the slot\'s roll, the last region resting while another qualifies; none, the Bay\'s great cities', () => {
  const counts = (o) => Object.assign(new Array(SD_REGION_COUNT).fill(0), o);
  assert.equal(pickSdRegion(1, counts({})), -1, 'nobody: the great cities');
  assert.equal(pickSdRegion(1, counts({ 4: 1 })), -1, 'one player is no crowd');
  assert.equal(pickSdRegion(1, counts({ 4: 2 })), 4);
  assert.equal(pickSdRegion(1, counts({ 4: 2, 9: 5, 17: 3 })), 9, 'the fullest');
  // a tie: the slot's own roll picks, the same for every asker, and the slots spread over the tied regions
  const tie = counts({ 4: 5, 9: 5, 17: 5 });
  for (let s = 1; s <= 20; s++) assert.equal(pickSdRegion(s, tie), [4, 9, 17][sdRoll(s, 1) % 3], `slot ${s}`);
  assert.ok(new Set(Array.from({ length: 30 }, (_, i) => pickSdRegion(i + 1, tie))).size === 3, 'every tied region takes a turn');
  // the last Hollow's region rests while another qualifies - even a fuller one
  assert.equal(pickSdRegion(2, counts({ 9: 50, 17: 2 }), 9), 17);
  assert.equal(pickSdRegion(2, counts({ 9: 50 }), 9), 9, 'the only crowd is the crowd');
  assert.equal(pickSdRegion(2, counts({ 9: 50, 17: 1 }), 9), 9, 'a region under the minimum does not take its turn');
  assert.equal(pickSdRegion(1, null), -1);
  assert.equal(pickSdRegion(1, counts({ 61: 3 })), 61, 'the last region counts');
  assert.equal(sdRoll(7, 1), gateHash(SD_SALT, 7, 1), 'the gate\'s mix, the Hollow\'s salt');
});

test('SD1: a find the relay believes - a pose in the MapsFile frame inside the claimed pixel, near its centre, for the standing slot while it has risen', () => {
  const rec = sdRise(sdFirst(0), SD_FIRST_RISE_MS, 5);
  const now = rec.at + 1;
  const px = 412, py = 211;
  const UPM = PIXEL_UNITS / PIXEL_M;
  // the pixel's centre in the frame the client's own law reads back (formats/mapsFile.js worldCoordToMapPixel)
  const cx = (px + 0.5) * PIXEL_UNITS, cz = (499.5 - py) * PIXEL_UNITS;
  assert.deepEqual(worldCoordToMapPixel(cx, cz), { x: px, y: py }, 'the centre is the pixel\'s: z north, the map\'s y south');
  const claim = { s: rec.s, px, py };
  assert.equal(sdFindBelieved(rec, now, claim, { x: cx, z: cz }), true);
  assert.equal(sdFindBelieved(rec, now, claim, { x: cx + (SD_FOUND_RADIUS_M - 1) * UPM, z: cz }), true, 'within the radius');
  assert.equal(sdFindBelieved(rec, now, claim, { x: cx + (SD_FOUND_RADIUS_M + 1) * UPM, z: cz }), false, 'past it');
  assert.equal(sdFindBelieved(rec, now, claim, { x: cx, z: cz + PIXEL_UNITS }), false, 'the pixel to the north (the map\'s row above)');
  assert.equal(sdFindBelieved(rec, now, { ...claim, s: rec.s + 1 }, { x: cx, z: cz }), false, 'another slot');
  assert.equal(sdFindBelieved(sdFind(rec, now, 'Mara'), now, claim, { x: cx, z: cz }), false, 'found already');
  assert.equal(sdFindBelieved(rec, rec.until, claim, { x: cx, z: cz }), false, 'faded');
  for (const bad of [{ ...claim, px: 1.5 }, { ...claim, py: 'x' }, null]) assert.equal(sdFindBelieved(rec, now, bad, { x: cx, z: cz }), false);
  assert.equal(sdFindBelieved(rec, now, claim, { x: NaN, z: cz }), false);
});

test('SD1: the name, the room and the words', () => {
  assert.equal(SD_NAMES.length, 8);
  assert.ok(Object.isFrozen(SD_NAMES));
  for (let s = 1; s <= 40; s++) {
    const n = sdNameOf(s, 'Daggerfall');
    assert.equal(n, sdNameOf(s, 'Daggerfall'), 'the same for every asker');
    assert.ok(!n.includes('{city}'));
    assert.ok(SD_NAMES.map((t) => t.replace('{city}', 'Daggerfall')).includes(n));
    assert.ok(!sdNameOf(s).includes('{city}'), 'no city known: a bare name');
  }
  const cityName = SD_NAMES.findIndex((t) => t.includes('{city}'));
  const s = Array.from({ length: 200 }, (_, i) => i + 1).find((x) => sdRoll(x, 2) % SD_NAMES.length === cityName);
  assert.equal(sdNameOf(s, 'Wayrest'), SD_NAMES[cityName].replace('{city}', 'Wayrest'));
  assert.equal(sdNameOf(s), SD_NAMES[0], 'a city\'s name with no city falls back to the first');
  // the room
  assert.equal(sdRoomKey(7), 'sd:7');
  assert.equal(isSdRoom('sd:7'), true);
  assert.equal(isSdRoom('sd:999999999'), true);
  for (const k of ['sd:0', 'sd:07', 'sd:1000000000', 'sd:', 'sd:x', 'sd:1.5', ' sd:1', 'gate:1', null]) assert.equal(isSdRoom(k), false, String(k));
  assert.equal(sdSlotOfRoom('sd:42'), 42);
  assert.equal(sdSlotOfRoom('gate:42'), null);
  // the words
  assert.equal(sdFoundLine({ who: 'Mara', near: 'Daggerfall' }), 'Mara has found an Abyss Dungeon near Daggerfall!');   // ABYSS-NAME (PIN MOVED): the player's word
  assert.equal(sdFellLine({ top: 'Mara', n: 1, name: 'The Brass Hollow' }), 'Mara broke the Hour in the Brass Hollow. It collapses.');   // AUDIT SD II (L6 F20, PIN MOVED): the article small mid-sentence
  assert.equal(sdFellLine({ top: 'Mara', n: 2, name: 'The Brass Hollow' }), 'Mara and 1 other broke the Hour in the Brass Hollow. It collapses.');
  assert.equal(sdFellLine({ top: 'Mara', n: 5, name: 'The Brass Hollow' }), 'Mara and 4 others broke the Hour in the Brass Hollow. It collapses.');
  assert.equal(sdFadeLine({ name: 'The Stopped Bell' }), 'The Hour closes over the Stopped Bell, unbroken.');
  assert.equal(SD_CAST_OUT_LINE, 'The Hour closes, and the Abyss Dungeon folds in on itself behind you.');   // AUDIT SD III (T15, PIN MOVED): the player's word for it, Abyss Dungeon
});

test('SD1: pure, and the relay\'s - it reaches nothing past wire.js and the gate\'s law, both already the relay bundle\'s', () => {
  const src = readFileSync(new URL('../src/net/sdLaw.js', import.meta.url), 'utf8');
  assert.deepEqual([...src.matchAll(/^import [^\n]* from '([^']+)';/gm)].map((m) => m[1]), ['./wire.js', './gateLaw.js']);
  const relay = graph('server/src/index.js');
  const g = graph('src/net/sdLaw.js').slice(1);
  assert.deepEqual(g.filter((f) => !relay.includes(f)), [], 'every module the law reaches is one the relay already bundles');
});
