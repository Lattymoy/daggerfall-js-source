// GUILD-YARD (2026-10-02, Mac: "Guild hall next"): A GUILD HALL'S OUTSIDE AND ITS YARD - Seats-Arc 8.2's NOT YET ("a
// hall's outside and yard (HOME-LOOK and HOME-YARD name a character)"). A hall's keepers (its Officers and its
// guildmaster, a realm character each - decor.js OWNS, the rule its rooms are furnished by) paint its outside and place
// its yard; a plain member and anyone outside the guild do neither; everyone sees both. The service through the real
// Worker over node:sqlite (test/accountDb.mjs): the look, the yard's pieces paid off the keeper's record, a piece's half
// into the guild's treasury, the sale paying its yard's half as its rooms'; the client: whose outside the playing
// character keeps (systems/onlineHomes.js homeOutsideKept), the yard's decorator on a hall's lot (scenes/homeYards.js),
// the hall drawn out of the merge for its keeper's painter (scenes/world.js). `06-Systems/Online-Arc.md` GUILD-YARD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { homeSaleRefund, homeLookOf } from '../src/net/homeLaw.js';
import { DECOR_YARD_CAP } from '../src/net/decorLaw.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { homeOutsideKept, homeYardWhere, createOnlineHomes, homeHallRows, HOME_VERB, HALL_VERB, hallEntryTurnable } from '../src/systems/onlineHomes.js';
import { createHomeYards, YARD_IN_HALL, YARD_HALL_FULL, YARD_IN_HOUSE, YARD_FULL } from '../src/scenes/homeYards.js';
import { decorWhyNot } from '../src/ui/decorPanel.js';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle } from './decorFakes.mjs';
import { GuildBook } from '../src/net/guildBook.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HALL = { mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: null };   // AUDIT PRE-MERGE 1003 WD1: a hall says its town's layout (none: an old build's, 426)
const piece = (over = {}) => ({ id: 'yard1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });
const LOOK = { walls: { set: 'manor', climate: 'swamp' }, door: { climate: 'desert', record: 1 } };

/** A guild founded by Gwen with its hall bought; Otto its Officer, Rhea a Recruit, Hugo outside it - each a realm
 *  character of their own. */
async function stood() {
  const svc = await standService();
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const dep = await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 60_000, realm: gm.at(), region: 17 }, gm.secret);
  assert.equal(dep.status, 200, JSON.stringify(dep.body));
  const realmOf = async (handle) => {
    const who = await svc.registered(handle);
    const R = await seatRealm(svc.env, who.secret, handle, { name: handle, level: 5, goldPieces: 50_000, items: [] });
    who.character = R.id; who.at = R.at;
    return who;
  };
  const join = async (handle) => {
    const who = await realmOf(handle);
    assert.equal((await svc.call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret)).status, 200);
    const inv = await svc.call('/v1/guilds/invites', {}, who.secret);
    assert.equal((await svc.call('/v1/guilds/answer', { character: who.character, guild: inv.body.invites[0].guild, accept: true }, who.secret)).status, 200);
    return who;
  };
  const officer = await join('Otto');
  const recruit = await join('Rhea');
  const outsider = await realmOf('Hugo');
  const view = async () => (await svc.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild;
  const otto = (await view()).members.find((m) => m.name === 'Otto');
  assert.equal((await svc.call('/v1/guilds/rank', { character: gm.character, member: otto.member, rank: 1 }, gm.secret)).status, 200);
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  const raw = svc.env.DB._raw;
  const goldOf = (who) => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj))).goldPieces;
  const place = (who, body) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: who.character, realm: who.at(), yard: true, ...body }, who.secret);
  const paint = (who, look) => svc.call('/v1/homes/look', { mapId: 7, buildingKey: 300, character: who.character, look }, who.secret);
  const hallIn = async (who) => (await svc.call('/v1/homes/town', { mapId: 7, character: who?.character ?? null }, who?.secret ?? (await svc.guest()).secret)).body.homes.find((h) => h.buildingKey === 300);
  return { svc, gm, officer, recruit, outsider, view, raw, goldOf, place, paint, hallIn };
}

test('GUILD-YARD the hall\'s OUTSIDE: its Officer and its guildmaster paint it, free, as a home\'s owner does; a Recruit of its own guild and a stranger paint nothing of it (`no-home`); the town answers its look to everyone - a member, a stranger, a guest; null paints it back the town\'s own (mutants: the look\'s owner a character again; OWNS\'s keepers any rank; the hall\'s look unanswered)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { officer, gm, recruit, outsider, paint, hallIn, view } = await stood();
  const before = await view();
  const r = await paint(officer, LOOK);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.look, homeLookOf(LOOK));
  // AUDIT GUILD-YARD: free, as a home's look is - the guild's treasury and its ledger untouched (the keeper's record never
  // moved either: a look's write asks none)
  const after = await view();
  assert.deepEqual([after.treasury, after.ledger.length], [before.treasury, before.ledger.length], 'free, as a home\'s look is');
  assert.equal((await paint(recruit, { walls: { set: 'tavern', climate: 'desert' } })).body.error, 'no-home', 'a Recruit paints nothing of it');
  assert.equal((await paint(outsider, { walls: { set: 'tavern', climate: 'desert' } })).body.error, 'no-home', 'nor anyone outside the guild');
  for (const who of [recruit, outsider, null]) assert.deepEqual((await hallIn(who)).look, homeLookOf(LOOK), 'everyone sees it - a guest too');
  const mine = await hallIn(gm);
  assert.equal(mine.keeper, true);
  assert.deepEqual(mine.look, homeLookOf(LOOK));
  assert.equal((await paint(gm, null)).status, 200, 'the guildmaster keeps it too');
  assert.equal((await hallIn(null)).look, undefined, 'the town\'s own again');
});

test('GUILD-YARD the hall\'s YARD: its keepers place pieces outside it off their own records, under the yard\'s own cap and law; a Recruit and a stranger place nothing; the room\'s list never shows the yard and the town\'s yards show it to a guest (mutants: the hall\'s yard refused again - its read and its write; OWNS\'s keepers any rank)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, officer, gm, recruit, outsider, raw, goldOf, place } = await stood();
  const had = goldOf(officer);
  const y = await place(officer, { piece: piece() });
  assert.equal(y.status, 200, JSON.stringify(y.body));
  assert.equal(goldOf(officer), had - 120, 'the Officer\'s own record paid for it, as a home\'s yard is paid');
  assert.equal((await place(gm, { piece: piece({ id: 'yard2' }) })).status, 200, 'the guildmaster keeps it too');
  assert.equal((await place(recruit, { piece: piece({ id: 'r1' }) })).body.error, 'no-home', 'a Recruit places nothing');
  assert.equal((await place(outsider, { piece: piece({ id: 'h1' }) })).body.error, 'no-home', 'nor a stranger');
  assert.equal((await place(officer, { piece: piece({ id: 'yard3', storage: true }) })).body.error, 'bad-decor', 'the yard\'s own law: nothing held outside');
  const room = await svc.call('/v1/homes/decor', { mapId: 7, buildingKey: 300 }, recruit.secret);
  assert.deepEqual(room.body.pieces, [], 'the hall\'s rooms list none of it');
  const g = await svc.guest();
  const yards = await svc.call('/v1/homes/yards', { mapId: 7 }, g.secret);
  assert.deepEqual(yards.body.yards.map((x) => [x.buildingKey, x.pieces.map((p) => p.id)]), [[300, ['yard1', 'yard2']]], 'a visitor sees it');
  // its own cap: sixty a yard, as a home's
  const ins = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, 300, ?, 41000, ?, ?, 0, 1)');
  for (let i = 0; i < DECOR_YARD_CAP - 2; i++) ins.run(`y${i}`, JSON.stringify({ pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 }), T0);
  assert.equal((await place(officer, { piece: piece({ id: 'yardX' }) })).body.error, 'yard-cap');
  // a palace stands no yard still - its word
  assert.match(REFUSALS['hall-yard'], /palace/);
});

test('GUILD-YARD a yard piece\'s HALF goes to the GUILD\'S TREASURY - taken out or shrunk, by whichever keeper, never to the keeper\'s purse; the ledger names it `hall-piece` (mutants: a yard piece\'s half to the record)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, officer, gm, view, goldOf, place } = await stood();
  assert.equal((await place(officer, { piece: piece() })).status, 200);
  const paidBy = goldOf(officer), gmHad = goldOf(gm);
  const t0 = (await view()).treasury;
  const gone = await svc.call('/v1/homes/decor/remove', { mapId: 7, buildingKey: 300, character: gm.character, id: 'yard1', realm: gm.at() }, gm.secret);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.deepEqual([gone.body.gold, gone.body.treasury], [0, 60], 'nothing to the purse, half into the treasury');
  const g = await view();
  assert.equal(g.treasury, t0 + 60);
  assert.equal(g.ledger[0].kind, 'hall-piece');
  assert.deepEqual([goldOf(officer), goldOf(gm)], [paidBy, gmHad], 'neither keeper\'s record moved');
  // shrunk: half the difference, the same way
  assert.equal((await place(officer, { piece: piece({ id: 'y2', paid: 200 }) })).status, 200);
  const shrink = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: officer.character, id: 'y2', realm: officer.at(), place: { pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 100 } }, officer.secret);
  assert.equal(shrink.status, 200, JSON.stringify(shrink.body));
  assert.equal(shrink.body.treasury, 50);
  assert.equal((await view()).treasury, t0 + 110);
});

test('GUILD-YARD the hall SOLD: its yard goes with it as its rooms\' pieces do - half of what records paid for each, yard and room alike, back into the treasury with the deed share, nothing left standing outside (mutants: the sale\'s sum without the yard)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, officer, gm, view, raw, place } = await stood();
  assert.equal((await place(officer, { piece: piece() })).status, 200);
  assert.equal((await place(officer, { piece: piece({ id: 'y2', paid: 200 }) })).status, 200);
  assert.equal((await place(officer, { piece: piece({ id: 'room1', pos: [2, 0, 2] }), yard: false })).status, 200);
  const t0 = (await view()).treasury;
  const sold = await svc.call('/v1/guilds/hall/sell', { character: gm.character }, gm.secret);
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.equal(sold.body.decorCount, 3, 'the yard\'s two and the room\'s one');
  assert.equal(sold.body.decorBack, 60 + 100 + 60);
  assert.equal(sold.body.refund, homeSaleRefund(30_000));
  assert.equal((await view()).treasury, t0 + homeSaleRefund(30_000) + 220);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE yard = 1').get().n, 0, 'cleared');
  const g = await svc.guest();
  assert.deepEqual((await svc.call('/v1/homes/yards', { mapId: 7 }, g.secret)).body.yards, [], 'the street sees none of it');
});

test('GUILD-YARD whose outside the playing character keeps: its own home\'s, or a hall it is a keeper of - never a hall it is a plain member of, nor a stranger\'s; the yard\'s name follows (mutants: a member keeps; a keeper keeps none)', () => {
  assert.equal(homeOutsideKept({ own: true }), true, 'one\'s own home');
  assert.equal(homeOutsideKept({ own: false, hall: { name: 'The Hand' }, member: true, keeper: true }), true, 'a hall one keeps');
  assert.equal(homeOutsideKept({ own: false, hall: { name: 'The Hand' }, member: true, keeper: false }), false, 'a member keeps nothing outside');
  assert.equal(homeOutsideKept({ own: false, mine: true }), false, 'another character\'s home of the account');
  assert.equal(homeOutsideKept({ own: false, keeper: true }), false, 'a keeper\'s word on no hall');
  assert.equal(homeOutsideKept(null), false);
  assert.equal(homeYardWhere({ hall: true }), "Your guild's yard");
  assert.equal(homeYardWhere({ hall: false }), 'Your yard');
});

test('GUILD-YARD the client\'s registry: a hall\'s look is kept from the town\'s answer and its keeper\'s paint is sent as a home\'s, with the playing character - shown at once, the hall still a hall (mutants: none - the registry is a home\'s)', async () => {
  const writes = [];
  const api = {
    town: async () => ({ ok: true, data: { homes: [{ buildingKey: 300, owner: 'The Silver Hand', entry: 'guild', mine: false, hall: { name: 'The Silver Hand', tag: 'SH', heraldry: null }, member: true, keeper: true, look: LOOK }] } }),
    look: async (b) => { writes.push(b); return { ok: true, data: { look: b.look } }; },
  };
  const homes = createOnlineHomes({ api, character: () => 'r0123456789abcdef0123' });
  await homes.ensure(7);
  const h = homes.homeAt(7, 300);
  assert.deepEqual(h.look, homeLookOf(LOOK));
  assert.equal(homeOutsideKept(h), true);
  const next = { roof: { climate: 'mountain', record: 2 } };
  assert.equal((await homes.setLook(7, 300, next)).ok, true);
  assert.deepEqual(writes[0], { mapId: 7, buildingKey: 300, character: 'r0123456789abcdef0123', look: next });
  assert.deepEqual(homes.homesIn(7).get(300).look, next);
  assert.equal(homes.homeAt(7, 300).hall.name, 'The Silver Hand');
});

/** A fake world: one town pixel, the guild's hall (key 300) at 10, 0, 10 - 8 by 6 - as `row` says it to the playing
 *  character; the decorator's writes and its words kept. AUDIT GUILD-YARD: `frames` and `rows` other buildings (key
 *  -> frame, key -> what the town says of it), `feet` where the player stands, `setLook` and `refusal` the registry's
 *  write and the host's words in their place. */
function world(row, { pieces = [], frames = null, rows = new Map(), feet: at = [18, 0, 10], setLook = null, refusal = (w) => w } = {}) {
  const homeFrames = new Map(frames ?? [[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const writes = [], said = [], looks = [];
  const api = {
    yards: async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces }] } }),
    place: async (b) => { writes.push(['place', b]); return { ok: true, data: { piece: b.piece } }; },
    move: async (b) => { writes.push(['move', b]); return { ok: true, data: {} }; },
    remove: async (b) => { writes.push(['remove', b]); return { ok: true, data: { piece: pieces.find((p) => p.id === b.id), gold: 0, treasury: 60 } }; },
  };
  const homes = { homeAt: (m, k) => (k === 300 ? row : rows.get(k) ?? null), setLook: setLook ?? (async (m, k, look) => { looks.push([m, k, look]); return { ok: true, look }; }) };
  const feet = [...at];
  const gold = { n: 5000 };
  const doc = fakeDoc();
  const yards = createHomeYards({
    api, homes, built: () => built, translation: () => [0, 0, 0], feet: () => feet, outside: () => true, eye: () => [feet[0], 1.6, feet[2]],
    collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: (o, d) => ({ dist: d[1] < 0 ? o[1] / -d[1] : Infinity, normal: [0, 1, 0] }) }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[41000, { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => 'r0123456789abcdef0123', realm: () => null,
    wallet: () => ({ get gold() { return gold.n; }, pay: (n) => { gold.n -= n; }, credit: (n) => { gold.n += n; } }), regionOf: () => 17,
    doc, win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say: (l) => said.push(l), refusal, openSlot() {}, now: () => 0,
    look: { preview() {}, season: () => 0 },
  });
  return { yards, writes, said, looks, gold, doc, feet };
}
const cam = { pos: [18, 1.6, 10], yaw: Math.PI, pitch: -0.6 };
const HALL_ROW = { owner: 'The Silver Hand', own: false, mine: false, hall: { name: 'The Silver Hand', tag: 'SH', heraldry: null }, member: true, keeper: true, look: null };
const stand = async (w) => { for (let i = 0; i < 3; i++) { w.yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); } };

test('GUILD-YARD the decorator on a hall\'s lot: its keeper standing on it finds it - an empty yard stood for them, a guild\'s yard by name, `hall` to the tool; a plain member finds none, and a yard with pieces stands for every visitor (mutants: the stand\'s keeper unasked; the lot\'s keeper unasked; the room\'s `hall`; the yard\'s name)', async () => {
  const k = world(HALL_ROW);
  await stand(k);
  assert.equal(k.yards.yards().length, 1, 'an empty yard stands for its keeper');
  const here = k.yards.here();
  assert.ok(here, 'the keeper stands on the hall\'s lot');
  assert.equal(here.hall, true);
  assert.equal(homeYardWhere(here), "Your guild's yard");
  const m = world({ ...HALL_ROW, keeper: false });
  await stand(m);
  assert.equal(m.yards.here(), null, 'a plain member furnishes nothing outside');
  assert.equal(m.yards.yards().length, 0, 'and no empty yard stands for them');
  const v = world({ ...HALL_ROW, member: false, keeper: false }, { pieces: [piece()] });
  await stand(v);
  assert.equal(v.yards.yards().length, 1, 'a visitor sees the yard');
  assert.deepEqual(v.yards.yards()[0].pool.list().map((p) => p.id), ['yard1']);
  assert.equal(v.yards.here(), null, 'and furnishes none of it');
});

test('GUILD-YARD the keeper\'s yard decorator: a yard piece taken out says its half went to the guild\'s treasury and gives the purse nothing; the hall\'s outside painted from the Exterior tab is sent as a home\'s and said as the hall\'s (mutants: the room\'s `hall` lost - the half to the purse; the painted word)', async () => {
  const w = world(HALL_ROW, { pieces: [piece()] });
  await stand(w);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  for (let i = 0; i < 4; i++) { w.yards.frame({ dt: 0.1, cam, overlayUp: true }); await settle(); }
  // the panel's Remove, on the yard's own piece
  const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
  const panel = () => w.doc.body.children.find((c) => c.className === 'dfdecor');
  const press = (match) => walk(panel(), (n) => { if (match(n)) n.fire('click'); });
  press((n) => typeof n.textContent === 'string' && n.textContent.startsWith('In this yard') && n.tag === 'button');
  await settle();
  press((n) => n.dataset?.key === 'yard1');
  await settle();
  let text = '';
  walk(panel(), (n) => { if (typeof n.textContent === 'string') text += `${n.textContent}\n`; });
  assert.match(text, /back to the guild's treasury/, 'the panel says whose the half is');
  press((n) => n.tag === 'button' && n.textContent === 'Remove');
  for (let i = 0; i < 4; i++) await settle();
  const sent = w.writes.find((x) => x[0] === 'remove')?.[1];
  assert.ok(sent, w.said.join(' / '));
  assert.deepEqual([sent.mapId, sent.buildingKey, sent.id, sent.character], [7, 300, 'yard1', 'r0123456789abcdef0123']);
  assert.equal(w.gold.n, 5000, 'nothing back to the keeper\'s purse');
  assert.ok(w.said.some((l) => /60 gold back to the guild's treasury/.test(l)), w.said.join(' / '));
  // the hall's outside, painted from the Exterior tab
  assert.equal(await tool.paintAct('commit', LOOK), true);
  assert.deepEqual(w.looks[0], [7, 300, LOOK], 'sent for the hall, as a home\'s look is');
  assert.ok(w.said.includes("Your guild's hall is painted."), w.said.join(' / '));
});

test('GUILD-YARD the world host by source: a hall its playing character keeps leaves the pixel\'s merge as an owner\'s home does, so its keeper\'s painter tries a look on it, and a hall kept in a merged pixel rebuilds it once (mutants: the keeper unasked at the build; at the refresh)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(homeRow && \(homeLook \|\| homeRow\.mine \|\| homeRow\.keeper\)\) \{/);
  assert.match(w, /\(row\?\.look \|\| row\?\.mine \|\| row\?\.keeper\)\) merged = true;/);
  const y = src('src/scenes/homeYards.js');
  assert.match(y, /if \(!home \|\| \(!pieces\?\.length && !homeOutsideKept\(home\)\)\) continue;/);
  assert.match(src('server-account/src/homes.js'), /UPDATE homes SET look = \? WHERE map_id = \? AND building_key = \? AND \$\{OWNS\}/);
});

// ── AUDIT GUILD-YARD (2026-10-02): the decorator's yard between two kept lots, the painted word, a keeper's rank moved,
// a keeper's realm character, a home's character, the hall's own words ─────────────────────────────────────────────

const HOME_ROW = { owner: 'Gwen', own: true, mine: true, character: 'r0123456789abcdef0123', hall: null, look: null };
const HALL_AT = [300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }];
const panelText = (w) => {
  let text = '';
  const walk = (n) => { if (typeof n.textContent === 'string') text += `${n.textContent}\n`; for (const c of n.children ?? []) walk(c); };
  walk(w.doc.body.children.find((c) => c.className === 'dfdecor'));
  return text;
};
const pressIn = (w, match) => { const walk = (n) => { if (match(n)) n.fire('click'); for (const c of n.children ?? []) walk(c); }; walk(w.doc.body.children.find((c) => c.className === 'dfdecor')); };

test('AUDIT GUILD-YARD C1 two kept lots under the feet - a home\'s owner who keeps the guild\'s hall beside it: the decorator opens the yard whose house stands nearest, whichever the town stood first; a lot the feet stand on before one they only stand near, though its house is nearer (mutants: the first yard stood; the lot stood on unpreferred)', async () => {
  const home = [301, { at: [20, 0, 10], box: [16, 0, 7, 24, 6, 13] }];   // the hall's lot runs to x 20, the home's from x 10
  for (const frames of [[HALL_AT, home], [home, HALL_AT]]) {
    const order = frames[0][0];
    const byHome = world(HALL_ROW, { frames, rows: new Map([[301, HOME_ROW]]), feet: [15.8, 0, 10] });
    await stand(byHome);
    assert.equal(byHome.yards.yards().length, 2, 'both kept yards stand');
    assert.equal(byHome.yards.here()?.yard.bk, 301, `a step from the home's wall: the home's yard (${order} stood first)`);
    assert.equal(byHome.yards.here().hall, false);
    const byHall = world(HALL_ROW, { frames, rows: new Map([[301, HOME_ROW]]), feet: [14.2, 0, 10] });
    await stand(byHall);
    assert.equal(byHall.yards.here()?.yard.bk, 300, `a step from the hall's wall: the hall's (${order} stood first)`);
    assert.equal(byHall.yards.here().hall, true);
  }
  // the hall's lot holds the feet at its corner (8.3 m from its house); the home's lot is half a metre off (6.5 m from its
  // house, within YARD_NEAR of its lot): the lot stood on
  const north = [302, { at: [20, 0, 28], box: [16, 0, 25.4, 24, 6, 31] }];
  for (const frames of [[HALL_AT, north], [north, HALL_AT]]) {
    const w = world(HALL_ROW, { frames, rows: new Map([[302, HOME_ROW]]), feet: [19.9, 0, 18.9] });
    await stand(w);
    assert.equal(w.yards.here()?.yard.bk, 300, `the lot under the feet (${frames[0][0]} stood first)`);
  }
});

test('AUDIT GUILD-YARD C2 the painted word is the hall\'s though the decorator shut and its keeper walked off the lot while the write was out; a write refused without words says the hall could not be painted, never the house (mutants: whose read after the write; the house\'s fallback)', async () => {
  let answer;
  const w = world(HALL_ROW, { setLook: () => new Promise((r) => { answer = r; }) });
  await stand(w);
  const tool = w.yards.tool();
  assert.ok(w.yards.here()?.hall);
  const painted = tool.paintAct('commit', LOOK);
  await settle();
  tool.close();
  w.feet[0] = 100;   // off the lot
  w.yards.frame({ dt: 0.1, cam, overlayUp: false });
  assert.equal(w.yards.here(), null, 'nobody\'s room while the answer is out');
  answer({ ok: true, look: LOOK });
  assert.equal(await painted, true);
  assert.deepEqual(w.said, ["Your guild's hall is painted."]);
  const f = world(HALL_ROW, { setLook: async () => ({ ok: false, error: 'network' }), refusal: () => null });
  await stand(f);
  assert.equal(await f.yards.tool().paintAct('commit', LOOK), false);
  assert.deepEqual(f.said, ['The hall could not be painted.']);
  const h = world(HOME_ROW, { setLook: async () => ({ ok: false, error: 'network' }), refusal: () => null });
  await stand(h);
  assert.equal(await h.yards.tool().paintAct('commit', LOOK), false);
  assert.deepEqual(h.said, ['The house could not be painted.'], 'a home\'s own words still');
});

test('AUDIT GUILD-YARD C3 a keeper made or unmade: the guild book\'s refresh that finds the rank moved reads the town again, forced, as a hall bought does (the registry\'s `keeper` was the town\'s answer, believed a minute) - in the guild book\'s hook, never an online frame\'s arm; AUDIT PROF-541 G1: at EVERY look - the Guild tab\'s, the seat Edicts\', a room\'s word, an act\'s - never only the hall plaque\'s (mutants: the town unread; the rank\'s move untold; no guild told at the first look)', async () => {
  // AUDIT PROF-541 G1: the guild book tells its host a moved `id|rank|hall` from whichever look found it
  let guild = { id: 'g1', name: 'The Silver Hand', rank: 1, hall: { mapId: 7 }, treasury: 0 };
  const door = { mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }) };
  let told = 0;
  const book = new GuildBook({ door, character: () => 'r0123456789abcdef0123', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), onRank: () => { told++; } });
  await book.refresh();
  assert.equal(told, 1, 'the first look that finds a guild tells it (AUDIT GUILD1d A5: the plaque asked before it was known)');
  await book.refresh();
  assert.equal(told, 1, 'the same rank again: nothing told');
  guild = { ...guild, rank: 2 };   // demoted from Officer, the Guild tab's look finding it
  await book.refresh();
  assert.equal(told, 2, 'an Officer demoted: told, whoever looked');
  guild = { ...guild, hall: null };
  await book.refresh();
  assert.equal(told, 3, 'the hall gone: told');
  guild = null;
  await book.refresh();
  assert.equal(told, 4, 'out of the guild: told');
  const quiet = new GuildBook({ door: { ...door, mine: async () => ({ ok: true, data: { guild: null } }) }, character: () => 'r0123456789abcdef0123', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), onRank: () => { told++; } });
  await quiet.refresh();
  assert.equal(told, 4, 'a look that finds no guild, as none was known: nothing told');
  const loud = new GuildBook({ door: { ...door, mine: async () => ({ ok: true, data: { guild: { id: 'g2', rank: 0 } } }) }, character: () => 'r0123456789abcdef0123', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), onRank: () => { throw new Error('boom'); } });
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual(await loud.refresh(), { ok: true }, 'a host that throws costs the town its read, never the tab its look'); } finally { console.warn = warn; }
  // the host: the hook reads the town again, forced - outside the online frame; the plaque's info only looks
  const w = src('src/scenes/world.js');
  const made = w.indexOf('    guildBook = new GuildBook({');
  assert.ok(made > 0);
  const opts = w.slice(made, w.indexOf('\n    });\n', made));
  assert.match(opts, /onRank: \(\) => \{ onlineHomes\?\.bump\?\.\(\); onlineHomes\?\.ensure\?\.\(_musicLoc\?\.mapTableData\?\.mapId, \{ force: true \}\)\?\.catch\?\.\(\(\) => \{\}\); \},/);
  const info = w.indexOf('    guildHall: {\n      info: () => {');
  assert.ok(info > 0);
  assert.ok(!w.slice(info, w.indexOf('      buy: (o) =>', info)).includes('onlineHomes'), 'the plaque\'s look tells nothing itself - the book does');
  const frameAt = w.indexOf('  const onlineFrame = (now, dt) => {');
  assert.ok(frameAt > 0 && !w.slice(frameAt, w.indexOf('\n  };\n', frameAt)).includes('onRank'), 'not in the online frame');
  // why the force: the registry believes a town's answer a minute - an unforced ask inside it keeps the old `keeper`
  let keeper = true, t = 0;
  const api = { town: async () => ({ ok: true, data: { homes: [{ buildingKey: 300, owner: 'SH', entry: 'guild', hall: { name: 'SH' }, member: true, ...(keeper ? { keeper: true } : {}) }] } }) };
  const homes = createOnlineHomes({ api, character: () => 'r0123456789abcdef0123', now: () => t });
  await homes.ensure(7);
  assert.equal(homeOutsideKept(homes.homeAt(7, 300)), true);
  keeper = false; t = 30_000;
  await homes.ensure(7);
  assert.equal(homeOutsideKept(homes.homeAt(7, 300)), true, 'unforced: the old answer, a minute');
  await homes.ensure(7, { force: true });
  assert.equal(homeOutsideKept(homes.homeAt(7, 300)), false, 'forced: unmade at once');
});

test('AUDIT GUILD-YARD Y1 the town names a hall\'s keeper as OWNS keeps it - an Officer playing a LOCAL character (no realm record) is a member and no keeper, its paint and its yard refused; a realm Officer keeps it (mutants: the keeper named off the rank alone)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, view } = await stood();
  const lola = await svc.registered('Lola');   // a local character, `char-lola`
  assert.equal((await svc.call('/v1/guilds/invite', { character: gm.character, handle: 'Lola' }, gm.secret)).status, 200);
  const inv = await svc.call('/v1/guilds/invites', {}, lola.secret);
  assert.equal((await svc.call('/v1/guilds/answer', { character: lola.character, guild: inv.body.invites[0].guild, accept: true }, lola.secret)).status, 200);
  const member = (await view()).members.find((m) => m.name === 'Lola').member;
  assert.equal((await svc.call('/v1/guilds/rank', { character: gm.character, member, rank: 1 }, gm.secret)).status, 200, 'an Officer');
  const seen = (await svc.call('/v1/homes/town', { mapId: 7, character: lola.character }, lola.secret)).body.homes.find((h) => h.buildingKey === 300);
  assert.equal(seen.member, true);
  assert.equal(seen.keeper, undefined, 'no keeper: a local character keeps nothing outside');
  assert.equal(homeOutsideKept({ own: false, ...seen }), false);
  assert.equal((await svc.call('/v1/homes/look', { mapId: 7, buildingKey: 300, character: lola.character, look: LOOK }, lola.secret)).body.error, 'no-home', 'as OWNS says');
  assert.equal((await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: lola.character, yard: true, piece: piece({ paid: 0 }) }, lola.secret)).body.error, 'realm-only', 'a placement is a realm character\'s');
  const otto = (await svc.call('/v1/homes/town', { mapId: 7, character: officer.character }, officer.secret)).body.homes.find((h) => h.buildingKey === 300);
  assert.equal(otto.keeper, true, 'a realm Officer keeps it');
});

test('AUDIT PROF-541 G2 the hall\'s door "Who may enter" follows what the service lets set (setHallEntry: the rank alone), never `keeper` (a realm character\'s too): a LOCAL Officer reads `hallEntry` and turns the door; a Recruit reads none; the registry and the door\'s rows and its press go by it (mutants: `hallEntry` asked a realm character; the registry\'s `hallEntry` the keeper\'s; the row\'s and the press\'s gate the keeper\'s)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, recruit, view } = await stood();
  const lola = await svc.registered('Lola');   // a local character, `char-lola`
  assert.equal((await svc.call('/v1/guilds/invite', { character: gm.character, handle: 'Lola' }, gm.secret)).status, 200);
  const inv = await svc.call('/v1/guilds/invites', {}, lola.secret);
  assert.equal((await svc.call('/v1/guilds/answer', { character: lola.character, guild: inv.body.invites[0].guild, accept: true }, lola.secret)).status, 200);
  const member = (await view()).members.find((m) => m.name === 'Lola').member;
  assert.equal((await svc.call('/v1/guilds/rank', { character: gm.character, member, rank: 1 }, gm.secret)).status, 200, 'an Officer');
  const town = async (who) => (await svc.call('/v1/homes/town', { mapId: 7, character: who.character }, who.secret)).body.homes.find((h) => h.buildingKey === 300);
  const seen = await town(lola);
  assert.equal(seen.keeper, undefined, 'no keeper: Y1 stands');
  assert.equal(seen.hallEntry, true, 'but the door is hers to turn');
  assert.equal((await svc.call('/v1/guilds/hall/entry', { character: lola.character, entry: 'public' }, lola.secret)).status, 200, 'as the service answers her');
  assert.equal((await town(officer)).hallEntry, true, 'a realm Officer too');
  assert.equal((await town(gm)).hallEntry, true, 'the guildmaster too');
  assert.equal((await town(recruit)).hallEntry, undefined, 'a Recruit turns nothing');
  // the client: the registry reads it, and the door's row is it - a keeper who may not turn it shows none
  const api = { town: async () => ({ ok: true, data: { homes: [{ ...seen, buildingKey: 300 }] } }) };
  const homes = createOnlineHomes({ api, character: () => lola.character });
  await homes.ensure(7);
  const h = homes.homeAt(7, 300);
  assert.equal(h.hallEntry, true);
  assert.equal(h.keeper, false);
  assert.deepEqual(homeHallRows(h, 'enter').map((r) => r.id), [HOME_VERB.enter, HALL_VERB.entry], 'a local Officer\'s door: "Who may enter"');
  assert.deepEqual(homeHallRows({ ...h, hallEntry: false, keeper: true }, 'enter').map((r) => r.id), [HOME_VERB.enter], 'keeper alone: no row');
  // AUDIT PROF-541 R2-H1: the row's gate and the press's one law (onlineHomes.js hallEntryTurnable), driven
  assert.deepEqual([hallEntryTurnable(h), hallEntryTurnable({ ...h, hallEntry: false, keeper: true }), hallEntryTurnable({ ...h, hall: false }), hallEntryTurnable(null)], [true, false, false, false]);
  // the press's wiring (worldModes.js's building-click ladder - no test stands an interior host up to press it, the repo's exception)
  assert.match(src('src/scenes/worldModes.js'), /if \(verb === HALL_VERB\.entry && hallEntryTurnable\(home\)\) \{ turnHallEntry\(bd, home\); return true; \}/, 'the press as the row');
});

test('AUDIT GUILD-YARD a home\'s outside is its CHARACTER\'s: another character of the same account paints nothing of it, nor places in its yard (mutants: OWNS\'s home any character of the account)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 310, region: 17, price: 5000 });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const other = await seatRealm(svc.env, owner.secret, 'Olga Two', { name: 'Olga Two', level: 5, goldPieces: 50_000, items: [] });
  const paint = (character) => svc.call('/v1/homes/look', { mapId: 7, buildingKey: 310, character, look: LOOK }, owner.secret);
  assert.equal((await paint(other.id)).body.error, 'no-home', 'the account\'s other character');
  const yard = await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 310, character: other.id, realm: other.at(), yard: true, piece: piece() }, owner.secret);
  assert.equal(yard.body.error, 'no-home', JSON.stringify(yard.body));
  assert.equal((await paint(o.character)).status, 200, 'its own character paints it');
});

test('AUDIT GUILD-YARD the hall\'s yard in the hall\'s words: the decorator\'s panel names it the guild\'s yard (its `where`, through the tool\'s room), a piece in the hall\'s footprint is "inside the hall" and a full yard is the hall\'s - never "your house", "your yard"; a home\'s keep their own; the service\'s refusals of a hall\'s yard its own (no-home, yard-cap), `hall-yard` a palace\'s alone (mutants: the tool\'s `where` plain; the hall\'s words lost - the lot\'s, the bar\'s; the hall\'s word for every yard refusal; AUDIT PROF-541 G3: the ghost\'s bar\'s hall lost; the commit\'s cap unasked)', async (t) => {
  assert.equal(decorWhyNot({ price: 10, ready: true, gold: 100, count: DECOR_YARD_CAP, cap: DECOR_YARD_CAP, yard: true, hall: true }), YARD_HALL_FULL);
  assert.equal(decorWhyNot({ price: 10, ready: true, gold: 100, count: DECOR_YARD_CAP, cap: DECOR_YARD_CAP, yard: true }), YARD_FULL);
  assert.equal(decorWhyNot({ price: 10, ready: true, gold: 100, count: 3, cap: 3, hall: true }), 'This room already holds 3 pieces.', 'a hall\'s room is a room');
  // the hall's panel: its name, and the bar's word on a full yard
  const full = Array.from({ length: DECOR_YARD_CAP }, (_, i) => piece({ id: `y${i}` }));
  const w = world(HALL_ROW, { pieces: full, feet: [15, 0, 10] });
  await stand(w);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { w.yards.frame({ dt: 0.1, cam, overlayUp: true }); await settle(); }
  assert.match(panelText(w), /^Your guild's yard$/m, 'the panel names whose yard it is');
  pressIn(w, (n) => n.dataset?.key === 'm41000');
  for (let i = 0; i < 2; i++) { w.yards.frame({ dt: 0.1, cam, overlayUp: true }); await settle(); }
  assert.ok(panelText(w).includes(YARD_HALL_FULL), panelText(w));
  assert.ok(!/Your yard|your house/.test(panelText(w)));
  // AUDIT PROF-541 G3: a ghost standing as the yard fills - its warning bar says the hall's yard is full, and its commit
  // places nothing
  const f = world(HALL_ROW, { pieces: full.slice(1), feet: [15, 0, 10] });
  await stand(f);
  const ft = f.yards.tool();
  assert.equal(ft.openPanel(), true);
  for (let i = 0; i < 6; i++) { f.yards.frame({ dt: 0.1, cam, overlayUp: true }); await settle(); }
  pressIn(f, (n) => n.dataset?.key === 'm41000');
  pressIn(f, (n) => n.tag === 'button' && n.textContent === 'Place');
  for (let i = 0; i < 6 && !ft.ghost(); i++) { f.yards.frame({ dt: 0.1, cam, overlayUp: false }); await settle(); }
  assert.ok(ft.ghost(), 'the ghost stands');
  assert.notEqual(ft.why(), YARD_HALL_FULL, 'a place still free');
  f.yards.yards()[0].pool.put(piece({ id: 'last' }));   // another keeper's piece lands meanwhile
  assert.equal(ft.why(), YARD_HALL_FULL, 'the bar: the hall\'s yard, full');
  assert.equal(await ft.commit(), false, 'and nothing is placed');
  assert.ok(!f.writes.some((x) => x[0] === 'place'), 'no write');
  // a piece aimed into the hall's footprint: "inside the hall"
  const aim = { pos: [15, 1.6, 10], yaw: -Math.PI / 2, pitch: -0.6 };   // west, 2.3 m ahead: x 12.7, in the hall
  const k = world(HALL_ROW, { feet: [15, 0, 10] });
  await stand(k);
  const kt = k.yards.tool();
  assert.equal(kt.openPanel(), true);
  for (let i = 0; i < 6; i++) { k.yards.frame({ dt: 0.1, cam: aim, overlayUp: true }); await settle(); }
  pressIn(k, (n) => n.dataset?.key === 'm41000');
  pressIn(k, (n) => n.tag === 'button' && n.textContent === 'Place');
  for (let i = 0; i < 6 && !kt.ghost(); i++) { k.yards.frame({ dt: 0.1, cam: aim, overlayUp: false }); await settle(); }
  assert.ok(kt.ghost(), 'the ghost stands');
  assert.equal(kt.why(), YARD_IN_HALL);
  assert.notEqual(YARD_IN_HALL, YARD_IN_HOUSE);
  // the service: a hall's yard refused for its keeper or its cap says so, never a palace's word
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { officer, recruit, raw, place } = await stood();
  assert.equal((await place(recruit, { piece: piece({ id: 'r1', paid: 0 }) })).body.error, 'no-home', 'a free piece a Recruit places: no-home, never hall-yard');
  const ins = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, 300, ?, 41000, ?, ?, 0, 1)');
  for (let i = 0; i < DECOR_YARD_CAP; i++) ins.run(`y${i}`, JSON.stringify({ pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 }), T0);
  assert.equal((await place(officer, { piece: piece({ id: 'free', paid: 0 }) })).body.error, 'yard-cap', 'a free piece in a full yard: its cap');
});
