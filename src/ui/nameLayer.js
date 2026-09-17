// @ts-check
// NAME1 (2026-09-16, Mac: "Player names clip and cut off the top of the sprite head and additionally grow in size
// the further away + are able to be seen through walls") and
// BUBBLE1 (2026-09-16, Mac: "I want to introduce chat bubbles above the player when they chat"):
// THE NAMES OVER THE OTHERS, AND WHAT THEY SAY - the enhanced skin's own DOM layer.
//
// WHY DOM AND NOT THE BITMAP PASS. Online forces the enhanced lane (OL1, systems/onlineLane.js), so a name over a
// head is an ENHANCED-SKIN surface, and every other enhanced surface wears Pixelify Sans unsmoothed on bone
// (ui/enhancedStyle.js, ui/pixelifyFive.js PIXEL_STACK). A name drawn through the CLASSIC FNT atlas was the one
// thing on that screen still speaking the other skin's face - and the bubbles Mac asked for want a box that wraps
// text, which is a paragraph, which is a thing the 2D pass has no idea how to do. One element per visible peer,
// MOVED each frame and never rebuilt, is the party HUD's own discipline (ui/partyPanel.js: "write only what
// changed"), and it gives the bubble a home for free.
//
// THE LAW IS NOT HERE. Where a name sits, how big it is and whether a wall stands in the way are
// net/remotePlayers.js namePoints' answers (NAME_GAP_PX, nameScaleFor, nameLensScale, sightBlockedBy) - this file
// receives points and wears them. The classic bitmap pass reads the SAME points, so neither face can invent a
// position, a depth law or a lens of its own. What the two faces do NOT share is the pixel they are measured in:
// this one is CSS px (so it takes the viewport term and the player's HUD scale by value, AUDIT NAME1 F3) and the
// bitmap pass is the drawing buffer's, where the host's own hudScale already is that term. One law, two rulers.
//
// THE BUBBLES, in one paragraph. A line a peer says on the WORLD channel stands over their name for BUBBLE_MS and
// fades out; the newest line replaces the one before it; at most one a peer and at most BUBBLE_MAX at once. A
// bubble follows the NAME's rules exactly - it is drawn only for a peer the name pass drew, so out of range, behind
// a wall or off the strip is no bubble either. The hub's own notices (`system`) and my own lines get none, and the
// other channel tabs get none (there is one tab today; the refusal is written so the second one inherits it).
//
// NO BUBBLE OF MY OWN, and that is a decision rather than an omission. I have no body in my own view to hang one
// over, and a bubble at the bottom of my own screen would say my line a SECOND time: ChatLog.peek already draws the
// last CHAT_PEEK lines over the world whenever the panel is closed, mine among them, and two copies of my own words
// in my own view is the only thing on this surface a player could read as a bug.
//
// THE TEXT IS ALREADY CLEAN. net/online.js runs every inbound line through net/wire.js sanitizeChat before it
// reaches onChat, and the relay refuses what that law refuses - so nothing here restates it. The one thing this
// file does to a line is CUT it: a bubble is a glance, not a letter.
//
// Not a DFU member: Daggerfall Unity has no other players and no chat. Ledger A row (ONLINE).
import { PIXELIFY_FIVE_FACE, PIXEL_STACK } from './pixelifyFive.js';   // the enhanced face, with FIX-D's five ahead of it
import { NAME_GAP_PX, namePixelSize, nameViewportScale } from '../net/remotePlayers.js';   // the anchor's gap, and the size law's own two doors (AUDIT NAME1 F3)

export const NAME_STYLE_ID = 'dagger-names-style';

/** The channel a bubble may come from: the World tab (net/chat.js CHAT_TABS). A later tab is a later row there and
 *  says nothing over a head until somebody decides it should. */
export const BUBBLE_TAB = 'world';
/** How long a bubble stands, ms. Mac: "a few seconds". */
export const BUBBLE_MS = 6000;
/** The share of that window the bubble holds full opacity before it fades - ChatLog.peek's own curve (net/chat.js),
 *  at this surface's own window, so a line over a head and the same line in the peek corner go out the same way. */
export const BUBBLE_HOLD = 0.75;
/** The most bubbles standing at once. It is ALSO the size of the store, which is the whole of the bound: one entry
 *  a peer, the oldest dropped when a fifth arrives, so a crowd cannot grow this surface and an id nobody is drawing
 *  cannot squat in it for the session. */
export const BUBBLE_MAX = 4;
/** The most characters a bubble shows. The wire already bounds a line at CHAT_MAX (240); this is the bubble's own,
 *  smaller bound - 240 characters over somebody's head is a wall, not a remark. */
export const BUBBLE_CHARS = 100;
/** What marks a line that was cut. */
export const BUBBLE_ELLIPSIS = '...';

/** A peer's name colour for the DOM, from the picture's OWN answer (net/social.js colorOf -> PARTY_GREEN or null).
 *  The green has one home and this is not a second one: `cssRgba(PARTY_GREEN)` IS PARTY_GREEN_CSS, which a pin
 *  holds - so the party's green survives the move to the DOM without the colour being written down twice. */
export function cssRgba(rgba) {
  if (!Array.isArray(rgba) || rgba.length < 3) return null;
  const hex = (v) => Math.max(0, Math.min(255, Math.round(Number(v) * 255))).toString(16).padStart(2, '0');
  return `#${hex(rgba[0])}${hex(rgba[1])}${hex(rgba[2])}`;
}

/** A line's own opacity at `age` ms: full through BUBBLE_HOLD of the window, then down to nothing at the end. */
export function bubbleAlpha(age, life = BUBBLE_MS) {
  if (!(age >= 0) || age >= life) return 0;
  const hold = life * BUBBLE_HOLD;
  return age < hold ? 1 : Math.max(0, 1 - (age - hold) / (life - hold));
}

/** The text a bubble shows: the line's own, cut at BUBBLE_CHARS with a mark that says it was cut. Nothing is
 *  sanitized here - net/wire.js sanitizeChat already did it at the door (net/online.js) and a second spelling of
 *  that law is how two spellings of a law begin. */
export function bubbleText(text) {
  const s = String(text ?? '');
  if (s.length <= BUBBLE_CHARS) return s;
  return s.slice(0, BUBBLE_CHARS).trimEnd() + BUBBLE_ELLIPSIS;
}

/** AUDIT NAME1 F10: and is there anything LEFT? The wire's own law bounds a line and strips what it strips, but a
 *  line of three spaces is a line with text in it by every test above and an EMPTY BORDERED BOX over somebody's
 *  head by this surface's. The trim decides whether a bubble exists; it is not applied to what is drawn, because
 *  the sheet centres the text and the line is the speaker's. */
export function bubbleSaid(text) {
  const said = bubbleText(text);
  return said.trim() ? said : '';
}

/** Does this line earn a bubble? The World tab, from somebody else, with something to say. */
export function bubbleLineOk(tabId, line) {
  if (tabId !== BUBBLE_TAB || !line || typeof line !== 'object') return false;
  if (line.system || line.mine) return false;
  return typeof line.id === 'string' && !!line.id && typeof line.text === 'string' && !!line.text;
}

/**
 * AUDIT NAME1 F7: WHO GETS THIS FACE. The enhanced SKIN and a document - which is the CHAT panel's own gate
 * (scenes/world.js: `enhanced && typeof document !== 'undefined'`), and it has to be, because this layer and that
 * panel are two halves of one surface: the bubbles are the chat's lines standing over heads.
 *
 * It was gated on the document alone. Online FORCES the enhanced lane (OL1, systems/onlineLane.js) so the two
 * conditions almost always agree - but "almost" is the whole finding: the forcing can fail (MAC-N3 records how),
 * and a classic-skin online page then got the enhanced pixel face over a classic HUD, with no classic name pass
 * under it (the fallback is `if (!nameLayer)`) and no chat panel beside it. A predicate rather than an expression
 * in the host, because a host's `if` is a thing only a regex can read.
 */
export function nameLayerWanted(enhanced, doc = globalThis.document) {
  return !!enhanced && !!doc;
}

/** The layer's sheet. The enhanced face, unsmoothed, on bone - ui/enhancedStyle.js' own tokens where the skin's
 *  sheet is loaded and the same literals where it is not (ui/partyPanel.js' shape). */
export const NAME_CSS = `${PIXELIFY_FIVE_FACE}
/* AUDIT NAME1 F4: z-index 3, which is UNDER THE HUD - not level with it. At 4 this layer TIED with .hud (and with
   every readout the enhanced skin adds beside it at that level, ui/enhancedStyle.js), and a tie is decided by
   document order: this layer is appended after them, so it won. A bubble stood over the mid-screen line and a low
   name over the vitals bars. Everything the player ACTS on is higher still (the chat and the party HUD at 5, the
   friends panel at 6, its confirm bar at 7, the FPS read-out at 9), because a label over somebody's head must
   never cover a conversation. And no pointer: the world takes every click that lands on a name. */
.dfnames { position: fixed; inset: 0; z-index: 3; pointer-events: none; overflow: hidden;
  font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; -moz-osx-font-smoothing: grayscale;
  -webkit-user-select: none; user-select: none; }
/* The anchor is the head point; the stack grows UP from it, so translate(-50%, -100%) puts the label's BOTTOM edge
   on the anchor and the host has already lifted the anchor NAME_GAP_PX clear of the skull. Nothing here can ever
   sit over the head, at any distance - which is the whole of Mac's first sentence. */
.dfname { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center;
  transform: translate(-50%, -100%); }
/* AUDIT NAME1 F12: the fallback is --bone's OWN value (ui/enhancedStyle.js :root, #e9e4d9), the one the friends
   and party panels fall back to. It read #d8cfae, which is a real colour but a different one - .hud's text - so a
   page that reached this layer before the enhanced sheet loaded drew the names in the HUD's ivory and the panels
   beside them in bone. One token, one fallback. */
.dfname-tag { white-space: nowrap; line-height: 1; color: var(--bone, #e9e4d9);
  text-shadow: 0 1px 0 #000, 0 0 3px #000, 0 0 3px #000; }
/* The bubble wraps at a bounded WIDTH (15em of its own size, so it stays a bubble at every distance) and the text
   is cut at a bounded LENGTH before it ever gets here (bubbleText). */
.dfname-bubble { position: relative; max-width: 15em; margin-bottom: .45em; padding: .3em .55em;
  border-radius: .4em; background: rgba(14, 16, 19, .86); border: 1px solid var(--iron, #2b323b);
  color: var(--bone, #e9e4d9); font-size: .92em; line-height: 1.3; text-align: center;
  white-space: pre-wrap; overflow-wrap: break-word; text-shadow: 0 1px 2px #000; }
/* the tail, toward the head: the bubble's own corner turned forty-five degrees under its bottom edge */
.dfname-bubble::after { content: ''; position: absolute; left: 50%; bottom: -4px; width: 7px; height: 7px;
  margin-left: -4px; background: rgba(14, 16, 19, .86);
  border-right: 1px solid var(--iron, #2b323b); border-bottom: 1px solid var(--iron, #2b323b);
  transform: rotate(45deg); }
.dfname-bubble.off { display: none; }
`;

/** The sheet, once (ui/partyPanel.js injectPartyStyle's own shape). */
export function injectNameStyle(doc = document) {
  if (doc.getElementById?.(NAME_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = NAME_STYLE_ID;
  el.textContent = NAME_CSS;
  (doc.head ?? doc.body).append(el);
}

/**
 * The layer. `render({ points, log, covered, colorOf })` once a frame from the host:
 *   - `points` is net/remotePlayers.js namePoints' output ({ id, name, x, y, scale }), in CSS pixels;
 *   - `log` is the net/chat.js ChatLog, read forward from a watermark - a PULL, so the chat wiring is untouched and
 *     a line can only become a bubble by having been written into the log the panel shows;
 *   - `covered` is the host's word for a window over the HUD;
 *   - `colorOf(id)` is net/social.js colorOf - an RGBA array for my party, null for everyone else.
 */
export function createNameLayer({ doc = document, now = () => Date.now() } = {}) {
  injectNameStyle(doc);
  const root = doc.createElement('div');
  root.className = 'dfnames';
  root.setAttribute('aria-hidden', 'true');   // the names are a reading of the world, not a control: the reader has the chat's roster
  doc.body.append(root);
  root.style.display = 'none';

  /** peer id -> the built nodes. THE MAP IS THE IDENTITY: a peer who stays in view keeps their element across every
   *  frame, which is what lets a frame MOVE a name instead of building one. */
  const tags = new Map();
  /** peer id -> { text, at }. Insertion-ordered and capped at BUBBLE_MAX: one bubble a peer, the oldest out. */
  const bubbles = new Map();
  let seq = 0;        // the last ChatLog line this layer has read
  let lastLog = null; // AUDIT NAME1 F8: and WHOSE - the watermark belongs to one log, not to the layer
  let visible = 0;    // how many bubbles the last render actually drew
  let shownRoot = false;
  let alive = true;

  const setText = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  const setCls = (n, c) => { if (n.className !== c) n.className = c; };
  const setStyle = (n, k, v) => { if (n.style[k] !== v) n.style[k] = v; };

  const makeTag = () => {
    const node = doc.createElement('div');
    node.className = 'dfname';
    const bubble = doc.createElement('div');
    bubble.className = 'dfname-bubble off';
    const name = doc.createElement('div');
    name.className = 'dfname-tag';
    node.append(bubble, name);
    root.append(node);
    return { node, bubble, name };
  };

  /** A line over a peer's head. The newest REPLACES the one before it (delete then set, so the entry is also the
   *  newest in the store's order), and a fifth peer pushes the oldest out. */
  const say = (id, text, at = now()) => {
    const body = bubbleSaid(text);   // AUDIT NAME1 F10: whitespace is not a remark
    if (!id || !body || !Number.isFinite(at)) return false;   // AUDIT NAME1 F11: a stamp that is not a number is not a time
    bubbles.delete(id);
    bubbles.set(id, { text: body, at });
    while (bubbles.size > BUBBLE_MAX) bubbles.delete(bubbles.keys().next().value);
    return true;
  };

  /** The log, forward from the watermark. Everything the bubble law refuses is still COUNTED, so a refused line can
   *  never be read a second time. */
  const pump = (log) => {
    // AUDIT NAME1 F8: THE WATERMARK IS THE LOG'S. A ChatLog counts its own lines from 1, so a REPLACED log (a
    // rejoin that builds a new one, a host that swaps it) arrives with line 1 under a watermark of 40 and every
    // line below it is mute for the rest of the session. Keyed to the log's identity, a new log starts a new count.
    if (log !== lastLog) { lastLog = log; seq = 0; }
    const tab = log?.tab?.(BUBBLE_TAB);
    if (!tab) return;
    for (const line of tab.messages ?? []) {
      if (!(line.seq > seq)) continue;
      seq = line.seq;
      // AUDIT NAME1 F6: THE LINE'S OWN STAMP, not this pump's clock. `t` is net/chat.js' local-clock stamp - the
      // one ChatLog.peek fades by, so a line over a head and the same line in the peek corner go out together -
      // and `at` is the relay's, kept only as the fallback for a line that never went through push(). A frame
      // where the pass did not run (a window over the HUD, a mode transition, the death path) used to stamp every
      // line it had missed with the moment it finally read them: minutes-old words, brand new over a head.
      if (bubbleLineOk(BUBBLE_TAB, line)) say(line.id, line.text, Number.isFinite(line.t) ? line.t : line.at);
    }
  };

  return {
    root,
    /** For a host or a pin that wants the layer's state without walking the DOM. */
    tagCount: () => tags.size,
    tagFor: (id) => tags.get(id) ?? null,
    bubbleCount: () => visible,
    /** How many lines the STORE holds - the bound itself (BUBBLE_MAX), which `bubbleCount` cannot show because it
     *  counts what a frame DREW. A line past its window is dropped from here as well as from the screen. */
    storedCount: () => bubbles.size,
    /** Drive a line in directly (the host pulls from the log; this is the same door without one). */
    say,
    /** AUDIT NAME1 F3: `viewport` is the world viewport's HEIGHT in CSS px and `hudScale` the player's own HUD
     *  scale (ui/enhancedHud.js enhancedHudScale). Both are taken by VALUE rather than through
     *  `scale(var(--hud-scale))`, because that variable is set on #enhanced-hud and this layer is a body sibling
     *  of it - the damage numbers' own layer has the same problem and enhancedHud.js:318 solves it the same way,
     *  by writing the number where it is needed. Neither is passed on a probe host, and there the law is exactly
     *  the reference frame's: NAME_BASE_PX * the point's scale. */
    render({ points = [], log = null, covered = false, colorOf = null, viewport = null, hudScale = 1 } = {}) {
      if (!alive) return 0;
      if (log) pump(log);
      const t = now();
      for (const [id, b] of [...bubbles]) if (t - b.at >= BUBBLE_MS) bubbles.delete(id);
      const want = !covered && points.length > 0;
      if (want !== shownRoot) { shownRoot = want; root.style.display = want ? '' : 'none'; }
      if (!want) { visible = 0; return 0; }
      const live = new Set();
      visible = 0;
      const vp = nameViewportScale(viewport);   // AUDIT NAME1 F3: the frame's own height, against the reference
      for (const p of points) {
        if (!p || typeof p.id !== 'string') continue;
        // AUDIT NAME1 F11: a point that is not a number is not a place. `left: NaNpx` is a declaration the browser
        // DROPS, which leaves the element wherever the last frame put it - a name standing over the wrong head,
        // which reads worse than no name at all. The surrounding code guards its numbers (nameScaleFor,
        // projectToScreen's `front`); so does this one, and a peer whose point went bad loses their element with
        // everybody else's the frame it happens.
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        live.add(p.id);
        let tag = tags.get(p.id);
        if (!tag) { tag = makeTag(); tags.set(p.id, tag); }
        setStyle(tag.node, 'left', `${Math.round(p.x)}px`);
        // NAME_GAP_PX is taken HERE and not inside namePoints because it is a screen-pixel clearance and the point
        // is a projected head: the anchor stays the head for anything else that wants it, and the label's bottom
        // edge lands the gap above it.
        setStyle(tag.node, 'top', `${Math.round(p.y - NAME_GAP_PX)}px`);
        setStyle(tag.node, 'fontSize', `${namePixelSize(p.scale ?? 1, vp, hudScale).toFixed(1)}px`);
        setText(tag.name, p.name ?? '');
        setStyle(tag.name, 'color', cssRgba(colorOf?.(p.id)) ?? '');
        const b = bubbles.get(p.id);
        // AUDIT NAME1 F9: a bubble is SHOWN when it can be seen. A negative age - a clock stepped backwards, a
        // relay stamp from the future taken as `at` - is alpha 0, and an invisible box was still being counted by
        // bubbleCount() and still had its text written into the DOM. Alpha decides both.
        const alpha = b ? bubbleAlpha(t - b.at) : 0;
        if (alpha > 0) {
          setText(tag.bubble, b.text);
          setStyle(tag.bubble, 'opacity', alpha.toFixed(2));
          setCls(tag.bubble, 'dfname-bubble');
          visible++;
        } else setCls(tag.bubble, 'dfname-bubble off');
      }
      for (const [id, tag] of tags) { if (live.has(id)) continue; tag.node.remove?.(); tags.delete(id); }
      return visible;
    },
    destroy() {
      if (!alive) return;
      alive = false;
      tags.clear();
      bubbles.clear();
      root.remove?.();
    },
  };
}
