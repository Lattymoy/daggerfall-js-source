// LAMP-KEEPER II (2026-10-14, Mac: "Reimplement an old bug that was previously removed. A chance of finding a vendor NPC
// as a lamp model. Anybody that interacts with the lamp model should earn the 'I Love Lamp' title. Implement exclusive
// dialogue and ensure there is a loot popup for obtaining the title"). Pinned here: the pick (a shop's keeper, one day
// in LAMP_KEEPER_ODDS, the room's own answer), the lamp's words, the title's carrier (granted once, said and raised as a
// banner; held, guest, offline, a failed call asked again), the account service's grant and its title, the vocabulary,
// and the wiring - the interior's stand, the press, the hover's name, the host's door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LAMP_KEEPER_ODDS, LAMP_KEEPER_ARCHIVE, LAMP_KEEPER_RECORDS, LAMP_CLASSIC, LAMP_ARCHIVE, LAMP_TITLE, isLampCandidate, isLampKeeper,
  LAMP_LINES, lampLines, LAMP_TEXT, createLampTitle,
} from '../../src/systems/lampKeeper.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { claimLamp, LAMP_TITLE as SERVICE_LAMP_TITLE } from '../../server-account/src/lamp.js';
import { titlesHeld } from '../../server-account/src/titles.js';
import { TITLES } from '../../src/net/identityToken.js';
import { TITLE_TEXT, TITLE_RGBA } from '../../src/ui/playerBadge.js';
import { honourEntry } from '../../src/ui/lootBanner.js';
import { RR_NPC_ARCHIVE, RR_NPC_XML_SCALE } from '../../src/systems/roleplayRealism/rrVariants.js';
import { d1 } from '../accountDb.mjs';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { ROUTES, OPEN_ROUTES } from '../../server-account/src/service.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { buildInteriorContext } from '../../src/scenes/interiorContext.js';
import { accountLamp, SESSION_KEY } from '../../src/net/accountClient.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const keeper = (record = 2, position = 77) => ({ textureArchive: 182, textureRecord: record, position });
const shop = BUILDING_TYPES.GeneralStore;

test('LAMP-KEEPER II THE PICK: a shop\'s keeper (182_0-2) stands as the lamp one day in 25 - the town, the building, the person and the day, one answer for every client; never in a tavern or a house, never another person', () => {
  assert.equal(LAMP_KEEPER_ODDS, 25);
  assert.equal(LAMP_KEEPER_ARCHIVE, 182);
  assert.deepEqual([...LAMP_KEEPER_RECORDS], [0, 1, 2]);
  assert.deepEqual({ ...LAMP_CLASSIC }, { archive: RR_NPC_ARCHIVE, record: 6 }, 'Kludge Town\'s street lamp - the record the bug drew');
  assert.deepEqual(RR_NPC_XML_SCALE[6], [3, 0.8], 'and the stretch Roleplay & Realism gives it');
  assert.equal(LAMP_ARCHIVE, 38232);   // PIN MOVED (AUDIT EG V, the merge of main): 38241 is the Spire's Broken Galleries (world/eliteGates/pseudoArchives.js EG_BAND_ARCHIVES) - the lamp moved to the first free number after the harbour's
  for (const r of [0, 1, 2]) assert.equal(isLampCandidate(keeper(r), shop), true);
  assert.equal(isLampCandidate(keeper(3), shop), false, 'not every 182 person');
  assert.equal(isLampCandidate({ textureArchive: 184, textureRecord: 2 }, shop), false);
  for (const bt of [BUILDING_TYPES.Tavern, BUILDING_TYPES.House1, BUILDING_TYPES.Temple, -1]) assert.equal(isLampCandidate(keeper(), bt), false, `not in building type ${bt}`);
  // AUDIT FIVE-ASKS D4: or whoever stands in the shop's own faction, on any picture (ARMRAM03 building 14's 182_7, 1022)
  const merchant = { textureArchive: 182, textureRecord: 7, factionID: 1022, position: 5 };
  assert.equal(isLampCandidate(merchant, shop, 1022), true, 'the shop\'s own merchant, whatever its picture');
  assert.equal(isLampCandidate(merchant, shop, 1023), false, 'another faction\'s person');
  assert.equal(isLampCandidate(merchant, BUILDING_TYPES.Tavern, 1022), false, 'a shop only');
  assert.equal(isLampCandidate({ textureArchive: 184, textureRecord: 2, factionID: 0 }, shop, 0), false, 'a building with no faction matches nobody');
  // the room's own answer, pinned: these days, and no others in the first two hundred
  const where = { buildingType: shop, buildingKey: 1234, mapId: 99 };
  const days = []; for (let d = 0; d < 200; d++) if (isLampKeeper(keeper(), { ...where, day: d })) days.push(d);
  assert.deepEqual(days, [20, 24, 65, 86, 88, 120, 156, 160, 183, 192]);
  assert.equal(isLampKeeper(keeper(), { ...where, day: 20 }), isLampKeeper(keeper(), { ...where, day: 20 }), 'the same answer asked twice');
  assert.equal(isLampKeeper(keeper(), { ...where, buildingType: BUILDING_TYPES.Tavern, day: 20 }), false, 'a tavern\'s keeper never');
  // about one day in twenty-five over a long run, and a different room a different day
  let n = 0; for (let d = 0; d < 20000; d++) if (isLampKeeper(keeper(), { ...where, day: d })) n++;
  assert.ok(n / 20000 > 0.03 && n / 20000 < 0.05, `about 1 in 25 (${n / 20000})`);
  const other = []; for (let d = 0; d < 200; d++) if (isLampKeeper(keeper(), { ...where, buildingKey: 1235, day: d })) other.push(d);
  assert.notDeepEqual(other, days, 'the next building\'s lamp days are its own');
});

test('LAMP-KEEPER II THE WORDS: its own, one set a day, read when spoken; its name, its rows and its title lines', () => {
  assert.equal(LAMP_LINES.length, 4);
  assert.deepEqual(lampLines(0), ['The lamp regards you.', '"Yes, I am a lamp. No, I do not wish to discuss it. Are you buying or not?"']);
  assert.deepEqual(lampLines(5), lampLines(1), 'the sets turn with the days');
  assert.deepEqual(lampLines(-1), lampLines(3));
  assert.match(lampLines(3)[1], /I love lamp\."$/);
  assert.deepEqual([LAMP_TEXT.name(), LAMP_TEXT.trade(), LAMP_TEXT.leave()], ['Lamp', 'Trade', 'Leave']);
  assert.match(LAMP_TEXT.granted(), /You have earned the title I Love Lamp\.$/);
  assert.match(LAMP_TEXT.guest(), /username/);
  assert.match(LAMP_TEXT.offline(), /online/);
  assert.equal(LAMP_TEXT.signin(), 'Sign in to an account to earn the title I Love Lamp.');
});

test('LAMP-KEEPER II THE TITLE\'S CARRIER: granted once - said and raised as a banner; held, then nothing more; a guest and no account told once; a failed call asked again at the next press; one call at a time', async () => {
  const said = [], raised = [];
  let answer = { ok: false, error: 'network' }, calls = 0;
  const title = createLampTitle({ claim: async () => { calls++; return answer; }, say: (l) => said.push(l), announce: (k, key) => raised.push([k, key]) });
  assert.equal(await title.speak(), 'failed');
  answer = { ok: true, data: { granted: true } };
  const [a, b] = [title.speak(), title.speak()];
  assert.deepEqual([await a, await b], ['granted', 'busy'], 'one call at a time');
  assert.deepEqual(said, [LAMP_TEXT.granted()]);
  assert.deepEqual(raised, [['title', 'ilovelamp']], 'the loot popup');
  assert.equal(await title.speak(), 'done', 'granted: nothing more this session');
  assert.equal(calls, 2);
  const held = createLampTitle({ claim: async () => ({ ok: true, data: { granted: false, why: 'held' } }), say: (l) => said.push(l), announce: (k, key) => raised.push([k, key]) });
  said.length = 0; raised.length = 0;
  assert.deepEqual([await held.speak(), await held.speak()], ['held', 'done']);
  assert.deepEqual([said, raised], [[], []], 'held before: no line, no banner');
  const guest = createLampTitle({ claim: async () => ({ ok: true, data: { granted: false, why: 'guest' } }), say: (l) => said.push(l) });
  assert.deepEqual([await guest.speak(), await guest.speak()], ['guest', 'guest']);
  assert.deepEqual(said, [LAMP_TEXT.guest()], 'a guest told once');
  said.length = 0;
  const none = createLampTitle({ claim: async () => ({ ok: false, error: 'no-session' }), say: (l) => said.push(l) });
  assert.deepEqual([await none.speak(), await none.speak()], ['signin', 'signin']);
  assert.deepEqual(said, [LAMP_TEXT.signin()], 'online with no account: told to sign in, once (AUDIT FIVE-ASKS D3)');
  said.length = 0;
  const expired = createLampTitle({ claim: async () => ({ ok: false, error: 'auth' }), say: (l) => said.push(l) });
  assert.equal(await expired.speak(), 'signin', 'a session the service stopped honouring: sign in');
  assert.deepEqual(said, [LAMP_TEXT.signin()]);
  said.length = 0;
  // AUDIT FIVE-ASKS D2: the account's, not the page's - A granted, a sign-in as B asks afresh; an answer landing after
  // the account changed is not kept
  let me = 'A', gate = null;
  answer = { ok: true, data: { granted: true } };
  const page = createLampTitle({ claim: async () => { calls++; if (gate) await gate; return answer; }, account: () => me, say: (l) => said.push(l), announce: (k, key) => raised.push([k, key]) });
  raised.length = 0;
  assert.deepEqual([await page.speak(), await page.speak()], ['granted', 'done']);
  me = 'B';
  assert.equal(await page.speak(), 'granted', 'B asked afresh');
  me = 'C';
  let open; gate = new Promise((r) => { open = r; });
  const late = page.speak();
  me = 'D'; open();
  assert.equal(await late, 'failed', 'C\'s answer, landed for D: not kept');
  gate = null;
  assert.equal(await page.speak(), 'granted', 'D asked for itself');
  assert.equal(raised.length, 3);
  said.length = 0; raised.length = 0;
  const bench = createLampTitle({ say: (l) => said.push(l) });
  assert.equal(await bench.speak(), 'offline', 'a host with no account service');
  assert.deepEqual(said, [LAMP_TEXT.offline()]);
  const throws = createLampTitle({ claim: async () => { throw new Error('x'); } });
  assert.equal(await throws.speak(), 'failed', 'a throw is a failed call');
});

test('LAMP-KEEPER II THE ACCOUNT SERVICE: the first word lays I Love Lamp on the row once (held after), a guest\'s writes nothing; the row grants the title to a registered account; the vocabulary, its word and its colour; its banner', async () => {
  assert.equal(SERVICE_LAMP_TITLE, LAMP_TITLE);
  const sql = [];
  let changes = 1;
  const db = { prepare: (q) => ({ bind: (...b) => ({ run: async () => { sql.push([q, b]); return { meta: { changes } }; } }) }) };
  assert.deepEqual(await claimLamp({ db }, { id: 'a1', handle: null }), { granted: false, why: 'guest' });
  assert.deepEqual(sql, [], 'a guest writes nothing');
  assert.deepEqual(await claimLamp({ db }, { id: 'a1', handle: 'Mac' }), { granted: true });
  assert.deepEqual(sql, [['UPDATE players SET lamp_title = 1 WHERE id = ?1 AND lamp_title = 0', ['a1']]]);
  changes = 0;
  assert.deepEqual(await claimLamp({ db }, { id: 'a1', handle: 'Mac' }), { granted: false, why: 'held' });
  assert.equal(titlesHeld({ handle: 'Mac', lamp_title: 1 }, {}).includes('ilovelamp'), true);
  assert.equal(titlesHeld({ handle: 'Mac', lamp_title: 0 }, {}).includes('ilovelamp'), false);
  assert.equal(titlesHeld({ handle: null, lamp_title: 1 }, {}).includes('ilovelamp'), false, 'a guest row holds none');
  assert.equal(TITLES.at(-27) /* PIN MOVED (NIRNROOT-SAGE): the Nirnroot Sage joined the list last */ /* PIN MOVED (KETCH): the Skyfarer joined the list last */ /* PIN MOVED (WITCH1): Witchwarden and Hearthkeeper joined the list last */ /* PIN MOVED (STAR8): the Starwarden joined the list after the questlines' five, before the festival's two */, 'ilovelamp', 'the vocabulary, last when it came');   // PIN MOVED (QL12): the questlines' five joined the list last, after the WikiMaid; PIN MOVED (KG6): The King's Gambit's Grandmaster joined after it, last; PIN MOVED (SERPENT5): and Coilbreaker after that; PIN MOVED (EG-E2, the merges of main): the Spire's thirteen after it; PIN MOVED (WIKIMAID): the WikiMaid joined the list last
  assert.equal(TITLE_TEXT.ilovelamp, 'I Love Lamp');
  assert.deepEqual([...TITLE_RGBA.ilovelamp], [1, 0.698, 0.376, 1], 'lamplight');
  const e = honourEntry({ kind: 'title', key: 'ilovelamp' });
  assert.deepEqual([e.name, e.kicker, e.honour.rgba], ['I Love Lamp', 'New Title', TITLE_RGBA.ilovelamp], 'its loot banner');
  assert.match(read('server-account/migrations/0113_lamp_title.sql'), /^ALTER TABLE players ADD COLUMN lamp_title INTEGER NOT NULL DEFAULT 0;$/m);
  assert.match(read('server-account/src/index.js'), /if \(path === '\/v1\/lamp\/claim' && request\.method === 'POST'\) \{\n[^\n]*\n\s*return json\(await claimLamp\(ctx, who\.player\), 200, origin\);/);
});

test('LAMP-KEEPER II THE WIRING: the interior stands the classic lamp under its own key at the record\'s size, no Morrowind body; the host picks per room and day; the press says its words with Trade and Leave and asks the title; the plaque names the Lamp; world.js hands its account door online', () => {
  const ctx = read('src/scenes/interiorContext.js'), modes = read('src/scenes/worldModes.js'), world = read('src/scenes/world.js');
  assert.match(ctx, /for \(const pn of people\) if \(opts\.lampPerson\?\.\(pn\)\) Object\.assign\(pn, \{ lamp: true, _mwLook: null \}\);/, 'no Morrowind body is read for it');
  assert.match(ctx, /pn\.stood = true;\n\s*if \(pn\.lamp\) return standLamp\(pn\);[^\n]*\n\s*if \(_rigFor\) \{/, 'before the voxel body and the billboard');
  assert.match(ctx, /const size = billboardSize\(t, LAMP_CLASSIC\.record\);/, 'the record\'s size, the mod\'s stretch with it');
  assert.match(ctx, /renderer\.uploadTexture\(LAMP_ARCHIVE, 0, t\.getColor32\(t\.getDFBitmap\(LAMP_CLASSIC\.record, 0\), 0\)\);/, 'the classic pixels, never a replacement\'s');
  assert.match(ctx, /pn\.standBatch = renderer\.createBillboardBatch\(LAMP_ARCHIVE, 0, size, \[\[pn\.x, pn\.y, pn\.z\]\]\);/);
  assert.match(modes, /lampPerson: \(pn\) => isLampKeeper\(pn, \{\n\s*buildingType: building\?\.buildingType \?\? -1, buildingFactionId: building\?\.factionId \?\? 0, buildingKey: building\?\.buildingKey \?\? 0,[^\n]*\n\s*mapId: hit\.dfLocation\?\.mapTableData\?\.mapId \?\? 0, day: Math\.floor\(worldMinutes\(\) \/ MINUTES_PER_DAY\),/);
  assert.match(modes, /if \(!info && pn\?\.lamp\) \{ lampChoice\(pn\); return; \}/);
  assert.match(modes, /const officeName = \(pn\) => arenaGatePersonName\(pn\) \?\? [^\n]* \?\? \(pn\?\.lamp \? LAMP_TEXT\.name\(\) : null\)(?: \?\? \(pn\?\.witch \? vendorOffice\(\) : null\))?;/   /* PIN MOVED (WITCH1): a Wyrd Sister's office after the Lamp's */);
  assert.match(modes, /\{ code: 'KeyT', label: `T - \$\{LAMP_TEXT\.trade\(\)\}`, action: \(\) => \{ Promise\.resolve\(townTalk\?\.ensureFactions\?\.\(\)\)\.then\(\(\) => openStaticNpc\(pn\)\)/, 'Trade opens the keeper\'s own shop');
  assert.match(modes, /function lampChoice\(pn\) \{\n\s*const lines = lampLines\(Math\.floor\(worldMinutes\(\) \/ MINUTES_PER_DAY\)\);/, 'its own words, the day\'s');
  assert.match(modes, /townTalk\?\.showOverlay\?\.\(new ChoiceWindow\(\{ lines, options \}\)\);\n\s*void lampTitle\.speak\(\);/);
  assert.match(modes, /const lampTitle = createLampTitle\(\{\n\s*claim: host\.lampClaim \? \(\) => host\.lampClaim\(\) : null,\n\s*account: \(\) => host\.lampAccount\?\.\(\) \?\? null,/, 'the host\'s account door, and whose it is');
  assert.match(modes, /announce: \(kind, key\) => announceHonour\(kind, key\),/);
  assert.match(world, /lampClaim: _accountLamp \? \(\) => _accountLamp\.claim\(\) : undefined,/);
  assert.match(world, /lampAccount: _accountLamp \? \(\) => _accountLamp\.account\(\) : undefined,/);
  assert.match(world, /const _accountLamp = params\.has\('online'\) \? accountLamp\(/);
  assert.equal(/lampPerson|lampChoice|lampKeeper|LAMP_/.test(read('src/scenes/dungeonContext.js')), false, 'the dungeon host stands no shop');
});

test('LAMP-KEEPER II THE WORKER (AUDIT FIVE-ASKS A1): /v1/lamp/claim is a route, behind a session and never open - a guest\'s word writes nothing, the first registered word grants, the next is held, a stranger is refused; the title on the wardrobe and worn', async () => {
  assert.ok(ROUTES.has('/v1/lamp/claim') && !OPEN_ROUTES.has('/v1/lamp/claim'), 'a route the worker answers, behind a session');
  _resetKeyForTests();
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: '' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.deepEqual(await call('POST', '/v1/lamp/claim', {}, me.secret), { status: 200, body: { granted: false, why: 'guest' } });
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'LampFan1', password: 'correct horse battery', ...ACCEPTED }, me.secret)).status, 200);
  assert.deepEqual(await call('POST', '/v1/lamp/claim', {}, me.secret), { status: 200, body: { granted: true } });
  assert.deepEqual(await call('POST', '/v1/lamp/claim', {}, me.secret), { status: 200, body: { granted: false, why: 'held' } });
  assert.equal((await call('POST', '/v1/lamp/claim', {})).status, 401, 'a stranger claims nothing');
  const acct = (await call('GET', '/v1/account', undefined, me.secret)).body;
  assert.ok(acct.wardrobe.titles.includes('ilovelamp'), 'the title on the wardrobe');
  assert.equal((await call('POST', '/v1/account/title', { title: 'ilovelamp' }, me.secret)).status, 200, 'and worn');
});

test('LAMP-KEEPER II THE STAND (AUDIT FIVE-ASKS D1): the real room builder stands the picked keeper as the classic lamp - uploaded under its own key with the cutout, a batch at the record\'s size, a pick target; taken out and stood again; freed with the room; another keeper stands as itself', async () => {
  const model = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), subMeshes: [] };
  const tex = (archive) => ({
    archive, recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1,
    getDFBitmap: (r) => ({ width: 32, height: 64, data: new Uint8Array(32 * 64), r }),
    getColor32: (bm, alpha) => ({ width: bm.width, height: bm.height, colors: new Uint8ClampedArray(bm.width * bm.height * 4), alpha, r: bm.r }),
  });
  const log = [];
  let id = 0;
  const renderer = {
    uploadTexture: (a, r, c) => log.push(['upload', a, r, c.alpha, c.r]),
    createBillboardBatch: (a, r, size) => { log.push(['batch', a, r, size]); return { id: ++id, archive: a, record: r }; },
    destroyBatch: (b) => log.push(['destroy', b.id]), destroyMesh: () => {}, createMesh: () => ({}),
  };
  const cpuModels = new Map();
  const deps = {
    renderer, cpuModels, palette: null, uploadRecordFrame: () => {},
    getGpuMesh: async (mid) => { cpuModels.set(mid, model); return { gpu: mid }; },
    getTexture: (a) => Promise.resolve(tex(a)), uploadRecord: (a, r) => log.push(['uploadRecord', a, r]),
  };
  const people = [
    { xPos: 10, yPos: 0, zPos: 20, textureArchive: 182, textureRecord: 2, factionID: 0, flags: 0, position: 77 },
    { xPos: 50, yPos: 0, zPos: 20, textureArchive: 182, textureRecord: 5, factionID: 0, flags: 0, position: 99 },
  ];
  const dfBlock = { name: 'T.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: 1 }, block3dObjectRecords: [{ modelIdNum: 41800, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }], blockFlatObjectRecords: [], blockDoorRecords: [], blockSection3Records: [], blockPeopleRecords: people } }] } };
  const settle = () => new Promise((r) => setTimeout(r, 20));
  const ctx = await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, {
    lampPerson: (pn) => pn.textureRecord === 2,
    variantPerson: (pn) => (pn.textureRecord === 2 ? { textureArchive: 197, textureRecord: 6 } : null),   // Roleplay & Realism's 197_6 keeper: never the lamp's picture
  });
  await settle();
  const [lamp, other] = ctx.people;
  assert.deepEqual([lamp.lamp, lamp._mwLook, other.lamp ?? false], [true, null, false]);
  assert.deepEqual([lamp.width, lamp.height], [0.8, 1.6], 'sized - a pick target');
  assert.deepEqual(log.filter((e) => e[1] === LAMP_ARCHIVE || e[1] === LAMP_CLASSIC.archive), [
    ['upload', LAMP_ARCHIVE, 0, 0, LAMP_CLASSIC.record],
    ['batch', LAMP_ARCHIVE, 0, { w: 0.8, h: 1.6 }],
  ], 'the classic 197_6 pixels under the port\'s own key, the cutout (alpha 0), at the record\'s size - never 197_6\'s own key');
  assert.deepEqual(log.filter((e) => e[1] === 182), [['uploadRecord', 182, 5], ['batch', 182, 5, { w: 0.8, h: 1.6 }]], 'the other keeper as itself');
  assert.deepEqual(ctx.billboardBatches.map((b) => [b.archive, b.record]), [[LAMP_ARCHIVE, 0], [182, 5]], 'listed - drawn and freed with the room');
  lamp.host.setActive(false);
  assert.deepEqual([ctx.billboardBatches.map((b) => b.archive), lamp.standBatch], [[182], null], 'taken out');
  lamp.host.setActive(true);
  await settle();
  assert.deepEqual(ctx.billboardBatches.map((b) => b.archive), [182, LAMP_ARCHIVE], 'stood again');
  lamp.host.setActive(false);
  lamp.host.setActive(true);
  lamp.host.setActive(false);   // taken out while its picture is still being fetched
  await settle();
  assert.deepEqual([ctx.billboardBatches.map((b) => b.archive), lamp.standBatch], [[182], null], 'a stand that lands after its person was taken out stands nothing');
  lamp.host.setActive(true);
  await settle();
  log.length = 0;
  ctx.destroy();
  assert.equal(log.filter((e) => e[0] === 'destroy').length, 2, 'every batch freed with the room');
});

test('LAMP-KEEPER II THE DOOR (AUDIT FIVE-ASKS D2/D3): accountLamp answers whose session it is, and forgets one the service stopped honouring', async () => {
  const store = new Map([[SESSION_KEY, JSON.stringify({ id: 'acc1', secret: 's'.repeat(43) })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'auth' }), headers: { get: () => null } });
  const door = accountLamp({ fetch, storage, waitMs: 1000 });
  assert.equal(door.account(), 'acc1');
  const r = await door.claim();
  assert.equal(r.error, 'auth');
  assert.equal(door.account(), null, 'forgotten');
});

