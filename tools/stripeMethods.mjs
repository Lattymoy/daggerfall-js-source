// SHOP-LOCAL (bible/06-Systems/Shop.md): THE SHOP'S WAYS TO PAY, SET BY THE DEPLOY. The checkout lists no payment method,
// so Stripe offers what the account's default configuration has on. This turns shop.js SHOP_PAY_METHODS on there, one
// request each so a method Stripe will not give this account is said and the rest still land, then reads back which are
// active. A method already on is not asked again. account-deploy.yml runs it:
//
//   STRIPE_SECRET_KEY=... node tools/stripeMethods.mjs    the summary's Markdown lines; exit 1 if nothing could be read
//
// The key is read from the environment and never printed.
import { isMain } from './lib/isMain.mjs';
import { SHOP_PAY_METHODS, STRIPE_PMC_API } from '../server-account/src/shop.js';

export { SHOP_PAY_METHODS };

/** Each method's name as a buyer knows it. */
export const PAY_METHOD_NAME = Object.freeze({
  ideal: 'iDEAL',
  wero: 'Wero',
  bancontact: 'Bancontact',
  eps: 'EPS',
  blik: 'BLIK',
  p24: 'Przelewy24',
  paypal: 'PayPal',
  revolut_pay: 'Revolut Pay',
});

/** The account's own default configuration in Stripe's list - never a Connect platform's child. Pure. */
export const accountDefault = (/** @type {any} */ list) =>
  (Array.isArray(list?.data) ? list.data : []).find((c) => c?.is_default === true && !c.application && !c.parent) ??
  null;

/** What the summary says of one method: Stripe's refusal, absent from the account, active, on and waiting, or off - and
 *  `turned`, when this deploy turned it on (AUDIT SHOP-LOCAL 3: one the Dashboard had off is never put back unsaid). Pure. */
export function methodState(/** @type {any} */ entry, /** @type {string|undefined} */ refusal, turned = false) {
  if (refusal) return `not turned on - Stripe: ${refusal}`;
  if (!entry) return 'not offered to this Stripe account';
  const on = turned ? 'turned on by this deploy' : 'on';
  if (entry.available === true) return on;
  return entry.display_preference?.preference === 'on'
    ? `${on}, waiting for Stripe to activate it (Dashboard: Settings, Payment methods)`
    : 'off';
}

/** Stripe's error in one short line - any key it echoes (a bad key's "sk_live_****1234") taken out first, so not even
 *  its last four reach the deploy's log. */
const said = (/** @type {any} */ body) =>
  String(body?.error?.message ?? 'no answer')
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_\S*/g, '[the key]')
    .replace(/\s+/g, ' ')
    .slice(0, 200);

/**
 * Turn `methods` on in the account's default configuration. `{ ok: true, lines }` (one Markdown line a method), or
 * `{ ok: false, lines: [], problem }` when the configuration cannot be read.
 * @param {typeof fetch} fetch @param {string} key @param {readonly string[]} [methods]
 */
export async function stripeMethods(fetch, key, methods = SHOP_PAY_METHODS) {
  const ask = async (/** @type {string} */ url, /** @type {string|null} */ form = null) => {
    const headers = {
      authorization: `Bearer ${key}`,
      ...(form == null ? {} : { 'content-type': 'application/x-www-form-urlencoded' }),
    };
    const res = await fetch(url, form == null ? { headers } : { method: 'POST', headers, body: form });
    return { ok: res.ok, body: await res.json().catch(() => null) };
  };
  const list = await ask(`${STRIPE_PMC_API}?limit=100`);
  const cfg = list.ok ? accountDefault(list.body) : null;
  if (!cfg)
    return {
      ok: false,
      lines: [],
      problem: list.ok
        ? 'the Stripe account has no default payment method configuration'
        : `Stripe refused the configurations' list: ${said(list.body)}`,
    };
  const at = `${STRIPE_PMC_API}/${encodeURIComponent(cfg.id)}`;
  /** @type {Map<string, string>} */
  const refused = new Map();
  /** @type {Set<string>} */
  const turned = new Set();
  for (const m of methods) {
    if (!cfg[m] || cfg[m].display_preference?.preference === 'on') continue;
    const r = await ask(at, `${encodeURIComponent(`${m}[display_preference][preference]`)}=on`);
    if (r.ok) turned.add(m);
    else refused.set(m, said(r.body));
  }
  const now = await ask(at);
  const end = now.ok && now.body ? now.body : cfg;
  return {
    ok: true,
    lines: methods.map(
      (m) =>
        `- ${PAY_METHOD_NAME[/** @type {keyof typeof PAY_METHOD_NAME} */ (m)] ?? m}: ${methodState(end[m], refused.get(m), turned.has(m))}`,
    ),
  };
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key) {
    console.log('STRIPE_SECRET_KEY is not set - the ways to pay are left as they are');
    return;
  }
  let r;
  try {
    r = await stripeMethods(fetch, key);
  } catch (e) {
    console.error(`Stripe could not be reached: ${String(/** @type {any} */ (e)?.message ?? e).slice(0, 200)}`);
    process.exit(1);
  }
  if (r.lines.length) console.log(r.lines.join('\n'));
  if (!r.ok) {
    console.error(r.problem);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) await main();
