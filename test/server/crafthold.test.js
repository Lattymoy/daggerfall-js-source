// CRAFT-HOLD (2026-10-11, the exploit audit the owner asked for: "Can we look deep for duping"). INT3 holds a realm
// character's trade (a breach of the law, or staff's hand) - and its crafted pieces were listed, auctioned, handed to a commission's
// poster and disenchanted under ANY other character id: realmHoldOf asks the acting character alone and answers null for
// an id that is no realm id, while a crafted piece is the account's (`products.owner`). And a commission filled asked
// no hold at all. The hold now follows the piece (realm.js craftHoldOf: the realm character its maker's record names).
// PIN MOVED (AUTO-HOLD, 2026-10-16): the hold the cases set is staff's, where it was the copies' - no verdict writes that
// one now.
// PIN MOVED (INT19, 2026-10-17, Integrity-Arc section 7): a listing, an auction and a commission's fill take the piece out
// of the acting character's REALM RECORD (server-account/src/craftedPiece.js) - so another character's name lists nothing
// ('realm-needed'), and the acting record's own hold is the one asked; the maker's hold (craftHoldOf) stands for the
// disenchant's character with no record alone, and is pinned there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, holdPieces } from '../realmSeat.mjs';
import { disenchantPiece } from '../../server-account/src/alchemy.js';   // INT16: the route's own CRAFT-HOLD, behind the progression gate

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `chold-${String(++_rid).padStart(6, '0')}`;
const DF = 17, HUBS = { [DF]: [207, 212] };
const P = (n) => n.toString(16).padStart(16, '0');

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const eve = await s.registered('Eve');
  const E = await seatRealm(s.env, eve.secret, 'Eve', { name: 'Eve', level: 5, items: [], goldPieces: 0 });
  s.seedMarks(eve, 10_000);
  /** A piece Eve's realm character made (its maker's record names it), as the anvil writes one. */
  const piece = (provenance, { recipe = 'longsword:mithril', quality = 2 } = {}) => {
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, credited)
      VALUES (?, ?, ?, 'Eve', ?, 120, 5, ?, 4242, 'p1.x', ?, 1)`).run(provenance, eve.id, E.id, recipe, quality, _now);
    raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
      VALUES (?, ?, ?, ?, ?, 1, ?, 4242, 10, 0, ?, 'n')`).run(eve.id, `craft-${provenance}`, E.id, recipe, quality, provenance, _now);
  };
  const hold = (why) => raw.prepare('UPDATE realm_characters SET held = ? WHERE id = ?').run(why, E.id);
  return { s, raw, eve, E, piece, hold };
}

test('CRAFT-HOLD a held realm character\'s crafted piece lists and auctions under no other character\'s name - and lists again once the hold is lifted (mutants: the list route asks no record; the auction route too)', async () => {
  const { s, eve, E, piece, hold } = await stand();
  piece(P(0xa1));
  piece(P(0xa2), { quality: 4 });
  holdPieces(s.env, E.id, [{ provenance: P(0xa1) }, { provenance: P(0xa2), quality: 4 }]);
  hold('staff');
  const list = (character, provenance, currency = 'marks') => s.call('/v1/market/list', { character, region: DF, kind: 'piece', provenance, wear: 1000, price: 500, hubs: HUBS, rid: rid(), currency }, eve.secret);
  const auction = (character, provenance) => s.call('/v1/market/auction', { character, region: DF, provenance, wear: 1000, opening: 500, hubs: HUBS, rid: rid() }, eve.secret);
  for (const r of [await list(E.id, P(0xa1), 'gold'), await auction(E.id, P(0xa2))]) {
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'trade-held', 'its own record held');
  }
  // PIN MOVED (INT19): another character's name holds no record of the piece - it lists and auctions nothing
  for (const r of [await list('char-anything', P(0xa1)), await auction('char-anything', P(0xa2))]) {
    assert.deepEqual([r.status, r.body.error], [400, 'realm-needed'], 'whatever character the act names');
  }
  hold(null);
  const open = await list(E.id, P(0xa1));
  assert.equal(open.status, 200, `the hold lifted, it lists out of its record: ${JSON.stringify(open.body)}`);
  assert.equal(open.body.listing.state, 'open');
});

test('CRAFT-HOLD a commission is filled with no held character\'s craft - the route asked no hold at all (mutants: the fill route unheld)', async () => {
  const { s, eve, E, piece, hold } = await stand();
  const tom = await s.registered('Tom');
  s.seedMarks(tom, 10_000);
  piece(P(0xb1));
  const posted = await s.call('/v1/writs/commission', { character: tom.character, region: DF, crafter: 'Eve', recipe: 'longsword:mithril', quality: 2, pay: 900, rid: rid() }, tom.secret);
  assert.equal(posted.status, 200, JSON.stringify(posted.body));
  const id = posted.body.commission.id;
  const fulfil = (character) => s.call('/v1/writs/fulfil', { character, region: DF, commission: id, provenance: P(0xb1), wear: 1000, rid: rid() }, eve.secret);
  holdPieces(s.env, E.id, [{ provenance: P(0xb1) }]);
  hold('staff');
  const r = await fulfil(E.id);
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(r.body.error, 'trade-held');
  assert.equal((await fulfil('char-anything')).body.error, 'realm-needed', 'PIN MOVED (INT19): no record of it under another name - nothing filled');
  hold(null);
  assert.equal((await fulfil(E.id)).status, 200, 'the hold lifted, the commission is filled');
});

test('CRAFT-HOLD a held character\'s craft is disenchanted to the Stores under no other character\'s name (mutants: the disenchant route unheld)', async () => {
  const { s, raw, eve, E, piece, hold } = await stand();
  piece(P(0xc1));
  hold('staff');
  // PIN MOVED (INT16, Integrity-Arc section 7): a disenchant is a progression claim (its XP), asked of the account's
  // SEATED realm character before the route reads a word (progress.js progressRefusal) - another character's name is
  // refused 'progress-seat', and the held maker itself, the seat here, 'trade-held' at that gate
  const r = await s.call('/v1/prof/disenchant', { character: 'char-anything', provenance: P(0xc1), rid: rid() }, eve.secret);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.equal(r.body.error, 'progress-seat');
  const self = await s.call('/v1/prof/disenchant', { character: E.id, provenance: P(0xc1), rid: rid(), realm: E.at() }, eve.secret);
  assert.deepEqual([self.status, self.body], [403, { error: 'trade-held', held: 'staff' }], 'its maker, held, claims nothing');
  // the route's own CRAFT-HOLD stands behind the gate: asked as the route asks it (index.js ROUTES), another
  // character's name is refused for the piece's maker's hold, and nothing is disenchanted
  const player = raw.prepare('SELECT * FROM players WHERE id = ?').get(eve.id);
  const own = await disenchantPiece({ db: s.env.DB, primary: s.env.DB, nowS: _now, rand: (b) => crypto.getRandomValues(b), bucket: s.env.SAVES }, player, s.env, { character: 'char-anything', provenance: P(0xc1), rid: rid() });
  assert.deepEqual(own, { error: 'trade-held', held: 'staff' });
  assert.ok(raw.prepare('SELECT 1 FROM products WHERE provenance = ?').get(P(0xc1)), 'the piece stands');
});

test('AUDIT CRAFT-HOLD a held character with crafts at the account is not deleted - its row is where its hold lives, and deleted, its crafts listed under any other name the next minute; lifted, it goes; one with none goes as any other (mutants: the delete unheld; every held character refused)', async () => {
  const { s, raw, eve, E, piece, hold } = await stand();
  piece(P(0xd1));
  hold('staff');
  const del = await s.call('/v1/realm/delete', { id: E.id }, eve.secret);
  assert.equal(del.status, 409, JSON.stringify(del.body));
  assert.equal(del.body.error, 'trade-held');
  assert.ok(raw.prepare('SELECT 1 FROM realm_characters WHERE id = ?').get(E.id), 'the row and its hold stand');
  holdPieces(s.env, E.id, [{ provenance: P(0xd1) }]);
  const list = await s.call('/v1/market/list', { character: E.id, region: DF, kind: 'piece', provenance: P(0xd1), wear: 1000, price: 500, hubs: HUBS, rid: rid(), currency: 'marks' }, eve.secret);
  assert.equal(list.body.error, 'trade-held', 'and its craft still lists for nothing');   // PIN MOVED (INT19): out of its own record, held
  hold(null);
  assert.equal((await s.call('/v1/realm/delete', { id: E.id }, eve.secret)).status, 200, 'lifted, it goes as any other');
  // a held character with no piece of its make at the account: its Stores go with its row, nothing escapes - it goes
  const F = await seatRealm(s.env, eve.secret, 'Fen', { name: 'Fen', level: 5, items: [], goldPieces: 0 });
  raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(F.id);
  assert.equal((await s.call('/v1/realm/delete', { id: F.id }, eve.secret)).status, 200, 'held with no craft: deleted (a finding can be the law\'s mistake, and the slot is the player\'s)');
});

test('AUDIT CRAFT-HOLD the hold is a HOLD alone and the account\'s own: an unheld maker unjudged or dead refuses no sibling, another account\'s buyer of a held maker\'s piece is never refused, and a piece made before customs follows its customs character (mutants: record-unjudged refused; the account guard dropped; the origin unread)', async () => {
  const { s, raw, eve, E, piece, hold } = await stand();
  // PIN MOVED (INT19): the maker's hold is the disenchant's alone now, for a character with no record - asked as the route
  // asks it (index.js ROUTES), behind the progression gate (INT16), as the disenchant's own pin above asks it
  const disenchant = (who, character, provenance) => disenchantPiece({ db: s.env.DB, primary: s.env.DB, nowS: _now, rand: (b) => crypto.getRandomValues(b), bucket: s.env.SAVES },
    raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id), s.env, { character, provenance, rid: rid() });
  piece(P(0xe1));
  raw.prepare('UPDATE realm_characters SET judged_seq = NULL WHERE id = ?').run(E.id);
  const unjudged = await disenchant(eve, 'char-anything', P(0xe1));
  assert.notEqual(unjudged.error, 'trade-held', `its maker unjudged, not held: the piece is no held craft - ${JSON.stringify(unjudged)}`);
  assert.notEqual(unjudged.error, 'record-unjudged');
  const tom = await s.registered('Tom');
  s.seedMarks(tom, 10_000);
  piece(P(0xe2));
  raw.prepare('UPDATE products SET owner = ? WHERE provenance = ?').run(tom.id, P(0xe2));   // sold to Tom (a sale moves the owner alone)
  hold('staff');
  const theirs = await disenchant(tom, tom.character, P(0xe2));
  assert.notEqual(theirs.error, 'trade-held', `another account's piece, its maker held: ${JSON.stringify(theirs)}`);
  // a piece made before customs: its char_id the offline character the realm one came in as
  raw.prepare('UPDATE realm_characters SET origin_id = ? WHERE id = ?').run('char-offline1', E.id);
  piece(P(0xe3));
  raw.prepare('UPDATE products SET char_id = ? WHERE provenance = ?').run('char-offline1', P(0xe3));
  assert.equal((await disenchant(eve, 'char-anything', P(0xe3))).error, 'trade-held', 'its customs character held, it is held');
});

test('AUDIT CRAFT-HOLD a held character\'s Stores go into no guild\'s Stores and fill no guild\'s writ (mutants: the deposit unheld; the supply unheld)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const give = (who, m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, qty);
  const al = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(al, 100_000, 'al');
  assert.equal((await s.found(al, { name: 'The Gilded', tag: 'GLD' })).status, 200);
  give(al, 'log:oak', 40);
  const tom = await s.registered('Tom', { renown: 10 });
  s.seedMarks(tom, 100_000, 'tom');
  assert.equal((await s.found(tom, { name: 'The Oaken', tag: 'OAK' })).status, 200);
  assert.equal((await s.call('/v1/marks/guild/deposit', { character: tom.character, marks: 1000, rid: rid() }, tom.secret)).status, 200);
  const writ = (await s.call('/v1/writs/post', { character: tom.character, region: DF, material: 'log:oak', units: 10, pay: 3, rid: rid() }, tom.secret)).body.writ.id;
  const deposit = () => s.call('/v1/stores/guild-deposit', { character: al.character, material: 'log:oak', units: 10, rid: rid() }, al.secret);
  const supply = () => s.call('/v1/writs/supply', { character: al.character, region: DF, writ, units: 5, rid: rid() }, al.secret);
  raw.prepare("UPDATE realm_characters SET held = 'staff' WHERE id = ?").run(al.character);
  for (const r of [await deposit(), await supply()]) {
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.error, 'trade-held');
  }
  raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?').run(al.character);
  assert.equal((await deposit()).status, 200, 'lifted, it deposits');
  assert.equal((await supply()).status, 200, 'and supplies');
});

test('AUDIT CRAFT-HOLD a realm character whose OWN record holds a piece is not refused for its maker\'s hold on a disenchant - the record proves it its own (mutants: the hold asked over a record)', async () => {
  const { s, eve, piece, hold } = await stand();
  piece(P(0xf1));
  hold('staff');
  const sword = { group: 'Weapons', templateIndex: 120, material: 5, provenance: P(0xf1), recipe: 'longsword:mithril', name: 'Mithril Longsword', stackCount: 1 };
  const R2 = await seatRealm(s.env, eve.secret, 'Ena', { name: 'Ena', level: 5, goldPieces: 0, items: [sword] });
  const r = await s.call('/v1/prof/disenchant', { character: R2.id, provenance: P(0xf1), rid: rid(), realm: R2.at() }, eve.secret);
  assert.notEqual(r.body.error, 'trade-held', JSON.stringify(r.body));
  assert.equal(r.status, 200, JSON.stringify(r.body));
});
