// ADMIN-ALL x STOREFRONT (2026-10-30, the merge of main into STOREFRONT): what STOREFRONT sells reaches ADMIN-ALL's law
// (the owner: "give staff all in shop items" - "everything" - "always"). An Admin holds every kill effect, portal skin and
// mount look, the Folios' items and the daily wares, derived at every ask (server-account/src/titles.js holdsAll), and is
// sold none of them: the shop's card and checkout, the daily wares and the Folios each refuse. A pack of Aurum is a
// currency, never held, so it still sells.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { effectsHeld, effectsWorn, effectRefusal, glyphsOf, titlesHeld, iconsHeld, aurasHeld, wardrobeOf } from '../../server-account/src/titles.js';
import { shopHolds, shopCardOf } from '../../server-account/src/shop.js';
import { EFFECT_SLOTS, effectKeys, effectKitWith } from '../../src/net/effectLaw.js';
import { glyphsInOrder } from '../../src/net/identityToken.js';
import { SHOP_WARES, shopRepeatable } from '../../src/net/shopLaw.js';
import { PASS_ALL_GRANTS, passKeysOf, passSeasonById, passItemOf } from '../../src/net/battlePassLaw.js';
import { AURUM_DAILY } from '../../src/net/aurumLaw.js';

const S1 = passSeasonById('s1');
const NOW = S1.fromMs + 5 * 86_400_000;
const NOW_S = NOW / 1000;
const env = { DEVELOPER_HANDLES: 'admin1', MODERATOR_HANDLES: 'mod1' };
const admin = { id: 'a', handle: 'Admin1', registered_at: NOW_S - 9_999_999, created_at: NOW_S - 9_999_999 };
const mod = { id: 'm', handle: 'mod1', registered_at: NOW_S - 9_999_999, created_at: NOW_S - 9_999_999 };
const ON = { ...env, SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };

test('ADMIN-ALL x STOREFRONT: an admin holds every effect in every slot and may wear each; a moderator holds none (mutants: the effects left to what was bought; an admin\'s kit refused)', () => {
  const held = effectsHeld(admin, env);
  for (const slot of EFFECT_SLOTS) {
    assert.deepEqual(held[slot], effectKeys(slot), slot);
    for (const k of effectKeys(slot)) assert.equal(effectRefusal(slot, k, admin, env), null, `${slot}:${k}`);
    assert.deepEqual(effectsHeld(mod, env)[slot], [], `a moderator: ${slot}`);
    assert.equal(effectRefusal(slot, effectKeys(slot)[0], mod, env), 'not-held');
  }
  const kit = EFFECT_SLOTS.reduce((k, slot) => effectKitWith(k, slot, effectKeys(slot).at(-1)), null);
  assert.equal(effectsWorn({ ...admin, effects: kit }, env), kit, 'an admin\'s stored kit worn whole');
  assert.equal(effectsWorn({ ...mod, effects: kit }, env), undefined, 'a moderator\'s stored kit lapses, none of it held');
  assert.deepEqual(wardrobeOf(admin, env, NOW_S).effectsHeld, held, 'the wardrobe says so');
});

test('ADMIN-ALL x STOREFRONT: an admin holds the Folios\' and the shop\'s titles, glyphs, icons and auras, and the daily wares\' - its glyphs in GLYPHS\' order, the mask\'s (mutants: the Folios\' glyphs left out of an admin\'s paint)', () => {
  const titles = titlesHeld(admin, env), glyphs = glyphsOf(admin, env, NOW_S), icons = iconsHeld(admin, env), auras = aurasHeld(admin, env);
  const has = { title: titles, glyph: glyphs, icon: icons, aura: auras };
  for (const g of PASS_ALL_GRANTS) {
    const [kind, key] = g.split(':');
    if (kind in has) assert.ok(has[/** @type {keyof typeof has} */ (kind)].includes(key), g);
    else assert.ok(effectsHeld(admin, env)[kind].includes(key), g);
  }
  for (const w of SHOP_WARES) if (w.kind in has && !w.gives.length) assert.ok(has[/** @type {keyof typeof has} */ (w.kind)].includes(w.key), w.id);
  for (const d of AURUM_DAILY) { const [kind, key] = d.id.split(':'); assert.ok((has[/** @type {keyof typeof has} */ (kind)] ?? effectsHeld(admin, env)[kind]).includes(key), d.id); }
  for (const g of passKeysOf(PASS_ALL_GRANTS, 'glyph')) assert.ok(glyphs.includes(g), `the Folios' ${g}`);
  assert.deepEqual(glyphs, glyphsInOrder(glyphs), 'in the order the token\'s mask hands the room');
});

test('ADMIN-ALL x STOREFRONT: the shop holds every ware for an admin but a pack of Aurum - the card gives no Buy link but a pack\'s (mutants: a pack held, so an admin cannot buy Aurum; a ware sold to an admin)', async () => {
  for (const w of SHOP_WARES) {
    assert.equal(shopHolds(admin, env, w), !shopRepeatable(w), w.id);
    assert.equal(shopHolds(mod, env, w), false, `a moderator: ${w.id}`);
  }
  const card = await shopCardOf(admin, { ...ON, STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'wh', SHOP_ON_SALE: SHOP_WARES.map((w) => w.id).join(',') },
    { subtle: crypto.subtle, rand: (b) => crypto.getRandomValues(b), nowS: NOW_S, origin: 'https://x' });
  const packs = card.wares.filter((w) => w.id.startsWith('aurum:'));
  assert.ok(packs.length > 0 && card.wares.length > packs.length);
  for (const w of card.wares) {
    const pack = w.id.startsWith('aurum:');
    assert.equal(w.held, !pack, w.id);
    assert.equal(!!w.buy, pack, w.id);
  }
});

test('ADMIN-ALL x STOREFRONT on the service: an admin\'s daily wares all held and none sold; its Folios both open with every item, the unlock and a buy refused with nothing spent; an effect worn (mutants: a daily ware sold to an admin; an item or the unlock sold to an admin; the Folios\' card left to what was bought)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await standService(ON);
  const raw = s.env.DB._raw;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, body === undefined
    ? { headers: { authorization: `Bearer ${who.secret}` } }
    : { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const me = await s.registered('Admin1');
  raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'cache', 'gift', 9000, 0, 0)").run(me.id);
  const spent = () => raw.prepare("SELECT COUNT(*) AS n FROM aurum_ledger WHERE account = ? AND amount < 0").get(me.id).n;
  const aurum = (await ask(me, '/v1/account')).body.aurum;
  assert.ok(aurum.daily.wares.length > 0);
  for (const w of aurum.daily.wares) {
    assert.equal(w.held, true, w.id);
    assert.deepEqual([(await ask(me, '/v1/aurum/buy', { ware: w.id })).body.error], ['aurum-held'], w.id);
  }
  const pass = (await ask(me, '/v1/pass/mine', {})).body;
  assert.equal(pass.tracks.premium, true, 'the Gilded Folio open');
  assert.deepEqual([...pass.bought].sort(), PASS_ALL_GRANTS.filter((g) => !!passItemOf('s1', g)).sort(), 'every item held');
  const unlock = await ask(me, '/v1/pass/unlock', { season: 's1' });
  assert.deepEqual([unlock.status, unlock.body.error], [409, 'pass-held']);
  const buy = await ask(me, '/v1/pass/buy', { season: 's1', grant: 'glyph:cog' });
  assert.deepEqual([buy.status, buy.body.error], [409, 'pass-held']);
  assert.equal(spent(), 0, 'no Aurum spent');
  assert.equal(raw.prepare('SELECT pass_items FROM players WHERE id = ?').get(me.id).pass_items ?? '', '', 'nothing written: held by the list, not the row');
  const worn = await ask(me, '/v1/account/effect', { slot: 'kill', key: effectKeys('kill').at(-1) });
  assert.equal(worn.status, 200, JSON.stringify(worn.body));
  assert.deepEqual(worn.body.effectsHeld, effectsHeld(admin, env));
});
