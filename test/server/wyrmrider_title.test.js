// WYRM-RIDER (2026-10-30, the owner: "we need a title thats basd ass for this DRAGON TAMER", "perfect titles", "DONT COUNT
// ADMINS"): a tamed brass Dwarven Dragon holds Wyrm Rider, a tamed Aetherbright Aether Rider; the earliest tame of each
// look - a developer's never counted - holds its First. Derived from the service's own rows (dragon_mounts) as the Marks of
// Mastery are - held on the wardrobe, worn, signed into the token - and worn on a metal plate (ui/titleFlame.js plateCss).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { verifyToken, TITLES } from '../../src/net/identityToken.js';
import { masteryMarksOf, MASTERY_MARKS, DRAGON_TITLES } from '../../src/net/huntLaw.js';
import { withMasteryMarksAll } from '../../server-account/src/hunts.js';
import { DRAGON_TAME_ONE_IN } from '../../server-account/src/dragons.js';
import { DRAGON_TAME_ODDS, WARDROBE } from '../../src/ui/collections/wardrobeCatalogue.js';
import { TITLE_TEXT, titleBadge, titlePaint } from '../../src/ui/playerBadge.js';
import { plateCss, setTitleFlame, PLATE_CLASS, plateClassOf, TITLE_PLATE } from '../../src/ui/titleFlame.js';
import { utcDay } from '../../src/net/marksLaw.js';

const { subtle } = globalThis.crypto;
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const RIDERS = ['wyrmrider', 'firstwyrmrider', 'aetherrider', 'firstaetherrider'];

test('WYRM-RIDER THE LAW: a brass tame holds Wyrm Rider, an Aetherbright Aether Rider, each First beside its own; none without a dragon (mutants: a First without its dragon; the Aether Rider off a brass tame)', () => {
  assert.deepEqual(DRAGON_TITLES, { rider: 'wyrmrider', first: 'firstwyrmrider', aether: 'aetherrider', firstAether: 'firstaetherrider' });
  assert.deepEqual(masteryMarksOf({}), []);
  assert.deepEqual(masteryMarksOf({ dragons: 1 }), ['wyrmrider']);
  assert.deepEqual(masteryMarksOf({ dragons: 2, firstTame: true }), ['wyrmrider', 'firstwyrmrider']);
  assert.deepEqual(masteryMarksOf({ aethers: 1, firstAether: true }), ['aetherrider', 'firstaetherrider']);
  assert.deepEqual(masteryMarksOf({ dragons: 0, aethers: 0, firstTame: true, firstAether: true }), [], 'no dragon, no title');
  assert.deepEqual(masteryMarksOf({ dragons: 0, aethers: 1, firstTame: true }), ['aetherrider'], 'the brass First asks a brass dragon');
  assert.deepEqual(TITLES.slice(-11, -7) /* PIN MOVED (BLOOD-OF-COLDHARBOUR): Blood of Coldharbour joined the list last */, RIDERS, 'the token\'s vocabulary, after Genesis');   // PIN MOVED (STOREFRONT): the shop's three name visuals and the Folios' three joined the list after them
  for (const k of RIDERS) assert.ok(MASTERY_MARKS.includes(k) && WARDROBE.title[k]?.src === 'dragon', k);
  assert.deepEqual(RIDERS.map((k) => TITLE_TEXT[k]), ['Wyrm Rider', 'First Wyrm Rider', 'Aether Rider', 'First Aether Rider']);
  assert.equal(WARDROBE.title.firstwyrmrider.avail, 'closed');
  assert.equal(WARDROBE.title.firstaetherrider.avail, 'closed');
  assert.equal(DRAGON_TAME_ODDS, DRAGON_TAME_ONE_IN, 'the wardrobe says the service\'s own odds');
});

test('WYRM-RIDER THE PLATE: each rider title is worn on a metal plate - its rule, its classes on a face, its letters one colour with no gradient under the plate (mutants: a plate with no rule; a gradient clipped under it)', () => {
  assert.deepEqual(Object.keys(TITLE_PLATE), ['wyrmrider', 'aetherrider', 'firstwyrmrider', 'firstaetherrider']);
  const css = plateCss();
  for (const k of RIDERS) {
    assert.ok(css.includes(`.${plateClassOf(k)}::before`) && css.includes(`.${plateClassOf(k)}::after`), k);
    const b = titleBadge({ title: k });
    assert.deepEqual([b.plate, b.flame], [true, true], `${k}: a plate every face lays`);
    assert.equal(titlePaint(b).backgroundImage, '', `${k}: its letters never a clipped gradient`);
  }
  assert.equal(titleBadge({ title: 'serpenthunter' }).plate, false);
  const classes = new Set();
  const node = { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) }, ownerDocument: null };
  setTitleFlame(node, 'aetherrider');
  assert.deepEqual([...classes].sort(), [PLATE_CLASS, plateClassOf('aetherrider')].sort());
  setTitleFlame(node, 'genesis');
  assert.ok(!classes.has(PLATE_CLASS), 'another title takes the plate off');
});

test('WYRM-RIDER THE SERVICE: the rows grant them - held on the wardrobe, worn, signed into the token; each look\'s earliest tame its First, a developer\'s passed over; a board\'s batch reads the same (mutants: the First read off any look; a developer\'s tame counted)', async (t) => {
  let clock = NOON * 1000;
  t.mock.method(Date, 'now', () => clock);
  const s = await standService({ DEVELOPER_HANDLES: 'builder' });
  const raw = s.env.DB._raw;
  const dev = await s.seated('Builder');
  const a = await s.seated('Rider');
  const b = await s.seated('Second');
  const wardrobe = async (who) => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json()).wardrobe;
  const mine = async (who) => (await wardrobe(who)).titles.filter((x) => RIDERS.includes(x));
  assert.deepEqual(await mine(a), []);
  const tame = (id, who, look, at) => raw.prepare('INSERT INTO dragon_mounts (id, account, char_id, look, watch, at) VALUES (?, ?, ?, ?, 1, ?)').run(id, who.id, `${who.character}-${id}`, look, at);
  tame('d-dev', dev, 0, 10);
  tame('d-dev2', dev, 1, 20);
  tame('d-b', b, 0, 200);
  tame('d-a', a, 0, 100);
  tame('d-b2', b, 1, 300);
  assert.deepEqual(await mine(dev), ['wyrmrider', 'aetherrider'], 'a developer rides, and is never a First');
  assert.deepEqual(await mine(a), ['wyrmrider', 'firstwyrmrider'], 'the earliest brass tame past the developer\'s');
  assert.deepEqual(await mine(b), ['wyrmrider', 'aetherrider', 'firstaetherrider'], 'a later brass tame, the earliest Aetherbright');
  const rows = raw.prepare('SELECT * FROM players WHERE id IN (?, ?, ?)').all(dev.id, a.id, b.id);
  const batch = await withMasteryMarksAll({ db: s.env.DB }, rows, s.env);
  const want = { [dev.id]: ['wyrmrider', 'aetherrider'], [a.id]: ['wyrmrider', 'firstwyrmrider'], [b.id]: ['wyrmrider', 'aetherrider', 'firstaetherrider'] };
  for (const r of batch) assert.deepEqual(r.masteryMarks.filter((x) => RIDERS.includes(x)), want[r.id]);
  assert.equal((await s.call('/v1/account/title', { title: 'firstwyrmrider' }, b.secret)).status, 403, 'not the first');
  assert.equal((await s.call('/v1/account/title', { title: 'firstaetherrider' }, b.secret)).status, 200, 'worn');
  const tok = (await s.call('/v1/auth/token', { secret: b.secret, character: b.character })).body.token;
  const v = await verifyToken(tok, s.identityPublic, { subtle, nowS: NOON });
  assert.ok(v.ok, v.why);
  assert.equal(v.claims.t, 'firstaetherrider', 'signed into the token');
  clock += 1;
});
