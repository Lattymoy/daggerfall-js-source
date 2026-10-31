// START1 (bible/06-Systems/Alternate-Starts-Arc.md) - THE BAY'S START, IN THE REAL GAME, in three boots over one browser
// profile (its saves):
//   1. a new character (the classic start, tools/classicStartProbe.mjs's boot, on the enhanced skin) wakes in Privateer's
//      Hold to DFU's waking and the start's second page; the commission stands at the Hold's item marker, up in the cave,
//      and is taken as a player takes it (walked to, looked at, pressed); the pack holds the Emperor's letter; it is opened
//      with the enhanced pack's own Use and reads the Emperor's orders; the Quests page shows the start's order to
//      Daggerfall and no main quest; the game is saved;
//   2. that save, on the classic skin: out of the Hold by its door, and the guild's teleport (tools/teleportProbe.mjs's
//      walk over the classic travel map) to Daggerfall, where the start says its last word; saved again;
//   3. that save, on the enhanced skin: the Quests page shows Lady Brisienna's quest, waiting on her letter, and the start
//      no more.
// Photographs at each step.
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 node tools/start1Probe.mjs   (SHOTS=dir, default start1-shots; PROFILE=dir
// for the browser's profile, a fresh one by default; CHROMIUM=path for a browser other than the pinned Playwright's)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHOTS = process.env.SHOTS ?? 'start1-shots';
mkdirSync(SHOTS, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PROFILE = process.env.PROFILE ?? mkdtempSync(join(tmpdir(), 'start1-'));
const server = await createServer({
  root: process.cwd(),
  server: { port: 5251, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 1280, height: 800 },
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const errors = [];
let page = null;
let fails = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) fails++;
  return !!ok;
};
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const talk = async () => JSON.parse((await ev(() => (window.__talk ? window.__talk() : 'null'))) ?? 'null');
const frames = async (n, cap = 60000) => {
  const f0 = await ev(() => window.__frame ?? 0),
    t0 = Date.now();
  while (Date.now() - t0 < cap) {
    await page.waitForTimeout(150);
    if ((await ev(() => window.__frame ?? 0)) >= f0 + n) break;
  }
};
const shot = async (name) => {
  try {
    await page.screenshot({ path: `${SHOTS}/${name}`, timeout: 120000 });
    console.log(`  shot ${SHOTS}/${name}`);
  } catch (e) {
    console.log(`(screenshot ${name} skipped: ${e.message.split('\n')[0]})`);
  }
};
const modeNow = () => ev(() => (window.__mode ? window.__mode() : null));
/** Whether a box stands in either slot - the dungeon's modal one or the town talk's. */
const boxUp = async () => {
  const d = JSON.parse((await ev(() => (window.__dungeonProbe ? window.__dungeonProbe() : 'null'))) ?? 'null');
  const t = await talk();
  return !!(d?.overlay || d?.talkOverlay || t?.overlay);
};
/** What the screen says: the enhanced skin's words (its panels are the page's own), the classic box's rows. */
const screenText = async () =>
  `${await ev(() => document.body.innerText.replace(/\s+/g, ' '))} ${(await talk())?.overlayBox ?? ''}`;
let boxN = 0;
/** Every box up now - the tutorial's pages and the quests' - read and put away (a fresh Space a page), until none. */
async function drainBoxes(max = 30) {
  const seen = [];
  for (let i = 0, quiet = 0; i < max && quiet < 4; i++) {
    await page.waitForTimeout(800); // a page takes no press until it has stood (tutorialPopup.js INPUT_GRACE_MS, the quest box's graceMs)
    const text = await screenText();
    if ((await boxUp()) || /CLICK OR PRESS (ANY|A) KEY/i.test(text)) {
      quiet = 0;
      seen.push(text);
      await shot(`box-${++boxN}.png`);
      await page.keyboard.press('Space');
    } else quiet++;
    await frames(2, 10000);
  }
  return seen;
}
/** A boot: the page at `query`, until the host stands in `want` (or any mode). */
async function boot(query, want, label) {
  if (page) await page.close();
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|Failed to load resource/.test(t))
      errors.push(`[console] ${t.slice(0, 300)}`);
    if (/\[quest\]/.test(t)) console.log(`  console: ${t.slice(0, 200)}`);
  });
  const t0 = Date.now();
  await page.goto(`http://localhost:5251/play/?${query}`);
  let mode = null;
  for (const until = Date.now() + 300000; Date.now() < until && !(want ? mode === want : mode);) {
    await page.waitForTimeout(1000);
    mode = await modeNow();
  }
  check(want ? mode === want : !!mode, `${label} (mode ${mode}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  await frames(20);
  await page.mouse.click(640, 400); // the page's focus, as the teleport probe takes it
  await frames(4);
}
const questItems = async () =>
  JSON.parse(
    await ev(() =>
      JSON.stringify(
        (window.__playerEntity?.items ?? [])
          .filter((it) => it.questItem)
          .map((it) => ({ name: it.shortName ?? it.name, t: it.templateIndex })),
      ),
    ),
  );
/** The enhanced pause window's Quests page, read and put away. */
async function questsPage(name) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  await frames(4);
  // the window opens on the page last shown (System's Save, the first time): its Quests tab, pressed
  await ev(() =>
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.replace(/[\u25c6\s]/g, '').toLowerCase() === 'quests')
      ?.click(),
  ); // its label sits between two diamonds
  await page.waitForTimeout(1000);
  const text = await ev(() => document.body.innerText.replace(/\s+/g, ' '));
  await shot(name);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await frames(4);
  return text;
}

// ════ 1. THE WAKE, THE COMMISSION, THE SEAL ════
await boot(
  'world&shot&classic&class=1&novideo&nofoes&skin=enhanced&touch=off',
  'dungeon',
  "the new character wakes inside Privateer's Hold",
);
await shot('1-the-wake.png');
const boxes = await drainBoxes();
check(
  boxes.some((b) =>
    /You wake and look around the room\. Some hours ago, you were in a boat, en route to Daggerfall/.test(b),
  ),
  "the wake, DFU's own words",
);
check(
  boxes.some((b) => /oilskin case that held the Emperor's sealed commission/.test(b)),
  'and the commission lost in the water',
);
check(
  !boxes.some((b) => /begin the Emperor's quest/.test(b)),
  'and never the classic start\'s "Once free of the cave, you can begin the Emperor\'s quest"',
);
check((await questItems()).length === 0, 'the pack holds no commission at the wake');

// Privateer's Hold's one quest item marker: S0000999.RDB's 199.18 at (1428, -1824, 1699), block (0, 0) - the stand rides
// its scene position (systems/quest/sceneMount.js markerScenePosition: the flat's (x, -y, z) x GlobalScale). The dungeon
// probe lists the twelve targets nearest the eye, so the player walks there first, as a player would.
const probe = async () => JSON.parse(await ev(() => window.__dungeonProbe()));
const MARK = [1428 * 0.025, 1824 * 0.025, 1699 * 0.025];
let dp = await probe();
console.log(
  `  woke at ${JSON.stringify(dp.feet)} (the Hold's enter marker: worldModes.js startInDungeon prefers it), the commission ${JSON.stringify(MARK)} up in the cave`,
);
{
  const dx = dp.feet[0] - MARK[0],
    dz = dp.feet[2] - MARK[2],
    len = Math.hypot(dx, dz) || 1;
  await ev(
    ([p, y]) => window.__warpTo(p, y),
    [[MARK[0] + (dx / len) * 1.6, MARK[1] - 1.0, MARK[2] + (dz / len) * 1.6], Math.atan2(-dx, -dz)],
  );
  await frames(8);
}
dp = await probe();
const stand = dp.nearTargets.find((t) => t.key.startsWith('questflat:'));
check(!!stand, `the commission stands at the Hold's item marker (${stand?.key}, ${stand?.d} m from the eye)`);
if (stand) {
  const [x0, y0, z0, x1, y1, z1] = stand.aabb;
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const eye = dp.eye,
    dx = eye[0] - c[0],
    dz = eye[2] - c[2],
    len = Math.hypot(dx, dz) || 1;
  // a step off it on its floor, facing it, and looking down at it as a player does (LookDown, Delete) until the ray finds it
  await ev(
    ([p, y]) => window.__warpTo(p, y),
    [[c[0] + (dx / len) * 1.4, c[1] - 0.3, c[2] + (dz / len) * 1.4], Math.atan2(-dx, -dz)],
  );
  await frames(8);
  dp = await probe();
  for (let i = 0; i < 24 && !String(dp.pick?.key ?? '').startsWith('questflat:'); i++) {
    await page.keyboard.down('Delete');
    await frames(1, 10000);
    await page.keyboard.up('Delete'); // held for a frame: the look is the frame's
    await frames(1, 10000);
    dp = await probe();
  }
  check(
    String(dp.pick?.key ?? '').startsWith('questflat:'),
    `the ray a player aims finds it (${dp.pick?.key}, ${dp.pick?.distance?.toFixed?.(2)} m)`,
  );
  await shot('2-the-commission.png');
  await page.keyboard.press('KeyE'); // Interact
  await frames(10);
}
const taken = await questItems();
check(taken.length === 1, `taken: the commission is in the pack (${JSON.stringify(taken)})`);
const found = await drainBoxes();
check(
  found.some((b) => /The commission is inside, dry, its seal unbroken/.test(b)),
  'the oilskin case found, its seal unbroken',
);
let quests = await questsPage('3-quests-found.png');
check(/The Emperor's Commission/.test(quests), "the Quests page: The Emperor's Commission");
check(/open the commission from your pack/.test(quests), 'its next step: open the commission from your pack');
check(!/Lady Brisienna/.test(quests), 'and no main quest yet');

// opened with the enhanced pack's own Use (ui/enhanced/enhancedInventory.js: the row, then its Use)
await page.keyboard.press('F6');
await page.waitForTimeout(1500);
await frames(4);
const used = await ev(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const n = document.querySelectorAll('button.packtab').length;
  for (let i = 0; i < n; i++) {
    document.querySelectorAll('button.packtab')[i].click();
    await wait(200);
    const row = [...document.querySelectorAll('button.itemrow')].find((r) => /Uriel Septim/.test(r.textContent));
    if (!row) continue;
    const name = row.textContent.replace(/\s+/g, ' ').trim();
    row.click();
    await wait(300);
    const use = [...document.querySelectorAll('button.act')].find((b) => b.textContent.trim() === 'Use');
    use?.click();
    return { tab: document.querySelectorAll('button.packtab')[i]?.textContent, name, use: !!use };
  }
  return { tabs: n };
});
console.log(`  the pack: ${JSON.stringify(used)}`);
check(used?.use === true, `the letter in the pack, named for its sender ("${used?.name}"), and Used`);
await shot('4-the-seal-broken.png');
const read = await drainBoxes();
check(
  read.some((b) => /These orders are sealed for your eyes alone/.test(b) && /Make for the city of Daggerfall/.test(b)),
  "the Emperor's orders, read",
);
for (let i = 0; i < 3 && (await boxUp()); i++) {
  await page.keyboard.press('Escape');
  await frames(4);
} // the pack put away
await page.keyboard.press('F6');
await frames(4);
if (await boxUp()) {
  await page.keyboard.press('Escape');
  await frames(4);
}
quests = await questsPage('5-quests-opened.png');
check(/Make for the city of Daggerfall/.test(quests), 'the Quests page: make for the city of Daggerfall');
check(!/Lady Brisienna/.test(quests), 'and still no main quest: it begins in Daggerfall');
check((await questItems()).length === 1, 'the letter kept until Daggerfall');
const savedName = await ev(() => window.__playerEntity?.name);
const saved = await ev(() => window.__quickSave('start1 opened'));
console.log(`  saved: ${saved}`);
const saveKey = (name) => ev((n) => JSON.parse(window.__saveKeys()).find((k) => k.name === n)?.key ?? null, name);
const openedKey = await saveKey('start1 opened');
check(openedKey != null, `the game saved (${openedKey})`);

// ════ 2. OUT OF THE HOLD, AND TO DAGGERFALL ════
await boot(
  `world&shot&load&loadkey=${openedKey}&novideo&nofoes&skin=classic`,
  'dungeon',
  'the save loads in the Hold, on the classic skin',
);
for (let i = 0; i < 60 && !(await questItems()).length; i++) await page.waitForTimeout(1000); // a load restores the pack after the mode stands
await drainBoxes();
check(
  (await ev(() => window.__playerEntity?.name)) === savedName,
  `the saved character, loaded (${await ev(() => window.__playerEntity?.name)})`,
);
check((await questItems()).length === 1, `the opened letter loads in the pack (${JSON.stringify(await questItems())})`);
const dungeon = JSON.parse(await ev(() => window.__dungeon()));
if (dungeon?.exits?.length) {
  // the classic start probe's stand: on the exit door's normal side, close, looking back at it
  const { pos, normal } = dungeon.exits[0];
  await ev(
    ([p, y]) => window.__warpTo(p, y),
    [[pos[0] + normal[0] * 0.8, pos[1] - 0.5, pos[2] + normal[2] * 0.8], Math.atan2(-normal[0], -normal[2])],
  );
  await frames(4);
  await ev(() => window.__dungeonExit());
}
for (let i = 0; i < 120 && (await modeNow()) !== 'exterior'; i++) await page.waitForTimeout(500);
check((await modeNow()) === 'exterior', 'out of the Hold by its door');
await frames(30);
await drainBoxes();
const map = () =>
  ev(() => {
    const s = window.__travelMap();
    return s ? JSON.parse(s) : null;
  });
const clickNative = (x, y) => page.mouse.click(x * 4, y * 4);
async function untilMap(pred, cap = 40000) {
  const t0 = Date.now();
  for (;;) {
    const st = await map();
    if (pred(st) || Date.now() - t0 > cap) return st;
    await frames(1, 5000);
  }
}
async function find(name) {
  await page.keyboard.press('f');
  await untilMap((s) => s?.top === 'find', 20000); // the box is pushed on a frame: a letter before it is the map's (an "f" opens it)
  for (const c of name) {
    if (c === ' ') await page.keyboard.press('Space');
    else if (/[a-zA-Z0-9'-]/.test(c)) await page.keyboard.press(c);
    await page.waitForTimeout(30);
  }
  await page.keyboard.press('Enter');
  await frames(1);
  if ((await map())?.picker) {
    await page.keyboard.press('Enter');
    await frames(1);
  }
}
const opened = await ev(() => {
  const s = window.__openTeleportMap();
  return s ? JSON.parse(s) : null;
});
check(!!opened?.armed, "the guild's teleport map, armed");
if (!opened?.identifying) await clickNative(25, 191);
await page.keyboard.press('Enter');
await frames(1);
let st = await map();
if (!st?.regionSelected) {
  await clickNative(25, 191);
  await page.keyboard.press('Enter');
  await frames(1);
  st = await map();
}
await find('Daggerfall');
st = await untilMap((s) => s?.top === 'confirm' || s?.telePopUp || s?.popUp);
if (st?.top === 'confirm') {
  await page.keyboard.press('y');
  await frames(1);
  st = await map();
}
check(
  st?.telePopUp?.name === 'Daggerfall',
  `the teleport box names Daggerfall (${st?.telePopUp?.name}; the region page ${st?.region})`,
);
await ev(() => window.__teleportAnswer(true));
await frames(8, 60000);
await untilMap((s) => s === null, 60000);
for (let i = 0; i < 60 && !JSON.parse(await ev(() => window.__travelProbe())).pixel; i++)
  await page.waitForTimeout(500);
await frames(40, 120000);
await shot('6-daggerfall.png');
const arrived = await drainBoxes();
check(
  arrived.some((b) => /You have reached Daggerfall, as the Emperor's orders bade you/.test(b)),
  "in Daggerfall's streets the start says its last word",
);
check((await questItems()).length === 0, 'and the letter is burned: gone from the pack');
await ev(() => window.__quickSave('start1 daggerfall'));
const cityKey = await saveKey('start1 daggerfall');
check(cityKey != null, `saved in Daggerfall (${cityKey})`);

// ════ 3. THE MAIN QUEST, BEGUN ════
await boot(
  `world&shot&load&loadkey=${cityKey}&novideo&nofoes&skin=enhanced&touch=off`,
  'exterior',
  'the Daggerfall save loads, on the enhanced skin',
);
await drainBoxes();
quests = await questsPage('7-quests-main.png');
check(/Lady Brisienna/.test(quests), 'the Quests page: Lady Brisienna, the main quest begun');
check(/Wait for the Emperor's agent in Daggerfall to send for you/.test(quests), 'waiting on her letter');
check(!/Make for the city of Daggerfall/.test(quests), "the start's order done with");

check(errors.length === 0, errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'zero page errors');
await browser.close();
await server.close();
console.log(fails === 0 ? 'START1 PROBE: ALL GREEN' : `START1 PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
