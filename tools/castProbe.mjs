// M5: does a spell actually CAST in each host, in a real browser?
//
// The engine's laws are pinned in node (test/hostmagic.test.js) and
// the wiring in source pins (test/hostmagic_wiring.test.js); this
// drives the LIVE pages: the spellbook (with the M4 sort), the
// instant CasterOnly ready-cast, the classic CLICK-to-cast through
// interceptAttack/firePending, a missile's flight and wall
// retirement, a door transition with an interior cast off the SAME
// engine, and the dungeon host for regression.
//
// Frame-synced (the process doctrine): SwiftShader crawls at a few
// fps with dt clamped at 0.1, so wall-clock sleeps sample stale
// state - every wait below is in FRAMES via window.__frame.
//
// Usage: node tools/castProbe.mjs [exterior|world|dungeon]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const which = process.argv[2] || 'exterior';
// &shot installs the probe hooks but would kill walk mode on the
// exterior pages - &play turns it back on (walkMode = play || ...).
const QUERIES = {
  exterior: 'exterior&nomenu&class=0&novideo&shot&play',
  world: 'world&nomenu&class=0&novideo&shot&play',
  dungeon: 'nomenu&class=0&novideo&spell=7&shot&play',   // 7 = Wizard's Fire, SingleTargetAtRange
};
const server = await createServer({ server: { port: 5209, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });

await page.goto(`http://localhost:5209/play/?${QUERIES[which]}`);
await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 12000));
await page.mouse.click(640, 400);
await page.waitForTimeout(800);

const out = { which, steps: {} };
const magic = () => page.evaluate(() => window.__magic ? JSON.parse(window.__magic()) : null);
const frames = async (n, cap = 20000) => {   // wait for n RENDERED frames
  const f0 = await page.evaluate(() => window.__frame ?? 0);
  const t0 = Date.now();
  while (Date.now() - t0 < cap) {
    await page.waitForTimeout(150);
    if (await page.evaluate(() => window.__frame ?? 0) >= f0 + n) break;
  }
};

if (which === 'dungeon') {
  // The dungeon page readies ?spell=7 at boot, which ARMS the click
  // cast (hostMagic.readySpell -> clickCast.arm) - the attack click
  // fires it (I2 retired the C cast key).
  out.steps.before = { mp: await page.evaluate(() => window.__playerEntity?.magicka ?? null) };
  await page.mouse.move(480, 300);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(50);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(120);
  out.steps.after = { mp: await page.evaluate(() => window.__playerEntity?.magicka ?? null) };
  out.ok = out.steps.after.mp != null && out.steps.after.mp < out.steps.before.mp;
} else {
  // The quest arc's boot boxes - the start letter (a plain parchment,
  // any key advances) and the tutorial YesNo (answers ONLY to Y/N/
  // Escape) - eat the keyboard until dismissed, exactly as DFU's do.
  // They can arrive a few ticks in, so drain until the slot is QUIET
  // for two consecutive checks; Escape advances a plain box AND
  // declines a YesNo.
  for (let i = 0, quiet = 0; i < 30 && quiet < 2; i++) {
    const up = await page.evaluate(() => JSON.parse(window.__talk()).overlay);
    if (up) { quiet = 0; await page.keyboard.press('Escape'); } else quiet++;
    await frames(2);
  }
  out.steps.boot = await magic();
  // The spellbook: Backspace opens; the M4 sort runs live (s, then y
  // on the YesNo). U42 put this on the classic window, where
  // SortSpellsConfirm's CloseWindow() sits OUTSIDE the Yes arm - the
  // book CLOSES on either answer - so the book is reopened before
  // Enter readies row 0, which alphabetically is Balyna's Balm for a
  // Mage: CasterOnly, so the READY ITSELF casts instantly and spends
  // (readySpell's law).
  await page.keyboard.press('Backspace');
  await frames(2);
  await page.keyboard.press('s');
  await frames(1);
  await page.keyboard.press('y');
  await frames(2);
  out.steps.sortedBook = (await magic())?.book ?? null;
  await page.keyboard.press('Backspace');
  await frames(2);
  await page.keyboard.press('Enter');
  await frames(2);
  out.steps.readied = await magic();
  // The classic CLICK-to-cast: ready the first ByTouch row (Shock) -
  // readying ARMS without spending - then attack with the right
  // mouse button. interceptAttack converts the armed latch, the next
  // frame's firePending casts, and the empty-air ByTouch whiff
  // aborts BEFORE the spend. The latch must be consumed regardless.
  const touchRow = ((await magic())?.book ?? []).findIndex((r) => r.range === 1);
  if (touchRow >= 0) {
    await page.keyboard.press('Backspace');
    await frames(2);
    for (let i = 0; i < touchRow; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(60); }
    await page.keyboard.press('Enter');
    await frames(2);
    out.steps.touchReadied = await magic();
    await page.mouse.click(640, 400, { button: 'right' });
    await frames(3);
    out.steps.clickWhiff = await magic();
  }
  // The missile: no classic starting set carries a flier, so ready
  // the cheapest off the file (the interim-list shape). Aim ABOVE
  // the rooftops so the shot cannot wall out between samples - the
  // spawn read is race-free - then wait out MISSILE_LIFESPAN_S in
  // FRAMES (dt clamps at 0.1, so 8 game-seconds is ~80 frames) and
  // require the retirement to leave no leak.
  out.steps.rangedName = await page.evaluate(() => window.__readyRanged());
  await page.evaluate(() => { const [x, y, z] = window.__player.pos; window.__pose(x, y, z, Math.PI, 1.2); });
  // I2: the readied spell is ARMED - the attack click casts it.
  await page.mouse.move(480, 300);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(50);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(60);
  out.steps.missile = await magic();
  await frames(90, 120000);   // the world city crawls near 2fps - the cap must clear 90 frames there
  out.steps.retired = await magic();
  await page.evaluate(() => { const [x, y, z] = window.__player.pos; window.__pose(x, y, z, Math.PI, 0); });

  // Through the nearest workable door: the SAME engine, the interior
  // facades. The pool is too thin for a second flier, so the proof
  // inside is the CasterOnly instant ready-cast (the book again).
  const door = await page.evaluate(async () => {
    const doors = window.__doors?.() ?? [];
    for (const d of doors.slice(0, 6)) {
      window.__pose(d.pos[0] + d.normal[0] * 1.6, d.pos[1] - 1.2, d.pos[2] + d.normal[2] * 1.6,
        Math.atan2(-d.normal[0], -d.normal[2]), -0.1);
      if (await window.__enter()) return { block: d.block, entered: true };
    }
    return doors.length ? { entered: false, tried: Math.min(doors.length, 6) } : null;
  });
  await frames(3);
  out.steps.door = door;
  out.steps.interiorMode = await page.evaluate(() => window.__mode?.() ?? null);
  if (out.steps.interiorMode === 'interior') {
    const pre = await magic();
    await page.keyboard.press('Backspace');
    await frames(2);
    await page.keyboard.press('Enter');   // row 0 = the CasterOnly heal, instant
    await frames(2);
    out.steps.interiorCast = await magic();
    out.steps.interiorPreMp = pre.mp;
  }

  const b = out.steps.boot, r = out.steps.readied, m = out.steps.missile;
  const tr = out.steps.touchReadied, cw = out.steps.clickWhiff;
  out.ok = !!(r && r.mp < b.mp                     // the CasterOnly ready cast instantly and spent
    && tr && tr.armed && tr.mp === r.mp            // ByTouch readies ARMED, no spend
    && cw && cw.mp === tr.mp && cw.armed           // the whiff spent nothing and the READY SURVIVES - CastReadySpell aborts before spending (the ByTouch abort law; I2 killed the latch that used to eat the armed state here)
    && m && m.missiles > 0 && m.mp < r.mp          // the ranged cast flies
    && out.steps.retired.missiles === 0);          // and retires on the street, leaving no leak
  out.interiorOk = out.steps.interiorMode !== 'interior' ? 'no-door'
    : !!(out.steps.interiorCast && out.steps.interiorCast.mp < out.steps.interiorPreMp
      && out.steps.interiorCast.mode === 'interior');
}

out.errors = errors.slice(0, 8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
await server.close();
process.exit(out.ok ? 0 : 1);
