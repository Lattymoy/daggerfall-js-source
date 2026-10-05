// REVENANT-VOICE (2026-10-02, Mac: "They should have their own unique personalities that affect their speach. One could
// be humorous, or witty, etc"): ten personalities, one per revenant drawn from its id and leaning by its kind, and every
// moment it has a word for said in that voice - a beast's in its temperament.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES, PERSONALITY_IDS, VOICE_EVENTS, personalityFor, personalityLabel, voiceLine, voiceLines, beastBody, isPersonality } from '../src/systems/revenantPersonality.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
const N = await import('../src/systems/revenant.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');

// PIN MOVED (RVN12a, bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's last stand and betrayal are key moments too (three each)
const KEY_MOMENTS = ['taunt_slew', 'taunt_fled', 'yield', 'executed', 'spared', 'laststand', 'betrayed'];

test('REVENANT-VOICE the bank: ten personalities, every moment two lines or more in each (three for the returns, the yield, the execution and the oath), each short enough for the card, nothing unfilled but the player (mutants: a moment emptied)', () => {
  assert.equal(PERSONALITY_IDS.length, 10);
  assert.ok(PERSONALITY_IDS.includes('humorous') && PERSONALITY_IDS.includes('witty'), 'Mac\'s two');
  for (const id of PERSONALITY_IDS) {
    const P = PERSONALITIES[id];
    assert.ok(P.label && P.blurb && /^(with|in) /.test(P.manner), `${id}: a label, a line, a manner`);
    for (const ev of VOICE_EVENTS) {
      const lines = voiceLines(id, ev);
      assert.ok(lines.length >= (KEY_MOMENTS.includes(ev) ? 3 : 2), `${id}.${ev}: ${lines.length} lines`);
      assert.equal(new Set(lines).size, lines.length, `${id}.${ev}: no line twice`);
      for (const l of lines) {
        assert.ok(l.length > 0 && l.length <= 96, `${id}.${ev}: "${l}" fits the card`);
        assert.doesNotMatch(l.replace(/\{(p|how|item|move|ally)\}/g, ''), /[{}]/, `${id}.${ev}: "${l}" has nothing unfilled`);   // PIN MOVED (RVN12a): the widened placeholders, exactly
      }
    }
  }
  // the voices differ: no two personalities share a yield
  const yields = PERSONALITY_IDS.flatMap((id) => voiceLines(id, 'yield'));
  assert.equal(new Set(yields).size, yields.length, 'every yield its own');
});

test('REVENANT-VOICE who it is: one personality per id on every read, leaning by kind - a person anyone, a beast never a preacher or a wit, all ten among people (mutants: the id unread; the lean ignored)', () => {
  for (let i = 0; i < 50; i++) assert.equal(personalityFor(`id-${i}`, MOBILE_TYPES.Orc), personalityFor(`id-${i}`, MOBILE_TYPES.Orc), 'one id, one voice');
  const people = new Set(), beasts = new Set(), orcs = new Set();
  for (let i = 0; i < 600; i++) {
    people.add(personalityFor(`p${i}`, 140));
    beasts.add(personalityFor(`b${i}`, MOBILE_TYPES.GrizzlyBear));
    orcs.add(personalityFor(`o${i}`, MOBILE_TYPES.Orc));
  }
  assert.equal(people.size, 10, 'a person may be anyone');
  for (const no of ['zealous', 'arrogant', 'witty']) assert.ok(!beasts.has(no), `a beast is never ${no}`);
  assert.ok(!orcs.has('zealous') && orcs.has('brutal'), 'an orc leans brutal');
  assert.ok(isPersonality('weary') && !isPersonality('toString') && !isPersonality('nope'));
  assert.equal(personalityLabel('humorous'), 'Humorous'); assert.equal(personalityLabel('nope'), null);
});

test('REVENANT-VOICE what it says: the player\'s name filled, the roll picks; a beast\'s deed in its temperament (mutants: the name unfilled; the manner lost)', () => {
  assert.equal(voiceLine('honourable', 'yield', { p: 'Ayla', rolls: () => 0 }), 'I yield, Ayla. Your blade is the better.');
  assert.equal(voiceLine('honourable', 'yield', { p: 'Ayla', rolls: () => 0.99 }), 'I have lost fairly. Do what honour demands.');
  assert.equal(voiceLine('cold', 'spared', { rolls: () => 0 }), 'An unexpected variable. I will follow it.');
  assert.equal(beastBody('humorous', 'yield'), 'Sinks low before you with a playful yip, beaten.');
  assert.equal(beastBody('nope', 'arrive'), 'Steps through the portal with a savage snarl.', 'an unknown one reads as brutal');
});

test('REVENANT-VOICE the record: a new revenant draws its personality from its id and keeps it; an older record without one is given the one its id draws; a special foe that speaks before it is one keeps that voice once it is (mutants: a record without; the flee voice lost at the deed)', () => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests();
  const me = { name: 'Ayla Stormwind', isPlayer: true, characterId: 'char-voice' };
  const foe = { level: 8, mobileType: MOBILE_TYPES.Orc, eliteFoe: true, health: 5, maxHealth: 100 };
  const fleeLine = N.revenantFleeEvent(foe, 'Elite Orc', { rolls: () => 0 });
  assert.ok(foe._voiceId, 'its voice id minted as it speaks');
  const r = N.revenantDeed(me, foe, 'fled', { mobileType: MOBILE_TYPES.Orc, rolls: () => 0 });
  assert.equal(r.id, foe._voiceId, 'the revenant it becomes is that voice');
  assert.equal(r.personality, personalityFor(r.id, MOBILE_TYPES.Orc));
  assert.equal(fleeLine.mood, personalityLabel(r.personality), 'the same voice before and after');
  const [old] = N.mergeRevenants([{ id: 'old-1', mobileType: MOBILE_TYPES.Orc, given: 'Grak', epithet: 'the Scarred', rank: 1 }], []);
  assert.equal(old.personality, personalityFor('old-1', MOBILE_TYPES.Orc), 'an older record is given its own');
  const [bad] = N.mergeRevenants([{ id: 'old-2', mobileType: 140, given: 'Ena', epithet: 'the Lucky', rank: 1, personality: 'toString' }], []);
  assert.ok(isPersonality(bad.personality) && bad.personality !== 'toString', 'a strange one read back is replaced');
  // every moment an event in its voice
  for (const kind of ['yield', 'executed', 'spared', 'slip', 'arrive', 'dismiss', 'downed', 'kill', 'battle', 'release']) {
    const ev = N.revenantMomentEvent(kind, { ...r, personality: 'witty' }, me.name, { rolls: () => 0 });
    assert.equal(ev.kind, kind);
    assert.equal(ev.speech, voiceLine('witty', /** @type {any} */ (kind), { p: 'Ayla', rolls: () => 0 }), `${kind}: the witty one's words`);
    assert.equal(ev.line, `${r.name}: "${ev.speech}"`);
    assert.ok(ev.kicker && ev.kicker !== 'Revenant' || kind === 'arrive' || kind === 'kill' || kind === 'battle', `${kind}: its own kicker`);
  }
  const beastEv = N.revenantMomentEvent('spared', { ...r, mobileType: MOBILE_TYPES.GrizzlyBear, personality: 'weary' }, me.name);
  assert.equal(beastEv.speech, null);
  assert.equal(beastEv.body, 'Rises slowly and falls in at your side with a tired, rumbling sigh.');
  N._resetRevenantForTests();
});
