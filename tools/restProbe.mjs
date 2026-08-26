// U48 probe: the rest dispatch and the fourth host, live.
//
// The unit tests drive restDecision and startRestGroundedCheck over
// fixtures, and canrest.test.js drives V5's CanRest. This proves the
// HOST half - that KeyR reaches a window in the ?town page, which had
// no rest arm at all; that DaggerfallRestWindow's two-step really
// runs (the warning box, then Vagrancy and the watch, then the
// window); that the dispatch above CanRest actually gates, since the
// guards the camping crime summons refuse the very next press; and
// that a rested hour moves the world clock through the shared deps
// factory rather than through a copy.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5223, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const fail = (m) => { console.log('FAIL:', m); process.exit(1); };

async function boot(query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
  await page.goto(`http://localhost:5223/play/${query}`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
  const waitFrames = async (n) => {
    const f = await page.evaluate(() => window.__frame);
    await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
  };
  // V5b: TEXT.RSC rows are { text, center } objects, not strings.
  const talk = async () => {
    const t = JSON.parse(await page.evaluate(() => window.__talk()));
    t.overlayText = typeof t.overlayText === 'string' ? t.overlayText : (t.overlayText?.text ?? null);
    return t;
  };
  // __shotReady fires at frame 5, and the MOTOR has not settled by
  // then: it spawns 2 units up and falls. Pressing R at frame 7 reads
  // `grounded === false` and gets DFU's 355 - which is correct
  // behaviour for a player in mid-air, and exactly why the probe
  // lands first.
  await waitFrames(40);
  // the world host installs its townTalk surface after the first
  // location streams in, so this is a wait and not an assumption
  await page.waitForFunction(() => typeof window.__talk === 'function', null, { timeout: 120000 });
  return { page, errors, waitFrames, talk };
}

// ---------------------------------------------------------------
// 1. THE ?town PAGE - the fourth host, camping in a city street
// ---------------------------------------------------------------
console.log('== THE ?town PAGE: KeyR IN A CITY STREET ==');
{
  const { page, errors, waitFrames, talk } = await boot('?shot&play&exterior&time=12:00&class=1');
  let t = await talk();
  if (t.overlay) fail('something was already up before the key');

  // DaggerfallRestWindow's two-step (:640-691): in a town's rect the
  // buttons ask before calling through with alreadyWarned = true.
  await page.keyboard.press('r');
  await waitFrames(2);
  t = await talk();
  console.log('first press ->', JSON.stringify({ overlay: t.overlay, rest: t.overlayRest, text: t.overlayText }));
  if (!t.overlay) fail('KeyR did nothing at all - this page still has no rest arm');
  if (t.overlayRest) fail('a town rest must ask first');
  if (!/illegal|camp/i.test(t.overlayText ?? '')) fail(`expected the illegal-camping warning, got ${t.overlayText}`);
  // nothing has been charged yet - the warning is a question
  if (await page.evaluate(() => window.__playerEntity.crimeCommitted)) {
    fail('the WARNING must not book the crime; CanRest does that');
  }

  // Y - and CanRest answers `alreadyWarned` itself, so this is the
  // press that both books the Vagrancy and opens the window.
  await page.keyboard.press('y');
  await waitFrames(2);
  t = await talk();
  const crime = await page.evaluate(() => window.__playerEntity.crimeCommitted);
  console.log('after Y ->', JSON.stringify({ rest: t.overlayRest, crime }));
  if (!crime) fail('camping in a town is VAGRANCY, and the confirmed press commits it');
  if (!t.overlayRest) fail('and the confirmed press opens the rest window');

  // THE DISPATCH ABOVE CANREST, live: the watch the crime summoned is
  // nearby now, so the very next press is refused with TEXT.RSC 354 -
  // which is exactly the ladder that did not exist above ground.
  await page.keyboard.press('Escape');
  await waitFrames(2);
  await page.waitForFunction(() => JSON.parse(window.__guards()).length > 0, null, { timeout: 60000 });
  await page.keyboard.press('r');
  await waitFrames(2);
  t = await talk();
  console.log('with the watch out ->', JSON.stringify({ rest: t.overlayRest, text: t.overlayText }));
  if (t.overlayRest) fail('the guards the vagrancy summoned must block this press');
  if (!/enemies/i.test(t.overlayText ?? '')) fail(`expected the enemies line, got ${t.overlayText}`);
  const alert = await page.evaluate(() => !!window.__playerEntity.enemyAlertActive);
  console.log('alert raised by the refusal:', alert);
  if (!alert) fail('the enemy arm must RAISE the alert before it refuses (DaggerfallUI:654-655)');

  // ...and with the street clear it opens again, which is what proves
  // the refusal was the dispatch and not a dead key.
  await page.keyboard.press('Escape');
  await waitFrames(2);
  await page.evaluate(() => {
    const n = JSON.parse(window.__guards()).length;
    for (let i = 0; i < n; i++) window.__guardDamage(i, 999);
  });
  await waitFrames(4);
  await page.keyboard.press('r');
  await waitFrames(2);
  // The warning is asked EVERY press: `alreadyWarned` is the argument
  // CanRest is called back with, not a latch the host remembers, so a
  // player who camped an hour ago is asked again. Verbatim.
  t = await talk();
  console.log('with the street clear ->', JSON.stringify({ rest: t.overlayRest, text: t.overlayText }));
  if (!/illegal|camp/i.test(t.overlayText ?? '')) fail(`the warning is asked again, got ${t.overlayText}`);
  await page.keyboard.press('y');
  await waitFrames(2);
  t = await talk();
  console.log('after Y ->', JSON.stringify({ overlay: t.overlay, rest: t.overlayRest }));
  if (!t.overlayRest) fail('a player on an empty street must get the rest window');

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await page.close();
}

console.log('\n== THE WORLD HOST: THE SAME KEY, THE OTHER SCENE ==');
{
  const { page, errors, waitFrames, talk } = await boot('?shot&play&world&time=12:00&class=1');
  // ?class=1 runs the headless chargen, which leaves the backstory box
  // up. Clear it before pressing anything.
  for (let i = 0; i < 6 && (await talk()).overlay; i++) {
    await page.keyboard.press('Escape');
    await waitFrames(2);
  }
  let t = await talk();
  if (t.overlay) fail('could not clear the boot box');
  console.log('standing at:', await page.evaluate(() => window.__travelProbe()));

  // The world host defaults to the CITY of Daggerfall, so this is the
  // town branch again - but through a DIFFERENT host, a different
  // in-town test (locationIndex over the travel pixel, not "this page
  // is a location") and a different deps object. The wilderness arm is
  // pinned in test/restwhere.test.js; what a live probe can prove here
  // is that the key reaches a window at all, which it never did.
  await page.keyboard.press('r');
  await waitFrames(2);
  t = await talk();
  console.log('press ->', JSON.stringify({ overlay: t.overlay, rest: t.overlayRest, text: t.overlayText }));
  if (!t.overlay) fail('KeyR did nothing in the world host either');
  if (!/illegal|camp/i.test(t.overlayText ?? '')) fail(`expected the illegal-camping warning, got ${t.overlayText}`);
  await page.keyboard.press('y');
  await waitFrames(2);
  t = await talk();
  if (!(await page.evaluate(() => window.__playerEntity.crimeCommitted))) fail('the world host must book the vagrancy too');
  console.log('after Y ->', JSON.stringify({ rest: t.overlayRest }));
  if (!t.overlayRest) fail('the confirmed press must open the rest window');

  // THE CLOCK MOVES, through the shared deps builder's advanceMinutes.
  const minutesOf = () => page.evaluate(() => JSON.parse(window.__travelProbe()).minutes);
  const t0 = await minutesOf();
  await page.keyboard.press('l');          // Loiter
  await waitFrames(2);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  // Poll the CLOCK, not the frame counter: the rested hour is what is
  // being watched, and a rest that never starts is the failure.
  // A WHOLE HOUR, not the first sub-tick: 6 x 10 classic minutes at
  // 0.125 real seconds each, so this is under a second of wall clock
  // and a rest that ticks once and stalls still fails.
  await page.waitForFunction((m0) => JSON.parse(window.__travelProbe()).minutes >= m0 + 60, t0, { timeout: 60000 })
    .catch(() => {});
  const t1 = await minutesOf();
  console.log('clock: %s -> %s (%s classic minutes)', t0, t1, t1 - t0);
  if (!(t1 >= t0 + 60)) fail(`a loitered HOUR moved the world clock ${t1 - t0} minutes`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await page.close();
}

console.log('\nPASS');
await browser.close();
await server.close();
process.exit(0);
