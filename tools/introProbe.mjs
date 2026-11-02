// INTRO2: live browser/audio integration, independent of the rendered preview.
// TITLE-DOOR (2026-10-27): the held title is the menu's landing - the film lands, steps under the menu and is let go when
// a game is chosen; Skip intro, Escape and the player's Skip start video land on the title, not past it.
// Run: node tools/introProbe.mjs [output-directory]. Starts its own Vite server.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { createServer } from 'vite';
import {
  TITLE_IMPACT_TIME,
  TITLE_ENTER_TIME,
  TITLE_READY_TIME,
  CREST_TIME,
  MAP_TIME,
  INTRO_NARRATION,
  introTitleAt,
} from '../src/ui/intro/introCue.js';
import { MENU_THEME_GAIN } from '../src/systems/introTheme.js';

const out = process.argv[2] ?? 'test-harness/intro';
// BR5: the logo's own size, off its IHDR - this probe wrote BR4's 2112 x 850 in, and a new mark failed it for that alone
const LOGO_PNG = readFileSync(new URL('../src/assets/branding/dfo-online.png', import.meta.url));
const LOGO_W = LOGO_PNG.readUInt32BE(16),
  LOGO_H = LOGO_PNG.readUInt32BE(20);
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5201, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
  ],
});
const base = 'http://localhost:5201/play/';
const results = [],
  errors = [];
const check = (name, ok, detail = null) => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok' : 'FAIL'} ${name}`, detail ?? '');
};
// MAIN-RED (2026-10-26): A PAGE OF THE DEV SERVER IS ITS WHOLE GRAPH. Unbundled, the door asks ~15,900 modules (BOOT1's
// world.js warm-up among them) before the intro's code runs and asks for its recording - measured here, 34s on a warm
// server and 51s on a cold one, and the recording itself then lands at once. This wait's 30s has run out on every run
// since 2026-10-25 as the graph grew; every load is given two minutes. A built page is a few chunks.
const ready = async (page) =>
  page.waitForFunction(
    () => !document.querySelector('.intro-begin')?.disabled && window.__intro?.state.landscapeReady !== undefined,
    null,
    { timeout: 120000 },
  );
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
/** ACC1: the first-run account prompt stands over the doors on a fresh profile - put it away (overhaulsProbe's own). */
const closeAccount = async (page) => {
  const close = page.locator('.px-acctstage button', { hasText: /^close$/i });
  if (await close.count()) {
    await close.first().click();
    await page.waitForSelector('.px-acctstage', { state: 'detached' });
  }
};
// INTRO4: a software GPU draws the film's frames in seconds (its first, with every program's first use, longer still), so
// every wait a page makes is given the dev page's two minutes and more
const follow = (page) => {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(e.message));
};
const seek = async (page, time) => {
  const n = await page.evaluate((t) => window.__intro.seek(t), time);
  await page.waitForFunction(({ n, time }) => window.__intro.state.frames > n && window.__intro.state.time === time, {
    n,
    time,
  });
};
// TITLE-DOOR: a seek past the mark's rest lands the title, which then holds its own frame (and draws only on a change)
const seekTitle = async (page) => {
  await page.evaluate((t) => window.__intro.seek(t), TITLE_READY_TIME + 2);
  await page.waitForFunction(() => window.__intro.state.phase === 'landed');
};
/** TITLE-DOOR: the layout at rest - no transition running (the mark's rise) and two frames laid since (a repaint's foot
 *  measured, its stage resized). Frame-synced, never a sleep: SwiftShader draws a frame in seconds (Home.md, Process). */
const settled = async (page) => {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
/** TITLE-DOOR: the menu is up over the landed title, its fade done, and takes presses. */
const doorsLive = (page) =>
  page.waitForFunction(() => {
    const menu = document.querySelector('#enhanced-menu');
    return menu && !menu.inert && menu.querySelector('.px-home.px-title .px-menu button');
  });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  follow(page);
  await page.goto(`${base}?introdebug`);
  await ready(page);
  check(
    'autoplay gate holds at time zero with no source',
    await page.evaluate(() => !window.__intro.theme.source && window.__intro.theme.time() === 0),
  );
  check('landscape compiled and initialized', await page.evaluate(() => window.__intro.state.landscapeReady));
  await shot(page, '01-begin');
  await page.locator('.intro-begin').click();
  await page.waitForFunction(() => window.__intro.theme.source !== null);
  await page.evaluate(() => {
    window.__sourceBefore = window.__intro.theme.source;
    window.__samples = [];
    const sample = () => {
      const state = window.__intro.state,
        theme = window.__intro.theme;
      if (state.phase === 'released' || state.phase === 'disposed') return;
      window.__samples.push({ ...state, audioTime: theme.time() });
      if (state.phase !== 'landed') requestAnimationFrame(sample); // TITLE-DOOR: the landing frame is the last - the title then holds its own
    };
    requestAnimationFrame(sample);
  });
  await page.waitForFunction(() => window.__intro.state.phase === 'landed', null, { timeout: 150000 }); // INTRO4: the film runs to bar 16, 49 s; TITLE-DOOR: and lands
  await page.waitForTimeout(800); // TITLE-DOOR: the doors' fade and the mark's rise
  await shot(page, '06-final-title');
  const live = await page.evaluate(() => ({ samples: window.__samples, snapshot: window.__intro.snapshot() }));
  writeFileSync(`${out}/live-timing.json`, JSON.stringify(live, null, 2));
  const before = live.samples.findLast((s) => s.time < TITLE_IMPACT_TIME && s.time > TITLE_ENTER_TIME);
  const landed = live.samples.find((s) => s.time >= TITLE_IMPACT_TIME);
  // SwiftShader can present only one frame during the short title fade. The
  // useful live invariant is that the last pre-attack presentation is already
  // visibly descending and has not landed; exact opacity is covered by the
  // deterministic cue tests and frame-by-frame review render.
  // INTRO3: so the frame is held to the cue AT ITS OWN TIME, not to a fixed
  // opacity - the fade is the approach's first 0.125 s, and CI's frames (~0.4 s
  // apart) put the last one inside it about a run in six (0.899 at 18.48 s).
  // INTRO4: and a software GPU draws the film's last flying frame in seconds - it is still on the GPU through the whole
  // 0.78 s approach, so no presentation falls inside it to read. Then the live read is not possible and says so (the
  // gap is measured: the last presentation before the approach and the first after it bracket it), and the approach is
  // read at its own time on a frozen page below ('the logo is out in front ... at a frozen time in the approach').
  const lastBefore = live.samples.findLast((s) => s.time <= TITLE_ENTER_TIME);
  const unobservable =
    !before && lastBefore && landed && landed.time - lastBefore.time > TITLE_IMPACT_TIME - TITLE_ENTER_TIME;
  const cue = before && introTitleAt(before.time);
  check(
    'logo is still out in front of its landing before the musical attack',
    unobservable ||
      (cue &&
        before.titleScale < 0.95 &&
        before.titleY === 0 &&
        before.titleOpacity > 0 &&
        Math.abs(before.titleOpacity - cue.opacity) < 1e-9 &&
        Math.abs(before.titleScale - cue.scale) < 1e-9),
    {
      time: before?.time,
      opacity: before?.titleOpacity,
      scale: before?.titleScale,
      y: before?.titleY,
      cue,
      ...(unobservable
        ? { unobservable: `no presentation between ${lastBefore.time.toFixed(2)} s and ${landed.time.toFixed(2)} s` }
        : {}),
    },
  );
  check(
    'first frame after the attack lands exactly at rest, sharp and centred',
    landed?.titleScale === 1 && landed?.titleBlur === 0 && landed?.titleY === 0 && landed?.titleOpacity === 1,
    landed?.time,
  );
  // A display cannot present between refreshes. On a hardware runner this is
  // normally one 16.7 ms frame; SwiftShader can take longer. The invariant is
  // that the first available presentation after the decoded onset is landed,
  // with no application-authored offset hidden inside a slow renderer.
  const landingDelay = landed?.time - TITLE_IMPACT_TIME;
  check(
    'logo lands on the first available presentation frame after the measured attack',
    landed && landingDelay >= 0 && landingDelay <= landed.frameMs / 1000 + 0.01,
    { delayMs: landingDelay * 1000, frameMs: landed?.frameMs },
  );
  // TITLE-DOOR: the title is the landing - the menu stands on it with no press asked, the film held under it
  check(
    "the landed title is the menu's landing - the doors on it, the film held under it",
    live.snapshot.phase === 'landed' &&
      (await page.evaluate(() => {
        const intro = document.querySelector('#intro'),
          menu = document.querySelector('#enhanced-menu');
        return (
          !!intro &&
          !!menu &&
          intro.classList.contains('intro-landed') &&
          document.documentElement.dataset.introTitle === 'held' &&
          menu.dataset.overTitle === '' &&
          getComputedStyle(menu).backgroundColor === 'rgba(0, 0, 0, 0)' &&
          Number(getComputedStyle(intro).zIndex) < Number(getComputedStyle(menu).zIndex) &&
          !!menu.querySelector('.px-home.px-title .doorbtn.door-online') &&
          !menu.querySelector('.px-ground, .px-wordmark')
        );
      })),
  );
  check(
    'the held title draws no frame while it waits',
    await (async () => {
      const before = await page.evaluate(() => window.__intro.state.frames);
      await page.waitForTimeout(800);
      return await page.evaluate((n) => window.__intro.state.frames === n, before);
    })(),
  );
  const beforeMenuTime = live.snapshot.time;
  check(
    "the score keeps the title's level until the player presses",
    await page.evaluate((gain) => window.__intro.theme.level !== gain, MENU_THEME_GAIN),
  );
  await doorsLive(page);
  await page.mouse.click(4, 360); // bare map: a press that is no door's
  check(
    "the first press takes the same source down to the menu's level",
    await page.evaluate(
      ({ time, gain }) => {
        const t = window.__intro.theme;
        return (
          t.source === window.__sourceBefore && t.time() > time && t.level === gain && t.context.state === 'running'
        );
      },
      { time: beforeMenuTime, gain: MENU_THEME_GAIN },
    ),
  );
  check(
    'shared supplied logo stands in the landed title',
    await page.locator('.intro-title .brand-logo').evaluate((img, w) => img.complete && img.naturalWidth === w, LOGO_W),
  );
  await shot(page, '07-main-menu');
  await page.evaluate(async () => {
    const { setValue } = await import('/src/systems/settings/settings.js');
    setValue('Controls', 'MusicVolume', 0);
  });
  await page.waitForFunction(() => window.__intro.theme.gain.gain.value < 0.001);
  check('menu music obeys live volume settings', true);
  await closeAccount(page);
  // TITLE-DOOR: a section stands on its own ground over the held film, and its way home is the title again
  await page.locator('#enhanced-menu .px-homelink.door-settings').click();
  check(
    'a section covers the held title with its own ground',
    await page.evaluate(() => {
      const menu = document.querySelector('#enhanced-menu');
      return (
        !!document.querySelector('#intro') &&
        menu.dataset.overTitle === undefined &&
        getComputedStyle(menu).backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        !!menu.querySelector('.shell .brand-home .brand-logo')
      );
    }),
  );
  await page.locator('#enhanced-menu .railbtn.railhome').click();
  check(
    'the way home is the title again',
    await page.evaluate(
      () =>
        !!document.querySelector('#enhanced-menu .px-home.px-title') &&
        document.querySelector('#enhanced-menu').dataset.overTitle === '',
    ),
  );
  if (await page.locator('#enhanced-menu .doorbtn.door-offline').count())
    await page.locator('#enhanced-menu .doorbtn.door-offline').click(); // UI-CALM: the games stand behind Offline
  await shot(page, '08-offline-on-title');
  await page.locator('#enhanced-menu .doorbtn.door-new').first().click();
  await page.locator('#enhanced-menu .act.primary', { hasText: 'Begin' }).click();
  await page.waitForSelector('#pick');
  check(
    'starting a game releases audio before the data picker',
    await page.evaluate(
      () =>
        window.__intro.theme.disposed &&
        !window.__intro.theme.context &&
        !window.__intro.theme.source &&
        !window.__intro.theme.buffer,
    ),
  );
  check(
    'and lets the title go with it',
    await page.evaluate(
      () => !document.querySelector('#intro') && document.documentElement.dataset.introTitle === undefined,
    ),
  );
  await ctx.close();

  // Audio interruption is isolated from the sync measurement above: resume
  // must continue the same score position rather than substituting wall time.
  const pausedContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const pausedPage = await pausedContext.newPage();
  follow(pausedPage);
  await pausedPage.goto(`${base}?introdebug`);
  await ready(pausedPage);
  await pausedPage.locator('.intro-begin').click();
  await pausedPage.waitForFunction(() => window.__intro.state.time >= 2.4);
  await pausedPage.evaluate(async () => {
    await window.__intro.theme.pause();
    window.__pause = { time: window.__intro.theme.time(), wall: performance.now() };
  });
  await pausedPage.waitForFunction(
    () => window.__intro.state.phase === 'paused' && performance.now() - window.__pause.wall > 250,
  );
  check(
    'audio suspension freezes the film',
    await pausedPage.evaluate(() => window.__intro.theme.time() === window.__pause.time),
  );
  // TITLE-DOOR: the resume is read against the wall time since its own press, not a fixed second - a software GPU draws a
  // frame in 2 to 9 s, so the frame-polled wait below can let more than a second of score pass before the read (the check
  // failed so on INTRO4's run, before this change). A jump by wall time adds the whole pause, which is held over 250 ms.
  const resumedAt = await pausedPage.evaluate(() => performance.now());
  await pausedPage.locator('.intro-begin').click();
  await pausedPage.waitForFunction(
    () => window.__intro.state.phase === 'playing' && window.__intro.theme.time() > window.__pause.time + 0.05,
  );
  const resumed = await pausedPage.evaluate(
    (at) => ({
      advanced: window.__intro.theme.time() - window.__pause.time,
      sinceResume: (performance.now() - at) / 1000,
      paused: (at - window.__pause.wall) / 1000,
    }),
    resumedAt,
  );
  check(
    'resuming continues the score instead of jumping by wall time',
    resumed.paused > 0.25 && resumed.advanced <= resumed.sinceResume + 0.15,
    resumed,
  );
  await pausedContext.close();

  // INTRO2b (Mac): a phone player taps the SCREEN, and a browser grants audio
  // once per gesture. This taps the gate well clear of Begin and of Skip, on a
  // real touch device, and requires that single tap to unlock and open.
  const touchContext = await browser.newContext({ ...devices['Pixel 5'] });
  const touchPage = await touchContext.newPage();
  follow(touchPage);
  await touchPage.goto(`${base}?introdebug`);
  await touchPage.bringToFront();
  await ready(touchPage);
  const spot = await touchPage.evaluate(() => {
    // MAC: the gate is the Begin button alone now, so there is no kicker to
    // aim above - the anchor is the BUTTON's own top, and the tap goes half
    // way between it and the top of the screen. That is bare gate: the thing
    // this check is for.
    const button = document.querySelector('.intro-begin').getBoundingClientRect();
    return { x: Math.round(innerWidth / 2), y: Math.round(button.top / 2), clear: button.top / 2 < button.top - 40 };
  });
  check('the tap target under test is neither Begin nor Skip', spot.clear, spot);
  await touchPage.touchscreen.tap(spot.x, spot.y);
  // The score's own clock, not the debug mirror: `state` is refreshed from the
  // animation frame, and a page the compositor considers background is
  // throttled, which says nothing about whether the music is running.
  await touchPage.waitForFunction(() => window.__intro.theme.time() > 0.25, null, { timeout: 25000 });
  const opened = await touchPage.evaluate(() => ({
    audio: window.__intro.theme.context?.state,
    source: !!window.__intro.theme.source,
    score: window.__intro.theme.time(),
    gateHidden: !!document.querySelector('.intro-gate')?.hidden,
    status: document.querySelector('.intro-status')?.textContent,
  }));
  check(
    'one tap anywhere on the gate unlocks audio and opens the film',
    opened.audio === 'running' && opened.source && opened.score > 0.25 && opened.gateHidden && opened.status === '',
    opened,
  );
  await touchContext.close();

  // Stills use the same renderer at explicit score times. They prove
  // composition and sizing, not live synchronization (tested above).
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1280, height: 720 } }],
    ['phone', { ...devices['Pixel 5'] }],
    [
      'landscape-phone',
      { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
    ],
    ['reduced-motion', { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }],
  ]) {
    const c = await browser.newContext(options),
      p = await c.newPage();
    follow(p);
    await p.goto(`${base}?introdebug&introat=0`);
    await ready(p);
    if (name === 'desktop') {
      // INTRO4: the film's shots - the credits over the lake before dawn, the mist breaking, the crest on the 19 s beat,
      // the wheel of the districts, the dive over the Arena, the ascent, and the map of Tamriel with its words
      for (const [t, label] of [
        [3, '02-interkarma'],
        [7, '03-nexus'],
        [13.5, '04-the-reveal'],
        [CREST_TIME, '05-the-crest'],
        [23, '05b-the-wheel'],
        [30, '05c-the-arena'],
        [38, '05d-the-ascent'],
        [47, '05e-tamriel'],
      ]) {
        await seek(p, t);
        await shot(p, label);
      }
      await seek(p, (INTRO_NARRATION[1].up + INTRO_NARRATION[1].out) / 2);
      const said = await p.evaluate(() => ({
        text: document.querySelector('.intro-narration p')?.textContent,
        opacity: Number(document.querySelector('.intro-narration').style.opacity),
      }));
      check(
        "desktop: the narrator's line is up while its shot holds, in the catalog's words",
        said.opacity === 1 && said.text === INTRO_NARRATION[1].text,
        said,
      );
      // the approach at its own time, frozen: the mark out in front, arriving, where the live read cannot see it
      const mid = (TITLE_ENTER_TIME + TITLE_IMPACT_TIME) / 2;
      await seek(p, mid);
      const flying = await p.evaluate(() => ({ ...window.__intro.state }));
      const want = introTitleAt(mid);
      check(
        'desktop: the logo is out in front of its landing at a frozen time in the approach',
        flying.titleScale < 0.95 &&
          flying.titleOpacity > 0 &&
          Math.abs(flying.titleScale - want.scale) < 1e-9 &&
          Math.abs(flying.titleOpacity - want.opacity) < 1e-9 &&
          flying.titleY === 0,
        { flying: { scale: flying.titleScale, opacity: flying.titleOpacity }, want },
      );
      await seek(p, MAP_TIME + 2);
      const words = await p.evaluate(() =>
        [...document.querySelectorAll('.intro-label[data-kind=province]')].map((n) => {
          const r = n.firstChild.getBoundingClientRect();
          return { name: n.textContent, x: r.x + r.width / 2, y: r.y + r.height / 2, shown: !n.hidden };
        }),
      );
      check(
        'desktop: the nine provinces are named over the continent, every one in frame',
        words.length === 9 && words.every((w) => w.shown && w.x > 0 && w.x < 1280 && w.y > 0 && w.y < 720),
        words,
      );
    }
    await seekTitle(p);
    await doorsLive(p);
    await closeAccount(p);
    await settled(p); // TITLE-DOOR: the mark risen to its landed place, the repaint's foot measured
    // TITLE-DOOR: the mark at its landed place, the doors in the band under it and over the foot - both questions, then the
    // offline games
    const layout = async () =>
      p.evaluate((w) => {
        const logo = document.querySelector('.intro-title img'),
          doors = [...document.querySelectorAll('#enhanced-menu .px-menu .doorbtn')],
          foot = document.querySelector('#enhanced-menu .px-foot');
        const a = logo.getBoundingClientRect(),
          rects = doors.map((d) => d.getBoundingClientRect());
        return {
          width: innerWidth,
          height: innerHeight,
          logo: { x: a.x, y: a.y, width: a.width, height: a.height, bottom: a.bottom, right: a.right },
          loaded: logo.naturalWidth === w,
          doors: {
            top: Math.min(...rects.map((r) => r.top)),
            bottom: Math.max(...rects.map((r) => r.bottom)),
            left: Math.min(...rects.map((r) => r.left)),
            right: Math.max(...rects.map((r) => r.right)),
            least: Math.min(...rects.map((r) => r.height)),
            count: rects.length,
          },
          foot: foot.getBoundingClientRect().top,
        };
      }, LOGO_W);
    const fits = (l) =>
      l.loaded &&
      l.logo.x >= 0 &&
      l.logo.right <= l.width + 1 &&
      Math.abs(l.logo.width / l.logo.height - LOGO_W / LOGO_H) < 0.01 &&
      l.logo.bottom <= l.doors.top + 1 &&
      l.doors.bottom <= l.foot + 1 &&
      l.doors.left >= 0 &&
      l.doors.right <= l.width &&
      l.doors.least >= 44;
    const top = await layout();
    check(
      `${name}: the mark fits at its natural aspect, the two questions under it and over the foot`,
      fits(top) && top.doors.count === 2,
      top,
    );
    await shot(p, `title-${name}`);
    await p.locator('#enhanced-menu .doorbtn.door-offline').click();
    await settled(p);
    const games = await layout();
    check(`${name}: the offline games fit the same band`, fits(games) && games.doors.count === 5, games);
    await shot(p, `title-offline-${name}`);
    await c.close();
  }

  const failure = await browser.newContext(),
    fp = await failure.newPage();
  follow(fp);
  await fp.route('**/theme.mp3*', (route) => route.abort());
  await fp.goto(`${base}?introdebug`);
  await ready(fp);
  await fp.locator('.intro-begin').click();
  await fp.waitForFunction(() => window.__intro.state.phase === 'landed');
  check(
    'missing score lands the title with an explicit message',
    (await fp.locator('.intro-footer').textContent()).includes('couldn’t load'),
  );
  await doorsLive(fp);
  check('missing score never blocks the menu', (await fp.locator('.px-menu button').count()) > 0);
  await failure.close();

  const slow = await browser.newContext(),
    sp = await slow.newPage();
  follow(sp);
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  await sp.route('**/theme.mp3*', async (route) => {
    await blocked;
    await route.continue().catch(() => {});
  });
  await sp.goto(`${base}?introdebug`);
  await sp.waitForSelector('.intro-skip', { timeout: 120000 }); // MAIN-RED: a dev page, as ready()
  await sp.locator('.intro-skip').click();
  await sp.waitForFunction(() => window.__intro.state.phase === 'landed');
  await doorsLive(sp);
  check(
    'skip works while audio is still loading - it lands on the title',
    (await sp.locator('.px-home.px-title .px-menu button').count()) > 0,
  );
  release(); // before the score's own 15 s load limit
  await sp.waitForFunction(() => window.__intro.theme.source !== null, null, { timeout: 30000 });
  check(
    'late audio joins the menu at the menu level',
    await sp.evaluate((gain) => window.__intro.theme.level === gain, MENU_THEME_GAIN),
  );
  // TITLE-DOOR: skipped at the gate, the title stands before its map is drawn - the film's own ground, then the map in
  await sp.waitForFunction(
    () =>
      window.__intro.state.landscapeReady !== undefined &&
      getComputedStyle(document.querySelector('.intro-landscape')).opacity === '1',
    null,
    { timeout: 180000 },
  );
  check('the map fades in under a title skipped to before it was built', true);
  await slow.close();

  // UXB1-A + TITLE-DOOR: the player's Skip start video opens on the title - no gate, no film - and the score waits for a press
  const pref = await browser.newContext({ viewport: { width: 1280, height: 720 } }),
    pp = await pref.newPage();
  follow(pp);
  await pp.goto(`${base}?introdebug`);
  await pp.waitForSelector('.intro-skip', { timeout: 120000 });
  await pp.evaluate(async () => {
    const { setPref } = await import('/src/systems/uiPrefs.js');
    setPref('skipStartVideo', true);
  });
  await pp.reload();
  await pp.waitForFunction(() => window.__intro?.state.phase === 'landed', null, { timeout: 120000 });
  await doorsLive(pp);
  check(
    'Skip start video opens on the title, no gate and no film before it',
    await pp.evaluate(
      () =>
        document.querySelector('.intro-gate').hidden &&
        document.querySelector('.intro-skip').hidden &&
        !!document.querySelector('.px-home.px-title') &&
        !window.__intro.theme.source,
    ),
  );
  await pp.mouse.click(4, 360);
  await pp.waitForFunction(() => window.__intro.theme.source !== null, null, { timeout: 30000 });
  check(
    "and its first press starts the score at the menu's level",
    await pp.evaluate((gain) => window.__intro.theme.level === gain, MENU_THEME_GAIN),
  );
  await pref.close();
  check('no uncaught page errors', errors.length === 0, errors);
} catch (error) {
  check('probe completed', false, error.stack);
} finally {
  writeFileSync(`${out}/browser-report.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  await server.close();
}
assert.ok(
  results.every((r) => r.ok),
  `${results.filter((r) => !r.ok).length} cinematic checks failed; see ${out}/browser-report.json`,
);
