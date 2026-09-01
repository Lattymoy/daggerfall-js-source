// PX31 - THE PACK'S LAYOUT, MEASURED IN A REAL BROWSER.
//
// PX31 is a MEDIA QUERY and node cannot see one, so this is its only
// pin. It is deliberately a NEW probe rather than more checks bolted
// onto enhancedPackProbe.mjs, whose body still asserts the U53 slot
// map (`.node`, `.node.filled`) that PX19d and PX20a replaced with the
// worn map - a separate rot with its own repair, and not something to
// bury inside a layout slice.
//
// Every number here was MEASURED on the shipped screen before the
// change, because the reverted 2026-08-31 pack attempt picked 74px and
// 820px against a fixture page and both were wrong in play. At
// 1440x900, 1920x1080 and 1280x720 - all identical, since .pack-win is
// min(660px, 94dvh) and the cap binds on every desktop - the window
// was 1040x660, the title bar 62, the character region 400, the tab
// strip 38, and the item list was left A 116px VIEWPORT.
//
// The checks are GEOMETRIC on purpose. They ask where the dock is and
// how much the list got, not what a rule says, so each one fails when
// the breakpoint is disabled rather than when a selector is renamed.
//
//     npx vite --port 5199 &
//     node tools/enhancedPackLayoutProbe.mjs
import { chromium, devices } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const browser = await chromium.launch();

/** The world boot fails without ARENA2 and main.js's catch assigns
 *  document.body.textContent, which REMOVES every child of body -
 *  including a pack opened a moment earlier. A successful boot never
 *  writes it, so the timeout is the correct outcome there. */
async function bootSettled(page) {
  await page.waitForFunction(
    () => document.body.textContent.includes('boot failed'), null, { timeout: 15000 },
  ).catch(() => { /* a successful boot has nothing to wait for */ });
}

async function toGame(page) {
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
  // PX31: the DOOR's own class. `.railbtn` is the shell rail's and
  // this door has not had one since PX1; nine probes were still
  // reaching for it and timing out at the front door.
  await page.waitForSelector('#enhanced-menu .doorbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .doorbtn.door-new').first().click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  await bootSettled(page);
}

/** The items are minted from the port's OWN templates, so no ARENA2 is
 *  needed: ITEM_TEMPLATES is ported data in the repo. Forty of them
 *  because the question is what happens when the pack is FULL - the
 *  complaint PX31 answers was about a list that had no room. */
async function fillPack(page, count) {
  await page.evaluate(async (n) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const t = ITEM_TEMPLATES.find((x) => x.name === 'Dagger');
    const e = {
      name: 'Aelwyn', career: { name: 'Spellsword' },
      stats: { strength: 50, endurance: 48 }, items: [],
    };
    for (let i = 0; i < n; i++) {
      e.items.push({
        name: t.name, templateIndex: t.index, group: 'Weapons',
        stackCount: 1, currentCondition: 50, maxCondition: 50,
      });
    }
    globalThis.__ent = e;
    globalThis.__slot = createInventoryWindow({
      entity: e, items: () => e.items, wagonItems: () => [],
    });
  }, count);
  await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
  await page.waitForTimeout(400);
}

const regions = (page) => page.evaluate(() => {
  const box = (sel) => {
    const n = document.querySelector('#enhanced-inventory ' + sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width),
      h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom),
    };
  };
  const cats = document.querySelector('#enhanced-inventory .packcats');
  const tabs = [...document.querySelectorAll('#enhanced-inventory .packcats .packtab')];
  const cb = cats && cats.getBoundingClientRect();
  return {
    main: box('.pack-main'), dock: box('.pack-dock'), lists: box('.packlists'),
    charcol: box('.charcol'), transport: box('.transport'), win: box('.pack-win'),
    tabs: tabs.length,
    tabRows: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().y))).size,
    // GRID AND WRAP BOTH GIVE TWO ROWS at this width, so rows alone
    // pinned the wrap rather than the grid (the mutation survived).
    // COLUMNS are what tell them apart: a grid aligns every tab onto
    // two x positions, a flex wrap packs them to ragged ones.
    tabCols: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().x))).size,
    tabsInside: !!cb && tabs.every((t) => {
      const g = t.getBoundingClientRect();
      return g.right <= cb.right + 1 && g.bottom <= cb.bottom + 1;
    }),
  };
});

async function run(label, opts, wide) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGame(page);
  await fillPack(page, 40);
  const m = await regions(page);

  if (wide) {
    // THE DOCK IS A COLUMN BESIDE THE REGION. Stacked, it begins below
    // the region's bottom; as a column it shares the region's top and
    // starts at its right edge. This is the check the breakpoint owns,
    // and it is the one that dies when the breakpoint does.
    check(`${label}: the dock is a COLUMN beside the character region`,
      m.dock.x >= m.main.right - 2 && Math.abs(m.dock.y - m.main.y) <= 4,
      `dock x${m.dock.x} y${m.dock.y}, region right ${m.main.right} y${m.main.y}`);

    // AND IT WAS WORTH DOING. 116 is the measured before and 483 is
    // what shipped; the floor sits between them, well clear of both,
    // so the pin holds a LAW rather than a font's rounding.
    check(`${label}: the item list clears the dock's old ceiling`,
      m.lists.h >= 380, `${m.lists.h}px viewport (116 stacked)`);

    // THE REGION FILLS THE COLUMN IT WAS GIVEN. .equipped grows and
    // the map with it; without that this read 180px of dead glass
    // under the transport strip, and the doll - height-driven at
    // aspect-ratio 110/184 - stayed small with room to spare.
    check(`${label}: no dead glass under the transport strip`,
      m.charcol.bottom - m.transport.bottom <= 40,
      `${m.charcol.bottom - m.transport.bottom}px of slack`);

    // FOUR TABS, TWO ROWS, ALL INSIDE THE BOX. The strip carries
    // flex-wrap from its base rule and wrapped raggedly once the
    // column narrowed. A THIRD row means the dock has lost the width
    // the 2x2 needs, which is a layout regression a screenshot would
    // catch and a selector check would not.
    check(`${label}: the tab strip is a 2x2 and stays in its box`,
      m.tabs === 4 && m.tabRows === 2 && m.tabCols === 2 && m.tabsInside,
      `${m.tabs} tabs, ${m.tabRows}x${m.tabCols}, inside=${m.tabsInside}`);
  } else {
    // THE PHONE KEEPS ITS DOCK, and that is the point of a min-width
    // breakpoint rather than a rewrite. The breakpoint CANNOT match at
    // 393px wide, so this is structurally safe; it is checked anyway
    // because the day someone reaches for max-width instead, this is
    // the line that says no.
    check(`${label}: the phone is still STACKED`,
      m.dock.y >= m.main.bottom - 2,
      `dock y${m.dock.y}, region bottom ${m.main.bottom}`);
    // AND IT KEEPS THE ROWS IT HAD - unchanged by PX31, which is the
    // claim, not that they are generous. Said plainly: a real Pixel 5
    // is 727 tall and the list measures 126px, two rows of tiles. An
    // earlier reading of 250 came from a 393x851 viewport, 124px
    // taller than the device, and the floor was first written against
    // that number. THE PHONE HAS A MILDER VERSION OF THE SAME
    // COMPLAINT - the region is the same fixed 400 on a shorter
    // window - and it is its own slice, not this one.
    check(`${label}: and its list keeps the rows it had`,
      m.lists.h >= 110, `${m.lists.h}px viewport (two rows; unchanged by PX31)`);
  }

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// The three desktop sizes measured identical, because the window is
// capped at 660 on all of them - so the narrow one is the interesting
// one: it is the closest to the 1000px breakpoint that still takes it.
await run('1440x900', { viewport: { width: 1440, height: 900 } }, true);
await run('1280x720', { viewport: { width: 1280, height: 720 } }, true);
await run('phone', devices['Pixel 5'], false);

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
