// GLYPH-WEAR (2026-10-02, Mac: "can we make it where players can also equip/unequip their glyphs"): A PLAYER TAKES A
// GLYPH OFF, AND PUTS IT BACK. The glyph stays TRUE of them - the token's `g`, which the rights read (/red, /dm, the
// staff commands) - and the ones taken off ride beside it as `gx`, which every face that draws a badge leaves out: the
// relay's `badged`, the board's and the letters' badge, my own stored session (the werewolf's skin).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { claimsValid } from '../../src/net/identityToken.js';
import { badged, readBadge } from '../../src/net/wire.js';
import { SESSION_KEY, adoptIdentity, keepSession, storedSession, accountRefusalText } from '../../src/net/accountClient.js';
import { glyphsOf, glyphsHidden, glyphsShown, glyphRefusal, wardrobeOf } from '../../server-account/src/titles.js';
import { standService } from '../accountDb.mjs';

const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('GLYPH-WEAR law: hidden is the stored choice read against what is true now; shown is the rest; only a true glyph may be pressed (mutants: a lapsed glyph still "hidden"; a glyph not true of the player hideable)', () => {
  const env = { DEVELOPER_HANDLES: 'Dev', MODERATOR_HANDLES: 'Dev' };
  const nowS = 2_000_000_000;
  const row = { handle: 'Dev', created_at: 1, glyphs_off: 'mod sprout' };
  assert.deepEqual(glyphsOf(row, env, nowS), ['dev', 'mod']);
  assert.deepEqual(glyphsHidden(row, env, nowS), ['mod'], 'the sprout is long gone - not "hidden", just not true');
  assert.deepEqual(glyphsShown(row, env, nowS), ['dev']);
  assert.deepEqual(wardrobeOf(row, env, nowS).glyphs, ['dev', 'mod'], 'the wardrobe still lists every glyph that is true');
  assert.deepEqual(wardrobeOf(row, env, nowS).glyphsOff, ['mod']);
  assert.equal(glyphRefusal('dev', row, env, nowS), null);
  assert.equal(glyphRefusal('dm', row, env, nowS), 'not-held');
  assert.equal(glyphRefusal('crown', row, env, nowS), 'no-glyph');
  assert.deepEqual(glyphsShown({ handle: 'Dev', created_at: 1 }, env, nowS), ['dev', 'mod'], 'a row that never chose shows everything');
});

test('GLYPH-WEAR service: /v1/account/glyph hides and shows; the token keeps `g` whole and signs `gx` beside it; the answer says both (mutants: the hidden glyph dropped from `g`, so /red goes with the paint)', async () => {
  const { call, registered } = await standService({ DEVELOPER_HANDLES: 'Mack', MODERATOR_HANDLES: 'Mack' });
  const me = await registered('Mack');
  let r = await call('/v1/account/glyph', { glyph: 'dev', on: false }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.glyphs.includes('dev') && r.body.glyphs.includes('mod'));
  assert.deepEqual(r.body.glyphsOff, ['dev']);
  let t = await call('/v1/auth/token', {}, me.secret);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  let c = claimsOf(t.body.token);
  assert.ok(c.g.includes('dev'), 'still signed as true - the rights read `g`');
  assert.deepEqual(c.gx, ['dev']);
  assert.deepEqual(t.body.glyphsOff, ['dev']);
  assert.ok(claimsValid(c));
  r = await call('/v1/account/glyph', { glyph: 'dev', on: true }, me.secret);
  assert.equal('glyphsOff' in r.body, false, 'none hidden is the answer it always was');
  t = await call('/v1/auth/token', {}, me.secret);
  c = claimsOf(t.body.token);
  assert.equal('gx' in c, false, 'nothing hidden is nothing signed');
  assert.equal('glyphsOff' in t.body, false);
  // refusals
  assert.equal((await call('/v1/account/glyph', { glyph: 'dm', on: false }, me.secret)).status, 403, 'not true of them');
  assert.equal((await call('/v1/account/glyph', { glyph: 'crown', on: false }, me.secret)).status, 400);
  assert.equal((await call('/v1/account/glyph', { glyph: 'dev', on: false })).status, 401, 'signed in or nothing');
  assert.equal(accountRefusalText('no-glyph').includes('glyph'), true);
});

test('GLYPH-WEAR token and relay: `gx` must be a non-empty list of `g`\'s own; `badged` leaves them out of the row while the attachment keeps them whole (mutants: a `gx` naming a glyph `g` never said; badged ignoring `gx`)', () => {
  const base = { s: 'abcd1234', n: 'Mack', k: 'linked', i: 1000, e: 1100, g: ['dev', 'mod'] };
  assert.ok(claimsValid({ ...base, gx: ['mod'] }));
  assert.equal(claimsValid({ ...base, gx: ['dm'] }), false, 'cannot hide what was never true');
  assert.equal(claimsValid({ ...base, gx: [] }), false, 'none is absent');
  assert.equal(claimsValid({ ...base, gx: ['mod', 'mod'] }), false);
  assert.equal(claimsValid({ ...base, g: undefined, gx: ['mod'] }), false);
  const attach = { title: 'developer', glyphs: ['dev', 'mod'], gx: ['dev'] };
  const row = badged({ id: 'x' }, attach);
  assert.deepEqual(row.glyphs, ['mod']);
  assert.equal('gx' in row, false, 'the hidden list itself is nobody else\'s');
  assert.deepEqual(attach.glyphs, ['dev', 'mod'], 'the attachment - what /red and /dm read - is whole');
  assert.equal('glyphs' in badged({}, { glyphs: ['dev'], gx: ['dev'] }), false, 'all hidden is no glyphs field');
  assert.deepEqual(readBadge(row).glyphs, ['mod']);
});

test('GLYPH-WEAR own screen: the stored session keeps the glyphs shown, so a hidden Shadow Fang is no skin here as it is none there (mutants: glyphsOff ignored)', () => {
  const s = memStore();
  keepSession(s, { id: 'abcd1234', name: 'Mob', kind: 'linked', sessionId: 'x', secret: 'sec' });
  adoptIdentity(s, { glyphs: ['shadowfang', 'disciple'], glyphsOff: ['shadowfang'], secret: 'sec' });
  assert.deepEqual(storedSession(s).glyphs, ['disciple']);
  adoptIdentity(s, { glyphs: ['shadowfang', 'disciple'], glyphsOff: [], secret: 'sec' });
  assert.deepEqual(storedSession(s).glyphs, ['shadowfang', 'disciple']);
  assert.ok(s.getItem(SESSION_KEY));
});
