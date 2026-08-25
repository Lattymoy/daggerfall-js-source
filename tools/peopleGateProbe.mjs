// P1 probe: AddPeople's visibility tail, against a live town.
//
// The gate is five arms over three primitives, and a unit test can
// only prove the arithmetic. What it cannot prove is that the host
// feeds it the right building at the right moment - which is exactly
// where this lane's bug was: the port resolved the building identity
// AFTER buildInteriorContext, so the gate would have read null.
//
// Walks one real shop TWICE, at an hour it is open and an hour it is
// shut, and then buys the house it is standing next to and walks into
// that. Same building, same block, three different answers.
//
// Run: ARENA2_PATH=/path/to/arena2 node tools/peopleGateProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5238;
const server = await createServer({
  root: '/home/user/project-dagger',
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
// T3's lesson, applied here from the start: `pageerror` is an
// uncaught exception; a console error can be a HANDLED 404 (this
// ARENA2 set has no CURSOR.IMG and the port stands the OS cursor in).
// Only the first decides the exit code.
const notes = [];
page.on('console', (m) => { if (m.type() === 'error') notes.push(m.text()); });

const out = { failures: [] };
const check = (name, ok, detail) => {
  if (!ok) out.failures.push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
};
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};

// class=16 skips the chargen wizard (T2's rule - the wizard would hold
// the town's overlay slot and swallow everything below).
await page.goto(`http://localhost:${PORT}/?shot&play&exterior&time=12:00&class=16`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });

const gate = async () => JSON.parse(await page.evaluate(() => window.__peopleGate()) ?? 'null');
/** The one clock (worldTick), through the host's own probe door. */
const setHour = (h) => page.evaluate((hh) => window.__setWorldMinutes(hh * 60), h);

/** Walk to a door and go in. Returns the gate reading, or null. */
const enterDoor = async (i, doors) => {
  const { pos, normal } = doors[i];
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) return null;
  await waitFrames(8);
  return gate();
};
const leave = async () => { await page.evaluate(() => window.__exit()); await waitFrames(4); };

const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
// Find a SHOP door whose interior actually declares people - an empty
// block would make every arm below trivially true.
let shopIdx = -1, shopGate = null, shopBuilding = null;
for (let i = 0; i < doors.length && shopIdx < 0; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (!b || ![0, 2, 3, 5, 6, 7, 8, 9, 12, 13].includes(b.buildingType)) continue;
  const g = await enterDoor(i, doors);
  if (g && g.declared > 0) { shopIdx = i; shopGate = g; shopBuilding = b; }
  else if (g) await leave();
}
check('found a live shop whose block declares people', shopIdx >= 0,
  shopGate ? { name: shopBuilding?.name, type: shopBuilding?.buildingType, declared: shopGate.declared } : null);
if (shopIdx < 0) { console.log('\nP1 PROBE: no shop with people in this town'); await browser.close(); await server.close(); process.exit(1); }

check('entered at midday, the shop stands ALL of its people', shopGate.standing === shopGate.declared,
  { hour: shopGate.hour, declared: shopGate.declared, standing: shopGate.standing });
// `questWired` counts people the quest machine gave a BEHAVIOUR to,
// which is normally nobody - setupIndividualStaticNPC answers `true`
// for a person no active quest has moved. It is reported, not
// asserted: the property that matters (a hidden person is never
// handed to the machine at all) is an ORDERING inside
// interiorContext and is pinned in test/people.test.js, where it can
// be checked without needing a live quest.
console.log(`  [note] questWired ${shopGate.questWired} of ${shopGate.standing} standing - no active quest has moved anyone here`);
await leave();

// SAME DOOR, after closing - and getting in is the interesting part.
// R1's door ladder REFUSES a closed shop, so the only way a player is
// ever inside one is to break in, which means the shop arm of this
// gate lives behind the lockpick. That is not a probe workaround; it
// is the only path the game itself has.
await setHour(2);
await waitFrames(4);
await page.evaluate(() => window.__enter());   // prove the front door refuses
const refused = await gate();
check('R1 refuses the front door of a closed shop - the arm is only reachable by breaking in',
  refused === null, refused);

// Steal mode, then pick. Each FAILED pick records the skill it was
// tried at (R1's anti-grind), so a retry has to come in higher -
// which is why the loop raises the skill rather than repeating it.
const inSteal = await page.evaluate(() => window.__setInteractionMode('steal'));
check('reached STEAL mode, which is the only mode that offers a pick', inSteal === true);
await waitFrames(2);
let shut = null;
const attempts = [];
for (let skill = 60; skill <= 100 && !shut; skill += 8) {
  // SKILLS ARE NUMERIC-KEYED (Lockpicking = 13) and skillValue reads
  // `skillOverrides` ahead of the sheet. The first draft of this loop
  // wrote `skills.Lockpicking`, which is not a key anything reads, so
  // every pick ran at the character's own chargen skill and all six
  // failed - the probe was testing nothing and saying so.
  await page.evaluate((v) => {
    const e = window.__playerEntity;
    (e.skillOverrides ??= {})[13] = v;
  }, skill);
  shut = await enterDoor(shopIdx, doors);
  // __enter() answers "handled", NOT "entered" - a refused door and a
  // failed pick both return true - so the MODE is what says whether
  // the player actually got inside.
  attempts.push({ skill, mode: await page.evaluate(() => window.__mode?.() ?? null), inside: !!shut });
}
console.log(`  [note] pick attempts: ${JSON.stringify(attempts)}`);
check('the same shop, broken into at 02:00, stands NOBODY', shut && shut.standing === 0,
  shut ? { hour: shut.hour, declared: shut.declared, standing: shut.standing } : null);
check('the block still DECLARES the same people - they are hidden, not gone',
  shut && shut.declared === shopGate.declared, shut ? { declared: shut.declared } : null);
if (shut) await leave();

// A HOUSE the player owns. Buy it outright through the banking seam
// (H1's allocateHouseToPlayer), then walk in.
await setHour(12);
await waitFrames(2);
let houseIdx = -1, houseBefore = null, houseBuilding = null;
for (let i = 0; i < doors.length && houseIdx < 0; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (!b || b.buildingType < 17 || b.buildingType > 20) continue;   // House1..House4
  const g = await enterDoor(i, doors);
  if (g && g.standing > 0) { houseIdx = i; houseBefore = g; houseBuilding = b; }
  else if (g) await leave();
}
if (houseIdx < 0) {
  console.log('  [note] no enterable house with standing people at noon; the owned-house arm is unit-pinned only');
} else {
  check('a house the player does NOT own stands its people', houseBefore.standing > 0,
    { type: houseBuilding.buildingType, standing: houseBefore.standing, hour: houseBefore.hour });
  await leave();
  const bought = await page.evaluate(([key, region]) => window.__ownHouse?.(key, region) ?? false,
    [houseBuilding.buildingKey, houseBuilding.regionIndex ?? 0]);
  check('the deed is written through the banking seam', bought === true, { buildingKey: houseBuilding.buildingKey });
  const owned = await enterDoor(houseIdx, doors);
  check('and the house the player OWNS is empty - the inverted primitive',
    owned && owned.standing === 0,
    owned ? { declared: owned.declared, standing: owned.standing, hour: owned.hour } : null);
  if (owned) await leave();
}

if (notes.length) console.log(`  [note] ${notes.length} console line(s), handled: ${JSON.stringify(notes.slice(0, 2))}`);
check('zero UNCAUGHT page errors', pageErrors.length === 0, { errors: pageErrors.slice(0, 3) });
console.log(`\n${'='.repeat(49)}`);
console.log(out.failures.length ? `P1 PROBE: ${out.failures.length} FAILED` : 'P1 PROBE: all green');
await browser.close();
await server.close();
process.exit(out.failures.length ? 1 : 0);
