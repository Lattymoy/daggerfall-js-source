// INTRO2: gesture -> score-led cinematic -> held title -> menu.
// TITLE-DOOR (2026-10-27, the owner: "People really love the start game intro screen ... instead of this leading to the
// online/offline options, we use the intro title screen as the landing pad itself with these options"): THE HELD TITLE
// IS THE FRONT DOOR. Where it said Tap to continue, the menu's own doors stand on it - the film steps under the menu,
// holds its last frame for the whole visit and is let go when a game is chosen (runCinematicFrontDoor). Skip intro and
// Escape land on the title, not past it. The front door owns the audio session; the overlay owns its canvas, listeners
// and animation frame.
import { IntroTheme, MENU_THEME_GAIN } from '../../systems/introTheme.js';
import { brandMark } from '../brandMark.js';
import { createIntroLandscape } from './introLandscape.js';
import { introFrameAt, INTRO_NARRATION, TITLE_READY_TIME, MENU_FADE_SECONDS } from './introCue.js';
import { INTRO_MAP_LABELS, pictureToFilm } from './introTamriel.js';   // INTRO4: the continent's words, where they sit
import { holdTitle } from './titleHeld.js';   // TITLE-DOOR: the page's mark the menu reads
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from '../pixelifyFive.js';   // FONT3: the film's words in the enhanced face
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';   // FONT3: the one request, made when the film mounts
import { t } from '../../systems/textManager.js';   // L10N4: the film's words in the player's language

/** INTRO4: how long the gate waits for the film's city to be built (the score's own load is held to 15 s). */
export const CITY_WAIT_MS = 20000;
/** TITLE-DOOR: the score time the landed title holds - the mark at rest, its impact spent, the map's words up. */
export const TITLE_HELD_TIME = TITLE_READY_TIME + 1;
/** TITLE-DOOR: how long the menu takes to come up over the landed title (the retired Tap to continue's own fade). */
export const DOORS_FADE_MS = 650;

// FONT3 (2026-10-02, Mac: "we need to ensure everything recieves our enhanced font"): the film's words - the credits,
// Begin, Continue, the footer - were Georgia and the system face, the front door's last words outside the skin's. They
// are the pixel face (the trio, ui/pixelifyFive.js), with the five's own face carried here because this sheet mounts
// before the skin's; the one font request is made at mount (injectEnhancedFonts, which ?nofonts still skips).
const STYLE = `${PIXELIFY_FIVE_FACE}
#intro{position:fixed;inset:0;z-index:30;overflow:hidden;background:#06090b;color:#e5d5ab;
 ${PIXEL_FONT_CSS}isolation:isolate;touch-action:manipulation;}
#intro *{box-sizing:border-box} #intro [hidden]{display:none!important}
.intro-film{position:absolute;inset:0;overflow:hidden;opacity:0;background:radial-gradient(ellipse at 65% 42%,#6d6250 0,#233541 36%,#080e17 76%)}
.intro-landscape{position:absolute;inset:0;display:block;width:100%;height:100%;will-change:transform;transition:opacity .8s ease-out}
.intro-cloud,.intro-shade,.intro-vignette{position:absolute;inset:0;pointer-events:none}
.intro-cloud{background:#d5d8d4;opacity:0}.intro-shade{background:#030609;opacity:.2}
.intro-vignette{background:radial-gradient(ellipse at 50% 48%,transparent 28%,rgba(1,3,5,.35) 70%,rgba(1,3,5,.88) 100%)}
.intro-letterbox{position:absolute;inset:0;pointer-events:none;border-top:5.5dvh solid #040608;border-bottom:5.5dvh solid #040608}
/* BR5: the box keeps BR4's height - 86vw and 1240px x 850/2112 x 526/322 for the DFO mark's 1.63:1; BR6: x 1232/1034 for the dragon mark's 1.19:1; BR7: x 1232/699 for the wordmark's 1.76:1 */
.intro-title{position:absolute;left:50%;top:48%;width:min(61vw,880px);opacity:0;pointer-events:none;transform-origin:50% 50%;will-change:transform,opacity,filter}
.intro-title .brand-logo{display:block;width:100%;height:auto;transform:translateX(0%)}
.intro-title-fallback{font-size:clamp(28px,7vw,100px);text-align:center;margin:0;letter-spacing:.05em}
.intro-light{position:absolute;inset:0;opacity:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,#ebd3a025,transparent 58%)}
/* INTRO4: the narrator's line, low in the frame over a soft dark of its own; the map's words over the continent */
.intro-narration{position:absolute;left:50%;bottom:max(11.5dvh,58px);transform:translateX(-50%);width:min(880px,88vw);padding:14px 28px;text-align:center;opacity:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,#02050799,transparent 72%)}
.intro-narration p{margin:0;font-size:clamp(13px,1.4vw,19px);line-height:1.6;letter-spacing:.05em;color:#efe3c4;text-shadow:0 2px 10px #000,0 0 3px #000}
.intro-map{position:absolute;inset:0;pointer-events:none;opacity:0}
.intro-label{position:absolute;left:0;top:0;white-space:nowrap;transform-origin:0 0;text-transform:uppercase;color:#f1e2b8;text-shadow:0 1px 6px #000,0 0 2px #000;will-change:transform}
.intro-label span{display:block;transform:translate(-50%,-50%)}
.intro-label[data-kind=province]{font-size:clamp(11px,1.3vw,18px);letter-spacing:.3em}
.intro-label[data-kind=sea]{font-size:clamp(9px,.9vw,13px);letter-spacing:.24em;color:#b4cad2;opacity:.8}
.intro-label[data-kind=capital]{font-size:clamp(9px,.95vw,13px);letter-spacing:.18em;color:#ffd98a}
.intro-label[data-kind=capital] span:before{content:'◆';display:block;font-size:9px;margin-bottom:3px;color:#ffcf6a}
.intro-gate{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:22px;text-align:center;background:radial-gradient(ellipse at 50% 42%,#14222dcc,#030609 75%);padding:28px;cursor:pointer}
#intro button{font:inherit;cursor:pointer;touch-action:manipulation;color:inherit}
.intro-begin{min-height:48px;min-width:168px;padding:13px 26px;background:#08101888;border:1px solid #8c7851;font-size:13px!important;letter-spacing:.18em;text-transform:uppercase}
.intro-begin:hover{background:#ad8b3a20;border-color:#dec78c}
#intro button:focus-visible{outline:2px solid #e9d397;outline-offset:6px}
.intro-begin:disabled{opacity:.5;cursor:wait}
.intro-status{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.intro-skip{position:absolute;right:max(20px,env(safe-area-inset-right));top:max(16px,env(safe-area-inset-top));z-index:3;min-height:44px;padding:10px 16px;background:#04060899;border:1px solid #b1a17a42;font-size:11px!important;letter-spacing:.15em;text-transform:uppercase}
.intro-footer{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));left:20px;right:20px;text-align:center;font-size:11px;line-height:1.5;letter-spacing:.18em;text-transform:uppercase;color:#898a82;pointer-events:none}
@media(max-width:600px){.intro-narration{bottom:18dvh;padding:10px 12px}.intro-narration p{font-size:12px;letter-spacing:.03em}.intro-label[data-kind=sea]{display:none}.intro-title{width:90vw}.intro-letterbox{border-width:4dvh 0}.intro-footer{font-size:11px}}
@media(max-height:450px){.intro-title{width:min(52.5vw,709px)}.intro-footer{bottom:6px}.intro-gate{gap:12px}}
/* TITLE-DOOR: the landed title steps under the menu (#enhanced-menu stands at 12) and rises a little to make room for
   the doors under it. The doors' band starts at --intro-doors-top (ui/uiCalmStyle.js TITLE_DOOR_CSS reads it): the
   mark's centre plus half its height - .29 of its width, the 699 / 1232 file's half, rounded up (BR7) */
:root{--intro-title-y:41dvh;--intro-title-w:min(37vw,535px,64dvh);--intro-doors-top:calc(var(--intro-title-y) + var(--intro-title-w) * .29)}
#intro.intro-landed{z-index:11}
#intro.intro-landed .intro-title{top:var(--intro-title-y);width:var(--intro-title-w);transition:top .6s ease-out,width .6s ease-out}
#intro.intro-landed .intro-footer{top:max(74px,calc(env(safe-area-inset-top) + 62px));bottom:auto}
@media(max-height:620px){:root{--intro-title-y:37dvh;--intro-title-w:min(30vw,420px,52dvh)}}
@media(max-width:600px){:root{--intro-title-y:33dvh;--intro-title-w:58vw}}
@media(max-height:450px){:root{--intro-title-y:35dvh;--intro-title-w:min(24vw,280px)}}
@media(prefers-reduced-motion:reduce){#intro.intro-landed .intro-title,.intro-landscape{transition:none}}
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

/**
 * The film, and the title it lands on. Resolves when the title is the menu's landing (TITLE-DOOR) with `release`, the
 * one call that lets the film go - the front door makes it when a game is chosen - or with null when the film is gone
 * before it landed (a frame that threw), and the menu opens on its own sky.
 *
 * `landed` opens straight onto the held title: no gate, no film, and the score left to the front door's own first
 * gesture - the player's Skip start video (UXB1-A).
 */
export async function runIntro({ theme, onReveal, doc = document, freezeAt = null, debug = false, landed = false } = {}) {
  const win = doc.defaultView;
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const host = make(doc, 'section'); host.id = 'intro';
  host.setAttribute('aria-label', t('menu.intro.aria', 'DFO Online introduction'));
  const style = make(doc, 'style'); style.textContent = STYLE; host.append(style);
  injectEnhancedFonts(doc);   // FONT3: the film's words are the skin's face - ask for it now, not when the menu mounts
  const film = make(doc, 'div', 'intro-film');
  const canvas = make(doc, 'canvas', 'intro-landscape'); canvas.setAttribute('aria-hidden', 'true');
  const cloud = make(doc, 'div', 'intro-cloud');
  const shade = make(doc, 'div', 'intro-shade');
  // INTRO4: the map's words - every name the geography's own - placed over the continent each frame
  const map = make(doc, 'div', 'intro-map'); map.setAttribute('aria-hidden', 'true');
  const labels = INTRO_MAP_LABELS.map((entry) => {
    const node = make(doc, 'div', 'intro-label'); node.dataset.kind = entry.kind;
    node.append(make(doc, 'span', null, entry.name)); map.append(node);
    return { node, at: [...pictureToFilm(entry.at[0], entry.at[1])] };
  });
  film.append(canvas, map, cloud, shade, make(doc, 'div', 'intro-vignette'), make(doc, 'div', 'intro-letterbox'));
  const images = [];
  const title = make(doc, 'div', 'intro-title');
  const logo = brandMark(doc); title.append(logo);
  images.push(decodedImage(logo).then((ok) => { if (!ok) title.append(make(doc, 'h1', 'intro-title-fallback', 'DFO Online')); }));
  const light = make(doc, 'div', 'intro-light');
  // INTRO4: the narrator - one line at a time, in the player's language (introCue.js INTRO_NARRATION)
  const narration = make(doc, 'div', 'intro-narration'); narration.setAttribute('aria-hidden', 'true');
  const narrationLine = make(doc, 'p'); narration.append(narrationLine);
  film.append(narration, title, light);
  let narrationKey = null;
  const gate = make(doc, 'div', 'intro-gate');
  const begin = make(doc, 'button', 'intro-begin', t('menu.intro.begin', 'Begin')); begin.type = 'button'; begin.disabled = true;
  // MAC: the gate is the BUTTON and nothing else - no kicker, no title, no
  // rule. The film says which game this is, and says it better than a line of
  // small caps over it. `status` stays as a node because it is the live region
  // a screen reader is owed (and the only thing that says the tap enables
  // sound), but it is off the picture: read aloud, never drawn. The one
  // message a player must SEE - the score failing to load - was never this
  // line's, it is the footer's.
  const status = make(doc, 'p', 'intro-status', t('menu.intro.preparing', 'Preparing…')); status.setAttribute('role', 'status');
  gate.append(begin, status);
  const skip = make(doc, 'button', 'intro-skip', t('menu.intro.skip', 'Skip intro')); skip.type = 'button';
  // MAC: no wordmark in the letterbox - the logo says it, and says it better.
  // The element stays because it is the FAILURE surface: if the score cannot
  // load, beginPlayback writes its truthful card here. Empty until then.
  const footer = make(doc, 'div', 'intro-footer');
  host.append(film, gate, skip, footer); doc.body.append(host);
  // Shared by the setup path and by a tap that beats it: a gesture given
  // during 'preparing' must still open on decoded artwork, never on the
  // blank frames a half-decoded mark would show.
  const decoded = Promise.all(images).catch(() => {});

  let landscape = null, phase = 'preparing', over = false, broken = false, frameId = null;
  const GATE_PHASES = ['preparing', 'ready', 'paused'];
  let menuHost = null, lastFrame = null, mapShown = false, fadeTimer = null;
  let lastWidth = 0, lastHeight = 0;
  let previousFrame = 0, frameInterval = 1000 / 60, frameCount = 0;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const debugState = { phase, time: 0, frames: 0, impactTime: null, readyTime: null, landedTime: null };
  if (debug) win.__intro = { theme, state: debugState, snapshot: () => ({ ...debugState, sourceRunning: !!theme.source, level: theme.level, audioState: theme.context?.state, time: theme.time() }) };
  // DEV-only deterministic visual review. The shipping path always follows
  // the audio device. Seeking is available only with an explicit frozen cue.
  if (debug && freezeAt !== null) win.__intro.seek = (time) => {
    if (Number.isFinite(time) && time >= 0) freezeAt = time;
    return frameCount;
  };

  const stopInput = () => {
    win.removeEventListener('keydown', onKey, true);
    host.removeEventListener('click', onClick);
  };
  // TITLE-DOOR: a title the score carried in keeps it up while the player looks; their first press on the menu takes it
  // down to the menu's level, as the retired Tap to continue did
  function duck() { stopDuck(); theme.setLevel(MENU_THEME_GAIN, MENU_FADE_SECONDS); }
  const stopDuck = () => { win.removeEventListener('pointerdown', duck, true); win.removeEventListener('keydown', duck, true); };

  /** Every exit's one teardown: the release (a game chosen) and a film that broke before it landed. */
  const finish = () => {
    if (over) return;
    over = true;
    win.cancelAnimationFrame(frameId); frameId = null;
    win.clearTimeout(fadeTimer);
    stopInput(); stopDuck();
    win.removeEventListener('resize', requestDraw);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    landscape?.dispose(); landscape = null;
    holdTitle(false, doc);
    host.remove();
    if (menuHost) menuHost.inert = false;
    debugState.phase = 'released';
    resolveDone(null);   // a film that never landed: the menu stands on its own sky
  };

  // TITLE-DOOR: THE LANDING. The title holds; the film steps under the menu (the intro-landed sheet) and the menu comes up
  // over it, inert while it fades in, its first door then given the focus the old Tap to continue had; every press from
  // here is the menu's. `how` says what brought the title in: 'carried' (the score - it ducks at the first press),
  // 'skipped' (Skip intro or Escape - the score starts at the menu's level, as the old Skip's menu did) or 'opened' (Skip
  // start video, a score that failed to load, a film that could not be prepared - the film touches no audio).
  const land = (how) => {
    if (over || phase === 'landed') return;
    if (how === 'skipped') {
      // Preserve the click's activation even if the player skips during loading.
      const unlocked = theme.unlock();
      void Promise.all([unlocked, theme.prepare()]).then(([ok, loaded]) => {
        if (ok && loaded && !theme.disposed) { theme.setLevel(MENU_THEME_GAIN, MENU_FADE_SECONDS); theme.start(); }
      });
      theme.setLevel(MENU_THEME_GAIN, MENU_FADE_SECONDS);
    }
    phase = 'landed'; debugState.phase = phase; debugState.landedTime = freezeAt ?? theme.time?.() ?? null;
    gate.hidden = true; skip.hidden = true;
    stopInput();
    if (how === 'carried') { win.addEventListener('pointerdown', duck, true); win.addEventListener('keydown', duck, true); }
    host.classList.add('intro-landed');
    host.setAttribute('aria-hidden', 'true');   // a picture under the menu now - its words are the menu's
    holdTitle(true, doc);
    win.addEventListener('resize', requestDraw);
    requestDraw();
    try { onReveal(); menuHost = doc.getElementById('enhanced-menu'); }
    catch (error) { console.warn('[intro] menu handoff failed:', error.message); finish(); return; }
    if (menuHost) {
      menuHost.inert = true;
      if (!reduced) menuHost.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: DOORS_FADE_MS, easing: 'ease-out' });
      fadeTimer = win.setTimeout(() => {
        fadeTimer = null;
        menuHost.inert = false;
        menuHost.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      }, reduced ? 0 : DOORS_FADE_MS);
    }
    resolveDone(finish);
  };

  const beginPlayback = async () => {
    if (over || phase === 'landed' || phase === 'starting') return;
    const resuming = phase === 'paused';
    phase = 'starting'; begin.disabled = true;
    // The assets may still be loading behind this tap; prepare() below is the
    // same promise the setup path awaits, so the film opens the moment it is
    // ready rather than asking the player to find the button a second time.
    status.textContent = t('menu.intro.opening', 'Opening…');
    const unlocked = await theme.unlock();
    await decoded;
    const loaded = await theme.prepare();
    if (over || phase === 'landed') return;
    if (!loaded) {
      gate.hidden = true;
      footer.textContent = t('menu.intro.musicFailed', 'Music couldn’t load. You can still continue.');
      land('opened');
      return;
    }
    if (!unlocked || !theme.start()) {
      phase = resuming ? 'paused' : 'ready'; begin.disabled = false;
      begin.textContent = resuming ? t('menu.intro.resume', 'Resume') : t('menu.intro.begin', 'Begin'); status.textContent = t('menu.intro.enableSound', 'Tap anywhere to enable sound.');
      return;
    }
    phase = 'playing'; gate.hidden = true; status.textContent = '';
  };

  // MAC (2026-09-18): a browser gives audio exactly ONE chance per gesture, so
  // the gesture surface is the WHOLE gate, not the 168 px button - a phone
  // player taps the screen, not a target. The button stays as the visible and
  // focusable affordance; a tap during 'preparing' is honoured too, so the
  // single tap a player actually makes is the one that unlocks the context.
  const gateIsOpen = () => !gate.hidden && GATE_PHASES.includes(phase);
  function onClick(event) {
    event.stopPropagation();
    if (event.target.closest('.intro-skip')) { land('skipped'); return; }
    if (gateIsOpen()) void beginPlayback();
  }
  function onKey(event) {
    if (event.repeat) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); land('skipped'); }
    else if ((event.key === 'Enter' || event.key === ' ') && gateIsOpen()) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.target === skip) land('skipped'); else void beginPlayback();
    }
  }
  function onContextLost(event) { event.preventDefault(); landscape?.dispose(); landscape = null; mapShown = false; debugState.landscapeReady = false; }
  host.addEventListener('click', onClick);
  win.addEventListener('keydown', onKey, true);
  canvas.addEventListener('webglcontextlost', onContextLost);

  const renderFrame = (stamp) => {
    if (over) return;
    const redraw = phase === 'landed';   // a held title's redraw - its picture again, no time of its own
    const delta = stamp - previousFrame; previousFrame = stamp;
    // A bounded, observed display interval, not U65's universal 25 ms lead.
    // Rendering for the NEXT presentation compensates one paint opportunity.
    if (delta > 4 && delta < 45) frameInterval += (delta - frameInterval) * 0.12;
    const time = phase === 'landed' ? TITLE_HELD_TIME : freezeAt ?? theme.time(stamp + frameInterval);
    const st = introFrameAt(time, reduced);
    if (phase === 'playing' && freezeAt === null && theme.context?.state !== 'running' && !doc.hidden) {
      // MAC: the gate has no heading to re-word any more, and does not need
      // one - the button itself says Resume, which is the whole affordance.
      phase = 'paused'; gate.hidden = false;
      begin.disabled = false; begin.textContent = t('menu.intro.resume', 'Resume'); status.textContent = t('menu.intro.resumeHint', 'Tap anywhere to resume the music and film.');
    }
    if (phase === 'paused' && theme.context?.state === 'running') { phase = 'playing'; gate.hidden = true; }
    const showFilm = ['playing', 'paused', 'landed'].includes(phase) || freezeAt !== null;
    if (showFilm) {
      const held = phase === 'landed';
      film.style.opacity = String(held ? 1 : st.opening);
      // TITLE-DOOR: a title that landed before its map was drawn (Skip at the gate, Skip start video) stands on the film's
      // own ground, and the map fades in under it when it is
      const mapUp = !held || mapShown;
      canvas.style.opacity = mapUp ? '' : '0';
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      if ((held || !doc.hidden) && (lastFrame === null || st.landscapeTime !== lastFrame.landscapeTime || width !== lastWidth || height !== lastHeight)) {
        landscape?.render(st.landscapeTime, width, height, reduced);
        lastFrame = st;
        lastWidth = width; lastHeight = height;
      }
      // The final camera settles BEFORE the title arrives. Its tiny impact
      // is composited over a held frame, so expensive terrain cannot stall
      // the musical landing or burn GPU while the player considers the menu.
      // INTRO2c: the recoil lives HERE and in the bloom below, never in the
      // wordmark - a bouncing logo is the goofy read Mac rejected.
      canvas.style.transform = `translateY(${(st.title.impact * 6).toFixed(2)}px) scale(${(1 + st.title.impact * 0.012).toFixed(5)})`;
      cloud.style.opacity = String(reduced ? 0 : st.cloud * 0.88);
      shade.style.opacity = String(st.shade);
      const line = st.narration.reduce((best, n) => (n.opacity > (best?.opacity ?? 0) ? n : best), null);
      if (line && line.key !== narrationKey) { narrationKey = line.key; narrationLine.textContent = INTRO_NARRATION.find((n) => n.key === line.key).text; }
      narration.style.opacity = String(line?.opacity ?? 0);
      map.style.opacity = String(mapUp ? st.labels : 0);
      if (st.labels > 0 && landscape) {
        for (const label of labels) {
          const [x, y, front] = landscape.project([label.at[0], 0, label.at[1]]);
          label.node.hidden = !front;
          if (front) label.node.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
        }
      }
      title.style.opacity = String(st.title.opacity);
      title.style.transform = `translate(-50%,-50%) translateY(${(st.title.y * host.clientHeight).toFixed(3)}px) scale(${st.title.scale.toFixed(5)})`;
      // Depth of field only while the mark is travelling; 'none' at rest so
      // the held splash costs no filter pass for as long as the player looks.
      title.style.filter = st.title.blur > 0.02 ? `blur(${st.title.blur.toFixed(2)}px)` : 'none';
      light.style.opacity = String(st.title.impact * 0.6);
      // TITLE-DOOR: the mark at rest is the door - Tap to continue is retired, and the menu stands here instead
      if (st.ready && phase === 'playing') land('carried');
    }
    frameCount++;
    if (debug) debugState.frames = frameCount;
    if (debug && !redraw) {   // TITLE-DOOR: the timing read is the film's frames, the landing's the last of them
      debugState.phase = phase; debugState.time = time;
      debugState.frameMs = delta; debugState.presentationMs = stamp + frameInterval;
      debugState.titleY = st.title.y; debugState.titleOpacity = st.title.opacity;
      debugState.titleScale = st.title.scale; debugState.titleBlur = st.title.blur;
      if (st.title.impact > 0 && debugState.impactTime === null) debugState.impactTime = time;
      if (st.ready && debugState.readyTime === null) debugState.readyTime = time;
    }
    // TITLE-DOOR: the held title is drawn when something changes it (requestDraw) - never every frame for as long as the
    // player stands on the menu
    if (phase !== 'landed' && frameId === null) frameId = win.requestAnimationFrame(draw);
  };
  function draw(stamp) {
    frameId = null;
    try { renderFrame(stamp); }
    catch (error) {
      console.warn('[intro] stopping the film:', error.message);
      // a film that breaks before it lands is let go, the score at the menu's level and the menu on its own sky; a landed
      // title keeps the frame it has and draws no more
      if (phase !== 'landed') { theme.setLevel(MENU_THEME_GAIN, MENU_FADE_SECONDS); finish(); }
      else { broken = true; win.removeEventListener('resize', requestDraw); landscape?.dispose(); landscape = null; }
    }
  }
  function requestDraw() { if (!over && !broken && frameId === null) frameId = win.requestAnimationFrame(draw); }
  frameId = win.requestAnimationFrame(draw);

  // Preparation must not delay the HANDOFF promise. A player can skip and
  // choose a game while the score is still loading; ownership then closes
  // the pending request immediately rather than holding boot for 15 seconds.
  const prepare = async () => {
    // Let the gate paint before map generation. No music advances in setup.
    await new Promise((resolve) => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
    if (over) return;
    // TITLE-DOOR: a title already landed with no film to play asks nothing of the score - the front door's first gesture does
    const musicReady = phase === 'landed' ? true : theme.prepare();
    landscape = createIntroLandscape(canvas);
    // TITLE-DOOR: the continent drawn once it is in - a title that landed before it fades it in, one the film carried in
    // already stands on it
    landscape?.mapReady.then((ok) => { if (ok && !over) { mapShown = true; lastFrame = null; requestDraw(); } });
    // INTRO4: the city is built off this thread; the film opens on it, never on an empty lake - but a build that never
    // answers (a worker that hangs without an error) holds the gate no longer than the score's own load may
    const built = landscape ? Promise.race([landscape.ready, new Promise((resolve) => win.setTimeout(() => resolve(false), CITY_WAIT_MS))]) : Promise.resolve(false);
    await Promise.all([musicReady, decoded, built]);
    debugState.landscapeReady = !!landscape && await built;
    if (over) return;
    if (phase === 'landed') { lastFrame = null; requestDraw(); return; }
    landscape?.render(0, host.clientWidth, host.clientHeight, reduced);
    if (phase === 'preparing') {
      phase = 'ready'; begin.disabled = false;
      status.textContent = reduced ? t('menu.intro.readyReduced', 'Tap anywhere to begin. Reduced motion is on.') : t('menu.intro.ready', 'Tap anywhere to begin. Best with sound on.');
      if (freezeAt !== null) { phase = 'playing'; gate.hidden = true; }
      else begin.focus({ preventScroll: true });
    }
  };
  if (landed) land('opened');
  void prepare().catch(error => { console.warn('[intro] preparation failed:', error.message); land('opened'); });
  return done;
}

/** The single integration seam used by main.js. Every exit releases audio,
 * including a failed menu, classic Begin, online and the game-data picker -
 * and (TITLE-DOOR) the film the menu stood on.
 *
 * UXB1-A: `menuMusic` is the player's Skip start video (uiPrefs
 * skipStartVideo) - the film skipped, the menu's music kept. It is what the
 * film's own Skip intro button starts (land: the theme at MENU_THEME_GAIN),
 * held for the first gesture on the menu because a browser plays nothing
 * before one. TITLE-DOOR: and it still lands on the title - the film's last
 * frame with no film before it, the menu standing on it. ?nointro skips both
 * and opens the menu on its own sky, as it always has.
 * `theme` is the tests' seam; main.js never passes one. */
export async function runCinematicFrontDoor(openMenu, { skip = false, menuMusic = false, doc = document, debug = false, freezeAt = null, theme = new IntroTheme() } = {}) {
  let menu = null, release = null;
  const reveal = () => { menu ??= openMenu(); };
  const onVisibility = () => {
    if (doc.hidden) void theme.pause().catch(() => {});
    else if (theme.source) void theme.unlock();
  };
  let menuThemeAsked = false;
  const startMenuTheme = () => {
    if (menuThemeAsked || theme.disposed) return;
    menuThemeAsked = true;
    void Promise.all([theme.unlock(), theme.prepare()]).then(([ok, loaded]) => {
      if (ok && loaded && !theme.disposed) { theme.setLevel(MENU_THEME_GAIN, 0); theme.start(); }
    });
  };
  const onGesture = () => {
    if (theme.source && theme.context?.state !== 'running') void theme.unlock();
    else if (skip && menuMusic && !theme.source) startMenuTheme();
  };
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('pointerdown', onGesture);
  doc.addEventListener('keydown', onGesture);
  try {
    if (!skip || menuMusic) {
      try { release = await runIntro({ theme, onReveal: reveal, doc, freezeAt, debug, landed: skip }); }
      catch (error) { console.warn('[intro] opening the menu:', error.message); }
    }
    reveal();
    return await menu;
  } finally {
    release?.();   // TITLE-DOOR: the title the menu stood on goes with it, before the scene asks for the GPU
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.removeEventListener('pointerdown', onGesture);
    doc.removeEventListener('keydown', onGesture);
    await theme.dispose();
    if (debug && doc.defaultView.__intro) doc.defaultView.__intro.state.phase = 'disposed';
  }
}
