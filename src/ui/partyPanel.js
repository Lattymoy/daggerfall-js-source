// SOC4 (2026-09-16, Mac: "Party system: Upon joining a party, the players name who are in a party together should
// turn green. Theyre character portrait + health/stamins/magicia stats displayed on a new party UI element"):
// THE PARTY HUD - one card per person I am travelling with, top-right of the screen (bottom right and narrower on
// a phone, where the top right is the chat's: AUDIT SOC C6/C7).
//
// PARTY8 (Mac, 2026-09-22: "increase the party limit to 8, and also redesign the party UI so it doesnt clutter the
// screen into a better enhanced design"): THE CARD IS COMPACT NOW. SOC4's card was a 72x80 portrait beside three
// bars with their digits and a place line - a hundred pixels tall, 244 wide - which at three companions was a
// corner and at seven would have been a column down the whole right edge of a 1080p screen. The card stands 40x44 of
// portrait beside the name, three 4-pixel bars stacked under it and ONE small line that says the health in digits
// and the place, at 200 wide and about 54 tall: seven of them are a third of the height, and the eye still reads
// the one thing it came for - whose health bar is short. The stamina and magicka digits are gone from the card
// (the bars say their shape; the digits were the clutter), and the seat count sits in the title, because a party of
// eight is the kind whose count matters.
//
// PARTY8-B (2026-09-23, Mac, shown three renders and asked "how can we really push the fidelity and reduce clutter":
// "B"): QUIET ROWS. The clutter was never the facts, it was the chrome - seven boxed, blurred cards were fourteen
// edges over the world, and every card carried a line of digits and a place whether or not they said anything. A
// row is now a portrait in a 1px frame with a hard shadow, the green name, ONE real health bar (5px) and two
// hairlines (2px, stamina and magicka side by side) under it, with no plate behind any of it - the HUD's own hard
// pixel shadow under the text is what keeps it legible, the way ui/hudVitals.js' bars stand over the world. And
// EACH FACT APPEARS ONLY WHEN IT IS ACTIONABLE: the health digits are drawn only while a seat is under half
// health, in the health's red (a healthy party is names and bars and nothing else); the place line is drawn only
// for a seat that is NOT where I am (a party walking together says nothing under the bars; the one who wandered
// into a dungeon says where - `here` is the host's word for my own place, the last party pose it composed); an
// away seat greys whole and says when it was last seen where its place would go. A hit flashes the health fill
// for a beat, so the eye is pulled to the seat that took it. Every text node is still WRITTEN as before (the
// pins read them) - what moved is which of them the sheet draws.
//
// WHY A SECOND SURFACE AND NOT A ROW IN THE FRIENDS PANEL. A friends list is a thing you OPEN; a party is a thing you
// are IN while you play. The party (eight seats since PARTY8) is the formation you fight in, so the one question it must answer
// without a click is "is my healer about to die" - which is a portrait, three bars and a place, drawn over the world
// and never in the way. That is why this panel is fixed, small, pointer-events: none, and why a card carries the
// health in digits only while it is low (PARTY8-B): a bar says the shape of a vital at a glance and the digits say the rest.
//
// MY OWN CARD IS NOT HERE, and that is deliberate rather than an omission. The HUD already draws my health, my
// fatigue and my magicka (ui/hudVitals.js) and my own face is on my paper doll; a fourth copy of my own vitals in the
// corner would be the only thing on this panel a player could not act on. So the list is `social.others()` - the
// party's members other than me, in SEAT ORDER (the hub's own order, which is the order everyone in the party sees).
//
// THE ART IS THE GAME'S. A portrait is the SAME CIF record the paper doll and the quest-escort faces read
// (systems/races.js raceArt -> FACE##I0.CIF -> CifRciFile.getDFBitmap -> ui/hud.js bitmapToColor32), picked by the
// race, gender and face index the member's own pose carries (net/wire.js validPartyPose bounds all three). Nothing
// here invents a stand-in face: a party member who looks like a Redguard woman with face 4 in her own chargen looks
// like exactly that here. The decode is cached per race|gender|face, because eight seats over a long session are at
// most eight distinct faces and a re-decode per repaint would be work for nothing.
//
// ART LANDS ASYNC (Ledger A's rule, the seams lane): the card is built at once with a neutral plate where the face
// will go, the CIF is fetched off the frame, and the portrait appears the moment it lands. A member whose pose has
// not arrived yet (`p` null - they joined a second ago, or they are offline) gets the same plate and dashes for
// numbers, never a zeroed bar that would read as "dying".
//
// REPAINT ON CHANGE, NOT PER FRAME (ChatLog's law, AUDIT CHAT C8's lesson taken before it shipped). The host calls
// `render` once a frame; this compares `social.version` and does nothing at all when it has not moved. When it has,
// the CARDS ARE KEPT and their parts are written in place - a pose arriving sixty times a minute must move a bar,
// not rebuild a node, or the panel would fight the compositor and flicker. The ONE exception is an away seat's
// "last online", which is a reading of the clock rather than of the picture and so would freeze at "just now" for
// the rest of the session (AUDIT SOC B8): it is re-read on every frame the panel is up and written only where the
// words differ, so a party with everyone present still writes nothing at all.
//
// Not a DFU member: Daggerfall Unity has no parties. Ledger A row (ONLINE).
import { CifRciFile } from '../formats/cifRciFile.js';
import { raceArt, FACES_PER_RACE } from '../systems/races.js';
import { bitmapToColor32 } from '../formats/color32Order.js';   // the same indexed-to-RGBA door every classic screen reads
import { isTouchDevice } from './touch.js';
import { PARTY_GREEN_CSS, lastOnlineText } from '../net/social.js';   // one home for the green - "should turn green"
import { PARTY_MAX } from '../net/wire.js';   // PARTY8: the seat count in the title
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';   // FONT1: the enhanced skin's own face, unsmoothed, with Silkscreen's five

export const PARTY_STYLE_ID = 'dagger-party-style';

/** The leader's mark beside the name - the hub's `party.leader`, the one seat that can promote and remove. */
export const LEADER_MARK = '★';
/** What a vital's digits say before the member's first pose lands: not "0 / 0", which reads as dead. */
export const VITALS_BLANK = '- / -';
/** The plate's mark while there is no portrait - a face-shaped hole, not a fake face. */
export const FACE_BLANK_MARK = '?';
/** The portrait plate, in CSS pixels. A racial head record fits this at 1x and draws at an integer NEAREST scale
 *  (1996 pixels, and they should look it - ui/bitmapCanvas.js' own rule); anything larger is clamped by the sheet's
 *  max-width rather than overflowing the card. PARTY8 halved it from 72x80; PARTY8-B fits it to the record. */
export const FACE_BOX_W = 32;   // PARTY8-B: the widest head record measured in FACE##I0.CIF is 31x32 (tools/partyHudProbe.mjs' note): 1x fits, and the plate is no bigger than the face
export const FACE_BOX_H = 34;

/** The panel's sheet: the enhanced skin's tokens (ui/enhancedStyle.js) where they exist, a fallback where the
 *  skin's sheet is not loaded - the same shape ui/chatPanel.js uses, so the two surfaces agree over the world.
 *
 *  FONT1 (2026-09-16, Mac: "Any enhanced UI or text must be our enhanced version"): this HUD stands over the world
 *  beside the enhanced HUD's own bars, and it was set in `--data` - the MENU's face. It wears the skin's pixel
 *  stack now, unsmoothed, with the HUD's hard shadow under the one line that has no plate behind it. The five's
 *  @font-face rides this sheet too (FIX-D): it is injected on its own, like the other three online sheets. */
export const PARTY_CSS = `
${PIXELIFY_FIVE_FACE}
/* AUDIT SOC C6: 92, NOT 40. The FPS read-out is the other thing in this corner (ui/fpsCounter.js: top 8, z 9) and
   it is FOUR LINES tall with the renderer's counts on - measured at 76px in Chromium, bottom edge 84 - so a HUD at
   40 put its first card's portrait straight through the middle of it. 92 clears the read-out with eight pixels to
   spare; the touch value stays 76, which is the number that clears the touch layer's own top-right buttons. */
.dfparty { position: fixed; right: calc(8px + env(safe-area-inset-right, 0px)); top: calc(92px + env(safe-area-inset-top, 0px));
  width: 200px; max-width: calc(100vw - 16px); z-index: 5; pointer-events: none;
  display: flex; flex-direction: column; gap: 3px;
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9);
  -webkit-user-select: none; user-select: none; }
/* below the touch layer's own top-right row of buttons (ui/touch.js: top 16, 44 tall) */
.dfparty.touch { top: calc(76px + env(safe-area-inset-top, 0px)); }
/* AUDIT SOC C7: A PHONE HAS NO TOP-RIGHT CORNER TO SPARE. At 430x860 with the touch skin the HUD covered most of every
   chat peek line and the open friends panel under it besides. Narrower AND out of that corner: the HUD drops to the
   bottom right, above the touch layer's own jump and sheathe column (ui/touch.js: bottom 16, 48 tall, so 76 clears
   them), where nothing is written and the finger never goes (the HUD takes no pointer). */
@media (max-width: 560px) {
  .dfparty, .dfparty.touch { width: 180px; top: auto; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); }
}
/* AUDIT PARTY8: A PHONE HELD SIDEWAYS is wider than 560 and shorter than the stack - seven rows from top 76 ran to
   438 on a 430-tall screen, over the touch layer's jump and sheathe row (bottom 16, 48 tall). Capped so the bottom
   clears that row by the same 76 the portrait rule keeps; what does not fit is cut, never drawn over the buttons. */
@media (max-height: 560px) and (min-width: 561px) {
  .dfparty.touch { max-height: calc(100dvh - 152px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); overflow: hidden; }
}
.dfparty-title { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; text-align: right;
  color: var(--dim, #8b8578); text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.dfparty-count { margin-left: 6px; letter-spacing: 0; color: var(--bone, #e9e4d9); font-variant-numeric: tabular-nums; }
.dfparty-list { display: flex; flex-direction: column; gap: 3px; }
/* PARTY8-B: QUIET ROWS - no plate behind a card (no border, no fill, no blur: seven boxed cards were fourteen edges
   over the world). A row is a portrait, a name and thin lines under it; the text carries the HUD's hard shadow. */
.dfparty-card { display: flex; gap: 6px; padding: 3px 0; }
/* away: the whole card goes quiet - the portrait too, so a grey face is never mistaken for a live one */
.dfparty-card.away { opacity: .46; filter: grayscale(1); }
.dfparty-face { flex: none; box-sizing: content-box; width: ${FACE_BOX_W}px; height: ${FACE_BOX_H}px; overflow: hidden;   /* AUDIT PARTY8: the sheet's border-box took the 1px border out of the plate and squashed a 31-wide head */
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #232830, #14171b); border: 1px solid var(--iron, #2b323b);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.6); }
.dfparty-facepix { display: none; max-width: 100%; max-height: 100%; image-rendering: pixelated; }
.dfparty-face.has .dfparty-facepix { display: block; }
.dfparty-face.has .dfparty-facemark { display: none; }
.dfparty-facemark { font-size: 13px; font-weight: 600; color: var(--dim, #8b8578); opacity: .45; }
.dfparty-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.dfparty-head { display: flex; align-items: baseline; gap: 4px; min-width: 0; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.dfparty-name { min-width: 0; flex: 0 1 auto; font-weight: 600; font-size: 12px; line-height: 1.2;
  color: ${PARTY_GREEN_CSS}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dfparty-lead { flex: none; font-size: 10px; line-height: 1; color: var(--brass, #c08a3e); }
.dfparty-lead.off { display: none; }
/* the health digits, at the row's right edge: drawn ONLY while the seat is under half health (.low), in the
   health's own red - a healthy party is names and bars and nothing else. The node is written for every pose. */
.dfparty-hp { margin-left: auto; flex: none; font-size: 10px; line-height: 1.2; color: #e2554c; font-variant-numeric: tabular-nums; }
.dfparty-hp.off { display: none; }
.dfparty-hp.blank { color: var(--dim, #8b8578); }   /* AUDIT PARTY8: a seat with no pose yet - dashes, dim */
/* the health is the one real bar; stamina and magicka are two hairlines under it, side by side - their shape, not
   their weight. The tracks are square-cornered and black, the enhanced HUD's own. */
.dfparty-bars { display: flex; flex-direction: column; gap: 3px; }
.dfparty-vital { display: flex; align-items: center; }
.dfparty-track { flex: 1; min-width: 0; height: 5px; overflow: hidden;
  background: rgba(0, 0, 0, .65); box-shadow: 0 0 0 1px rgba(0, 0, 0, .5); }
.dfparty-thin { display: flex; gap: 3px; }
.dfparty-thin .dfparty-vital { flex: 1; min-width: 0; }
.dfparty-thin .dfparty-track { height: 2px; }
.dfparty-fill { height: 100%; width: 0%; }
/* the skin's own hues - the blood red, a moss green, a dusk blue - not the web's primaries */
.dfparty-vital.health .dfparty-fill { background: linear-gradient(180deg, #d9463c, #7d1b15); }
.dfparty-vital.fatigue .dfparty-fill { background: linear-gradient(180deg, #4faa58, #2d6b34); }
.dfparty-vital.magicka .dfparty-fill { background: linear-gradient(180deg, #5d74d8, #33418f); }
/* a hit: the health fill flares for a beat, so the eye is pulled to the seat that took it. Two names for one
   animation - a fresh hit on a fill still flaring takes the other name, which restarts it with no reflow forced. */
@keyframes dfparty-hit { 0% { filter: brightness(2.6); } 100% { filter: brightness(1); } }
@keyframes dfparty-hit2 { 0% { filter: brightness(2.6); } 100% { filter: brightness(1); } }
.dfparty-fill.hit { animation: dfparty-hit .6s ease-out; }
.dfparty-fill.hit2 { animation: dfparty-hit2 .6s ease-out; }
/* the digits beside a bar are kept on the node (a pin reads them) and drawn nowhere: the bar says the shape */
.dfparty-num { display: none; }
/* the place line: drawn only for a seat that is NOT where I am (.off otherwise) - a party walking together says
   nothing under the bars; the one who wandered into a dungeon says where. An away seat says when it was last seen. */
.dfparty-where { font-size: 9px; line-height: 1.2; color: var(--dim, #8b8578); text-shadow: 2px 2px 0 rgba(0,0,0,0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dfparty-where.off { display: none; }
`;

/** The sheet, once (ui/chatPanel.js injectChatStyle's own shape). */
export function injectPartyStyle(doc = document) {
  if (doc.getElementById?.(PARTY_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = PARTY_STYLE_ID;
  el.textContent = PARTY_CSS;
  (doc.head ?? doc.body).append(el);
}

/** The three bars, in the order the HUD draws them (ui/hudVitals.js VITAL_KEYS): the pose's field pairs and the
 *  colour class the sheet paints. "health/stamins/magicia" - health red, stamina green, magicka blue. */
export const PARTY_VITALS = Object.freeze([
  Object.freeze({ key: 'health', now: 'h', max: 'hm', label: 'Health' }),
  Object.freeze({ key: 'fatigue', now: 'f', max: 'fm', label: 'Stamina' }),
  Object.freeze({ key: 'magicka', now: 'm', max: 'mm', label: 'Magicka' }),
]);

/** The portrait cache's key - a face is a race, a gender and an index, and nothing else. */
export const faceKeyOf = (p) => `${p?.race ?? 'Breton'}|${p?.gender === 'female' ? 'female' : 'male'}|${Math.max(0, Math.min(FACES_PER_RACE - 1, (p?.face ?? 0) | 0))}`;

/** Where a member is, in words: the place their pose names, plus what KIND of place it is when they are not out in
 *  the open (net/wire.js validPartyPose `in`: 1 a dungeon, 2 a building's inside). A pose with no place name at all
 *  is somebody out between towns, which is the wilderness and should say so rather than say nothing. */
export function placeText(p) {
  if (!p) return '';
  const loc = String(p.loc ?? '').trim();
  const kind = p.in === 1 ? 'dungeon' : p.in === 2 ? 'inside' : '';
  if (loc && kind) return `${loc} - ${kind}`;
  return loc || kind || 'the wilderness';
}

/** A bar's fill, 0..100, rounded to whole percent - a bar is read, not measured, and a whole percent means a pose
 *  that moved a vital by one point writes no style at all. */
export function barPercent(v, max) {
  const m = Number(max), x = Number(v);
  if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round((x / m) * 100)));
}

/** PARTY8-B: the health digits are drawn only under this fill - "is my healer about to die" is a question about
 *  the bottom half of the bar, and a number beside a full one is clutter. */
export const HP_DIGITS_BELOW = 50;
/** PARTY8-B: is this seat where I am? AUDIT PARTY8 (2026-09-23): two places are the same place when their
 *  COORDINATES are - the map pixel, the kind (`in`) and, inside a building, the building key - the rule
 *  scenes/world.js's samePlace keeps for the party rest. This compared placeText's WORDS, and two wilderness
 *  pixels 800 apart both read "the wilderness", two shops in one town both "Daggerfall - inside", two nameless
 *  dungeons both "dungeon": a healer three regions away drew no line, which says "with me". `here` is the pose
 *  the host last composed; none yet means nothing can be said to be with me, and the line is drawn. */
export const withMe = (p, here) => !!p && !!here
  && p.px === here.px && p.py === here.py && (p.in ?? 0) === (here.in ?? 0)
  && ((p.in ?? 0) !== 2 || (p.bk ?? null) === (here.bk ?? null));
/** The one string a frame compares to know whether my place moved (paintLive) - the coordinates withMe reads. */
export const hereKeyOf = (h) => (h ? `${h.px},${h.py},${h.in ?? 0},${h.bk ?? ''}` : '');

/** The digits beside a bar: "50 / 60". */
export function vitalsText(v, max) {
  const x = Number(v), m = Number(max);
  if (!Number.isFinite(x) || !Number.isFinite(m)) return VITALS_BLANK;
  return `${Math.max(0, Math.round(x))} / ${Math.max(0, Math.round(m))}`;
}

/**
 * THE REAL PORTRAIT PATH, as a seam. Hands back `(pose) => Promise<{width, height, colors}|null>` - the same
 * indexed-to-RGBA shape ui/hud.js bitmapToColor32 returns, which is what a canvas wants. The CIF files are held per
 * NAME (a race's two genders are two files, and every face in one file shares the load), exactly as
 * ui/hudEscortFaces.js holds them.
 *
 * It is a seam rather than a hard call so the panel can be driven with no WebGL, no data files and no browser: a
 * test injects `faceLoader` and the bitmap-to-ImageData step is the only part left to prove (test/soc4_partyhud).
 */
export function createFaceLoader({ fetchBytes, palette } = {}) {
  const files = new Map();   // name -> Promise<CifRciFile>
  const load = (name) => {
    let p = files.get(name);
    if (!p) {
      p = (async () => { const cif = new CifRciFile(); cif.load(await fetchBytes(name), name, palette); return cif; })();
      files.set(name, p);
    }
    return p;
  };
  return async (pose) => {
    if (!fetchBytes || !palette) return null;
    const art = raceArt(pose?.race ?? 'Breton', pose?.gender === 'female' ? 'female' : 'male');
    const record = Math.max(0, Math.min(FACES_PER_RACE - 1, (pose?.face ?? 0) | 0));
    const cif = await load(art.heads);
    const bmp = cif.getDFBitmap(record, 0);
    return bmp ? bitmapToColor32(bmp, palette) : null;
  };
}

/**
 * The party HUD over `social` (net/social.js SocialState).
 *
 * `art` is the host's data pair - `{ fetchBytes, palette }`, the same two ui/hudEscortFaces.js is mounted with in
 * scenes/world.js - and is only read to build the default `faceLoader`; hand `faceLoader` instead and no art is
 * touched. `doc` and `touch` are handed in so the panel runs headless.
 *
 * The returned panel: `render({ covered })` once a frame from the host, `setHidden(covered)` for the same word said
 * on its own, and `destroy()`.
 */
export function createPartyPanel({ social, doc = document, art = null, faceLoader = null, touch = isTouchDevice(), here = null } = {}) {
  injectPartyStyle(doc);
  // PARTY8-B: my own place, as the host last composed it (scenes/world.js partyFrame's pose) - read, never composed
  // here (AUDIT SOC B18: composing a pose reads the travel pixel and the location index, and this runs per frame)
  const herePose = () => here?.() ?? null;
  const hereKey = () => hereKeyOf(herePose());
  const loader = faceLoader ?? createFaceLoader(art ?? {});
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const setText = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  const setCls = (n, c) => { if (n.className !== c) n.className = c; };
  const setWidth = (n, w) => { if (n.style.width !== w) n.style.width = w; };

  const root = el('div', `dfparty${touch ? ' touch' : ''}`);
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Party');
  const title = el('div', 'dfparty-title', 'Party');
  const count = el('span', 'dfparty-count', '');   // PARTY8: the seats filled, of PARTY_MAX
  title.append(count);
  const list = el('div', 'dfparty-list');
  root.append(title, list);
  doc.body.append(root);
  root.style.display = 'none';   // nothing is drawn before the first paint says there is a party to draw

  /** acct -> the card's nodes. The MAP IS THE IDENTITY: a member who stays in the party keeps their node across
   *  every repaint, which is what lets a pose move a bar in place. */
  const cards = new Map();
  const faces = new Map();     // race|gender|face -> the decoded image, or null when the art could not be read
  const pending = new Map();   // the same key -> the load in flight, so two seats with one face load it once
  let painted = -1;            // the `social.version` the cards were written from
  let paintedPose = -1;        // AUDIT PARTY8: ...and the `social.poseVersion` - a pose alone moves this one, never the version
  let hereWas = '';            // PARTY8-B: my place's words at the last pass, so the place lines follow ME as well as them
  let covered = false;         // the host's word: a window over the HUD
  let showing = false;         // is there a party with somebody else in it
  let alive = true;
  let warned = false;

  const applyVisible = () => {
    const want = (!covered && showing) ? '' : 'none';
    if (root.style.display !== want) root.style.display = want;
  };
  const setCovered = (value) => {
    const v = !!value;
    if (v === covered) return;
    covered = v;
    applyVisible();
  };

  const drawFace = (card, key, img) => {
    if (card.drawn === key || !img?.width || !img?.height) return;
    // An image whose bytes do not match its own size is not drawn at all: the plate stands, which costs the
    // portrait, never the frame (Ledger A's rule - a missing record costs the picture, not the session).
    if (img.colors?.byteLength !== img.width * img.height * 4) return;
    const ctx = card.pix.getContext?.('2d');
    if (!ctx?.createImageData || !ctx.putImageData) return;   // no 2D context (a stub canvas): the plate stands
    card.pix.width = img.width;
    card.pix.height = img.height;
    // AN INTEGER SCALE OR NONE. The backing store is the record's own pixels; the CSS size is a whole multiple of
    // it, so the plate shows NEAREST-scaled 1996 art rather than a smeared bilinear one.
    const s = Math.max(1, Math.min(Math.floor(FACE_BOX_W / img.width), Math.floor(FACE_BOX_H / img.height)));
    card.pix.style.width = `${img.width * s}px`;
    card.pix.style.height = `${img.height * s}px`;
    const px = ctx.createImageData(img.width, img.height);
    px.data.set(new Uint8ClampedArray(img.colors.buffer));
    ctx.putImageData(px, 0, 0);
    card.drawn = key;
    setCls(card.facebox, 'dfparty-face has');
  };

  const wantFace = (card, key, pose) => {
    if (faces.has(key)) { const img = faces.get(key); if (img) drawFace(card, key, img); return; }
    let job = pending.get(key);
    if (!job) {
      job = Promise.resolve().then(() => loader(pose)).then(
        (img) => { pending.delete(key); faces.set(key, img ?? null); return img ?? null; },
        (e) => {
          pending.delete(key); faces.set(key, null);
          if (!warned) { warned = true; console.warn('[party] portrait art unavailable:', e?.message ?? e); }
          return null;
        });
      pending.set(key, job);
    }
    job.then((img) => { if (alive && img && card.faceKey === key) drawFace(card, key, img); });
  };

  const makeCard = () => {
    const node = el('div', 'dfparty-card');
    const facebox = el('div', 'dfparty-face');
    const pix = doc.createElement('canvas');
    pix.className = 'dfparty-facepix';
    const facemark = el('span', 'dfparty-facemark', FACE_BLANK_MARK);
    facebox.append(pix, facemark);
    const body = el('div', 'dfparty-body');
    const head = el('div', 'dfparty-head');
    const name = el('span', 'dfparty-name');
    const lead = el('span', 'dfparty-lead off', LEADER_MARK);
    lead.setAttribute('title', 'Party leader');
    lead.setAttribute('aria-label', 'Party leader');
    const hp = el('span', 'dfparty-hp off', VITALS_BLANK);   // PARTY8: the one number the card says - the health; PARTY8-B: drawn only while it is low
    head.append(name, lead, hp);
    const where = el('div', 'dfparty-where off');   // PARTY8-B: under the bars, drawn only for a seat that is not with me
    const bars = el('div', 'dfparty-bars');
    const vitals = PARTY_VITALS.map((v) => {
      const row = el('div', `dfparty-vital ${v.key}`);
      const track = el('div', 'dfparty-track');
      const fill = el('div', 'dfparty-fill');
      const num = el('span', 'dfparty-num', VITALS_BLANK);
      track.append(fill);
      row.append(track, num);
      // AUDIT SOC C21: a bare `aria-label` on a plain div is dropped by assistive technology - it needs a role to
      // hang on. `group` names the bar AND leaves its digits readable, which `img` would have hidden.
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', v.label);
      return { row, fill, num };
    });
    // PARTY8-B: the health row stands alone; stamina and magicka share one hairline row
    const thin = el('div', 'dfparty-thin');
    thin.append(vitals[1].row, vitals[2].row);
    bars.append(vitals[0].row, thin);
    body.append(head, bars, where);
    node.append(facebox, body);
    // AUDIT PARTY8: the flare's class comes OFF when the animation ends - a class left on the fill replays it whenever the
    // root comes back from display:none (a window closing) or the row is re-inserted (a seat joining): every seat that
    // took any hit this session flashed at once
    for (const slot of vitals) slot.fill.addEventListener?.('animationend', () => setCls(slot.fill, 'dfparty-fill'));
    return { node, facebox, pix, name, lead, where, hp, vitals, faceKey: null, drawn: null, away: null, hpPct: null, hpH: null, hitFlip: false };
  };

  /** One member onto one card - written PART BY PART, and only where the part differs. */
  const paintCard = (card, m, isLeader) => {
    const p = m.p ?? null;
    setCls(card.node, `dfparty-card${m.online ? '' : ' away'}`);
    const nm = m.name ?? '';
    // AUDIT SOC C22: the name ellipsizes at the card's width (a 24-character name is cut mid-word and there is no
    // second place in the HUD that says it), so the full one rides on the node as a title - written with the name.
    if (card.name.textContent !== nm) { setText(card.name, nm); card.name.setAttribute('title', nm); }
    setCls(card.lead, `dfparty-lead${isLeader ? '' : ' off'}`);
    // Online: where they are. Away: when they were last seen, in the picture's own words (the relay's clock).
    card.away = m.online ? null : { seen: m.seen };   // AUDIT SOC B8: the live pass re-reads this one sentence
    setText(card.where, m.online ? placeText(p) : lastOnlineText(false, m.seen, social.now()));
    // PARTY8-B: the place line is drawn for an away seat (its "last online") and for a live seat somewhere else
    setCls(card.where, `dfparty-where${!m.online || (p && !withMe(p, herePose())) ? '' : ' off'}`);
    for (let i = 0; i < PARTY_VITALS.length; i++) {
      const v = PARTY_VITALS[i], slot = card.vitals[i];
      setWidth(slot.fill, `${p ? barPercent(p[v.now], p[v.max]) : 0}%`);
      setText(slot.num, p ? vitalsText(p[v.now], p[v.max]) : VITALS_BLANK);
    }
    setText(card.hp, card.vitals[0].num.textContent);   // PARTY8: the health digits, written for every pose
    // PARTY8-B: ...and DRAWN only while the health is low; a DROP flares the fill (a heal, a first pose and an
    // away seat's stale pose do not - the flare says "took a hit", nothing else)
    const pct = p ? barPercent(p.h, p.hm) : null;
    // AUDIT PARTY8: a seat with no pose yet shows its dashes (the header's own promise), dimmed - never a zeroed bar
    // that reads as dying and nothing beside it to say why
    setCls(card.hp, `dfparty-hp${pct == null && m.online ? ' blank' : pct != null && pct < HP_DIGITS_BELOW && m.online ? '' : ' off'}`);
    // AUDIT PARTY8: the flare is keyed on the HEALTH, not its percent - a max that rose dropped the percent with no
    // wound and flared, and a one-point hit on a large pool rounded to the same percent and did not
    const h = p && Number.isFinite(Number(p.h)) ? Number(p.h) : null;
    if (h != null && card.hpH != null && h < card.hpH && m.online) {
      card.hitFlip = !card.hitFlip;
      setCls(card.vitals[0].fill, `dfparty-fill ${card.hitFlip ? 'hit' : 'hit2'}`);
    }
    card.hpH = h;
    card.hpPct = pct;
    const key = p ? faceKeyOf(p) : null;
    if (key !== card.faceKey) {
      card.faceKey = key;
      card.drawn = null;
      setCls(card.facebox, 'dfparty-face');   // back to the plate while the new face is fetched
      if (key) wantFace(card, key, p);
    } else if (key && !card.drawn && faces.get(key)) {
      // The art is in hand but this card is not wearing it yet - it landed for another seat while this one was
      // showing a different face. Drawn from the cache, never fetched again, and NEVER re-subscribed to a load in
      // flight: a repaint a frame would otherwise hang a handler a frame off the same promise.
      drawFace(card, key, faces.get(key));
    }
  };

  /** AUDIT SOC B8: the one sentence on this panel that goes stale with NOTHING in the picture changing - an away
   *  seat's "Last online 5 min ago", which is a reading of the clock. Re-read every frame the panel is up and
   *  WRITTEN only where the words differ, so a party with everyone present still costs nothing at all (the pins
   *  count the writes) and a seat that dropped does not sit at "just now" for the rest of the session. */
  const paintLive = () => {
    // PARTY8-B: the place lines follow MY place too - I walk into a dungeon and the party outside is now
    // "somewhere else". One string compare a frame; the classes are re-read only when my words moved, and
    // written only where they differ (a seat whose line was already right costs nothing).
    const hk = hereKey();
    if (hk !== hereWas) {
      hereWas = hk;
      const hp = herePose();
      for (const [acct, card] of cards) {
        if (card.away) continue;
        const p = social.party?.members?.find((x) => x.acct === acct)?.p ?? null;
        setCls(card.where, `dfparty-where${p && !withMe(p, hp) ? '' : ' off'}`);
      }
    }
    for (const card of cards.values()) {
      if (!card.away) continue;
      setText(card.where, lastOnlineText(false, card.away.seen, social.now()));
    }
  };

  const paint = () => {
    hereWas = hereKey();   // PARTY8-B: paintCard reads my place as it writes each line; the live pass starts from there
    const rows = social?.others?.() ?? [];
    const leader = social?.party?.leader ?? null;
    showing = rows.length > 0;
    setText(count, `${(social?.party?.members?.length ?? rows.length + 1)}/${PARTY_MAX}`);   // PARTY8: the seats filled, me included
    for (const [acct, card] of cards) if (!rows.some((m) => m.acct === acct)) { card.node.remove?.(); cards.delete(acct); }
    const order = [];
    for (const m of rows) {
      let card = cards.get(m.acct);
      if (!card) { card = makeCard(); cards.set(m.acct, card); }
      paintCard(card, m, m.acct === leader);
      order.push(card.node);
    }
    // The seats' order is the hub's; re-parent only when it actually moved, so a pose writes no structure.
    const same = list.children.length === order.length && order.every((n, i) => list.children[i] === n);
    if (!same) list.replaceChildren(...order);
    applyVisible();
  };

  return {
    /** The tests' (and a host's) window into the built DOM. */
    root,
    list,
    /** The host's word: a window covers the HUD, so it covers this too (ui/chatPanel.js render's `covered`). */
    setHidden: setCovered,
    /**
     * Once a frame from the host. `covered` is the host's per-frame word and is taken every frame; the CARDS are
     * written only when `social.version` moved, which is the whole of the repaint budget: a party that is doing
     * nothing costs one integer compare a frame.
     */
    render({ covered: cover = false } = {}) {
      if (!alive) return;
      setCovered(cover);
      // ui/chatPanel.js render's own door: a panel nobody can see is not painted, and the version it did not paint
      // stays owed - so the frame the window closes draws everything that arrived while it was up.
      if (covered) return;
      if (!social) return;
      if (social.version === painted && (social.poseVersion ?? 0) === paintedPose) { paintLive(); return; }   // AUDIT SOC B8: the clock moves where the version does not
      painted = social.version; paintedPose = social.poseVersion ?? 0;
      paint();
    },
    /** What the panel currently draws, for a host or a pin that wants it without walking the DOM. */
    cardCount: () => cards.size,
    cardFor: (acct) => cards.get(acct) ?? null,
    destroy() {
      if (!alive) return;
      alive = false;
      cards.clear();
      root.remove?.();
    },
  };
}
