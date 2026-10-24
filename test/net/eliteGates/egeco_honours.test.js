// EG-E2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, FEATS OF THE SPIRE
// and THE HONOURS): WHAT THE ACCOUNT KEEPS OF THE SPIRE - each lord's feats OR'ed (`eg_feats`), never a Rehearsal's, a
// band's all held its Master; the Annals' pages an end said (`players.eg_annals`); the honours a recorded Redoubt grants
// (`players.eg_honours`: Spirewalker, Beacon-Lighter, Kynbane and Beaconlight, the Unfallen, the Lone Beacon, Battlemage of
// the Spire, Wellhead-Walker and The Burning Stair, the four Masters); Spire Champion, a Descent bracket's top ten held
// through the next season (`eg_champions`); First of the Spire by name, from config. And the thirteen titles and three
// auras in the token's vocabulary, the badge's words and paint, and the three new looks, run. The real Worker over
// node:sqlite with every migration (test/accountDb.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../../accountDb.mjs';
import { mintEgReceipt, egReceiptValid, EG_ANNALS_BITS_MAX } from '../../../src/net/eliteGates/egReceipt.js';
import { EG_RECEIPT_TTL_S } from '../../../src/net/eliteGates/egReceipt.js';   // AUDIT EG IV (lane3 #13): a season's champions kept once its late ends are claimed
import { TITLES, AURAS, mintToken, verifyToken } from '../../../src/net/identityToken.js';
import { readAura } from '../../../src/net/wire.js';
import { arenaSeasonOf, arenaSeasonEndsS } from '../../../src/net/arena/arenaLaw.js';
import { EG_FEAT_BANDS } from '../../../src/net/eliteGates/egFeats.js';
import {
  EG_HONOUR, EG_HONOUR_TITLES, EG_HONOUR_AURA, EG_BAND_MASTERS, egHonourBitsOf, egMasterBitsOf, egHonourTitlesOf, _resetEgHonoursCache,
} from '../../../server-account/src/egHonours.js';
import { titlesHeld, aurasHeld, egFirstHandles, isSpireFirst } from '../../../server-account/src/titles.js';
import { TITLE_TEXT, TITLE_RGBA, AURA_TEXT, AURA_PAINT, SPIRE_BEACON, SPIRE_EMBER, SPIRE_DAWN, badgeCss, cssRgba } from '../../../src/ui/playerBadge.js';
import {
  AURA_LOOK, AURA_FS, AURA_GROUND_R, BEACONLIGHT_R, BEACON_H, BEACON_LIGHTS, BEACON_HZ, STAIR_R, STAIR_W, STAIR_H, STAIR_STEPS, STAIR_HZ,
  DAWN_R, DAWN_H, SPIRE_RGB, spireRatesWhole, beaconLit,
  DAWN_RING_M, DAWN_INNER_M, DAWN_REDOUBTS, DAWN_START, DAWN_SPIRE_H, DAWN_RAYS, DAWN_RAY_M, DAWN_VEIL_H, DAWN_HZ, DAWN_CLIMB, DAWN_MOTES,
  dawnClimb, dawnMarkAngle, dawnSpireH, AURA_CLOCK_PERIOD,
} from '../../../src/render/auraRing.js';   // SPIRE-FIRST: Firstlight rebuilt - its climb's law and its measures
import { glslFunctions } from '../../glsl.mjs';

const { subtle } = globalThis.crypto;
const SPIRE_TITLES = ['spirewalker', 'beaconlighter', 'kynbane', 'unfallen', 'lonebeacon', 'battlemage', 'wellheadwalker', 'mastergallery', 'mastercairn', 'mastershade', 'masterwellhead', 'spirechampion', 'spirefirst'];
const SPIRE_AURAS = ['beaconlight', 'burningstair', 'firstlight'];
let bseq = 0;
const breach = () => (0x1000000000000 + ++bseq).toString(16).padStart(16, '0');
/** A service standing at `t0` and a clock to move. */
async function stood(t, t0 = T0) {
  let clock = t0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  _resetEgHonoursCache();
  const S = await standService();
  return { S, at: (s) => { clock = s * 1000; }, now: () => Math.floor(clock / 1000) };
}
/** A relay-signed receipt for `who` - a Redoubt's `w` by default - issued now. */
const receipt = (S, now, who, o) => mintEgReceipt({ q: 'w', b: breach(), s: who.id, z: 'z'.repeat(16), c: 7, w: 1, h: 5, t: 600, n: 1, ew: 0, l: 12, ...o }, S.gatePriv, { subtle, nowS: now() });
const claim = async (S, now, who, o) => (await S.call('/v1/eg/claim', { receipt: await receipt(S, now, who, o) }, who.secret)).body;
const wears = async (S, who, title) => (await S.call('/v1/account/title', { title }, who.secret)).status === 200;
const wearsAura = async (S, who, aura) => (await S.call('/v1/account/aura', { aura }, who.secret)).status === 200;
const rowOf = (S, who) => S.env.DB._raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id);

test('EG-E2 THE FEATS: a Redoubt\'s lord and its feats kept per account per lord, the bits OR\'ed across breaches; never a Rehearsal\'s; `/v1/eg/keys` answers them; a band\'s lords\' feats all held grant its Master - the claim that completes it says so, once (mutants: the bits replaced, not OR\'ed; a Rehearsal\'s kept; the Master never; the Master off one lord)', async (t) => {
  const { S, now } = await stood(t);
  const me = await S.registered('Featful');
  assert.equal((await claim(S, now, me, { lk: 'hound', ft: 0b001 })).recorded, true);
  await claim(S, now, me, { lk: 'hound', ft: 0b100 });
  await claim(S, now, me, { lk: 'spellmaster', ft: 0b111, rh: 1 });   // a Rehearsal: kept nothing
  const k = (await S.call('/v1/eg/keys', {}, me.secret)).body;
  assert.deepEqual(k.feats, { hound: 0b101 }, 'OR\'ed across two breaches; the Rehearsal\'s none');
  // THE GALLERIES' MASTER: every feat of its four lords
  const [galleries] = EG_FEAT_BANDS;
  assert.deepEqual([...galleries], ['hound', 'spellmaster', 'armsmaster', 'ilthys']);
  const answers = [];
  for (const lord of galleries) answers.push((await claim(S, now, me, { lk: lord, ft: 0b111 })).honours ?? null);
  assert.deepEqual(answers.slice(0, 3), [null, null, null], 'no Master before the band is whole');
  assert.ok(answers[3].includes('mastergallery'), 'the claim that completes the band says its Master');
  assert.ok(await wears(S, me, 'mastergallery'), 'and the title is held');
  assert.equal(await wears(S, me, 'mastercairn'), false, 'no other band\'s');
  assert.equal((await claim(S, now, me, { lk: 'hound', ft: 0b111 })).honours, undefined, 'said once - a later claim grants nothing new');
  // the law, pure
  const all = Object.fromEntries(EG_FEAT_BANDS.flat().map((l) => [l, 7]));
  assert.equal(egMasterBitsOf(all), EG_HONOUR.mastergallery | EG_HONOUR.mastercairn | EG_HONOUR.mastershade | EG_HONOUR.masterwellhead);
  assert.equal(egMasterBitsOf({ ...all, wyrm: 3 }) & EG_HONOUR.masterwellhead, 0, 'one feat short is no Master');
  assert.deepEqual(EG_BAND_MASTERS.map((t) => TITLE_TEXT[t]), ['Master of the Galleries', 'Master of the Cairn', 'Master of the Shade', 'Master of the Wellhead']);
});

test('EG-E2 THE ANNALS: an end\'s `an` - a bit a page - OR\'ed onto the account (a Rehearsal\'s too: lore, not pay) and answered by `/v1/eg/keys`; the receipt law takes it on an end alone, a whole number of thirty bits (mutants: the pages replaced; `an` on a Redoubt; past thirty bits)', async (t) => {
  const { S, now } = await stood(t);
  const me = await S.registered('Reader');
  const end = (o) => ({ q: 'x', w: undefined, h: 4, why: 'home', ...o });
  assert.equal((await claim(S, now, me, end({ an: 0b101 }))).recorded, true);
  await claim(S, now, me, end({ an: 0b10 }));
  await claim(S, now, me, end({ an: 1 << 29, rh: 1, why: 'rehearsal' }));
  assert.equal((await S.call('/v1/eg/keys', {}, me.secret)).body.annals, 0b111 | (1 << 29));
  assert.equal(rowOf(S, me).eg_annals, 0b111 | (1 << 29));
  const x = { q: 'x', b: '0123456789abcdef', s: 'acct-1234', z: 'z'.repeat(16), c: 1, h: 3, t: 10, n: 1, ew: 0, l: 3, why: 'home', i: 1, e: 2 };
  assert.ok(egReceiptValid({ ...x, an: EG_ANNALS_BITS_MAX }));
  assert.equal(EG_ANNALS_BITS_MAX, 2 ** 30 - 1);
  for (const an of [-1, 2 ** 30, 1.5, '3']) assert.equal(egReceiptValid({ ...x, an }), false, `an ${an}`);
  assert.equal(egReceiptValid({ ...x, q: 'w', why: undefined, w: 1, an: 1 }), false, 'a Redoubt carries no pages');
});

test('EG-E2 THE HONOURS AT THE REDOUBTS: Spirewalker at Redoubt 2, Beacon-Lighter at 5, Kynbane and Beaconlight at 10, Battlemage of the Spire at 15, Wellhead-Walker and The Burning Stair at 20 - each claim saying the new ones alone, a deeper Redoubt holding the shallower; none from a Rehearsal (mutants: an honour off by one Redoubt; the aura without its title\'s bit; a Rehearsal granting; every honour said again)', async (t) => {
  const { S, now } = await stood(t);
  const me = await S.registered('Climber');
  const said = [];
  for (const w of [1, 2, 5, 9, 10, 15, 20]) said.push((await claim(S, now, me, { w, h: w * 5 })).honours ?? []);
  assert.deepEqual(said, [[], ['spirewalker'], ['beaconlighter'], [], ['kynbane'], ['battlemage'], ['wellheadwalker']], 'each the new ones alone (no `fl` said, no Unfallen)');
  for (const t2 of ['spirewalker', 'beaconlighter', 'kynbane', 'battlemage', 'wellheadwalker']) assert.ok(await wears(S, me, t2), t2);
  assert.ok(await wearsAura(S, me, 'beaconlight') && await wearsAura(S, me, 'burningstair'), 'the two auras with their titles');
  // a company that starts deeper takes the shallower honours with its first Redoubt
  const deep = await S.registered('DeepStart');
  assert.deepEqual((await claim(S, now, deep, { w: 12, h: 60, ew: 10 })).honours, ['spirewalker', 'beaconlighter', 'kynbane']);
  // a Rehearsal grants nothing, however deep its receipt says
  const rh = await S.registered('Rehearser');
  assert.equal((await claim(S, now, rh, { w: 20, h: 100, rh: 1 })).honours, undefined);
  assert.equal(rowOf(S, rh).eg_honours, 0);
  assert.equal(await wears(S, rh, 'spirewalker'), false);
  // the law, pure
  assert.equal(egHonourBitsOf({ q: 'w', w: 4, fl: 0, ew: 0 }), EG_HONOUR.spirewalker);
  assert.equal(egHonourBitsOf({ q: 'w', w: 20, fl: 1, ew: 0, rh: 1 }), 0);
  assert.equal(egHonourBitsOf({ q: 'x', w: 20, fl: 0, ew: 0 }), 0, 'an end grants none');
  assert.deepEqual(egHonourTitlesOf(EG_HONOUR.kynbane | EG_HONOUR.lonebeacon), ['kynbane', 'lonebeacon']);
});

test('EG-E2 THE UNFALLEN AND THE LONE BEACON: the Unfallen asks Redoubt 10 with no fall (`fl` 0) in a breach begun at Hall 1 (`ew` 0) - a fall, a deeper start or a receipt that says no falls at all never; the Lone Beacon a Court felled alone (`lb` 1) (mutants: the fall unread; the start unread; `lb` unread)', async (t) => {
  const { S, now } = await stood(t);
  const [clean, fell, deeper, silent, lone] = [await S.registered('Clean'), await S.registered('Fell'), await S.registered('Deeper'), await S.registered('Silent'), await S.registered('Lone')];
  await claim(S, now, clean, { w: 10, h: 50, fl: 0, ew: 0 });
  await claim(S, now, fell, { w: 10, h: 50, fl: 1, ew: 0 });
  await claim(S, now, deeper, { w: 10, h: 50, fl: 0, ew: 2 });
  await claim(S, now, silent, { w: 11, h: 55, ew: 0 });
  await claim(S, now, lone, { w: 3, h: 15, lb: 1 });
  assert.deepEqual([await wears(S, clean, 'unfallen'), await wears(S, fell, 'unfallen'), await wears(S, deeper, 'unfallen'), await wears(S, silent, 'unfallen')], [true, false, false, false]);
  assert.ok(await wears(S, fell, 'kynbane'), 'a fall still takes Kynbane');
  assert.deepEqual([await wears(S, lone, 'lonebeacon'), await wears(S, clean, 'lonebeacon')], [true, false]);
  assert.equal(egHonourBitsOf({ q: 'w', w: 10, fl: 0, ew: 0 }) & EG_HONOUR.unfallen, EG_HONOUR.unfallen);
  assert.equal(egHonourBitsOf({ q: 'w', w: 10, ew: 0 }) & EG_HONOUR.unfallen, 0, 'no `fl` is no proof');
});

test('EG-E2 SPIRE CHAMPION: each Descent bracket\'s top ten companies at a season\'s end hold the title through the next season - every member, kept in eg_champions by the new season\'s first read - and not the eleventh, not the season after (mutants: the top eleven; the champions of this season, not the last; never kept)', async (t) => {
  const { S, at, now } = await stood(t);
  const season = arenaSeasonOf(now());
  const solos = [];
  for (let i = 0; i < 11; i++) solos.push(await S.registered(`Solo${String.fromCharCode(97 + i)}`));
  // eleven alone, each a hall deeper than the last; and one company of three
  for (const [i, who] of solos.entries()) await claim(S, now, who, { q: 'x', w: undefined, why: 'home', h: 30 - i, t: 1000, td: 900 });
  const co = [await S.registered('Trio'), await S.registered('Duo'), await S.registered('Uno')];
  const cb = breach();
  for (const who of co) await S.call('/v1/eg/claim', { receipt: await mintEgReceipt({ q: 'x', b: cb, s: who.id, z: 'z'.repeat(16), c: 3, h: 12, t: 800, n: 3, ew: 0, l: 9, why: 'home' }, S.gatePriv, { subtle, nowS: now() }) }, who.secret);
  assert.equal(await wears(S, solos[0], 'spirechampion'), false, 'nobody holds it in the season being run');
  // THE NEXT SEASON: its first read keeps the last one's top tens - PIN MOVED (AUDIT EG IV, lane3 #13): at its first minute
  // they were kept; now the standing is worn as it is until the season is a receipt's life past its end, and kept then
  at(arenaSeasonEndsS(season) + 60);
  _resetEgHonoursCache();
  assert.ok(await wears(S, solos[0], 'spirechampion'), 'the first alone holds it at once');
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM eg_champions WHERE season = ?').get(season).n, 0, 'worn, not yet kept');
  at(arenaSeasonEndsS(season) + EG_RECEIPT_TTL_S + 60);
  _resetEgHonoursCache();
  assert.ok(await wears(S, solos[0], 'spirechampion'), 'the first alone holds it');
  assert.ok(await wears(S, solos[9], 'spirechampion'), 'the tenth');
  assert.equal(await wears(S, solos[10], 'spirechampion'), false, 'never the eleventh');
  for (const who of co) assert.ok(await wears(S, who, 'spirechampion'), `the Few's company, every member (${who.handle})`);
  const kept = S.env.DB._raw.prepare('SELECT bracket, COUNT(*) AS n FROM eg_champions WHERE season = ? GROUP BY bracket ORDER BY bracket').all(season);
  assert.deepEqual(kept.map((r) => [r.bracket, r.n]), [['alone', 10], ['few', 3]]);
  const tok = await verifyToken((await S.call('/v1/auth/token', {}, solos[0].secret)).body.token, S.identityPublic, { subtle, nowS: now() });
  assert.equal(tok.claims.t, 'spirechampion', 'worn, it rides the token');
  // THE SEASON AFTER: held through the next season alone
  at(arenaSeasonEndsS(season + 1) + 60);
  _resetEgHonoursCache();
  assert.equal(await wears(S, solos[0], 'spirechampion'), false, 'gone the season after');
  assert.deepEqual(titlesHeld({ handle: 'G', eg: { champion: true } }, {}).includes('spirechampion'), true);
  assert.deepEqual(titlesHeld({ handle: null, eg_honours: 4 }, {}).includes('kynbane'), false, 'a guest row holds no Spire honour');
});

test('EG-E2 FIRST OF THE SPIRE: granted as Hour\'s First is - a list in config (EG_FIRST_HANDLES, in wrangler.toml; SPIRE-FIRST: the account Serveride, who took Redoubt 10 first, alone), the title and Firstlight while listed, any case, never a guest or a near name - nor his character\'s name, which the herald read (SPIRE-FIRST-NAME) (mutants: the list not read; the aura without the list; a guest by name; Serveride left off; the character\'s name listed)', () => {
  const m = /^EG_FIRST_HANDLES = "([^"]*)"$/m.exec(readFileSync(new URL('../../../server-account/wrangler.toml', import.meta.url), 'utf8'));
  assert.ok(m, 'a var beside Hour\'s First\'s');
  assert.equal(m[1], 'Serveride', 'SPIRE-FIRST: the first company\'s account, and nobody else (PIN MOVED: it read empty until that company came; SPIRE-FIRST-NAME: then Severide, his character\'s name off the herald, which no account\'s handle is)');
  const named = { EG_FIRST_HANDLES: m[1] }, acct = (handle) => ({ handle, created_at: 1_900_000_000, registered_at: 1_900_000_000 });
  for (const h of ['Serveride', 'serveride', 'SERVERIDE']) assert.ok(titlesHeld(acct(h), named).includes('spirefirst') && aurasHeld(acct(h), named).includes('firstlight'), `${h}: the title and Firstlight, as the deployed list names him`);
  for (const h of ['Severide', 'Serverid', 'Serveride2', 'Server ide']) assert.ok(!isSpireFirst(acct(h), named), `${h}: another account - Severide his character\'s name, never a handle the list grants`);
  const env = { EG_FIRST_HANDLES: ' Vanguard , Rook' };
  assert.deepEqual([...egFirstHandles(env)].sort(), ['rook', 'vanguard']);
  const row = (handle) => ({ handle, created_at: 1_900_000_000, registered_at: 1_900_000_000 });
  assert.deepEqual([isSpireFirst(row('VANGUARD'), env), isSpireFirst(row('Other'), env), isSpireFirst({ handle: null, guest_name: 'Rook' }, env)], [true, false, false]);
  assert.ok(titlesHeld(row('rook'), env).includes('spirefirst') && aurasHeld(row('rook'), env).includes('firstlight'));
  assert.ok(!titlesHeld(row('rook'), {}).includes('spirefirst') && !aurasHeld(row('rook'), {}).includes('firstlight'), 'off the list, neither');
});

test('EG-E2 THE VOCABULARY AND THE BADGE: the thirteen titles and three auras join the closed lists last (CSS-safe ids, none longer than the token was sized for); each title its words and a colour no other title wears, its button\'s rule; each aura its words, its title\'s paint and a look of its own kind; the row\'s bits are the titles; signed into the token and kept by the wire (mutants: a colour shared; an aura in another\'s paint; a kind shared; a title dropped)', async () => {
  assert.deepEqual(TITLES.slice(-23, -10) /* PIN MOVED (KETCH): the Skyfarer joined the list last */ /* PIN MOVED (WITCH1): Witchwarden and Hearthkeeper joined the list last */ /* PIN MOVED (STAR8): the Starwarden joined the list after the questlines' five, before the festival's two */, SPIRE_TITLES);   // PIN MOVED (QL12): the questlines' five joined the list last, after the WikiMaid; PIN MOVED (WIKIMAID): the WikiMaid joined the list last
  assert.deepEqual(AURAS.slice(-5, -2) /* PIN MOVED (WITCH1): Witchfire joined the list last */, SPIRE_AURAS);   // PIN MOVED (WIKIMAID): the Lilac Warren joined the list last
  assert.deepEqual([...EG_HONOUR_TITLES], SPIRE_TITLES.slice(0, 11), 'the row\'s bits in the table\'s order');
  assert.deepEqual({ ...EG_HONOUR_AURA }, { kynbane: 'beaconlight', wellheadwalker: 'burningstair' });
  for (const id of SPIRE_TITLES) assert.ok(/^[a-z]{1,14}$/.test(id), `title id ${id}`);
  for (const id of SPIRE_AURAS) assert.ok(/^[a-z]{1,12}$/.test(id), `aura id ${id}`);
  assert.deepEqual(SPIRE_TITLES.map((k) => TITLE_TEXT[k]), ['Spirewalker', 'Beacon-Lighter', 'Kynbane', 'The Unfallen', 'The Lone Beacon', 'Battlemage of the Spire', 'Wellhead-Walker', 'Master of the Galleries', 'Master of the Cairn', 'Master of the Shade', 'Master of the Wellhead', 'Spire Champion', 'First of the Spire']);
  assert.deepEqual(SPIRE_AURAS.map((k) => AURA_TEXT[k]), ['Beaconlight', 'The Burning Stair', 'Firstlight']);
  assert.equal(new Set(TITLES.map((k) => cssRgba(TITLE_RGBA[k]))).size, TITLES.length, 'no two titles share a colour');
  assert.deepEqual([TITLE_RGBA.beaconlighter, TITLE_RGBA.wellheadwalker, TITLE_RGBA.spirefirst], [SPIRE_BEACON, SPIRE_EMBER, SPIRE_DAWN]);
  assert.deepEqual(SPIRE_AURAS.map((a) => AURA_PAINT[a]), ['kynbane', 'wellheadwalker', 'spirefirst']);
  const css = badgeCss();
  for (const k of SPIRE_TITLES) assert.ok(css.includes(`.card button.acttitle.tl-${k} { color: ${cssRgba(TITLE_RGBA[k])}; }`), k);
  for (const a of SPIRE_AURAS) assert.ok(css.includes(`.card button.acttitle.actaura.aura-${a} { color: ${cssRgba(TITLE_RGBA[AURA_PAINT[a]])}; }`), a);
  assert.deepEqual(SPIRE_AURAS.map((a) => AURA_LOOK[a].kind), [9, 10, 11]);   // PIN MOVED (the fifth merge of main): SERPENT5's Maelstrom took kind 8 on main first
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  // the row's bits, read
  const row = { handle: 'Bearer', created_at: 1_900_000_000, registered_at: 1_900_000_000, eg_honours: EG_HONOUR.kynbane | EG_HONOUR.wellheadwalker | EG_HONOUR.mastershade };
  assert.deepEqual(titlesHeld(row, {}).filter((x) => SPIRE_TITLES.includes(x)), ['kynbane', 'wellheadwalker', 'mastershade']);
  assert.deepEqual(aurasHeld(row, {}).filter((x) => SPIRE_AURAS.includes(x)), ['beaconlight', 'burningstair']);
  assert.deepEqual(aurasHeld({ ...row, eg_honours: EG_HONOUR.mastershade }, {}).filter((x) => SPIRE_AURAS.includes(x)), [], 'an aura with its title\'s bit alone');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-spire', n: 'Bearer', k: 'linked', t: 'battlemage', au: 'burningstair' }, kp.privateKey, { subtle, nowS: 1_900_000_000 });
  const got = await verifyToken(tok, kp.publicKey, { subtle, nowS: 1_900_000_000 });
  assert.deepEqual([got.claims.t, got.claims.au], ['battlemage', 'burningstair']);
  assert.equal(readAura({ au: 'firstlight' }), 'firstlight');
});

// ── the looks, run ────────────────────────────────────────────────────

const lum = (c) => c[0] + c[1] + c[2];
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
const fns = (look, { t = 30.5, kindle = 1 } = {}) => glslFunctions(AURA_FS, {
  vP: [0, 0], vWorld: [0, 0, 0], uKind: 0, uAura: look.kind, uTime: t, uSeed: 0, uKindle: kindle, uRingR: look.ringR, uGroundR: AURA_GROUND_R,
  uFlameH: look.flameH, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.2, 5], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
  uResLit: Array(48).fill(0), dFdx: () => [0.001, 0, 0], dFdy: () => [0, 0.001, 0],
});
/** Mote `m`'s hashes, as the shader takes them (float64 here, as the evaluator runs). */
const hashes = (m, a, b, c, d) => [Math.sin(m * a + b) * 43758.5453, Math.sin(m * c + d) * 24634.6345].map((x) => x - Math.floor(x));
const fract = (x) => x - Math.floor(x);

test('EG-E2 THE SPIRE\'S THREE LOOKS, RUN: Beaconlight - its beacons lit one after another round the ring, a beacon just lit brighter than one about to be, its gold-white motes RISING; The Burning Stair - each step hotter than the one above it, the stair turning, its embers FALLING, kindled from over the head down; Firstlight - one crisp ring of the dawn\'s white; every rate whole over the clock (mutants: the motes falling; the embers rising; the stair\'s heat flat; the beacons lit at once; the kindle the wrong way)', () => {
  assert.ok(spireRatesWhole());
  assert.deepEqual([AURA_LOOK.beaconlight.ringR, AURA_LOOK.beaconlight.flameH, AURA_LOOK.burningstair.ringR, AURA_LOOK.burningstair.flameH, AURA_LOOK.firstlight.ringR, AURA_LOOK.firstlight.flameH], [BEACONLIGHT_R, BEACON_H, STAIR_R, STAIR_H, DAWN_R, DAWN_H]);
  assert.equal(SPIRE_RGB.dawn.length, 3);
  // BEACONLIGHT: the beacon just lit, against the one about to be lit
  const B = AURA_LOOK.beaconlight, TAU = Math.PI * 2;
  const tLit = 3 / BEACON_LIGHTS / BEACON_HZ.kindle + 0.05;   // beacon 3 a twentieth of a second after its lighting
  assert.equal(beaconLit(3 / BEACON_LIGHTS * TAU, tLit).k, 3);
  assert.ok(beaconLit(3 / BEACON_LIGHTS * TAU, tLit).age < 0.01 && beaconLit(2 / BEACON_LIGHTS * TAU, tLit).age > 0.1);
  const g = fns(B, { t: tLit });
  const just = lum(g.beaconGround(polar(BEACONLIGHT_R, 3 / BEACON_LIGHTS * TAU))), before = lum(g.beaconGround(polar(BEACONLIGHT_R, 4 / BEACON_LIGHTS * TAU))), between = lum(g.beaconGround(polar(BEACONLIGHT_R, 3.5 / BEACON_LIGHTS * TAU)));
  assert.ok(just > before * 1.5, `just lit (${just.toFixed(3)}) over about to be (${before.toFixed(3)})`);
  assert.ok(before > between, 'a beacon unlit still stands on the ring');
  // its motes rise: mote 0 where the law puts it, now and a little later, higher
  const [h1, h2] = hashes(0, 91.17, 0.7, 33.71, 2.9);
  const mv = (t) => fract(t * BEACON_HZ.mote + h2);
  const mu = (v) => fract(h1 - 0.04 * Math.sin(TAU * (v * 2 + h1)) / (TAU * BEACONLIGHT_R));   // round the ring, its sway taken out
  const t0 = (0.3 - h2 + 5) / BEACON_HZ.mote % (1 / BEACON_HZ.mote);   // mote 0 at three tenths of its climb
  const w0 = fns(B, { t: t0 }), w1 = fns(B, { t: t0 + 0.5 });
  assert.ok(Math.abs(mv(t0) - 0.3) < 1e-9 && mv(t0 + 0.5) > mv(t0), 'its law climbs');
  assert.ok(lum(w0.beaconWall([mu(mv(t0)), mv(t0)])) > lum(w0.beaconWall([mu(mv(t0)), mv(t0) + 0.15])) + 0.1, 'the mote where the law puts it');
  assert.ok(lum(w1.beaconWall([mu(mv(t0 + 0.5)), mv(t0 + 0.5)])) > lum(w1.beaconWall([mu(mv(t0)), mv(t0)])) + 0.1, 'and higher half a second on');
  // THE BURNING STAIR: the step below hotter than the one above, and the stair turning
  const ST = AURA_LOOK.burningstair, ts = 12.0;
  const stepAt = (k, t) => (k + 0.5) / STAIR_STEPS * TAU + t * STAIR_HZ.descend * TAU;   // the middle of step k at t
  const sg = fns(ST, { t: ts }), r = STAIR_R - STAIR_W / 2;
  const hot = lum(sg.stairGround(polar(r, stepAt(STAIR_STEPS - 1, ts)))), cold = lum(sg.stairGround(polar(r, stepAt(0, ts))));
  assert.ok(hot > cold * 2, `its last step hotter than its first (${hot.toFixed(3)} vs ${cold.toFixed(3)})`);
  assert.ok(lum(sg.stairGround(polar(r - 0.15, stepAt(STAIR_STEPS - 1, ts)))) < hot / 2, 'the tread a band, not the floor');
  const later = fns(ST, { t: ts + 1 / STAIR_HZ.descend / STAIR_STEPS });   // a step's turn later: the hot step has moved on
  assert.ok(Math.abs(lum(later.stairGround(polar(r, stepAt(STAIR_STEPS - 1, ts + 1 / STAIR_HZ.descend / STAIR_STEPS)))) - hot) < 0.05, 'the same step where the stair has turned it');
  // its embers fall: ember 0, now and a little later, lower
  const [e1, e2] = hashes(0, 57.31, 1.3, 21.77, 4.1);
  const ev = (t) => 1 - fract(t * STAIR_HZ.ember + e2);
  const eu = (v) => fract(e1 - 0.05 * Math.sin(TAU * (v + e1)) / (TAU * STAIR_R));   // its drift taken out
  const te = ((1 - 0.6) - e2 + 5) / STAIR_HZ.ember % (1 / STAIR_HZ.ember);   // ember 0 at six tenths of the height
  const s0 = fns(ST, { t: te }), s1 = fns(ST, { t: te + 0.4 });
  assert.ok(Math.abs(ev(te) - 0.6) < 1e-9 && ev(te + 0.4) < ev(te), 'its law falls');
  assert.ok(lum(s0.stairWall([eu(ev(te)), ev(te)])) > lum(s0.stairWall([eu(ev(te)), ev(te) - 0.2])) + 0.1, 'the ember where the law puts it');
  assert.ok(lum(s1.stairWall([eu(ev(te + 0.4)), ev(te + 0.4)])) > lum(s1.stairWall([eu(ev(te)), ev(te)])) + 0.1, 'and lower on');
  // kindled DOWN, where Beaconlight kindles up: part kindled, the stair's foot is dark and its ember lit; Beaconlight's foot lit
  const part = fns(ST, { t: te, kindle: 0.6 }), bpart = fns(B, { t: t0, kindle: 0.6 });
  assert.ok(lum(s0.stairWall([0.37, 0.05])) > 0, 'the stair\'s foot glows, kindled');
  assert.equal(lum(part.stairWall([0.37, 0.05])), 0, 'and is dark while it kindles from above');
  assert.ok(lum(part.stairWall([eu(ev(te)), ev(te)])) > 0.1, 'its falling ember lit');
  assert.ok(lum(bpart.beaconWall([0.37, 0.05])) > 0, 'Beaconlight\'s foot lit while it kindles from below');
  assert.equal(lum(bpart.beaconWall([0.37, 0.95])), 0, 'its top dark');
  // FIRSTLIGHT: the ring crisp and near white, darker just past its line inside and out - read between two Redoubts (PIN
  // MOVED, SPIRE-FIRST: the dial's lit lane lies inside it now and the ring's glow reached a hand, so a hand no longer
  // told the line from its glow - EGECO2-dawn-ring-gone survived it; two centimetres, past the line's half-width, do)
  const F = AURA_LOOK.firstlight, fg = fns(F, { t: 7 }), apart = dawnMarkAngle(4) + Math.PI / DAWN_REDOUBTS;
  const ring = fg.dawnGround(polar(DAWN_R, apart)), inside = fg.dawnGround(polar(DAWN_R - 0.02, apart)), out = fg.dawnGround(polar(DAWN_R + 0.02, apart));
  assert.ok(lum(ring) > 1.5 * lum(inside) && lum(ring) > 1.5 * lum(out), `one crisp line (${[ring, inside, out].map((c) => lum(c).toFixed(2))})`);
  assert.ok(Math.min(...ring) / Math.max(...ring) > 0.7, `the dawn's white, not a colour (${ring.map((x) => x.toFixed(2))})`);
});

// ── SPIRE-FIRST: Firstlight, rebuilt as Serveride's own ─────────────────

/** Firstlight's functions at `t`, the eye at `eye` (the look's own uniforms otherwise). */
const dawnAt = (t, { kindle = 1, eye = [0, 1.2, 5] } = {}) => { const g = fns(AURA_LOOK.firstlight, { t, kindle }); g.globals.uCamPos = eye; return g; };
/** The clock at climb share `c`. */
const climbT = (c) => c / DAWN_HZ.climb;
/** Redoubt k's place on the wall: its share round the strip. */
const wallU = (k) => fract(dawnMarkAngle(k) / (Math.PI * 2));
const fullH = (k) => DAWN_SPIRE_H[0] + (DAWN_SPIRE_H[1] - DAWN_SPIRE_H[0]) * k / (DAWN_REDOUBTS - 1);

test('SPIRE-FIRST THE CLIMB\'S LAW: the ten Redoubts taken one after another, I first and X last, each at its moment; none before the climb, all down again before it starts over; a taking flares and fades; I at the climb\'s start round the ring and X last; every rate whole over the clock (mutants: taken at once; the order reversed; never down; the flare held)', () => {
  assert.ok(spireRatesWhole() && [1, 2].every((n) => Number.isInteger(Math.round(DAWN_HZ.mote * n * AURA_CLOCK_PERIOD * 1e6) / 1e6)), 'the motes\' two paces too');
  assert.deepEqual([DAWN_REDOUBTS, DAWN_START, DAWN_MOTES], [10, 0.25, 12]);
  const at = (k) => DAWN_CLIMB.at + k * DAWN_CLIMB.step;
  for (let k = 0; k < DAWN_REDOUBTS; k++) {
    const t = climbT(at(k) + DAWN_CLIMB.rise + 0.001);
    assert.ok(dawnClimb(k, t).taken > 0.99, `Redoubt ${k} up once risen`);
    if (k < DAWN_REDOUBTS - 1) assert.equal(dawnClimb(k + 1, t).taken, 0, `Redoubt ${k + 1} not yet`);
    if (k > 0) assert.ok(dawnClimb(k - 1, t).taken > 0.99, `Redoubt ${k - 1} still up`);
    assert.ok(dawnClimb(k, climbT(at(k) + 1e-6)).flare > 0.99 && dawnClimb(k, climbT(at(k) - 1e-6)).flare === 0 && dawnClimb(k, climbT(at(k) + 0.1)).flare < 0.06, 'a flare at its taking, none before, gone after');
  }
  assert.ok(at(DAWN_REDOUBTS - 1) + DAWN_CLIMB.rise < DAWN_CLIMB.hold && DAWN_CLIMB.hold < DAWN_CLIMB.down && DAWN_CLIMB.down < 1, 'X stands, then all goes down, before the next climb');
  for (let k = 0; k < DAWN_REDOUBTS; k++) {
    assert.equal(dawnClimb(k, climbT(0.02)).taken, 0, 'nothing before the climb');
    assert.equal(dawnClimb(k, climbT(0.98)).taken, 0, 'all down at its end');
    assert.ok(dawnClimb(k, climbT(DAWN_CLIMB.hold - 0.01)).taken > 0.99, 'all up while the dawn holds');
    assert.ok(Math.abs(dawnSpireH(k, climbT(0.7)) - fullH(k)) < 1e-9 && Math.abs(dawnSpireH(k, climbT(0.02)) - 0.3 * fullH(k)) < 1e-9, 'a third, and whole');
  }
  assert.ok(dawnClimb(3, climbT(0.28) + 2 / DAWN_HZ.climb).taken === dawnClimb(3, climbT(0.28)).taken, 'again each climb');
  // round the ring: I a twentieth past the start, X nineteen twentieths, the start a quarter turn back from atan's zero
  const share = (a) => fract(a / (Math.PI * 2) + DAWN_START);
  assert.ok(Math.abs(share(dawnMarkAngle(0)) - 0.05) < 1e-12 && Math.abs(share(dawnMarkAngle(9)) - 0.95) < 1e-12);
});

test('SPIRE-FIRST FIRSTLIGHT\'S GROUND, RUN: the climb\'s lane lit round from I to where the climb has come, dark ahead of it, its head bright; a Redoubt taken filled with the dawn, one not yet an outline; X\'s star only once the dawn breaks; the sunburst\'s rays brightening as it does, long and short by turns, gold at the ring; the dawn\'s light running out across the ground at X\'s taking; no NaN at the middle; nothing before it kindles (mutants: the lane unlit; the lane lit whole; the faces never filled; the star always; the rays flat; the wave gone; the law\'s moments not the shader\'s)', () => {
  const lane = DAWN_R - DAWN_INNER_M / 2, ang = (s) => (s - DAWN_START) * Math.PI * 2;
  // mid-climb: I to V taken, VI not yet; the climb's head between them
  const mid = dawnAt(climbT(0.28)), reach = 0.05 + (0.28 - DAWN_CLIMB.at) / (DAWN_CLIMB.step * DAWN_REDOUBTS);
  const behind = lum(mid.dawnGround(polar(lane, ang(reach - 0.12)))), ahead = lum(mid.dawnGround(polar(lane, ang(reach + 0.12)))), head = lum(mid.dawnGround(polar(lane, ang(reach))));
  assert.ok(behind > ahead + 0.15, `the lane lit behind the climb (${behind.toFixed(3)}) and dark ahead (${ahead.toFixed(3)})`);
  assert.ok(head > behind + 0.3, `its head bright (${head.toFixed(3)})`);
  // a Redoubt's face, inside its lozenge off the ring's line: taken, filled; not yet, its outline alone
  const face = (g, k) => lum(g.dawnGround(polar(DAWN_R - 0.03, dawnMarkAngle(k))));
  assert.ok(face(mid, 4) > face(mid, 5) + 0.5, `V taken (${face(mid, 4).toFixed(3)}), VI not yet (${face(mid, 5).toFixed(3)})`);
  assert.ok(face(dawnAt(climbT(0.985)), 4) < face(mid, 4) - 2, 'and down again at the climb\'s end');
  // and long after its flare, off the lane (outside the ring's line): V taken, X not yet - the face's own light
  const late = dawnAt(climbT(0.45)), faceOut = (k) => lum(late.dawnGround(polar(DAWN_R + 0.03, dawnMarkAngle(k))));
  assert.ok(faceOut(4) > faceOut(9) + 2, `V filled (${faceOut(4).toFixed(3)}) long after its flare, X not yet (${faceOut(9).toFixed(3)})`);
  // X's star: its arm inward across the dial, past the lane, lit once the dawn breaks and dark before
  const held = dawnAt(climbT(0.7)), arm = (g) => lum(g.dawnGround(polar(DAWN_R - 0.2, dawnMarkAngle(9))));
  assert.ok(arm(held) > arm(mid) + 0.2, `X's star (${arm(held).toFixed(3)} against ${arm(mid).toFixed(3)})`);
  // THE SUNBURST at a ray's middle against between two rays, before the dawn and after; long and short by turns
  const rayAt = (g, t, j) => g.dawnGround(polar(DAWN_R + DAWN_RING_M + 0.08, ((j + 0.5) / DAWN_RAYS - t * DAWN_HZ.rays) * Math.PI * 2));
  const tm = climbT(0.28), th = climbT(0.7);
  assert.ok(lum(rayAt(held, th, 0)) > 1.8 * lum(rayAt(mid, tm, 0)), 'the rays brighten as the dawn breaks');
  assert.ok(lum(rayAt(held, th, 0)) > 2 * lum(held.dawnGround(polar(DAWN_R + DAWN_RING_M + 0.08, (1 / DAWN_RAYS - th * DAWN_HZ.rays) * Math.PI * 2))), 'a ray, and dark between');
  const tip = (j) => lum(held.dawnGround(polar(DAWN_R + DAWN_RING_M + DAWN_RAY_M[1] + 0.03, ((j + 0.5) / DAWN_RAYS - th * DAWN_HZ.rays) * Math.PI * 2)));
  assert.ok(tip(0) > 0.05 && tip(1) < tip(0) / 4, `a long ray reaches past a short one's tip (${tip(0).toFixed(3)}, ${tip(1).toFixed(3)})`);
  const g0 = rayAt(held, th, 0);
  assert.ok(g0[0] > g0[2] * 1.3, 'gold at the ring');
  // THE DAWN'S LIGHT running out across the ground at X's taking: between two rays, at its front, against a moment later
  const xAt = DAWN_CLIMB.at + 9 * DAWN_CLIMB.step, since = 0.03, front = DAWN_R + since * DAWN_CLIMB.wave;
  const gap = (g, t) => lum(g.dawnGround(polar(front, (1 / DAWN_RAYS - t * DAWN_HZ.rays) * Math.PI * 2)));
  assert.ok(gap(dawnAt(climbT(xAt + since)), climbT(xAt + since)) > gap(held, th) + 0.1, 'the wave at its front');
  // NO SEAM where the ring closes behind the wearer (atan's wrap, -x): a hair either side of it the same, on the ground -
  // the lane, a lozenge, the sunburst's rays - and on the wall, at four moments of the climb
  const eps = 1e-7;
  for (const c of [0.1, 0.28, 0.53, 0.7]) {
    const g = dawnAt(climbT(c) + 7);
    for (const r of [DAWN_R - 0.1, DAWN_R - 0.03, DAWN_R, DAWN_R + 0.06, DAWN_R + 0.2]) {
      const a = g.dawnGround(polar(r, Math.PI - eps)), b = g.dawnGround(polar(r, -Math.PI + eps));
      assert.ok(Math.abs(lum(a) - lum(b)) < 1e-3, `no seam at ${r} (climb ${c}): ${lum(a)} / ${lum(b)}`);
    }
    for (const y of [0.05, 0.3, 0.9, 1.6]) assert.ok(Math.abs(lum(g.dawnWall([1 - eps, y / DAWN_H])) - lum(g.dawnWall([eps, y / DAWN_H]))) < 1e-3, `no seam up the wall at ${y}`);
    // and where the sunburst's own round closes as it turns (its share's wrap) - a whole number of rays meets itself there
    const t = climbT(c) + 7, a0 = -fract(t * DAWN_HZ.rays) * Math.PI * 2;
    for (const r of [DAWN_R + 0.06, DAWN_R + 0.2]) assert.ok(Math.abs(lum(g.dawnGround(polar(r, a0 - 1e-6))) - lum(g.dawnGround(polar(r, a0 + 1e-6)))) < 1e-3, `the rays whole round at ${r}`);
  }
  // the middle, and unkindled
  assert.ok(held.dawnGround([0, 0]).every(Number.isFinite) && held.dawnGround([0.01, -0.02]).every(Number.isFinite), 'no NaN at the middle');
  assert.equal(lum(dawnAt(climbT(0.7), { kindle: 0 }).dawnGround(polar(DAWN_R, 1))), 0, 'nothing before it kindles');
});

test('SPIRE-FIRST FIRSTLIGHT\'S WALL, RUN: a spire off each Redoubt, lit at its foot and dark beside it, a third of itself until taken and whole after, I the lowest and X the tallest, white at its point; the veil gone by the shin; X\'s shaft of first light up past the head as it is taken, never from inside the ring; kindled up (mutants: the spires all one height; never rising; the shaft from inside; the shaft never; the veil past the shin)', () => {
  const held = dawnAt(climbT(0.7)), before = dawnAt(climbT(0.02));
  const at = (g, k, y, dx = 0) => lum(g.dawnWall([fract(wallU(k) + dx / (2 * Math.PI * DAWN_R)), y / DAWN_H]));
  const own = (g, k, y) => at(g, k, y) - at(g, k, y, 0.12);   // the spire's own light, the veil beside it taken off
  for (const k of [0, 4, 9]) {
    assert.ok(own(held, k, fullH(k) * 0.5) > 0.3, `spire ${k} lit, dark beside it`);
    assert.ok(at(held, k, fullH(k) * 0.6) > at(before, k, fullH(k) * 0.6) + 1.5, `spire ${k} whole once taken, a third before (the third is node's law, dawnSpireH)`);
  }
  for (const k of [4, 9]) assert.ok(own(before, k, fullH(k) * 0.15) > 0.2 && own(before, k, fullH(k) * 0.6) < 0.05, `spire ${k} before its taking: its third standing, nothing over it`);
  assert.ok(at(held, 0, fullH(4) * 0.8) < 0.1 && at(held, 9, fullH(4) * 0.8) > 0.3, 'I the lowest, X the tallest');
  const pt = held.dawnWall([wallU(4), fullH(4) * 0.97 / DAWN_H]);
  assert.ok(Math.min(...pt) / Math.max(...pt) > 0.75, `white at its point (${pt.map((x) => x.toFixed(2))})`);
  // the veil, off the spires: at the foot, and gone past the shin
  assert.ok(at(before, 2, 0.02, 0.2) > at(before, 2, DAWN_VEIL_H + 0.15, 0.2) + 0.05, 'its veil gone by the shin');
  // X's shaft: a moment after its taking, past the head over X; not before; not from inside the ring
  const xAt = DAWN_CLIMB.at + 9 * DAWN_CLIMB.step, shot = climbT(xAt + 0.06);
  assert.ok(at(dawnAt(shot), 9, 1.6) > 0.3, 'the shaft past the head');
  assert.ok(at(dawnAt(climbT(xAt - 0.01)), 9, 1.6) < 0.05, 'none before X is taken');
  assert.ok(at(dawnAt(shot, { eye: [0.1, 1.6, 0.2] }), 9, 1.6) < 0.05, 'none from inside the ring');
  // kindled up: part kindled, the foot lit and the top dark
  const part = dawnAt(climbT(0.7), { kindle: 0.6 });
  assert.ok(at(part, 9, 0.05) > 0.1 && at(part, 9, 1.6) === 0, 'kindled up');
});
