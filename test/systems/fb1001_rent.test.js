// FIELD BUGS 2026-10-01, item 4 ("Room renting is buggy"). The whole flow walked on the real modules, as owner and as
// tenant: the account service's rooms and rent (server-account/src/rent.js through the real Worker over node:sqlite,
// every migration applied), the client's door to it (net/accountClient.js accountHomes), the town's registry
// (systems/online/onlineHomes.js createOnlineHomes), the rent and the owner's rooms (systems/homeRent.js), a realm act
// (systems/realmSaves.js realmGoldAct), the owner's decorator and its panel (scenes/decor/decorTool.js, ui/decorPanel.js) over
// the room finder's real rooms, and the rest's law (systems/rest/restSession.js canRest over interiorRestPlace). Six faults:
//   RENT-REST    a tenant could not rest in the home they rent - "You have not rented a room here."
//   RENT-RENEW   the renewal window offered days the service always refuses (`rent-long`), paid from the purse first
//   RENT-FRESH   the owner's rooms were read once a visit - rent a tenant paid while the owner stood inside never showed
//   RENT-ORPHANS a house made one room hid its offers (tenants and all) from its owner; "one room" said while finding
//   RENT-NUMBER  the owner's "Room 2" was offered as room 1 - the door named it otherwise to every tenant
//   HOMES-FORCE  a forced town read asked while another was in flight was answered by it - the door stayed shut
// Each test here is red on the code before its fix (the namespace imports keep one fault's missing export from failing
// the others). `01-Overview/bugs/Field-Bugs-2026-10-01.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RENT_DAY_S, RENT_DAYS } from '../../src/net/homeLaw.js';
import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { accountHomes, SESSION_KEY } from '../../src/net/accountClient.js';
import { createOnlineHomes, homeDoorAnswer } from '../../src/systems/online/onlineHomes.js';
import * as H from '../../src/systems/homeRent.js';
import { realmGoldAct } from '../../src/systems/realmSaves.js';
import { deductGold } from '../../src/systems/court.js';
import { canRest, interiorRestPlace, HAVE_NOT_RENTED_ROOM } from '../../src/systems/rest/restSession.js';
import { createSceneCache, addPermanentScene, containsPermanentScene, interiorSceneName } from '../../src/systems/sceneCache.js';
import { homeSceneName } from '../../src/systems/online/onlineHomes.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import * as DT from '../../src/scenes/decor/decorTool.js';
import { DECOR_RENT_FINDING, DECOR_RENT_ONE_ROOM } from '../../src/ui/decorPanel.js';
import { toolRig, settle, all, text } from '../decorFakes.mjs';
import { Collider } from '../../src/player/collider.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const HOME = { mapId: 7, buildingKey: 300, region: 17, price: 5000 };

/** A realm act as world.js builds one (realmGoldAct over the character's session) - the session's hold the record's own
 *  place, the checkpoint the host's (none here: the record is the service's to read). */
const actFor = (R) => ({ act: (o) => realmGoldAct({ session: { transact: async (fn) => fn(R.at()) }, checkpoint: () => {}, ...o }) });
/** worldModes.js homeWallet over a player: the purse (court.js deductGold, letters and coins) and the region's account. */
function walletOf(pl, region) {
  const a = pl.bankAccounts[region];
  return { gold: pl.goldPieces + a.accountGold, pay: (n) => { a.accountGold -= deductGold(pl, n); }, credit: (n) => { a.accountGold += n; } };
}
const playerWith = (gold) => ({ goldPieces: gold, items: [], bankAccounts: Array.from({ length: 62 }, () => ({ accountGold: 0, loanTotal: 0 })) });

/** The service stood, an owner's home in it with `offers` (room, anchor, price), and a tenant's client over it. */
async function rentWorld(t, offers = [{ room: 1, anchor: [-4, 1.6, 0], price: 50 }]) {
  const clock = { ms: T0 * 1000 };
  t.mock.method(Date, 'now', () => clock.ms);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, HOME);
  assert.equal(o.status, 200, 'the owner\'s home');
  for (const of of offers) assert.equal((await svc.call('/v1/homes/rooms/offer', { mapId: 7, buildingKey: 300, character: o.character, ...of }, owner.secret)).status, 200);
  const tenant = await svc.registered('Tomas');
  const T = await seatRealm(svc.env, tenant.secret, 'Tomas', { name: 'Tomas', level: 5, goldPieces: 5000, items: [] });
  const api = accountHomes({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, tenant) });
  const homes = createOnlineHomes({ api, character: () => T.id });
  const ownerApi = accountHomes({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, owner) });
  return { clock, svc, owner, o, tenant, T, api, homes, ownerApi };
}

test('RENT-REST: a tenant rests in the home they rent, as its owner does - the rest\'s bag stands an online home\'s bed (the owner\'s, or the tenant\'s while the tenancy runs) where a bought house stands; a visitor and a tenancy run out do not (mutants: the bed unasked; the tenancy\'s end unread; the bed outside the permanent scene; the host\'s bag without it)', async (t) => {
  const w = await rentWorld(t);
  const rented = await H.rentHomeRoom({ api: w.api, homes: w.homes, realm: actFor(w.T), wallet: walletOf(playerWith(5000), 17), mapId: 7, buildingKey: 300, character: w.T.id, room: 1, days: 3, price: 50 });
  assert.equal(rented.ok, true, JSON.stringify(rented));
  await w.homes.ensure(7, { force: true });
  const tenantRow = w.homes.homeAt(7, 300);   // the registry's own row, off the real town answer
  assert.equal(homeDoorAnswer(tenantRow), 'enter', 'the door opens for the tenant');
  const ownerHomes = createOnlineHomes({ api: w.ownerApi, character: () => w.o.character });
  await ownerHomes.ensure(7);
  const ownerRow = ownerHomes.homeAt(7, 300);
  assert.equal(ownerRow.own, true);
  const nowS = Math.floor(Date.now() / 1000);
  const house = { buildingKey: 300, buildingType: BUILDING_TYPES.House1, regionIndex: 17 };
  // the host's bag (worldModes.js interiorRestPlaceHere): the scene its visit stands in is the owner's home scene (kept
  // permanent at the owner's entry) or, for anyone else, the building's own - which no tenant's cache holds
  const bagFor = (row) => {
    const cache = createSceneCache();
    if (row?.own) addPermanentScene(cache, homeSceneName(7, 300));
    const scene = row?.own ? homeSceneName(7, 300) : interiorSceneName(7, 300);
    return interiorRestPlace({
      inTownLocation: true, building: house, nowMinutes: 600, restMarkers: 1,
      permanentScene: containsPermanentScene(cache, scene), houseOwned: false, homeBed: H.homeBedIsMine?.(row, nowS),
    });
  };
  // Reproduced first: the bag the host handed before - houseOwned for the tenant, outside a permanent scene - is asked the
  // tavern's question (DFU's IsHouseOwned arm is inside its permanent-scene test) and refused
  assert.equal(canRest(interiorRestPlace({ inTownLocation: true, building: house, restMarkers: 1, permanentScene: false, houseOwned: true })).line, HAVE_NOT_RENTED_ROOM, 'the old bag: "You have not rented a room here."');
  assert.equal(typeof H.homeBedIsMine, 'function', 'the home\'s bed, one law');
  assert.deepEqual(canRest(bagFor(tenantRow)), { allowed: true, hoursRented: -1, bedIndex: -1 }, 'the tenant rests');
  assert.deepEqual(canRest(bagFor(ownerRow)), { allowed: true, hoursRented: -1, bedIndex: -1 }, 'the owner rests, as ever');
  assert.equal(bagFor(tenantRow).houseOwned, true, 'a bed (the rest\'s kind reads it)');
  // a visitor who rents nothing is refused, and so is the tenant once the days run out (the tenancy's end, read)
  assert.equal(canRest(bagFor({ ...tenantRow, tenant: null })).line, HAVE_NOT_RENTED_ROOM);
  const ended = interiorRestPlace({ inTownLocation: true, building: house, restMarkers: 1, homeBed: H.homeBedIsMine(tenantRow, tenantRow.tenant) });
  assert.equal(canRest(ended).line, HAVE_NOT_RENTED_ROOM, 'the tenancy over: no bed');
  assert.equal(H.homeBedIsMine(tenantRow, tenantRow.tenant - 1), true, 'a second before its end: still the tenant\'s');
  assert.equal(H.homeBedIsMine(null, nowS), false, 'no online home: none');
  // the host hands it (the interior host is the one that stands in an online home)
  const wm = src('src/scenes/worldModes.js');
  const bag = wm.slice(wm.indexOf('const interiorRestPlaceHere = () => {'), wm.indexOf('const interiorRestMarkers = () =>'));
  assert.match(bag, /homeBed: homeBedIsMine\(interiorHome, Math\.floor\(Date\.now\(\) \/ 1000\)\) \|\| !!interiorSeatHall\?\.member,/);   // PIN MOVED (SEAT-HALL): and the palace holder's members rest there
  // PIN MOVED (AUDIT CAPTAIN'S SEA P9): the deed read where the building stands - never an isle town's (houseOwnedAt)
  assert.match(bag, /houseOwned: !interiorHome && houseOwnedAt\(/, 'an online home answers by its bed alone');
});

test('RENT-RENEW: the renewal window offers only the days the service takes (one\'s own room renews from its end, never past thirty days ahead), says so when none is left, and a room off the offer says it cannot be renewed (mutants: every day offered; the renewal from now; the full line unsaid; the room off the offer said none free)', async (t) => {
  const w = await rentWorld(t);
  const pl = playerWith(5000);
  const rent = (days) => H.rentHomeRoom({ api: w.api, homes: w.homes, realm: actFor(w.T), wallet: walletOf(pl, 17), mapId: 7, buildingKey: 300, character: w.T.id, room: 1, days, price: 50 });
  assert.equal((await rent(3)).ok, true);
  const mine = async () => { const got = await H.homeRooms(w.api, 7, 300, w.T.id); return { got, room: H.rentable(got.rooms).find((r) => r.yours) }; };
  let { got, room } = await mine();
  assert.equal(room.until - got.now, 3 * RENT_DAY_S, 'three days held');
  // Reproduced first: the window offered every one of RENT_DAYS, and the thirty is refused after the purse paid it - the
  // reserve came back to the region's account, 1500 gold moved out of the purse
  assert.deepEqual([...RENT_DAYS], [1, 3, 7, 14, 30]);
  const before = [pl.goldPieces, pl.bankAccounts[17].accountGold];
  const long = await rent(30);
  assert.deepEqual([long.ok, long.error], [false, 'rent-long']);
  assert.deepEqual([pl.goldPieces, pl.bankAccounts[17].accountGold], [before[0] - 1500, before[1] + 1500], 'what the refused row cost the purse');
  // the window now: what fits in thirty days from the service's now
  assert.equal(typeof H.rentDayRows, 'function');
  assert.deepEqual(H.rentDayRows(room, got.now), [1, 3, 7, 14], 'three held: 1, 3, 7 and 14 more fit, 30 never');
  assert.deepEqual(H.rentDayRows({ ...room, yours: false, until: null }, got.now), [...RENT_DAYS], 'a fresh rent: all five');
  // every row offered is one the service takes - the largest here
  assert.equal((await rent(14)).ok, true);
  ({ got, room } = await mine());
  assert.deepEqual(H.rentDayRows(room, got.now), [1, 3, 7], 'seventeen held');
  for (const d of H.rentDayRows(room, got.now)) assert.equal((await rent(d)).ok, true, `${d} more days, taken`);
  ({ got, room } = await mine());
  assert.equal(room.until - got.now, 28 * RENT_DAY_S);
  assert.deepEqual(H.rentDayRows(room, got.now), [1], 'twenty-eight held: a day');
  assert.equal((await rent(3)).error, 'rent-long', 'three more is past thirty - not offered');
  assert.equal((await rent(1)).ok, true);
  assert.equal((await rent(1)).ok, true);
  ({ got, room } = await mine());
  assert.deepEqual(H.rentDayRows(room, got.now), [], 'thirty days held: none');
  assert.match(H.RENT_FULL_LINE, /30 days ahead/);
  // the owner takes the room off the offer: the tenant's own row says it, not "none free"
  assert.equal((await w.svc.call('/v1/homes/rooms/withdraw', { mapId: 7, buildingKey: 300, character: w.o.character, room: 1 }, w.owner.secret)).body.gone, false);
  ({ got } = await mine());
  assert.deepEqual(H.rentable(got.rooms), [], 'nothing to rent');
  assert.equal(H.rentNoneLine(got.rooms, got.now), 'Room 1 is no longer offered to rent. It is yours for 30 more days, and cannot be renewed.');
  assert.equal(H.rentNoneLine([], got.now), H.RENT_NONE_FREE);
  // the host asks the window for these, on the service's clock
  const wm = src('src/scenes/worldModes.js');
  const door = wm.slice(wm.indexOf('async function openHomeRent(bd, home) {'), wm.indexOf('function openHomeRentConfirm('));
  assert.match(door, /nowS = got\.now \|\| Math\.floor\(Date\.now\(\) \/ 1000\);/);
  assert.match(door, /if \(!list\.length\) \{ townTalk\?\.say\?\.\(rentNoneLine\(got\.rooms, nowS\)\); return; \}/);
  assert.match(door, /action: \(\) => \{ const days = rentDayRows\(r, nowS\); if \(days\.length\) openHomeRentDays\(bd, r, days\); else townTalk\?\.say\?\.\(RENT_FULL_LINE\); \},/);
  assert.match(door, /function openHomeRentDays\(bd, room, days\) \{/);
  assert.match(door, /\.\.\.days\.map\(\(d, i\) => \(\{/);
  assert.doesNotMatch(door, /RENT_DAY_ROWS\.map/, 'never every day');
});

/** A house the rig stands in (its eye at 10, 1.6, 10; the building's origin there too): x 4 to 24, z 5 to 15 - two rooms
 *  with a wall at x 14, one without. The finder numbers the west room 1. */
function houseCollider(two) {
  const c = new Collider();
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const q = (k, a, b, cc, d) => c.addMesh(k, new Float32Array([...a, ...b, ...cc, ...d]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  q('floor', [4, 0, 5], [24, 0, 5], [24, 0, 15], [4, 0, 15]);
  q('ceiling', [4, 3, 5], [24, 3, 5], [24, 3, 15], [4, 3, 15]);
  q('w1', [4, 0, 5], [4, 3, 5], [4, 3, 15], [4, 0, 15]);
  q('w2', [24, 0, 5], [24, 3, 5], [24, 3, 15], [24, 0, 15]);
  q('w3', [4, 0, 5], [24, 0, 5], [24, 3, 5], [4, 3, 5]);
  q('w4', [4, 0, 15], [24, 0, 15], [24, 3, 15], [4, 3, 15]);
  if (two) q('inner', [14, 0, 5], [14, 3, 5], [14, 3, 15], [14, 0, 15]);
  return c;
}
/** The owner's decorator over the real service: the rooms door worldModes.js decorRentDoor builds, the rig's room an
 *  online home of theirs. */
function ownerRig(w, { two = true, now = () => 0 } = {}) {
  const at = { mapId: 7, buildingKey: 300, character: w.o.character };
  const door = {
    rooms: () => H.homeRooms(w.ownerApi, at.mapId, at.buildingKey, at.character),
    offer: ({ room, anchor, price }) => w.ownerApi.offerRoom({ ...at, room, anchor, price }),
    withdraw: ({ room }) => w.ownerApi.withdrawRoom({ ...at, room }),
    collect: () => ({ ok: false, error: 'realm-only' }),
    changed: () => {},
  };
  const rig = toolRig({ collider: houseCollider(two), room: { kind: 'home', where: 'Your home', mapId: 7, buildingKey: 300 }, rent: () => door, now });
  const card = () => rig.doc.body.children.find((c) => c.className === 'dfdecor');
  const tab = () => all(card(), 'dfdecor-chip').find((c) => /^Rooms to rent/.test(c.textContent));
  const btn = (re) => all(card(), 'dfdecor-btn').find((b) => re.test(b.textContent));
  const rows = () => all(card(), 'dfdecor-row');
  const empty = () => all(card(), 'dfdecor-empty').map((e) => e.textContent);
  const why = () => all(card(), 'dfdecor-pick-why').map((e) => e.textContent).join('');
  /** Frames until `ok()` (the service's answers are a few turns away), at most `n`. */
  const until = async (ok, n = 40) => { for (let i = 0; i < n && !ok(); i++) { rig.frame({ overlayUp: true }); await settle(); } return ok(); };
  return { rig, card, tab, btn, rows, empty, why, until };
}
const collectText = (o) => o.btn(/rent to collect|^Collect rent/)?.textContent;

test('RENT-FRESH: the owner\'s rooms are read again as the panel opens and while the rooms view stays up past RENT_VIEW_FRESH_MS - rent a tenant pays while the owner stands in the house is shown and can be collected; the newest read stands; "Asking..." goes once the answer is in (mutants: read once a visit; the open unread; the view never re-read; an older read standing; the read unsigned)', async (t) => {
  const w = await rentWorld(t);
  const o = ownerRig(w, { now: () => w.clock.ms });
  o.rig.frame();
  assert.equal(o.rig.tool.openPanel(), true);
  await o.until(() => !!o.tab());
  o.tab().fire('click');
  // THE SEATS ARC'S MERGE: the visit's read and the opening's are both in flight here, and the rows can stand on the first
  // answer while the second is still out - so the wait is for the asking line too, not a frame count after the rows
  // (under the full suite's load the second answer outran the forty frames: a race in the pin, not the panel)
  assert.ok(await o.until(() => collectText(o) === 'No rent to collect' && o.rows().length === 2 && o.why() === ''), 'read: nothing held');
  assert.equal(o.why(), '', 'the asking line goes once the answer is in');
  // a tenant pays at the door while the owner stands inside - and the owner closes the panel and opens it again
  assert.equal((await H.rentHomeRoom({ api: w.api, homes: w.homes, realm: actFor(w.T), wallet: walletOf(playerWith(5000), 17), mapId: 7, buildingKey: 300, character: w.T.id, room: 1, days: 3, price: 50 })).ok, true);
  o.rig.tool.close();
  o.rig.frame();
  assert.equal(o.rig.tool.openPanel(), true);
  assert.ok(await o.until(() => collectText(o) === 'Collect rent: 150 gold'), `reopened: ${collectText(o)}`);
  assert.match(text(o.rows()[0]), /Rented by Tomas - 3 days left/);
  // ...and while the view stays up, past the bound, it is read again
  assert.equal(typeof DT.RENT_VIEW_FRESH_MS, 'number');
  assert.equal((await H.rentHomeRoom({ api: w.api, homes: w.homes, realm: actFor(w.T), wallet: walletOf(playerWith(5000), 17), mapId: 7, buildingKey: 300, character: w.T.id, room: 1, days: 1, price: 50 })).ok, true);
  assert.equal(await o.until(() => collectText(o) === 'Collect rent: 200 gold', 10), false, 'not before the bound');
  w.clock.ms += DT.RENT_VIEW_FRESH_MS;
  assert.ok(await o.until(() => collectText(o) === 'Collect rent: 200 gold'), `re-read: ${collectText(o)}`);
  // the newest read stands: an older answer landing after a newer one is not the rooms now; and the asking line goes when
  // the answer changes nothing else the view shows (no offer, nothing held)
  const answers = [];
  const slow = { rooms: () => new Promise((r) => answers.push(r)) };
  const s = toolRig({ collider: houseCollider(true), room: { kind: 'home', where: 'Your home', mapId: 7, buildingKey: 300 }, rent: () => slow });
  const sCard = () => s.doc.body.children.find((c) => c.className === 'dfdecor');
  s.frame();
  s.tool.openPanel();
  s.tool.close();
  s.frame();
  s.tool.openPanel();
  for (let i = 0; i < 40; i++) { s.frame({ overlayUp: true }); await settle(); }   // the rooms found
  all(sCard(), 'dfdecor-chip').find((c) => /^Rooms to rent/.test(c.textContent)).fire('click');
  for (let i = 0; i < 3; i++) { s.frame({ overlayUp: true }); await settle(); }
  assert.equal(all(sCard(), 'dfdecor-row').length, 2, 'two rooms, neither offered');
  assert.equal(answers.length, 2, 'read at the visit and again at the opening');
  const sWhy = () => all(sCard(), 'dfdecor-pick-why').map((e) => e.textContent).join('');
  const sCollect = () => all(sCard(), 'dfdecor-btn').find((b) => /rent to collect|^Collect rent/.test(b.textContent)).textContent;
  assert.equal(sWhy(), 'Asking the account service about your rooms...');
  answers[1]({ ok: true, rooms: [], due: 0, now: T0 });
  for (let i = 0; i < 3; i++) { s.frame({ overlayUp: true }); await settle(); }
  assert.equal(sWhy(), '', 'answered: the asking line goes');
  answers[0]({ ok: true, rooms: [], due: 10, now: T0 });
  for (let i = 0; i < 3; i++) { s.frame({ overlayUp: true }); await settle(); }
  assert.equal(sCollect(), 'No rent to collect', 'the older read, landing last, does not stand');
});

test('RENT-ORPHANS: a house that is one room now lists its offers to its owner - a tenancy\'s line, and "Stop offering" on a free one withdraws it at the service; while the rooms are still being found the view says so, never "a house of one room" (mutants: the one-room house listing none; finding said as one room; the finding unsigned)', async (t) => {
  // two rooms once (a door parted them), offered both; the door taken down - one room now
  const w = await rentWorld(t, [{ room: 1, anchor: [-4, 1.6, 0], price: 40 }, { room: 2, anchor: [8, 1.6, 0], price: 60 }]);
  assert.equal((await H.rentHomeRoom({ api: w.api, homes: w.homes, realm: actFor(w.T), wallet: walletOf(playerWith(5000), 17), mapId: 7, buildingKey: 300, character: w.T.id, room: 1, days: 2, price: 40 })).ok, true);
  const o = ownerRig(w, { two: false });
  o.rig.frame();
  o.rig.tool.openPanel();
  o.rig.frame({ overlayUp: true });
  o.tab().fire('click');
  o.rig.frame({ overlayUp: true });
  assert.deepEqual(o.empty(), [DECOR_RENT_FINDING], 'the rooms are being found - not "a house of one room"');
  assert.ok(await o.until(() => o.rows().length === 2), `found: ${o.empty()}`);
  const lines = o.rows().map(text);
  assert.match(lines[0], /Room 1 \(its walls have changed\).*Rented by Tomas - 2 days left/);
  assert.match(lines[1], /Room 2 \(its walls have changed\).*Offered at 60 gold a day/);
  assert.match(o.tab().textContent, /Rooms to rent \(2\)/);
  o.rows()[1].fire('click');
  o.btn(/^Stop offering/).fire('click');
  assert.ok(await o.until(() => o.rows().length === 1), 'withdrawn');
  const left = (await w.svc.call('/v1/homes/rooms', { mapId: 7, buildingKey: 300 }, w.owner.secret)).body.rooms.map((r) => r.room);
  assert.deepEqual(left, [1], 'off the service: no visitor rents a room its owner cannot see');
  // a house of one room and nothing offered: the one-room line, once found
  const w2 = await rentWorld(t, []);
  const o2 = ownerRig(w2, { two: false });
  o2.rig.frame();
  o2.rig.tool.openPanel();
  o2.rig.frame({ overlayUp: true });
  o2.tab().fire('click');
  assert.ok(await o2.until(() => o2.empty()[0] === DECOR_RENT_ONE_ROOM), `one room: ${o2.empty()}`);
});

test('RENT-NUMBER: a room not offered is offered under its own number where no offer holds it - the owner\'s "Room 2" is room 2 at every tenant\'s door - and under the first free one only where another offer holds its own (mutants: always the first free number; a number another offer holds)', async (t) => {
  const w = await rentWorld(t, []);
  const o = ownerRig(w);
  o.rig.frame();
  o.rig.tool.openPanel();
  await o.until(() => !!o.tab());
  o.tab().fire('click');
  assert.ok(await o.until(() => o.rows().length === 2 && o.why() === ''));
  o.rows()[1].fire('click');   // the finder's Room 2 - the east room
  o.btn(/^Offer/).fire('click');
  assert.ok(await o.until(() => o.rig.said.some((l) => /is offered to rent/.test(l))));
  assert.equal(o.rig.said.at(-1), 'Room 2 is offered to rent at 50 gold a day.');
  const seen = await H.homeRooms(w.api, 7, 300, w.T.id);
  assert.deepEqual(seen.rooms.map((r) => r.room), [2], 'the tenant\'s door names it room 2');
  // the law: its own number where free; the first free where another offer holds it; none once eight are held
  const found = [{ id: 1, name: 'Room 1', eye: [11, 1.6, 12] }, { id: 2, name: 'Room 2', eye: [18, 1.6, 12] }, { id: 3, name: 'Room 3', eye: [30, 1.6, 12] }];
  const roomOf = (p) => (p[0] < 15 ? { id: 1 } : p[0] < 25 ? { id: 2 } : { id: 3 });
  const view = (offers) => H.rentRoomsView(found, offers, roomOf, [10, 0, 10]).map((r) => [r.id, r.number]);
  assert.deepEqual(view([]), [[1, 1], [2, 2], [3, 3]]);
  assert.deepEqual(view([{ room: 2, anchor: [1, 1.6, 2], price: 9 }]), [[1, 2], [2, 1], [3, 3]],
    'a door hung renumbered the rooms: offer 2 stands in Room 1 - Room 2 takes the first free number, never 2 (another\'s)');
  assert.deepEqual(view([{ room: 1, anchor: [30, 1.6, 2], price: 9 }]), [[1, 2], [2, 2], [3, 1]], 'offer 1 stands in Room 3');
  assert.deepEqual(H.rentRoomsView([{ id: 9, name: 'Room 9', eye: [11, 1.6, 12] }], [], () => ({ id: 9 }), [10, 0, 10]).map((r) => r.number), [1],
    'a ninth room has no number of its own to offer under (the law offers eight): the first free one');
});

test('HOMES-FORCE: a forced town read asked while another is in flight is asked after it - a rent that lands under a plaque\'s read opens the door now, not a minute on; one such read a town however many ask (mutants: the forced read answered by the one in flight; a read a caller)', async (t) => {
  const w = await rentWorld(t, [{ room: 1, anchor: [-4, 1.6, 0], price: 50 }]);
  let computed = () => {};
  let hold = null;
  let townAsks = 0;
  const fetch = async (u, i) => {
    if (new URL(u).pathname === '/v1/homes/town') {
      townAsks++;
      if (hold) { const gate = hold; hold = null; const res = await w.svc.fetch(u, i); computed(); await gate; return res; }
    }
    return w.svc.fetch(u, i);
  };
  const api = accountHomes({ fetch, storage: sessionStorageOf(SESSION_KEY, w.tenant) });
  const homes = createOnlineHomes({ api, character: () => w.T.id });
  await homes.ensure(7);
  assert.equal(homeDoorAnswer(homes.homeAt(7, 300)), 'locked', 'a stranger, before');
  // the town's answer goes stale while the rent windows are up; the plaque asks again, and the service answers it
  // before the rent lands - the answer still on its way back
  w.clock.ms += 61_000;
  let open = () => {};
  hold = new Promise((r) => { open = r; });
  const answered = new Promise((r) => { computed = r; });
  const plaque = homes.ensure(7);
  await answered;
  const asks = townAsks;
  const r = await H.rentHomeRoom({ api, homes, realm: actFor(w.T), wallet: walletOf(playerWith(5000), 17), mapId: 7, buildingKey: 300, character: w.T.id, room: 1, days: 1, price: 50 });
  assert.equal(r.ok, true);
  const again = homes.ensure(7, { force: true });   // a second forced ask (the decorator's `changed`, say)
  open();
  await plaque;
  await again;
  await homes.waitFor(7);
  assert.equal(townAsks, asks + 1, 'one read after the flight, for both');
  const row = homes.homeAt(7, 300);
  assert.equal(row.tenant, T0 + 61 + RENT_DAY_S, 'the tenancy, read');
  assert.equal(homeDoorAnswer(row), 'enter', 'the door opens for the tenant now');
  // and the next time: a forced read under the next flight waits behind it again (the one waiting before was spent)
  w.clock.ms += 61_000;
  hold = new Promise((r) => { open = r; });
  const answered2 = new Promise((r) => { computed = r; });
  const plaque2 = homes.ensure(7);
  await answered2;
  const asks2 = townAsks;
  const forced2 = homes.ensure(7, { force: true });
  open();
  await plaque2;
  await forced2;
  assert.equal(townAsks, asks2 + 1, 'asked again after the second flight');
});
