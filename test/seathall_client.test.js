// SEAT-HALL (2026-10-02, Mac: "Please do" - the palace as the holder's guild hall): THE CHARTER ROOM IN THE CLIENT -
// the law's words and numbers (src/net/townSeatLaw.js), the decorator's rule in the palace (src/scenes/decorTool.js
// charterWhyNot: the largest room, two metres from the court; a room's own cap), the account door's `seat`
// (src/net/accountClient.js accountDecor) and the hosts' seams (src/scenes/worldModes.js interiorSeatHall, world.js
// seatHall). bible/11-Multiplayer/Seats-Arc.md 7.2; `06-Systems/Online-Arc.md` SEAT-HALL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../src/player/collider.js';
import { toolRig, settle, all } from './decorFakes.mjs';
import { SEAT_HALL_DECOR_CAP, SEAT_HALL_CLEAR_M, SEAT_HALL_TEXT, seatHallOf } from '../src/net/townSeatLaw.js';
import { accountDecor, SESSION_KEY } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const addQuad = (c, key, a, b, cc, d) => c.addMesh(key, new Float32Array([...a, ...b, ...cc, ...d]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
/** The rig's building (origin 10, 0, 10; the eye at 10, 1.6, 10): a palace x 4 to 24, z 5 to 15, 3 high, a shut door in
 *  the wall at x = 18 - the eye in its west room, the larger (14 m across to the east room's 6). */
function palace() {
  const c = new Collider();
  addQuad(c, 'floor', [4, 0, 5], [24, 0, 5], [24, 0, 15], [4, 0, 15]);
  addQuad(c, 'ceiling', [4, 3, 5], [24, 3, 5], [24, 3, 15], [4, 3, 15]);
  addQuad(c, 'w1', [4, 0, 5], [4, 3, 5], [4, 3, 15], [4, 0, 15]);
  addQuad(c, 'w2', [24, 0, 5], [24, 3, 5], [24, 3, 15], [24, 0, 15]);
  addQuad(c, 'w3', [4, 0, 5], [24, 0, 5], [24, 3, 5], [4, 3, 5]);
  addQuad(c, 'w4', [4, 0, 15], [24, 0, 15], [24, 3, 15], [4, 3, 15]);
  addQuad(c, 'inner1', [18, 0, 5], [18, 3, 5], [18, 3, 9], [18, 0, 9]);
  addQuad(c, 'inner2', [18, 0, 11], [18, 3, 11], [18, 3, 15], [18, 0, 15]);
  addQuad(c, 'lintel', [18, 2.2, 9], [18, 3, 9], [18, 3, 11], [18, 2.2, 11]);
  addQuad(c, 'door', [18, 0, 9], [18, 2.2, 9], [18, 2.2, 11], [18, 0, 11]);
  return c;
}
const CHARTER = { kind: 'home', hall: true, seat: true, charter: true, cap: SEAT_HALL_DECOR_CAP, where: SEAT_HALL_TEXT.where, mapId: 3021, buildingKey: 512 };
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const fakeDecorDoor = (writes) => ({
  place: async (a) => { writes.push(['place', a]); return { ok: true, piece: a.piece }; },
  move: async (a) => { writes.push(['move', a]); return { ok: true }; },
  remove: async (a) => { writes.push(['remove', a]); return { ok: true }; },
});

test('SEAT-HALL the law: a hundred pieces, two metres, the Charter Room\'s words; a palace is the hall of the guild holding it and of no other (mutants: the cap; the clearance; the holder unasked)', () => {
  assert.equal(SEAT_HALL_DECOR_CAP, 100, '7.2: "at most 100 pieces"');
  assert.equal(SEAT_HALL_CLEAR_M, 2, '7.2: "within 2 m of any NPC or quest marker"');
  assert.equal(SEAT_HALL_TEXT.where, 'The Charter Room');
  const seat = { tier: 'palace', holder: { guild: { id: 'g1', name: 'The Silver Hand' } } };
  assert.equal(seatHallOf(seat, 'g1'), true);
  assert.equal(seatHallOf(seat, 'g2'), false, 'another guild\'s');
  assert.equal(seatHallOf(seat, null), false, 'no guild');
  assert.equal(seatHallOf({ tier: 'palace', holder: null }, 'g1'), false, 'unheld');
  assert.equal(seatHallOf(null, 'g1'), false);
});

test('SEAT-HALL the decorator in the Charter Room (7.2): a piece in a smaller room is refused in the room\'s words; in the largest, the court\'s two metres are the host\'s to say; clear, it is placed through the door (mutants: the largest room unasked; the court unasked; the commit past the rule)', async () => {
  const writes = [];
  let court = null;
  const rig = toolRig({ collider: palace(), gold: 50_000, room: CHARTER, homeDecor: fakeDecorDoor(writes), charterClear: () => court });
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 12; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const tabs = all(panelOf(rig), 'dfdecor-room');
  assert.equal(tabs.length, 2, 'two rooms found');
  const pressed = () => all(panelOf(rig), 'dfdecor-room').find((t) => t.attrs['aria-pressed'] === 'true');
  const west = pressed();
  const east = tabs.find((t) => t !== west);
  const placeIn = async (tab) => {
    tab.fire('click');
    rig.frame({ overlayUp: true });
    all(panelOf(rig), 'dfdecor-row').find((r) => r.dataset.key === 'm41000').fire('click');
    all(panelOf(rig), 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
    rig.frame(); await settle(); rig.frame();
  };
  await placeIn(east);
  assert.ok(rig.tool.ghost(), 'the ghost stands');
  assert.equal(rig.tool.why(), SEAT_HALL_TEXT.room, 'the smaller room refused');
  assert.equal(await rig.tool.commit(), false);
  assert.equal(writes.length, 0, 'nothing sent');
  rig.tool.back();
  for (let i = 0; i < 2; i++) { rig.frame({ overlayUp: true }); await settle(); }
  await placeIn(west);
  court = SEAT_HALL_TEXT.clear;
  assert.equal(rig.tool.why(), SEAT_HALL_TEXT.clear, 'too near the court');
  assert.equal(await rig.tool.commit(), false);
  court = null;
  assert.equal(rig.tool.why(), null, 'the largest room, clear of the court');
  assert.equal(await rig.tool.commit(), true);
  assert.equal(writes.length, 1);
  assert.deepEqual([writes[0][1].mapId, writes[0][1].buildingKey], [3021, 512]);
});

test('SEAT-HALL a room\'s own cap: the Charter Room\'s hundred is the decorator\'s count, never DECOR\'s own (mutant: the room\'s cap unread)', async () => {
  const writes = [];
  const rig = toolRig({ gold: 50_000, room: { ...CHARTER, cap: 1 }, homeDecor: fakeDecorDoor(writes) });
  rig.standing.push({ id: 'one', model: 41000, flat: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  rig.frame();
  rig.tool.openPanel();
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  all(panelOf(rig), 'dfdecor-row').find((r) => r.dataset.key === 'm41000').fire('click');
  all(panelOf(rig), 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame(); await settle(); rig.frame();
  assert.equal(await rig.tool.commit(), false, 'full at its own cap');
  assert.equal(writes.length, 0);
  const tool = src('src/scenes/decorTool.js');
  assert.match(tool, /const capHere = \(r\) => \(r\?\.yard && Number\.isSafeInteger\(deps\.yardCap\) \? deps\.yardCap : Number\.isSafeInteger\(r\?\.cap\) \? r\.cap : DECOR_CAP\);/);
  assert.match(tool, /const whyNotHere = \(p\) => deps\.placeOk\?\.\(p\.piece, footprintOf\(p\)\) \?\? charterWhyNot\(p\);/);
  assert.equal((tool.match(/whyNotHere\(p\)/g) ?? []).length, 3, 'the commit, the move and the placing bar');
});

test('SEAT-HALL the account door: `seat` rides a list, a placement, a move and a removal named for the Charter Room, and no other (mutants: each dropped)', async () => {
  const posts = [];
  const session = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek', id: 'p' })]]);
  const door = accountDecor({ fetch: async (u, i) => { posts.push([new URL(u).pathname, JSON.parse(i.body)]); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }, storage: { getItem: (k) => session.get(k) ?? null }, listWaitMs: 50 });
  const at = { mapId: 3021, buildingKey: 512, character: 'c1' };
  await door.list(3021, 512, true);
  await door.place({ ...at, piece: { id: 'a' }, seat: true });
  await door.move({ ...at, id: 'a', place: {}, seat: true });
  await door.remove({ ...at, id: 'a', seat: true });
  assert.deepEqual(posts.map(([p, b]) => [p, b.seat]), [['/v1/homes/decor', true], ['/v1/homes/decor/place', true], ['/v1/homes/decor/move', true], ['/v1/homes/decor/remove', true]]);
  posts.length = 0;
  await door.list(7, 300);
  await door.place({ ...at, piece: { id: 'a' } });
  assert.ok(posts.every(([, b]) => !('seat' in b)), 'a home\'s writes as ever');
});

test('SEAT-HALL the hosts by source: the visit\'s palace latched at the door for a Palace and cleared at both teardowns; the Charter Room its keepers\' to furnish, read from the service with `seat`; the decorator\'s writes name it; the court\'s two metres; its cupboards and board the holder\'s, its beds its members\'; world.js names the holder\'s guild, its members and its keepers (mutants: the latch; a teardown; the room; the seat on the list and the writes; the court\'s people, marks and quests; the chest; the board; the bed; the keeper\'s rank)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /interiorSeatHall = building\?\.buildingType === BUILDING_TYPES\.Palace \? \(host\.seatHall\?\.here\?\.\(homeTownOf\(building\)\) \?\? null\) : null;/);
  assert.match(m, /interiorHome = null;   \/\/ HOME1: and the visit's home with it\n    interiorSeatHall = null;/);
  assert.match(m, /interiorHome = null; interiorSeatHall = null; interiorOverlay = null;/);
  assert.match(m, /if \(interiorSeatHall\?\.keeper\) return \{ kind: 'home', hall: true, seat: true, charter: true, cap: SEAT_HALL_DECOR_CAP, where: SEAT_HALL_TEXT\.where, mapId: homeTownOf\(b\), buildingKey: b\.buildingKey \};/);
  assert.match(m, /const decorKeeperHere = \(\) => !!\(interiorHome\?\.hall && interiorHome\.keeper\) \|\| !!interiorSeatHall\?\.keeper;/);
  assert.match(m, /const hallMemberHere = \(\) => !!\(interiorHome\?\.hall && interiorHome\.member\) \|\| !!interiorSeatHall\?\.member;/);
  assert.match(m, /const seat = !interiorHome && !!interiorSeatHall;[^\n]*\n(?:    \/\/[^\n]*\n)*    if \(host\.homeLayoutsHeard\?\.\(\) === false\) \{[^\n]*\n    const visit = _decorVisit;\n    askDecorList\(\{\n      ask: \(\) => host\.homeDecor\.list\(homeTownOf\(b\), b\.buildingKey, seat\),/);
  assert.match(m, /const at = \(a\) => \(interiorSeatHall && !interiorHome \? \{ \.\.\.a, seat: true \} : a\);\n    return \{ \.\.\.d, place: \(a\) => d\.place\(at\(a\)\), move: \(a\) => d\.move\(at\(a\)\), remove: \(a\) => d\.remove\(at\(a\)\) \};/);
  assert.match(m, /wallet: \(\) => decorWallet\(\), homeDecor: decorDoor\(\),/);
  assert.match(m, /charterClear: \(pt\) => charterClear\(pt\),/);
  const clear = m.slice(m.indexOf('  function charterClear(pt) {'), m.indexOf('  const decorTool = createDecorTool({'));
  assert.match(clear, /Math\.hypot\(x - pt\[0\], z - pt\[2\]\) < SEAT_HALL_CLEAR_M/);
  assert.match(clear, /for \(const n of interiorCtx\?\.people \?\? \[\]\) if \(near\(n\.x, n\.z\)\) return SEAT_HALL_TEXT\.clear;/);
  assert.match(clear, /for \(const m of interiorCtx\?\.markers \?\? \[\]\) if \(\(m\.type === 11 \|\| m\.type === 18\) && near\(m\.x, m\.z\)\) return SEAT_HALL_TEXT\.clear;/);
  assert.match(clear, /for \(const q of questFlats \?\? \[\]\) if \(!q\.dead && near\(q\.x, q\.z\)\) return SEAT_HALL_TEXT\.clear;/);
  assert.match(m, /if \(\(interiorHome\?\.hall && interiorHome\.member\) \|\| interiorSeatHall\?\.member\) \{ openHallChest\(\); return; \}/);
  assert.match(m, /if \(c && \(\(interiorHome\?\.hall && interiorHome\.member\) \|\| interiorSeatHall\?\.member\)\) \{ openHallChest\(\); return true; \}/);
  assert.match(m, /const isHallBoard = \(piece\) => \(!!interiorHome\?\.hall \|\| !!interiorSeatHall\) && piece\?\.model === BULLETIN_BOARD_MODEL_ID && !piece\.item;/);
  assert.match(m, /const hallNameHere = \(\) => interiorHome\?\.hall\?\.name \?\? interiorSeatHall\?\.name \?\? '';/);
  assert.match(m, /homeBed: homeBedIsMine\(interiorHome, Math\.floor\(Date\.now\(\) \/ 1000\)\) \|\| !!interiorSeatHall\?\.member,/);
  const w = src('src/scenes/world.js');
  const here = w.slice(w.indexOf('    seatHall: {'), w.indexOf('    guildHall: {'));
  assert.match(here, /const g = seat\?\.tier === 'palace' \? seat\.holder\?\.guild \?\? null : null;/, 'a crown\'s castle is no Charter Room');
  assert.match(here, /const member = seatHallOf\(seat, mine\?\.id \?\? null\);/);
  assert.match(here, /keeper: member && hallMay\(Number\(mine\?\.rank\), 'decorate'\)/);
  const svc = src('server-account/src/index.js');
  assert.match(svc, /if \(\(path === '\/v1\/homes\/decor' \|\| path\.startsWith\('\/v1\/homes\/decor\/'\)\) && body\?\.seat === true && !seatsOpenFor\(who\.player, env\)\) return no\('seats-closed', 403, origin\);/);
});
