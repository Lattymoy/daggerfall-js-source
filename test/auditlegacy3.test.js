// AUDIT LEGACY III (2026-10-06, bible/01-Overview/Audit-Legacy-III.md): Project Legacy - Mac's own DFU mod, integrated -
// audited whole a third time, through six lenses (A the law and the host, O online and the server, W the world's
// wiring, U the windows in a browser, P persistence and the tests' truth, F fidelity and the records). Every finding is
// pinned here by its id, each through the real doors it was found through: the account Worker over its real migrations
// (test/accountDb.mjs), the real relay Room (test/fakeRoom.mjs), the real host over one shared storage page by page
// (createLegacyHost, the save records' own door), the real wedding managers against the real Worker, the real pages.
// A finding of a lens that repeats another's is pinned once, under the first id (U4 = A14, U5 = A10/F8, U6 = A12/F4,
// U7 = A11/F10, P2 = A4, P3 = A3, P4 = A6, F1 = A5, F9 = A9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from './accountDb.mjs';
import { fakeRoom } from './fakeRoom.mjs';
import {
  putLineage, realmWed, wedCardOf, listUnions, LINEAGE_MAX_BYTES, LINEAGE_BODY_MAX, LINEAGE_PEOPLE_MAX, LINEAGE_SURNAME_MAX, houseOn,
  lineageRecordOf, WED_HALF_LIFE_S,
} from '../server-account/src/legacy.js';
import { REALM_ID_RE } from '../server-account/src/realm.js';
import { renownHeldSql } from '../server-account/src/renownTracks.js';
import { RENOWN_TRACKS_MAX } from '../src/net/renown.js';
import { GUILD_FOUND_RENOWN, GUILD_RANK_MASTER } from '../src/net/guildLaw.js';
import {
  mintToken, verifyToken, claimsValid, REALM_CHARACTER_RE, TOKEN_MAX_CHARS, TOKEN_BODY_MAX, tokenBodyOf, GLYPHS, SEAT_TITLES, AURAS,
  RENOWN_MAX, ARENA_RATING_MAX, CHARACTER_LEVEL_MAX, ARMS_TOP_MAX,
} from '../src/net/identityToken.js';
import { HOUSE_NAME_MAX, HOUSE_GIVEN_MAX, HOUSE_GEN_MAX } from '../src/net/houseLaw.js';
import { NAME_MAX, parseClient } from '../src/net/wire.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { createWedManager, WED_DONE_WAIT_MS, WED_INCOMING_MAX, WED_REASK_MS } from '../src/net/wedSession.js';
import { REALM_ID_SHAPE, realmWedHalf } from '../src/systems/realmSaves.js';
import { createRealmLine, mergeLines } from '../src/systems/legacy/realmLine.js';
import {
  foundFamily, readFamily, addChild, recordDeath, touch, familyRng, MODELS, personOf, LEGACY_MOD,
} from '../src/systems/legacy/family.js';
import { loadFamily, storeFamily, mergeFacts, noteSeen } from '../src/systems/legacy/store.js';
import { wed, wedPlayer, topicsFor, childrenTogether, MARRIAGE_TEXT, spouseOf, childStep, CHILD_CHANCE } from '../src/systems/legacy/marriage.js';
import { mergeNews, memberStanding, REGARDS_KEPT, NEWS_MAX } from '../src/systems/legacy/influence.js';
import { createLegacyHost, LEGACY_TEXT, mergeFamily } from '../src/scenes/legacyHost.js';
import { modSaveRecords, restoreModSaveRecords, newGameModSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { FRIEND_AT } from '../src/systems/livingWorld/relations.js';
import { kinLine, kinGreeting } from '../src/systems/legacy/household.js';
import { siblingsOf, currentOf, fullNameOf, writePlayer, leanRecord, newPerson as blankOf } from '../src/systems/legacy/family.js';
import { mintRemainsItem, BLESSING_POINTS, BLESSING_SKILL_MAX, bestSkillOf } from '../src/systems/legacy/heirloom.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { SKILL_NAMES } from '../src/systems/skills.js';
import './chargenDom.mjs';   // a minimal DOM: the Family tab's pages drawn headless
import {
  setFamilyProvider, resetFamilyPages, drawTreePage, drawHousePage, drawHallPage, ageWord, personChips, sheetHouse, identityLine, FAMILY_CSS,
} from '../src/ui/familyPages.js';
import { layoutTree } from '../src/systems/legacy/tree.js';
import { facePose } from '../src/systems/legacy/facePose.js';
import { COMMON_FACES_FILE, createFaceLoader } from '../src/ui/partyPanel.js';
import { PORTRAIT_ARCHIVE } from '../src/ui/nativeTalk.js';
import { legacyModelOptions, BLOODLINE_ONLINE_LINE } from '../src/ui/legacyModelChoice.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;

// ─── THE ACCOUNT SERVICE ───────────────────────────────────────────────────────────────────────────────────────────

/** An account with a line `fam` of `people`, and a realm character born as each of `born` (the last born holds the
 *  lease - createRealm frees the account's others; `join` takes one up again). */
async function accountOf(S, fam, surname, people, { model = 'bloodline', born = [1] } = {}) {
  const g = await S.guest();
  const call = (p, b) => S.call(p, b, g.secret);
  const lin = await call('/v1/realm/lineage', { id: fam, record: { v: 1, id: fam, surname, model, rev: 1, people } });
  assert.equal(lin.status, 200, `the line ${fam}`);
  const chars = {};
  for (const person of born) {
    const p = people.find((x) => x.id === person);
    const c = await call('/v1/realm/create', { name: `${p.given} ${surname}`, lineage: fam, person });
    assert.equal(c.status, 200, `born as ${person}: ${JSON.stringify(c.body)}`);
    chars[person] = { id: c.body.id, lease: c.body.lease };
  }
  const who = { g, call, chars, fam, rev: 1 };
  who.join = async (person) => { const j = await call('/v1/realm/join', { id: chars[person].id }); chars[person].lease = j.body.lease; return j; };
  who.half = (person, sid, partner, partnerChar, over = {}) => call('/v1/realm/wed', { id: chars[person].id, lease: chars[person].lease, sid, partner, partnerChar, ...over });
  who.unions = async () => (await call('/v1/realm/unions', {})).body.unions;
  who.die = (person, why) => call('/v1/realm/die', { id: chars[person].id, lease: chars[person].lease, ...(why ? { why } : {}) });
  /** The line written again, made from the rev this account last wrote. */
  who.write = async (record) => {
    const r = await call('/v1/realm/lineage', { id: fam, record: { v: 1, id: fam, surname, model, rev: who.rev + 1, people, ...record }, base: who.rev });
    if (r.status === 200) who.rev = r.body.rev;
    return r;
  };
  return who;
}
const ysolde = [{ id: 1, given: 'Ysolde', gender: 'female', race: 'DarkElf', face: 3 }, { id: 2, given: 'Gorbash', gender: 'male', race: 'Orc', face: 1 }];
const iszara = [{ id: 1, given: 'Iszara', gender: 'male', race: 'Redguard', face: 7 }];

test('AUDIT LEGACY III O1: A HALF NAMES THE CHARACTER THE OTHER PLAYER SAW - the account alone let the other side lease another of its characters after the yes and post with that one: B wed to a character they never saw, with no way out but a death', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-o1-aaaaaa', 'Hlaalu', ysolde, { born: [1, 2] });
  const B = await accountOf(S, 'fam-o1-bbbbbb', 'Dres', iszara, { model: 'enduring' });
  await A.join(1);   // A stands in the temple as Ysolde - the relay stamps her character on A's frames
  const SID = 'wedO1abc1';
  assert.deepEqual((await B.half(1, SID, A.g.id, A.chars[1].id)).body, { ok: true, wed: false }, 'B said yes to Ysolde');
  // A takes up Gorbash's lease after the yes, and posts its half as him
  await A.join(2);
  const sub = await A.half(2, SID, B.g.id, B.chars[1].id);
  assert.deepEqual([sub.status, sub.body.error], [409, 'wed-partner'], 'not the one B saw: refused');
  assert.equal((await B.unions()).length, 0, 'no union made');
  // the same half again as Ysolde - the sid's half is A's word as Gorbash, which stands until it is taken back
  await A.join(1);
  assert.equal((await A.half(1, SID, B.g.id, B.chars[1].id)).body.error, 'wed-spent', 'a half is written once: re-posted as another, it is no half');
  assert.deepEqual((await A.half(1, SID, B.g.id, B.chars[1].id, { withdraw: true })).body, { ok: true, wed: false }, 'taken back');
  const wed = await A.half(1, SID, B.g.id, B.chars[1].id);
  assert.equal(wed.body.wed, true, 'as the one B saw: wed');
  assert.equal(wed.body.union.partner.char, B.chars[1].id);
  assert.equal((await B.unions())[0].partner.char, A.chars[1].id, 'B is wed to Ysolde, the character B said yes to');
  // the other way round: C stands (and is stamped) as Aldo, says yes - and its half is posted as Velyn, leased since.
  // A names the one A saw: character for character, refused
  const C = await accountOf(S, 'fam-o1-cccccc', 'Indoril', [{ id: 1, given: 'Aldo', gender: 'male', race: 'Breton', face: 1 }, { id: 2, given: 'Velyn', gender: 'male', race: 'DarkElf', face: 2 }], { born: [1, 2] });
  const D = await accountOf(S, 'fam-o1-dddddd', 'Redoran', [{ id: 1, given: 'Brara', gender: 'female', race: 'DarkElf', face: 1 }]);
  assert.equal((await C.half(2, 'wedO1swap1', D.g.id, D.chars[1].id)).body.wed, false, 'C\'s half, posted as Velyn');
  const swapped = await D.half(1, 'wedO1swap1', C.g.id, C.chars[1].id);
  assert.deepEqual([swapped.status, swapped.body.error], [409, 'wed-partner'], 'D saw Aldo: no union with Velyn');
  assert.equal((await D.unions()).length, 0);
  // a half re-posted naming another of the other's characters is no half of this wedding
  const E = await accountOf(S, 'fam-o1-eeeeee', 'Telvanni', [{ id: 1, given: 'Neloth', gender: 'male', race: 'DarkElf', face: 3 }]);
  assert.equal((await E.half(1, 'wedO1name1', C.g.id, C.chars[1].id)).body.wed, false);
  assert.equal((await E.half(1, 'wedO1name1', C.g.id, C.chars[2].id)).body.error, 'wed-spent', 'renamed, it is no half');
  // the shape: a half with no character of the other, or one not of the realm's shape, is no half
  for (const over of [{ partnerChar: undefined }, { partnerChar: 'c-offline-char' }, { partnerChar: 7 }]) {
    assert.equal((await B.half(1, 'wedO1shape', A.g.id, A.chars[1].id, over)).status, 400, JSON.stringify(over));
  }
  const ctx = { db: S.env.DB, nowS: Math.floor(Date.now() / 1000) };
  assert.deepEqual(await realmWed(ctx, B.g.id, { id: B.chars[1].id, lease: B.chars[1].lease, sid: 'wedO1shape', partner: A.g.id, partnerChar: A.chars[1].id, withdraw: 'yes' }), { error: 'body' }, 'a withdraw is a word, never a truthy stand-in');
  // one shape for a realm character's id, the token's (identityToken.js REALM_CHARACTER_RE), the realm's and the client's
  for (const re of [REALM_ID_RE, REALM_ID_SHAPE]) assert.equal(re.source, REALM_CHARACTER_RE.source);
  assert.match(rd('server-account/src/legacy.js'), /import \{ ID_RE, REALM_CHARACTER_RE \} from '\.\.\/\.\.\/src\/net\/identityToken\.js';/);
  assert.match(REFUSALS['wed-partner'], /no longer the one who stood with you/);
});

test('AUDIT LEGACY III O1: THE TOKEN VOUCHES FOR THE REALM CHARACTER (`ci`, beside a realm `rc` of 1 alone), the relay attaches it in a place room and stamps it on a wedding\'s frames as `sc` - never a client\'s own word - and the client hands it to the wedding\'s law', async () => {
  // the mint: a realm character's token carries its id; any other none
  const S = await standService();
  const A = await accountOf(S, 'fam-o1-cccccc', 'Hlaalu', ysolde);
  const claims = (t) => JSON.parse(Buffer.from(tokenBodyOf(t), 'base64url').toString());
  const minted = (await A.call('/v1/auth/token', { character: A.chars[1].id })).body;
  assert.deepEqual([claims(minted.token).rc, claims(minted.token).ci], [1, A.chars[1].id]);
  const offline = (await A.call('/v1/auth/token', { character: 'c-offline-1' })).body;
  assert.deepEqual([claims(offline.token).rc, 'ci' in claims(offline.token)], [0, false], 'a character of no realm: no `ci`');
  // the law: `ci` with the realm's yes alone, of the realm id's shape
  const base = { s: 'acct-0001', n: 'Mira', k: 'guest', i: 100, e: 160 };
  assert.equal(claimsValid({ ...base, rc: 1, ci: 'rffffffffffffffffffff' }), true);
  for (const bad of [{ ci: 'rffffffffffffffffffff' }, { rc: 0, ci: 'rffffffffffffffffffff' }, { rc: 1, ci: 'c-offline-1' }, { rc: 1, ci: 7 }]) {
    assert.equal(claimsValid({ ...base, ...bad }), false, JSON.stringify(bad));
  }
  // the relay: attached in a place room, stamped as `sc` beside `sub`; a client's `sc` (on the frame or in its data) dropped
  const r = fakeRoom('interior:m1234.5');
  const a = r.connect(); await r.hello(a, 'peer-0001', null, { rc: 1, ci: 'r00000000000000000a01' });
  const b = r.connect(); await r.hello(b, 'peer-0002', null, { rc: 1, ci: 'r00000000000000000b02' });
  assert.equal(a.att.ci, 'r00000000000000000a01', 'the hello\'s attachment carries the token\'s character');
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'wed', sc: 'rffffffffffffffffffff', data: { to: 'peer-0002', s: 'wedO1sc01', k: 'ask', sc: 'reeeeeeeeeeeeeeeeeeee' } }));
  assert.deepEqual(b.sent.filter((m) => m.t === 'wed'), [{ t: 'wed', id: 'peer-0001', sub: 'acct-peer-0001', sc: 'r00000000000000000a01', data: { to: 'peer-0002', s: 'wedO1sc01', k: 'ask' } }]);
  const chat = fakeRoom('chat:world');
  const c = chat.connect(); await chat.hello(c, 'peer-0003', null, { rc: 1, ci: 'r00000000000000000c03' });
  assert.equal('ci' in c.att, false, 'a channel is nowhere to wed - and carries no character');
  // the client: the stamp to the law, only of the realm's shape
  const online = rd('src/net/online.js');
  assert.match(online, /const scOf = \(m\) => \(typeof m\?\.sc === 'string' && REALM_CHARACTER_RE\.test\(m\.sc\) \? m\.sc : null\);/);
  assert.match(online, /validWedData, \(id, d\) => this\.onWed\?\.\(id, d, subOf\(m\), scOf\(m\)\)\);/);
  assert.match(rd('src/scenes/world.js'), /online\.onWed = \(id, d, sub = null, sc = null\) => \{ wedMgr\.onFrame\(id, d, sub, sc\); \};/);
});

test('AUDIT LEGACY III O11: THE TOKEN\'S BODY BOUND IS ONE - the relay\'s hello read a 640-character body and the mint asked only the verifier\'s 1024: every optional claim at once was 639, so a house (LEGACY7) carried such a token to 739, minted and then refused at every hello as "bad token"; with the realm character it is 778 now, under TOKEN_BODY_MAX, and a house past it is left unsaid', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_760_000_000;
  const seatT = SEAT_TITLES.reduce((x, t) => (t.length > x.length ? t : x), '');
  const aura = AURAS.reduce((x, a) => (a.length > x.length ? a : x), '');
  const every = {
    s: 'a'.repeat(40), n: 'W'.repeat(NAME_MAX), k: 'linked', t: seatT, ts: [0xffffffff, 9999], g: [...GLYPHS], au: aura, mu: nowS + 10 ** 9, lv: RENOWN_MAX,
    gi: `g${'z'.repeat(10)}`, gt: 'WWWW', gm: `m${'9'.repeat(15)}`, rc: 1, rb: [15, 14], ar: ARENA_RATING_MAX, cl: CHARACTER_LEVEL_MAX,
  };
  const house = { hn: 'H'.repeat(HOUSE_NAME_MAX), hc: 'G'.repeat(HOUSE_GIVEN_MAX), hb: 1, hg: HOUSE_GEN_MAX };
  // INT7: and the arms (`wa`, at their widest) - every claim the realm signs, the house still inside the hello's bound
  const widest = await mintToken({ ...every, ...house, ci: `r${'f'.repeat(20)}`, wa: [ARMS_TOP_MAX, 1] }, kp.privateKey, { subtle, nowS });
  const body = tokenBodyOf(widest).length;
  assert.ok(body > 640, `past the old bound (${body})`);
  assert.ok(body <= TOKEN_BODY_MAX, `every claim, a house at its bounds and the character inside the hello (${body} of ${TOKEN_BODY_MAX})`);
  assert.ok(widest.length <= TOKEN_MAX_CHARS);
  assert.equal(parseClient(JSON.stringify({ t: 'hello', id: 'mac-0001', secret: 'shh-shh-shh-0001', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, tok: widest })).tok, widest, 'the wire takes it');
  assert.ok((await verifyToken(widest, kp.publicKey, { subtle, nowS })).ok);
  // one bound, the wire's and the token module's
  assert.match(rd('src/net/wire.js'), new RegExp(`const TOKEN_RE = /\\^\\[A-Za-z0-9\\]\\{1,8\\}\\\\\\.\\[A-Za-z0-9_-\\]\\{1,${TOKEN_BODY_MAX}\\}\\\\\\.`));
  // the mint leaves a house unsaid past EITHER bound - never the rest (the character stays: it fits beside every claim)
  assert.match(rd('server-account/src/index.js'), /if \(house && \(token\.length > TOKEN_MAX_CHARS \|\| tokenBodyOf\(token\)\.length > TOKEN_BODY_MAX\)\) \{ token = await mintToken\(signed, key, \{ subtle, nowS \}\); houseWorn = null; \}/);
  assert.match(rd('server-account/src/index.js'), /rc, \.\.\.\(rc \? \{ ci: body\.character \} : \{\}\),/);
});

test('AUDIT LEGACY III O12: A TOMBSTONE ACTS IN NOTHING - its last open item, driven: a fallen Bloodline character\'s Stores were read and WITHDRAWN into the heir\'s pack by a request that named it, its tracks written after its death (only the guilds\' door asked, O5). Every act naming one of the account\'s tombstones is refused at the service\'s one door - an Enduring elder retired too - the heir acts, the token still mints (rc 0), and another account learns nothing of whose character is dead', async () => {
  const S = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = S.env.DB._raw;
  const mac = await S.registered('Mac');
  const call = (p, b, who = mac) => S.call(p, b, who.secret);
  const lineOf = async (fam, model) => assert.equal((await call('/v1/realm/lineage', { id: fam, record: { v: 1, id: fam, surname: 'Hlaalu', model, rev: 1, people: ysolde } })).status, 200);
  const born = async (fam, person) => { const c = await call('/v1/realm/create', { name: `${ysolde[person - 1].given} Hlaalu`, lineage: fam, person }); assert.equal(c.status, 200, JSON.stringify(c.body)); return c.body; };
  await lineOf('fam-o12-aaaaaa', 'bloodline');
  const fallen = await born('fam-o12-aaaaaa', 1);
  const heir = await born('fam-o12-aaaaaa', 2);
  raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'p1:19', 'own', 5)").run(mac.id, fallen.id);
  const stores = () => raw.prepare('SELECT origin, qty FROM prof_stores WHERE char_id = ?').all(fallen.id).map((r) => [r.origin, Number(r.qty)]);
  const carried = () => raw.prepare('SELECT COUNT(*) AS n FROM prof_carried WHERE char_id = ?').get(fallen.id).n;
  assert.equal((await call('/v1/prof/state', { character: fallen.id })).status, 200, 'alive, it acts');
  const lease = (await call('/v1/realm/join', { id: fallen.id })).body.lease;   // one account plays one character: the heir's birth took it
  assert.equal((await call('/v1/realm/die', { id: fallen.id, lease })).status, 200, 'it falls for good');
  const asks = [
    ['/v1/prof/state', {}],
    ['/v1/stores/withdraw', { material: 'p1:19', qty: 2, rid: 'aaaaaaaaaaaaaa12', carry: true, held: 0, seen: 0 }],
    ['/v1/prof/harvest', { node: 'n1', kind: 'ore', rid: 'aaaaaaaaaaaaab12' }],
    ['/v1/market/read', { view: 'mine' }],
    ['/v1/renown/xp', { xp: 50, rid: '00000000000000c1' }],
    ['/v1/guilds/invite', { handle: 'nobody' }],
  ];
  for (const [path, body] of asks) {
    const r = await call(path, { character: fallen.id, ...body });
    assert.deepEqual([r.status, r.body.error], [410, 'dead'], `${path}: a tombstone acts in nothing`);
  }
  assert.deepEqual(stores(), [['own', 5]], 'its Stores as it left them');
  assert.equal(carried(), 0, 'nothing of theirs in anyone\'s pack');
  assert.equal((await call('/v1/prof/state', { character: heir.id })).status, 200, 'the heir acts');
  const token = await call('/v1/auth/token', { character: fallen.id });
  assert.equal(token.status, 200, 'the mint is no act - a page under its death screen still mints');
  assert.equal(JSON.parse(Buffer.from(token.body.token.split('.')[1], 'base64url').toString()).rc, 0, 'and vouches for no realm character (REALM-DOOR)');
  // an Enduring elder's retirement is a tombstone too: never played again
  await lineOf('fam-o12-eeeeee', 'enduring');
  const elder = await born('fam-o12-eeeeee', 1);
  assert.equal((await call('/v1/realm/die', { id: elder.id, lease: elder.lease, why: 'retired' })).status, 200);
  assert.deepEqual([(await call('/v1/prof/state', { character: elder.id })).status], [410]);
  // another account naming this account's dead character hears nothing of it: its own rows under the name, as ever
  const bran = await S.registered('Bran');
  assert.equal((await call('/v1/prof/state', { character: fallen.id }, bran)).status, 200, 'no word of whose character is dead');
  // one door, before every route
  const src = rd('server-account/src/index.js');
  assert.ok(src.indexOf('isTombstone(db, who.player.id, body.character)') < src.indexOf("if (path === '/v1/auth/token' && request.method === 'POST')"), 'asked before the first route');
});

test('AUDIT LEGACY III O3: A YES IS TAKEN BACK, AND NEVER OUTLIVES ITS WORD - the service: a half is written once (posted again it keeps its first `at`), `withdraw` takes it back (answered the union when it stood first), and the other\'s half is the union only while it stands (asked IN the write)', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-o3-aaaaaa', 'Hlaalu', ysolde);
  const B = await accountOf(S, 'fam-o3-bbbbbb', 'Dres', iszara);
  const at = (acct, sid) => S.env.DB._raw.prepare('SELECT at FROM realm_wed_halves WHERE player = ? AND sid = ?').get(acct.g.id, sid)?.at ?? null;
  const realNow = Date.now;
  try {
    let clock = realNow();
    Date.now = () => clock;
    assert.equal((await B.half(1, 'wedO3keep1', A.g.id, A.chars[1].id)).body.wed, false);
    const first = at(B, 'wedO3keep1');
    clock += 100_000;
    assert.equal((await B.half(1, 'wedO3keep1', A.g.id, A.chars[1].id)).body.wed, false);
    assert.equal(at(B, 'wedO3keep1'), first, 'posted again, its first `at` - a re-post refreshed it, five minutes more each time');
    clock += (WED_HALF_LIFE_S - 100 + 1) * 1000;
    assert.deepEqual((await A.half(1, 'wedO3keep1', B.g.id, B.chars[1].id)).body, { ok: true, wed: false }, 'its life ran from the yes: lapsed');
  } finally { Date.now = realNow; }
  // taken back: the other's half later finds nothing
  assert.equal((await B.half(1, 'wedO3back1', A.g.id, A.chars[1].id)).body.wed, false);
  assert.deepEqual((await B.half(1, 'wedO3back1', A.g.id, A.chars[1].id, { withdraw: true })).body, { ok: true, wed: false });
  assert.equal(at(B, 'wedO3back1'), null);
  assert.deepEqual((await A.half(1, 'wedO3back1', B.g.id, B.chars[1].id)).body, { ok: true, wed: false }, 'a half taken back makes nothing');
  assert.equal((await B.unions()).length, 0);
  // a withdraw after the union stood answers it - a late word is never lost
  await A.half(1, 'wedO3back1', B.g.id, B.chars[1].id, { withdraw: true });
  assert.equal((await B.half(1, 'wedO3late', A.g.id, A.chars[1].id)).body.wed, false);
  assert.equal((await A.half(1, 'wedO3late', B.g.id, B.chars[1].id)).body.wed, true);
  const late = (await B.half(1, 'wedO3late', A.g.id, A.chars[1].id, { withdraw: true })).body;
  assert.deepEqual([late.wed, late.union?.partner.char], [true, A.chars[1].id], 'the union that stood first, answered');
  // the client's own request says the withdraw (realmSaves.js realmWedHalf), through the Worker's route
  const C = await accountOf(S, 'fam-o3-cccccc', 'Indoril', [{ id: 1, given: 'Aldo', gender: 'male', race: 'Breton', face: 1 }]);
  const io = { secret: C.g.secret, base: 'https://accounts.invalid', storage: mem(), fetch: (u, i) => S.fetch(u, i) };
  assert.equal((await C.half(1, 'wedO3clnt1', A.g.id, A.chars[1].id)).body.wed, false);
  assert.ok(at(C, 'wedO3clnt1') != null);
  const took = await realmWedHalf(io, C.chars[1].id, C.chars[1].lease, 'wedO3clnt1', A.g.id, A.chars[1].id, { withdraw: true });
  assert.deepEqual([took.ok, took.data?.wed], [true, false]);
  assert.equal(at(C, 'wedO3clnt1'), null, 'taken back by the client\'s word');
  // the union's write asks the other's half IN it: a half deleted between the read and the write makes nothing
  assert.match(rd('server-account/src/legacy.js'), /\+ ' AND EXISTS \(SELECT 1 FROM realm_wed_halves WHERE sid = \? AND player = \? AND char_id = \? AND partner_char = \?\)',/);
  assert.match(rd('server-account/src/legacy.js'), /ON CONFLICT \(sid, player\) DO NOTHING/);
});

/** Two players' wedding managers on one fake wire, each with its half at the REAL Worker (test/legacy7_wed.test.js's
 *  pairOver, with the relay's character stamps and a half that can be made to fail). */
function pairOver(a, b) {
  const q = [];
  let t = 0;
  let inflight = 0;
  const side = (me, other, id, otherId) => {
    const s = { said: [], wed: [], prompts: [], unprompts: [], halves: [], fail: false, lose: false };
    s.mgr = createWedManager({
      send: (d) => { if (s.lose && d.k === 'done') return true; q.push({ to: d.to, from: id, d }); return true; },
      now: () => t, say: (l) => s.said.push(l), peerName: (p) => (p === otherId ? other.name : null), selfId: () => id,
      can: () => null, peerCan: () => true,
      half: async (sid, partner, partnerChar, opts = {}) => {
        s.halves.push({ sid, withdraw: !!opts.withdraw });
        if (s.fail) return { ok: false, error: 'offline' };
        inflight++;
        try {
          const r = await me.half(1, sid, partner, partnerChar, opts.withdraw ? { withdraw: true } : {});
          return r.status === 200 ? { ok: true, wed: r.body.wed === true, union: r.body.union ?? null } : { ok: false, error: r.body?.error };
        } finally { inflight--; }
      },
      onPrompt: (p) => s.prompts.push(p), onUnprompt: (p) => s.unprompts.push(p), onWed: (u) => s.wed.push(u), refusalText: (e) => `refused:${e}`,
    });
    return s;
  };
  const A = side(a, b, 'peer-000a', 'peer-000b');
  const B = side(b, a, 'peer-000b', 'peer-000a');
  const subs = { 'peer-000a': a.g.id, 'peer-000b': b.g.id };
  const scs = { 'peer-000a': a.chars[1].id, 'peer-000b': b.chars[1].id };
  const mgrs = { 'peer-000a': A, 'peer-000b': B };
  const pump = async () => {
    for (let i = 0; i < 100_000; i++) {
      while (q.length && mgrs[q[0].to]) { const f = q.shift(); mgrs[f.to].mgr.onFrame(f.from, f.d, subs[f.from], scs[f.from]); }
      for (let k = 0; k < 3; k++) await new Promise((r) => { setImmediate(r); });
      if (!inflight && !q.length) return;
    }
    throw new Error('the wire never settled');
  };
  return { A, B, q, pump, tick: (ms) => { t += ms; } };
}

test('AUDIT LEGACY III O3: THE CLIENT TAKES ITS YES BACK whenever its player is told the wedding did not happen - the done never came, a `no` while it waits, a half answered with none of theirs - and a late `done` after a withdraw that never landed asks the service once more; a proposal without the relay\'s character stamp is answered refused', async () => {
  const S = await standService();
  const a = await accountOf(S, 'fam-o3-cccccc', 'Hlaalu', ysolde); a.name = 'Ysolde';
  const b = await accountOf(S, 'fam-o3-dddddd', 'Dres', iszara); b.name = 'Iszara';
  // the done never came: B asks the service AT ITS TIME - and that ask is a withdraw
  const x = pairOver(a, b);
  x.A.lose = true;
  x.A.mgr.request('peer-000b');
  await x.pump();
  // A's half is held back: B's yes stands at the service, A never posts
  const posted = x.q.length;
  await x.B.mgr.accept('peer-000a');
  x.q.splice(posted);   // the yes never reaches A
  await x.pump();
  x.tick(WED_DONE_WAIT_MS + 1);
  x.B.mgr.tick();
  await x.pump();
  assert.deepEqual(x.B.halves.map((h) => h.withdraw), [false, true], 'its yes, then its yes taken back');
  assert.ok(x.B.said.some((l) => /The wedding did not happen/.test(l)));
  assert.deepEqual((await a.half(1, x.B.halves[0].sid, b.g.id, b.chars[1].id)).body, { ok: true, wed: false }, 'A\'s late half makes nothing - what B was told stays true');
  // a `no` while B waits: withdrawn
  const y = pairOver(a, b);
  y.A.mgr.request('peer-000b');
  await y.pump();
  await y.B.mgr.accept('peer-000a');
  const sid = y.B.halves[0].sid;
  y.q.length = 0;   // A's yes-answer lost; A cancels
  y.B.mgr.onFrame('peer-000a', { k: 'no', to: 'peer-000b', s: sid, why: 'cancelled' }, a.g.id, a.chars[1].id);
  await y.pump();
  assert.deepEqual(y.B.halves.map((h) => h.withdraw), [false, true]);
  assert.deepEqual((await a.half(1, sid, b.g.id, b.chars[1].id)).body, { ok: true, wed: false }, 'cancelled, then posted a minute on: nothing');
  // a withdraw that never landed leaves the wedding lapsed: a late done asks once more
  const z = pairOver(a, b);
  z.A.lose = true;
  z.A.mgr.request('peer-000b');
  await z.pump();
  await z.B.mgr.accept('peer-000a');
  await z.pump();   // A's half lands: the union stands, A's done is lost
  assert.equal(z.A.wed.length, 1);
  z.B.fail = true;
  z.tick(WED_DONE_WAIT_MS + 1);
  z.B.mgr.tick();
  await z.pump();
  assert.equal(z.B.wed.length, 0, 'the service unreached: nothing recorded yet');
  z.B.fail = false;
  z.B.mgr.onFrame('peer-000a', { k: 'done', to: 'peer-000b', s: z.B.halves[0].sid }, a.g.id, a.chars[1].id);
  await z.pump();
  assert.equal(z.B.wed.length, 1, 'the late done, honoured: the union the service holds recorded');
  // no stamp of the asker's character (a relay before it): refused, never a half that cannot name them
  const w = pairOver(a, b);
  w.B.mgr.onFrame('peer-000a', { k: 'ask', to: 'peer-000b', s: 'wedO3nosc1' }, a.g.id, null);
  assert.deepEqual(await w.B.mgr.accept('peer-000a'), { ok: false, why: 'refused' });
  assert.deepEqual(w.B.halves, [], 'nothing posted');
});

test('AUDIT LEGACY III O4: THE UNION\'S CARD NAMES THE MEMBER THROUGH THE NAME FILTER - the realm character\'s own name is its account\'s, shown to nobody, and the card made it the partner\'s spouse\'s name on their tree, HUD and news', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-o4-aaaaaa', 'Hlaalu', [{ id: 1, given: 'Admin', gender: 'male', race: 'Nord', face: 2 }]);
  S.env.DB._raw.prepare('UPDATE realm_characters SET name = ? WHERE id = ?').run('Admin Hlaalu', A.chars[1].id);
  const card = await wedCardOf(S.env.DB, A.g.id, A.chars[1].id);
  assert.equal(card.name, '', 'a name the filter refuses goes as none');
  assert.deepEqual(card.house, { hn: 'Hlaalu', hb: 1 }, 'and the house\'s given name with it (houseOn, as the mint)');
  const B = await accountOf(S, 'fam-o4-bbbbbb', 'Dres', iszara);
  await A.half(1, 'wedO4card1', B.g.id, B.chars[1].id);
  const u = (await B.half(1, 'wedO4card1', A.g.id, A.chars[1].id)).body.union;
  assert.equal(JSON.stringify(u.partner).includes('Admin'), false, 'nowhere on the partner\'s card');
  const { wedPlayer } = await import('../src/systems/legacy/marriage.js');
  const { foundFamily, familyRng } = await import('../src/systems/legacy/family.js');
  const f = foundFamily({ name: 'Iszara Dres', gender: 'male', race: 'Redguard', faceIndex: 0, chargenDone: true, characterId: B.chars[1].id }, { id: 'fam-o4-local', rng: familyRng(1) });
  const s = wedPlayer(f, f.people[0], u.partner, u.sid, 100);
  assert.equal(`${s.given} ${s.surname}`.includes('Admin'), false, 'never in the partner\'s record');
  // a name the filter takes stands as it was
  const C = await accountOf(S, 'fam-o4-cccccc', 'Indoril', [{ id: 1, given: 'Aldo', gender: 'male', race: 'Breton', face: 1 }]);
  assert.equal((await wedCardOf(S.env.DB, C.g.id, C.chars[1].id)).name, 'Aldo Indoril');
});

test('AUDIT LEGACY III O5: A TOMBSTONE\'S ONLINE LIFE GOES WITH IT - its guild seat handed on (a fallen master stayed master for good, the dead account still acting as one), a guild it leaves empty and holding nothing goes, and its Renown track no longer holds one of the account\'s sixty places', async () => {
  const S = await standService();
  const m = await S.registered('Masterly', { renown: GUILD_FOUND_RENOWN });
  const g = (await S.found(m, { name: 'Iron Wolves', tag: 'IRW' })).body.guild;
  const mem = await S.registered('Memberly');
  await S.call('/v1/guilds/invite', { character: m.character, handle: 'memberly' }, m.secret);
  assert.equal((await S.call('/v1/guilds/answer', { character: mem.character, guild: g.id, accept: true }, mem.secret)).status, 200);
  const at = m.at();
  assert.equal((await S.call('/v1/realm/die', { id: at.id, lease: at.lease }, m.secret)).status, 200, 'the master falls for good');
  const rows = S.env.DB._raw.prepare('SELECT char_id, rank FROM guild_members WHERE guild_id = ?').all(g.id);
  assert.deepEqual(rows.map((r) => [r.char_id, r.rank]), [[mem.character, GUILD_RANK_MASTER]], 'the dead\'s place gone, the seat handed on');
  const acted = await S.call('/v1/guilds/invite', { character: m.character, handle: 'memberly' }, m.secret);
  assert.deepEqual([acted.status, acted.body.error], [410, 'dead'], 'a tombstone acts in no guild');
  // a lone dead master's guild, holding nothing, goes - its name and tag free again
  const S2 = await standService();
  const lone = await S2.registered('Lonely', { renown: GUILD_FOUND_RENOWN });
  const g2 = (await S2.found(lone, { name: 'Iron Hounds', tag: 'IRH' })).body.guild;
  const at2 = lone.at();
  await S2.call('/v1/realm/die', { id: at2.id, lease: at2.lease }, lone.secret);
  assert.equal(S2.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM guilds WHERE id = ?').get(g2.id).n, 0, 'gone');
  const again = await S2.registered('Againly', { renown: GUILD_FOUND_RENOWN });
  assert.equal((await S2.found(again, { name: 'Iron Hounds', tag: 'IRH' })).status, 200, 'the name and tag founded again');
  // Renown: the living's tracks alone are held against the bound
  const S3 = await standService();
  const A = await accountOf(S3, 'fam-o5-aaaaaa', 'Hlaalu', ysolde);
  const raw = S3.env.DB._raw;
  for (let i = 0; i < RENOWN_TRACKS_MAX; i++) {
    const id = `r${i.toString(16).padStart(20, '0')}`;
    raw.prepare('INSERT INTO realm_characters (id, player, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at, dead_at) VALUES (?, ?, ?, NULL, 0, 0, NULL, 0, NULL, 1, 1, 5)').run(id, A.g.id, `Dead ${i}`);
    raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, 10, 1, 1)').run(A.g.id, id, `Dead ${i}`);
  }
  const held = raw.prepare(`SELECT ${renownHeldSql('?1')} AS n`).get(A.g.id).n;
  assert.equal(held, 0, 'sixty tombstones\' tracks hold no place');
  const credited = await A.call('/v1/renown/xp', { character: A.chars[1].id, xp: 50, rid: '00000000000000a1' });
  assert.equal(credited.status, 200, `the line's sixty-first character earns its Renown: ${JSON.stringify(credited.body)}`);
  // every door that founds a track asks the one count
  for (const f of ['server-account/src/renownTracks.js', 'server-account/src/raids.js', 'server-account/src/serpents.js', 'server-account/src/seatSiege.js', 'server-account/src/professions.js']) {
    const src = rd(f);
    assert.doesNotMatch(src, /\(SELECT COUNT\(\*\) FROM renown_tracks WHERE player = \?\d\)/, `${f}: never a bare count of every track`);
    assert.match(src, /renownHeldSql\('\?\d+'\)/, f);
  }
});

test('AUDIT LEGACY III O6: A RETIREMENT IS AN ENDURING LINE\'S ALONE, and the tombstone keeps its first word - a Bloodline fall said "retired" kept its union standing with a partner the realm knew was widowed; a retired elder\'s death after ends it', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-o6-aaaaaa', 'Hlaalu', ysolde);   // a Bloodline
  const E = await accountOf(S, 'fam-o6-eeeeee', 'Dres', iszara, { model: 'enduring' });
  const B = await accountOf(S, 'fam-o6-bbbbbb', 'Indoril', [{ id: 1, given: 'Aldo', gender: 'male', race: 'Breton', face: 1 }]);
  await A.half(1, 'wedO6aaa01', B.g.id, B.chars[1].id);
  await B.half(1, 'wedO6aaa01', A.g.id, A.chars[1].id);
  assert.equal((await A.die(1, 'retired')).status, 400, 'a Bloodline\'s character never retires');
  assert.equal((await A.die(1)).status, 200);
  assert.deepEqual([(await B.unions())[0].endedWhy, (await B.unions())[0].endedBy], ['died', 'partner'], 'the widow(er) hears it');
  assert.equal((await A.die(1, 'retired')).status, 400);
  // an Enduring elder retires: the union kept, the word stored - and a retry keeps it
  const C = await accountOf(S, 'fam-o6-cccccc', 'Redoran', [{ id: 1, given: 'Brara', gender: 'female', race: 'DarkElf', face: 1 }]);
  await E.half(1, 'wedO6eee01', C.g.id, C.chars[1].id);
  await C.half(1, 'wedO6eee01', E.g.id, E.chars[1].id);
  assert.equal((await E.die(1, 'retired')).status, 200);
  const why = () => S.env.DB._raw.prepare('SELECT dead_why AS w FROM realm_characters WHERE id = ?').get(E.chars[1].id).w;
  assert.equal(why(), 'retired');
  assert.equal((await C.unions())[0].endedAt, null, 'the elder lives on, wed');
  assert.equal((await E.die(1, 'retired')).status, 200, 'a retry');
  assert.equal(why(), 'retired');
  // ...and the elder's death after: the word moves to 'fell' (its one way) and the union ends
  assert.equal((await E.die(1)).status, 200);
  assert.equal(why(), 'fell');
  assert.deepEqual([(await C.unions())[0].endedWhy, (await C.unions())[0].endedBy], ['died', 'partner']);
  assert.equal((await E.die(1, 'retired')).status, 200);
  assert.equal(why(), 'fell', 'never back');
});

test('AUDIT LEGACY III O7: A TOMBSTONE IS NEVER DELETED - nor undone: it is the realm\'s only word on a death, and its row the person\'s claim, so the person was born again once the line\'s record forgot the death', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-o7-aaaaaa', 'Hlaalu', ysolde);
  await A.die(1);
  for (const route of ['/v1/realm/delete', '/v1/realm/undo']) {
    const r = await A.call(route, { id: A.chars[1].id });
    assert.notEqual(r.status, 200, route);
  }
  const del = await A.call('/v1/realm/delete', { id: A.chars[1].id });
  assert.deepEqual([del.status, del.body.error], [410, 'dead']);
  // one brought in through customs (an origin to undo to) is no more undone than deleted
  S.env.DB._raw.prepare('UPDATE realm_characters SET origin_id = ? WHERE id = ?').run('o-ysolde-offline', A.chars[1].id);
  const undo = await A.call('/v1/realm/undo', { id: A.chars[1].id });
  assert.deepEqual([undo.status, undo.body.error], [410, 'dead']);
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM realm_characters WHERE id = ?').get(A.chars[1].id).n, 1, 'the tombstone stands');
  // the record rewritten without the death: the person is still the played one's
  await A.write({ people: ysolde });
  assert.equal((await A.call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: A.fam, person: 1 })).body.error, 'lineage-played');
  assert.match(rd('server-account/src/realm.js'), /if \(row\.dead_at != null\) return \{ error: 'dead' \};   \/\/ AUDIT LEGACY III O7/);
});

test('AUDIT LEGACY III O8/O9: AN ACCOUNT\'S UNIONS, THE LATEST WORD FIRST, READ BY ITS OWN INDEXES - listed newest-wed first, a union older than fifty others was never listed again and its end never reached the house; and every read scanned the whole table', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-o8-aaaaaa', 'Hlaalu', ysolde);
  const raw = S.env.DB._raw;
  const ins = raw.prepare('INSERT INTO realm_unions (sid, a_player, a_char, b_player, b_char, a_card, b_card, wed_at, ended_at, ended_why, ended_by) VALUES (?, ?, ?, ?, ?, \'{}\', \'{}\', ?, ?, ?, ?)');
  ins.run('wedOld00001', A.g.id, A.chars[1].id, 'acct-other-old', 'r0000000000000000ffff', 10, 9000, 'died', 'r0000000000000000ffff');   // the oldest wedding, ended last
  for (let i = 0; i < 60; i++) ins.run(`wedNew${String(i).padStart(5, '0')}`, A.g.id, `r${String(i).padStart(20, '0')}`, `acct-other-${i}`, `r${String(i + 100).padStart(20, '0')}`, 1000 + i, null, null, null);
  const listed = await listUnions({ db: S.env.DB }, A.g.id);
  assert.equal(listed.length, 50);
  assert.equal(listed[0].sid, 'wedOld00001', 'the end, the newest word, leads');
  assert.deepEqual([listed[0].endedWhy, listed[0].endedBy], ['died', 'partner']);
  const idx = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'realm_unions'").all().map((r) => r.name);
  for (const i of ['realm_unions_ap', 'realm_unions_bp']) assert.ok(idx.includes(i), i);
  const plan = raw.prepare('EXPLAIN QUERY PLAN SELECT * FROM realm_unions WHERE a_player = ? OR b_player = ? ORDER BY COALESCE(ended_at, wed_at) DESC, wed_at DESC LIMIT 50').all('x', 'x').map((r) => r.detail).join(' | ');
  assert.match(plan, /realm_unions_ap/);
  assert.match(plan, /realm_unions_bp/);
  assert.doesNotMatch(plan, /SCAN realm_unions(?! USING)/, `never the whole table: ${plan}`);
});

test('AUDIT LEGACY III W2: THE LINE\'S OWN WORD ON ITS DEAD - a member struck down in the street (nobody played them, no lease to say it) is tombstoned by the write that first carries the death: their union ends, their roster slot frees; the character the realm bound to that person, never the record\'s word on who played them', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-w2-aaaaaa', 'Hlaalu', ysolde, { born: [1, 2] });
  const B = await accountOf(S, 'fam-w2-bbbbbb', 'Dres', iszara);
  await A.join(2);
  await A.half(2, 'wedW2abc01', B.g.id, B.chars[1].id);
  await B.half(1, 'wedW2abc01', A.g.id, A.chars[2].id);
  await A.join(1);   // Ysolde played; Gorbash parked in the family home, wed
  const slain = ysolde.map((p) => (p.id === 2 ? { ...p, died: { at: 50, cause: 'slain', by: 'Ysolde Hlaalu' }, characterId: 'c-not-the-realms' } : p));
  assert.equal((await A.write({ people: slain })).status, 200);
  const row = S.env.DB._raw.prepare('SELECT dead_at, dead_why FROM realm_characters WHERE id = ?').get(A.chars[2].id);
  assert.deepEqual([row.dead_at != null, row.dead_why], [true, 'fell'], 'the realm character the person was born as, by the realm\'s own binding');
  const u = (await B.unions())[0];
  assert.deepEqual([u.endedWhy, u.endedBy], ['died', 'partner'], 'the partner\'s house hears it');
  assert.equal(S.env.DB._raw.prepare('SELECT dead_at FROM realm_characters WHERE id = ?').get(A.chars[1].id).dead_at, null, 'the one played stands');
  assert.equal((await A.call('/v1/realm/join', { id: A.chars[2].id })).body.error, 'dead');
  // a retired elder struck down after: the union kept for the living elder ends
  const E = await accountOf(S, 'fam-w2-eeeeee', 'Redoran', [{ id: 1, given: 'Brara', gender: 'female', race: 'DarkElf', face: 1 }, { id: 2, given: 'Velyn', gender: 'male', race: 'DarkElf', face: 2 }], { model: 'enduring', born: [1, 2] });
  const C = await accountOf(S, 'fam-w2-cccccc', 'Indoril', [{ id: 1, given: 'Aldo', gender: 'male', race: 'Breton', face: 1 }]);
  await E.join(1);
  await E.half(1, 'wedW2eee01', C.g.id, C.chars[1].id);
  await C.half(1, 'wedW2eee01', E.g.id, E.chars[1].id);
  assert.equal((await E.die(1, 'retired')).status, 200);
  assert.equal((await C.unions())[0].endedAt, null);
  // the record says the elder retired, then fell (struck down at home)
  const rec = [{ id: 1, given: 'Brara', retired: 10, died: { at: 90, cause: 'slain' } }, { id: 2, given: 'Velyn' }];
  assert.equal((await E.write({ people: rec })).status, 200);
  assert.deepEqual([(await C.unions())[0].endedWhy, (await C.unions())[0].endedBy], ['died', 'partner'], 'a retired elder\'s death ends the union kept for them');
});

test('AUDIT LEGACY III A2 (the realm\'s half): TWO DEVICES OF ONE ACCOUNT - the line\'s write lands only on the copy it was made from: a device that touched its copy past the stored rev, never having read the other\'s death, is answered stale, and the death stands', async () => {
  const S = await standService();
  const A = await accountOf(S, 'fam-a2-aaaaaa', 'Hlaalu', ysolde);
  const ctx = { db: S.env.DB, nowS: 1000 };
  const rec = (rev, people) => ({ v: 1, id: A.fam, surname: 'Hlaalu', model: 'bloodline', rev, people });
  // device 1 writes the death on the stored rev 1
  assert.deepEqual(await putLineage(ctx, A.g.id, { id: A.fam, record: rec(2, [ysolde[0], { ...ysolde[1], died: { at: 5, cause: 'fell' } }]), base: 1 }), { ok: true, rev: 2 });
  // device 2, made from rev 1 too, touched its copy four times
  const stale = await putLineage(ctx, A.g.id, { id: A.fam, record: rec(5, ysolde), base: 1 });
  assert.equal(stale.error, 'lineage-stale', 'ahead by its own counter, made from nothing it read');
  assert.ok(stale.record.people[1].died, 'answered with the stored record - the death in it, to merge into');
  assert.equal((await putLineage(ctx, A.g.id, { id: A.fam, record: rec(9, ysolde) })).error, 'lineage-stale', 'and a write with no base, over a line that stands');
  // the merge, as the client makes it (realmLine.js mergeLines), on the stale answer's rev: the death stands
  const { mergeLines } = await import('../src/systems/legacy/realmLine.js');
  const merged = mergeLines({ ...rec(5, ysolde), nextId: 3, currentId: 1 }, stale.record);
  merged.rev = 6;
  assert.deepEqual(await putLineage(ctx, A.g.id, { id: A.fam, record: merged, base: stale.rev }), { ok: true, rev: 6 });
  const stored = JSON.parse(S.env.DB._raw.prepare('SELECT record FROM lineages WHERE id = ?').get(A.fam).record);
  assert.ok(stored.people.find((p) => p.id === 2).died, 'the death stands');
  for (const bad of [-1, 1.5, '1', true]) assert.deepEqual(await putLineage(ctx, A.g.id, { id: A.fam, record: rec(10, ysolde), base: bad }), { error: 'body' }, `base ${JSON.stringify(bad)}`);
  assert.match(rd('server-account/src/index.js'), /putLineage\(rctx, me, \{ id: body\.id, record: body\.record, base: body\.base \?\? null \}\)/);
});

test('AUDIT LEGACY III O2/P1: THE LINE\'S ROUTE READS ITS OWN BOUND - every JSON route read 4 KiB, and a played founder\'s first save (some four kilobytes) was refused: the realm held the founding copy for good, an heir never born online. A real line goes through; one past LINEAGE_MAX_BYTES gets its own word, 413, never a malformed body\'s', async () => {
  const S = await standService();
  const g = await S.guest();
  const FAM = 'fam-o2-aaaaaa';
  // a line of many generations, as the family law writes its played members (standing, look, career, stats, skills)
  const member = (id, gen, parents = []) => ({
    id, gen, given: `Member${id}`, surname: 'Hlaalu', gender: id % 2 ? 'female' : 'male', race: 'DarkElf', face: id % 10, parents, children: [], characterId: `c-${id}`,
    stats: { strength: 50, intelligence: 60, willpower: 50, agility: 55, endurance: 50, personality: 70, speed: 50, luck: 50 }, skills: Array.from({ length: 35 }, () => 40),
    standing: { legal: { 17: 20, 18: -5 }, factions: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(100 + i), 10])), regard: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`L${id}.${i}`, 25])) },
    look: { race: 'DarkElf', gender: 'female', faceIndex: 3, items: Array.from({ length: 10 }, (_, i) => ({ t: 102, i: 100 + i, d: 0 })) },
  });
  const people = [];
  for (let gen = 0; gen < 10; gen++) people.push(member(gen * 2 + 1, gen, gen ? [gen * 2 - 1] : []), member(gen * 2 + 2, gen, gen ? [gen * 2 - 1] : []));
  const record = { v: 1, id: FAM, surname: 'Hlaalu', model: 'bloodline', rev: 1, people };
  const bytes = Buffer.byteLength(JSON.stringify({ id: FAM, record }));
  assert.ok(bytes > 4096 * 3, `a real line, well past the old 4 KiB (${bytes} bytes)`);
  const put = await S.call('/v1/realm/lineage', { id: FAM, record }, g.secret);
  assert.deepEqual([put.status, put.body], [200, { ok: true, rev: 1 }]);
  const heir = await S.call('/v1/realm/create', { name: 'Member20 Hlaalu', lineage: FAM, person: 20 }, g.secret);
  assert.equal(heir.status, 200, 'its heir is born online');
  // past the record's bound: its own word, at the shape's door and at the route's
  const ctx = { db: S.env.DB, nowS: 1 };
  assert.deepEqual(await putLineage(ctx, g.id, { id: FAM, record: { ...record, rev: 2, pad: 'x'.repeat(LINEAGE_MAX_BYTES) }, base: 1 }), { error: 'lineage-too-large' });
  const lean = { v: 1, id: FAM, surname: 'Hlaalu', model: 'bloodline', rev: 2, people: [{ id: 1 }] };
  const justOver = await S.call('/v1/realm/lineage', { id: FAM, record: { ...lean, pad: 'x'.repeat(LINEAGE_MAX_BYTES - JSON.stringify(lean).length + 8) }, base: 1 }, g.secret);
  assert.deepEqual([justOver.status, justOver.body.error], [413, 'lineage-too-large'], 'past the record\'s bound, inside the route\'s: the service\'s own word, 413');
  const over = await S.fetch('https://accounts.invalid/v1/realm/lineage', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${g.secret}` }, body: JSON.stringify({ id: FAM, record: { ...record, rev: 2, pad: 'x'.repeat(LINEAGE_BODY_MAX) }, base: 1 }),
  });
  assert.deepEqual([over.status, (await over.json()).error], [413, 'lineage-too-large']);
  assert.equal(LINEAGE_BODY_MAX, LINEAGE_MAX_BYTES + 1024, 'a record at its bound and the write\'s envelope');
  // every other route still reads its 4 KiB
  const big = await S.call('/v1/realm/create', { name: 'x'.repeat(5000) }, g.secret);
  assert.deepEqual([big.status, big.body.error], [400, 'body']);
  assert.match(REFUSALS['lineage-too-large'], /grown past what the realm keeps/);
});

test('AUDIT LEGACY III P15 (the service\'s bounds, by their own doors): a record of more people than LINEAGE_PEOPLE_MAX or a surname past LINEAGE_SURNAME_MAX is no record; a given name the filter refuses is never signed beside the house', () => {
  const FAM = 'fam-p15-aaaaaa';
  const rec = (over) => ({ v: 1, id: FAM, surname: 'Hlaalu', model: 'bloodline', rev: 1, people: [{ id: 1 }], ...over });
  assert.ok(lineageRecordOf(rec({ people: Array.from({ length: LINEAGE_PEOPLE_MAX }, (_, i) => ({ id: i })) }), FAM));
  assert.equal(lineageRecordOf(rec({ people: Array.from({ length: LINEAGE_PEOPLE_MAX + 1 }, (_, i) => ({ id: i })) }), FAM), null);
  assert.ok(lineageRecordOf(rec({ surname: 'H'.repeat(LINEAGE_SURNAME_MAX) }), FAM));
  assert.equal(lineageRecordOf(rec({ surname: 'H'.repeat(LINEAGE_SURNAME_MAX + 1) }), FAM), null);
  assert.deepEqual(houseOn(JSON.stringify(rec({ people: [{ id: 1, given: 'Admin' }] })), 1), { hn: 'Hlaalu', hb: 1 }, 'the house, never the refused given name');
  assert.deepEqual(houseOn(JSON.stringify(rec({ people: [{ id: 1, given: 'Ysolde' }] })), 1), { hn: 'Hlaalu', hc: 'Ysolde', hb: 1 });
});

// ─── THE DEVICE'S REALM LINE, AND THE STORE'S MERGE ────────────────────────────────────────────────────────────────

const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
/** A played character (the save's entity), as the lens A harness made them. */
const ent = (name, cid, over = {}) => ({
  name, gender: 'female', race: 'DarkElf', faceIndex: 2, level: 4, chargenDone: true, characterId: cid, health: 40, maxHealth: 40,
  items: [], wagonItems: [],
  stats: { strength: 50, intelligence: 60, willpower: 50, agility: 55, endurance: 50, personality: 70, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 1 ? 40 : 20)),
  career: { name: 'Bard', primarySkills: [1], majorSkills: [2], minorSkills: [3] }, careerIndex: 1,
  ...over,
});
const clone = (x) => JSON.parse(JSON.stringify(x));

/** A device of account `g`: its storage and its realm line over the REAL Worker, by realmSaves.js's own requests; each
 *  line write it sent (`{ rev, base }`), each refusal it was told; `offline` drops its requests on the floor. */
function deviceOf(S, g) {
  const d = { storage: mem(), sent: [], told: [], offline: false };
  const io = {
    secret: g.secret, base: 'https://accounts.invalid', storage: mem(),
    fetch: async (u, init) => {
      if (d.offline) throw new TypeError('offline');
      if (new URL(u).pathname === '/v1/realm/lineage') { const b = JSON.parse(String(init.body)); d.sent.push({ rev: b.record.rev, base: b.base ?? null }); }
      return S.fetch(u, init);
    },
  };
  d.line = createRealmLine({ io: () => io, storage: () => d.storage, onRefused: (id, error) => d.told.push(error) });
  return d;
}

test('AUDIT LEGACY III A2/O2/P1/P15 (the device\'s half): THE REALM LINE AT THE REAL WORKER - every write made from the service\'s rev the device last read or wrote, so a device that ran its own counter past the store, never having read the other device\'s death, is answered stale and takes it in; the record the realm holds from here is never sent again; the NEWEST record waits on the network, never an older one; a record the realm refuses for its own sake is said once, never sent again, and flush says so', async () => {
  const S = await standService();
  const g = await S.guest();
  const one = deviceOf(S, g), two = deviceOf(S, g);
  const fam = foundFamily(ent('Ysolde Hlaalu', 'c-ysolde'), { model: MODELS.bloodline, rng: familyRng(3), id: 'fam-l3a2-aaaaaa' });
  addChild(fam, 1, { rng: familyRng(4) });
  storeFamily(one.storage, fam);
  one.line.push(fam);
  assert.equal(await one.line.flush(), true);
  const founded = fam.rev;
  assert.deepEqual((await two.line.pull()).ids, [fam.id], 'the second device reads the line');
  // the first device: the founder falls - written from the rev it wrote
  const a = loadFamily(one.storage, fam.id);
  recordDeath(a, 1, { at: 50, cause: 'fell' });
  touch(a);
  storeFamily(one.storage, a);
  one.line.push(a);
  assert.equal(await one.line.flush(), true);
  assert.deepEqual(one.sent.map((s) => s.base), [null, founded], 'founded here with no base; the death made from the rev it wrote');
  one.line.push(a);
  await one.line.flush();
  assert.equal(one.sent.length, 2, 'the record the realm holds from here is not written again (a storage that refuses retries every tick: legacyHost.js store)');
  // the second, never having read the death, runs its own counter past the stored rev
  const b = loadFamily(two.storage, fam.id);
  for (let i = 0; i < 3; i++) touch(b);
  assert.ok(b.rev > a.rev, 'its counter ahead of the store');
  storeFamily(two.storage, b);
  two.line.push(b);
  assert.equal(await two.line.flush(), true);
  assert.equal(two.sent[0].base, founded, 'made from the rev it read');
  assert.equal(two.sent.length, 2, 'answered stale, merged, written again on the stale answer\'s rev');
  const realmOf = async () => readFamily((await S.call('/v1/realm/lineages', {}, g.secret)).body.lineages[0].record);
  assert.equal((await realmOf()).people[0].died?.cause, 'fell', 'the death stands at the realm');
  assert.equal(loadFamily(two.storage, fam.id).people[0].died?.cause, 'fell', 'and the second device holds it');
  // the network down: the newest record waits, never an older one
  two.offline = true;
  const c = loadFamily(two.storage, fam.id);
  noteSeen(c, c.rev);
  touch(c);
  storeFamily(two.storage, c);
  two.line.push(c);
  assert.equal(await two.line.flush(), false, 'unwritten while the network is down');
  assert.equal(two.line.unwrittenOf(fam.id), 'offline', 'the birth door reads why (world.js realmCreateLegacy)');
  recordDeath(c, 2, { at: 60, cause: 'slain' });
  touch(c);
  storeFamily(two.storage, c);
  two.line.push(c);
  two.offline = false;
  assert.equal(await two.line.flush(), true);
  assert.equal(two.line.unwrittenOf(fam.id), null);
  assert.equal((await realmOf()).people.find((p) => p.id === 2).died?.cause, 'slain', 'the newest record written - the older one that waited was replaced');
  // a line past the realm's bound: its own refusal, said once, never sent again this session
  const big = loadFamily(two.storage, fam.id);
  noteSeen(big, big.rev);
  for (let i = 0; i < 260; i++) addChild(big, 2, { rng: familyRng(100 + i) });
  assert.ok(JSON.stringify(big).length > LINEAGE_MAX_BYTES, 'a line grown past the bound');
  storeFamily(two.storage, big);
  const sent = two.sent.length;
  two.line.push(big);
  assert.equal(await two.line.flush(), false, 'flush says the line does not stand at the realm as written');
  assert.deepEqual(two.told, ['lineage-too-large'], 'said once, in its own word');
  assert.equal(two.line.refusalOf(fam.id), 'lineage-too-large');
  assert.equal(two.line.unwrittenOf(fam.id), 'lineage-too-large', 'the birth door says the line\'s refusal, never the birth\'s');
  touch(big);
  storeFamily(two.storage, big);
  two.line.push(big);
  assert.equal(await two.line.flush(), false);
  assert.equal(two.sent.length, sent + 1, 'never sent again this session');
  assert.deepEqual(two.told, ['lineage-too-large'], 'nor said again');
});

test('AUDIT LEGACY III A2 (the store\'s half): EVERY WRITE RENEWS WHAT THE COPY WAS MADE FROM - a page\'s second write is made from its first, so it is never merged with its own older self (a deed sold would come back: houses are only ever added); a write made while the realm\'s stale answer was on its way is merged into, never written over', async () => {
  const f = foundFamily(ent('Ysolde Hlaalu', 'c-ysolde'), { model: MODELS.bloodline, rng: familyRng(11), id: 'fam-a2s-aaaaaa' });
  f.houses = [{ regionIndex: 17, mapId: 5001, buildingKey: 900, location: 'Sentinel', by: 1 }, { regionIndex: 17, mapId: 5002, buildingKey: 901, location: 'Gothway Garden', by: 1 }];
  const st = mem();
  storeFamily(st, f);
  const page = loadFamily(st, f.id);
  noteSeen(page, page.rev);
  touch(page);
  assert.equal(storeFamily(st, page), true, 'its first write');
  page.houses.pop();   // the second house sold
  touch(page);
  storeFamily(st, page);
  assert.equal(loadFamily(st, f.id).houses.length, 1, 'the house sold stays sold');
  // the realm's stale answer lands after the page wrote again: the merge is written over the device's copy as it was
  // pushed, so the page's newer write is taken in
  const dev = mem();
  const local = readFamily(clone(f));
  storeFamily(dev, local);
  const realm = readFamily(clone(f));
  realm.rev = 50;
  recordDeath(realm, 1, { at: 9, cause: 'fell' });
  let calls = 0;
  const line = createRealmLine({
    io: () => ({}), storage: () => dev,
    put: async (io, id, rec) => {
      if (++calls === 1) {
        const later = loadFamily(dev, f.id);
        noteSeen(later, later.rev);
        later.seat = { region: 'Daggerfall', loc: 'Sentinel' };
        touch(later);
        storeFamily(dev, later);
        return { ok: false, error: 'lineage-stale', data: { rev: realm.rev, record: clone(realm) } };
      }
      return { ok: true, data: { rev: rec.rev } };
    },
  });
  line.push(local);
  assert.equal(await line.flush(), true);
  const held = loadFamily(dev, f.id);
  assert.equal(held.people[0].died?.cause, 'fell', 'the realm\'s death taken in');
  assert.equal(held.seat?.loc, 'Sentinel', 'and the write made meanwhile kept');
});

test('AUDIT LEGACY III A3/P3: TWO COPIES THAT EACH MINTED A PERSON KEEP BOTH - ids come from each copy\'s own counter, and the merge matched by id alone: a member was wed to another member\'s newborn, and a spouse lost. Merged both ways, each person stands with their own id and every link names them; online the realm\'s ids stand (its births name their person by id), whichever copy is newer', () => {
  const base = foundFamily(ent('Ysolde Hlaalu', 'c-ysolde'), { model: MODELS.bloodline, rng: familyRng(5), id: 'fam-a3-aaaaaa' });
  const sib = addChild(base, null, { rng: familyRng(6) }).person;
  sib.parents = []; sib.gen = 0; sib.given = 'Mirel'; sib.characterId = 'c-mirel';
  const A = readFamily(clone(base)), B = readFamily(clone(base));
  // copy A: the founder weds a townsperson and has a child by them; copy B: the sibling has two children - each copy
  // minted its two under the same two ids
  const spouse = wed(A, personOf(A, 1), { id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, mapId: 120 }, 100);
  const ours = addChild(A, 1, { rng: familyRng(17), at: 150 }).person;
  const kid = addChild(B, sib.id, { rng: familyRng(7), at: 200 }).person;
  const kid2 = addChild(B, sib.id, { rng: familyRng(27), at: 250 }).person;
  assert.deepEqual([spouse.id, ours.id], [kid.id, kid2.id], 'two ids, four people');
  const holds = (M, why) => {
    const s = M.people.find((p) => p.kind === 'resident' && p.residentId === 'L120.4');
    const o = M.people.find((p) => p.kind === 'member' && p.born === 150);
    const k = M.people.find((p) => p.kind === 'member' && p.born === 200);
    const k2 = M.people.find((p) => p.kind === 'member' && p.born === 250);
    assert.ok(s && o && k && k2, `${why}: all four stand`);
    assert.equal(new Set([s.id, o.id, k.id, k2.id]).size, 4, why);
    assert.equal(personOf(M, 1).spouse, s.id, `${why}: the founder's spouse is the townsperson`);
    assert.equal(s.spouse, 1, why);
    assert.deepEqual([...o.parents].sort(), [1, s.id].sort(), `${why}: the founder's child is the townsperson's`);
    assert.deepEqual(personOf(M, 1).children, [o.id], `${why}: and the founder's alone`);
    assert.deepEqual([k.spouse ?? null, k2.spouse ?? null], [null, null], `${why}: the sibling's children wed to nobody`);
    assert.deepEqual([...personOf(M, sib.id).children].sort(), [k.id, k2.id].sort(), `${why}: the sibling's children are theirs`);
    assert.equal(new Set(M.people.map((p) => p.id)).size, M.people.length, `${why}: ids distinct`);
    assert.ok(M.nextId > Math.max(...M.people.map((p) => p.id)), `${why}: the counter past both`);
    return { s, k };
  };
  holds(mergeFacts(readFamily(clone(A)), readFamily(clone(B))), 'A merged with B');
  holds(mergeFacts(readFamily(clone(B)), readFamily(clone(A))), 'B merged with A');
  // the store's ids stand: a stale write takes them in (storeFamily)
  const st = mem();
  storeFamily(st, readFamily(clone(B)));
  const tab = readFamily(clone(A));
  noteSeen(tab, base.rev);
  storeFamily(st, tab);
  assert.equal(holds(loadFamily(st, base.id), 'the store').k.id, kid.id, 'the stored copy\'s child keeps its id');
  // online: the realm's ids stand, whichever copy is the newer
  for (const ahead of ['device', 'realm']) {
    const dev = readFamily(clone(A)), realm = readFamily(clone(B));
    for (let i = 0; i < 5; i++) touch(ahead === 'device' ? dev : realm);
    const { k } = holds(mergeLines(dev, realm), `the ${ahead} ahead`);
    assert.equal(k.id, kid.id, `the ${ahead} ahead: the realm's child keeps the id its births name it by`);
  }
  // one person is one: the same kind, born at the same minute of the same parents - two children of one minute and of
  // other parents, or of one parent at other minutes, are two
  for (const [pa, pb, ma, mb] of [[1, sib.id, 300, 300], [1, 1, 300, 400]]) {
    const X = readFamily(clone(base)), Y = readFamily(clone(base));
    addChild(X, pa, { rng: familyRng(31), at: ma });
    addChild(Y, pb, { rng: familyRng(32), at: mb });
    const M = mergeFacts(readFamily(clone(X)), readFamily(clone(Y)));
    assert.equal(M.people.filter((p) => p.gen === 1).length, 2, `children of ${pa}@${ma} and ${pb}@${mb}: two`);
  }
});

test('AUDIT LEGACY III P5: A STALE COPY KEEPS ITS OWN WORD ABOUT NOBODY - what a member\'s own save writes of them (where they are parked, what they wear, their standing) comes from the copy that saved them LAST (`savedAt`), and a wedding made after the stale copy\'s spouse died stands: a stale tab unwed a member wed again, and parked them nowhere', () => {
  const base = foundFamily(ent('Ysolde Hlaalu', 'c-ysolde'), { model: MODELS.bloodline, rng: familyRng(8), id: 'fam-p5-aaaaaa' });
  wed(base, personOf(base, 1), { id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, mapId: 120 }, 100);
  personOf(base, 1).savedAt = 1000;
  const st = mem();
  storeFamily(st, base);
  const one = loadFamily(st, base.id), two = loadFamily(st, base.id);
  noteSeen(one, one.rev); noteSeen(two, two.rev);
  // tab one: the spouse dies, the member weds again, and is saved in the family home
  const m = personOf(one, 1);
  recordDeath(one, m.spouse, { at: 300, cause: 'fell' });
  const second = wed(one, m, { id: 'L77.2', name: 'Iszara Dres', sex: 'female', race: 'Redguard', face: 40, mapId: 77 }, 500);
  m.parked = { mapId: 77, buildingKey: 900 };
  m.look = { race: 'DarkElf', gender: 'female', faceIndex: 2, items: [] };
  m.savedAt = 2000;
  touch(one);
  storeFamily(st, one);
  // tab two, stale: writes the member as it last knew them
  personOf(two, 1).parked = null;
  touch(two); touch(two); touch(two);
  storeFamily(st, two);
  const kept = personOf(loadFamily(st, base.id), 1);
  assert.equal(kept.spouse, second.id, 'the second wedding stands');
  assert.equal(kept.wedAt, 500);
  assert.deepEqual(kept.parked, { mapId: 77, buildingKey: 900 }, 'parked where the member\'s newest save was made');
  assert.ok(kept.look, 'and wearing what they wore');
  assert.equal(kept.savedAt, 2000);
  // and the other way: the newer save's word stands over an older one's, never the copy's rev
  const three = loadFamily(st, base.id);
  noteSeen(three, three.rev - 5);
  personOf(three, 1).parked = { mapId: 1, buildingKey: 2 };
  personOf(three, 1).savedAt = 1500;
  storeFamily(st, three);
  assert.deepEqual(personOf(loadFamily(st, base.id), 1).parked, { mapId: 77, buildingKey: 900 }, 'an older save\'s word on the member does not stand');
});

test('AUDIT LEGACY III P12: THE MERGES\' OWN ARMS, AND THE BOUNDS ON WHAT IS WRITTEN - the boot\'s pull of an identical copy keeps the house\'s news whole and distinct; two copies\' news keep the newest NEWS_MAX; a standing, a child clock and a wedding\'s minute either copy holds stand; a save carries the REGARDS_KEPT strongest regards', () => {
  const f = foundFamily(ent('Ysolde Hlaalu', 'c-ysolde'), { model: MODELS.bloodline, rng: familyRng(9), id: 'fam-p12-aaaaaa' });
  f.news = Array.from({ length: NEWS_MAX }, (_, i) => ({ k: 'born', who: `Child ${i}`, t: 1000 + i, m: 5 }));
  const pulled = mergeLines(clone(f), clone(f));
  assert.equal(pulled.news.length, NEWS_MAX, 'an identical realm copy pulled at the boot');
  assert.equal(new Set(pulled.news.map((n) => n.who)).size, NEWS_MAX, 'every piece once');
  // a record holding more than its bound (a damaged one, a hand-written one) is read as its newest NEWS_MAX
  const read = readFamily({ ...clone(f), news: Array.from({ length: NEWS_MAX + 6 }, (_, i) => ({ k: 'born', who: `Old ${i}`, t: 100 + i, m: 5 })) }).news;
  assert.equal(read.length, NEWS_MAX);
  assert.equal(read[0].who, 'Old 6', 'the newest kept (LP-news-read-keeps-oldest)');
  const later = Array.from({ length: NEWS_MAX }, (_, i) => ({ k: 'died', who: `Elder ${i}`, t: 5000 + i, m: 5 }));
  const both = mergeNews(f.news, later);
  assert.equal(both.length, NEWS_MAX, 'two copies\' news, the newest NEWS_MAX');
  assert.ok(both.every((n) => n.k === 'died'));
  // two copies of one minute's news at the cap keep the same NEWS_MAX, whichever merged first (P17)
  const x = Array.from({ length: NEWS_MAX }, (_, i) => ({ k: 'born', who: `Ann ${i}`, t: 9000, m: 5 }));
  const y = Array.from({ length: NEWS_MAX }, (_, i) => ({ k: 'born', who: `Bel ${i}`, t: 9000, m: 5 }));
  assert.deepEqual(mergeNews(x, y), mergeNews(y, x), 'one order, so one set');
  // a stale copy that never saw the standing, the child clock or a wedding's minute
  wed(f, personOf(f, 1), { id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, mapId: 120 }, 100);
  const sib = addChild(f, null, { rng: familyRng(10) }).person;
  sib.parents = []; sib.gen = 0;
  const st = mem();
  storeFamily(st, f);
  const one = loadFamily(st, f.id), two = loadFamily(st, f.id);
  noteSeen(one, one.rev); noteSeen(two, two.rev);
  const m = personOf(one, 1);
  m.standing = { legal: { 17: 20 }, factions: {}, regard: {} };
  m.childDay = 37;
  wed(one, personOf(one, sib.id), { id: 'L77.2', name: 'Iszara Dres', sex: 'female', race: 'Redguard', face: 40, mapId: 77 }, 288000);
  touch(one);
  storeFamily(st, one);
  touch(two); touch(two); touch(two);
  storeFamily(st, two);
  const kept = loadFamily(st, f.id);
  assert.deepEqual(personOf(kept, 1).standing?.legal, { 17: 20 }, 'the standing either copy saved');
  assert.equal(personOf(kept, 1).childDay, 37, 'the child clock of a wedding both copies hold');
  assert.equal(personOf(kept, sib.id).wedAt, 288000, 'a wedding\'s minute, with its spouse');
  // the regard a save carries, bounded where it is written
  const regards = { entries: () => Array.from({ length: 100 }, (_, i) => ({ id: `L1.${i}` })), regard: (id) => 20 + Number(id.split('.')[1]) };
  assert.equal(Object.keys(memberStanding(ent('X', 'c-x'), regards, 0).regard).length, REGARDS_KEPT);
});

// ─── THE FAMILY LAW AND THE HOST, PAGE BY PAGE ─────────────────────────────────────────────────────────────────────

const DAY = 1440;
/** A house's world: one app storage and one tab storage shared by every page, the game's saves (newest last); its
 *  Features tile's settings as asked. */
function houseWorld({ siblings = 0, max = 1, always = false } = {}) {
  _resetModSaveData(); _resetModSettings();
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', siblings);
  setModSetting(LEGACY_MOD, 'Family.Max Siblings', max);
  if (always) setModSetting(LEGACY_MOD, 'Family.Descendants', 1);
  return { storage: mem(), tab: mem(), saves: [] };
}
/** One PAGE: the REAL host over the shared storage (lens A's harness) - `w.own`/`w.now`/`w.sky` its clocks, `w.temple`
 *  the temple it stands in (a town's map id, or null), `w.town` the town it stands in, `w.rng` its dice (swappable),
 *  `w.online` whether it plays online. */
function page(shared, entity, over = {}) {
  const w = { said: [], asked: [], own: over.own ?? 10 * DAY, now: over.now ?? 10 * DAY, sky: over.sky ?? null, temple: null,
    town: 'town' in over ? over.town : { region: 'Daggerfall', loc: 'Ashbury', mapId: 120 }, booted: [], entity, shared,
    online: false, rng: over.rng ?? familyRng(9) };
  const deps = {
    entity, storage: () => shared.storage, tab: () => shared.tab, on: () => true, online: () => w.online,
    now: () => w.now, own: () => w.own, sky: () => (w.sky ?? w.now),
    here: () => ({ pixel: { x: 1, y: 1 }, region: w.town?.region ?? 'Daggerfall', mode: w.temple != null ? 'interior' : 'exterior', loc: w.town?.loc ?? null, locationType: 0, mapId: w.town?.mapId ?? null }),
    town: (h) => (h?.loc && w.town ? { ...w.town } : null),
    nearestTown: () => ({ region: 'Daggerfall', loc: 'Ashbury' }), gold: () => 100, say: (l) => w.said.push(l),
    boot: (search) => w.booted.push(search), search: () => '?world',
    loadCharacter: (cid) => { const has = shared.saves.some((x) => x.cid === cid); if (has) w.booted.push(`load:${cid}`); return has; },
    saveNow: () => { shared.saves.push({ cid: String(entity.characterId), rec: clone(modSaveRecords().ProjectLegacy) }); return true; },
    hasSave: (cid) => shared.saves.some((x) => x.cid === cid),
    inFight: () => false, rng: () => w.rng(), livingWorld: () => true,
    templeOf: () => w.temple,
    askWed: (name, house, done) => { w.asked.push([name, house]); w.done = done; return true; },
    payEstate: () => {}, giveItems: () => {},
    ...over.deps,
  };
  w.deps = deps;
  w.host = createLegacyHost(deps);
  return w;
}
const newestSave = (shared, cid) => [...shared.saves].reverse().find((x) => x.cid === cid)?.rec ?? null;
/** `cid`'s newest save loaded on a new page (the switch's load, the menu's Load). */
function loadPage(shared, entity, over = {}) {
  _resetModSaveData();
  const w = page(shared, entity, over);
  restoreModSaveRecords({ ProjectLegacy: clone(newestSave(shared, String(entity.characterId))) });
  return w;
}
/** A member born on a new page (the boot's ?legacyborn: takeBorn, the new game's records, the seam's entity, onBorn). */
function bornPage(shared, person, cid, over = {}) {
  _resetModSaveData();
  const e = ent('', null, { chargenDone: false });
  const w = page(shared, e, over);
  w.taken = w.host.takeBorn(person.id);
  newGameModSaveRecords();
  Object.assign(e, { name: fullNameOf(person.given, person.surname), gender: person.gender, race: person.race, chargenDone: true, characterId: cid });
  w.host.onBorn();
  return w;
}
const COURT_CTX = Object.freeze({ regard: FRIEND_AT, personality: 100, etiquette: 100, townName: 'Ashbury' });
/** The resident courted day by day through the real Tell me about rows until betrothed. Answers the proposal's words,
 *  or the rows offered when there is nothing to court. */
function courtToBetrothal(w, res, ctx = COURT_CTX) {
  for (let i = 0; i < 60; i++) {
    const rows = w.host.topicRows(res, ctx);
    const row = rows.find((r) => r.label === 'Courtship' || r.label === 'Marriage');
    if (!row) return rows.map((r) => r.label);
    const said = row.legacy.answer(0);
    if (row.label === 'Marriage') return said;
    w.own += DAY; w.now += DAY;
  }
  return 'never';
}
const ALDO = Object.freeze({ id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, town: 120, roll: 'h' });
const SEAT = Object.freeze({ region: 'Daggerfall', loc: 'Ashbury', mapId: 120 });

test('AUDIT LEGACY III A1: ONE TOWNSPERSON, ONE SPOUSE - two members of the house courted one townsperson to a betrothal each and both wed them: one census id, two spouse persons. The sibling is offered nothing of one betrothed to another of the house; the first wedding ends every member\'s courtship of them; a page that still holds the other betrothal is told so at the temple; `wed` never takes one of the house again', () => {
  const shared = houseWorld({ siblings: 100, max: 1 });
  const A = page(shared, ent('Ysolde Hlaalu', 'cA'));
  A.host.found(MODELS.enduring);
  const f = A.host.family;
  const sib = f.people.find((p) => p.id !== f.currentId && p.kind === 'member');
  assert.ok(sib, 'a sibling rolled at the founding');
  assert.match(String(courtToBetrothal(A, ALDO)), /says yes/);
  assert.deepEqual(topicsFor(f, sib, ALDO, FRIEND_AT), [], 'nothing between the sibling and a townsperson betrothed to another');
  // a record from before the law, both betrothed to them: the first wedding ends the other's courtship with it
  sib.courting = { [ALDO.id]: clone(currentOf(f).courting[ALDO.id]) };
  A.temple = ALDO.town; A.host.tick();
  assert.equal(A.asked.length, 1);
  A.done(false);
  assert.equal(f.people.filter((p) => p.kind === 'resident' && p.residentId === ALDO.id).length, 1);
  assert.equal(sib.courting[ALDO.id], undefined, 'the sibling\'s betrothal is over with the wedding');
  assert.deepEqual(topicsFor(f, sib, ALDO, FRIEND_AT), [], 'one of the house: nothing to court (P14 LP-court-another-members-spouse)');
  assert.equal(wed(f, sib, { id: ALDO.id, name: ALDO.name, mapId: 120 }, 5), null, '`wed` never takes one of the house again');
  // a page made before the wedding still holds the sibling's betrothal: its temple asks, the wedding is refused, said
  A.temple = null; A.host.tick();
  assert.equal(A.host.switchTo(sib.id).ok, true);
  const B = bornPage(shared, sib, 'cB');
  const me = currentOf(B.host.family);
  me.courting = { [ALDO.id]: { name: ALDO.name, mapId: 120, town: 'Ashbury', affection: 100, day: 0, betrothed: true, sex: 'male', race: 'Breton', face: 312 } };
  B.temple = ALDO.town; B.host.tick();
  assert.equal(B.asked.length, 1, 'its temple asks');
  B.done(false);
  assert.equal(B.host.family.people.filter((p) => p.kind === 'resident' && p.residentId === ALDO.id).length, 1, 'never a second spouse');
  assert.equal(me.courting[ALDO.id], undefined, 'the betrothal forgotten');
  assert.ok(B.said.includes(LEGACY_TEXT.wedElsewhere('Aldo')), 'and said');
  // a dead member's betrothal holds nobody back
  const g = foundFamily(ent('Ilmar Hlaalu', 'cI', { gender: 'male' }), { model: MODELS.enduring, rng: familyRng(2), id: 'fam-a1-gggggg' });
  const s2 = addChild(g, null, { rng: familyRng(3) }).person;
  s2.parents = []; s2.gen = 0;
  personOf(g, 1).courting = { [ALDO.id]: { name: ALDO.name, mapId: 120, town: 'Ashbury', affection: 100, day: 0, betrothed: true } };
  assert.deepEqual(topicsFor(g, s2, ALDO, FRIEND_AT), []);
  recordDeath(g, 1, { at: 9, cause: 'fell' });
  assert.deepEqual(topicsFor(g, s2, ALDO, FRIEND_AT), ['court'], 'the betrothed dead, the townsperson may be courted again');
});

test('AUDIT LEGACY III A2 (the host): TWO TABS OF ONE BLOODLINE - a write made from what it read: a tab one rev behind that had a child (childStep, addChild, the news: three touches) counted as "ahead" and erased the other tab\'s permadeath and its waiting Succession, and the dead loaded and played on. The death stands; the born heir\'s page, made from the store as its birth read it, takes in a write made meanwhile; a save\'s copy newer than the store takes the store\'s facts in', () => {
  const shared = houseWorld({ siblings: 100, max: 1 });
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'));
  X.host.found(MODELS.bloodline);
  const xId = X.host.family.currentId;
  const yId = X.host.family.people.find((p) => p.id !== xId).id;
  courtToBetrothal(X, ALDO);
  X.temple = ALDO.town; X.host.tick(); X.done(false); X.temple = null;
  assert.equal(X.host.switchTo(yId).ok, true);
  const tabA = bornPage(shared, personOf(X.host.family, yId), 'cY', { own: 5 * DAY, now: 5 * DAY });
  tabA.deps.saveNow();
  const yEnt = { ...tabA.entity };
  const tabB = loadPage(shared, ent('Ysolde Hlaalu', 'cX'), { own: X.own, now: X.now, rng: () => 0 });
  tabA.host.onDeath();   // Y falls for good in tab A: the Succession waits on the record
  assert.equal(tabA.host.succeed({ newborn: true }), true);
  const heir = currentOf(loadFamily(shared.storage, X.host.family.id));
  // the heir's page reads the birth...
  _resetModSaveData();
  const He = ent('', null, { chargenDone: false });
  const H = page(shared, He, { own: 0, now: 6 * DAY });
  assert.ok(H.host.takeBorn(heir.id));
  // ...while tab B's month passes: a child for X, and its write
  tabB.own += 31 * DAY; tabB.now += 31 * DAY; tabB.host.tick();
  assert.match(tabB.said.at(-1), /A child is born/);
  const kid = tabB.host.family.people.find((p) => p.minor);
  let s = loadFamily(shared.storage, tabB.host.family.id);
  assert.equal(personOf(s, yId).died?.cause, 'fell', 'the death stands');
  assert.equal(s.pending?.fallenId, yId, 'and its Succession waits');
  assert.ok(personOf(s, kid.id), 'the child written');
  // the heir lands: their write takes in the child written since their birth was read
  newGameModSaveRecords();
  Object.assign(He, { name: fullNameOf(heir.given, heir.surname), gender: heir.gender, race: heir.race, chargenDone: true, characterId: 'cH' });
  H.host.onBorn();
  s = loadFamily(shared.storage, H.host.family.id);
  assert.ok(personOf(s, kid.id), 'X\'s child stands after the heir\'s first write');
  assert.equal(personOf(s, heir.id).characterId, 'cH');
  assert.equal(s.pending, null, 'the Succession answered by the heir');
  // Y's own save loaded: the past - nothing of it written, the line's heir offered
  const back = loadPage(shared, yEnt, { own: 6 * DAY, now: 6 * DAY });
  assert.equal(back.host.past?.id, yId);
  // a save's copy newer than the store's (another device's, a store cleared) takes the store's facts in
  const st = readFamily(clone(s));
  const sv = readFamily(clone(s));
  recordDeath(st, xId, { at: 70, cause: 'slain' });
  sv.rev = st.rev + 9;
  assert.equal(personOf(mergeFamily(st, sv, 'cH'), xId).died?.cause, 'slain', 'the store\'s death in the save\'s newer copy');
});

test('AUDIT LEGACY III A4/P2/P9: THE LEGACY5 RECORD ACROSS A LOAD - a courtship keeps who it is with (a load minted every spouse a male Breton with no face: "Your husband." to a Khajiit wife), its affection and its betrothal; a spouse their town; a child clock its count through every reload; a minor their age', () => {
  const shared = houseWorld();
  const R = Object.freeze({ id: 'L77.9', name: "Ri'Zahra Tharn", sex: 'female', race: 'Khajiit', face: 405, town: 77, roll: 'h' });
  const ctx = { ...COURT_CTX, townName: 'Gothway Garden' };
  const who = () => ent('Ysolde Hlaalu', 'cA', { gender: 'male' });
  const A = page(shared, who());
  A.host.found(MODELS.enduring);
  A.host.topicRows(R, ctx)[0].legacy.answer(0);   // the first day's courtship
  const affection = currentOf(A.host.family).courting[R.id].affection;
  assert.ok(affection > 0);
  A.deps.saveNow();
  const L = loadPage(shared, who(), { own: 11 * DAY, now: 11 * DAY });
  const c = currentOf(L.host.family).courting[R.id];
  assert.ok(c, 'the courtship kept (P9 LP-read-courting-dropped)');
  assert.equal(c.affection, affection);
  assert.deepEqual([c.sex, c.race, c.face], ['female', 'Khajiit', 405], 'who it is with (A4/P2)');
  assert.match(String(courtToBetrothal(L, R, ctx)), /says yes/);
  L.deps.saveNow();
  const M = loadPage(shared, who(), { own: L.own, now: L.now, rng: () => 0 });
  M.temple = R.town; M.host.tick();
  assert.equal(M.asked.length, 1, 'the betrothal stood through the load: the temple asks (P9 LP-read-betrothal-dropped)');
  M.done(false); M.temple = null;
  const sp = M.host.family.people.find((p) => p.kind === 'resident');
  assert.deepEqual([sp.gender, sp.race, sp.residentFace], ['female', 'Khajiit', 405], 'the spouse is who was courted');
  const census = { ...R, home: 77, archive: 385, variant: 0, job: 'crafter' };
  const censusOf = (id) => (id === R.id ? census : null);
  const [res] = M.host.residentsOf(R.town, () => 0, censusOf);
  assert.equal(M.host.kinOfResident(res)?.is, 'Your wife.');
  // the child clock counts from the wedding through every reload (P9 LP-read-childDay-dropped)
  const wedDay = Math.floor(M.own / DAY);
  M.deps.saveNow();
  for (const d of [10, 20]) {
    const P = loadPage(shared, who(), { own: (wedDay + d) * DAY, now: (wedDay + d) * DAY, rng: () => 0 });
    P.host.tick();
    assert.ok(!P.host.family.people.some((p) => p.minor), `no child ${d} days on`);
    P.deps.saveNow();
  }
  const N = loadPage(shared, who(), { own: (wedDay + 31) * DAY, now: (wedDay + 31) * DAY, rng: () => 0 });
  N.host.tick();
  const kid = N.host.family.people.find((p) => p.minor);
  assert.ok(kid, 'a month from the wedding, whatever the loads between');
  N.deps.saveNow();
  const O = loadPage(shared, who(), { own: (wedDay + 32) * DAY, now: (wedDay + 32) * DAY });
  assert.equal(O.host.switchRefusal(kid.id), LEGACY_TEXT.minor(kid.given), 'a child yet, after a load (P9 LP-read-minor-dropped)');
  assert.equal(personOf(O.host.family, sp.id).residentFace, 405, 'her own face through every load - the portrait reads it now (P17, LP-read-residentFace-dropped)');
  assert.ok(O.host.residentsOf(R.town, () => 0, censusOf).some((r) => r.legacy?.personId === sp.id), 'the spouse stands in her own town after a load (P9 LP-read-spouse-town-dropped)');
});

test('AUDIT LEGACY III A5/F1: THE CADET BRANCH GOES ON - a member who took a lore surname founds a cadet branch (Legacy-Arc section 5, the mod\'s GetSurname(parent.Name)), and their children carry it: every one of them came back under the house\'s name. Said, at the Succession and at a child\'s own birth, against the line it left', () => {
  let found = null;
  for (let seed = 1; seed < 500 && !found; seed++) {
    const shared = houseWorld({ always: true });
    const P = page(shared, ent('Ysolde Hlaalu', `c${seed}`, { race: 'Breton' }), { rng: familyRng(seed) });
    P.host.found(MODELS.bloodline);
    P.host.onDeath();
    P.host.succeed({ newborn: true });
    const heir = currentOf(P.host.family);
    if (heir.surname !== P.host.family.surname) found = { shared, P, heir };
  }
  assert.ok(found, 'a newborn heir who took a lore surname');
  const { shared, P, heir } = found;
  assert.ok(P.said.includes(LEGACY_TEXT.lore(heir.given, 'Hlaalu', heir.surname)), 'said, against the line they left');
  // the cadet born, wed, and a child on their own clock
  const H = bornPage(shared, heir, 'cH', { rng: () => 0 });
  courtToBetrothal(H, ALDO);
  H.temple = ALDO.town; H.host.tick(); H.done(false); H.temple = null;
  const wedDay = Math.floor(H.own / DAY);
  H.deps.saveNow();
  const snap = new Map(shared.storage.map);   // the house as the wedding left it, for the dice below
  H.own += 31 * DAY; H.now += 31 * DAY; H.host.tick();
  const kid = H.host.family.people.find((p) => p.minor);
  assert.equal(kid?.surname, heir.surname, 'the cadet\'s child carries the cadet\'s name');
  assert.equal(H.host.family.surname, 'Hlaalu', 'the house keeps its own');
  // a child of the cadet who takes a lore surname of their own: said, against the CADET's line
  let said = null;
  for (let seed = 1; seed < 3000 && !said; seed++) {
    shared.storage.map.clear();
    for (const [k, v] of snap) shared.storage.map.set(k, v);
    const L = loadPage(shared, ent(fullNameOf(heir.given, heir.surname), 'cH', { race: heir.race, gender: heir.gender }), { own: (wedDay + 31) * DAY, now: (wedDay + 31) * DAY, rng: familyRng(seed) });
    L.host.tick();
    const k = L.host.family.people.find((p) => p.minor);
    if (k && k.surname !== heir.surname) said = { L, k };
  }
  assert.ok(said, 'a child of the cadet who took a lore surname');
  assert.ok(said.L.said.includes(LEGACY_TEXT.lore(said.k.given, heir.surname, said.k.surname)), 'the lore change said at the child\'s birth');
});

test('AUDIT LEGACY III A6: A HOUSE LEFT NAMELESS WITH ITS SEAT NOTED IS NAMED - the houses that met the bug LEGACY-NAME fixed (founded nameless, their seat noted by the old tick, which named nothing) were never named: neither door opened again. Named at the next load, or the next tick of a member born on the page, said once', () => {
  const old = (cid) => {
    const shared = houseWorld({ siblings: 100, max: 1 });
    const P = page(shared, ent('Janome', cid, { race: 'Redguard' }), { town: null });
    P.host.found(MODELS.bloodline);
    const f = P.host.family;
    f.seat = { region: 'Sentinel', loc: 'Sentinel', mapId: 7002 };   // what the old tick wrote - the house unnamed
    touch(f);
    storeFamily(shared.storage, f);
    P.deps.saveNow();
    assert.equal(loadFamily(shared.storage, f.id).surname, '');
    return { shared, P, f };
  };
  const named = (w) => w.said.filter((l) => l === LEGACY_TEXT.named('of Sentinel')).length;
  const SENTINEL = { region: 'Sentinel', loc: 'Sentinel', mapId: 7002 };
  // its save loaded
  const a = old('cJ');
  const L = loadPage(a.shared, ent('Janome', 'cJ', { race: 'Redguard' }), { town: SENTINEL });
  assert.equal(L.host.family.surname, 'of Sentinel', 'named at the load');
  assert.equal(loadFamily(a.shared.storage, a.f.id).surname, 'of Sentinel', 'and stored');
  L.host.tick(); L.host.tick();
  assert.equal(named(L), 1, 'said once');
  // a member born on a page of their own (a switch to one never played - no load)
  const b = old('cK');
  const sib = b.f.people.find((p) => p.id !== b.f.currentId);
  assert.equal(b.P.host.switchTo(sib.id).ok, true);
  const B = bornPage(b.shared, sib, 'cS', { town: SENTINEL });
  assert.equal(B.host.family.surname, '');
  B.host.tick(); B.host.tick();
  assert.equal(B.host.family.surname, 'of Sentinel', 'named at the born member\'s first tick');
  assert.equal(named(B), 1);
});

test('AUDIT LEGACY III A7: A CHILD OF A HOUSE NOT NAMED YET CARRIES NO NAME, AND TAKES THE HOUSE\'S WITH IT - a one-name founder fallen before any town left an heir and siblings each under a random surname of their race\'s, which the house\'s name never reached', () => {
  const shared = houseWorld({ siblings: 100, max: 2, always: true });
  const P = page(shared, ent('Janome', 'cJ', { race: 'Breton' }), { town: null, rng: familyRng(3) });
  P.host.found(MODELS.bloodline);
  P.host.onDeath();
  P.host.succeed({ newborn: true });
  const f = P.host.family;
  const children = f.people.filter((p) => p.parents.length);
  assert.ok(children.length >= 2, 'the heir and their siblings');
  assert.deepEqual(children.map((p) => p.surname), children.map(() => ''), 'no name before the house has one');
  const B = bornPage(shared, currentOf(f), 'cH', { town: SEAT, rng: familyRng(3) });
  B.host.tick();
  const g = B.host.family;
  assert.equal(g.surname, 'of Ashbury');
  assert.deepEqual(g.people.filter((p) => p.kind === 'member').map((p) => p.surname), g.people.filter((p) => p.kind === 'member').map(() => 'of Ashbury'), 'every member of the blood takes it');
});

test('AUDIT LEGACY III A8: THE HOUSE\'S NEWS ON THE READER\'S CLOCK - offline every member\'s world keeps its own (a born heir\'s starts at the game\'s first day), and a parent\'s death stamped two hundred days into theirs lay in the heir\'s future: nothing at the birth, then told as fresh two hundred days on. Heard on the reader\'s first day (kept through a load and a stale write), told for its week from then, never again', () => {
  const shared = houseWorld({ always: true });
  const start = CLASSIC_GAME_START_TIME;
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'), { own: start, now: start, town: SEAT });
  X.host.found(MODELS.bloodline);
  X.host.tick();   // the seat noted
  X.own = X.now = start + 200 * DAY;
  X.host.onDeath();
  X.host.succeed({ newborn: true });
  const heir = currentOf(X.host.family);
  const stale = loadFamily(shared.storage, X.host.family.id);
  noteSeen(stale, stale.rev);
  const H = bornPage(shared, heir, 'cH', { own: start, now: start, town: SEAT });
  H.host.tick();   // the heir's first day: the news reaches them
  assert.ok(personOf(loadFamily(shared.storage, X.host.family.id), heir.id).heard, 'heard, and stored');
  // another tab's stale copy writes: the hearing stands
  touch(stale); touch(stale);
  storeFamily(shared.storage, stale);
  assert.ok(personOf(loadFamily(shared.storage, stale.id), heir.id).heard, 'a stale write keeps when it was heard');
  H.own = H.now = start + 3 * DAY;
  H.deps.saveNow();
  const L = loadPage(shared, { ...H.entity }, { own: start + 3 * DAY, now: start + 3 * DAY, town: SEAT });
  L.host.tick();
  const told = (d) => L.host.newsFor(SEAT.mapId, start + d * DAY + 60).filter((n) => n.kind === 'died').length;
  assert.equal(told(6), 1, 'the parent\'s death told in the heir\'s first week');
  assert.equal(told(8), 0, 'its week over, from when the heir heard it');
  assert.equal(told(201), 0, 'never told again as fresh when the heir\'s clock reaches the minute it was stamped');
});

test('AUDIT LEGACY III A9/F9: A BIRTH IS NEWS ONLY WHEN SOMEONE IS BORN - every member\'s first play went through the birth\'s door, and the towns told "a new child" of an adult rolled at the founding, and twice of a marriage\'s child. The Succession\'s newborn heir is news; a member long of the house played for the first time is not', () => {
  const shared = houseWorld({ siblings: 100, max: 1, always: true });
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'), { town: SEAT });
  X.host.found(MODELS.enduring);
  X.host.tick();
  const f = X.host.family;
  const sib = f.people.find((p) => p.id !== f.currentId);
  assert.equal(X.host.switchTo(sib.id).ok, true);
  const B = bornPage(shared, sib, 'cB', { town: SEAT });
  assert.deepEqual((B.host.family.news ?? []).filter((n) => n.k === 'born'), [], 'an adult of the house played for the first time is no birth');
  currentOf(B.host.family).toll = 999;   // an Enduring span spent: the next death is the last
  B.host.onDeath();
  assert.equal(B.host.succeed({ newborn: true }), true);
  const heir = currentOf(B.host.family);
  const H = bornPage(shared, heir, 'cH', { town: SEAT });
  assert.deepEqual(H.host.family.news.filter((n) => n.k === 'born').map((n) => n.who), [fullNameOf(heir.given, heir.surname)], 'the newborn heir, once');
});

test('AUDIT LEGACY III A10/F8/U5: BLOOD WORDS ARE THE BLOOD\'S - one wed in is parentless in the record, and the founder\'s generation\'s root arm made the founder\'s wife her husband\'s brother\'s sister ("Brother! You\'re home."), a sibling\'s wife every cousin\'s cousin, and handed a spouse the founder\'s brothers and sisters on their card', () => {
  const f = foundFamily(ent('Ilmar Hlaalu', 'cX', { gender: 'male' }), { model: MODELS.enduring, rng: familyRng(2), id: 'fam-a10-aaaaaa' });
  const me = personOf(f, 1);
  const bro = addChild(f, null, { rng: familyRng(3) }).person;
  bro.parents = []; bro.gen = 0; bro.gender = 'male'; bro.given = 'Tarn';
  const wife = wed(f, me, { id: 'L120.9', name: 'Brenna Duvall', sex: 'female', race: 'Breton', face: 20, mapId: 120 }, 0);
  assert.equal(kinLine(f, bro, wife), 'One of your house.', 'the founder\'s wife is no sister of his brother');
  assert.equal(kinGreeting(f, bro, wife).lines[0], '"Kin! You\'re home."');
  assert.equal(kinLine(f, me, wife), 'Your wife.');
  const sil = wed(f, bro, { id: 'L120.3', name: 'Sera Vell', sex: 'female', race: 'Nord', face: 3, mapId: 120 }, 0);
  const kid = addChild(f, me.id, { rng: familyRng(4) }).person;
  assert.equal(kinLine(f, kid, wife), 'Your mother.', 'a child\'s own mother, wed in');
  assert.equal(kinLine(f, kid, sil), 'One of your house.', 'an uncle\'s wife');
  assert.deepEqual(siblingsOf(f, wife), [], 'a spouse wed in has none of the house\'s brothers and sisters');
  assert.deepEqual(siblingsOf(f, me).map((p) => p.id), [bro.id], 'the founder\'s brother alone - never his wife');
});

test('AUDIT LEGACY III A13/F17: A MEMBER STRUCK DOWN IS NEWS - a member\'s death is the towns\' news (Legacy-Arc section 10), and one struck down in the street by the one played was told by no town', () => {
  const shared = houseWorld({ siblings: 100, max: 1 });
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'), { town: SEAT });
  X.host.found(MODELS.enduring);
  X.host.tick();
  const f = X.host.family;
  const sib = f.people.find((p) => p.id !== f.currentId);
  const [res] = X.host.residentsOf(SEAT.mapId, () => 9, () => null);
  assert.equal(X.host.kinSlain(res), true);
  assert.deepEqual(f.news.map((n) => [n.k, n.who]), [['died', fullNameOf(sib.given, sib.surname)]]);
  assert.equal(X.host.newsFor(SEAT.mapId, X.now + 60).filter((n) => n.kind === 'died').length, 1, 'the seat tells it');
});

test('AUDIT LEGACY III P6: A UNION HEARD WHILE ITS MEMBER IS AWAY - the child clock counted from the wedding\'s minute on the hearing page\'s world clock, never the member\'s own: their first played day starts it', () => {
  const shared = houseWorld({ siblings: 100, max: 1 });
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'));
  X.host.found(MODELS.enduring);
  const f = X.host.family;
  const sib = f.people.find((p) => p.id !== f.currentId);
  assert.equal(X.host.switchTo(sib.id).ok, true);
  const S = bornPage(shared, sib, 'cS', { own: 2 * DAY });
  assert.equal(S.host.switchTo(1).ok, true);   // back to the founder, the sibling saved where they stand
  const F = loadPage(shared, ent('Ysolde Hlaalu', 'cX'), { own: 300 * DAY, now: 300 * DAY });
  F.online = true;
  const union = { sid: 'wedP6abc01', mine: 'cS', partner: { player: 'acct-b', char: 'r0000000000000000000b', name: 'Iszara Dres', house: { hn: 'Dres', hc: 'Iszara' }, gender: 'female', race: 'Redguard', face: 1 }, at: 300 };
  assert.ok(F.host.wedPlayer(union), 'the union heard for the sibling, away');
  assert.equal(personOf(F.host.family, sib.id).childDay ?? null, null, 'no day of theirs is known here');
  F.deps.saveNow();
  assert.equal(F.host.switchTo(sib.id).ok, true);
  const L = loadPage(shared, ent(fullNameOf(sib.given, sib.surname), 'cS', { gender: sib.gender, race: sib.race }), { own: 12 * DAY, now: 300 * DAY, rng: () => 0 });
  L.host.tick();
  assert.equal(currentOf(L.host.family).childDay, 12, 'their first played day starts it');
  L.own = 41 * DAY; L.host.tick();
  assert.ok(!L.host.family.people.some((p) => p.minor), 'not before thirty of their own days');
  L.own = 42 * DAY; L.host.tick();
  assert.ok(L.host.family.people.some((p) => p.minor), 'then the roll');
  // a union heard for the one played: their clock starts at the hearing, whatever is saved before the next tick
  const shared2 = houseWorld();
  const Z = page(shared2, ent('Ysolde Hlaalu', 'cZ'), { own: 5 * DAY });
  Z.online = true;
  Z.host.found(MODELS.enduring);
  assert.ok(Z.host.wedPlayer({ ...union, sid: 'wedP6abc02', mine: 'cZ' }));
  assert.equal(currentOf(Z.host.family).childDay, 5);
  Z.deps.saveNow();
  const Z2 = loadPage(shared2, ent('Ysolde Hlaalu', 'cZ'), { own: 15 * DAY, now: 15 * DAY, rng: () => 0 });
  Z2.host.tick();
  Z2.own = 36 * DAY; Z2.host.tick();
  assert.ok(Z2.host.family.people.some((p) => p.minor), 'thirty-one days from the hearing');
});

test('AUDIT LEGACY III P7: AN OLDER SAVE LOADED NEVER COURTS ITS DAYS AGAIN - the courtship is the store\'s, the own clock the save\'s: a day already courted is courted once', () => {
  const shared = houseWorld();
  const A = page(shared, ent('Ysolde Hlaalu', 'cA'), { own: 9 * DAY, now: 9 * DAY });
  A.host.found(MODELS.enduring);
  const row = () => A.host.topicRows(ALDO, COURT_CTX)[0];
  row().legacy.answer(0);
  A.deps.saveNow();   // the day-9 save
  A.own += DAY; A.now += DAY;
  row().legacy.answer(0);
  const had = currentOf(A.host.family).courting[ALDO.id].affection;
  const L = loadPage(shared, ent('Ysolde Hlaalu', 'cA'), { own: 9 * DAY, now: 9 * DAY });
  for (const d of [9, 10]) {
    L.own = L.now = d * DAY;
    assert.equal(L.host.topicRows(ALDO, COURT_CTX)[0].legacy.answer(0), MARRIAGE_TEXT.again('Aldo'), `day ${d}: courted already`);
  }
  assert.equal(currentOf(L.host.family).courting[ALDO.id].affection, had);
  L.own = L.now = 11 * DAY;
  assert.notEqual(L.host.topicRows(ALDO, COURT_CTX)[0].legacy.answer(0), MARRIAGE_TEXT.again('Aldo'), 'a new day courts');
});

test('AUDIT LEGACY III P8: ONLINE, A DEVICE THAT REFUSES THE LINE\'S WRITE STILL WRITES THE REALM\'S - the realm is the line\'s authority, and a full device left a fall and its heir out of the realm\'s record until space was freed', () => {
  const shared = houseWorld();
  const pushed = [];
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'), { deps: { stored: (f) => pushed.push(f.rev) } });
  X.online = true;
  X.host.found(MODELS.bloodline);
  shared.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  pushed.length = 0;
  X.host.onDeath();
  assert.ok(X.said.includes(LEGACY_TEXT.notStored), 'the device said so');
  assert.ok(pushed.length > 0, 'the fall went to the realm all the same');
  // offline the store stays the only authority: nothing to push
  const shared2 = houseWorld();
  const pushed2 = [];
  const Y = page(shared2, ent('Ysolde Hlaalu', 'cY'), { deps: { stored: (f) => pushed2.push(f.rev) } });
  Y.host.found(MODELS.bloodline);
  shared2.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  pushed2.length = 0;
  Y.host.onDeath();
  assert.deepEqual(pushed2, []);
});

test('AUDIT LEGACY III O10/P1: THE RECORD KEPT LEAN - a dead member\'s standing goes once no child of theirs can take it (every child played or dead, no Succession of theirs waiting), and a stock career is its index\'s: the dead kept a kilobyte and a half each for good, and every played member six hundred bytes of a career the game ships', () => {
  const bard = { careerIndex: 6, career: { name: 'Bard', primarySkills: [1], majorSkills: [2], minorSkills: [3] } };
  const f = foundFamily(ent('Ysolde Hlaalu', 'cX', bard), { model: MODELS.bloodline, rng: familyRng(12), id: 'fam-o10-aaaaaa' });
  const me = personOf(f, 1);
  assert.deepEqual([me.career, me.className, me.careerIndex], [null, 'Bard', 6], 'a stock Bard is its index\'s');
  assert.deepEqual(me.groups, { primary: [1], major: [2], minor: [3] }, 'its groups kept');
  const custom = writePlayer(blankOf(9), ent('Ysolde Hlaalu', 'cX', { careerIndex: 6, career: { name: 'Shadowdancer', primarySkills: [1], majorSkills: [2], minorSkills: [3] } }));
  assert.equal(custom.career?.name, 'Shadowdancer', 'a custom career kept whole');
  me.standing = { legal: { 17: 20 }, factions: {}, regard: {} };
  recordDeath(f, 1, { at: 5, cause: 'fell' });
  f.pending = { fallenId: 1, at: 5, estate: 0, bequest: [] };
  assert.equal(leanRecord(f), false, 'a Succession of theirs waits: its newborn takes the standing');
  f.pending = null;
  const kid = addChild(f, 1, { rng: familyRng(13) }).person;
  assert.equal(leanRecord(f), false, 'a child not yet played takes it at their birth');
  const st = mem();
  storeFamily(st, f);
  assert.ok(personOf(loadFamily(st, f.id), 1).standing, 'stored whole while a child may take it');
  kid.characterId = 'c-kid';
  touch(f);
  storeFamily(st, f);
  assert.equal(personOf(loadFamily(st, f.id), 1).standing, null, 'every child played: the store\'s write lets it go');
  assert.equal(leanRecord(f), false, 'and once is enough');
});

test('AUDIT LEGACY III F3/F11a/F11b/F21: THE WORDS SAY WHAT HAPPENS, AND THE RECORDS WHAT IS PINNED - no priest asks the wedding (the temple\'s door does: section 8), a blessing says what it gave (nothing, at the cap), a count of children is said in words; a child comes at a quarter\'s chance, as Testing.md\'s LEGACY5 row said and no pin held', () => {
  assert.equal(CHILD_CHANCE, 0.25);
  for (const [roll, born] of [[0.24, true], [0.26, false]]) {
    const g = foundFamily(ent('Ysolde Hlaalu', 'cX'), { model: MODELS.enduring, rng: familyRng(16), id: 'fam-f21-aaaaaa' });
    const m = personOf(g, 1);
    wed(g, m, { id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, mapId: 120 }, 0);
    m.childDay = 0;
    assert.equal(!!childStep(g, m, { day: 30, rng: () => roll, at: 1 }), born, `a roll of ${roll}`);
  }
  for (const line of [MARRIAGE_TEXT.accepted('Aldo', 'Ashbury'), MARRIAGE_TEXT.wedding('Ashbury')]) {
    assert.doesNotMatch(line, /priest/i, line);
    assert.match(line, /temple in Ashbury/);
  }
  assert.equal(MARRIAGE_TEXT.family(2), '"The two children are well. Come home when you can."');
  assert.equal(MARRIAGE_TEXT.family(1), '"The little one is well. Come home when you can."');
  // the rest at the blessing's cap
  const shared = houseWorld();
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'));
  X.host.found(MODELS.bloodline);
  const f = X.host.family;
  const dead = addChild(f, null, { rng: familyRng(14) }).person;
  dead.parents = []; dead.gen = 0; dead.given = 'Ann';
  dead.skills = Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20));
  recordDeath(f, dead.id, { at: 3, cause: 'fell' });
  const skill = bestSkillOf(dead);
  const rest = () => {
    const bones = mintRemainsItem({ line: f.id, of: dead.id, name: 'Ann Hlaalu' });
    X.entity.items.push(bones);
    f.remains = [{ id: `r${dead.id}`, of: dead.id, name: 'Ann Hlaalu', place: null, items: [], first: [], killer: null, at: 3, state: 'taken', by: f.currentId, found: true }];
    assert.equal(X.host.layToRest(f.remains[0]), true);
    X.entity.items = X.entity.items.filter((it) => it !== bones);
    return X.said.at(-1);
  };
  assert.equal(rest(), LEGACY_TEXT.rested('Ann Hlaalu', SKILL_NAMES[skill], BLESSING_POINTS), 'a blessing under the cap gives its points');
  X.entity.legacyBlessings = Array.from({ length: BLESSING_SKILL_MAX / BLESSING_POINTS }, (_, i) => ({ of: 90 + i, name: 'X', skill, value: BLESSING_POINTS }));
  const capped = rest();
  assert.equal(capped, LEGACY_TEXT.rested('Ann Hlaalu', SKILL_NAMES[skill], 0), 'at the cap: what it gave, nothing');
  assert.doesNotMatch(capped, /\+\d/);
});

test('AUDIT LEGACY III P10: THE UNION DOORS - a union the realm made is recorded once, never over a living spouse, never for the dead; one already ended when first heard is recorded quietly (no wedding said for a widowing) and its end said only to its own member; every end heard is stored', () => {
  const shared = houseWorld({ siblings: 100, max: 1 });
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'));
  X.online = true;
  X.host.found(MODELS.enduring);
  const f = X.host.family;
  const sib = f.people.find((p) => p.id !== f.currentId);
  sib.characterId = 'cS';
  const card = (name) => ({ player: 'acct-b', char: 'r0000000000000000000b', name, house: { hn: 'Dres' }, gender: 'male', race: 'Redguard', face: 1 });
  // over a living spouse: nothing
  courtToBetrothal(X, ALDO);
  X.temple = ALDO.town; X.host.tick(); X.done(false); X.temple = null;
  assert.equal(X.host.wedPlayer({ sid: 'wedP10aaa1', mine: 'cX', partner: card('Ondre Dres') }), null, 'the founder is wed already');
  assert.equal(f.people.filter((p) => p.kind === 'player').length, 0);
  // the dead: nothing
  const dead = addChild(f, null, { rng: familyRng(5) }).person;
  dead.parents = []; dead.gen = 0; dead.characterId = 'cD';
  recordDeath(f, dead.id, { at: 1, cause: 'fell' });
  assert.equal(X.host.wedPlayer({ sid: 'wedP10aaa2', mine: 'cD', partner: card('Ondre Dres') }), null, 'the dead wed nobody');
  // an ended union heard for the first time: recorded quietly, its end said to nobody here but its member
  X.said.length = 0;
  assert.equal(X.host.unionsHeard([{ sid: 'wedP10aaa3', mine: 'cS', partner: card('Ondre Dres'), at: 10, endedAt: 20, endedWhy: 'died', endedBy: 'partner' }]), 2);
  assert.deepEqual(X.said, [], 'a widowing of another member\'s: no wedding said, no loss said to the one played');
  const s = f.people.find((p) => p.kind === 'player');
  assert.ok(s.died, 'the end recorded');
  assert.ok(personOf(loadFamily(shared.storage, f.id), s.id)?.died, 'and stored');
  // the one played's own union, ended: said to them
  const Y = page(houseWorld(), ent('Ysolde Hlaalu', 'cY'));
  Y.online = true;
  Y.host.found(MODELS.enduring);
  Y.host.wedPlayer({ sid: 'wedP10bbb1', mine: 'cY', partner: card('Ondre Dres') });
  Y.said.length = 0;
  assert.equal(Y.host.unionsHeard([{ sid: 'wedP10bbb1', mine: 'cY', partner: card('Ondre Dres'), at: 10, endedAt: 30, endedWhy: 'died', endedBy: 'partner' }]), 1);
  assert.deepEqual(Y.said, [MARRIAGE_TEXT.lost('Ondre Dres')]);
});

test('AUDIT LEGACY III P11: THE WEDDING DOOR AND THE SPOUSES IN THE WORLD - the temple asks once a VISIT (again after the betrothed leaves and comes back); a wedding answered after the member was wed meanwhile makes no second spouse; a dead spouse stands nowhere; a living one lives in the line\'s house in their town when it holds one, and moves with it', () => {
  const shared = houseWorld();
  const X = page(shared, ent('Ysolde Hlaalu', 'cX'));
  X.online = true;
  X.host.found(MODELS.enduring);
  courtToBetrothal(X, ALDO);
  X.temple = ALDO.town; X.host.tick(); X.host.tick();
  assert.equal(X.asked.length, 1, 'once a visit');
  X.temple = null; X.host.tick();
  X.temple = ALDO.town; X.host.tick();
  assert.equal(X.asked.length, 2, 'and again on the next');
  // the prompt stands; a union the realm made lands meanwhile: the answer makes nothing
  X.host.wedPlayer({ sid: 'wedP11aaa1', mine: 'cX', partner: { player: 'acct-b', char: 'r0000000000000000000b', name: 'Ondre Dres', house: { hn: 'Dres' }, gender: 'male', race: 'Redguard', face: 1 } });
  X.done(false);
  const f = X.host.family;
  assert.equal(f.people.filter((p) => p.kind !== 'member').length, 1, 'one spouse');
  // the spouses in the world
  const shared2 = houseWorld();
  const Y = page(shared2, ent('Ysolde Hlaalu', 'cY'));
  Y.host.found(MODELS.enduring);
  courtToBetrothal(Y, ALDO);
  Y.temple = ALDO.town; Y.host.tick(); Y.done(false); Y.temple = null;
  const g = Y.host.family;
  const sp = g.people.find((p) => p.kind === 'resident');
  const census = { ...ALDO, home: 3, archive: 385, variant: 0, job: 'crafter' };
  const censusOf = (id) => (id === ALDO.id ? census : null);
  assert.equal(Y.host.residentsOf(120, () => 0, censusOf)[0]?.home, 3, 'their own home while the line holds none in their town');
  g.houses = [{ regionIndex: 17, mapId: 120, buildingKey: 900, location: 'Ashbury', by: 1 }];
  assert.equal(Y.host.residentsOf(120, () => 0, censusOf).find((r) => r.legacy?.personId === sp.id)?.home, 900, 'the line\'s house in their town - moved with it');
  recordDeath(g, sp.id, { at: 5, cause: 'slain' });
  assert.equal(Y.host.residentsOf(120, () => 0, censusOf).some((r) => r.legacy?.personId === sp.id), false, 'the dead stand nowhere');
});

test('AUDIT LEGACY III P13: THE HOST\'S SMALLER DOORS - the past played back offers no courtship and writes nothing; an offline fall asks no realm; the towns\' news stamped on the towns\' clock; the realm\'s id stored the moment it is learned; a courtship\'s end said only to its own member, and stored', () => {
  // the past: an Enduring elder passes the mantle, the Succession unanswered, and the elder's save is loaded
  const shared = houseWorld();
  const X = page(shared, ent('Ysolde Hlaalu', 'cX', { race: 'Breton' }), { own: 0, now: 0 });
  X.host.found(MODELS.enduring);
  X.own = X.now = 46 * 525600;
  assert.equal(X.host.passMantle().ok, true);
  const P = loadPage(shared, ent('Ysolde Hlaalu', 'cX', { race: 'Breton' }), { own: X.own, now: X.now });
  assert.equal(P.host.past?.id, 1);
  const rev = loadFamily(shared.storage, P.host.family.id).rev;
  assert.deepEqual(P.host.topicRows(ALDO, COURT_CTX), [], 'the past courts nobody');
  assert.equal(loadFamily(shared.storage, P.host.family.id).rev, rev, 'nothing written');
  // an offline fall: no realm to tell
  let tombs = 0;
  const O = page(houseWorld(), ent('Ysolde Hlaalu', 'cO'), { deps: { tombstone: () => { tombs++; return true; } } });
  O.host.found(MODELS.bloodline);
  O.host.onDeath();
  assert.equal(tombs, 0);
  assert.ok(!O.said.includes(LEGACY_TEXT.unTombed));
  // online, the towns' clock stamps the news
  const N = page(houseWorld(), ent('Ysolde Hlaalu', 'cN'), { town: SEAT });
  N.online = true;
  N.host.found(MODELS.enduring);
  N.host.tick();
  N.sky = N.now + 10 * DAY;
  courtToBetrothal(N, ALDO);
  N.temple = ALDO.town; N.host.tick(); N.done(false);
  const wedNews = N.host.family.news.find((n) => n.k === 'wed');
  assert.equal(wedNews?.t, N.sky, 'stamped at the towns\' minute');
  assert.equal(N.host.newsFor(SEAT.mapId, N.sky + 60).filter((n) => n.kind === 'wed').length, 1, 'told in its week');
  // the realm's id, stored the moment it is learned
  const R = page(houseWorld(), ent('Ysolde Hlaalu', 'c-ysolde'));
  R.host.found(MODELS.bloodline);
  assert.equal(R.host.rebind('c-ysolde', 'r0123456789abcdef0123'), true);
  assert.equal(loadFamily(R.shared.storage, R.host.family.id).people[0].characterId, 'r0123456789abcdef0123');
  // a courtship's end: said to its own member alone, and stored
  const shared3 = houseWorld({ siblings: 100, max: 1 });
  const C = page(shared3, ent('Ysolde Hlaalu', 'cC'));
  C.host.found(MODELS.enduring);
  const g = C.host.family;
  const sib = g.people.find((p) => p.id !== g.currentId);
  sib.courting = { 'L120.7': { name: 'Rena Dorr', mapId: 120, town: 'Ashbury', affection: 40, day: 1, betrothed: false } };
  touch(g);
  storeFamily(shared3.storage, g);
  assert.ok(personOf(loadFamily(shared3.storage, g.id), sib.id).courting['L120.7'], 'the courtship stored');
  C.said.length = 0;
  assert.equal(C.host.residentDied('L120.7'), true);
  assert.deepEqual(C.said, [], 'another member\'s courtship: not said to the one played');
  assert.equal(personOf(loadFamily(shared3.storage, g.id), sib.id).courting['L120.7'], undefined, 'and stored');
});

test('AUDIT LEGACY III P14: THE MARRIAGE LAW\'S EDGES - another player\'s character is recorded by their house\'s given name, never the account\'s; a wedding to them ends every courtship of the member; children are counted by the couple, so a second marriage\'s are its own', () => {
  const f = foundFamily(ent('Ysolde Hlaalu', 'cX'), { model: MODELS.enduring, rng: familyRng(15), id: 'fam-p14-aaaaaa' });
  const m = personOf(f, 1);
  m.courting = { [ALDO.id]: { name: ALDO.name, mapId: 120, town: 'Ashbury', affection: 100, day: 2, betrothed: true } };
  const s = wedPlayer(f, m, { player: 'acct-b', char: 'r0000000000000000000b', name: 'Shadowblade Dres', house: { hn: 'Dres', hc: 'Ondre' }, gender: 'male', race: 'Redguard', face: 1 }, 'wedP14aaa1', 100);
  assert.equal(fullNameOf(s.given, s.surname), 'Ondre Dres', 'the house\'s given name, never the account\'s');
  assert.deepEqual(m.courting, {}, 'every courtship over at the wedding');
  // six children with the first spouse, then a second marriage
  for (let i = 0; i < 6; i++) addChild(f, 1, { rng: familyRng(40 + i) });
  assert.equal(childrenTogether(f, m, s), 6);
  recordDeath(f, s.id, { at: 200, cause: 'fell' });
  const s2 = wed(f, m, { id: 'L77.2', name: 'Iszara Tharn', sex: 'female', race: 'Khajiit', face: 9, mapId: 77 }, 300);
  assert.equal(childrenTogether(f, m, s2), 0, 'the second marriage\'s children are its own');
  assert.equal(spouseOf(f, m), s2);
});

// ─── THE PAGES, THE TREE AND THE PORTRAITS ─────────────────────────────────────────────────────────────────────────

const el = (tag, cls, text) => { const n = globalThis.document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
const divider = (t) => el('h2', null, t);
const prov = (f, over = {}) => ({ on: () => true, family: () => f, lived: () => 0, hall: () => [f], date: (t) => `day ${t}`, inWorld: () => true, livingWorld: () => true, switchRefusal: () => 'none', ...over });
/** The Family Tree page drawn with `id`'s card open (their plate pressed, as a player does). */
function cardOf(f, id, over = {}) {
  resetFamilyPages();
  setFamilyProvider(prov(f, over));
  let d = null;
  const draw = () => { d = el('div'); drawTreePage(d, draw, { el, divider }); };
  draw();
  const plate = d.querySelectorAll('div').find((n) => n.attrs?.['data-focus'] === `fam-node-${id}`);
  assert.ok(plate, `the plate of ${id}`);
  plate.onclick({ stopPropagation() {} });
  return { page: d, card: d.querySelector('.fam-card') };
}
/** A card's facts, `{ label: value }`, and its chips. */
const factsOf = (card) => {
  const out = {};
  for (const g of card.querySelectorAll('.fam-grid')) for (let i = 0; i + 1 < g.children.length; i += 2) out[g.children[i].textContent] = g.children[i + 1].textContent;
  return out;
};
const chipsOf = (card) => card.querySelectorAll('.fam-chip').map((c) => c.textContent);

test('AUDIT LEGACY III A11/F10/U7/U9/P17: THE CARD SAYS WHAT THE HOUSE KEEPS - no age for one wed in (every spouse read twenty for life) nor for a child not yet of age (a newborn read "23 of 90"), no birthday that was their wedding day, no death day for one gone from the realm; a death of years "Died at", a fall "Fell at"; a child\'s chip; a townsperson wed in wearing their own face, on the tree and on the meeting\'s card alike', () => {
  const f = foundFamily(ent('Ysolde Hlaalu', 'c1', { race: 'Breton' }), { model: MODELS.enduring, rng: familyRng(1), id: 'fam-u7-aaaaaa' });
  const me = personOf(f, 1);
  const spouse = wed(f, me, { id: 'L120.9', name: 'Faelian Ormond', sex: 'male', race: 'Breton', face: 20, mapId: 120 }, 144000);
  const kid = addChild(f, 1, { rng: familyRng(2) }).person;
  kid.minor = true;
  const elder = addChild(f, null, { rng: familyRng(3) }).person;
  elder.parents = []; elder.gen = 0;
  recordDeath(f, elder.id, { at: 900, cause: 'years', place: { loc: 'Daggerfall' } });
  const slain = addChild(f, null, { rng: familyRng(4) }).person;
  slain.parents = []; slain.gen = 0;
  recordDeath(f, slain.id, { at: 950, cause: 'slain', place: { loc: 'Ashbury' } });
  const other = wedPlayer(f, slain, { player: 'acct-b', char: 'r0000000000000000000b', name: 'Iszara Dres', house: { hn: 'Dres', hc: 'Iszara' }, gender: 'male', race: 'Redguard', face: 1 }, 'wedU7aaa01', 500);
  recordDeath(f, other.id, { at: 990, cause: 'gone' });
  assert.equal(ageWord(f, spouse, 0), null, 'the house keeps no years of one wed in');
  assert.equal(ageWord(f, kid, 0), null, 'nor of a child not yet of age');
  assert.match(ageWord(f, me, 0), /^\d+ of \d+$/, 'the blood\'s, grown');
  assert.equal(spouse.born, 0, 'born on no day of the house\'s - never the wedding\'s');
  const poses = [];
  const faces = (pose) => { poses.push(pose); return Promise.resolve(null); };
  const sc = factsOf(cardOf(f, spouse.id, { faces }).card);
  assert.equal(sc.Age, undefined);
  assert.equal(sc.Born, undefined);
  assert.ok(poses.some((p) => p.common === 20), 'their census face on the tree');
  assert.deepEqual(chipsOf(cardOf(f, kid.id).card).includes('A child'), true, 'the child\'s chip (LP-pages-no-child-chip)');
  assert.equal(factsOf(cardOf(f, kid.id).card).Age, undefined);
  const ec = factsOf(cardOf(f, elder.id).card);
  assert.deepEqual([ec['Died at'], ec['Fell at']], ['Daggerfall', undefined], 'a death of years: died there');
  assert.equal(factsOf(cardOf(f, slain.id).card)['Fell at'], 'Ashbury');
  const oc = cardOf(f, other.id).card;
  assert.equal(factsOf(oc).Died, undefined, 'one gone from the realm died on no day of ours');
  assert.ok(chipsOf(oc).includes('Gone from the realm'));
  // one pose for every window: the meeting's card asks it too (ui/legacySuccession.js face)
  assert.deepEqual(facePose(spouse), { race: 'Breton', gender: 'male', face: 0, common: 20 });
  assert.deepEqual(facePose(me), { race: me.race, gender: me.gender, face: me.face });
  assert.match(rd('src/ui/legacySuccession.js'), /faces\(facePose\(who\)\)/);
  assert.match(rd('src/ui/familyPages.js'), /faces\(facePose\(p\)\)/);
  // the loader draws it from the talk window's own CommonFaces archive
  assert.equal(COMMON_FACES_FILE, PORTRAIT_ARCHIVE.CommonFaces);
});

test('AUDIT LEGACY III P17 (the loader): A COMMON FACE COMES FROM THE TALK\'S OWN ARCHIVE - a pose with `common` is the CommonFaces record, any other its race\'s chargen heads', async () => {
  const asked = [];
  const load = createFaceLoader({ fetchBytes: async (name) => { asked.push(name); throw new Error('no data here'); }, palette: {} });
  await load({ race: 'Breton', gender: 'male', face: 0, common: 20 }).catch(() => null);
  await load({ race: 'Breton', gender: 'male', face: 3 }).catch(() => null);
  assert.equal(asked[0], COMMON_FACES_FILE);
  assert.match(asked[1], /^FACE\d\dI0\.CIF$/);
});

test('AUDIT LEGACY III A15/U9/F6: THE HOUSE PAGE COUNTS ONE SET AND NAMES THE KILLER - Living counted the blood and Fallen every spouse and a player\'s character gone from the realm; the fallen\'s row named what struck down only one slain, never a fall to a revenant the journal names', () => {
  const f = foundFamily(ent('Ysolde Hlaalu', 'c1'), { model: MODELS.bloodline, rng: familyRng(1), id: 'fam-a15-aaaaaa', seat: { region: 'Daggerfall', loc: 'Ashbury', mapId: 120 } });
  const me = personOf(f, 1);
  const sib = addChild(f, null, { rng: familyRng(2) }).person;
  sib.parents = []; sib.gen = 0; sib.given = 'Mirel';
  const s1 = wed(f, me, { id: 'L1.1', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 1, mapId: 120 }, 0);
  recordDeath(f, s1.id, { at: 10, cause: 'slain', by: 'Ysolde Hlaalu', place: { loc: 'Ashbury' } });
  const s2 = wedPlayer(f, sib, { player: 'a', char: 'r1', name: 'Iszara Dres', house: { hn: 'Dres', hc: 'Iszara' }, gender: 'male', race: 'Redguard', face: 1 }, 'wedAbc123', 0);
  recordDeath(f, s2.id, { at: 20, cause: 'gone' });
  const fallen = addChild(f, null, { rng: familyRng(3) }).person;
  fallen.parents = []; fallen.gen = 0; fallen.given = 'Ante';
  recordDeath(f, fallen.id, { at: 30, cause: 'fell', by: 'Grushnak the Butcher', place: { loc: 'Daggerfall' } });
  setFamilyProvider(prov(f));
  const d = el('div');
  drawHousePage(d, () => {}, { el, divider });
  const g = d.querySelector('.fam-grid');
  const fact = (k) => { const i = g.children.findIndex((c) => c.textContent === k); return g.children[i + 1]?.textContent; };
  assert.deepEqual([fact('Living'), fact('Fallen')], ['2', '1'], 'the blood\'s, both');
  const rows = d.querySelectorAll('.fam-hallrow').map((r) => r.textContent);
  assert.ok(rows.some((r) => /Ante Hlaalu.*fell to Grushnak the Butcher at Daggerfall/.test(r)), `the killer named (${rows.join(' | ')})`);
  assert.ok(rows.some((r) => /Aldo Marane.*\(wed into the house\).*was slain by Ysolde Hlaalu/.test(r)), 'a spouse among the house\'s dead, said so');
  assert.ok(!rows.some((r) => /Iszara/.test(r)), 'one gone from the realm is no death of the house\'s');
  const h = el('div');
  drawHallPage(h, () => {}, { el, divider });
  assert.match(h.textContent, /5 remembered, 1 fallen/, 'the Hall counts the blood\'s fallen too');
});

test('AUDIT LEGACY III A17: THE PAST PLAYED BACK HAS NO SHEET - a retired elder\'s or a fallen member\'s own save loaded showed, on its Stats page, the HEAD\'s generation and an age off the past\'s clock', () => {
  const f = foundFamily(ent('Ysolde Hlaalu', 'c1'), { model: MODELS.enduring, rng: familyRng(1), id: 'fam-a17-aaaaaa' });
  assert.ok(sheetHouse(prov(f, { past: () => null })), 'the one played has their sheet');
  assert.equal(sheetHouse(prov(f, { past: () => personOf(f, 1) })), null, 'the past has none');
});

test('AUDIT LEGACY III A14/U4: A MEMBER WED TWICE - every spouse they have had stands in their unit (the earlier on the left, the last on the right), each marriage\'s children beneath that couple, every couple\'s line drawn left to right; the first union\'s children hung under the second spouse, the first spouse cut off at the row\'s end', () => {
  const f = foundFamily(ent('Ysolde Hlaalu', 'c1'), { model: MODELS.enduring, rng: familyRng(1), id: 'fam-a14-aaaaaa' });
  const me = personOf(f, 1);
  const sib = addChild(f, null, { rng: familyRng(9) }).person;
  sib.parents = []; sib.gen = 0;
  const first = wed(f, me, { id: 'L1.1', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 1, mapId: 1 }, 10);
  const k1 = addChild(f, 1, { rng: familyRng(2) }).person;
  recordDeath(f, first.id, { at: 15, cause: 'slain' });
  const second = wed(f, me, { id: 'L1.2', name: 'Faral Indoril', sex: 'male', race: 'DarkElf', face: 2, mapId: 1 }, 20);
  recordDeath(f, second.id, { at: 25, cause: 'fell' });   // childless
  const third = wed(f, me, { id: 'L1.3', name: 'Orvas Dren', sex: 'male', race: 'DarkElf', face: 3, mapId: 1 }, 30);
  const k3 = addChild(f, 1, { rng: familyRng(3) }).person;
  const t = layoutTree(f);
  const x = (id) => t.nodes.find((n) => n.id === id).x;
  assert.deepEqual(t.couples.map((c) => [c.a, c.b]).sort(), [[1, first.id], [1, second.id], [1, third.id]].sort(), 'every marriage a couple');
  assert.deepEqual([x(first.id), x(second.id), x(me.id), x(third.id)], [x(first.id), x(first.id) + 1, x(first.id) + 2, x(first.id) + 3], 'the earlier on the left, the last on the right');
  const fam = (id) => t.families.find((g) => g.children.includes(id)).parents;
  assert.deepEqual(fam(k1.id), [1, first.id], 'the first marriage\'s child beneath it');
  assert.deepEqual(fam(k3.id), [1, third.id]);
  const seen = new Set(t.nodes.map((n) => `${n.x},${n.y}`));
  assert.equal(seen.size, t.nodes.length, 'no two plates on one slot');
  // the lines, drawn: each couple's from its left plate to its right
  const { page } = cardOf(f, 1);
  const wedLines = page.querySelectorAll('path').filter((p) => p.attrs.class === 'wed').map((p) => p.attrs.d.match(/^M ([\d.]+) [\d.]+ H ([\d.]+)$/).slice(1).map(Number));
  assert.equal(wedLines.length, 3);
  assert.ok(wedLines.every(([a, b]) => b > a), 'left to right');
});

test('AUDIT LEGACY III U3/U8: THE TREE STACKED BY ITS PANE, AND THE BLOODLINE\'S END SAID ONLINE - beside the pause rail the pane is 380-550px from a 721px window up, and the card beside the tree left it a keyhole (74px, its Zoom in out of reach); online, the Bloodline answer replaced "the line ends" with where it is kept', () => {
  assert.match(FAMILY_CSS, /\.px-sys \.fam-page \{ container: fampage \/ inline-size; \}/);
  assert.match(FAMILY_CSS, /@container fampage \(max-width: 560px\) \{ \.px-sys \.fam-wrap \{ flex-direction: column;/);
  const f = foundFamily(ent('Ysolde Hlaalu', 'c1'), { model: MODELS.enduring, rng: familyRng(1), id: 'fam-u3-aaaaaa' });
  const { page } = cardOf(f, 1);
  const pane = page.querySelector('.fam-page');
  assert.ok(pane?.querySelector('.fam-wrap'), 'the tree and its card inside the pane the stacking reads');
  for (const online of [false, true]) {
    const lines = legacyModelOptions({ online, tollShare: 0.06 }).find((o) => o.id === MODELS.bloodline).lines;
    assert.ok(lines.includes('With no one left, the line ends.'), `online ${online}`);
    assert.equal(lines.includes(BLOODLINE_ONLINE_LINE), online);
  }
  assert.equal(identityLine({ kind: 'resident', race: 'Nord', className: 'Mage', level: 1 }), 'Nord', 'one wed in: their race alone (A12/F4/U6, the meeting card reads this line)');
});

test('AUDIT LEGACY III P16: THE WEDDING HANDSHAKE\'S GUARDS - at most WED_INCOMING_MAX proposals wait; an answer owed to nobody\'s wedding goes once a peer each WED_REASK_MS, whatever the flood; a yes answers every other proposal; a proposal taken back while my half was on its way gets no yes, and my half is taken back; a stale `no` or `yes` (another proposal\'s handshake) touches nothing of mine', async () => {
  const mk = (over = {}) => {
    const s = { sent: [], said: [], prompts: [], wed: [], halves: [], t: 1000 };
    s.mgr = createWedManager({
      send: (d) => { s.sent.push(d); return true; }, now: () => s.t, say: (l) => s.said.push(l), selfId: () => 'peer-000m', can: over.can ?? (() => null), peerCan: () => true,
      half: async (sid, partner, pc, opts = {}) => { s.halves.push({ sid, withdraw: !!opts.withdraw }); return over.half ? over.half(sid, opts) : { ok: true, wed: false }; },
      onPrompt: (p) => s.prompts.push(p), onWed: (u) => s.wed.push(u),
    });
    return s;
  };
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => { setImmediate(r); }); };
  const a = mk();
  for (let i = 0; i < 6; i++) a.mgr.onFrame(`peer-00${i}x`, { k: 'ask', s: `wedP16aa0${i}` }, `acct-${i}`, `r000000000000000000${i}`);
  assert.equal(a.prompts.length, WED_INCOMING_MAX);
  const b = mk({ can: () => 'temple' });
  for (let i = 0; i < 10; i++) b.mgr.onFrame('peer-0001', { k: 'ask', s: `wedP16bb0${i}` }, 'acct-1', 'r0000000000000000001');
  assert.equal(b.sent.length, 1, 'one answer, whatever the flood');
  b.t += WED_REASK_MS + 1;
  b.mgr.onFrame('peer-0001', { k: 'ask', s: 'wedP16bb99' }, 'acct-1', 'r0000000000000000001');
  assert.equal(b.sent.length, 2, 'and the next once its time is up');
  const c = mk();
  c.mgr.onFrame('peer-000a', { k: 'ask', s: 'wedP16cc01' }, 'acct-a', 'r000000000000000000a');
  c.mgr.onFrame('peer-000b', { k: 'ask', s: 'wedP16cc02' }, 'acct-b', 'r000000000000000000b');
  await c.mgr.accept('peer-000a');
  assert.deepEqual(c.sent.filter((d) => d.to === 'peer-000b'), [{ k: 'no', to: 'peer-000b', s: 'wedP16cc02', why: 'busy' }]);
  let release = null;
  const d = mk({ half: (sid, opts) => (opts.withdraw ? { ok: true, wed: false } : new Promise((r) => { release = () => r({ ok: true, wed: false }); })) });
  d.mgr.onFrame('peer-000a', { k: 'ask', s: 'wedP16dd01' }, 'acct-a', 'r000000000000000000a');
  const pending = d.mgr.accept('peer-000a');
  await settle();
  d.mgr.onFrame('peer-000a', { k: 'no', to: 'peer-000m', s: 'wedP16dd01', why: 'cancelled' }, 'acct-a', 'r000000000000000000a');
  release();
  assert.deepEqual(await pending, { ok: false, why: 'cancelled' });
  await settle();
  assert.ok(!d.sent.some((x) => x.k === 'yes'), 'no yes to a proposal taken back');
  assert.deepEqual(d.halves.map((h) => h.withdraw), [false, true], 'my half taken back as it landed');
  const e = mk();
  assert.equal(e.mgr.request('peer-000a').ok, true);
  e.mgr.onFrame('peer-000a', { k: 'no', to: 'peer-000m', s: 'wedP16old01', why: 'declined' }, 'acct-a', 'r000000000000000000a');
  assert.equal(e.mgr.stateFor('peer-000a'), 'outgoing', 'a stale no: my new proposal stands');
  e.mgr.onFrame('peer-000a', { k: 'yes', to: 'peer-000m', s: 'wedP16old01' }, 'acct-a', 'r000000000000000000a');
  await settle();
  assert.equal(e.mgr.stateFor('peer-000a'), 'outgoing', 'a stale yes takes nothing');
  assert.deepEqual(e.halves, [], 'no half posted for it');
  // a yes that carries no relay stamp of their character (AUDIT LEGACY III O1): refused, never a half that cannot name them
  const f2 = mk();
  assert.equal(f2.mgr.request('peer-000a').ok, true);
  const s2 = f2.sent[0].s;
  f2.mgr.onFrame('peer-000a', { k: 'yes', to: 'peer-000m', s: s2 }, 'acct-a', null);
  await settle();
  assert.deepEqual(f2.halves, [], 'no half posted');
  assert.deepEqual(f2.sent.at(-1), { k: 'no', to: 'peer-000a', s: s2, why: 'refused' });
});

// ─── THE WORLD'S WIRING ────────────────────────────────────────────────────────────────────────────────────────────
// world.js cannot boot headless (no ARENA2): what can run is lifted out of its own text and run (lens W's way); the rest
// is pinned by source, its reproduction driven in Chromium (bible/01-Overview/Audit-Legacy-III.md says how).

/** world.js's own text from the line matching `from` to the first line matching `to` after it. */
function liftWorld(from, to) {
  const lines = rd('src/scenes/world.js').split('\n');
  const a = lines.findIndex((l) => from.test(l));
  assert.ok(a >= 0, `world.js holds ${from}`);
  let b = a + 1;
  while (b < lines.length && !to.test(lines[b])) b++;
  return lines.slice(a, b + 1).join('\n');
}

test('AUDIT LEGACY III W1: THE LIVING WORLD\'S INDICES READ THE GAME\'S ROWS, AND AN ONLINE HOME IS NAMED - the boot emptied the rows before either index was built, so every town and dungeon index was empty (LW3\'s roads, LW6\'s deep) and every home of the line reached it with no town name: the rows go once BOTH indices stand, and a home is named off the boot\'s own complete table', async () => {
  const src = rd('src/scenes/world.js');
  assert.equal((src.match(/_hubRows\.length = 0/g) ?? []).length, 1, 'emptied in one place');
  assert.match(src, /const releaseHubRows = \(\) => \{ if \(_livingTowns && _livingDungeons\) _hubRows\.length = 0; \};/);
  const body = liftWorld(/^  let _livingTowns = null;$/, /^    return _livingDungeons;$/) + '\n  };';
  const make = new Function('_hubRows', 'populatesWanderingNpcs', 'longitudeLatitudeToMapPixel', 'getWorldClimateSettings', 'maps', 'hasPort', 'LOCATION_TYPES',
    `${body}\nreturn { towns: livingTownsIndex, dungeons: livingDungeonsIndex };`);
  const row = (name, mapId, locationType, x) => ({ name, regionIndex: 17, mapTableData: { mapId, locationType, longitude: x, latitude: 1 }, exterior: { exteriorData: { width: 2, height: 2 } } });
  for (const order of [['towns', 'dungeons'], ['dungeons', 'towns']]) {
    const rows = [row('Gothway Garden', 5001, LOCATION_TYPES.TownCity, 1), row('Castle Necromoghan', 6001, LOCATION_TYPES.DungeonLabyrinth, 2)];
    const idx = make(rows, (t) => t === LOCATION_TYPES.TownCity, (lon, lat) => ({ x: lon, y: lat }), () => ({ people: 1 }), { getClimateIndex: () => 0 }, () => false, LOCATION_TYPES);
    assert.equal(idx[order[0]]().size, 1, `${order[0]} first: built from the rows`);
    assert.equal(rows.length, 2, 'kept for the other');
    assert.equal(idx[order[1]]().size, 1, `${order[1]} second: built from the rows too`);
    assert.equal(rows.length, 0, 'let go once both stand');
  }
  // a home of mine, as the line is handed it
  const read = liftWorld(/^  let _legacyOnlineHomes = null;$/, /^  }$/);
  const mk = new Function('homesApi', 'realmSession', '_townOfMapId', `${read}\nreturn { read: legacyOnlineHomesRead, get homes() { return _legacyOnlineHomes; } };`);
  const w = mk({ mine: async () => ({ ok: true, data: { homes: [{ mapId: 5001, buildingKey: 66051, region: 17, character: 'r-me' }, { mapId: 5002, buildingKey: 7, region: 17, character: 'r-other' }] } }) },
    { id: 'r-me' }, new Map([[5001, { name: 'Gothway Garden' }]]));
  w.read();
  await new Promise((r) => { setImmediate(r); });
  assert.deepEqual(w.homes, [{ regionIndex: 17, mapId: 5001, buildingKey: 66051, location: 'Gothway Garden' }], 'named, and mine alone');
});

test('AUDIT LEGACY III W5: THE ONLINE HOMES READ - THE LAST ASKED WINS, and a home the arena moved is read again: two reads after two writes could land in either order, and the older answer (a home since sold) was handed to the next save', async () => {
  const read = liftWorld(/^  let _legacyOnlineHomes = null;$/, /^  }$/);
  const pending = [];
  const mk = new Function('homesApi', 'realmSession', '_townOfMapId', `${read}\nreturn { read: legacyOnlineHomesRead, get homes() { return _legacyOnlineHomes; } };`);
  const w = mk({ mine: () => new Promise((res) => pending.push(res)) }, { id: 'r-me' }, new Map([[5001, { name: 'Gothway Garden' }]]));
  w.read();   // after a claim
  w.read();   // after the release a moment later
  pending[1]({ ok: true, data: { homes: [] } });
  await new Promise((r) => { setImmediate(r); });
  pending[0]({ ok: true, data: { homes: [{ mapId: 5001, buildingKey: 66051, region: 17, character: 'r-me' }] } });
  await new Promise((r) => { setImmediate(r); });
  assert.deepEqual(w.homes, [], 'the newer answer stands - the sold home is not handed back');
  assert.match(rd('src/scenes/world.js'), /if \(moved\.length\) legacyOnlineHomesRead\(\);   \/\/ AUDIT LEGACY III W5/);
});

test('AUDIT LEGACY III W3/W4/W6/A12/F11c/F11d (the world host, by source): the wedding prompt waits under the building\'s own windows and a death, and nobody weds lying dead; the line\'s street holds still under a talk window and is let go indoors; one identity line for a card met; the Succession\'s words by who is offered; no elder "retires to the seat"', () => {
  const src = rd('src/scenes/world.js');
  assert.match(src, /const wedAsk = \(peerId\) => \{\n(?:    \/\/.*\n)*    if \(\(townTalk\.overlayActive && !townTalk\.overlayDone\) \|\| \(modes\?\.overlayHeld \?\? false\) \|\| \(modes\?\.deathUp\?\.\(\) \?\? false\)\) return false;/, 'W3: under the street\'s window, the building\'s, or a death');
  assert.match(src, /const wedCan = \(\) => \(playerEntity\.health <= 0 \|\| modes\?\.deathUp\?\.\(\) \? 'busy'\n/, 'W3: never while lying dead');
  assert.match(src, /familyStreet\.end\(townTalk\.overlayActive \? 0 : dt, cam\.pos\)/, 'W4: held as the street is');
  assert.match(src, /if \(livingRoads\) livingRoads\.clear\(\);[^\n]*\n      familyStreet\?\.clear\(\);   \/\/ AUDIT LEGACY III W6/, 'W6: let go with the roads, indoors and below');
  assert.match(src, /const legacyIdentity = \(p\) => identityLine\(p\);/, 'A12/F4/U6: the Family tab\'s own line');
  assert.match(src, /retired \? `\$\{fallen\.given\} has carried the house long enough\. The mantle passes on\.` : out\.newborn \? LEGACY_TEXT\.heir : choices\.length \? LEGACY_TEXT\.kin : LEGACY_TEXT\.noHeir,/, 'F11c');
  assert.equal(LEGACY_TEXT.kin, 'You died. One of your house will take your place.');
  for (const f of ['src/scenes/world.js', 'src/ui/familyPages.js']) assert.doesNotMatch(rd(f), /retires? to the family seat/, `F11d: ${f}`);
});

test('AUDIT LEGACY III O2/P1 (the world host, by source): a line the realm refuses is said, once; and the birth door waits on the line standing at the realm (a refusal the reason it gives, never "they cannot take up the line")', () => {
  const src = rd('src/scenes/world.js');
  assert.match(src, /createRealmLine\(\{ io: realmIoNow, storage: \(\) => appStorage\(\), onRefused: \(id, error\) => \{ townTalk\.say\(LEGACY_TEXT\.lineRefused\(realmRefusalText\(error\)\)\); \} \}\)/);
  assert.match(src, /for \(let i = 0; born && legacyRealmLine\?\.unwrittenOf\(fam\.id\) && !legacyRealmLine\.refusalOf\(fam\.id\) && i < 2; i\+\+\) \{/);
  assert.match(src, /const unwritten = born \? legacyRealmLine\?\.unwrittenOf\(fam\.id\) \?\? null : null;\n    if \(unwritten\) return \{ ok: false, error: unwritten \};\n    let made = null;/);
  assert.match(LEGACY_TEXT.lineRefused('X.'), /^The realm would not keep your family's record\. X\. This device keeps it\.$/);
});

test('AUDIT LEGACY III U1/U2 (the pause window, by source - driven in Chromium): a held Enter or Space presses nothing (the Succession\'s own rule: Play as and Pass the mantle armed and fired on one held press); the keyboard comes into the window - a Tab from outside lands on its first control, and the window takes the focus as it mounts', () => {
  const src = rd('src/ui/pauseDoor.js');
  assert.match(src, /host\.addEventListener\?\.\('keydown', \(e\) => \{\n    if \(e\.repeat && \(e\.key === 'Enter' \|\| e\.key === ' '\)\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); \}\n  \}, true\);/, 'U1');
  assert.match(src, /document\.addEventListener\?\.\('keydown', tabIn, true\);/, 'U2: the Tab from outside');
  assert.match(src, /const close = \(\) => \{\n    if \(fired\) return;\n    dropAscend\(\);[^\n]*\n    document\.removeEventListener\?\.\('keydown', tabIn, true\);/, 'U2: gone with the window');
  assert.match(src, /view = mountEnhancedMenu\(host, \{ mode: 'pause', hooks, onAction: act, at: hooks\.at \?\? null \}\);\n      focusIn\(\);   \/\/ AUDIT LEGACY III U2/, 'U2: the focus taken as it mounts');
  assert.match(src, /const to = host\.querySelector\?\.\('\.px-tabs button\.on'\) \?\? host\.querySelector\?\.\('button:not\(\[disabled\]\)'\);/);
});
