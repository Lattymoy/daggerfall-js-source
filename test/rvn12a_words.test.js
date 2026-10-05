// RVN12a - THE WORDS (bible/12-Enhanced-AI/Feud-Arc.md section 23; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). Ten new moments in every personality's voice - what it learned, its
// signature, its last stand, what it took, its festering, its return after felling a companion or routing me, a sworn
// one's desertion and betrayal, a Devoted one's warning - two lines or more each (three for the last stand and the
// betrayal), and a beast's deed for each. The placeholders widen, exactly, to {p}, {how}, {item}, {move}, {ally}; a line
// needing one its caller did not hand is passed over, so none is said with a `{` in it.
// Pinned: the bank (its moments, counts, lengths, placeholders, each moment's own word in every line, the beasts); the
// fill on every path; the taunt's moment by the newest deed; each event's voice; the hosts handing my name.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const P = await import('../src/systems/revenantPersonality.js');
const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { createWeapon } = await import('../src/combat/enemyEquipment.js');
const { WEAPONS: W } = await import('../src/characters/weapons.js');
const { itemLongName } = await import('../src/systems/itemInfo.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FEUD = ['learned', 'signature', 'laststand', 'stole', 'festered', 'felled_return', 'routed_return', 'deserted', 'betrayed', 'devoted_warn'];
const OWN_WORD = { learned: 'how', signature: 'move', stole: 'item', felled_return: 'ally' };
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvn12a', level: 8, items: [] };
beforeEach(() => { _resetForTests(); setPref('lootRarity', true); N._resetRevenantForTests(); _store.clear(); });
function rec(over = {}) {
  const r = N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  return Object.assign(r, { personality: 'cold', history: [{ deed: 'fled', at: 1 }], took: [], learned: [], returns: 0, kills: 0, rank: 1 }, over);
}

// ── the bank ────────────────────────────────────────────────────────

test('RVN12a THE BANK: the ten moments after the eighteen; the placeholders exactly five; every personality two lines or more for each (three for the last stand and the betrayal), each at most 96 characters, none twice, nothing unfilled but the five, each moment\'s own word in every line; a beast\'s deed for each; 220 lines (mutants: a moment dropped; a line emptied; a placeholder widened)', () => {
  assert.deepEqual(P.VOICE_EVENTS.slice(18), FEUD);
  assert.equal(P.VOICE_EVENTS.length, 28);
  assert.deepEqual([...P.VOICE_PLACEHOLDERS], ['p', 'how', 'item', 'move', 'ally']);
  let n = 0;
  for (const id of P.PERSONALITY_IDS) {
    for (const ev of FEUD) {
      const lines = P.voiceLines(id, ev);
      assert.ok(lines.length >= (ev === 'laststand' || ev === 'betrayed' ? 3 : 2), `${id}.${ev}: ${lines.length}`);
      assert.equal(new Set(lines).size, lines.length, `${id}.${ev}: none twice`);
      for (const l of lines) {
        assert.ok(l.length <= 96, `${id}.${ev}: "${l}"`);
        assert.doesNotMatch(l.replace(/\{(p|how|item|move|ally)\}/g, ''), /[{}]/, `${id}.${ev}: "${l}"`);
        if (OWN_WORD[ev]) assert.ok(l.includes(`{${OWN_WORD[ev]}}`), `${id}.${ev}: "${l}" names its {${OWN_WORD[ev]}}`);
        n++;
      }
    }
  }
  assert.equal(n, 220);
  for (const ev of FEUD) assert.doesNotMatch(P.beastBody('brutal', ev), /^Watches you/, `${ev}: a beast's own deed`);
  assert.equal(P.beastBody('craven', 'betrayed'), 'Turns on you with a nervous whine!');
});

test('RVN12a FILLED ON EVERY PATH: a moment\'s word handed fills it; a line needing one not handed is passed over (null when none is left); a `$` in a name stays a letter (mutants: the fill unwidened; the unsayable said)', () => {
  assert.equal(P.voiceLine('cold', 'signature', { p: 'Ayla', move: 'Skullsplitter', rolls: () => 0 }), 'Skullsplitter.');
  assert.equal(P.voiceLine('cold', 'signature', { p: 'Ayla', rolls: () => 0 }), null, 'no move: nothing it can say');
  assert.equal(P.voiceLine('cold', 'signature', { p: 'Ayla', move: '', rolls: () => 0 }), null, 'an empty word is none');
  assert.equal(P.voiceLine('brutal', 'felled_return', { p: 'Ayla', ally: 'Borgakh', rolls: () => 0.99 }), "Borgakh fell easy. You'll fall slower.");
  assert.equal(P.voiceLine('cold', 'learned', { p: 'Ay$&la', how: 'arrows', rolls: () => 0.99 }), 'I have adapted to your arrows, Ay$&la.');
  for (const id of P.PERSONALITY_IDS) for (const ev of P.VOICE_EVENTS) for (let i = 0; i < 4; i++) {
    const l = P.voiceLine(id, ev, { p: 'Ayla', how: 'fire', item: 'Ebony Longsword', move: 'Skullsplitter', ally: 'Borgakh', rolls: () => i / 4 });
    assert.ok(l && !/[{}]/.test(l), `${id}.${ev}`);
  }
});

// ── the taunt ───────────────────────────────────────────────────────

test('RVN12a THE TAUNT\'S MOMENT: its newest deed against me first - a felling (by name), my flight, its long wait; after a kill, what it took; every other return, what it learned; else as ever (mutants: each moment unread; the order; the item\'s name; the habit\'s word)', () => {
  const sword = createWeapon(W.Longsword, 1, () => 0.5);
  assert.deepEqual(N.tauntMoment(rec({ history: [{ deed: 'slew', at: 1 }, { deed: 'felled', at: 2, ally: 'Borgakh' }, { deed: 'returned', at: 3 }] })), { event: 'felled_return', vars: { ally: 'Borgakh' } });
  assert.deepEqual(N.tauntMoment(rec({ history: [{ deed: 'felled', at: 2, ally: 'Borgakh' }, { deed: 'routed', at: 3 }] })), { event: 'routed_return', vars: {} });
  assert.deepEqual(N.tauntMoment(rec({ history: [{ deed: 'routed', at: 2 }, { deed: 'festered', at: 3 }] })), { event: 'festered', vars: {} });
  const dagger = createWeapon(W.Dagger, 1, () => 0.5);
  assert.deepEqual(N.tauntMoment(rec({ history: [{ deed: 'slew', at: 3 }], took: [dagger, sword] })), { event: 'stole', vars: { item: itemLongName(sword) } }, 'the newest piece');
  assert.equal(N.tauntMoment(rec({ history: [{ deed: 'fled', at: 3 }], took: [sword] })).event, 'taunt_fled', 'what it took speaks after a kill');
  assert.deepEqual(N.tauntMoment(rec({ learned: ['mailed', 'arrowWise'], returns: 1 })), { event: 'learned', vars: { how: 'arrows' } });
  assert.equal(N.tauntMoment(rec({ learned: ['arrowWise'], returns: 2 })).event, 'taunt_fled', 'every other return');
  assert.equal(N.tauntMoment(rec({ history: [{ deed: 'felled', at: 2 }] })).event, 'taunt_slew', 'a felling with no name falls through');
  assert.equal(N.tauntMoment(rec({ history: [{ deed: 'slew', at: 2 }], rank: 3, kills: 2 })).event, 'taunt_risen');
  assert.deepEqual(Object.keys(F.ADAPT_HOW).sort(), [...F.ADAPTATIONS].sort(), 'a word for every habit');
  // its card: a theft's taunt is its own kicker, the piece named
  const t = N.revenantTauntEvent(rec({ history: [{ deed: 'slew', at: 3 }], took: [sword] }), 'Ayla Stormwind', { rolls: () => 0 });
  assert.deepEqual([t.kind, t.kicker], ['stole', 'It took']);
  // PIN MOVED (AUDIT FEUD: no verb takes a number - "Your {item} remains" read "Your Leather Gauntlets remains")
  assert.equal(t.speech, `I still hold your ${itemLongName(sword)}.`);
  assert.equal(N.revenantTauntEvent(rec(), 'Ayla', { rolls: () => 0 }).kind, 'taunt');
});

// ── the events ──────────────────────────────────────────────────────

test('RVN12a THE EVENTS\' VOICES: the signature names its move (in the line too), the last stand its own, a deserter\'s parting and a betrayer\'s turning, a Devoted one\'s warning - a beast\'s deed for each (mutants: each voice unread; the move unhanded)', () => {
  const r = rec({ personality: 'cold' });
  const sig = N.revenantSignatureEvent(r, 'Skullsplitter', { playerName: 'Ayla', rolls: () => 0 });
  assert.deepEqual([sig.speech, sig.body, sig.line], ['Skullsplitter.', `${r.given} readies Skullsplitter!`, `${r.given} readies Skullsplitter! "Skullsplitter."`]);
  assert.equal(N.revenantLastStandEvent(r, 'Ayla', { rolls: () => 0 }).speech, 'Not yet.');
  assert.equal(N.revenantBetrayEvent(r, { playerName: 'Ayla Stormwind', rolls: () => 0.99 }).speech, 'Goodbye, Ayla.');
  assert.ok(P.voiceLines('cold', 'deserted').map((l) => l.replace('{p}', 'Ayla')).includes(N.revenantDesertEvent(r, { playerName: 'Ayla' }).speech));
  assert.equal(N.revenantWarnEvent(r, 'Ayla', { rolls: () => 0 }).speech, 'Behind you.');
  const rat = rec({ mobileType: M.Rat, personality: 'craven' });
  assert.equal(N.revenantSignatureEvent(rat, 'Gnash', { playerName: 'Ayla' }).speech, null, 'a beast says nothing');
  assert.equal(N.revenantBetrayEvent(rat).speech, null);
});

test('RVN12a THE HOSTS: the signature\'s card, the betrayer\'s and the deserter\'s carry my name (mutants: unhanded)', () => {
  assert.match(read('src/scenes/exteriorFoes.js'), /revenantSignatureEvent\(r, sb\.noun, \{ archive: f\.archive, playerName: playerEntity\?\.name \}\)/);
  assert.match(read('src/scenes/dungeonContext.js'), /revenantSignatureEvent\(r, sb\.noun, \{ archive: f\.mobileArchive, playerName: playerEntity\?\.name \}\)/);
  assert.match(read('src/scenes/world.js'), /revenantBetrayEvent\(r, \{ playerName: playerEntity\?\.name \}\)/);
  assert.match(read('src/systems/revenant.js'), /r\.notice === 'deserted' \? revenantDesertEvent\(r, \{ playerName: player\.name \}\)/);
});
