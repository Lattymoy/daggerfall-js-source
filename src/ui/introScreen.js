// ═══════════════════════════════════════════════════════════════════
// THE INTRO — the enhanced door's title moment.
//
// main.js's own header records the gap this fills: the enhanced front
// door deliberately does not run the classic TITLE or the ANIM0001
// SPLASH, "because both read ARENA2, and the whole point of this door
// is that it opens before the folder pick", and it closes by naming
// the slice - "giving the enhanced door its own title moment is its
// own slice". This is that slice.
//
// Three splashes over a flyover of the Iliac Bay, cut to the theme,
// fading into the menu. Mac's brief, 2026-08-29.
//
// ── THE SHAPE, AND WHY IT IS THIS SHAPE ──────────────────────────
//
//   ui/introMap.js      the province, generated - NO GAME DATA
//   ui/introFlyover.js  the voxel-space renderer that flies over it
//   ui/introSkyMap.js   the province from ABOVE, and the cloud deck -
//                       a second projection, because the first one
//                       cannot look down and no camera path fixes that
//   ui/introCue.js      the measured beat grid, the camera path, the
//                       three splashes - all timing, one file
//   systems/introTheme.js  the track, and THE CLOCK
//   this file           the host: a DOM canvas, three <img>, a loop
//
// The split is not decorative. Everything above this file is PURE and
// pinned directly - a heightmap, a frame buffer, a number per bar - and
// this file is the only part that touches the document, which is the
// part a node test cannot reach. When the intro looks wrong, exactly
// one of those questions is "is the DOM right"; the rest are answered
// by a test.
//
// ── THE SPLASHES ARE ELEMENTS, NOT PIXELS ────────────────────────
//
// The three logos are <img> over the canvas rather than blitted into
// the frame buffer, and they keep their own resolution and their own
// smooth edges. The buffer is deliberately chunky - one art pixel to
// three CSS pixels, posterised and dithered - and pushing a 1200px
// logo with a soft dagger shadow through that would jag the gold and
// cut the shadow to a silhouette, which is the SAME finding U21d
// recorded when our logo first met the renderer's 1-bit cutout. The
// pixel language is the WORLD's; the credits sit over it, as classic's
// own painted title sat over its box art. The composite is also free:
// opacity on an element is the compositor's job, not ours.
//
// ── NEVER TRAPS ──────────────────────────────────────────────────
//
// Every asset here is optional, and each missing one costs exactly
// itself. No theme: the intro runs silent on a wall clock. No logo:
// that splash does not draw and the flight continues. A canvas that
// will not take a 2D context, a browser with no requestAnimationFrame,
// a throw anywhere in the loop: `runIntro` resolves and the menu opens.
// This screen is in front of the game and must never be a door that
// sticks - the law the title screen, the chargen art and every native
// window already follow.
//
// ── SKIP ─────────────────────────────────────────────────────────
//
// Any key, click or tap ends it. Not a corner button, not a hold: the
// player who has seen it forty times presses something and the menu is
// there. THE MUSIC KEEPS PLAYING through the skip, because the track is
// owned by systems/introTheme.js and not by this host - a skip is a
// skip of the pictures, not of the score.
//
// ── onReveal, AND WHY THE HANDOFF NEEDS ONE ──────────────────────
//
// The brief says fade INTO the menu, which means the menu has to be
// mounted UNDERNEATH and revealed - and the moment it is, two screens
// are listening at once. ui/enhancedMenu.js binds keydown on
// globalThis with capture, which fires before anything this host could
// register on document, whatever order they mount in: a player pressing
// a key to skip the intro would activate a menu row they cannot see.
//
// So the reveal is a HANDOFF, fired once when the closing fade starts.
// At that instant this host drops its skip listeners and goes
// pointer-events:none, and the menu - which the caller mounts in the
// callback - owns the input from the first frame it is visible. Before
// the reveal the intro is alone and skippable; after it, the intro is
// a picture fading off the top and the menu is the screen. There is no
// frame in which both are live, which is the only arrangement that is
// not a race.
// ═══════════════════════════════════════════════════════════════════

import { buildIliac } from './introMap.js';
import { prepareMap, drawFlyover, SCALE } from './introFlyover.js';
import { drawSkyMap } from './introSkyMap.js';
import { introState, DURATION, SPLASHES } from './introCue.js';
import { startTheme, themeTime } from '../systems/introTheme.js';

/** Where the splash art lives, keyed to introCue's SPLASHES. */
export const SPLASH_URL = Object.freeze({
  interkarma: 'intro/interkarma.webp',
  nexus: 'intro/nexus.webp',
  title: 'intro/title.webp',
});

/** The widest the buffer is ever allowed to be, in art pixels.
 *
 *  A CAP, NOT A SCALE. `SCALE` alone would give a 4K screen a 1280-wide
 *  buffer and a phone a 380-wide one - four times the work on the
 *  machine that can least afford a dropped frame relative to what it
 *  shows, and two different amounts of chunk for the same picture. The
 *  cap fixes both: past this width the art pixels simply get bigger,
 *  which is the correct thing for a deliberately low-resolution image. */
export const MAX_BUFFER_W = 512;

/** How wide each splash sits, as a fraction of the viewport's short
 *  edge times its own aspect - the enhanced skin's one-scale law
 *  (UI-logical px against the SHORT edge), so a logo is the same size
 *  in portrait and landscape. */
export const SPLASH_WIDTH = Object.freeze({ interkarma: 0.62, nexus: 0.52, title: 0.74 });

/**
 * Run the intro. Resolves when it is over - by its own clock, by a
 * skip, or immediately if it cannot draw at all.
 *
 * `deps` exists for the tests and the probe; nothing in the game passes
 * it. Every member has a real default, so a caller that passes nothing
 * gets the shipping intro.
 */
export async function runIntro({
  doc = globalThis.document,
  raf = globalThis.requestAnimationFrame?.bind(globalThis),
  now = () => performance.now() / 1000,
  theme = startTheme,
  clock = themeTime,
  onReveal = null,
} = {}) {
  if (!doc || !raf) return 'skipped';

  const host = doc.createElement('div');
  host.id = 'intro';
  // z-index 13: ABOVE the enhanced menu's 12, because the menu mounts
  // UNDERNEATH this and the last bar fades to reveal it. A cut to the
  // menu would be a cut; the brief says fade INTO it.
  host.style.cssText =
    'position:fixed;inset:0;z-index:13;background:#000;overflow:hidden;cursor:pointer';

  const canvas = doc.createElement('canvas');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;' +
    // The buffer is smaller than the element by design; NEAREST keeps
    // the art pixels square instead of blurring them back into a
    // photograph, which is the whole look.
    'image-rendering:pixelated;image-rendering:crisp-edges';
  host.append(canvas);

  const g = canvas.getContext?.('2d', { alpha: false });
  if (!g) { host.remove?.(); return 'skipped'; }

  // The splashes, one element each. A missing file leaves a broken <img>
  // that never becomes visible, which is the never-traps behaviour
  // without a single branch: opacity stays where the sheet puts it and
  // there is simply nothing to see.
  const imgs = new Map();
  for (const s of SPLASHES) {
    const el = doc.createElement('img');
    el.src = SPLASH_URL[s.key];
    el.alt = '';
    el.decoding = 'async';
    el.style.cssText =
      'position:absolute;left:50%;top:50%;opacity:0;pointer-events:none;' +
      'transform:translate(-50%,-50%);will-change:opacity,transform';
    imgs.set(s.key, el);
    host.append(el);
  }

  doc.body.append(host);

  // The province, and its pyramid. ~0.6 s of work, done once, while the
  // screen is still black on the opening fade - which is exactly the
  // window the cue sheet opens with and the reason it opens with one.
  let prepared = null;
  try {
    prepared = prepareMap(buildIliac());
  } catch {
    host.remove();
    return 'skipped';
  }

  // The track. Its own module owns it, so it survives this host.
  let playing = false;
  try { ({ playing } = await theme()); } catch { playing = false; }
  const wallStart = now();

  return new Promise((resolve) => {
    let over = false, revealed = false;
    let buf = null, bw = 0, bh = 0;

    // THE HANDOFF. Once, at the start of the closing fade: stop being
    // interactive, and let the caller mount whatever this fades into.
    // Also runs on a skip, so the caller's callback is guaranteed
    // exactly one call on every path out of here.
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      doc.removeEventListener('keydown', onSkip, true);
      host.removeEventListener('pointerdown', onSkip, true);
      host.style.pointerEvents = 'none';
      try { onReveal?.(); } catch (e) { console.warn('[intro] onReveal threw:', e?.message ?? e); }
    };

    const finish = (how) => {
      if (over) return;
      over = true;
      reveal();
      host.remove();
      resolve(how);
    };
    function onSkip(e) {
      // Swallowed: before the reveal this host is the only screen, and
      // a keypress that also reached anything underneath would be the
      // very race the reveal exists to prevent.
      e?.stopPropagation?.();
      e?.preventDefault?.();
      finish('skipped');
    }
    doc.addEventListener('keydown', onSkip, true);
    host.addEventListener('pointerdown', onSkip, true);

    const frame = () => {
      if (over) return;
      try {
        // THE SONG IS THE CLOCK. The wall clock is the fallback for a
        // browser that refused to autoplay, and it runs the same sheet.
        const songT = playing ? clock() : null;
        const t = songT ?? (now() - wallStart);
        const st = introState(t);

        // Size the buffer to the viewport, capped. Re-derived every
        // frame rather than on a resize event: a rotate on a phone
        // fires several of those in different orders and the one that
        // matters is whichever one is true when we draw.
        const vw = host.clientWidth || 1, vh = host.clientHeight || 1;
        const w = Math.max(4, Math.min(MAX_BUFFER_W, Math.ceil(vw / SCALE)));
        const h = Math.max(4, Math.ceil((w * vh) / vw));
        if (w !== bw || h !== bh) {
          bw = w; bh = h;
          canvas.width = w; canvas.height = h;
          buf = g.createImageData(w, h);
        }

        // TWO PROJECTIONS, ONE CANVAS. The flyover cannot look down and
        // the sky map cannot look along; the cut between them happens
        // inside the cloud deck, where the white-out is total and there
        // is nothing on screen to be discontinuous.
        if (st.view === 'map') drawSkyMap(buf, prepared, st.sky, t);
        else drawFlyover(buf, prepared, st.camera, t);
        g.putImageData(buf, 0, 0);

        // The deck itself, over the top. Drawn in the CANVAS rather
        // than as a CSS overlay so it posterises and dithers with
        // everything else - a smooth white wash over a dithered picture
        // announces itself as a different layer, which is exactly what
        // this must not do.
        if (st.whiteout > 0.002) {
          g.save();
          g.globalAlpha = Math.min(1, st.whiteout);
          g.fillStyle = '#e8ecf2';
          g.fillRect(0, 0, bw, bh);
          g.restore();
        }

        // The opening fade up from black and the closing fade to the
        // menu, as one multiply over the whole picture. Done in CSS on
        // the HOST rather than per pixel in the buffer: it is the
        // compositor's job, it costs nothing, and it fades the splashes
        // with the flight instead of leaving them floating over a
        // darkening world.
        host.style.opacity = String(st.open * (1 - st.close));
        if (st.close > 0) reveal();

        for (const s of st.splashes) {
          const el = imgs.get(s.key);
          if (!el) continue;
          el.style.opacity = String(s.opacity);
          // A slow drift so a credit is never a sticker. The title
          // SETTLES - it lands large on the downbeat and eases down to
          // rest, which is the move that makes a cut read as an
          // arrival rather than a pop.
          const w2 = Math.min(vw, vh) * SPLASH_WIDTH[s.key] * (vw > vh ? 1.5 : 1.15);
          el.style.width = `${Math.round(w2)}px`;
          const settle = s.key === 'title'
            ? 1 + 0.06 * Math.max(0, 1 - (st.bar - 11) / 1.2)
            : 1 + 0.015 * Math.sin(st.bar * 0.6);
          el.style.transform = `translate(-50%,-50%) scale(${settle.toFixed(4)})`;
        }

        if (st.done || t >= DURATION) return finish('done');
      } catch (e) {
        // A throw in the loop costs the intro, never the boot.
        console.warn('[intro] stopping early:', e?.message ?? e);
        return finish('skipped');
      }
      raf(frame);
    };
    raf(frame);
  });
}
