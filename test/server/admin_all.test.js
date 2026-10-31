// ADMIN-ALL (2026-10-30, as the owner asked: Admins only, every
// cosmetic title and aura, always): AN ADMIN HOLDS EVERY COSMETIC THERE IS, derived from DEVELOPER_HANDLES at every ask
// (server-account/src/titles.js holdsAll). These pins drive what a one-off grant could not do: a ware added to the
// vocabulary later is held with no write, a moderator holds nothing more, a handle taken off the list (or an Admin cut
// off) holds only what the row earned, and the glyphs that are rights or facts are never handed out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  holdsAll, insigniaOf, titlesHeld, aurasHeld, iconsHeld, armoryHeld, glyphsOf, equipRefusal, auraRefusal,
  iconRefusal, armoryRefusal, wardrobeOf, TIER_GLYPH,
} from '../../server-account/src/titles.js';
import { TITLES, AURAS, ICONS, GLYPHS, titleClaimed } from '../../src/net/identityToken.js';
import { DRAGON_TITLES } from '../../src/net/huntLaw.js';
import { ARMORY_PIECES } from '../../src/net/armoryLaw.js';
import { INSIGNIA } from '../../src/net/insignia.js';
import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { FESTIVAL_WARES, accountWare } from '../../src/net/festivalLaw.js';
import { STAFF_GLYPHS } from '../../src/net/staffCommands.js';
import { shopCardOf } from '../../server-account/src/shop.js';

const NOW = 1_800_000_000;
const env = { DEVELOPER_HANDLES: 'admin1', MODERATOR_HANDLES: 'mod1' };
const admin = { id: 'a', handle: 'Admin1', registered_at: NOW - 9_999_999, created_at: NOW - 9_999_999 };
const mod = { id: 'm', handle: 'mod1', registered_at: NOW - 9_999_999, created_at: NOW - 9_999_999 };

test('ADMIN-ALL: an admin holds every title but a claim\'s, every aura, icon, armory piece and Broker offer', () => {
  assert.ok(holdsAll(admin, env));
  const titles = titlesHeld(admin, env);
  const first = [DRAGON_TITLES.first, DRAGON_TITLES.firstAether];   // WYRM-RIDER: a look's First is one tamer's
  for (const t of TITLES) assert.equal(titles.includes(t), !titleClaimed(t) && !first.includes(t), t);
  assert.deepEqual([...aurasHeld(admin, env)].sort(), [...AURAS].sort());
  assert.deepEqual(iconsHeld(admin, env), [...ICONS]);
  assert.deepEqual(armoryHeld(admin, env), ARMORY_PIECES.map((p) => p.key));
  assert.deepEqual(insigniaOf(admin, env), INSIGNIA.map((r) => r.id));
  for (const t of titles) assert.equal(equipRefusal(t, admin, env), null, t);
  for (const a of AURAS) assert.equal(auraRefusal(a, admin, env), null, a);
  for (const i of ICONS) assert.equal(iconRefusal(i, admin, env), null, i);
  for (const p of ARMORY_PIECES) assert.equal(armoryRefusal(p.slot, p.key, admin, env), null, p.key);
});

test('ADMIN-ALL: every ware every shop sells is held - the money shop, the Wyrd Sisters\' account wares, the Broker', () => {
  const titles = titlesHeld(admin, env), auras = aurasHeld(admin, env), glyphs = glyphsOf(admin, env, NOW), armory = armoryHeld(admin, env);
  for (const w of SHOP_WARES) {
    if (w.kind === 'title') assert.ok(titles.includes(w.key), w.id);
    if (w.kind === 'aura') assert.ok(auras.includes(w.key), w.id);
    if (w.kind === 'glyph') assert.ok(glyphs.includes(w.key), w.id);
    if (w.kind === 'armory') assert.ok(armory.length === ARMORY_PIECES.length, w.id);
  }
  for (const w of FESTIVAL_WARES.filter(accountWare)) assert.ok(wardrobeOf(admin, env, NOW)[`${w.kind}s`].includes(w.key), w.id);
});

test('ADMIN-ALL: the glyphs held are paint alone - a listed title\'s and the shop\'s; never a right or a fact', () => {
  const g = glyphsOf(admin, env, NOW);
  for (const x of Object.values(TIER_GLYPH)) if (!STAFF_GLYPHS.includes(x)) assert.ok(g.includes(x), x);
  assert.ok(g.includes('dev'));   // the admin's own, as always
  for (const x of ['mod', 'dm', 'shadowfang', 'sprout', 'laurel', 'tower', 'crownDF']) assert.ok(!g.includes(x), x);
  assert.ok(g.every((x) => GLYPHS.includes(x)));
  assert.equal(new Set(g).size, g.length);
});

test('ADMIN-ALL: only admins - a moderator, a player, an Admin cut off and a handle taken off the list hold nothing more', () => {
  for (const [who, e] of [[mod, env], [{ ...admin, handle: 'someone' }, env], [{ ...admin, staff_suspended: 1 }, env], [admin, { DEVELOPER_HANDLES: '' }]]) {
    assert.equal(holdsAll(who, e), false);
    assert.deepEqual(aurasHeld(who, e), []);
    assert.deepEqual(iconsHeld(who, e), []);
    assert.deepEqual(armoryHeld(who, e), []);
    assert.deepEqual(insigniaOf(who, e), []);
    assert.ok(!titlesHeld(who, e).includes('genesis'));
  }
});

test('ADMIN-ALL: the shop card shows an admin every ware held, with no Buy link to pay for one twice', async () => {
  const card = await shopCardOf(admin, { ...env, STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'wh', SHOP_ON_SALE: SHOP_WARES.map((w) => w.id).join(',') },
    { subtle: crypto.subtle, rand: (b) => crypto.getRandomValues(b), nowS: NOW, origin: 'https://x' });
  assert.ok(card.wares.length > 0);
  // PIN MOVED (AURUM-ONLY): an item carries no money link at all (bought with Aurum), and the card no longer lists the packs as held
  for (const w of card.wares) { if (!w.id.startsWith('aurum:')) assert.equal(w.held, true, w.id); assert.equal(w.buy ?? null, null, w.id); }
});
