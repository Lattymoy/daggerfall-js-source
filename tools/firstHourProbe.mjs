// V4: THE FIRST HOUR, PLAYED.
//
// Every other probe in this directory answers "does feature X work".
// None of them answers the only question a port actually has to pass:
// can a person start the game and play it? So this one takes ONE
// character through one continuous session, in order, on the real
// hosts with the real data - chargen, the starting dungeon, a fight,
// the loot, the way out, the road, a town, a shop, a purchase, a bed -
// and asserts at every step that the player is still alive and the
// state still makes sense.
//
// It is deliberately serial and deliberately slow. A stage that fails
// does NOT stop the run: its dependents are marked skipped and the
// walk continues, because the point is a MAP of what a first hour hits,
// not the first pothole.
//
// Nothing is faked. The dungeon is left through the same raycast pick
// a player makes; the shop is entered through the same door activation;
// the purchase is a click on the real trade window's item list; the
// travel is typed into the real map window. The two places this probe
// reaches past the player's own hands are called out at their site.
//
// Usage: ARENA2_PATH=/home/user/dfdata/arena2 node tools/firstHourProbe.mjs
//   SHOTS=<dir>   where the screenshots land (default: ./firsthour-shots)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS ?? 'firsthour-shots';
mkdirSync(SHOTS, { recursive: true });

// BUILDING_TYPES: the shops a shelf can be opened in, and the tavern.
const SHOP_TYPES = new Set([0, 2, 5, 6, 7, 8, 9, 12, 13]);
const TAVERN = 15;

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
// HMR OFF, WATCHER OFF. The first draft died at "page reload
// src/systems/booksData.js": vite's watcher decided a module had no
// HMR boundary and full-reloaded the page mid-chargen, destroying the
// execution context under the probe. A playthrough must not race the
// dev server - nothing here edits src/ while it runs.
const server = await createServer({
  root: process.cwd(),
  server: { port: 5222, strictPort: true, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
// The one KNOWN miss on this data set: CURSOR.IMG is absent and
// cursor.js degrades gracefully (its header: NEVER TRAPS).
page.on('console', (m) => { if (m.type() === 'error' && !/CURSOR\.IMG|status of 404/.test(m.text())) errors.push(`[console] ${m.text()}`); });

// ── the ledger ───────────────────────────────────────────────────────
const rows = [];
let stage = '-';
const check = (label, ok, detail = '') => {
  rows.push({ stage, label, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${stage}] ${label}${detail ? ` - ${detail}` : ''}`);
  return !!ok;
};
const skip = (label, why) => {
  rows.push({ stage, label, ok: null, detail: why });
  console.log(`skip [${stage}] ${label} - ${why}`);
};
const begin = (name) => { stage = name; console.log(`\n===== ${name} =====`); };
// A CRASH MUST STILL PRINT THE MAP. Run two died on a screenshot
// timeout at stage 6 with four stages unwalked and no tally at all -
// the one output that makes this probe worth running.
let _finishing = false;
const bail = async (why) => {
  if (_finishing) return;
  _finishing = true;
  check('the walk ran to the end without crashing', false, why);
  await finish();
};
process.on('uncaughtException', (e) => { void bail(`${e.name}: ${e.message}`); });
process.on('unhandledRejection', (e) => { void bail(`${e?.name ?? 'rejection'}: ${e?.message ?? e}`); });

// ── frame-synced waits (SwiftShader paces this in seconds) ───────────
const frame = () => page.evaluate(() => window.__frame ?? 0);
const waitFrames = async (n, cap = 90000) => {
  const f0 = await frame();
  const t0 = Date.now();
  for (;;) {
    if (await frame() >= f0 + n) return true;
    if (Date.now() - t0 > cap) return false;
    await page.waitForTimeout(120);
  }
};
/** Poll a page-side predicate rather than sleeping on a guess. */
const until = async (fn, cap = 90000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > cap) return null;
    await page.waitForTimeout(250);
  }
};
const key = async (k, n = 2) => { await page.keyboard.press(k); await waitFrames(n); };
/** A screenshot must never end a playthrough. SwiftShader rebuilding
 *  a whole region on arrival blew the default 30s and took the run
 *  down at stage 6 with four stages still unwalked. */
const shot = async (name) => {
  try { await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 120000 }); }
  catch (e) { console.log(`  [note] screenshot ${name} timed out (${e.name}) - the walk continues`); }
};
// NOTE THE SECOND PARAMETER. The first run's stage 3 reported "the
// foe can be killed - health undefined" and it was THIS, not the
// game: J forwarded no argument, so every parameterised hook
// (__damageFoe, __buildingAt) ran with an undefined index and
// answered null. A probe bug reads exactly like the bug it hunts,
// which is why nothing here is believed until it has also been seen
// RED against a build known to be broken.
const J = async (expr, arg) => JSON.parse(await page.evaluate(expr, arg) ?? 'null');
const hp = () => J(() => window.__hp());
// A BARE STRING, not JSON - J would throw on it. (Caught before the
// second run, by reading my own hook back.)
const overlayKind = () => page.evaluate(() => (window.__overlayKind ? window.__overlayKind() : null));
/** The canvas is NOT the viewport in this host, so a screen point for
 *  a native (320x200) coordinate has to be computed from the live
 *  canvas - ui/nativePanel.nativeMetrics' own arithmetic, read back
 *  rather than assumed. The first run hand-computed a 4x with no
 *  letterbox (another probe's numbers, at another viewport) and its
 *  shop click landed somewhere else entirely. */
const nativeClick = async (vx, vy) => {
  const pt = await J(([x, y]) => {
    const c = document.querySelector('canvas');
    const s = Math.max(1, Math.floor(Math.min(c.width / 320, c.height / 200)));
    const ox = Math.floor((c.width - 320 * s) / 2), oy = Math.floor((c.height - 200 * s) / 2);
    const r = c.getBoundingClientRect();
    return JSON.stringify({
      s, ox, oy, cw: c.width, ch: c.height,
      sx: r.left + (ox + x * s) * (r.width / c.width),
      sy: r.top + (oy + y * s) * (r.height / c.height),
    });
  }, [vx, vy]);
  await page.mouse.click(pt.sx, pt.sy);
  return pt;
};
const mode = () => page.evaluate(() => (window.__mode ? window.__mode() : null));
const entity = () => page.evaluate(() => {
  const p = window.__playerEntity;
  return {
    name: p.name, race: p.race, gender: p.gender, career: p.career?.name ?? null,
    chargenDone: !!p.chargenDone, health: p.health, maxHealth: p.maxHealth,
    level: p.level ?? null, items: (p.items ?? []).length,
    gold: (p.items ?? []).find((i) => i.group === 'Currency')?.stackCount ?? 0,
    worn: (p.equip?.slots ?? []).filter(Boolean).length,
    skillsIsArray: Array.isArray(p.skills),
  };
});
/** THE LIVENESS ASSERTION, run after every stage: a playthrough is
 *  over the moment the character stops being a live, coherent entity. */
const alive = async (where) => {
  const e = await entity();
  check(`the character is still alive and coherent after ${where}`,
    e.chargenDone && e.health > 0 && e.health <= e.maxHealth && e.maxHealth > 0 && e.skillsIsArray,
    `hp ${e.health}/${e.maxHealth}, ${e.items} items, ${e.gold}g`);
  return e;
};

// ── 1. BOOT + CHARGEN ────────────────────────────────────────────────
// The classic start: the world host at the settings' own start cell
// (StartCellX/Y = Privateer's Hold) with the real chargen wizard, not
// the ?class= headless skip every other probe uses.
begin('1 chargen');
await page.goto('http://localhost:5222/play/?world&shot&classic&novideo&play');
// NOT __shotReady: that flag waits for the EXTERIOR stream queue to
// drain (world.js:3116), and the classic start spends its first
// minutes inside a dungeon with the world still building behind it -
// the first run sat here past five minutes with the host long since
// up. The host being up is __mode answering, which is exactly what
// classicStartProbe waits on.
const booted = await until(() => page.evaluate(() => (window.__mode ? window.__mode() : null)), 420000);
check('the game boots', !!booted, booted ? `mode ${booted}` : 'the host never came up');
await shot('01-boot');

let chargenOk = false;
if (booted) {
  const flow = await until(async () => (await page.evaluate(() => window.__chargenFlow?.()?.state ?? null)) === 'race', 60000);
  chargenOk = check('a new game opens on the RACE screen', !!flow);
  await shot('02-chargen-race');
}
const st = () => page.evaluate(() => window.__chargenFlow?.()?.state ?? null);
if (chargenOk) {
  await key('Enter');                       // the race description box
  await key('Enter');                       // YES -> gender
  await key('Enter');                       // male
  check('race and gender accepted', await st() === 'classMethod', await st());
  await key('Enter');                       // choose from a list
  await key('Enter');                       // row 0's description box
  await key('Enter');                       // YES -> the bio method
  check('a class is chosen', await st() === 'bioMethod', await st());
  await key('Enter');                       // GENERATE the history
  await key('Enter');                       // close the reputation box
  check('the biography is written', await st() === 'name', await st());
  await shot('03-chargen-biography');
  for (const c of 'MAC') await key(c);
  await key('Enter');                       // -> face
  await waitFrames(6);                      // the FACE CIF streams in
  await key('Enter');                       // -> stats
  const spend = async () => { for (let i = 0; i < 30; i++) await page.keyboard.press('='); await waitFrames(2); };
  await spend();
  await key('Enter');                       // -> skills (gated on pool 0)
  for (let row = 0; row < 9; row++) { await spend(); await page.keyboard.press('ArrowDown'); }
  await waitFrames(2);
  await key('Enter');                       // -> reflexes
  await key('Enter');                       // -> summary
  await shot('04-chargen-summary');
  await key('Enter', 6);                    // OK -> the character exists
}
const born = await entity();
check('chargen produces a real character', born.chargenDone && !!born.name && !!born.career && born.skillsIsArray,
  `${born.name}, ${born.race} ${born.career}, hp ${born.maxHealth}`);
check('and it is equipped and funded by AssignStartingGear', born.worn >= 2 && born.gold >= 100 && born.items >= 4,
  `${born.worn} worn, ${born.items} items, ${born.gold}g`);
check('a new character starts at full health', born.health === born.maxHealth, `${born.health}/${born.maxHealth}`);
// THE ONE THIS PROBE WAS BUILT FOR. Before the fix, the letters of
// the character's NAME also reached the dungeon's key bindings
// behind the wizard - typing MAC opened the automap on the M and
// left it up, which is what the first run's dungeon screenshot
// shows. A window the player never opened is the symptom; the cause
// is two keydown listeners and no modal ownership.
//
// NOT "no window at all", which is what this asked for first and is
// no longer true: U43 gave showQuestOverlay a dungeon arm, so the
// classic start's _TUTOR__ now speaks where it always should have,
// and the first frame of a new game legitimately carries a quest
// popup. The claim is narrower and always was - nothing a KEYBINDING
// opens should be up, because nobody pressed a key.
const KEYBOUND_WINDOWS = /Automap|CharSheet|Inventory|Spellbook|Rest|Journal|Notebook|Pause|TravelMap/i;
const stray = await overlayKind();
check('finishing chargen leaves no window a KEYBINDING would have opened',
  !KEYBOUND_WINDOWS.test(stray ?? ''), `overlay: ${stray ?? 'none'}`);
// The first frame of the character's life, whatever is on it. On the
// build before the fix this picture is the dungeon AUTOMAP.
await shot('04b-the-first-frame');

// ...and then READ IT AND PUT IT AWAY, the way a player does. This is
// not tidying: a modal holds the motor and the host returns at its
// overlay gate before the frame body, so while that popup is up the
// dungeon does not tick AT ALL. The run that found this reported the
// foe "never moved and never swung" and the corpse refusing to open -
// three failures, one cause, and none of them the game's.
const opening = await overlayKind();
if (opening) {
  for (let i = 0; i < 12 && await overlayKind(); i++) await key('Enter', 2);
  for (let i = 0; i < 6 && await overlayKind(); i++) await key('Escape', 2);
  check(`the opening ${opening} can be dismissed`, (await overlayKind()) === null,
    `still up: ${await overlayKind()}`);
}

// ONLY_CHARGEN=1 stops here. Used to RED-PROOF the modal-ownership
// fix: on the build without the guard this stage's stray-window check
// fails, and it is a four-minute run instead of a twenty-minute one.
if (process.env.ONLY_CHARGEN) { begin('tally'); await finish(); }

// ── 2. THE STARTING DUNGEON ──────────────────────────────────────────
begin('2 the starting dungeon');
const m0 = await mode();
const inDungeon = check('the new game begins INSIDE the starting dungeon', m0 === 'dungeon', `mode ${m0}`);
let dungeon = null;
if (inDungeon) {
  dungeon = await J(() => window.__dungeon());
  check('the dungeon built with a way out', (dungeon?.exits?.length ?? 0) > 0, `${dungeon?.exits?.length ?? 0} exit door(s), ${dungeon?.actions ?? 0} action objects`);
} else skip('the dungeon built with a way out', 'not in a dungeon');
await waitFrames(4);
await shot('05-dungeon');
await alive('the first step into the dungeon');

// ── 3. A FIGHT ───────────────────────────────────────────────────────
begin('3 a fight');
let foes = inDungeon ? await J(() => window.__foes()) : null;
const haveFoes = check('the dungeon is populated', (foes?.length ?? 0) > 0, `${foes?.length ?? 0} foes`);
let killedIndex = -1;
if (haveFoes) {
  const target = foes.find((f) => !f.dead && f.pos);
  if (!target) {
    skip('the foe notices the player', 'no live positioned foe');
  } else {
    // WALK IN FROM WHERE THE PLAYER ACTUALLY IS. Through the motor, not
    // the camera (V1: __pose moves the camera, the AI measures from the
    // motor).
    //
    // Two earlier drafts got this wrong in opposite directions. The
    // first stood four units behind the foe on the z axis - a guess
    // about geometry the probe cannot see, which in a corridor lands
    // in the rock, where the near walls cull away and the screenshot
    // shows a lit chamber hanging in the renderer's clear colour: a
    // picture that reads as a hole in the world and is nothing of the
    // sort. The second stood ON the foe's own feet, which is certainly
    // inside the room and certainly pointed at a wall.
    //
    // The player's CURRENT position is inside the map by definition,
    // so a point on the line between them is the principled place to
    // stand - and facing back down that line puts the foe in frame.
    const [fx, fy, fz] = target.pos;
    const here = await J(() => JSON.stringify(window.__player.pos));
    let dx = here[0] - fx, dz = here[2] - fz;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const back = Math.min(3, len * 0.6);   // never past the player's own spot
    await page.evaluate(([p, y]) => window.__warpTo(p, y),
      [[fx + dx * back, fy + 0.4, fz + dz * back], Math.atan2(-dx, -dz)]);
    await waitFrames(3);
    const hp0 = await hp();
    const before = (await J(() => window.__foes()))[target.i];
    // A fight is a fight only if the other side is running: give the
    // AI its detection window and watch for MOVEMENT or a HIT.
    const engaged = await until(async () => {
      const now = (await J(() => window.__foes()))[target.i];
      const h = await hp();
      const moved = now?.pos && before?.pos && Math.hypot(now.pos[0] - before.pos[0], now.pos[2] - before.pos[2]) > 0.5;
      const hurt = h.health < hp0.health;
      return (moved || hurt) ? { moved, hurt, dist: now?.pos ? Math.hypot(now.pos[0] - fx, now.pos[2] - fz) : null } : null;
    }, 60000);
    check('the foe notices the player and acts', !!engaged,
      engaged ? `${engaged.moved ? 'closed the distance' : ''}${engaged.hurt ? ' and landed a hit' : ''}` : 'it never moved and never swung');
    await shot('06-fight');
    // Kill it through the REAL damage door (the one that mints the
    // corpse and rolls the loot), not by zeroing a field.
    const dead = await J((i) => window.__damageFoe(i, 9999), target.i);
    check('the foe can be killed', !!dead?.dead, `health ${dead?.health}`);
    // spawnCorpse AWAITS its texture (dungeonContext:1388), so the
    // flag is never set by the time damageFoe returns - the first run
    // read it synchronously and reported the corpse missing.
    const corpsed = await until(async () => {
      const now = (await J(() => window.__foes()))[target.i];
      return now?.corpse ? now : null;
    }, 30000);
    check('and a killed foe leaves a corpse, not a hole in the air', !!corpsed, `corpse=${!!corpsed}`);
    killedIndex = target.i;
    await waitFrames(6);
  }
} else {
  skip('the foe notices the player and acts', 'no foes');
  skip('the foe can be killed', 'no foes');
}
await shot('07-after-the-fight');
await alive('the fight');

// ── 4. THE LOOT ──────────────────────────────────────────────────────
// NOT a pile on the floor: a Daggerfall enemy carries what it drops.
// GenerateItems(lootTableKey) fills the entity's own bag at spawn and
// the CORPSE becomes the container (dungeonContext lootTargets/
// takeLoot). The first run asserted __piles here, found nothing, and
// was about to call an accurate port broken.
begin('4 the loot');
if (killedIndex >= 0) {
  const targets = await J(() => window.__lootTargets());
  const corpseKey = `corpse:${killedIndex}`;
  const listed = check('the corpse is something the player can reach into',
    (targets ?? []).includes(corpseKey), `${(targets ?? []).length} loot target(s)`);
  if (listed) {
    const before = await entity();
    const held = await page.evaluate((k) => window.__takeLoot(k), corpseKey);
    check('and it holds what the loot tables rolled for it', held > 0, `${held} item(s)`);
    await waitFrames(4);
    const win = await overlayKind();
    check('reaching in opens the real container window', /Inventory/i.test(win ?? ''), `overlay: ${win ?? 'none'}`);
    if (held > 0) {
      await page.evaluate(() => window.__dungeonPickRemote(0));
      await waitFrames(3);
      const after = await entity();
      // NOT items.length alone. The first green run of this stage read
      // 9 -> 9 and called it a failure while the purse went 200 -> 207:
      // the corpse's gold MERGED into the Currency stack the character
      // was already carrying, which is stacksWith working exactly as it
      // should. A count of bag entries cannot see a stack grow.
      check('and an item can actually be taken', after.items > before.items || after.gold > before.gold,
        `${before.items} items/${before.gold}g -> ${after.items} items/${after.gold}g`);
      await shot('07b-looting');
    } else skip('and an item can actually be taken', 'the roll gave this foe nothing');
    // close the container window before walking on
    await key('Escape', 4);
  } else {
    skip('and it holds what the loot tables rolled for it', 'the corpse is not a loot target');
    skip('and an item can actually be taken', 'the corpse is not a loot target');
  }
} else {
  skip('the corpse is something the player can reach into', 'nothing was killed');
  skip('and an item can actually be taken', 'nothing was killed');
}
await alive('the loot');

// ── 5. OUT ───────────────────────────────────────────────────────────
begin('5 the way out');
let outside = false;
if (dungeon?.exits?.length) {
  // The stand math is classicStartProbe's, measured not guessed: the
  // eye sits ~1.2 above the motor and the exit AABB is centred near
  // its reported y, so a stand AT the door's height sails the
  // activation ray over the box.
  const { pos, normal } = dungeon.exits[0];
  await page.evaluate(([p, y]) => window.__warpTo(p, y), [
    [pos[0] + normal[0] * 0.8, pos[1] - 0.5, pos[2] + normal[2] * 0.8],
    Math.atan2(-normal[0], -normal[2]),
  ]);
  await waitFrames(2);
  const left = await page.evaluate(() => window.__dungeonExit());
  check('the exit door answers the activation a player would make', left === true);
  outside = !!await until(async () => (await mode()) === 'exterior', 60000);
  check('and the player is standing in the world', outside, `mode ${await mode()}`);
  await until(() => page.evaluate(() => window.__streamIdle?.() === true), 120000);
  await waitFrames(4);
} else {
  skip('the exit door answers the activation a player would make', 'no exit');
  skip('and the player is standing in the world', 'no exit');
}
await shot('08-outside');
await alive('leaving the dungeon');

// ── 6. THE ROAD ──────────────────────────────────────────────────────
// Privateer's Hold opens onto wilderness; the first hour's next move
// is the map. This is travelProbe's walk, driven on the same window.
begin('6 the road');
const travelState = () => J(() => window.__travelProbe());
const travelMap = () => J(() => window.__travelMap());
let arrived = false, dest = null;
if (outside) {
  // Drain the quest arc's boot boxes before driving keys.
  for (let i = 0, quiet = 0; i < 30 && quiet < 2; i++) {
    const up = await page.evaluate(() => JSON.parse(window.__talk()).overlay);
    if (up) { quiet = 0; await key('Escape'); } else quiet++;
    await waitFrames(1);
  }
  dest = await J(() => window.__travelNearest());
  const before = await travelState();
  check('the map knows somewhere to go', !!dest?.name, dest ? `${dest.name}, ${dest.region}` : 'nothing discovered');
  if (dest?.name) {
    await key('v');
    const opened = await travelMap();
    check('the travel map opens', !!opened);
    if (!opened?.identifying) await page.mouse.click(25 * 4, 191 * 4);
    await key('Enter', 1);
    let s = await travelMap();
    if (!s?.regionSelected) { await page.mouse.click(25 * 4, 191 * 4); await key('Enter', 1); s = await travelMap(); }
    check('the player\'s own region page opens', !!s?.regionSelected);
    await key('f', 1);
    for (const c of dest.name) {
      if (c === ' ') await page.keyboard.press('Space');
      else if (/[a-zA-Z0-9'-]/.test(c)) await page.keyboard.press(c);
      await page.waitForTimeout(30);
    }
    await key('Enter', 1);
    if ((await travelMap())?.picker) await key('Enter', 1);
    check('the destination is found by name', !!(await travelMap())?.locationSelected);
    await shot('09-travel-map');
    await until(async () => { const x = await travelMap(); return x?.top === 'confirm' || x?.popUp; }, 60000);
    if ((await travelMap())?.top === 'confirm') await key('y', 1);
    await key('b', 8);
    await until(async () => (await travelMap()) === null, 90000);
    await until(() => page.evaluate(() => window.__streamIdle?.() === true), 180000);
    const after = await travelState();
    arrived = check('the trip happens: the clock runs and the player is somewhere else',
      after.minutes > before.minutes && (after.pixel.x !== before.pixel.x || after.pixel.y !== before.pixel.y),
      `${Math.round((after.minutes - before.minutes) / 60)}h, ${before.pixel.x},${before.pixel.y} -> ${after.pixel.x},${after.pixel.y}`);
    check('and it lands at the place that was asked for',
      Math.abs(after.pixel.x - dest.pixel.x) <= 1 && Math.abs(after.pixel.y - dest.pixel.y) <= 1,
      `wanted ${dest.pixel.x},${dest.pixel.y}`);
  }
} else {
  skip('the map knows somewhere to go', 'never got outside');
  skip('the trip happens: the clock runs and the player is somewhere else', 'never got outside');
}
await waitFrames(4);
await shot('10-arrived');
await alive('the road');

// ── 7. A TOWN ────────────────────────────────────────────────────────
begin('7 a town');
let doors = [];
if (arrived) {
  doors = await page.evaluate(() => window.__doors());
  check('the destination is a place with buildings in it', doors.length > 0, `${doors.length} doors`);
  const people = await J(() => window.__people());
  check('and people in it', (people?.length ?? 0) > 0, `${people?.length ?? 0} townsfolk`);
} else {
  skip('the destination is a place with buildings in it', 'never travelled');
}
await shot('11-town');

// ── 8/9. A SHOP, AND A PURCHASE ──────────────────────────────────────
begin('8 a shop');
/** Walk to a door, face it, and open it the way a player does. */
const enterDoor = async (door) => {
  const { pos, normal } = door;
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) return false;
  await waitFrames(6);
  return (await mode()) === 'interior';
};
/** ONE round trip, not one per door. Burgley has 325 of them, and a
 *  page.evaluate apiece is a minute of SwiftShader-paced waiting for
 *  data the page can hand over in a single call. */
const classify = async () => {
  const all = await J(([shops, tavern]) => JSON.stringify(
    window.__doors().map((_, i) => JSON.parse(window.__buildingAt(i) ?? 'null'))
      .map((b, i) => (b && (shops.includes(b.buildingType) || b.buildingType === tavern)
        ? { i, b } : null))
      .filter(Boolean)), [[...SHOP_TYPES], TAVERN]);
  const out = { shops: [], taverns: [] };
  for (const { i, b } of all ?? []) {
    if (SHOP_TYPES.has(b.buildingType)) out.shops.push({ i, b, door: doors[i] });
    if (b.buildingType === TAVERN) out.taverns.push({ i, b, door: doors[i] });
  }
  return out;
};
const kinds = doors.length ? await classify() : { shops: [], taverns: [] };
let inShop = false, shopPick = null;
if (kinds.shops.length) {
  for (const pick of kinds.shops.slice(0, 6)) {
    if (await enterDoor(pick.door)) { inShop = true; shopPick = pick; break; }
  }
  check('a shop door opens and the player walks in', inShop, shopPick ? `${shopPick.b.name ?? ''} (type ${shopPick.b.buildingType})` : 'every shop door refused');
} else {
  skip('a shop door opens and the player walks in', doors.length ? 'no shop in this town' : 'no town');
}
await shot('12-shop-inside');

begin('9 a purchase');
let bought = false;
if (inShop) {
  let o = await J(() => window.__openShelf(0));
  check('the shelf raises the trade screen', !!o?.native, o ? `${o.remote} on the shelf` : 'no window');
  await waitFrames(10);   // the item icons warm async
  await shot('13-trade-window');
  if (o?.native && o.remote > 0) {
    const purse0 = (await entity()).gold;
    // THE ONE REACH-PAST: a first-hour purse (the kit's ~100g plus
    // whatever the biography added) does not cover a shop's cheapest
    // stock, and this stage is testing the PURCHASE, not the economy.
    // The gold goes in through the game's own producer (addGold), the
    // same call the guild rewards use - never a hand-built literal.
    if (purse0 < 5000) {
      await page.evaluate(() => window.__addGold(20000));
      console.log(`  [note] purse topped up through addGold: the first-hour purse was ${purse0}g`);
    }
    const before = await entity();
    const stock = await J(() => window.__tradeOverlay());
    // THROUGH THE WINDOW'S OWN HIT TEST, not screen pixels. The first
    // run clicked native (290,68) scaled by a hand-computed 4x with no
    // letterbox - the arithmetic another probe uses at 1400x900 - and
    // the window CLOSED instead of selling: the canvas is not the
    // viewport here, so the assumed scale and offset were wrong and
    // the click landed somewhere else entirely. __tradeSlot addresses
    // the same rect the window lays the row out at, which is what the
    // item-maker probes do and what this stage actually means to test.
    // DFU'S TRADE WINDOW IS TWO GESTURES, NOT ONE. A click on the
    // shelf STAGES the item into the basket and moves the COST; the
    // MODE ACTION button ("BUY") commits the lot and takes the gold
    // (nativeTrade.js:13, :222-242). The first draft of this stage
    // clicked once, saw the purse unmoved, and was about to report
    // that buying was broken - the screenshot settled it: COST had
    // gone 0 -> 348 and the goods were sitting in the basket. The
    // sibling probe tools/nativeTradeProbe.mjs had the same wrong
    // model and had been failing quietly for exactly this reason.
    //
    // Split in two on purpose: the mouse gesture is tested through the
    // REAL pointer route (a screen point computed from the live canvas),
    // the commit through the window's own button rect.
    const m = await nativeClick(261 + 30, 48 + 20);   // TRADE_RECTS.remoteList, row 0
    console.log(`  [note] canvas ${m.cw}x${m.ch}, native scale ${m.s}, letterbox ${m.ox},${m.oy}`);
    await waitFrames(4);
    o = await J(() => window.__shopOverlay());
    check('a mouse click on the shelf item stages it for purchase',
      (o?.basket ?? 0) > 0 && (o?.cost ?? 0) > 0,
      `${stock?.remote?.[0]?.name ?? '?'}: basket ${o?.basket ?? 0}, cost ${o?.cost ?? 0}`);
    await shot('13b-staged');
    await page.evaluate(() => window.__tradeClick('modeAction'));   // the BUY button
    await waitFrames(4);
    // ...and BUY raises the merchant's HAGGLE OFFER, a Yes/No box
    // ("I can sell for no less than N gold pieces") - ShowTradePopup's
    // three bands, ported at systems/tradeModes.js:280. A purchase is
    // THREE gestures: stage, ask, agree.
    const offer = await J(() => window.__shopOverlay());
    check('the merchant makes an offer', offer?.box?.buttons === 'YesNo',
      (offer?.box?.rows ?? []).join(' ').trim().slice(0, 90));
    await key('y', 4);
    const after = await entity();
    const done = await J(() => window.__shopOverlay());
    bought = check('and agreeing pays for it',
      after.gold < before.gold && after.items > before.items,
      `${stock?.remote?.[0]?.name ?? '?'} for ${before.gold - after.gold}g `
      + `(the offer said ${done?.lastPrice}); ${before.items} -> ${after.items} items`);
    await shot('14-bought');
    await page.evaluate(() => window.__tradeClick('exit'));
    await waitFrames(3);
    check('the trade window closes again', (await J(() => window.__shopOverlay())) === null);
  } else if (o?.native) {
    skip('clicking an item on the shelf buys it', 'the shelf rolled empty this day');
  } else {
    skip('clicking an item on the shelf buys it', 'no trade screen');
  }
  await page.evaluate(() => window.__exit());
  await waitFrames(4);
} else {
  skip('the shelf raises the trade screen', 'never got into a shop');
  skip('clicking an item on the shelf buys it', 'never got into a shop');
}
await alive('the shop');

// ── 10. A BED ────────────────────────────────────────────────────────
// The end of a first hour: rent a room and sleep off the dungeon.
begin('10 a bed');
let inTavern = false, tavernNpc = null;
if (kinds.taverns.length) {
  for (const pick of kinds.taverns.slice(0, 6)) {
    if (!await enterDoor(pick.door)) continue;
    const npcs = await J(() => window.__staticNpcs());
    for (const npc of npcs ?? []) {
      await page.evaluate((i) => window.__activateNpc(i), npc.i);
      await waitFrames(8);
      const o = await J(() => window.__tavernOverlay());
      if (o?.tavern) { inTavern = true; tavernNpc = npc; break; }
    }
    if (inTavern) break;
    await page.evaluate(() => window.__exit());
    await waitFrames(4);
  }
  check('the innkeeper answers', inTavern);
} else {
  skip('the innkeeper answers', doors.length ? 'no tavern in this town' : 'no town');
}
await shot('15-tavern');

let rented = false;
if (inTavern) {
  const g0 = (await entity()).gold;
  await page.evaluate(() => window.__tavernClick('room'));
  await waitFrames(6);
  const field = await J(() => window.__tavernOverlay());
  check('the room offer opens', !!field?.field, field?.value ? `pre-filled "${field.value}"` : '');
  await key('Enter', 6);
  const offer = await J(() => window.__tavernOverlay());
  check('and quotes a price', offer?.buttons === 'YesNo', offer?.box ?? '');
  await key('KeyY', 8);
  const e = await entity();
  const roomRec = await page.evaluate(() => (window.__playerEntity.rentedRooms ?? []).length);
  rented = check('the room is rented: gold leaves the purse and a record lands',
    roomRec === 1 && e.gold < g0, `${g0}g -> ${e.gold}g, ${roomRec} rental(s)`);
  await shot('16-rented');
} else {
  skip('the room is rented: gold leaves the purse and a record lands', 'no innkeeper');
}

// AND THEN THE POINT OF RENTING IT.
if (rented) {
  // Bank a wound so a rest has something to heal, through the same
  // field the ticker writes (no damage door reaches an interior).
  await page.evaluate(() => { window.__playerEntity.health = Math.max(1, Math.floor(window.__playerEntity.maxHealth / 2)); });
  const before = await entity();
  const t0 = (await travelState()).minutes;
  await key('KeyR', 6);   // the Rest action's default binding
  const win = await overlayKind();
  const opened = check('pressing Rest in a rented room opens the rest window', /Rest/i.test(win ?? ''), `overlay: ${win ?? 'none'}`);
  if (opened) {
    await key('Digit2', 4);            // "rest until healed"
    await until(async () => (await entity()).health >= before.maxHealth, 90000);
    const after = await entity();
    const t1 = (await travelState()).minutes;
    check('and sleeping heals the character while the clock runs',
      after.health > before.health && t1 > t0, `hp ${before.health} -> ${after.health}, ${Math.round((t1 - t0) / 60)}h passed`);
    await shot('17-rested');
  } else {
    skip('and sleeping heals the character while the clock runs', 'no rest window');
  }
} else {
  skip('pressing Rest in a rented room opens the rest window', 'no room rented');
}
await alive('the night');

// ── the tally ────────────────────────────────────────────────────────
begin('tally');
check('the whole first hour raised no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await finish();

async function finish() {
const failed = rows.filter((r) => r.ok === false);
const skipped = rows.filter((r) => r.ok === null);
console.log(`\n${'='.repeat(66)}`);
console.log(`FIRST HOUR: ${rows.filter((r) => r.ok === true).length} passed, ${failed.length} failed, ${skipped.length} skipped`);
if (failed.length) {
  console.log('\nWHAT A PLAYER WOULD HIT:');
  for (const f of failed) console.log(`  [${f.stage}] ${f.label}${f.detail ? ` - ${f.detail}` : ''}`);
}
if (skipped.length) {
  console.log('\nNOT REACHED:');
  for (const s of skipped) console.log(`  [${s.stage}] ${s.label} (${s.detail})`);
}
console.log(`\nscreenshots: ${SHOTS}/`);

await browser.close().catch(() => {});
await server.close().catch(() => {});
process.exit(failed.length ? 1 : 0);
}
