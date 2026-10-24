// PATREON-LINK (2026-10-01, Mac: "With patron and having to manually hand out titles. Im running into a workflow where
// its really hard to keep up with it"; asked, "Patreon auto-link"). A registered player links their own Patreon from
// the account card, and the tier their pledge pays for is a title they hold - upgraded, downgraded and lapsed by
// Patreon's webhook, with no handle list to edit and no deploy per patron (server-account/src/patreon.js).
//
// The service is driven end to end through the real Worker on node:sqlite (test/accountDb.mjs); Patreon is the one
// thing stood in for - its two OAuth endpoints answered by a stub, its webhook signed by node's own HMAC-MD5, so the
// service's MD5 is checked against an implementation that is not its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, randomBytes } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import {
  md5, hmacMd5, patreonSignatureOk, patreonTierMap, pledgeTitles, patreonTitlesOf, sealPatreon, openPatreon, patreonLinkOn,
  memberOfIdentity, memberOfHook, PATREON_TOKEN, PATREON_TITLES, PATREON_STATE_S,
} from '../../server-account/src/patreon.js';
import { titlesHeld, glyphsOf, titleWorn, equipRefusal } from '../../server-account/src/titles.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { accountCard } from '../../src/ui/enhanced/enhancedAccount.js';
import { SESSION_KEY, REFUSALS } from '../../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const hex = (b) => Buffer.from(b).toString('hex');

/** Linking configured: the client, both secrets, and the three tiers mapped. */
const ON = {
  PATREON_CLIENT_ID: 'client-id-1', PATREON_CLIENT_SECRET: 'client-secret-1', PATREON_WEBHOOK_SECRET: 'hook-secret-1',
  PATREON_TIERS: '1001:disciple,1002:apostle,1003:hierophant',
};
const AFTER = 1_900_000_000;   // first played long after Founder's cutoff, so no row below holds Founder by accident
const row = (o = {}) => ({ id: 'acct-patron', handle: 'Pat', created_at: AFTER, registered_at: AFTER, ...o });

// ── THE LAW ─────────────────────────────────────────────────────────

test('PATREON-LINK: a tier\'s title is held while Patreon says the pledge is active and entitled to it - with its glyph, beside the handle lists, never a guest\'s (mutants: any status holds; an unmapped tier holds; the handle guard dropped; the pledge not read)', () => {
  const pat = row({ patreon_user: '555', patreon_tiers: '1001', patreon_status: 'active_patron' });
  assert.deepEqual(titlesHeld(pat, ON), ['disciple']);
  assert.ok(glyphsOf(pat, ON, AFTER).includes('disciple'), 'the tier\'s glyph rides with its title, as a list grants both');
  assert.equal(equipRefusal('disciple', pat, ON), null, 'and it may be worn');
  assert.equal(titleWorn({ ...pat, title: 'disciple' }, ON), 'disciple');
  for (const status of ['declined_patron', 'former_patron', null, undefined]) {
    assert.deepEqual(titlesHeld({ ...pat, patreon_status: status }, ON), [], `${status}: nothing held`);
  }
  assert.deepEqual(titlesHeld({ ...pat, patreon_tiers: '9999' }, ON), [], 'a tier the config does not map grants nothing');
  assert.deepEqual(titlesHeld(pat, { ...ON, PATREON_TIERS: '' }), [], 'and nothing is mapped until the config says so');
  assert.equal(titleWorn({ ...pat, title: 'disciple', patreon_status: 'former_patron' }, ON), undefined, 'a lapsed pledge stops being worn without a column cleared');
  assert.deepEqual(titlesHeld({ ...pat, handle: null }, ON), [], 'a guest holds none, whatever a row says');
  assert.deepEqual(titlesHeld(row({ patreon_tiers: '1001,1003', patreon_status: 'active_patron' }), ON), ['disciple', 'hierophant'], 'in the tiers\' order');
  assert.deepEqual(titlesHeld(row(), { ...ON, DISCIPLE_HANDLES: 'Pat' }), ['disciple'], 'the handle list still grants on its own');
  assert.deepEqual(titlesHeld({ ...pat, patreon_tiers: '1003' }, { ...ON, HIEROPHANT_HANDLES: 'pat' }), ['hierophant'], 'and the two never hold one title twice');
});

test('PATREON-LINK: PATREON_TIERS maps a tier id to one of the Patreon titles and nothing else (mutants: a title outside the four read; a malformed entry read)', () => {
  const map = patreonTierMap({ PATREON_TIERS: ' 1001:disciple , 1002:apostle,abc:hierophant,1004:dungeonmaster,1005:penitent,1006:apostle:x,,1003:hierophant,1007:herald' });
  assert.deepEqual([...map], [['1001', 'disciple'], ['1002', 'apostle'], ['1003', 'hierophant'], ['1007', 'herald']]);
  assert.deepEqual(PATREON_TITLES, ['disciple', 'apostle', 'herald', 'hierophant'], 'TITLE-N\'s three and HERALD\'s, lowest first');
  assert.equal(patreonTierMap({}).size, 0);
  assert.deepEqual(pledgeTitles(['1002', '1001'], 'active_patron', ON), ['disciple', 'apostle']);
  assert.deepEqual(pledgeTitles(['1002'], 'declined_patron', ON), []);
  assert.deepEqual(patreonTitlesOf({ handle: '', patreon_tiers: '1001', patreon_status: 'active_patron' }, ON), []);
});

test('PATREON-LINK: the webhook\'s MD5 and HMAC-MD5 are node\'s own at every length that crosses a block, and RFC 2202\'s vectors (mutants: a round\'s shift; the length word; the key block)', () => {
  for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 121, 128, 1000, 70_000]) {
    const b = randomBytes(n);
    assert.equal(hex(md5(new Uint8Array(b))), createHash('md5').update(b).digest('hex'), `md5 of ${n} bytes`);
    for (const k of [0, 16, 64, 65, 131]) {
      const key = randomBytes(k);
      assert.equal(hex(hmacMd5(new Uint8Array(key), new Uint8Array(b))), createHmac('md5', key).update(b).digest('hex'), `hmac, a ${k}-byte key over ${n} bytes`);
    }
  }
  const t = (s) => new TextEncoder().encode(s);
  assert.equal(hex(hmacMd5(new Uint8Array(16).fill(0x0b), t('Hi There'))), '9294727a3638bb1c13f48ef8158bfc9d');
  assert.equal(hex(hmacMd5(t('Jefe'), t('what do ya want for nothing?'))), '750c783e6ab0b503eaa86e310a5db738');
  assert.equal(hex(hmacMd5(new Uint8Array(80).fill(0xaa), t('Test Using Larger Than Block-Size Key - Hash Key First'))), '6b1ab7fe4bd7bf8f0b62e6ce61b9d0cd');
});

test('PATREON-LINK: a webhook\'s signature is the hex HMAC-MD5 of its exact bytes under the webhook secret - any case, nothing else (mutants: the compare skipped; the case read)', () => {
  const body = new TextEncoder().encode('{"data":{"type":"member"}}');
  const sig = createHmac('md5', 's3cret').update(body).digest('hex');
  assert.equal(patreonSignatureOk('s3cret', body, sig), true);
  assert.equal(patreonSignatureOk('s3cret', body, ` ${sig.toUpperCase()} `), true, 'Patreon\'s hex, in either case');
  assert.equal(patreonSignatureOk('other', body, sig), false, 'another secret');
  assert.equal(patreonSignatureOk('s3cret', new TextEncoder().encode('{"data":{"type":"member"} }'), sig), false, 'a byte changed');
  for (const bad of [null, undefined, '', sig.slice(1), `${sig}0`, 'z'.repeat(32)]) assert.equal(patreonSignatureOk('s3cret', body, bad), false, String(bad));
});

test('PATREON-LINK: the state and the ticket are this service\'s own - SEALED under the client secret, one key a kind, opaque on the way past, and only until they expire (mutants: one key for both kinds; the expiry not read; the account not required)', async () => {
  const nowS = 2_000_000_000;
  const rand = (b) => globalThis.crypto.getRandomValues(b);
  const state = await sealPatreon('state', { p: 'acct-1', x: nowS + 60 }, ON, { subtle, rand });
  assert.deepEqual(await openPatreon('state', state, ON, { subtle, nowS }), { p: 'acct-1', x: nowS + 60 });
  assert.equal(await openPatreon('ticket', state, ON, { subtle, nowS }), null, 'a state is never a ticket');
  assert.equal(await openPatreon('state', state, ON, { subtle, nowS: nowS + 61 }), null, 'expired');
  assert.equal(await openPatreon('state', state, { ...ON, PATREON_CLIENT_SECRET: 'another' }, { subtle, nowS }), null, 'another secret');
  assert.equal(await openPatreon('state', state, { ...ON, PATREON_CLIENT_ID: '' }, { subtle, nowS }), null, 'linking off');
  const bytes = Buffer.from(state, 'base64url');
  for (const at of [0, 12, bytes.length - 1]) {
    const bent = Buffer.from(bytes);
    bent[at] ^= 1;
    assert.equal(await openPatreon('state', bent.toString('base64url'), ON, { subtle, nowS }), null, `a byte changed at ${at}`);
  }
  assert.ok(!bytes.toString('latin1').includes('acct-1'), 'the account it names is nobody\'s to read on the way past');
  const ticket = await sealPatreon('ticket', { p: 'acct-1', u: '555', k: 'the-patrons-token', x: nowS + 60 }, ON, { subtle, rand });
  assert.ok(!Buffer.from(ticket, 'base64url').toString('latin1').includes('the-patrons-token'), 'nor the token a ticket carries');
  assert.notEqual(await sealPatreon('state', { p: 'acct-1', x: nowS + 60 }, ON, { subtle, rand }), state, 'a fresh IV each seal');
  assert.equal(await openPatreon('state', await sealPatreon('state', { x: nowS + 60 }, ON, { subtle, rand }), ON, { subtle, nowS }), null, 'no account, no state');
  for (const bad of [null, '', 'x', state.slice(0, 20), `${state}.x`, 'A'.repeat(5000)]) assert.equal(await openPatreon('state', bad, ON, { subtle, nowS }), null, String(bad).slice(0, 20));
  assert.equal(PATREON_STATE_S, 3600);
});

test('PATREON-LINK: Patreon\'s two shapes read - the identity\'s membership of this campaign, and a webhook\'s member, where a field left out is NOT read as none (mutants: a missing status read as null; missing tiers read as none)', () => {
  const id = (member) => ({ data: { id: '555', type: 'user', attributes: { full_name: 'Pat Ron' }, relationships: { memberships: { data: member ? [{ id: 'm-1', type: 'member' }] : [] } } }, included: member ? [member] : [] });
  const m = { id: 'm-1', type: 'member', attributes: { patron_status: 'active_patron' }, relationships: { currently_entitled_tiers: { data: [{ id: '1002', type: 'tier' }, { id: 'x', type: 'tier' }] } } };
  assert.deepEqual(memberOfIdentity(id(m)), { user: '555', name: 'Pat Ron', tiers: ['1002'], status: 'active_patron' });
  assert.deepEqual(memberOfIdentity(id(null)), { user: '555', name: 'Pat Ron', tiers: [], status: null }, 'a user with no membership is still a user');
  assert.equal(memberOfIdentity({ data: { id: 'not-digits' } }), null);
  const hook = (rel, attrs) => ({ data: { type: 'member', id: 'm-1', attributes: attrs, relationships: { user: { data: { id: '555', type: 'user' } }, ...rel } } });
  assert.deepEqual(memberOfHook(hook({ currently_entitled_tiers: { data: [] } }, { patron_status: 'former_patron' })), { user: '555', tiers: [], status: 'former_patron' });
  assert.deepEqual(memberOfHook(hook({}, {})), { user: '555', tiers: undefined, status: undefined }, 'nothing stated is nothing changed');
  assert.deepEqual(memberOfHook(hook({}, { patron_status: null })), { user: '555', tiers: undefined, status: null }, 'a stated null is a status');
  assert.equal(memberOfHook({ data: { type: 'campaign' } }), null);
});

// ── THE SERVICE, end to end ─────────────────────────────────────────

/** Patreon's two OAuth endpoints, stood in for on the global fetch the Worker calls. `cfg` is what Patreon says, read at
 *  each ask - so a pin can move a pledge between the page and the yes. */
function patreon(o = {}) {
  const cfg = { user: '555', name: 'Pat Ron', tiers: ['1001'], status: 'active_patron', token: true, ...o };
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    asked.push({ url: String(url), init });
    if (String(url) === PATREON_TOKEN) {
      return cfg.token ? Response.json({ access_token: 'patreon-access', token_type: 'Bearer' }) : new Response('{"error":"invalid_grant"}', { status: 400 });
    }
    if (String(url).startsWith('https://www.patreon.com/api/oauth2/v2/identity')) {
      return Response.json({
        data: { id: cfg.user, type: 'user', attributes: { full_name: cfg.name }, relationships: { memberships: { data: [{ id: 'm-1', type: 'member' }] } } },
        included: [{ id: 'm-1', type: 'member', attributes: { patron_status: cfg.status }, relationships: { currently_entitled_tiers: { data: cfg.tiers.map((id) => ({ id, type: 'tier' })) } } }],
      });
    }
    throw new Error(`no stand-in for ${url}`);
  };
  return { asked, cfg, restore: () => { globalThis.fetch = real; } };
}

async function stand(extra = ON) {
  const s = await standService(extra);
  const get = async (path, who = null) => s.fetch(`https://accounts.invalid${path}`, who ? { headers: { authorization: `Bearer ${who.secret}` } } : {});
  const account = async (who) => (await get('/v1/account', who)).json();
  const confirm = (ticket) => s.fetch('https://accounts.invalid/v1/patreon/confirm', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString(),
  });
  const hook = (event, doc, secret = ON.PATREON_WEBHOOK_SECRET) => {
    const body = JSON.stringify(doc);
    return s.fetch('https://accounts.invalid/v1/patreon/webhook', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json', 'x-patreon-event': event, 'x-patreon-signature': createHmac('md5', secret).update(body).digest('hex') },
    });
  };
  const member = (user, tiers, status) => ({
    data: { type: 'member', id: 'm-1', attributes: { patron_status: status }, relationships: { user: { data: { id: user, type: 'user' } }, currently_entitled_tiers: { data: tiers.map((id) => ({ id, type: 'tier' })) } } },
    included: [{ type: 'campaign', id: '42', attributes: { summary: 'x'.repeat(6000) } }],
  });
  const raw = (who) => ({ ...s.env.DB._raw.prepare('SELECT patreon_user, patreon_tiers, patreon_status FROM players WHERE id = ?').get(who.id) });
  /** The whole link, as a player makes it: the card's link, Patreon's code back to the callback, the page's yes. */
  const link = async (who, stub = {}) => {
    const p = patreon(stub);
    try {
      const state = new URL((await account(who)).patreon.link).searchParams.get('state');
      const page = await (await get(`/v1/patreon/callback?code=code-1&state=${encodeURIComponent(state)}`)).text();
      const ticket = /name="ticket" value="([^"]+)"/.exec(page)?.[1];
      assert.ok(ticket, 'the callback asks, with a ticket for the yes');
      const done = await confirm(ticket);
      return { page, done, html: await done.text(), asked: p.asked };
    } finally { p.restore(); }
  };
  return { ...s, get, account, confirm, hook, member, raw, link };
}

test('PATREON-LINK, end to end: the account read carries the link - Patreon\'s authorize URL for this client, this callback and a state for this account; a guest gets none, and none at all while linking is off (mutants: a guest given a link; the client secret in the URL; the card told on while off)', async () => {
  const { account, registered, guest } = await stand();
  const me = await registered('Patron');
  const p = (await account(me)).patreon;
  assert.deepEqual({ ...p, link: typeof p.link }, { on: true, linked: false, titles: [], link: 'string' });
  const url = new URL(p.link);
  assert.equal(`${url.origin}${url.pathname}`, 'https://www.patreon.com/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), ON.PATREON_CLIENT_ID);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://accounts.invalid/v1/patreon/callback', 'under the origin that served it - never typed');
  assert.equal(url.searchParams.get('scope'), 'identity', 'the one scope a title needs');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.ok(!p.link.includes(ON.PATREON_CLIENT_SECRET), 'the secret is never in a URL');
  const g = await guest();
  assert.equal((await account(g)).patreon.link, null, 'a guest cannot link');
  const off = await stand({});
  const someone = await off.registered('Someone');
  assert.deepEqual((await off.account(someone)).patreon, { on: false });
  assert.deepEqual((await off.account(someone)).wardrobe.titles, []);
});


test('PATREON-LINK, end to end: the callback spends the code and ASKS, writing nothing; the yes links - the tier a title held, its glyph signed into the token, wearable (mutants: the callback links; the confirm never writes; the redirect spent differs from the one authorized)', async () => {
  const { account, registered, raw, get, confirm, call } = await stand();
  const me = await registered('Patron');
  const p = patreon();
  let page;
  let done;
  try {
    const state = new URL((await account(me)).patreon.link).searchParams.get('state');
    assert.ok(!Buffer.from(state, 'base64url').toString('latin1').includes(me.id), 'the state in the URL names nobody to Patreon or a history');
    const res = await get(`/v1/patreon/callback?code=code-1&state=${encodeURIComponent(state)}`);
    assert.equal(res.status, 200);
    page = await res.text();
    assert.deepEqual(raw(me), { patreon_user: null, patreon_tiers: null, patreon_status: null }, 'NOTHING is written until the patron says yes');
    done = await confirm(/name="ticket" value="([^"]+)"/.exec(page)[1]);
  } finally { p.restore(); }
  assert.match(page, /Game account: Patron/);
  assert.match(page, /Patreon account: Pat Ron/);
  assert.match(page, /Your pledge holds: Disciple\./);
  assert.match(page, /<form method="post" action="\/v1\/patreon\/confirm">/);
  assert.ok(!page.includes('patreon-access'), 'the patron\'s token rides the page sealed, never in clear');
  const sent = new URLSearchParams(p.asked.find((a) => a.url === PATREON_TOKEN).init.body);
  assert.equal(sent.get('redirect_uri'), 'https://accounts.invalid/v1/patreon/callback', 'the code is spent with the very redirect it was authorized for');
  assert.equal(sent.get('client_secret'), ON.PATREON_CLIENT_SECRET);
  assert.equal(sent.get('code'), 'code-1');
  const identities = p.asked.filter((a) => a.url.includes('/identity'));
  assert.equal(identities.length, 2, 'asked at the callback for the page, and again at the yes');
  for (const a of identities) assert.equal(a.init.headers.authorization, 'Bearer patreon-access', 'with the player\'s own token');
  assert.equal(done.status, 200);
  assert.match(await done.text(), /Patron holds Disciple now\./);
  assert.deepEqual(raw(me), { patreon_user: '555', patreon_tiers: '1001', patreon_status: 'active_patron' });
  const after = await account(me);
  assert.deepEqual(after.wardrobe.titles, ['disciple']);
  assert.ok(after.wardrobe.glyphs.includes('disciple'));
  assert.equal(after.wardrobe.title, null, 'held, not worn - nothing wears a title for its player');
  assert.deepEqual({ linked: after.patreon.linked, titles: after.patreon.titles }, { linked: true, titles: ['disciple'] });
  assert.equal((await call('/v1/account/title', { title: 'disciple' }, me.secret)).status, 200);
  const minted = (await call('/v1/auth/token', {}, me.secret)).body;
  assert.equal(minted.title, 'disciple');
  assert.ok(minted.glyphs.includes('disciple'), 'signed into the token as a list\'s is');
});

test('PATREON-LINK, end to end: the yes writes what Patreon says AT the yes - a pledge cancelled between the page and the press holds nothing, a yes pressed again after a cancel never brings a title back, and a token that answers for another Patreon account links nothing (mutants: the confirm trusts the page; the Patreon account not compared)', async () => {
  const { account, registered, raw, get, confirm } = await stand();
  const me = await registered('Patron');
  const p = patreon();
  try {
    const state = new URL((await account(me)).patreon.link).searchParams.get('state');
    const page = await (await get(`/v1/patreon/callback?code=c&state=${encodeURIComponent(state)}`)).text();
    assert.match(page, /Your pledge holds: Disciple\./, 'the page shows what Patreon said then');
    const ticket = /name="ticket" value="([^"]+)"/.exec(page)[1];
    p.cfg.status = 'former_patron';
    p.cfg.tiers = [];   // the pledge cancelled before the press
    let r = await confirm(ticket);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Patron is linked\. Your title arrives the moment your pledge holds one\./);
    assert.deepEqual(raw(me), { patreon_user: '555', patreon_tiers: '', patreon_status: 'former_patron' });
    assert.deepEqual((await account(me)).wardrobe.titles, []);
    r = await confirm(ticket);
    assert.deepEqual((await account(me)).wardrobe.titles, [], 'a yes pressed again never brings back a title Patreon took');
    p.cfg.status = 'active_patron';
    p.cfg.tiers = ['1002'];   // pledged again, at another tier
    r = await confirm(ticket);
    assert.deepEqual((await account(me)).wardrobe.titles, ['apostle'], 'pressed after a new pledge it writes the new one: Patreon\'s word now, always');
    p.cfg.user = '777';
    r = await confirm(ticket);
    assert.equal(r.status, 400, 'a token that answers for another Patreon account now');
    assert.match(await r.text(), /This link has expired/);
    assert.equal(raw(me).patreon_user, '555', 'links nothing');
  } finally { p.restore(); }
});

test('PATREON-LINK, end to end: Patreon\'s webhook moves the tier, and an ended pledge lapses it - a worn title stops being worn; a bad signature, a stranger and another event change nothing (mutants: the signature not checked; an ended pledge keeps its tiers; a stated field skipped; an unstated one cleared)', async () => {
  const { account, registered, raw, link, hook, member, call } = await stand();
  const me = await registered('Patron');
  await link(me);
  assert.equal((await call('/v1/account/title', { title: 'disciple' }, me.secret)).status, 200);

  let r = await hook('members:pledge:update', member('555', ['1002'], 'active_patron'));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, applied: 1 });
  let w = (await account(me)).wardrobe;
  assert.deepEqual(w.titles, ['apostle'], 'upgraded with nobody in the loop');
  assert.equal(w.title, null, 'the Disciple it wore is no longer held, so no longer worn');
  assert.ok(w.glyphs.includes('apostle') && !w.glyphs.includes('disciple'));

  r = await hook('members:pledge:update', member('555', ['1003'], 'active_patron'), 'the-wrong-secret');
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { error: 'signature' });
  assert.deepEqual(raw(me).patreon_tiers, '1002', 'a forged webhook changed nothing');

  r = await hook('members:update', member('555', ['1002'], 'declined_patron'));
  assert.deepEqual((await account(me)).wardrobe.titles, [], 'a declined card holds nothing until Patreon says it went through');
  r = await hook('members:update', member('555', ['1002'], 'active_patron'));
  assert.deepEqual((await account(me)).wardrobe.titles, ['apostle']);

  const quiet = member('555', [], 'active_patron');
  delete quiet.data.attributes.patron_status;
  delete quiet.data.relationships.currently_entitled_tiers;
  r = await hook('members:update', quiet);
  assert.deepEqual(raw(me), { patreon_user: '555', patreon_tiers: '1002', patreon_status: 'active_patron' }, 'a payload that leaves a field out leaves it standing');

  r = await hook('members:pledge:delete', member('555', ['1002'], 'active_patron'));
  assert.deepEqual(await r.json(), { ok: true, applied: 1 });
  assert.deepEqual(raw(me), { patreon_user: '555', patreon_tiers: '', patreon_status: 'former_patron' }, 'an ended pledge holds nothing, whatever its figures say');
  assert.deepEqual((await account(me)).wardrobe.titles, []);
  assert.deepEqual((await account(me)).patreon.linked, true, 'still linked: a new pledge is a title again');

  assert.deepEqual(await (await hook('members:pledge:create', member('999', ['1003'], 'active_patron'))).json(), { ok: true, applied: 0 }, 'a patron nobody linked is acknowledged and changes nothing');
  assert.deepEqual(await (await hook('posts:publish', member('555', ['1003'], 'active_patron'))).json(), { ok: true, applied: 0 }, 'another event');
  assert.deepEqual(raw(me).patreon_tiers, '');
});

test('PATREON-LINK, end to end: one Patreon dresses one account - linking it elsewhere MOVES it, and the page says from where; unlink takes it off whole (mutants: the move left on both; the page silent about the move; unlink keeps the pledge)', async () => {
  const { account, registered, raw, link, call } = await stand();
  const a = await registered('First');
  const b = await registered('Second');
  await link(a);
  const moved = await link(b);
  assert.match(moved.page, /This Patreon is linked to First now\. Linking moves it to Second\./);
  assert.deepEqual(raw(a), { patreon_user: null, patreon_tiers: null, patreon_status: null });
  assert.deepEqual(raw(b), { patreon_user: '555', patreon_tiers: '1001', patreon_status: 'active_patron' });
  assert.deepEqual((await account(a)).wardrobe.titles, []);
  assert.deepEqual((await account(b)).wardrobe.titles, ['disciple']);

  assert.equal((await call('/v1/account/title', { title: 'disciple' }, b.secret)).status, 200);
  const off = await call('/v1/patreon/unlink', {}, b.secret);
  assert.equal(off.status, 200);
  assert.deepEqual({ titles: off.body.titles, title: off.body.title, linked: off.body.patreon.linked }, { titles: [], title: null, linked: false }, 'the wardrobe after it, as an equip answers');
  assert.ok(off.body.patreon.link.startsWith('https://www.patreon.com/oauth2/authorize?'), 'and the link to link again');
  assert.deepEqual(raw(b), { patreon_user: null, patreon_tiers: null, patreon_status: null });
  assert.equal((await call('/v1/patreon/unlink', {}, null)).status, 401, 'an account\'s own act, behind a session');
});

test('PATREON-LINK, end to end: every way a link can fail is a page a person can act on, and none writes - an expired or forged state, a no on Patreon, Patreon not answering, a forged ticket, linking off (mutants: a no still asks Patreon; a failed exchange goes on; a ticket not opened)', async () => {
  const { account, registered, raw, get, confirm, hook } = await stand();
  const me = await registered('Patron');
  const state = new URL((await account(me)).patreon.link).searchParams.get('state');
  const p = patreon({ token: false });
  try {
    let r = await get('/v1/patreon/callback?code=c&state=nonsense');
    assert.equal(r.status, 400);
    assert.match(await r.text(), /This link has expired/);
    r = await get(`/v1/patreon/callback?error=access_denied&state=${encodeURIComponent(state)}`);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Not linked/);
    assert.equal(p.asked.length, 0, 'a no on Patreon asks Patreon nothing');
    r = await get(`/v1/patreon/callback?code=c&state=${encodeURIComponent(state)}`);
    assert.equal(r.status, 502);
    assert.match(await r.text(), /Patreon did not answer/);
  } finally { p.restore(); }
  const rand = (b) => globalThis.crypto.getRandomValues(b);
  const forged = await sealPatreon('ticket', { p: me.id, u: '555', k: 'patreon-access', x: 4_000_000_000 }, { ...ON, PATREON_CLIENT_SECRET: 'not-ours' }, { subtle, rand });
  let r = await confirm(forged);
  assert.equal(r.status, 400);
  assert.match(await r.text(), /This link has expired/);
  r = await confirm(await sealPatreon('state', { p: me.id, x: 4_000_000_000 }, ON, { subtle, rand }));
  assert.equal(r.status, 400, 'a state is no ticket');
  assert.deepEqual(raw(me), { patreon_user: null, patreon_tiers: null, patreon_status: null });
  assert.equal((await get('/v1/patreon/confirm')).status, 405);
  assert.equal((await get('/v1/patreon/webhook')).status, 405);

  const off = await stand({});
  r = await off.get(`/v1/patreon/callback?code=c&state=${encodeURIComponent(state)}`);
  assert.equal(r.status, 503);
  assert.match(await r.text(), /Patreon linking is off/);
  r = await off.hook('members:update', { data: {} });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'patreon-closed' });
  void hook;
});

test('PATREON-LINK, end to end: the pages are HTML a person reads - a player\'s words escaped, no script, never framed, never cached, no Referer, the one form posting here (mutants: the name unescaped; the policy dropped)', async () => {
  const { account, registered, get } = await stand();
  const me = await registered('Patron');
  const state = new URL((await account(me)).patreon.link).searchParams.get('state');
  const p = patreon({ name: '<script>alert(1)</script>"&' });
  let res;
  try { res = await get(`/v1/patreon/callback?code=c&state=${encodeURIComponent(state)}`); } finally { p.restore(); }
  const page = await res.text();
  assert.ok(!page.includes('<script'), 'no script, the patron\'s name included');
  assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;&amp;/);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  const csp = res.headers.get('content-security-policy');
  for (const part of ["default-src 'none'", "form-action 'self'", "frame-ancestors 'none'"]) assert.ok(csp.includes(part), part);
});

// ── THE CARD AND ITS FLOW ───────────────────────────────────────────

const SESSION = { id: 'acct-patron', name: 'Patron', kind: 'linked', sessionId: 's1', secret: 'sec-patron' };
const ACCOUNT = { id: 'acct-patron', name: 'Patron', kind: 'linked', handle: 'Patron' };
const LINK = 'https://www.patreon.com/oauth2/authorize?state=s';
function memStorage(seed = SESSION) {
  const m = new Map([[SESSION_KEY, JSON.stringify(seed)]]);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
/** A service answering the account read from `reads` in turn, and the unlink. */
function service(reads, unlink = null) {
  const sent = [];
  let n = 0;
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    sent.push(path);
    if (path === '/v1/account') {
      const r = reads[Math.min(n++, reads.length - 1)];
      if (r === 'offline') throw new Error('down');
      return Response.json(r);
    }
    if (path === '/v1/patreon/unlink' && unlink) return Response.json(unlink);
    void init;
    throw new Error(`nothing answers ${path}`);
  };
  return { io: { fetch, base: 'https://accounts.invalid' }, sent };
}
const answer = (patreon, titles = []) => ({ account: ACCOUNT, wardrobe: { titles, title: null, glyphs: titles.length ? ['disciple'] : [] }, devices: [], patreon });

test('PATREON-LINK: the flow - the Patreon row rides the account read; a followed link waits, and the read on the way back takes the link that landed; a blip leaves the card; unlink takes the service\'s wardrobe; signing out forgets it (mutants: refresh never reads; the note never says linked; unlink patches the wardrobe itself)', async () => {
  const unlinked = { on: true, linked: false, titles: [], link: LINK };
  const linked = { on: true, linked: true, titles: ['disciple'], link: LINK };
  const { io, sent } = service([answer(unlinked), 'offline', answer(linked, ['disciple'])], { ok: true, titles: [], title: null, glyphs: [], patreon: unlinked });
  const flow = AccountFlow({ io, storage: memStorage() });
  await flow.start();
  assert.equal(flow.stage, 'in');
  assert.deepEqual(flow.patreon, unlinked);
  flow.patreonOpened();
  assert.equal(flow.patreonWaiting, true);
  assert.equal(flow.note, 'Finish on Patreon, then come back here.');
  assert.equal(await flow.refresh(), false, 'a blip');
  assert.deepEqual(flow.patreon, unlinked, 'leaves the card as it was');
  assert.equal(flow.stage, 'in');
  assert.equal(await flow.refresh(), true);
  assert.deepEqual(flow.patreon, linked);
  assert.deepEqual(flow.wardrobe.titles, ['disciple']);
  assert.equal(flow.patreonWaiting, false);
  assert.equal(flow.note, 'Patreon linked. Wear your title under Title.');
  assert.equal(await flow.unlinkPatreon(), true);
  assert.deepEqual(flow.wardrobe.titles, [], 'the service\'s word on what is held, whole');
  assert.deepEqual(flow.patreon, unlinked);
  assert.equal(flow.note, 'Patreon unlinked.');
  assert.deepEqual(sent, ['/v1/account', '/v1/account', '/v1/account', '/v1/patreon/unlink']);
  const old = service([{ account: ACCOUNT, wardrobe: { titles: [], title: null, glyphs: [] }, devices: [] }]);
  const before = AccountFlow({ io: old.io, storage: memStorage() });
  await before.start();
  assert.equal(before.patreon, null, 'a service from before acct45 says nothing, and the card draws no row');
});

/** The smallest document the card needs, with a window that keeps its focus listeners. */
function cardDoc() {
  const listeners = new Set();
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', disabled: false, children: [], attrs: {}, isConnected: true,
      append: (...k) => n.children.push(...k.filter(Boolean)),
      setAttribute(k, v) { n.attrs[k] = v; },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  const defaultView = {
    addEventListener: (e, f) => { if (e === 'focus') listeners.add(f); },
    removeEventListener: (e, f) => { if (e === 'focus') listeners.delete(f); },
    focus: () => { for (const f of [...listeners]) f(); },
    listeners,
  };
  return { createElement: mk, defaultView };
}

test('PATREON-LINK: the card - Link Patreon is a LINK that opens at once in a new tab (the system browser in the app); linked, what the pledge holds, Refresh and Unlink; nothing for a guest or while linking is off; every class one the skin defines (mutants: the row drawn for a guest; the link not a link; the row drawn while off)', async () => {
  const css = src('src/ui/enhanced/enhancedStyle.js');
  const draw = (patreon, account = ACCOUNT, titles = []) => {
    const flow = AccountFlow({ io: service([answer(patreon, titles)]).io, storage: memStorage() });
    flow.stage = 'in';
    flow.account = account;
    flow.wardrobe = { titles, title: null, glyphs: [] };
    flow.patreon = patreon;
    const card = accountCard(cardDoc(), flow);
    card.paint();
    return { flow, card, all: card.root.all };
  };
  let { flow, all } = draw({ on: true, linked: false, titles: [], link: LINK });
  const a = all.find((n) => n.tag === 'a' && n.textContent === 'Link Patreon');
  assert.ok(a, 'a Link Patreon');
  assert.deepEqual({ href: a.href, target: a.target, rel: a.rel, cls: a.className }, { href: LINK, target: '_blank', rel: 'noopener', cls: 'act' });
  assert.ok(all.some((n) => n.className === 'fieldlabel' && n.textContent === 'Patreon'));
  assert.ok(!all.some((n) => n.tag === 'button' && n.textContent === 'Unlink'), 'nothing to unlink');
  a.onclick();
  assert.equal(flow.patreonWaiting, true, 'the press says where the player went');
  /** The classes the Patreon row itself wears (the wardrobe's titles beside it are ACC3c's to pin). */
  const rowClasses = (nodes) => nodes.find((n) => n.className.split(/\s+/).includes('acctpatreon'))?.all.flatMap((n) => n.className.split(/\s+/)).filter(Boolean) ?? [];
  const worn = new Set(rowClasses(all));
  assert.ok(worn.has('acctpatreon') && worn.has('act'), 'the walk sees its subject');

  ({ all } = draw({ on: true, linked: true, titles: ['disciple'], link: LINK }, ACCOUNT, ['disciple']));
  assert.ok(all.some((n) => n.className === 'acctpatreonstate' && n.textContent === 'Linked - Disciple'));
  assert.ok(all.some((n) => n.tag === 'a' && n.textContent === 'Refresh' && n.href === LINK));
  assert.ok(all.some((n) => n.tag === 'button' && n.textContent === 'Unlink'));
  for (const c of rowClasses(all)) worn.add(c);
  ({ all } = draw({ on: true, linked: true, titles: [], link: LINK }));
  assert.ok(all.some((n) => n.className === 'acctpatreonstate' && n.textContent === 'Linked. No rank yet'));   // PIN MOVED (VOICE2): no dash aside, a tier a rank (Voice.md rules 3, 5)

  for (const [why, patreon, account] of [
    ['a guest', { on: true, linked: false, titles: [], link: null }, { ...ACCOUNT, handle: null, guestName: 'A B', kind: 'guest' }],
    ['linking off', { on: false }, ACCOUNT],
    ['a service from before it', null, ACCOUNT],
  ]) {
    ({ all } = draw(patreon, account));
    assert.ok(!all.some((n) => n.className === 'fieldlabel' && n.textContent === 'Patreon'), `${why}: no row`);
  }
  ({ all } = draw({ on: true, linked: false, titles: [], link: 'javascript:alert(1)' }));
  assert.ok(!all.some((n) => n.tag === 'a'), 'only an https link is ever drawn');
  const missing = [...worn].filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(missing, [], 'the row wears a class the enhanced skin has no rule for');
});

test('PATREON-LINK: back from the browser, the card reads the account again - and a card taken down stops listening (mutants: no read on the way back; the listener outlives its card)', async () => {
  const linked = { on: true, linked: true, titles: ['disciple'], link: LINK };
  const { io, sent } = service([answer({ on: true, linked: false, titles: [], link: LINK }), answer(linked, ['disciple'])]);
  const flow = AccountFlow({ io, storage: memStorage() });
  await flow.start();
  const doc = cardDoc();
  const card = accountCard(doc, flow);
  card.paint();
  assert.equal(doc.defaultView.listeners.size, 1, 'one listener a card');
  doc.defaultView.focus();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(sent, ['/v1/account', '/v1/account'], 'read again on the way back');
  assert.deepEqual(flow.patreon, linked);
  card.root.isConnected = false;
  doc.defaultView.focus();
  assert.equal(doc.defaultView.listeners.size, 0, 'gone with its card');
  assert.equal(sent.length, 2);
});

// ── THE CONFIG AND THE DEPLOY ───────────────────────────────────────

test('PATREON-LINK: its secrets never touch a file - the toml carries Mac\'s client id and his tier map (Disciple, Herald and Hierophant: Supporter holds none) and no secret, linking waits for the deploy\'s secret, and the deploy puts both from the repository through one pipe after the Worker is up; every word the service says has a sentence (mutants: a secret written as a var; the secrets echoed; a tier mapped Mac did not name; the Hierophant tier unmapped)', () => {
  const toml = src('server-account/wrangler.toml');
  const id = /^PATREON_CLIENT_ID = "([^"]*)"$/m.exec(toml)?.[1];
  assert.match(id ?? '', /^[A-Za-z0-9_-]{32,128}$/, 'the client\'s id - public, it rides every authorize URL');
  assert.equal(patreonLinkOn({ PATREON_CLIENT_ID: id }), false, 'and linking waits for the secret the deploy puts beside it');
  const tiers = /^PATREON_TIERS = "([^"]*)"$/m.exec(toml)?.[1];
  assert.equal(tiers, '29666211:disciple,29666234:herald,29666221:hierophant', 'Mac\'s Disciple tier, his Herald since HERALD gave it its title, and his $50 Hierophant (HIEROPHANT-TIER)');
  const map = patreonTierMap({ PATREON_TIERS: tiers });
  assert.deepEqual([...map], [['29666211', 'disciple'], ['29666234', 'herald'], ['29666221', 'hierophant']]);
  assert.equal(map.get('29701293'), undefined, 'Supporter grants nothing by its pledge');
  const fifty = row({ patreon_user: '555', patreon_tiers: '29666221', patreon_status: 'active_patron' });
  assert.deepEqual(titlesHeld(fifty, { PATREON_TIERS: tiers }), ['hierophant'], 'a $50 patron holds the Hierophant by their pledge');
  assert.deepEqual(glyphsOf(fifty, { PATREON_TIERS: tiers }, AFTER + 30 * 86_400), ['hierophant'], 'and wears its crown');
  assert.doesNotMatch(toml, /^PATREON_(CLIENT|WEBHOOK)_SECRET\s*=/m, 'Cloudflare refuses a secret the name of a bound var');
  const yml = src('.github/workflows/account-deploy.yml');
  const step = yml.slice(yml.indexOf('- name: Put the Patreon secrets'), yml.indexOf('- name: Verify /v1/health names this deploy'));
  assert.ok(step.length > 100, 'the step is there, before the deploy is verified');
  assert.ok(yml.indexOf('- name: Deploy') < yml.indexOf('- name: Put the Patreon secrets'), 'after the Worker is up');
  assert.match(step, /PATREON_CLIENT_SECRET: \$\{\{ secrets\.PATREON_CLIENT_SECRET \}\}/);
  assert.match(step, /PATREON_WEBHOOK_SECRET: \$\{\{ secrets\.PATREON_WEBHOOK_SECRET \}\}/);
  assert.match(step, /jq -n 'env \| \{PATREON_CLIENT_SECRET, PATREON_WEBHOOK_SECRET\}[^\n]*\| \$WRANGLER secret bulk/);
  assert.doesNotMatch(step, /echo "\$\{?PATREON_(CLIENT|WEBHOOK)_SECRET/, 'a secret is never echoed');
  assert.match(step, /steps\.deploy\.outputs\.base/, 'the addresses Patreon is told are read off the deploy');
  for (const word of ['patreon-closed', 'patreon-down', 'patreon-needs-account', 'signature']) assert.equal(typeof REFUSALS[word], 'string', word);
});
