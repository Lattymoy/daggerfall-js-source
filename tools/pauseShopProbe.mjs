// SHOP (bible/06-Systems/Shop.md) - THE SHOP, SEEN in a real browser.
//
// The pause face through its real painter, with the hourglass, the envelope and the laurel handed it (stand-ins: the
// clock, the box), and the gem at the end of their row. Opened: the disclaimer first, a tab a category, a panel a ware -
// its price, its live picture (the title's flame, the glyph's dragon, the aura on its stage) - and Buy, the service's
// own link. Its /v1/account answered here (the service is never reached): Buy followed, the account read again on the
// window's focus, the ware held, Owned and Wear. Signed out and on a 390 phone too. Frames go to SHOP_OUT, never the tree.
//
//     npx vite --port 5199 &
//     SHOP_OUT=/tmp/shop node tools/pauseShopProbe.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const OUT = process.env.SHOP_OUT ?? '/tmp/shop-probe';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const BUY = (id) => `https://accounts.invalid/v1/shop/buy?t=${encodeURIComponent(id)}`;
/** The account the stand-in service answers: nothing bought, until `paid` holds a ware. */
const answer = (paid) => ({
  account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' },
  wardrobe: {
    titles: paid.includes('title:genesis') ? ['genesis'] : [],
    title: null,
    glyphs: [],
    auras: [],
    aura: null,
    icons: [],
    icon: null,
  },
  shop: {
    on: true,
    wares: ['title:genesis', 'glyph:origin', 'aura:eternal'].map((id) => ({
      id,
      sale: true,
      held: paid.includes(id),
      buy: paid.includes(id) ? null : BUY(id),
    })),
  },
});

async function toPause(page, signedIn, paid) {
  // every other read the face makes (the cloud's saves) answered empty - one left to the real service trips the client's
  // overload gate (net/accountClient.js BUSY-GATE) and holds the window's own read back
  await page.route(/\/v1\/(?!account)/, (route) =>
    route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"saves":[]}' }),
  );
  await page.route(/\/v1\/account(\/.*)?$/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(answer(paid)),
    });
  });
  await page.addInitScript((on) => {
    try {
      localStorage.setItem(
        'dagger.quicksave',
        JSON.stringify({
          v: 1,
          name: 'Aelwyn',
          chargenDone: true,
          career: { name: 'Spellsword' },
          level: 4,
          items: [],
        }),
      );
      if (on)
        localStorage.setItem(
          'dagger.account.session',
          JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'probe-secret' }),
        );
    } catch {
      /* storage off */
    }
  }, signedIn);
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.px-menu', { timeout: 120000 });
  if (await page.locator('.px-acctstage').count()) await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const { openPauseFlow } = await import('/src/ui/pauseDoor.js');
    const clock = { now: Date.now(), rows: [], seatsOpen: false, zero: false, doors: {} };
    const box = { version: 1, waiting: 0, state: 'in', post: [], refresh: async () => {} };
    openPauseFlow(() => {}, { exitToMenu: () => {}, textLines: () => null, timers: () => clock, post: () => box });
  });
  await page.waitForSelector('.px-shopmark', { timeout: 15000 });
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [label, opts] of [
  ['desktop', { viewport: { width: 1280, height: 860 } }],
  ['phone', devices['iPhone 13']],
]) {
  for (const signedIn of [true, false]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const paid = [];
    await toPause(page, signedIn, paid);
    const tag = `${label}-${signedIn ? 'in' : 'out'}`;
    // THE GEM at the end of the row: right of nothing but the laurel, on the screen
    const row = await page.evaluate(() =>
      Object.fromEntries(
        ['.px-timersmark', '.px-postmark', '.px-seasonmark', '.px-shopmark'].map((s) => {
          const r = document.querySelector(s)?.getBoundingClientRect();
          return [s, r ? [Math.round(r.left), Math.round(r.right)] : null];
        }),
      ),
    );
    const gem = row['.px-shopmark'],
      laurel = row['.px-seasonmark'];
    check(
      `${tag}: the gem stands just left of the laurel, on the screen`,
      !!gem && !!laurel && laurel[0] - gem[1] >= 0 && laurel[0] - gem[1] <= 24 && gem[1] - gem[0] >= 40 && gem[0] >= 0,
      JSON.stringify(row),
    );
    await page.screenshot({ path: `${OUT}/${tag}-face.png` });
    await page.locator('.px-shopmark').click();
    await page.waitForSelector('.px-shopwin', { timeout: 5000 });
    if (signedIn)
      await page
        .waitForFunction(() => document.querySelector('.sh-buy') || document.querySelector('.sh-state-held'), null, {
          timeout: 10000,
        })
        .catch(() => {});
    // THE DISCLAIMER FIRST, before any ware
    const order = await page.evaluate(() =>
      [...document.querySelector('.px-shopwin .px-body').children].map((n) => n.className),
    );
    check(
      `${tag}: the disclaimer stands above the wares`,
      order.indexOf('sh-proceeds') >= 0 && order.indexOf('sh-proceeds') < order.indexOf('sh-panels'),
      order.join(' > '),
    );
    const said = await page.locator('.sh-proceeds').textContent();
    check(
      `${tag}: it says the proceeds' use`,
      /All proceeds go to the costs of developing DFO Online\./.test(said ?? ''),
      said ?? '',
    );
    const tabs = await page.$$eval('.sh-tab', (ns) => ns.map((n) => n.textContent));
    check(`${tag}: a tab a category`, tabs.length === 3, tabs.join(' | '));
    const focus = await page.evaluate(() => document.activeElement?.id);
    check(`${tag}: the keyboard lands on the open tab`, focus === 'sh-tab-titles', String(focus));
    const shots = [];
    for (const [cat, price] of [
      ['titles', '$5.00'],
      ['glyphs', '$2.00'],
      ['auras', '$20.00'],
    ]) {
      await page.locator(`#sh-tab-${cat}`).click();
      if (cat === 'auras') await page.waitForTimeout(2500); // the stage's module loaded and the cape kindled
      const p = await page.locator('.sh-panel .sh-price').first().textContent();
      check(`${tag}: ${cat} - its price`, p === price, p ?? '');
      const buy = await page.locator('.sh-buy').count();
      check(`${tag}: ${cat} - Buy offered only signed in`, signedIn ? buy === 1 : buy === 0, `${buy}`);
      if (signedIn)
        check(
          `${tag}: ${cat} - Buy is the service's own link, in a new tab`,
          (await page.locator('.sh-buy').getAttribute('href'))?.startsWith('https://accounts.invalid/v1/shop/buy?t=') &&
            (await page.locator('.sh-buy').getAttribute('target')) === '_blank',
        );
      await page.screenshot({ path: `${OUT}/${tag}-${cat}.png` });
      shots.push(cat);
    }
    // the aura's stage drawn: its fire's light in the frame as the page shows it (a WebGL canvas reads back blank)
    const frame = PNG.sync.read(await page.locator('.sh-auracanvas').screenshot());
    let lit = 0;
    for (let i = 0; i < frame.data.length; i += 4)
      if (frame.data[i + 2] > 150 && frame.data[i + 2] > frame.data[i + 1]) lit++;
    check(`${tag}: the aura's stage draws its fire`, lit > 200, `${lit} blue-violet pixels`);
    const wide = await page.evaluate(() => {
      const w = document.querySelector('.px-shopwin');
      return w ? [w.getBoundingClientRect().right, window.innerWidth, w.scrollWidth, w.clientWidth] : null;
    });
    check(
      `${tag}: the window within the screen, nothing wider than it`,
      !!wide && wide[0] <= wide[1] + 1 && wide[2] <= wide[3] + 1,
      JSON.stringify(wide),
    );
    if (signedIn) {
      // BUY followed: the note; the payment lands; back on the window, the account read again - Owned and Wear
      await page.locator('#sh-tab-titles').click();
      await page.evaluate(() => {
        const a = document.querySelector('.sh-buy');
        a.removeAttribute('target');
        a.href = 'javascript:void 0';
        a.click();
      });
      const note = await page.locator('.sh-say').textContent();
      check(`${tag}: Buy says where the player is`, /Finish paying in your browser/.test(note ?? ''), note ?? '');
      paid.push('title:genesis');
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForSelector('.sh-state-held', { timeout: 10000 }).catch(() => {});
      const after = await page.evaluate(() => ({
        state: document.querySelector('.sh-state')?.textContent,
        wear: document.querySelector('.sh-wear')?.textContent,
        say: document.querySelector('.sh-say')?.textContent,
      }));
      check(
        `${tag}: the payment landed - Owned, Wear, said`,
        after.state === 'Owned' && after.wear === 'Wear' && /Genesis is on your account/.test(after.say ?? ''),
        JSON.stringify(after),
      );
      await page.screenshot({ path: `${OUT}/${tag}-owned.png` });
    } else {
      const who = await page.locator('.sh-who').textContent();
      check(`${tag}: signed out, it says how to buy`, /Sign in from your profile to buy\./.test(who ?? ''), who ?? '');
    }
    // ESCAPE closes the window, and the keyboard is back on the gem
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.px-shopwin'), null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(100);
    const back = await page.evaluate(() => ({
      open: !!document.querySelector('.px-shopwin'),
      focus: document.activeElement?.className,
    }));
    check(
      `${tag}: Escape closes it, the focus back on the gem`,
      !back.open && back.focus === 'px-shopmark',
      JSON.stringify(back),
    );
    check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} ok - frames in ${OUT}`);
process.exitCode = failed ? 1 : 0;
