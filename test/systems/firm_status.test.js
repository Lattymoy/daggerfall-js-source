// FIRM-STATUS (2026-10-25; bible/06-Systems/Firmament.md section 7) - WHETHER MY STARS ACT NOW, AND WHY NOT
// (src/systems/firmamentLive.js firmamentStatus), the word the Firmament window's side panel says above its sums. Driven
// through the flags the world host sets: online or out of the seat, the tree the book heard, mentoring (the live word
// and the entity's own, set together by the host's partyFrame), a duel. Each status is checked against what the stars
// then fold onto my character, so the line can never say "active" over a sky that sleeps.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { setFirmamentTree, setFirmamentOnline, setFirmamentMentoring, firmamentStatus, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { firmamentFold } from '../../src/systems/firmamentPowers.js';
import { setSigilDueling, sigilDueling, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';

// The Warrior's sign (+1 Strength, a combat channel) and the Crossing beside it (+2% carry, a life channel).
const WARRIOR = { start: 'wr.start', keys: ['st.bt'] };
let mentoring = false;
const me = () => ({ isPlayer: true, stats: { strength: 50, endurance: 50 }, ...(mentoring ? { _mentor: { level: 3 } } : {}) });
/** What the stars fold onto my character now: the Strength (combat) and the carry (life). */
const folded = () => {
  const mods = firmamentFold(me());
  return { strength: mods.stats.strength ?? 0, carry: Math.round(mods.weightMult * 100) };
};
/** The window's question, as it asks it. */
const status = (read) => firmamentStatus({ read, dueling: sigilDueling() });
/** The host's partyFrame: the live word and the entity's own, together. */
const mentor = (on) => {
  mentoring = on;
  setFirmamentMentoring(on);
};

beforeEach(() => {
  _resetFirmamentLiveForTests();
  _resetSigilForTests();
  mentoring = false;
});

test('FIRM-STATUS: active - online, a birthsign accepted, no mentoring, no duel; every star acts', () => {
  setFirmamentOnline(true);
  setFirmamentTree(WARRIOR);
  assert.equal(status(true), 'active');
  assert.deepEqual(folded(), { strength: 1, carry: 2 });
});

test('FIRM-STATUS: seat - the page is offline (another tab holds the seat), whatever else holds; nothing acts', () => {
  setFirmamentTree(WARRIOR);
  mentor(true);
  assert.equal(status(true), 'seat');
  assert.deepEqual(folded(), { strength: 0, carry: 0 });
});

test('FIRM-STATUS: unread before the service answered, no-sign after it answered with no birthsign', () => {
  setFirmamentOnline(true);
  assert.equal(status(false), 'unread');
  assert.equal(status(true), 'no-sign');
  assert.deepEqual(folded(), { strength: 0, carry: 0 });
  setFirmamentTree(WARRIOR);
  assert.equal(status(false), 'active', 'a tree already in force acts, whatever the last read said');
});

test('FIRM-STATUS: mentoring - the whole sky sleeps, and it outranks a duel', () => {
  setFirmamentOnline(true);
  setFirmamentTree(WARRIOR);
  mentor(true);
  setSigilDueling(true);
  assert.equal(status(true), 'mentoring');
  assert.deepEqual(folded(), { strength: 0, carry: 0 });
  mentor(false);
  assert.equal(status(true), 'duel');
});

test('FIRM-STATUS: duel - the combat stars sleep, the crafting and trade stars act', () => {
  setFirmamentOnline(true);
  setFirmamentTree(WARRIOR);
  setSigilDueling(true);
  assert.equal(status(true), 'duel');
  assert.deepEqual(folded(), { strength: 0, carry: 2 });
});
