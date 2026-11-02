// OUTDOOR-LOOT, SLICE 2 (2026-10-17): THE PURE HALF OF A CARRIED BASE - systems/roomLoot.js, read on its own.
// DESIGN.md 6.1 and 6.2: a building's cupboard cannot have a COMPUTED base (its stock is the first opener's roll), so its
// first roll is MINTED ONCE and travels in the word `b` (validRoomWord projects it, mergeRoomWord keeps the first base heard
// for a mint, roomWord and claimWord carry it, carriedBase makes the pieces); two births of one day with different rolls are
// two mints and the lower signature breaks a tie of instants (roomTermsBeat); an older build's whole list is a DIFF against
// its own previous one (legacyDelta); and composeRoomView's stored arm always hands a COPY (6.2 - a window that splits an
// undrawn stored stack mutated the state's own record, and the judge then spliced the whole piece). The cupboards' behaviour
// as a player meets it is test/net/containerloot*.test.js; this holds the laws they stand on.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baseSignature, carriedBase, claimWord, composeRoomView, judgeRoomClaim, legacyDelta, legacyCounts, mergeRoomWord, roomState, roomTermsBeat,
  roomWord, sameRoomTerms, validRoomWord, ROOM_BASE_MAX,
} from '../../src/systems/roomLoot.js';
import { LOOT_LIST_MAX } from '../../src/systems/loot/loot.js';

const piece = (name, templateIndex, extra = {}) => ({ name, templateIndex, group: 'Weapons', stackCount: 1, ...extra });
const ROLL = () => [piece('Dagger', 1), piece('Mace', 5), piece('Arrow', 4, { stackCount: 10 })];
const word = (b, extra = {}) => ({ k: 'container:0', g: 5, lv: 1, tm: 100, h: baseSignature(b), b, ...extra });
const names = (list) => list.map((it) => it.name);

test('6.2: composeRoomView hands a COPY of a stored piece, always - a window that splits the stack it shows leaves the state\'s record whole, and the judge draws from it', () => {
  const st = roomState({ g: 5, lv: 1, n: 1, tm: 1 });
  st.stored = [piece('Arrow', 4, { stackCount: 10 })]; st.ids = ['s:1'];
  const { list, seen } = composeRoomView([], [], st, [], null);
  assert.equal(list.length, 1);
  assert.notEqual(list[0], st.stored[0], 'an undrawn stored stack is a copy, not the state\'s own record');
  list[0].stackCount -= 4;   // the window\'s in-place split takes four off the stack it shows
  assert.equal(st.stored[0].stackCount, 10, 'the state\'s record stands');
  assert.equal(seen.get(list[0]).n, 10, 'and the view is read against what it showed');
  assert.equal(judgeRoomClaim(st, 0, [], { id: 'bbbb:x:1', sp: 's:1', n: 4, tm: 1 }), 4, 'the claim for the four draws four');
  assert.equal(st.stored[0].stackCount, 6, 'the six that were left stay in the room');
});

test('validRoomWord projects a carried base: each record through the item law, the signature required, the count bounded; an unreadable record or a base with no signature is no word at all (AUDIT SETS M2)', () => {
  const b = ROLL();
  const w = validRoomWord(word(b));
  assert.deepEqual(names(w.b), ['Dagger', 'Mace', 'Arrow']);
  assert.equal(w.h, baseSignature(b));
  assert.equal(Object.hasOwn(validRoomWord({ k: 'container:0', g: 5, lv: 1, tm: 1 }), 'b'), false, 'a word with no base says none');
  assert.equal(validRoomWord(word(b, { h: undefined })), null, 'a base always says its signature');
  assert.equal(validRoomWord(word([...b, { name: 'Future', templateIndex: 65535, group: 'Weapons' }])), null, 'a record this build cannot read makes the word unreadable');
  assert.equal(validRoomWord(word(Array.from({ length: LOOT_LIST_MAX + 1 }, (_, i) => piece('Dagger', 1, { uid: String(i) })))), null, 'past LOOT_LIST_MAX');
  assert.equal(validRoomWord({ k: 'container:0', g: 5, lv: 1, tm: 1, h: 'abc', b: 'nope' }), null, 'a base that is no list');
  assert.ok(LOOT_LIST_MAX <= ROOM_BASE_MAX, 'a place is named by a number under ROOM_BASE_MAX');
});

test('carriedBase: the live pieces by place, their minted counts, their signature, and the records kept as the word said them - a stack drawn down in the view leaves the records whole', () => {
  const b = ROLL();
  const base = carriedBase(validRoomWord(word(b)).b);
  assert.deepEqual(base.full, [1, 1, 10]);
  assert.equal(base.h, baseSignature(b));
  const { list } = composeRoomView(base.items, base.full, Object.assign(roomState({ g: 5, lv: 1, n: 1, tm: 1 }), { counts: new Map([[2, 3]]) }), [], null);
  assert.equal(list.find((it) => it.name === 'Arrow').stackCount, 3, 'the view draws the stack down');
  assert.equal(base.records[2].stackCount, 10, 'the records are as minted');
  assert.equal(base.full[2], 10);
});

test('mergeRoomWord keeps the FIRST base heard for a mint and drops a base for terms that lose; a word that beats the terms with no base to adopt is heard as a loser\'s', () => {
  const b1 = ROLL(), b2 = [piece('Katana', 9), piece('Staff', 3)];
  let { state } = mergeRoomWord(null, validRoomWord(word(b1)));
  const first = state.base;
  assert.deepEqual(names(first.items), ['Dagger', 'Mace', 'Arrow']);
  assert.equal(state.terms.h, baseSignature(b1), 'a carried base\'s terms say its signature');
  ({ state } = mergeRoomWord(state, validRoomWord(word(b1, { tm: 90, x: [0] }))));
  assert.equal(state.base, first, 'the same mint: the base stays the first heard');
  assert.equal(state.terms.tm, 90, 'and the earlier instant is the mint\'s');
  assert.ok(state.taken.has(0));
  const later = mergeRoomWord(state, validRoomWord(word(b2, { tm: 200, q: [{ id: 'cccc:s:1', p: 0, n: 1, tm: 5 }] })));
  assert.equal(later.state, state, 'a later mint changes nothing');
  assert.equal(state.base, first);
  assert.equal(state.claims.get('cccc:s:1')?.stale, true, 'its claims are on a base that is gone');
  const earlier = mergeRoomWord(state, validRoomWord(word(b2, { tm: 50 })));
  assert.notEqual(earlier.state, state, 'an earlier mint replaces the state');
  assert.deepEqual(names(earlier.state.base.items), ['Katana', 'Staff']);
  assert.equal(earlier.state.taken.size, 0, 'with its own takes - none');
  const noBase = mergeRoomWord(earlier.state, validRoomWord({ k: 'container:0', g: 5, lv: 1, tm: 10, h: baseSignature(b1), q: [{ id: 'dddd:s:1', p: 1, n: 1, tm: 5 }] }));
  assert.equal(noBase.state, earlier.state, 'an earlier mint\'s claim word has no base to adopt: the state stands');
  assert.equal(earlier.state.claims.get('dddd:s:1')?.stale, true);
});

test('two births of one day at one instant, one level and one count are two mints: the lower signature wins on every client, whichever it heard first (roomTermsBeat\'s last word)', () => {
  const a = [piece('Dagger', 1), piece('Mace', 5)], c = [piece('Katana', 9), piece('Staff', 3)];
  const wa = validRoomWord(word(a)), wc = validRoomWord(word(c));
  assert.ok(sameRoomTerms(wa, wc), 'sameRoomTerms reads g, lv and n alone - the written design\'s gap');
  assert.notEqual(wa.h, wc.h, 'two rolls, two signatures');
  const lowest = wa.h < wc.h ? a : c;
  const ac = mergeRoomWord(mergeRoomWord(null, wa).state, wc).state, ca = mergeRoomWord(mergeRoomWord(null, wc).state, wa).state;
  assert.equal(ac.terms.h, ca.terms.h, 'one winner whichever came first');
  assert.deepEqual(names(ac.base.items), names(lowest));
  assert.deepEqual(names(ca.base.items), names(lowest));
  assert.equal(roomTermsBeat({ g: 1, tm: 5, lv: 1, n: 1, h: 'a' }, { g: 1, tm: 5, lv: 1, n: 1, h: 'b' }), true);
  assert.equal(roomTermsBeat({ g: 1, tm: 5, lv: 1, n: 1, h: 'b' }, { g: 1, tm: 5, lv: 1, n: 1, h: 'a' }), false);
  assert.equal(roomTermsBeat({ g: 1, tm: 5, lv: 1, n: 1 }, { g: 1, tm: 5, lv: 1, n: 1 }), false, 'a computed base\'s terms say no signature, and equal is not a win');
});

test('a COMPUTED base is as it was: no signature in its terms, one mint for equal terms, the earlier instant kept (PARTY-LOOT)', () => {
  const w = (extra) => validRoomWord({ k: 'loot:0', g: 0, lv: 3, tm: 100, h: 'abc', ...extra });
  let { state } = mergeRoomWord(null, w({ x: [1] }));
  assert.equal(state.terms.h, undefined);
  assert.equal(state.base, null);
  ({ state } = mergeRoomWord(state, w({ tm: 60, h: 'zzz', x: [2] })));
  assert.deepEqual([...state.taken].sort(), [1, 2], 'the same terms are one base whatever the word\'s signature says (the caller checks it against its own computed one)');
  assert.equal(state.terms.tm, 60);
});

test('roomWord and claimWord say a carried base when handed one, and only then', () => {
  const base = carriedBase(validRoomWord(word(ROLL())).b);
  const st = mergeRoomWord(null, validRoomWord(word(ROLL()))).state;
  const w1 = roomWord('container:0', st, base.h, { s: [], si: [] }, null, [], base.records);
  assert.deepEqual(names(w1.b), ['Dagger', 'Mace', 'Arrow']);
  assert.equal(validRoomWord(w1).h, base.h, 'and the word reads back');
  assert.notEqual(w1.b[0], base.records[0], 'copies - the records are never the word');
  assert.equal(Object.hasOwn(roomWord('container:0', st, base.h, { s: [], si: [] }), 'b'), false);
  const w2 = claimWord('container:0', st, base.h, [], [], null, base.records);
  assert.equal(w2.b.length, 3);
  assert.equal(Object.hasOwn(claimWord('container:0', st, base.h, [{ id: 'bbbb:x:1', p: 0, n: 1, tm: 1 }], []), 'b'), false);
});

test('legacyDelta: an older build\'s list is read against its own previous one - a piece that fell in count is its take, one that rose its put, a list as it was changes nothing', () => {
  const prev = legacyCounts([piece('Dagger', 1), piece('Mace', 5), piece('Arrow', 4, { stackCount: 10 })]);
  assert.deepEqual(legacyDelta(prev, [piece('Dagger', 1), piece('Mace', 5), piece('Arrow', 4, { stackCount: 10 })]).takes, []);
  assert.deepEqual(legacyDelta(prev, [piece('Dagger', 1), piece('Mace', 5), piece('Arrow', 4, { stackCount: 10 })]).puts, []);
  const d = legacyDelta(prev, [piece('Dagger', 1), piece('Arrow', 4, { stackCount: 6 }), piece('Flail', 7)]);
  assert.deepEqual(d.takes.map(({ n }) => n).sort(), [1, 4], 'the Mace and four of the arrows');
  assert.deepEqual(d.puts.map(({ it, n }) => [it.name, n]), [['Flail', 1]]);
  assert.equal(d.counts.size, 3, 'and the list\'s own census is the next baseline');
  assert.deepEqual(legacyDelta(null, [piece('Dagger', 1)]).puts.map(({ n }) => n), [1], 'no baseline: everything is new (the caller never asks - a first word is a baseline)');
  const uid = legacyCounts([piece('Rare', 9, { uid: 'a1' }), piece('Rare', 9, { uid: 'b2' })]);
  assert.equal(uid.size, 2, 'two pieces of one template with different ledger ids are two pieces');
});
