// ACC1e — THE ACCOUNT CARD, IN A REAL BROWSER, AT EVERY STAGE.
//
// AUDIT-ACC's hardest lesson was that a green suite says nothing about
// whether a thing RUNS: the account Worker's pins passed over a Worker
// that could not boot, because they proved the exports existed and
// that is exactly what the runtime refused to start over. node cannot
// draw a card, so the node pins prove the card's ARITHMETIC - and this
// proves the card.
//
// It needs no dev server and no arena2. The skin is a string
// (enhancedStyle.js ENHANCED_CSS) and the card is a function over a
// Document, so both are handed to a blank page and the answers are
// read back off the COMPUTED STYLE - not off the source, which is
// what a test could already have done and which cannot see a rule
// that never applied.
//
//     node tools/accountCardProbe.mjs
//     PROBE_SHOTS=/tmp node tools/accountCardProbe.mjs
//
// THE MEASUREMENT THAT MATTERS is the one that found ACC1e F1:
// `.fieldlabel` read `var(--ash)` and nothing declares --ash, so the
// declaration was invalid and the label inherited --bone. No source
// sweep sees that. A computed colour does.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// The three modules the page needs, served as text so the page can
// import them without a bundler. `handleShape.js` rides along because
// accountClient.js imports it.
const MODULES = {
  '/handleShape.js': read('src/net/handleShape.js'),
  '/accountClient.js': read('src/net/accountClient.js').replace("from './handleShape.js'", "from '/handleShape.js'"),
  '/accountFlow.js': read('src/ui/accountFlow.js').replace("from '../net/accountClient.js'", "from '/accountClient.js'"),
  '/enhancedAccount.js': read('src/ui/enhancedAccount.js').replace("from './accountFlow.js'", "from '/accountFlow.js'"),
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.route('**/*', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (MODULES[path]) return route.fulfill({ status: 200, contentType: 'text/javascript', body: MODULES[path] });
  if (path === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="app"></div></body></html>' });
  // NOTHING IS SERVED FROM THE NETWORK, deliberately - a probe that
  // quietly reached the real account service would be a probe that
  // makes rows in D1. The FACES are fetched in node and inlined below,
  // so the page needs no network for them either.
  return route.abort();
});

await page.goto('http://probe.invalid/', { waitUntil: 'domcontentloaded' });

// The skin, injected exactly as the game injects it - INCLUDING the
// one Google Fonts request it makes.
//
// THE FIRST CUT OF THIS FILE NEVER LOADED A FACE. It injected
// ENHANCED_CSS and nothing else, so every sheet it produced was
// Georgia and system-ui standing in for Cormorant and Barlow Semi
// Condensed - the fallbacks, photographed and called the design. The
// card DECLARED the right families the whole time, which is exactly
// why a source sweep could not have caught it: declaring a family and
// rendering in it are different claims.
//
// The faces are fetched HERE, in node, and inlined as data URIs, so
// the page needs no network and the probe stays hermetic. A modern
// User-Agent is sent because Google serves ttf to anything it does not
// recognise and woff2 to a browser.
const { ENHANCED_CSS, ENHANCED_FONTS_URL } = await import('../src/ui/enhancedStyle.js');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
let fontCss = await (await fetch(ENHANCED_FONTS_URL, { headers: { 'user-agent': UA } })).text();
const urls = [...new Set([...fontCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
for (const u of urls) {
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  fontCss = fontCss.split(u).join(`data:font/woff2;base64,${buf.toString('base64')}`);
}
await page.addStyleTag({ content: fontCss });
await page.addStyleTag({ content: ENHANCED_CSS });
await page.evaluate(() => document.fonts.ready);

const STAGES = [
  { stage: 'out', label: 'signed out' },
  { stage: 'register', label: 'creating an account' },
  { stage: 'login', label: 'signing in' },
  { stage: 'recover', label: 'spending the recovery code' },
  { stage: 'code', label: 'the recovery code', code: '7GEPQ-47BS9-AYK70-QMWYW' },
  { stage: 'in', label: 'signed in', account: { name: 'Nystul', handle: 'Nystul', kind: 'linked' } },
  { stage: 'in', label: 'a guest', account: { name: 'Mithriil Stormaire', guestName: 'Mithriil Stormaire', handle: null, kind: 'guest' } },
  { stage: 'password', label: 'changing the password' },
];

const measured = await page.evaluate(async (stages) => {
  const { AccountFlow } = await import('/accountFlow.js');
  const { accountCard } = await import('/enhancedAccount.js');
  const app = document.getElementById('app');
  app.style.cssText = 'padding:24px;max-width:640px;margin:0 auto;';
  const out = [];
  for (const s of stages) {
    const flow = AccountFlow({ io: { fetch: () => { throw new Error('the probe makes no requests'); } }, storage: null });
    flow.stage = s.stage;
    if (s.code) flow.recoveryCode = s.code;
    if (s.account) flow.account = s.account;
    const card = accountCard(document, flow);
    app.append(card.root);
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const label = card.root.querySelector('.fieldlabel');
    const code = card.root.querySelector('.acctcode code');
    const primary = card.root.querySelector('.act.primary');
    out.push({
      stage: s.stage,
      label: s.label,
      // the card is on the page and has real size
      width: card.root.getBoundingClientRect().width,
      height: card.root.getBoundingClientRect().height,
      bg: cs(card.root).backgroundColor,
      border: cs(card.root).borderTopColor,
      // ACC1e F1: the label's COMPUTED colour. --bone means the token
      // was invalid and it inherited; --dim means the rule applied.
      labelColor: label ? cs(label).color : null,
      inputs: card.root.querySelectorAll('input').length,
      inputBg: cs(card.root.querySelector('input'))?.backgroundColor ?? null,
      codeColor: code ? cs(code).color : null,
      codeSize: code ? cs(code).fontSize : null,
      primaryColor: primary ? cs(primary).borderTopColor : null,
      // WHICH FACE ACTUALLY DREW. The declared family is what a source
      // sweep can already read; `document.fonts.check` answers whether
      // the file is really there, which is the only way to tell the
      // enhanced face from the fallback standing in for it.
      headFamily: cs(card.root.querySelector('h3')).fontFamily,
      bodyFamily: cs(card.root.querySelector('p.meta') ?? card.root).fontFamily,
      // GROUPING: a hint must sit nearer the box it describes than the
      // NEXT field's label, or it reads as a caption for the wrong one.
      grouping: [...card.root.querySelectorAll('.fieldhint')].map((h) => {
        const box = h.previousElementSibling;            // its own input
        const nextLabel = h.parentElement.nextElementSibling?.querySelector?.('.fieldlabel');
        if (!box || !nextLabel) return null;
        return {
          toOwn: Math.round(h.getBoundingClientRect().top - box.getBoundingClientRect().bottom),
          toNext: Math.round(nextLabel.getBoundingClientRect().top - h.getBoundingClientRect().bottom),
        };
      }).filter(Boolean),
      // nothing may overflow the card it is drawn in
      overflow: [...card.root.querySelectorAll('*')].some(
        (n) => n.getBoundingClientRect().right > card.root.getBoundingClientRect().right + 1,
      ),
    });
  }
  return out;
}, STAGES);

// THE SKIN'S OWN TOKENS, so the probe compares against the source of
// truth rather than against hexes typed here.
const { ENHANCED_TOKENS } = await import('../src/ui/enhancedStyle.js');
const token = (name) => ENHANCED_TOKENS.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
const rgb = (hex) => {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
};
const DIM = rgb(token('dim'));
const BONE = rgb(token('bone'));
const BRASS = rgb(token('brass'));

check('the card renders at every stage with real size', measured.every((m) => m.width > 200 && m.height > 80),
  measured.map((m) => `${m.label}:${Math.round(m.width)}x${Math.round(m.height)}`).join(' '));
check('no page errors while building any stage', errors.length === 0, errors.join(' | '));
check('nothing overflows the card it is drawn in', measured.every((m) => !m.overflow));
check('every form stage drew its boxes', measured.filter((m) => ['register', 'login', 'recover', 'password'].includes(m.stage)).every((m) => m.inputs >= 2));

// ═══ ACC1e F1, MEASURED ═══════════════════════════════════════════
const labelled = measured.filter((m) => m.labelColor);
check('ACC1e F1: a field label is DIM, not the body colour', labelled.length > 0 && labelled.every((m) => m.labelColor === DIM),
  `want ${DIM}, got ${[...new Set(labelled.map((m) => m.labelColor))].join('/')}${labelled.some((m) => m.labelColor === BONE) ? ' (BONE = the --ash bug is back)' : ''}`);

const codeRow = measured.find((m) => m.codeColor);
check('the recovery code is brass and large', codeRow?.codeColor === BRASS && parseFloat(codeRow.codeSize) >= 16,
  `${codeRow?.codeColor} at ${codeRow?.codeSize}`);
check('the leading button wears brass', measured.filter((m) => m.primaryColor).every((m) => m.primaryColor === BRASS));

// ═══ THE FACES ════════════════════════════════════════════════════
// Mac asked whether the card uses the enhanced font. It declares the
// skin's own tokens - --display for a heading, --data for body - but
// DECLARING a family and RENDERING in it are different claims, and the
// first version of this probe could not tell them apart.
const faces = await page.evaluate(() => ({
  display: document.fonts.check('400 22px Cormorant'),
  data: document.fonts.check('400 15px "Barlow Semi Condensed"'),
  loaded: [...document.fonts].map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i),
}));
check('the enhanced faces actually LOADED, not just declared', faces.display && faces.data,
  `Cormorant ${faces.display}, Barlow Semi Condensed ${faces.data} (loaded: ${faces.loaded.join(', ') || 'none'})`);
check('a heading is set in the skin\'s DISPLAY face', measured.every((m) => /Cormorant/.test(m.headFamily)),
  measured[0]?.headFamily);
check('body copy is set in the skin\'s DATA face', measured.every((m) => /Barlow/.test(m.bodyFamily)),
  measured[0]?.bodyFamily);

// ═══ PROXIMITY SAYS WHAT BELONGS TOGETHER ═════════════════════════
// The first sheet showed every hint sitting as close to the NEXT
// field's label as to its own box. Eyeballed it looked like spacing;
// measured it is a hint captioning the wrong input.
const groups = measured.flatMap((m) => m.grouping);
check('a field hint is nearer its own box than the next field\'s label',
  groups.length > 0 && groups.every((g) => g.toNext > g.toOwn + 4),
  groups.length ? `own ${groups[0].toOwn}px vs next ${groups[0].toNext}px` : 'no hints measured');

// ── the sheet, for a human ──────────────────────────────────────────
await page.evaluate(() => { document.body.style.background = getComputedStyle(document.documentElement).getPropertyValue('--ink') || '#0e1013'; });
await page.screenshot({ path: `${shots}/acc1e-card.png`, fullPage: true });

// ...and the phone, where the code's tracking is the thing that breaks
await page.setViewportSize({ width: 390, height: 1400 });
const phoneOverflow = await page.evaluate(() => [...document.querySelectorAll('.card.acct')].some(
  (c) => [...c.querySelectorAll('*')].some((n) => n.getBoundingClientRect().right > c.getBoundingClientRect().right + 1),
));
check('nothing overflows at phone width either', !phoneOverflow);
await page.screenshot({ path: `${shots}/acc1e-card-phone.png`, fullPage: true });

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks`);
console.log(`sheets: ${shots}/acc1e-card.png, ${shots}/acc1e-card-phone.png`);
process.exit(failed.length ? 1 : 0);
