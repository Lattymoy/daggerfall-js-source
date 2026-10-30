// SHOP-LOCAL (2026-10-28, a player: "Allow for iDeal payment options (or better ones) for MTX ... i either have to be;
// german - have iphone - have credit card"; the owner: "Do it"; bible/06-Systems/Shop.md SHOP-LOCAL). iDEAL takes euros
// only and the shop priced in dollars, so Stripe never offered it. Now a checkout asks for Adaptive Pricing (the buyer's
// own currency), asked again in dollars if Stripe refuses it, and the account deploy turns the local ways to pay on in
// the Stripe account (tools/stripeMethods.mjs). A payment shown in euros still reads USD to the webhook, so it grants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { standService } from '../accountDb.mjs';
import { checkoutFields, stripeCheckout, shopConfirmPage, STRIPE_API, STRIPE_PMC_API, SHOP_PAY_METHODS } from '../../server-account/src/shop.js';
import { stripeMethods, accountDefault, methodState, PAY_METHOD_NAME } from '../../tools/stripeMethods.mjs';
import { shopWareById } from '../../src/net/shopLaw.js';
import { graph } from '../importGraph.mjs';

// AURUM-ONLY (PIN MOVED): money buys the Aurum packs alone, so the checkout is a pack's - the 2,400, $19.99
const ON = { STRIPE_SECRET_KEY: 'sk_test_shop', STRIPE_WEBHOOK_SECRET: 'whsec_shop', SHOP_ON_SALE: 'title:genesis,glyph:origin,aura:eternal,aurum:2400', AURUM_OPEN: 'on' };
const KEY = 'sk_live_never_said';
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const order = () => ({ id: 'a'.repeat(24), player: 'p1', handle: 'Buyer', ware: shopWareById('aurum:2400'), origin: 'https://accounts.invalid', expiresAt: 123 });

test('SHOP-LOCAL the checkout asks Stripe for the buyer\'s own currency (Adaptive Pricing), still priced in dollars by the service; the confirm page says Stripe can show it (mutants: the ask dropped; the line dropped)', () => {
  const f = checkoutFields(order());
  assert.equal(f['adaptive_pricing[enabled]'], 'true');
  assert.equal(f['line_items[0][price_data][currency]'], 'usd', 'the price stays the service\'s, in dollars');
  assert.equal(f['line_items[0][price_data][unit_amount]'], 1999);
  assert.ok(!Object.keys(f).some((k) => k.startsWith('payment_method_types')), 'no list of methods: Stripe offers the account\'s');
  const p = shopConfirmPage({ handle: 'Buyer', ware: shopWareById('aurum:2400'), ticket: 't1' });
  assert.ok(p.lines.includes("Stripe can show the price in your own currency, with your country's ways to pay."));
  assert.ok(p.lines.indexOf('Price: $19.99 (USD), paid once.') < p.lines.findIndex((l) => l.startsWith('Stripe can show')), 'after the price it is about');
});

test('SHOP-LOCAL a session Stripe refuses (400) with Adaptive Pricing is asked again without it, in dollars, under a key of its own; any other failure is not asked again (mutants: no second ask; the second ask still localised; the same key)', async () => {
  const run = async (answers) => {
    const asked = [];
    const fetch = async (url, init) => { asked.push({ url: String(url), init, sent: new URLSearchParams(init.body) }); return answers.shift()(); };
    const said = console.error;
    console.error = () => {};
    try { return { r: await stripeCheckout(fetch, ON, checkoutFields(order())), asked }; } finally { console.error = said; }
  };
  const ok = () => Response.json({ id: 'cs_test_9', url: 'https://checkout.stripe.com/c/pay/cs_test_9' });
  const refused = () => Response.json({ error: { message: 'Adaptive Pricing is not available for this account.', param: 'adaptive_pricing' } }, { status: 400 });
  const first = await run([ok]);
  assert.deepEqual(first.r, { id: 'cs_test_9', url: 'https://checkout.stripe.com/c/pay/cs_test_9' });
  assert.equal(first.asked.length, 1);
  assert.equal(first.asked[0].sent.get('adaptive_pricing[enabled]'), 'true');
  const again = await run([refused, ok]);
  assert.deepEqual(again.r, { id: 'cs_test_9', url: 'https://checkout.stripe.com/c/pay/cs_test_9' }, 'the buyer still reaches a page');
  assert.equal(again.asked.length, 2);
  assert.ok(again.asked.every((a) => a.url === STRIPE_API));
  assert.equal(again.asked[1].sent.get('adaptive_pricing[enabled]'), null, 'the second ask in dollars');
  assert.equal(again.asked[1].sent.get('line_items[0][price_data][unit_amount]'), '1999');
  assert.deepEqual(again.asked.map((a) => a.init.headers['idempotency-key']), [`shop-${'a'.repeat(24)}`, `shop-${'a'.repeat(24)}-usd`], 'a key of its own: the refused ask saved nothing under the first');
  const down = await run([() => new Response('', { status: 500 })]);
  assert.deepEqual(down.r, { error: 'stripe-down' });
  assert.equal(down.asked.length, 1, 'Stripe down is not asked twice');
});

test('SHOP-LOCAL, end to end: a payment the buyer made in euros reads USD and the order\'s amount to the webhook (Stripe\'s Adaptive Pricing), so it grants as any other (mutants: the presentment read as the amount)', async () => {
  const s = await standService(ON);
  const me = await s.registered('Buyer');
  const ticket = new URL((await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${me.secret}` } })).json()).shop.wares.find((w) => w.id === 'aurum:2400').buy).searchParams.get('t');
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => { if (String(url) === STRIPE_API) return Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }); throw new Error(`no stand-in for ${url}`); };
  try {
    await s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() });
  } finally { globalThis.fetch = real; }
  const o = s.env.DB._raw.prepare('SELECT * FROM shop_orders WHERE player = ?').get(me.id);
  // Stripe's own example (docs.stripe.com, Adaptive Pricing, "Event destinations and reporting"): the integration's
  // currency and amount on the session, the buyer's in presentment_details
  const paid = { id: 'cs_test_1', client_reference_id: o.id, metadata: { order: o.id }, payment_status: 'paid', payment_intent: 'pi_eur', currency: 'usd', amount_subtotal: 1999, amount_total: 1999, presentment_details: { presentment_amount: 1876, presentment_currency: 'eur' } };
  const t = Math.floor(Date.now() / 1000), body = JSON.stringify({ id: 'evt_eur', type: 'checkout.session.completed', data: { object: paid } });
  const res = await s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
  assert.deepEqual(await res.json(), { ok: true, applied: 1 });
  assert.equal(s.env.DB._raw.prepare('SELECT status FROM shop_orders WHERE id = ?').get(o.id).status, 'paid');
  const balance = (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${me.secret}` } })).json()).aurum.balance;
  assert.equal(balance, 2400, 'the pack\'s Aurum on the account (PIN MOVED, AURUM-ONLY: a pack, not Eternal)');
});

// ── THE WAYS TO PAY, SET BY THE DEPLOY ───────────────────────────────

/** Stripe's payment method configurations stood in for: the account's default and a platform's child, every ask kept. */
function fakeStripe({ cfg, refuse = {}, listStatus = 200, activates = true } = {}) {
  const asked = [];
  const state = structuredClone(cfg);
  const child = { id: 'pmc_child', is_default: true, application: 'ca_platform', parent: 'pmc_root', ideal: { available: false, display_preference: { preference: 'off' } } };
  const fetch = async (url, init = {}) => {
    const u = String(url);
    asked.push({ url: u, method: init.method ?? 'GET', body: init.body ?? null, auth: init.headers?.authorization });
    if (u === `${STRIPE_PMC_API}?limit=100`) return Response.json(listStatus === 200 ? { object: 'list', data: [child, state] } : { error: { message: 'Invalid API Key provided: sk_live_****************said' } }, { status: listStatus });
    if (u === `${STRIPE_PMC_API}/${state.id}` && (init.method ?? 'GET') === 'GET') return Response.json(state);
    if (u === `${STRIPE_PMC_API}/${state.id}` && init.method === 'POST') {
      const [, m] = /^([a-z0-9_]+)%5Bdisplay_preference%5D%5Bpreference%5D=on$/.exec(init.body) ?? [];
      if (refuse[m]) return Response.json({ error: { message: refuse[m] } }, { status: 400 });
      state[m] = { available: activates, display_preference: { preference: 'on', value: 'on' } };
      return Response.json(state);
    }
    throw new Error(`no stand-in for ${init.method ?? 'GET'} ${u}`);
  };
  return { fetch, asked, state };
}
const off = { available: false, display_preference: { preference: 'off', value: 'off' } };
const on = { available: true, display_preference: { preference: 'on', value: 'on' } };

test('SHOP-LOCAL THE WAYS TO PAY (tools/stripeMethods.mjs): iDEAL, Wero, Bancontact, EPS, BLIK, Przelewy24, PayPal and Revolut Pay declared beside the shop; turned on in the ACCOUNT\'s default configuration (never a platform\'s child), one ask each and only where off, then read back - each method\'s line says what Stripe has active, a refusal and an absent method said and the rest still landing; the key never said (mutants: every method asked again; a refusal stops the rest; the child configured)', async () => {
  assert.deepEqual([...SHOP_PAY_METHODS], ['ideal', 'wero', 'bancontact', 'eps', 'blik', 'p24', 'paypal', 'revolut_pay']);
  assert.ok(SHOP_PAY_METHODS.every((m) => PAY_METHOD_NAME[m]), 'a name for each');
  assert.equal(accountDefault({ data: [{ id: 'a', is_default: false }, { id: 'b', is_default: true, application: 'ca_x' }, { id: 'c', is_default: true, application: null, parent: null }] }).id, 'c');
  assert.equal(accountDefault({ data: [] }), null);
  // the account as a US one is likely to stand: cards on, iDEAL and its kin off, Bancontact already on, no PayPal, no Wero
  const cfg = { id: 'pmc_root', is_default: true, application: null, parent: null, card: on, ideal: off, bancontact: on, eps: off, blik: off, p24: off, revolut_pay: off };
  const st = fakeStripe({ cfg, refuse: { blik: 'BLIK is not available in your country.' } });
  const r = await stripeMethods(st.fetch, KEY);
  assert.equal(r.ok, true);
  const posts = st.asked.filter((a) => a.method === 'POST');
  assert.deepEqual(posts.map((a) => a.body), ['ideal', 'eps', 'blik', 'p24', 'revolut_pay'].map((m) => `${m}%5Bdisplay_preference%5D%5Bpreference%5D=on`), 'only the methods the account has and has off, one ask each - BLIK\'s refusal stops nothing');
  assert.ok(posts.every((a) => a.url === `${STRIPE_PMC_API}/pmc_root`), 'the account\'s own default, never the platform\'s child');
  assert.ok(st.asked.every((a) => a.auth === `Bearer ${KEY}`));
  assert.deepEqual(r.lines, [
    '- iDEAL: turned on by this deploy',
    '- Wero: not offered to this Stripe account',
    '- Bancontact: on',
    '- EPS: turned on by this deploy',
    '- BLIK: not turned on - Stripe: BLIK is not available in your country.',
    '- Przelewy24: turned on by this deploy',
    '- PayPal: not offered to this Stripe account',
    '- Revolut Pay: turned on by this deploy',
  ], 'AUDIT SHOP-LOCAL 3: a method the deploy turned on is said so - one the Dashboard had off is never put back unsaid');
  assert.ok(!r.lines.join('\n').includes(KEY), 'the key never said');
  // a second deploy asks nothing more
  const again = await stripeMethods(st.fetch, KEY);
  assert.equal(again.ok, true);
  assert.equal(again.lines[0], '- iDEAL: on', 'on the next deploy, already on');
  assert.equal(st.asked.filter((a) => a.method === 'POST').length, 6, 'only BLIK, refused before, is asked again');
  // on and not yet active: said so, with where to look
  const wait = fakeStripe({ cfg: { ...cfg, ideal: off }, activates: false });
  assert.equal((await stripeMethods(wait.fetch, KEY, ['ideal'])).lines[0], '- iDEAL: turned on by this deploy, waiting for Stripe to activate it (Dashboard: Settings, Payment methods)');
  assert.equal(methodState(off), 'off');
  // nothing to read: said, nothing asked of it
  const bad = fakeStripe({ cfg, listStatus: 401 });
  const no = await stripeMethods(bad.fetch, KEY);
  assert.deepEqual([no.ok, no.lines], [false, []]);
  assert.equal(no.problem, 'Stripe refused the configurations\' list: Invalid API Key provided: [the key]', 'not even the masked key Stripe echoes, whose last four are the key\'s');
  assert.equal(bad.asked.length, 1);
});

test('SHOP-LOCAL the deploy runs it on every account deploy, after the Stripe secrets and before Discord\'s last step: the key an env var from the repository\'s secrets, never an argument; never red (cards are taken either way) - a failure a warning and the summary\'s line; skipped, said, with no key; and the deploy\'s path filter holds the tool\'s own import graph (mutants: the step red - as it first shipped; the tool unlisted)', () => {
  const wf = rd('.github/workflows/account-deploy.yml');
  const steps = wf.split(/\n      - name: /).slice(1);
  const at = steps.findIndex((s) => s.startsWith('Turn on the shop\'s ways to pay, where the repository has the Stripe key\n'));
  const secrets = steps.findIndex((s) => s.startsWith('Put the Stripe secrets, where the repository has them\n'));
  assert.ok(at > secrets && secrets >= 0, 'after the secrets are put');
  assert.ok(at < steps.length - 1 && steps.at(-1).startsWith('Point Discord at the service'), 'Discord\'s step stays last');
  const step = steps[at].split(/\n\n      # /)[0];
  assert.match(step, /STRIPE_SECRET_KEY: \$\{\{ secrets\.STRIPE_SECRET_KEY \}\}/);
  assert.match(step, /node tools\/stripeMethods\.mjs 2> "\$err"/);
  assert.doesNotMatch(step, /\$\{?STRIPE_SECRET_KEY\}? *[^"\s]*\s*node|--key|echo "\$\{?STRIPE_SECRET_KEY/, 'the key is never an argument nor echoed');
  // AUDIT SHOP-LOCAL 1 (the first deploy: red, its reason unsaid, every later step skipped): the step's own bash RUN as
  // GitHub runs it - the job's `shell: bash` is bash -e -o pipefail - with a stand-in node
  assert.match(wf, /\n    defaults:\n      run:\n        shell: bash\n/, 'the job\'s shell, which -e comes with');
  const script = step.split('\n        run: |\n')[1].split('\n').filter((l) => l === '' || l.startsWith('          ')).map((l) => l.slice(10)).join('\n');
  const run = (exit, key = 'sk_test_stand_in') => {
    const dir = mkdtempSync(join(tmpdir(), 'waystopay-'));
    writeFileSync(join(dir, 'node'), `#!/bin/sh\necho "- iDEAL: on"\n${exit ? 'echo "Stripe refused the configurations\' list: [the key]" >&2\n' : ''}exit ${exit}\n`);
    chmodSync(join(dir, 'node'), 0o755);
    const summary = join(dir, 'summary.md');
    writeFileSync(summary, '');
    const r = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script], { encoding: 'utf8', env: { PATH: `${dir}:${process.env.PATH}`, STRIPE_SECRET_KEY: key, RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: summary } });
    return { status: r.status, out: r.stdout, summary: readFileSync(summary, 'utf8') };
  };
  const failed = run(1);
  assert.equal(failed.status, 0, `never red - cards are taken either way (${failed.out})`);
  assert.match(failed.out, /::warning::the shop's ways to pay were not set - Stripe refused the configurations' list: \[the key\]/, 'the reason said');
  assert.match(failed.summary, /#### The ways to pay[^]*\*\*Not set:\*\* Stripe refused/, 'and in the summary');
  const done = run(0);
  assert.equal(done.status, 0);
  assert.match(done.summary, /#### The ways to pay\n\n- iDEAL: on\n/);
  assert.doesNotMatch(done.out, /::warning::/);
  const none = run(0, '');
  assert.deepEqual([none.status, none.out.trim(), none.summary], [0, 'STRIPE_SECRET_KEY is not set - the ways to pay are left as they are', ''], 'no key: skipped, said');
  const listed = (wf.split('\n    paths:\n')[1] ?? '').split('\n').filter((l) => /^      - "/.test(l)).map((l) => l.slice(9, -1));
  const outside = graph('tools/stripeMethods.mjs').filter((f) => !f.startsWith('server-account/'));
  assert.ok(outside.includes('tools/stripeMethods.mjs') && outside.includes('tools/lib/isMain.mjs'));
  for (const f of outside) assert.ok(listed.includes(f), `${f} is read by the deploy's ways-to-pay step and a change to it would not deploy`);
});
