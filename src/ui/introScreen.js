// INTRO2: gesture -> score-led cinematic -> held title -> tap -> menu.
// The front door owns the audio session. The overlay owns only its canvas,
// listeners and animation frame, and the menu is inert for the whole fade.
import { IntroTheme, MENU_THEME_GAIN } from '../systems/introTheme.js';
import { brandMark } from './brandMark.js';
import { createIntroLandscape } from './introLandscape.js';
import { introFrameAt, introEase, INTRO_CREDITS, TITLE_READY_TIME, MENU_FADE_SECONDS } from './introCue.js';

export const INTRO_CREDIT_URLS = Object.freeze({
  interkarma: new URL('../assets/intro/interkarma.webp', import.meta.url).href,
  nexus: new URL('../assets/intro/nexus.webp', import.meta.url).href,
});

const STYLE = `
#intro{position:fixed;inset:0;z-index:30;overflow:hidden;background:#06090b;color:#e5d5ab;
 font-family:Georgia,'Times New Roman',serif;isolation:isolate;touch-action:manipulation;}
#intro *{box-sizing:border-box} #intro [hidden]{display:none!important}
.intro-film{position:absolute;inset:0;overflow:hidden;opacity:0;background:radial-gradient(ellipse at 65% 42%,#6d6250 0,#233541 36%,#080e17 76%)}
.intro-landscape{position:absolute;inset:0;display:block;width:100%;height:100%;will-change:transform}
.intro-cloud,.intro-shade,.intro-vignette{position:absolute;inset:0;pointer-events:none}
.intro-cloud{background:#d5d8d4;opacity:0}.intro-shade{background:#030609;opacity:.2}
.intro-vignette{background:radial-gradient(ellipse at 50% 48%,transparent 28%,rgba(1,3,5,.35) 70%,rgba(1,3,5,.88) 100%)}
.intro-letterbox{position:absolute;inset:0;pointer-events:none;border-top:5.5dvh solid #040608;border-bottom:5.5dvh solid #040608}
.intro-credit{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;opacity:0;pointer-events:none;text-align:center}
.intro-credit p{margin:0;font-size:clamp(11px,1.15vw,15px);text-transform:uppercase;letter-spacing:.26em;text-shadow:0 2px 12px #000}
.intro-credit img{display:block;max-width:62vw;max-height:29dvh;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 3px 14px #0008)}
.intro-credit[data-credit=nexus] img{max-width:45vw;max-height:17dvh}
.intro-title{position:absolute;left:50%;top:48%;width:min(86vw,1240px);opacity:0;pointer-events:none;mix-blend-mode:screen;will-change:transform,opacity}
.intro-title .enhanced-logo{display:block;width:100%;height:auto}
.intro-title-fallback{font-size:clamp(28px,7vw,100px);text-align:center;margin:0;letter-spacing:.05em}
.intro-light{position:absolute;inset:0;opacity:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,#ebd3a025,transparent 58%)}
.intro-gate{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:22px;text-align:center;background:radial-gradient(ellipse at 50% 42%,#14222dcc,#030609 75%);padding:28px}
.intro-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.38em;line-height:1.8;color:#a9a390;margin:0}
.intro-gate h1{font-weight:400;font-size:clamp(28px,5vw,56px);letter-spacing:.17em;margin:0;text-transform:uppercase}
.intro-ornament{width:145px;height:1px;background:linear-gradient(90deg,transparent,#a28b51,transparent);position:relative;margin:5px 0}
.intro-ornament:after{content:'';position:absolute;width:5px;height:5px;border:1px solid #d6bb7e;transform:rotate(45deg);left:calc(50% - 3px);top:-2px;background:#0a1017}
#intro button{font:inherit;cursor:pointer;touch-action:manipulation;color:inherit}
.intro-begin{min-height:48px;min-width:168px;padding:13px 26px;background:#08101888;border:1px solid #8c7851;font-size:13px!important;letter-spacing:.18em;text-transform:uppercase}
.intro-begin:hover{background:#ad8b3a20;border-color:#dec78c}
#intro button:focus-visible{outline:2px solid #e9d397;outline-offset:6px}
.intro-begin:disabled{opacity:.5;cursor:wait}
.intro-status{min-height:18px;margin:0;font:12px/1.5 system-ui,sans-serif;color:#aaa99f}
.intro-skip{position:absolute;right:max(20px,env(safe-area-inset-right));top:max(16px,env(safe-area-inset-top));z-index:3;min-height:44px;padding:10px 16px;background:#04060899;border:1px solid #b1a17a42;font-size:11px!important;letter-spacing:.15em;text-transform:uppercase}
.intro-continue{position:absolute;left:50%;bottom:max(13dvh,60px);transform:translateX(-50%);white-space:nowrap;min-height:48px;padding:12px 28px;background:none;border:0;font-size:12px!important;letter-spacing:.25em;text-transform:uppercase;opacity:0}
.intro-continue:before,.intro-continue:after{content:'◆';display:inline-block;font-size:7px;vertical-align:middle;color:#bfa878;margin:0 18px}
.intro-footer{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));left:20px;right:20px;text-align:center;font:10px/1.5 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#898a82;pointer-events:none}
@media(max-width:600px){.intro-credit img{max-width:80vw;max-height:24dvh}.intro-credit[data-credit=nexus] img{max-width:72vw}.intro-credit p{font-size:10px;letter-spacing:.18em}.intro-continue{bottom:23dvh;font-size:10px!important;letter-spacing:.16em}.intro-title{width:94vw}.intro-letterbox{border-width:4dvh 0}.intro-footer{font-size:9px}}
@media(max-height:450px){.intro-continue{bottom:7dvh}.intro-title{width:min(74vw,1000px)}.intro-footer{bottom:6px}.intro-gate{gap:12px}.intro-gate h1{font-size:26px}}
`;

const make = (doc, tag, cls, text) => {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

async function decodedImage(image) {
  let timer;
  try {
    await Promise.race([image.decode(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Image timed out')), 10000); })]);
    return image.naturalWidth > 0;
  } catch { image.hidden = true; return false; }
  finally { clearTimeout(timer); }
}

export async function runIntro({ theme, onReveal, doc = document, freezeAt = null, debug = false } = {}) {
  const win = doc.defaultView;
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const host = make(doc, 'section'); host.id = 'intro';
  host.setAttribute('aria-label', 'Daggerfall Enhanced introduction');
  const style = make(doc, 'style'); style.textContent = STYLE; host.append(style);
  const film = make(doc, 'div', 'intro-film');
  const canvas = make(doc, 'canvas', 'intro-landscape'); canvas.setAttribute('aria-hidden', 'true');
  const cloud = make(doc, 'div', 'intro-cloud');
  const shade = make(doc, 'div', 'intro-shade');
  film.append(canvas, cloud, shade, make(doc, 'div', 'intro-vignette'), make(doc, 'div', 'intro-letterbox'));
  const images = [];
  const credits = new Map();
  for (const entry of INTRO_CREDITS) {
    const credit = make(doc, 'div', 'intro-credit'); credit.dataset.credit = entry.key;
    credit.setAttribute('aria-hidden', 'true');
    const image = make(doc, 'img'); image.src = INTRO_CREDIT_URLS[entry.key];
    image.alt = entry.key === 'interkarma' ? 'Interkarma — Daggerfall Unity' : 'Nexus Mods';
    credit.append(make(doc, 'p', null, entry.caption), image);
    credits.set(entry.key, credit); images.push(decodedImage(image)); film.append(credit);
  }
  const title = make(doc, 'div', 'intro-title');
  const logo = brandMark(doc); title.append(logo);
  images.push(decodedImage(logo).then((ok) => { if (!ok) title.append(make(doc, 'h1', 'intro-title-fallback', 'Daggerfall Enhanced')); }));
  const light = make(doc, 'div', 'intro-light'); film.append(title, light);
  const gate = make(doc, 'div', 'intro-gate');
  const kicker = make(doc, 'p', 'intro-kicker', 'The Elder Scrolls II');
  const heading = make(doc, 'h1', null, 'The Iliac Bay');
  const begin = make(doc, 'button', 'intro-begin', 'Begin'); begin.type = 'button'; begin.disabled = true;
  const status = make(doc, 'p', 'intro-status', 'Preparing the journey…'); status.setAttribute('role', 'status');
  gate.append(kicker, heading, make(doc, 'div', 'intro-ornament'), begin, status);
  const skip = make(doc, 'button', 'intro-skip', 'Skip intro'); skip.type = 'button';
  const next = make(doc, 'button', 'intro-continue', 'Tap to continue'); next.type = 'button'; next.hidden = true;
  const footer = make(doc, 'div', 'intro-footer', 'Daggerfall Enhanced');
  host.append(film, gate, skip, next, footer); doc.body.append(host);

  let landscape = null, phase = 'preparing', over = false, frameId = null, transitionAt = null;
  let fallbackTime = null, menuHost = null, lastFrame = null, readyFocused = false;
  let lastWidth = 0, lastHeight = 0;
  let previousFrame = 0, frameInterval = 1000 / 60, frameCount = 0;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const debugState = { phase, time: 0, frames: 0, impactTime: null, readyTime: null, fadeStart: null };
  if (debug) win.__intro = { theme, state: debugState, snapshot: () => ({ ...debugState, sourceRunning: !!theme.source, level: theme.level, audioState: theme.context?.state, time: theme.time() }) };
  // DEV-only deterministic visual review. The shipping path always follows
  // the audio device. Seeking is available only with an explicit frozen cue.
  if (debug && freezeAt !== null) win.__intro.seek = (time) => {
    if (Number.isFinite(time) && time >= 0) freezeAt = time;
    return frameCount;
  };

  const finish = () => {
    if (over) return;
    over = true;
    win.cancelAnimationFrame(frameId);
    win.removeEventListener('keydown', onKey, true);
    win.removeEventListener('keyup', blockTransitionKey, true);
    host.removeEventListener('click', onClick);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    landscape?.dispose(); landscape = null;
    host.remove();
    if (menuHost) { menuHost.inert = false; menuHost.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }); }
    debugState.phase = 'menu';
    resolveDone();
  };

  const enterMenu = () => {
    if (over || transitionAt !== null) return;
    // Preserve the click's activation even if the player skips during loading.
    const unlocked = theme.unlock();
    void Promise.all([unlocked, theme.prepare()]).then(([ok, loaded]) => {
      if (ok && loaded && !theme.disposed) { theme.setLevel(MENU_THEME_GAIN, MENU_FADE_SECONDS); theme.start(); }
    });
    theme.setLevel(MENU_THEME_GAIN, MENU_FADE_SECONDS);
    phase = 'transition';
    transitionAt = performance.now(); debugState.fadeStart = theme.time();
    begin.disabled = true; next.disabled = true; skip.disabled = true;
    host.setAttribute('aria-hidden', 'true');
    try { onReveal(); menuHost = doc.getElementById('enhanced-menu'); if (menuHost) menuHost.inert = true; }
    catch (error) { console.warn('[intro] menu handoff failed:', error.message); finish(); }
  };

  const beginPlayback = async () => {
    if (phase === 'transition' || over || phase === 'starting') return;
    const resuming = phase === 'paused';
    phase = 'starting'; begin.disabled = true; status.textContent = 'Opening…';
    const unlocked = await theme.unlock();
    const loaded = await theme.prepare();
    if (over || transitionAt !== null) return;
    if (!loaded) {
      fallbackTime = TITLE_READY_TIME + 1; gate.hidden = true; phase = 'hold';
      footer.textContent = 'Music couldn’t load. You can still continue.';
      return;
    }
    if (!unlocked || !theme.start()) {
      phase = resuming ? 'paused' : 'ready'; begin.disabled = false;
      begin.textContent = resuming ? 'Resume' : 'Begin'; status.textContent = 'Tap to enable sound.';
      return;
    }
    phase = 'playing'; gate.hidden = true; status.textContent = '';
  };

  function onClick(event) {
    event.stopPropagation();
    if (phase === 'transition') { event.preventDefault(); return; }
    if (event.target.closest('.intro-skip')) { enterMenu(); return; }
    if (event.target.closest('.intro-begin')) { void beginPlayback(); return; }
    if (phase === 'hold') enterMenu();
  }
  function onKey(event) {
    if (phase === 'transition') { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (event.repeat) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); enterMenu(); }
    else if ((event.key === 'Enter' || event.key === ' ') && ['ready', 'paused', 'hold'].includes(phase)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.target === skip || phase === 'hold') enterMenu(); else void beginPlayback();
    }
  }
  function blockTransitionKey(event) { if (phase === 'transition') { event.preventDefault(); event.stopImmediatePropagation(); } }
  function onContextLost(event) { event.preventDefault(); landscape?.dispose(); landscape = null; debugState.landscapeReady = false; }
  host.addEventListener('click', onClick);
  win.addEventListener('keydown', onKey, true);
  win.addEventListener('keyup', blockTransitionKey, true);
  canvas.addEventListener('webglcontextlost', onContextLost);

  const renderFrame = (stamp) => {
    if (over) return;
    const delta = stamp - previousFrame; previousFrame = stamp;
    // A bounded, observed display interval, not U65's universal 25 ms lead.
    // Rendering for the NEXT presentation compensates one paint opportunity.
    if (delta > 4 && delta < 45) frameInterval += (delta - frameInterval) * 0.12;
    const time = freezeAt ?? fallbackTime ?? theme.time(stamp + frameInterval);
    const st = introFrameAt(time, reduced);
    if (phase === 'playing' && freezeAt === null && theme.context?.state !== 'running' && !doc.hidden) {
      phase = 'paused'; gate.hidden = false; heading.textContent = 'The journey awaits';
      begin.disabled = false; begin.textContent = 'Resume'; status.textContent = 'Tap to resume the music and film.';
    }
    if (phase === 'paused' && theme.context?.state === 'running') { phase = 'playing'; gate.hidden = true; }
    const showFilm = ['playing', 'hold', 'paused', 'transition'].includes(phase) || freezeAt !== null;
    if (showFilm) {
      film.style.opacity = String(fallbackTime !== null ? 1 : st.opening);
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      if (!doc.hidden && (lastFrame === null || st.landscapeTime !== lastFrame.landscapeTime || width !== lastWidth || height !== lastHeight)) {
        landscape?.render(st.landscapeTime, width, height, reduced);
        lastFrame = st;
        lastWidth = width; lastHeight = height;
      }
      // The final camera settles BEFORE the title arrives. Its tiny impact
      // is composited over a held frame, so expensive terrain cannot stall
      // the musical landing or burn GPU while the player considers the menu.
      canvas.style.transform = `translateY(${(st.title.impact * 4).toFixed(2)}px) scale(${(1 + st.title.impact * 0.008).toFixed(5)})`;
      cloud.style.opacity = String(reduced ? 0 : st.cloud * 0.88);
      shade.style.opacity = String(st.shade);
      for (const credit of st.credits) credits.get(credit.key).style.opacity = String(credit.opacity);
      title.style.opacity = String(st.title.opacity);
      title.style.transform = `translate(-50%,-50%) translateY(${(st.title.y * host.clientHeight).toFixed(3)}px) scale(${st.title.scale.toFixed(5)})`;
      light.style.opacity = String(st.title.impact * 0.45);
      next.hidden = !st.ready; next.style.opacity = String(st.prompt);
      if (st.ready && phase === 'playing') { phase = 'hold'; skip.hidden = true; }
      if (st.ready && !readyFocused && transitionAt === null) { readyFocused = true; next.focus({ preventScroll: true }); }
    }
    frameCount++;
    if (debug) {
      debugState.phase = phase; debugState.time = time; debugState.frames = frameCount;
      debugState.frameMs = delta; debugState.presentationMs = stamp + frameInterval;
      debugState.titleY = st.title.y; debugState.titleOpacity = st.title.opacity;
      if (st.title.impact > 0 && debugState.impactTime === null) debugState.impactTime = time;
      if (st.ready && debugState.readyTime === null) debugState.readyTime = time;
    }
    if (transitionAt !== null) {
      const k = (performance.now() - transitionAt) / (MENU_FADE_SECONDS * 1000);
      host.style.opacity = String(1 - introEase(k));
      if (k >= 1) { finish(); return; }
    }
    frameId = win.requestAnimationFrame(draw);
  };
  const draw = (stamp) => {
    try { renderFrame(stamp); }
    catch (error) { console.warn('[intro] stopping the film:', error.message); enterMenu(); finish(); }
  };
  frameId = win.requestAnimationFrame(draw);

  // Preparation must not delay the HANDOFF promise. A player can skip and
  // choose a game while the score is still loading; ownership then closes
  // the pending request immediately rather than holding boot for 15 seconds.
  const prepare = async () => {
    // Let the gate paint before map generation. No music advances in setup.
    await new Promise((resolve) => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
    if (!over) {
      const musicReady = theme.prepare();
      landscape = createIntroLandscape(canvas);
      debugState.landscapeReady = !!landscape;
      landscape?.render(0, host.clientWidth, host.clientHeight, reduced);
      await Promise.all([musicReady, ...images]);
      if (!over && transitionAt === null) {
        phase = 'ready'; begin.disabled = false; status.textContent = reduced ? 'Reduced motion enabled' : 'Sound on for the full experience';
        if (freezeAt !== null) { phase = 'playing'; gate.hidden = true; }
        else begin.focus({ preventScroll: true });
      }
    }
  };
  void prepare().catch(error => { console.warn('[intro] preparation failed:', error.message); enterMenu(); });
  return done;
}

/** The single integration seam used by main.js. Every exit releases audio,
 * including a failed menu, classic Begin, online and the game-data picker. */
export async function runCinematicFrontDoor(openMenu, { skip = false, doc = document, debug = false, freezeAt = null } = {}) {
  const theme = new IntroTheme();
  let menu = null;
  const reveal = () => { menu ??= openMenu(); };
  const onVisibility = () => {
    if (doc.hidden) void theme.pause().catch(() => {});
    else if (theme.source) void theme.unlock();
  };
  const onGesture = () => { if (theme.source && theme.context?.state !== 'running') void theme.unlock(); };
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('pointerdown', onGesture);
  try {
    if (!skip) {
      try { await runIntro({ theme, onReveal: reveal, doc, freezeAt, debug }); }
      catch (error) { console.warn('[intro] opening the menu:', error.message); }
    }
    reveal();
    return await menu;
  } finally {
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.removeEventListener('pointerdown', onGesture);
    await theme.dispose();
    if (debug && doc.defaultView.__intro) doc.defaultView.__intro.state.phase = 'disposed';
  }
}
