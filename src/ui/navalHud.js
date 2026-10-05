// @ts-check
// NAV-F (2026-09-28, Mac: "All UI elements should follow enhanced plus UI ... extremely detailed, authentic and easy to
// use") - THE HELM'S READOUT: what a captain needs at a glance while the guns are served, in the stone-and-brass kit.
// A READOUT, NOT A WINDOW (the gate bar's law, ui/gateBossBar.js): no overlay, no pause, no keys of its own - one node
// made on the first word and UPDATED, NOT REBUILT, hidden with the HUD and under every window.
//
// FOUR PARTS, placed where Black Flag's stand and where the port's own HUD leaves room:
//   the SHIP PLATE (bottom right)  your ship: her name, her hull, sails and crew as the vitals' banded bars (the Plus
//                                  sheet's own tones - VITALS_CSS - the hull in health's red, the canvas in bone, the
//                                  crew in fatigue's green), a fire and a brace chip, the crown's waters and your
//                                  notoriety in them as four anchors, and THE BATTERY ROSE: bow over stern, port and
//                                  starboard either side - each battery a chip with its guns, filling as it reloads,
//                                  lit gold where the look lays it and brass-edged when it is loaded
//   the AIM (under the crosshair)  while the attack is held: the battery, the range the guns are laid for and their
//                                  longest, and ON TARGET in red when the volley's zone lies on a ship
//   the TARGET CARD (under the     the ship the look is on: her name, her class and captain, how far, her hull and
//   compass, the boss bar's place) sails, whether she is hostile, and her state - striking her colours, going down,
//                                  taken - and when she can be boarded, the key that boards her
//   the HINT (the plate's foot)    the keys, in the registry's own names (the host hands them)
//   the WARNING (over the          AUDIT NAV1 (the guns): a ship's battery run out and bearing on you - "BROADSIDE" and
//   crosshair)                     the brace's key, pulsing - the readout's half of the run-out's tell (the host's glint
//                                  along her ports and the trucks' rumble are the rest)
//   the TALLY (under the aim)      AUDIT NAV1: your last volley's count once its last ball is down - how many struck,
//                                  how many below her waterline, how many through her rigging
// Every part's words are its model's (scenes/navalHost.js hudModel); `navalHudText` is pure, and the pins read it.
//
// THE DRESS. The plate and the card play the kit's `panel` role and the plunder window's presses its `button`,
// `primary` and `warn` (ui/enhancedFrame.js FRAME_ROLES) - on Enhanced Plus the kit is already on the page; on the
// classic skin this module lays the kit's rules cut to its own selectors (the Sigil Broker's own answer, AUDIT SET
// U1), so a captain reads the same readout whatever skin they play. The bars are the vitals' own banded paint with
// brass clasps; every word is the pixel face with the HUD's hard outline.

import { FRAME_TONES, frameCss, scopeRules } from './enhancedFrame.js';
import { PIXEL_FONT_CSS, PIXELIFY_FIVE_FACE } from './pixelifyFive.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { stepGhost, chunkFrame } from './barLoss.js';   // AUDIT NAV1 (the presentation): her hull bar's loss, the foe bar's law
import { injectEnhancedFonts } from './enhancedStyle.js';   // AUDIT NAV1 (the presentation): the kit's face on the classic skin too
import { READY_FLASH_S } from '../systems/naval/navalGunnery.js';   // AUDIT NAV1 (the presentation): a battery's flash, the host's word
import { PARTY_GREEN_CSS } from '../net/social.js';   // SHIPMATES: the crew's bars in the party's one green
import { spellIconPicture } from './enhancedArt.js';   // COMPANION-KIT: a companion's effects' icons over his bar - AUDIT WK-U8: fitted to their tiles
import { showFitted } from './textureCanvas.js';   // AUDIT WK-U8: a fitted picture into its <img>, as every fitted slot puts one
import { clampDpr, screenDpr } from './iconFit.js';   // AUDIT WK-U8: the tiles' device pixels - the screen's, times the HUD's scale the bar rides
import { partyFxKey, partyFxAbbrev } from '../net/partyBuffs.js';   // COMPANION-KIT: the party card's own effect row's key and words

export const NAVAL_HUD_STYLE_ID = 'dagger-naval-hud-style';
export const NAVAL_KIT_STYLE_ID = 'dagger-naval-kit-style';
/** Where the card stands: under the compass by the house law (the journey bar's PLUS8, the helm panel's CSA-L) - the
 *  compass's foot (.hud-top at 18px, the strip 26px and its 2px rule, all times the HUD scale) and a gap - a step lower
 *  while the foe's bar is up under the compass (its blade taller still, NAVAL_CARD_TOP_FOE / _BLADE). Under the helm
 *  panel when it stands (THE MERGE with CSA-L): its bar is as tall as its buttons wrap, so it is measured -
 *  drawNavalHud's `under` - and the card stands NAVAL_CARD_GAP below its foot. And how wide the plate is. */
export const NAVAL_FOE_STEP = 46;
export const NAVAL_BLADE_STEP = 76;
export const NAVAL_CARD_TOP = 'calc(18px + 28px * var(--hud-scale, 1) + 12px)';
export const NAVAL_CARD_TOP_FOE = `calc(18px + 28px * var(--hud-scale, 1) + 12px + ${NAVAL_FOE_STEP}px * var(--hud-scale, 1))`;
export const NAVAL_CARD_TOP_BLADE = `calc(18px + 28px * var(--hud-scale, 1) + 12px + ${NAVAL_BLADE_STEP}px * var(--hud-scale, 1))`;
/** AUDIT NAV1 (the presentation): the sheet's law above in px - where the card's column starts with no helm panel over
 *  it (`foe` the foe bar's step, 0 without one). */
export const cardTopPx = (scale, foe = 0) => 18 + 28 * scale + 12 + foe * scale;
export const NAVAL_CARD_GAP = 8;
export const NAVAL_PLATE_W = 272;
/** On a finger's screen the plate stands over the touch corner's presses - 16px up and 48px tall (ui/touch.js
 *  layoutCorner) - and a gap, never on them. */
export const NAVAL_PLATE_TOUCH_BOTTOM = 16 + 48 + 12;
/** AUDIT NAV1 (the helm): a finger's BRACE, held to brace (the touch table's three slots hold no Crouch by default, and
 *  the hint said "Crouch: brace"): the platforms' 48 px target. AUDIT NAV1 (the presentation): its own press beside the
 *  plate's foot, NAVAL_BRACE_W wide, at no scale - under the rose it shrank with her (23 px at a phone's half scale). */
export const NAVAL_BRACE_H = 48;
export const NAVAL_BRACE_W = 96;
/** AUDIT NAV1 (the presentation): HER HULL BAR'S LOSS, read as the foe bar reads it (ui/barLoss.js) - the pale strip
 *  where it WAS, and a piece breaking off for a bite of CARD_CHUNK_MIN_LOSS percent or more in one draw, the card's
 *  frame flashing CARD_HIT_S with it (her bar had only slid, for 160 ms). A battery coming ready flashes for the
 *  gunnery's READY_FLASH_S. */
export const CARD_CHUNK_MIN_LOSS = 1;
export const CARD_HIT_S = 0.24;
/** AUDIT NAV1 (the presentation, #14): a ship's tag - its hull bar's width, and its fade with her distance: whole to
 *  TAG_FADE_FROM metres, TAG_FADE_TO of it at the tags' reach (the host's NAVAL_TAG_RANGE, the world's to hand). */
export const NAVAL_TAG_BAR_W = 44;
/** SHIPMATES (2026-09-29, Mac: "Ally crew member's should have green health bars above their head"): the player's own
 *  crew's health over their heads (drawCrewBars) - the party's green (net/social.js PARTY_GREEN_CSS), a bar a crewman,
 *  whole to CREW_FADE_FROM metres, TAG_FADE_TO of it at CREW_BAR_RANGE (the tags' own fade over the crew's reach - the
 *  ships' starts at 150 m, past every bar). */
export const CREW_BAR_W = 30;
/** COMPANION-KIT: a companion's bar is wider (px), and its effects row holds this many tiles at the most. AUDIT WK-U8:
 *  each tile the spell icon's own 16px (the party card's, ui/partyPanel.js .dfparty-fxe), its picture fitted to it. */
export const MATE_BAR_W = 52;
export const MATE_FX_MAX = 6;
export const MATE_FX_BOX = 16;
export const CREW_GREEN = PARTY_GREEN_CSS;
export const CREW_BAR_RANGE = 45;
export const CREW_FADE_FROM = 15;
/** LIVING CREW (2026-09-29, Mac: "talk with each other, blurb, sing chantys"): the lines over the crew's heads
 *  (drawCrewLines) - whole to CREW_SAY_FADE_FROM metres, TAG_FADE_TO of it at CREW_SAY_RANGE, the CREW_SAY_MAX nearest,
 *  each no wider than CREW_SAY_W - a word, a talk's line, a chanty's verse (the brass of the song) or a shout. */
export const CREW_SAY_RANGE = 32;
export const CREW_SAY_FADE_FROM = 12;
export const CREW_SAY_MAX = 6;
export const CREW_SAY_W = 190;
/** FIELD BUGS 2026-10-02 CREW-SAY (Mac: "your crew mates speaking sometimes seems like gibberish"): THE WORDS NEVER OVER
 *  EACH OTHER. Every bubble stood on its own head with nothing between them, at 0.62 of an opaque ground, the farther
 *  painted OVER the nearer: the chorus - every hand at once, each copy behind its own name, so each wrapped at its own
 *  words - stood up to six deep; a talk's two lines stood side by side over two hands side by side; and a bubble's foot,
 *  6 px over the head point a hand's bar stands on, covered a mate's name and health over his bar. Read through each
 *  other, they read as gibberish. `layoutCrewLines` now lays them: a line said by two or more at once once, over the
 *  nearest of them and by no name (it is theirs together); each foot CREW_SAY_LIFT px over the head, clear of the bar and
 *  the name over it; each farther bubble lifted over every nearer one it would cover, CREW_SAY_GAP apart; the nearest
 *  drawn over the rest. A bubble's box is read off its words (`crewSayBox`: the 11px face's widest-case advance, its
 *  lines at the width it wraps to) - no page layout read in a frame. */
export const CREW_SAY_LIFT = 26;   // a mate's bar (5) + its gap (2) + his name (10, its outline 2) + the bubble's tail (5) + 2
export const CREW_SAY_GAP = 3;
export const CREW_SAY_CHAR_W = 6.2;
export const CREW_SAY_LINE_H = 11 * 1.3;
export const CREW_SAY_PAD_W = 14, CREW_SAY_PAD_H = 5, CREW_SAY_RING = 1;   // the sheet's padding (2px 7px 3px) and ring (0 0 0 1px)
const CREW_SAY_WRAP_SLACK = 0.85;
/** A bubble's box in CSS px at the HUD's `scale`, off its words: wider than it can be, as many lines as it can need -
 *  its words to the sheet's max-width (a content box's: the padding and the ring stand outside it), its padding, its
 *  ring. */
export function crewSayBox(text, scale = 1) {
  const run = String(text ?? '').length * CREW_SAY_CHAR_W;
  const lines = Math.max(1, Math.ceil(run / (CREW_SAY_W * CREW_SAY_WRAP_SLACK)));
  return { w: (Math.min(CREW_SAY_W, run) + CREW_SAY_PAD_W + 2 * CREW_SAY_RING) * scale, h: (lines * CREW_SAY_LINE_H + CREW_SAY_PAD_H + 2 * CREW_SAY_RING) * scale };
}
/** FIELD BUGS 2026-10-02b CREW-SAY's audit: how fast a bubble's lift comes DOWN to its place (CSS px a second at the
 *  HUD's scale) once a line under it ends - a rise is at once, so no two ever meet. */
export const CREW_SAY_EASE = 160;
/** A memory for `layoutCrewLines` across frames: each bubble's first frame and the lift it is drawn at. */
export const crewSayMemory = () => ({ seq: 0, bubbles: new Map() });
/**
 * The lines laid out: `points` `[{ x, y, text, name?, who?, kind, distance }]` (each head's screen point; `name` a
 * hand's own, said before his line; `who` the speaker, one key a hand). Answers the CREW_SAY_MAX nearest lines to draw,
 * nearest first, each `{ x, y, text, kind, distance, lift }` - `text` with its speaker's name when he says it alone,
 * `lift` the px it stands over its own place.
 * FIELD BUGS 2026-10-02b CREW-SAY's audit (Mac: "Audit this"):
 *   - only a line SUNG or SHOUTED by several at once is laid once (the chorus, a battle's cry) - two hands' talk is each
 *     his own, by his name, though the words are the same (two pairs at one old yarn stood as one bubble, by no name);
 *   - with `memory` (crewSayMemory) a stack stands in the order its lines were first said, the nearest first among
 *     lines said in one frame - so the eye's drift never turns a stack over (re-ordered by distance every frame, its
 *     bubbles swapped places, up to 247 px in a frame); a lift comes down at CREW_SAY_EASE px a second (`dt`), and up
 *     at once;
 *   - a lifted bubble whose top would stand over `top` (the screen's top) is not drawn - a stack of six at scale 2 on
 *     a 540-line screen stood off it.
 */
export function layoutCrewLines(points, { scale = 1, memory = null, dt = 0, top = -Infinity } = {}) {
  const said = new Map();
  for (const p of [...(points ?? [])].filter(Boolean).sort((a, b) => a.distance - b.distance)) {
    const together = p.kind === 'sing' || p.kind === 'shout';
    const key = together ? `${p.kind}|${p.text}` : `${p.who ?? p.name ?? ''}|${p.text}`;
    const g = said.get(key);
    if (g) g.n++; else said.set(key, { key, p, n: 1, at: said.size });   // nearest first: a chorus stands over its nearest singer
  }
  const chosen = [...said.values()].slice(0, CREW_SAY_MAX);
  for (const g of chosen) g.born = memory?.bubbles.get(g.key)?.born ?? (memory ? ++memory.seq : g.at);   // a line's place in its stack: when it was first laid, the nearest first of a frame's
  const out = [], placed = [];
  for (const g of [...chosen].sort((a, b) => a.born - b.born)) {
    const { p, n } = g;
    const text = n === 1 && p.name ? `${p.name}: ${p.text}` : p.text;
    const { w, h } = crewSayBox(text, scale);
    const foot = p.y - CREW_SAY_LIFT * scale;
    let bottom = foot;
    for (let k = 0; k <= placed.length; k++) {
      const under = placed.find((q) => Math.abs(q.x - p.x) < (q.w + w) / 2 && bottom > q.top && bottom - h < q.bottom);
      if (!under) break;
      bottom = under.top - CREW_SAY_GAP * scale;   // over the one it would cover
    }
    let lift = Math.max(0, Math.ceil(foot - bottom - 1e-9));   // whole pixels (the face's crispness), rounded UP: the gap whole
    const was = memory?.bubbles.get(g.key);
    if (was && was.lift > lift) {   // down, eased - or held where it stands while its way down is barred; never over one
      const clear = (l) => !placed.some((q) => Math.abs(q.x - p.x) < (q.w + w) / 2 && foot - l > q.top - CREW_SAY_GAP * scale && foot - l - h < q.bottom + CREW_SAY_GAP * scale);
      const eased = Math.max(lift, was.lift - (dt > 0 ? Math.max(1, Math.floor(CREW_SAY_EASE * scale * dt)) : 0));   // a pixel a frame at the least: whole pixels
      if (clear(eased)) lift = eased;
      else if (clear(was.lift)) lift = was.lift;
    }
    if (lift > 0 && foot - lift - h < top) continue;   // over the screen's top: not drawn
    placed.push({ x: p.x, w, top: foot - lift - h, bottom: foot - lift });   // the box as it is drawn
    out.push({ x: p.x, y: p.y, text, kind: p.kind, distance: p.distance, lift, key: g.key, born: g.born });
  }
  if (memory) {
    const keep = new Map();
    for (const b of out) keep.set(b.key, { born: b.born, lift: b.lift });
    memory.bubbles = keep;
  }
  return out.sort((a, b) => a.distance - b.distance).map(({ key, born, ...b }) => b);
}
export const TAG_FADE_FROM = 150;
export const TAG_FADE_TO = 0.55;
/**
 * AUDIT NAV1 (the presentation) - THE LAYOUT, measured in a real browser over the real HUD and helm panel (1920x1080 to
 * a 740x360 phone, HUD scale 0.5 to 2): no part of the readout covers another, or the HUD, and a finger's press never
 * shrinks.
 *   THE PLATE stands NAVAL_PLATE_BOTTOM over the screen's foot (the touch corner's NAVAL_PLATE_TOUCH_BOTTOM under a
 *     finger; on the classic skin over the compass it covered - 91% of its width at 1280x720), lifted over the vitals
 *     where she would reach into their rows, at the HUD's scale CAPPED by the room under what stands over her columns
 *     (platePlace) - she overlapped the vitals at scale 1.5 on a 1280 or 1366 screen, and on a phone stood 81-88% of
 *     its height, off its top and over the helm panel. Read on every change of the screen, the scale, her rows or the
 *     skin, and every PLATE_LAYOUT_S besides (the helm panel's bar rewraps as its buttons change).
 *   A SHORT screen - NAVAL_SHORT_H tall or less in the HUD's own pixels (a phone on its side; 720 lines at scale 1.5)
 *     packs her: her bars side by side, her rose in two rows (port and starboard either side of bow over stern).
 *   THE CARD stands under the compass (or the helm panel's bar) at the HUD's scale CAPPED by the column's room above
 *     the warning's band over the crosshair (cardScale) - at scale 1.5 on a 720 or 768 line screen its foot stood in
 *     that band; where the column holds it at less than CARD_SCALE_MIN, or the screen is short, it stands ASIDE, slim,
 *     at the plate's foot beside her (a phone's column is the helm panel's).
 *   THE AIM AND THE TALLY are one column under the crosshair (the stack), no wider than the room the plate leaves
 *     either side: the words wrap, balanced, rather than run under her (they did at scale 1.5). On a short screen it
 *     stands NAVAL_AIM_DOWN_SHORT down, the aim says its range and state alone (the rose's lit side is the battery), the
 *     tally its count alone and waits while the aim is up; the warning stands NAVAL_WARN_UP_SHORT up, under a phone's
 *     helm panel.
 *   THE BRACE under a finger is its own press beside the plate's foot (NAVAL_BRACE_H, NAVAL_BRACE_W).
 */
export const NAVAL_PLATE_BOTTOM = 22;
export const PLATE_GAP = 12;
export const PLATE_SCALE_MIN = 0.5;
export const PLATE_LAYOUT_S = 0.5;
export const NAVAL_SHORT_H = 500;
/** The card's unscaled height with every row (a ship's: her name, the sub-line, both bars and her state) - the column
 *  reserves it whether or not a card stands, so nothing below jumps as the look finds and loses a ship. */
export const NAVAL_CARD_H = 95;
/** Its sub-line's 12 px at 9, the smallest word the kit sets (the rose's gun counts). */
export const CARD_SCALE_MIN = 0.75;
export const NAVAL_WARN_UP = 62;
export const NAVAL_WARN_UP_SHORT = 48;
export const NAVAL_AIM_DOWN = 34;
export const NAVAL_AIM_DOWN_SHORT = 20;
/** On foot no warning stands: the column runs to the crosshair's arms and a gap. */
export const NAVAL_CROSS_R = 16;
/** The aside card's slim height (no sub-line, thinner bars) - the rows the quick block may share with it. */
export const NAVAL_CARD_ASIDE_H = 60;
/** The stack's rows (two lines of aim, two of tally), and the least it is given either side of the screen's centre
 *  line where the plate shares them: half its narrowest two-line aim ("- on target", "- reloading") and air - at
 *  scale 2 on a 1280x720 screen she stood 66 px from it and the aim ran under her. */
export const NAVAL_STACK_H = 64;
export const NAVAL_STACK_HALF = 60;
/** The warning's band over the crosshair: its height, and half its width naming a key of up to five letters
 *  ("Broadside - Space: brace"; a finger's "Broadside - Brace") - reserved, as it stands only while a volley is coming
 *  (at scale 2 on a 1280x720 screen the plate stood under it). */
export const NAVAL_WARN_H = 30;
export const NAVAL_WARN_HALF = 152;
export const NAVAL_WARN_HALF_TOUCH = 112;
/**
 * Where the plate stands and at what scale: `{ scale, bottom }`. At the HUD's `scale` she would reach into the vitals'
 * column (`vitals`, its rect) in their rows? She stands OVER them - her foot lifted over their top - rather than
 * shrinking (a player who asked for a bigger HUD is not given a smaller plate); then her scale is no more than the
 * room under what stands over her columns allows (`over`, rects: the helm panel's bar, the card's band) and the centre
 * column's bands leave her (`bands`: the warning's and the stack's), and never under PLATE_SCALE_MIN. `plateW`, `plateH` her unscaled size; `bottom` her foot over the
 * screen's; W, H the screen.
 */
export function platePlace({ scale = 1, W, H, plateW, plateH, bottom = NAVAL_PLATE_BOTTOM, right = 18, vitals = null, over = [], bands = [] }) {
  let foot = bottom;
  if (vitals && H - foot > vitals.top && W - right - plateW * scale < vitals.right + PLATE_GAP) foot = Math.max(foot, Math.ceil(H - vitals.top) + PLATE_GAP);
  let k = Math.max(0, scale);
  const left = W - right - plateW * k;
  const ceil = Math.max(0, ...(over ?? []).filter((r) => r && r.right > left && r.left < W - right).map((r) => r.bottom));
  if (plateH > 0) k = Math.min(k, (H - foot - ceil - PLATE_GAP) / plateH);
  // the centre column's bands (`bands`: the warning's, the stack's - each its foot and the half-width it keeps from the
  // centre line): where she shares one's rows closer than that, she steps clear of it - narrower or lower, whichever
  // costs her less
  for (const b of bands ?? []) {
    if (plateH > 0 && H - foot - plateH * k < b.bottom && W - right - plateW * k < W / 2 + b.half) {
      k = Math.min(k, Math.max((W / 2 - right - b.half) / plateW, (H - foot - b.bottom - PLATE_GAP) / plateH));
    }
  }
  return { scale: Math.max(PLATE_SCALE_MIN, Math.min(scale, k)), bottom: foot };
}
/**
 * The card's scale in the column: the HUD's, capped by the room from its top (`top`, px) down to the warning's band
 * over the crosshair (`warn` - at the helm, where a broadside's warning stands; on foot the crosshair's arms) - or null
 * where that room holds it at less than CARD_SCALE_MIN (the HUD's own scale where that is less): it stands aside.
 */
export function cardScale({ scale = 1, H, top, warn = true }) {
  const floor = H / 2 - (warn ? NAVAL_WARN_UP * scale : NAVAL_CROSS_R) - PLATE_GAP;
  const k = Math.min(scale, (floor - top) / NAVAL_CARD_H);
  return k >= Math.min(scale, CARD_SCALE_MIN) ? k : null;
}

const OUTLINED = '-1px 0 0 #050608, 1px 0 0 #050608, 0 -1px 0 #050608, 0 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7)';
const CLASP = 'linear-gradient(180deg, #f3cf86 0 2px, transparent 2px), linear-gradient(90deg, #e2b064 0 2px, #c08a3e 2px 4px, #7a5424 4px 6px)';
const T = FRAME_TONES;

export const NAVAL_HUD_CSS = `
${PIXELIFY_FIVE_FACE}
.dfnaval-hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; ${PIXEL_FONT_CSS} color: #d8cfae; --nc-top: ${NAVAL_CARD_TOP}; }
body:has(.hud-foe.on) .dfnaval-hud { --nc-top: ${NAVAL_CARD_TOP_FOE}; }
body:has(.hud-foe.on.blade) .dfnaval-hud { --nc-top: ${NAVAL_CARD_TOP_BLADE}; }
.dfnaval-hud.touch .dfnaval-plate { right: calc(18px + env(safe-area-inset-right, 0px)); bottom: calc(var(--nc-foot, ${NAVAL_PLATE_TOUCH_BOTTOM}px) + env(safe-area-inset-bottom, 0px)); }
.dfnaval-plate { position: absolute; right: 18px; bottom: var(--nc-foot, ${NAVAL_PLATE_BOTTOM}px); width: ${NAVAL_PLATE_W}px; padding: 10px 12px 9px;
  background: ${T.groundPanel}; border: 2px solid ${T.stoneLit}; transform: scale(var(--nc-plate-scale, var(--hud-scale, 1))); transform-origin: bottom right; }
.dfnaval-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: -10px -12px 8px; padding: 6px 12px 5px;
  font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; }
.dfnaval-waters { font-size: 11px; letter-spacing: 0.06em; color: #b3a684; text-transform: none; white-space: nowrap; }
.dfnaval-anchors { display: inline-flex; gap: 3px; margin-left: 5px; vertical-align: middle; }
.dfnaval-anchor { width: 7px; height: 7px; background: #2a241b; box-shadow: 0 0 0 1px #050608; }
.dfnaval-anchor.on { background: #b83a2e; box-shadow: 0 0 0 1px #050608, inset 1px 1px 0 rgba(255,255,255,0.3); }
.dfnaval-bar { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 8px; margin: 0 6px 5px; }
.dfnaval-bar-label { font-size: 11px; letter-spacing: 0.08em; color: #c9bfa4; text-shadow: 1px 1px 0 #050608; }
.dfnaval-track { position: relative; height: 12px; border: 2px solid; border-color: #9a9079 #3a352a #25221b #6e6755; isolation: isolate;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0 2px, transparent 2px), #140d0a; box-shadow: 0 0 0 1px #050608, 2px 2px 0 1px rgba(0,0,0,0.45); }
.dfnaval-track::before, .dfnaval-track::after { content: ''; position: absolute; top: -2px; bottom: -2px; width: 6px; z-index: 2; box-shadow: 0 0 0 1px #050608; background: ${CLASP}; }
.dfnaval-track::before { left: -6px; }
.dfnaval-track::after { right: -6px; }
.dfnaval-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transition: width 160ms linear; }
.dfnaval-fill::after { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: min(2px, 100%); opacity: 0.85; background: #fff; }
.dfnaval-track.hull .dfnaval-fill { background: linear-gradient(180deg, #f2a597 0 2px, #d8685a 2px 4px, #b53a2e 4px 8px, #8a2820 8px 10px, #5c1812 10px); }
.dfnaval-track.sail .dfnaval-fill { background: linear-gradient(180deg, #fbf6e4 0 2px, #e9e0c4 2px 4px, #c9bd98 4px 8px, #9c916f 8px 10px, #6b6249 10px); }
.dfnaval-track.crew .dfnaval-fill { background: linear-gradient(180deg, #b9f0c4 0 2px, #5fc27c 2px 4px, #2f9152 4px 8px, #216b3b 8px 10px, #134526 10px); }
.dfnaval-track.low { animation: dfnaval-low 0.9s steps(1) infinite; }
@keyframes dfnaval-low { 50% { border-color: #e0584a #5a130f #3d0d0a #b83a2e; } }
.dfnaval-chips { display: flex; gap: 6px; justify-content: flex-end; min-height: 0; margin: 2px 6px 0; }
.dfnaval-chip { padding: 1px 6px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; background: ${T.groundChip}; border: 2px solid ${T.stoneDim}; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.dfnaval-chip.fire { border-color: #e0584a #5a130f #3d0d0a #b83a2e; color: #ffd9a8; }
.dfnaval-chip.brace { border-color: ${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}; color: ${T.brassHi}; }
.dfnaval-chip.wreck { border-color: #e0584a #5a130f #3d0d0a #b83a2e; color: #ffc4bb; }
.dfnaval-chip.mend, .dfnaval-chip.repair { border-color: #9fd6a8 #2f6b3b #1f4a28 #5fa36c; color: #cdf0d2; }
.dfnaval-rose { display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: auto auto auto; gap: 4px; margin: 8px 3px 2px; align-items: stretch; }   /* AUDIT FONT3 L1: 3px a side, not 6 - the batteries' words at the 11px floor need it */
.dfnaval-gun { position: relative; overflow: hidden; padding: 3px 1px 4px; min-height: 30px; text-align: center; background: ${T.groundButton};
  border: 2px solid; border-color: ${T.stoneLit} ${T.stoneDim} ${T.stoneDark} ${T.stoneMid}; box-shadow: 0 0 0 1px #050608; }
.dfnaval-gun.bow { grid-column: 2; grid-row: 1; }
.dfnaval-gun.port { grid-column: 1; grid-row: 2; }
.dfnaval-gun.starboard { grid-column: 3; grid-row: 2; }
.dfnaval-gun.stern { grid-column: 2; grid-row: 3; }
.dfnaval-ship { grid-column: 2; grid-row: 2; align-self: center; justify-self: center; width: 16px; height: 34px;
  background: linear-gradient(180deg, ${T.stoneLit}, ${T.stoneMid}); clip-path: polygon(50% 0, 100% 30%, 100% 100%, 0 100%, 0 30%); box-shadow: 0 0 0 1px #050608; }
.dfnaval-gun-fill { position: absolute; left: 0; right: 0; bottom: 0; height: 0; z-index: 0;
  background: linear-gradient(180deg, ${T.brassHi} 0 2px, rgba(192,138,62,0.6) 2px); }
.dfnaval-gun-side, .dfnaval-gun-count { position: relative; z-index: 1; display: block; line-height: 1.15; text-shadow: 1px 1px 0 #050608; }
/* AUDIT FONT3 L1: at the 11px floor "STARBOARD" at 0.12em clipped in its box and "12 great guns" wrapped, growing the
   plate a third (256 -> 292px; 161 -> 180px on a 740x360 phone) - the side word tracks 0.04em, the count none */
.dfnaval-gun-side { font-size: 11px; letter-spacing: 0.04em; color: #efe8d6; text-transform: uppercase; }
.dfnaval-gun-count { font-size: 11px; letter-spacing: 0; word-spacing: -2px; font-weight: 400; color: #d8cfae; }   /* the spaces give the 2.6px "12 great guns" lacked in a 70.7px battery - the letters keep theirs */
.dfnaval-gun.ready { border-color: ${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}; }
.dfnaval-gun.ready .dfnaval-gun-count { color: ${T.brassHi}; }
.dfnaval-gun.active { background: #2c2413; box-shadow: 0 0 0 1px #050608, 0 0 8px rgba(243,207,134,0.45); }
.dfnaval-gun.active .dfnaval-gun-side { color: ${T.gold}; text-shadow: 1px 1px 0 rgb(93,77,12); }
.dfnaval-gun.gun-empty { opacity: 0.5; }   /* HUD-CLASS (AUDIT 2026-10-05): its own word - as the bare 'empty' it took the enhanced sheet's .empty component, 16px under the plate (its row 36 -> 52px) */
.dfnaval-gun.fresh { animation: dfnaval-ready ${READY_FLASH_S}s steps(7, end); }
@keyframes dfnaval-ready { 0% { box-shadow: 0 0 0 1px #050608, 0 0 12px 2px rgba(243,207,134,0.95); } 100% { box-shadow: 0 0 0 1px #050608, 0 0 0 0 rgba(243,207,134,0); } }
.dfnaval-hint { margin: 7px 6px 0; font-size: 11px; letter-spacing: 0.05em; color: #b3a684; text-align: center; text-shadow: 1px 1px 0 #050608; }
.dfnaval-brace { position: absolute; right: calc(18px + var(--nc-plate-w, ${NAVAL_PLATE_W}px) + 8px + env(safe-area-inset-right, 0px));
  bottom: calc(var(--nc-foot, ${NAVAL_PLATE_TOUCH_BOTTOM}px) + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; width: ${NAVAL_BRACE_W}px;
  height: ${NAVAL_BRACE_H}px; line-height: ${NAVAL_BRACE_H - 4}px; text-align: center; pointer-events: auto; touch-action: none;
  user-select: none; -webkit-user-select: none; font-size: 14px; letter-spacing: 0.16em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED};
  background: ${T.groundButton}; border: 2px solid; border-color: ${T.stoneLit} ${T.stoneDim} ${T.stoneDark} ${T.stoneMid}; box-shadow: 0 0 0 1px #050608; }
.dfnaval-brace.down { background: #2c2413; border-color: ${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}; color: ${T.gold}; }
.dfnaval-stack { position: absolute; left: 50%; top: calc(50% + ${NAVAL_AIM_DOWN}px * var(--hud-scale, 1)); transform: translateX(-50%) scale(var(--hud-scale, 1));
  transform-origin: 50% 0; display: flex; flex-direction: column; align-items: center; gap: 4px; width: max-content; text-align: center;
  max-width: var(--nc-stack-max, calc((100vw - 2 * (${NAVAL_PLATE_W}px + 30px)) / var(--hud-scale, 1))); }
.dfnaval-hud.short .dfnaval-stack { top: calc(50% + ${NAVAL_AIM_DOWN_SHORT}px * var(--hud-scale, 1)); }
.dfnaval-aim { font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; text-wrap: balance; }
.dfnaval-aim-range { white-space: nowrap; }
.dfnaval-aim .dfnaval-aim-range { color: ${T.brassHi}; }
.dfnaval-aim.hot { color: #ffb4a6; }
.dfnaval-aim.hot .dfnaval-aim-range { color: #ff8a76; }
.dfnaval-aim.dim { color: #a39a86; }
.dfnaval-aim.dim .dfnaval-aim-range { color: #8f8670; }
.dfnaval-card { position: absolute; left: 50%; top: var(--nc-top); transform: translateX(-50%) scale(var(--nc-card-scale, var(--hud-scale, 1))); transform-origin: 50% 0;
  width: 400px; max-width: calc(86vw / var(--nc-card-scale, var(--hud-scale, 1))); padding: 7px 14px 8px;
  text-align: center; background: ${T.groundPanel}; border: 2px solid ${T.stoneLit}; }
.dfnaval-card-name { font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; }
.dfnaval-card.navy .dfnaval-card-name { color: #f1d0c6; }
.dfnaval-card.merchant .dfnaval-card-name { color: #f6e3a6; }
.dfnaval-card.hostile .dfnaval-card-name { color: #ffb4a6; }
.dfnaval-card.friendly .dfnaval-track.hull .dfnaval-fill { background: linear-gradient(180deg, #b9f0c4 0 2px, #5fc27c 2px 4px, #2f9152 4px 8px, #216b3b 8px 10px, #134526 10px); }
.dfnaval-card-sub { margin: 2px 0 6px; font-size: 11px; letter-spacing: 0.05em; color: #c9bfa4; text-shadow: 1px 1px 0 #050608; }
.dfnaval-card .dfnaval-track { margin: 0 8px 4px; height: 10px; }
.dfnaval-card .dfnaval-track.sail { height: 5px; }
.dfnaval-ghost { position: absolute; top: 0; bottom: 0; left: 0; width: 0; display: block; z-index: -1;
  background: linear-gradient(180deg, #fff6e4 0 1px, #f2a597 1px); opacity: 0.6; }
.dfnaval-chunk { position: absolute; top: 0; bottom: 0; display: none; z-index: 0; pointer-events: none; }
.dfnaval-chunk.fa, .dfnaval-chunk.fb { display: block; }
.dfnaval-chunk::before, .dfnaval-chunk::after { content: ''; position: absolute; top: 0; bottom: 0; opacity: 0;
  background: linear-gradient(180deg, #fff6e4 0 2px, #d8685a 2px calc(100% - 3px), #8a2820 calc(100% - 3px)); box-shadow: 0 0 0 1px #050608; }
.dfnaval-chunk::before { left: 0; width: 55%; }
.dfnaval-chunk::after { left: 55%; right: 0; }
.dfnaval-chunk.fa::before { animation: dfnaval-chunk-l 560ms steps(8, end) forwards; }
.dfnaval-chunk.fa::after { animation: dfnaval-chunk-r 640ms steps(8, end) forwards; }
.dfnaval-chunk.fb::before { animation: dfnaval-chunk-l2 560ms steps(8, end) forwards; }
.dfnaval-chunk.fb::after { animation: dfnaval-chunk-r2 640ms steps(8, end) forwards; }
@keyframes dfnaval-chunk-l { 0% { opacity: 1; transform: translate(0, 0); } 25% { opacity: 1; transform: translate(-1px, 3px); } 100% { opacity: 0; transform: translate(-4px, 22px); } }
@keyframes dfnaval-chunk-l2 { 0% { opacity: 1; transform: translate(0, 0); } 25% { opacity: 1; transform: translate(-1px, 3px); } 100% { opacity: 0; transform: translate(-4px, 22px); } }
@keyframes dfnaval-chunk-r { 0% { opacity: 1; transform: translate(0, 0); } 35% { opacity: 1; transform: translate(2px, 5px); } 100% { opacity: 0; transform: translate(5px, 28px); } }
@keyframes dfnaval-chunk-r2 { 0% { opacity: 1; transform: translate(0, 0); } 35% { opacity: 1; transform: translate(2px, 5px); } 100% { opacity: 0; transform: translate(5px, 28px); } }
.dfnaval-card.hit-a { animation: dfnaval-hit-a ${CARD_HIT_S * 1000}ms steps(3, end); }
.dfnaval-card.hit-b { animation: dfnaval-hit-b ${CARD_HIT_S * 1000}ms steps(3, end); }
@keyframes dfnaval-hit-a { 0% { border-color: #fff6e4; box-shadow: 0 0 10px rgba(255,138,118,0.85); } 100% { border-color: ${T.stoneLit}; box-shadow: none; } }
@keyframes dfnaval-hit-b { 0% { border-color: #fff6e4; box-shadow: 0 0 10px rgba(255,138,118,0.85); } 100% { border-color: ${T.stoneLit}; box-shadow: none; } }
@media (prefers-reduced-motion: reduce) { .dfnaval-chunk { display: none !important; } .dfnaval-card.hit-a, .dfnaval-card.hit-b, .dfnaval-gun.fresh { animation: none; } }
.dfnaval-card-state { min-height: 14px; margin-top: 4px; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.brassHi}; text-shadow: ${OUTLINED};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* AUDIT BAY A10: one line, cut at the card's edge - the aside card's state ("friendly - patrolling off Copperhold
   Orchard") wrapped to a second and the card stood taller under the player's plate */
.dfnaval-card-state.board { color: ${T.gold}; }
.dfnaval-card-state.sinking { color: #ff8a76; }
.dfnaval-card-state.friendly { color: #9fe0a8; }
.dfnaval-card-state.hostile { color: #ff9c8a; }
.dfnaval-hud.aside .dfnaval-card { top: auto; left: auto; right: var(--nc-card-right, ${18 + NAVAL_PLATE_W + PLATE_GAP}px); bottom: var(--nc-foot, ${NAVAL_PLATE_BOTTOM}px);
  transform: scale(var(--hud-scale, 1)); transform-origin: 100% 100%; box-sizing: border-box; width: 300px; max-width: var(--nc-card-max, 300px); padding: 4px 10px 5px; }
.dfnaval-hud.touch.aside .dfnaval-card { right: calc(var(--nc-card-right, ${18 + NAVAL_PLATE_W + PLATE_GAP}px) + env(safe-area-inset-right, 0px));
  bottom: calc(var(--nc-foot, ${NAVAL_PLATE_TOUCH_BOTTOM}px) + env(safe-area-inset-bottom, 0px)); }
.dfnaval-hud.aside .dfnaval-card-name { font-size: 12px; letter-spacing: 0.1em; }
.dfnaval-hud.aside .dfnaval-card-sub { display: none; }
.dfnaval-hud.aside .dfnaval-card .dfnaval-track { height: 7px; margin-bottom: 3px; }
.dfnaval-hud.aside .dfnaval-card .dfnaval-track.sail { height: 4px; }
.dfnaval-hud.aside .dfnaval-card-state { font-size: 11px; min-height: 0; margin-top: 2px; }
.dfnaval-hud.short .dfnaval-plate { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 6px; }
.dfnaval-hud.short .dfnaval-plate > :not(.dfnaval-bar) { grid-column: 1 / -1; }
.dfnaval-hud.short .dfnaval-head { margin-bottom: 5px; }
.dfnaval-hud.short .dfnaval-bar { grid-template-columns: 1fr; gap: 2px; margin: 0 0 5px; }
.dfnaval-hud.short .dfnaval-bar-label { font-size: 11px; }
.dfnaval-hud.short .dfnaval-rose { grid-template-rows: auto auto; margin-top: 5px; }
.dfnaval-hud.short .dfnaval-gun.port, .dfnaval-hud.short .dfnaval-gun.starboard { grid-row: 1 / span 2; display: flex; flex-direction: column; justify-content: center; }
.dfnaval-hud.short .dfnaval-gun.stern { grid-row: 2; }
.dfnaval-hud.short .dfnaval-ship { display: none; }
.dfnaval-warn { position: absolute; left: 50%; top: calc(50% - ${NAVAL_WARN_UP}px * var(--hud-scale, 1)); transform: translateX(-50%) scale(var(--hud-scale, 1)); transform-origin: 50% 0; white-space: nowrap; padding: 3px 12px 4px;
  font-size: 15px; letter-spacing: 0.16em; text-transform: uppercase; color: #ffd9cf; text-shadow: ${OUTLINED};
  background: rgba(60, 12, 8, 0.72); border: 2px solid; border-color: #e0584a #5a130f #3d0d0a #b83a2e; box-shadow: 0 0 0 1px #050608;
  animation: dfnaval-warn 0.5s steps(1) infinite; }
.dfnaval-warn .dfnaval-warn-key { color: ${T.brassHi}; }
.dfnaval-hud.short .dfnaval-warn { top: calc(50% - ${NAVAL_WARN_UP_SHORT}px * var(--hud-scale, 1)); }
@keyframes dfnaval-warn { 50% { color: #ff9c8a; border-color: #ff8a76 #7a1a12 #52110c #e0584a; } }
.dfnaval-tally { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; text-wrap: balance; }
.dfnaval-tally .dfnaval-tally-hits { color: ${T.brassHi}; }
.dfnaval-hud.short .dfnaval-tally-rest { display: none; }
.dfnaval-tags { position: fixed; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; ${PIXEL_FONT_CSS} }
.dfnaval-tag { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; white-space: nowrap;
  transform-origin: 0 0; will-change: transform, opacity; }
.dfnaval-tag-name { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; }
.dfnaval-tag.navy .dfnaval-tag-name { color: #f1d0c6; }
.dfnaval-tag.merchant .dfnaval-tag-name { color: #f6e3a6; }
.dfnaval-tag.hostile .dfnaval-tag-name { color: #ffb4a6; }
.dfnaval-tag-bar { position: relative; width: ${NAVAL_TAG_BAR_W}px; height: 4px; background: #140d0a; box-shadow: 0 0 0 1px #050608; }
.dfnaval-tag-bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(180deg, #f2a597 0 1px, #b53a2e 1px); }
.dfnaval-tag.target .dfnaval-tag-bar { box-shadow: 0 0 0 1px #050608, 0 0 0 2px ${T.brassHi}; }
.dfnaval-tag.friendly .dfnaval-tag-bar > i { background: linear-gradient(180deg, #b8ffb8 0 1px, ${CREW_GREEN} 1px); }
.dfnaval-tag-line { font-size: 11px; letter-spacing: 0.06em; color: #c9bfa4; text-shadow: ${OUTLINED}; }
.dfnaval-tag-line:empty { display: none; }
.dfnaval-tag.friendly .dfnaval-tag-line { color: #bfe6c3; }
.dfnaval-tag.hostile .dfnaval-tag-line { color: #f0b9ae; }
.dfnaval-tag-state { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.brassHi}; text-shadow: ${OUTLINED}; }
.dfnaval-tag-state:empty { display: none; }
.dfnaval-crew { position: absolute; left: 0; top: 0; width: ${CREW_BAR_W}px; height: 4px; background: #0b1409; box-shadow: 0 0 0 1px #050608;
  transform-origin: 0 0; will-change: transform, opacity; }
.dfnaval-crew > i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(180deg, #b8ffb8 0 1px, ${CREW_GREEN} 1px); }
.dfnaval-crew.mate { width: ${MATE_BAR_W}px; height: 5px; }
.dfnaval-crew-name { position: absolute; left: 50%; bottom: calc(100% + 2px); transform: translateX(-50%); white-space: nowrap; font-size: 11px;
  line-height: 1; color: ${CREW_GREEN}; text-shadow: ${OUTLINED}; }
.dfnaval-crew-name:empty, .dfnaval-crew-fx:empty { display: none; }
.dfnaval-crew-hp { margin-left: 4px; color: #e8f6e2; font-size: 11px; }
.dfnaval-crew-hp:empty { display: none; }
.dfnaval-crew-fx { position: absolute; left: 50%; top: calc(100% + 2px); transform: translateX(-50%); display: flex; gap: 1px; }
.dfnaval-crew-fxe { position: relative; width: ${MATE_FX_BOX}px; height: ${MATE_FX_BOX}px; box-shadow: 0 0 0 1px #050608; background: #1b2618; overflow: hidden;
  display: grid; place-items: center; font-size: 7px; line-height: ${MATE_FX_BOX}px; text-align: center; color: #e8f6e2; }
/* AUDIT WK-U9: a debuff's ring in the party card's own red (.dfparty-fxe.debuff), 5.4:1 against a buff's black ring -
   #6b1d14 was 1.75:1, a debuff told from a buff by its hue alone */
.dfnaval-crew-fxe.debuff { box-shadow: 0 0 0 1px #e2554c; }
/* AUDIT WK-U8: THE FIT LAW (ui/iconFit.js) - the picture is made at the device size it is drawn at (drawCrewBars,
   spellIconPicture) and sized by its own numbers (showFitted), so it is copied pixel for pixel; never the 2x cut forced
   into a box under pixelated rendering */
.dfnaval-crew-fxe > img { image-rendering: pixelated; display: block; }
.dfnaval-tally.miss .dfnaval-tally-hits { color: #b3a684; }
.dfnaval-say { position: absolute; left: 0; top: 0; max-width: ${CREW_SAY_W}px; padding: 2px 7px 3px; font-size: 11px; line-height: 1.3;
  color: #efe8d6; text-shadow: ${OUTLINED}; text-align: center; white-space: normal; text-wrap: balance;
  background: rgba(8, 10, 12, 0.62); box-shadow: 0 0 0 1px rgba(5, 6, 8, 0.8); transform-origin: 0 0; will-change: transform, opacity; }
.dfnaval-say::after { content: ''; position: absolute; left: 50%; bottom: -5px; margin-left: -4px; border: 4px solid transparent; border-bottom: 0; border-top-color: rgba(8, 10, 12, 0.62); }
.dfnaval-say.sing { color: ${T.brassHi}; font-style: italic; }
.dfnaval-say.shout { color: #ffc6b8; letter-spacing: 0.04em; }
`;

/** A share as a whole percent, bounded. */
const pct = (v) => Math.max(0, Math.min(100, Math.round((Number(v) || 0) * 100)));
const SIDE_WORDS = Object.freeze({ bow: 'Bow', port: 'Port', starboard: 'Starboard', stern: 'Stern' });
const GUN_WORDS = Object.freeze({ long: 'long guns', swivel: 'swivels', heavy: 'great guns', chain: 'chain shot', barrel: 'fire barrels' });

/** AUDIT NAV1 (the helm): the aim line's tail - on target, or why the battery will not fire yet. */
function aimTail(a) {
  switch (a.state) {
    case 'reloading': return ` - reloading ${(Number(a.left) || 0).toFixed(1)}\u00a0s`;   // AUDIT NAV1 (the presentation): a wrapped aim keeps "4.2 s" whole
    case 'braced': return ' - braced';
    case 'crippled': return ' - guns silent';
    case 'empty': return ' - no barrels';
    default: return a.hot ? ' - on target' : '';
  }
}

/**
 * AUDIT NAV1 (B9) - THE FIGHT'S CARD, in the target card's place under the compass: Black Flag's objective line. Over
 * her rail - whose deck, her captain standing or down, how many of her crew are down and at what count the rest
 * yield; boarded - the boarders and where from, their tally (a Warm Ashes raid keeps its own); the haul first.
 */
function fightCard(b) {
  if (b.kind === 'board') {
    if (b.phase !== 'fight') return { name: `Grappling ${b.name}`, sub: 'Hauling her alongside', state: '', kind: '' };
    return {
      name: `Boarding ${b.name}`, sub: b.captain ? `Captain ${b.captain} - ${b.captainDown ? 'down' : 'standing'}` : '',
      state: `${b.down} of ${b.total} down - ${b.captainDown ? `they yield at ${b.yieldAt}` : 'cut down her captain'}`, kind: 'board',
    };
  }
  if (b.phase !== 'fight') return { name: `${b.name} grapples you`, sub: 'Stand by to repel boarders', state: '', kind: 'sinking' };
  return { name: 'Repel the boarders', sub: `From ${b.name}`, state: b.raid ? 'Hold your deck' : `${b.down} of ${b.total} down`, kind: 'sinking' };
}

/** The card's state line: what she is doing, and - when she is in reach - the key that goes over her rail. */
function cardState(t, board, key) {
  const mine = board != null && board.name === t.name;
  if (t.state === 'sinking') return { text: 'Going down', kind: 'sinking' };
  // AUDIT NAV1 (the presentation): one wording with the plate's hint ("open ... hold") - it read "her hold" here
  if (t.state === 'prize') return mine && board.kind === 'hold' ? { text: `Taken - ${key}: open her hold`, kind: 'board' } : { text: 'Taken', kind: '' };
  if (t.boarded) return { text: 'Boarded', kind: '' };
  if (t.state === 'struck') {
    if (mine && board.kind === 'board') return { text: `Colours struck - ${key}: board her`, kind: 'board' };
    // AUDIT NAV1 (the helm): in reach but too fast - the refusal said nothing
    if (mine && board.kind === 'heave') return { text: board.heaving ? 'Colours struck - heaving to' : `Colours struck - ${key}: heave to`, kind: 'board' };
    return { text: 'Colours struck', kind: '' };
  }
  // SHIP-STANCE, SHIP-TAGS: how she stands to me, and where she is bound
  const stance = t.hostile ? 'Hostile' : t.friendly ? 'Friendly' : '';
  return { text: [stance, t.bound].filter(Boolean).join(' - '), kind: t.hostile ? 'hostile' : t.friendly ? 'friendly' : '' };
}

/**
 * AUDIT NAV1 (the presentation): THE PAD AT THE GUNS - the helm's prompt rows beside the d-pad's (ui/enhancedHelm.js
 * helmPadPrompts; the Plus pad's prompt bar showed the d-pad alone at an armed helm): the attack's button laying and
 * firing the guns, the brace's, and Activate's while a ship is in reach - each `[[code], words]`, a row only for a
 * button bound. `codes` { aim, board, brace } the pad's own codes (a pad player read "Hold RIGHT CLICK to aim"; the
 * readout's hint names these buttons by the pad's own names - the host's `keys`).
 */
export function navalPadPrompts(model, codes = {}) {
  if (!model?.armed) return [];
  const rows = [];
  if (codes.aim) rows.push([[codes.aim], model.aiming ? 'Let go: fire' : 'Hold: lay the guns']);
  if (codes.brace) rows.push([[codes.brace], 'Hold: brace']);
  const b = model.board;
  if (codes.board && model.aiming) rows.push([[codes.board], 'Hold fire']);   // GUN-HOLD: Activate's, while they are laid
  else if (codes.board && b) rows.push([[codes.board], b.kind === 'hold' ? `Open ${b.name}'s hold` : b.kind === 'heave' ? 'Heave to' : b.kind === 'yard' ? 'The shipwright' : `Board ${b.name}`]);
  return rows;
}

/**
 * The readout's words for a model - pure, the pins' reading. `keys` the registry's names for the attack, Activate and
 * the brace. `plate` is null on foot (the card alone stands, and only while a ship is in reach). `touch`: a finger's
 * screen, where no key is named - a tap is the activation (the host's one arm, a key's or a click's alike), the
 * finger held and dragged the aim (touch.js aimHold), the lift the broadside, and Crouch the touch table's press.
 */
export function navalHudText(model, keys = {}, { touch = false } = {}) {
  if (!model) return null;
  const aimKey = keys.aim ?? 'Attack', boardKey = touch ? 'Tap' : (keys.board ?? 'Activate'), braceKey = keys.brace ?? 'Brace';
  const bracePress = touch ? 'hold Brace' : `${braceKey}: brace`;   // AUDIT NAV1: a finger's is the plate's own press
  const batteries = (model.batteries ?? []).map((b) => ({
    side: b.side, word: SIDE_WORDS[b.side],
    count: b.gun === 'barrel' ? `${b.barrels ?? 0} barrel${b.barrels === 1 ? '' : 's'}` : `${b.guns} ${b.guns === 1 ? GUN_WORDS[b.gun].replace(/s$/, '') : GUN_WORDS[b.gun]}`,
    // AUDIT NAV1 (the presentation): a loaded side stands FULL brass (it filled to 97% and dropped to nought, loaded);
    // `fresh` the flash of one just come ready
    fill: pct((b.loaded ?? b.ready) ? 1 : b.progress), ready: !!b.ready, fresh: !!b.fresh, active: !!b.active, empty: b.gun === 'barrel' && !(b.barrels > 0),
  }));
  const a = model.aim;
  const aim = a ? {
    text: a.barrel ? `${SIDE_WORDS[a.side]} - roll a fire barrel` : `${SIDE_WORDS[a.side]} ${a.side === 'bow' || a.side === 'stern' ? 'chasers' : 'broadside'} - `,
    range: a.barrel ? '' : `${a.range} m${a.range >= a.max - 1 ? ' (longest)' : ''}`,
    hot: !!a.hot && (a.state ?? 'ready') === 'ready', dim: !!a.state && a.state !== 'ready', target: aimTail(a),
  } : null;
  const t = model.target;
  const st = t ? cardState(t, model.board, boardKey) : null;
  const card = t ? {
    id: t.id ?? t.name, name: t.name, faction: t.faction, hostile: !!t.hostile, friendly: !!t.friendly && !t.hostile,
    sub: [t.classLine, t.captain ? `Captain ${t.captain}` : null, `${t.distance} m`].filter(Boolean).join(' - '),
    hull: pct(t.hull), sail: t.sail == null ? null : pct(t.sail),
    state: st.text, stateKind: st.kind,
  } : null;
  const ship = model.ship;
  const plate = ship ? {
    // SHIP-CREW: her crew's spirits and standing order beside her waters
    name: ship.name, waters: [`${model.notoriety.crown} waters`, ship.spirits ? `crew ${ship.spirits.toLowerCase()}` : null, ship.order ?? null].filter(Boolean).join(' - '), anchors: model.notoriety.level,
    hull: pct(ship.hull), sail: ship.sail == null ? null : pct(ship.sail), crew: ship.crew == null ? null : pct(ship.crew),
    chips: [ship.wrecked ? 'wreck' : null, ship.fire ? 'fire' : null, ship.braced ? 'brace' : null, ship.repairing ? 'repair' : ship.mending ? 'mend' : null].filter(Boolean),   // SEA-REPAIR: her repairs over the free mending
    batteries,
    // the press that matters most, first: the guns while they are laid (GUN-HOLD: Activate holds fire then, never
    // boards), a ship in reach to board or plunder, then the guns
    hint: model.aiming && model.armed && !ship.wrecked ? `${touch ? 'Lift' : 'Let go'} to fire - ${boardKey}: hold fire`
      : model.board ? (model.board.kind === 'heave' && model.board.heaving ? `Heaving to beside ${model.board.name}`
      : `${boardKey}: ${model.board.kind === 'hold' ? `open ${model.board.name}'s hold` : model.board.kind === 'yard' ? model.board.name
        : model.board.kind === 'heave' ? `heave to beside ${model.board.name}` : `board ${model.board.name}`}`)
      : ship.wrecked ? (ship.repairing ? 'Crippled - her crew at the repairs' : ship.repairOrdered ? 'Crippled - her crew stands to the repairs' : ship.stores > 0 ? 'Crippled - order repairs, or make port' : 'Crippled - make port for a shipwright')   // AUDIT NAV1: the way out of a wreck, said - SEA-REPAIR: her stores the other
      : !model.armed ? 'No guns aboard'
      : `${touch ? 'Hold and drag' : `Hold ${aimKey}`} to aim - ${bracePress}`,
    brace: touch && !!model.armed,
  } : null;
  // AUDIT NAV1 (the guns): the tell's words, and the last volley's count
  // AUDIT NAV1 (the presentation): a finger's names the press ("hold Brace" made it wider than a small phone's room)
  const warn = model.incoming ? { text: 'Broadside', key: touch ? 'Brace' : bracePress } : null;
  const tl = model.tally;
  const tally = tl ? {
    hits: `${tl.hits} of ${tl.balls} ${tl.balls === 1 ? 'ball' : 'balls'} struck`, miss: tl.hits === 0,
    rest: [tl.holed ? `${tl.holed} below her waterline` : null, tl.rig ? `${tl.rig} through her rigging` : null].filter(Boolean).map((x) => ` - ${x}`).join(''),
  } : null;
  const fight = model.boarding?.name ? fightCard(model.boarding) : null;
  return { plate, aim, card, warn, tally, fight };
}
const CHIP_WORDS = Object.freeze({ wreck: 'Crippled', fire: 'On fire', brace: 'Braced', mend: 'Mending', repair: 'Repairing' });

let root = null, parts = null;
let shown = {};
let touchBrace = false;   // AUDIT NAV1: the plate's Brace held under a finger

/** AUDIT NAV1 (the helm): whether a finger holds the plate's Brace - read by the world's brace beside the Crouch key.
 *  Only while the press stands: a plate hidden, covered or gone lets go (drawNavalHud, destroyNavalHud). */
export function navalTouchBrace() { return touchBrace; }

function el(doc, tag, cls, text = null) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
const addSheet = (doc, id, text) => {
  if (doc.getElementById?.(id)) return false;
  const st = doc.createElement('style');
  st.id = id;
  st.textContent = text;
  (doc.head ?? doc.body)?.append(st);
  return true;
};
/** The kit's rules cut to the naval surfaces' own selectors - the classic skin's copy of their Plus dress. */
export const navalKitCss = () => scopeRules(frameCss(), (sel) => sel.includes('dfnaval'));
/** The kit for the readout and the plunder window, on the classic skin (Enhanced Plus already carries it) - once. */
export function injectNavalKit(doc = globalThis.document) {
  if (!doc?.createElement || isEnhancedPlus()) return false;
  return addSheet(doc, NAVAL_KIT_STYLE_ID, navalKitCss());
}
function injectSheets(doc) {
  addSheet(doc, NAVAL_HUD_STYLE_ID, NAVAL_HUD_CSS);
  injectNavalKit(doc);
  // AUDIT NAV1 (the presentation): the kit's face (Pixelify Sans) is the enhanced HUD's to load, and on the classic skin
  // none did - the readout fell to monospace; the Broker's window and the travel view's readout load it as this does
  if (doc.head) injectEnhancedFonts(doc);
}

function bar(doc, kind, label) {
  const row = el(doc, 'div', 'dfnaval-bar');
  const track = el(doc, 'div', `dfnaval-track ${kind}`);
  const fill = el(doc, 'i', 'dfnaval-fill');
  track.append(fill);
  row.append(el(doc, 'span', 'dfnaval-bar-label', label), track);
  return { row, track, fill };
}

function build(doc) {
  injectSheets(doc);
  root = el(doc, 'div', 'dfnaval-hud');
  root.setAttribute?.('aria-hidden', 'true');
  // the card
  const card = el(doc, 'div', 'dfnaval-card');
  const cardName = el(doc, 'div', 'dfnaval-card-name');
  const cardSub = el(doc, 'div', 'dfnaval-card-sub');
  const cardHull = el(doc, 'div', 'dfnaval-track hull'); const cardHullFill = el(doc, 'i', 'dfnaval-fill');
  const cardGhost = el(doc, 'i', 'dfnaval-ghost'), cardChunks = [el(doc, 'i', 'dfnaval-chunk'), el(doc, 'i', 'dfnaval-chunk')];
  for (const c of cardChunks) c.addEventListener?.('animationend', (e) => { if (String(e.animationName ?? '').startsWith('dfnaval-chunk-r')) stowChunk(c); });
  cardHull.append(cardGhost, cardHullFill, ...cardChunks);
  const cardSail = el(doc, 'div', 'dfnaval-track sail'); const cardSailFill = el(doc, 'i', 'dfnaval-fill'); cardSail.append(cardSailFill);
  const cardState = el(doc, 'div', 'dfnaval-card-state');
  card.append(cardName, cardSub, cardHull, cardSail, cardState);
  // the aim
  const aim = el(doc, 'div', 'dfnaval-aim');
  const aimText = el(doc, 'span', 'dfnaval-aim-text'), aimRange = el(doc, 'span', 'dfnaval-aim-range'), aimTarget = el(doc, 'span', 'dfnaval-aim-target');
  aim.append(aimText, aimRange, aimTarget);
  // the warning and the tally
  const warn = el(doc, 'div', 'dfnaval-warn');
  const warnText = el(doc, 'span', 'dfnaval-warn-text'), warnKey = el(doc, 'span', 'dfnaval-warn-key');
  warn.append(warnText, el(doc, 'span', null, ' - '), warnKey);
  const tallyEl = el(doc, 'div', 'dfnaval-tally');
  const tallyHits = el(doc, 'span', 'dfnaval-tally-hits'), tallyRest = el(doc, 'span', 'dfnaval-tally-rest');
  tallyEl.append(tallyHits, tallyRest);
  // AUDIT NAV1 (the presentation): the aim and the tally one column under the crosshair - a wrapped aim pushes the
  // tally down rather than under it
  const stack = el(doc, 'div', 'dfnaval-stack');
  stack.append(aim, tallyEl);
  // the plate
  const plate = el(doc, 'div', 'dfnaval-plate');
  const head = el(doc, 'div', 'dfnaval-head');
  const name = el(doc, 'span', 'dfnaval-name');
  const waters = el(doc, 'span', 'dfnaval-waters');
  const watersWord = el(doc, 'span', 'dfnaval-waters-word');
  const anchorsBox = el(doc, 'span', 'dfnaval-anchors');
  const anchors = [0, 1, 2, 3].map(() => { const a = el(doc, 'i', 'dfnaval-anchor'); anchorsBox.append(a); return a; });
  waters.append(watersWord, anchorsBox);
  head.append(name, waters);
  const hull = bar(doc, 'hull', 'Hull'), sail = bar(doc, 'sail', 'Sails'), crew = bar(doc, 'crew', 'Crew');
  const chips = el(doc, 'div', 'dfnaval-chips');
  const rose = el(doc, 'div', 'dfnaval-rose');
  const guns = {};
  for (const side of ['bow', 'port', 'starboard', 'stern']) {
    const g = el(doc, 'div', `dfnaval-gun ${side}`);
    const fill = el(doc, 'i', 'dfnaval-gun-fill');
    const word = el(doc, 'span', 'dfnaval-gun-side', SIDE_WORDS[side]);
    const count = el(doc, 'span', 'dfnaval-gun-count');
    g.append(fill, word, count);
    guns[side] = { g, fill, count };
    rose.append(g);
  }
  rose.append(el(doc, 'i', 'dfnaval-ship'));
  const hint = el(doc, 'div', 'dfnaval-hint');
  const brace = el(doc, 'div', 'dfnaval-brace', 'Brace');
  const hold = (on) => (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); touchBrace = on; };
  brace.addEventListener?.('touchstart', hold(true), { passive: false });
  brace.addEventListener?.('touchend', hold(false), { passive: false });
  brace.addEventListener?.('touchcancel', hold(false));
  plate.append(head, hull.row, sail.row, crew.row, chips, rose, hint);
  root.append(card, warn, stack, plate, brace);   // AUDIT NAV1 (the presentation): the brace beside her, at no scale
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { card, cardName, cardSub, cardHull, cardHullFill, cardGhost, cardChunks, cardSail, cardSailFill, cardState, aim, aimText, aimRange, aimTarget, warn, warnText, warnKey, tally: tallyEl, tallyHits, tallyRest, stack, plate, name, watersWord, anchors, hull, sail, crew, chips, rose, guns, hint, brace };
  shown = {};
  touchBrace = false;
}

/** AUDIT NAV1 (the presentation): the draws' own clock (the `dt`s summed), and her hull bar's loss readout - whose card,
 *  its ghost (ui/barLoss.js), the pieces broken off and the flash's end. */
let hudClock = 0;
let loss = null;
/** A fallen piece put away (FRAME1c's law: an animation left parked on its last frame replays when its node comes back). */
function stowChunk(c) { if (c && c.className !== 'dfnaval-chunk') c.className = 'dfnaval-chunk'; }
/** One draw of her hull bar's loss: a new card starts whole at her bar; a bite of CARD_CHUNK_MIN_LOSS breaks a piece off
 *  over the span it took and flashes the card. */
function cardLoss(card, dt) {
  if (!loss || loss.id !== card.id) {
    for (const c of parts.cardChunks) stowChunk(c);
    loss = { id: card.id, g: stepGhost(null, card.hull, 0), n: -1, hits: 0, until: -1 };
  }
  const prev = loss.g;
  const g = stepGhost(prev, card.hull, dt);
  loss.g = g;
  width('cardg', parts.cardGhost, Math.round(g.at * 10) / 10);
  if (prev.pct - g.pct >= CARD_CHUNK_MIN_LOSS) {
    const { index, cls: frame } = chunkFrame(++loss.n);
    const c = parts.cardChunks[index];
    c.style.left = `${g.pct.toFixed(1)}%`;
    c.style.width = `${(prev.pct - g.pct).toFixed(1)}%`;
    c.className = `dfnaval-chunk ${frame}`;
    loss.hits++;
    loss.until = hudClock + CARD_HIT_S;
  }
  return hudClock < loss.until ? (loss.hits % 2 ? ' hit-a' : ' hit-b') : '';
}
const put = (key, node, text) => { if (shown[key] !== text) { shown[key] = text; node.textContent = text; } };
const cls = (key, node, name) => { if (shown[key] !== name) { shown[key] = name; node.className = name; } };
const show = (key, node, on) => { if (shown[key] !== on) { shown[key] = on; node.style.display = on ? '' : 'none'; } };
const width = (key, node, v) => { if (shown[key] !== v) { shown[key] = v; node.style.width = `${v}%`; } };

/** A node's box - null for none, or one not standing. */
const rectOf = (n) => { const r = n?.getBoundingClientRect?.(); return r && (r.width || r.height) ? r : null; };
/** The foe bar's step under the compass - the sheet's `:has()` law above, read for the card's column. */
const foeStep = (doc) => (doc.querySelector?.('.hud-foe.on.blade') ? NAVAL_BLADE_STEP : doc.querySelector?.('.hud-foe.on') ? NAVAL_FOE_STEP : 0);
const setVar = (name, v) => { if (shown[name] !== v) { shown[name] = v; root.style.setProperty?.(name, v); } };

/**
 * AUDIT NAV1 (the presentation): THE PLACES. The plate's foot and scale (platePlace, off her own unscaled size and the
 * rects about her: the vitals' column, the helm panel's bar, and the card's band in the column - reserved whether or
 * not a card stands, so she never jumps as the look finds a ship); her width, which the stack's room and the brace's
 * place read; and the aside card's place at her foot - left of her and her brace, no wider than the room right of the
 * quick block in its rows. On a change of the screen, the scale, the skin or her rows, and every PLATE_LAYOUT_S besides:
 * a layout read, so never every frame.
 */
function placeParts({ key, W, H, scale, short, touch, bottom, vitals, quick, helm, p, braceOn, kc, colTop }) {
  shown.layoutKey = key; shown.layoutAt = hudClock;
  const plateW = parts.plate.offsetWidth || NAVAL_PLATE_W, plateH = parts.plate.offsetHeight || 0;
  const cw = kc != null ? Math.min(400 * kc, 0.86 * W) : 0;
  const band = cw > 0 ? { left: (W - cw) / 2, right: (W + cw) / 2, bottom: colTop + NAVAL_CARD_H * kc } : null;
  const head = H / 2 + (short ? NAVAL_AIM_DOWN_SHORT : NAVAL_AIM_DOWN) * scale, sf = head + NAVAL_STACK_H * scale;   // the stack's rows
  const warn = { bottom: H / 2 - ((short ? NAVAL_WARN_UP_SHORT : NAVAL_WARN_UP) - NAVAL_WARN_H) * scale, half: (touch ? NAVAL_WARN_HALF_TOUCH : NAVAL_WARN_HALF) * scale + PLATE_GAP };
  const at = p && W > 0 && H > 0
    ? platePlace({ scale, W, H, plateW, plateH, bottom, vitals: rectOf(vitals), over: [helm, band], bands: [warn, { bottom: sf, half: NAVAL_STACK_HALF * scale + PLATE_GAP }] })
    : { scale, bottom };
  const pw = p ? Math.round(plateW * at.scale) : 0;
  const right = 18 + (p ? pw + (braceOn ? 8 + NAVAL_BRACE_W : 0) + PLATE_GAP : 0);
  const q = rectOf(quick);
  const rows = [H - at.bottom - NAVAL_CARD_ASIDE_H * scale, H - at.bottom];
  const from = q && q.bottom > rows[0] && q.top < rows[1] ? q.right + PLATE_GAP : 18;
  // the stack's width: the widest column centred on the screen clear of what shares its rows (her, the quick block)
  let half = W / 2 - 18;
  if (p && H - at.bottom - plateH * at.scale < sf) half = Math.min(half, W / 2 - 18 - pw - PLATE_GAP);
  if (q && q.top < sf && q.bottom > head) half = Math.min(half, W / 2 - q.right - PLATE_GAP);
  setVar('--nc-plate-scale', String(Math.round(at.scale * 1000) / 1000));
  setVar('--nc-plate-w', `${pw}px`);
  setVar('--nc-foot', `${at.bottom}px`);
  setVar('--nc-card-right', `${right}px`);
  if (W > 0) {
    setVar('--nc-card-max', `${Math.max(0, Math.floor((W - right - from) / Math.max(scale, 0.01)))}px`);
    setVar('--nc-stack-max', `${Math.max(0, Math.floor((2 * half) / Math.max(scale, 0.01)))}px`);
  }
}

/**
 * Draw the readout for a model (null hides it). `covered` - the HUD's own hide, a window over the world, a pause;
 * `keys` the registry's names for the aim, Activate and the brace; `scale` the HUD's scale (the enhanced HUD's
 * --hud-scale, which this sibling layer copies onto its root - the plate's size and the card's place read it);
 * `under` what stands over the card at the top of the screen (the helm panel's bar, ui/enhancedHelm.js) or null;
 * `touch` a finger's screen (the plate over the touch corner, the hints in its words). `dt` the frame's seconds (0 while
 * the game is paused) - the clock her hull bar's loss readout runs on. AUDIT NAV1 (the presentation): `vitals` the
 * enhanced HUD's bottom column the plate keeps clear of, `quick` its quick block the aside card keeps clear of, and
 * `compass` the classic skin's compass box ({ w, h } in CSS px - it stands in the plate's corner), on that skin alone.
 */
export function drawNavalHud(model, { covered = false, doc = globalThis.document, keys = {}, scale = 1, under = null, touch = false, dt = 0, vitals = null, quick = null, compass = null } = {}) {
  const want = !covered && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  show('root', root, want);
  hudClock += Math.max(0, Number(dt) || 0);
  if (!want) { shown.braceBtn = false; touchBrace = false; for (const c of parts.cardChunks) stowChunk(c); loss = null; return; }
  const t = navalHudText(model, keys, { touch });
  // the card: a ship's, else the fight's (AUDIT NAV1 B9) - one place under the compass
  const c = t.card ?? t.fight;
  const p = t.plate;
  const braceOn = !!p?.brace;
  // AUDIT NAV1 (the presentation): the screen - short in the HUD's own pixels? - and the layout's key
  const win = doc.defaultView ?? globalThis;
  const W = win.innerWidth ?? 0, H = win.innerHeight ?? 0;
  const short = H > 0 && H <= NAVAL_SHORT_H * scale;
  const bottom = compass ? Math.round(compass.h) + PLATE_GAP : touch ? NAVAL_PLATE_TOUCH_BOTTOM : NAVAL_PLATE_BOTTOM;
  const key = [W, H, scale, touch, bottom, p ? `${p.sail != null}${p.crew != null}${p.batteries.length > 0}${p.chips.length > 0}${braceOn}${p.hint}` : '-'].join('|');
  const due = key !== shown.layoutKey || hudClock - shown.layoutAt >= PLATE_LAYOUT_S;
  // the helm panel's bar - its foot the card's head, and over her columns the plate's ceiling - read before this frame's
  // writes here, and only while a card stands or the layout is due
  const read = !under || !!c || due;
  const helm = under && read ? rectOf(under) : null;
  const foot = helm?.bottom ?? 0;
  // the card's column: its head (under the helm panel, else the sheet's law) and its scale there - or aside; kept from
  // the last read while the panel goes unmeasured
  if (due) shown.foe = foot > 0 ? 0 : foeStep(doc);
  if (read) {
    const colTop = foot > 0 ? Math.ceil(foot) + NAVAL_CARD_GAP : cardTopPx(scale, shown.foe ?? 0);
    shown.col = { colTop, kc: !(H > 0) ? scale : short ? null : cardScale({ scale, H, top: colTop, warn: !!p }) };
  }
  const { colTop, kc } = shown.col;
  const aside = kc == null;
  if (shown.scale !== scale) { shown.scale = scale; root.style.setProperty?.('--hud-scale', String(scale)); }
  cls('rootc', root, `dfnaval-hud${touch ? ' touch' : ''}${compass ? ' classic' : ''}${short ? ' short' : ''}${aside ? ' aside' : ''}`);
  show('plate', parts.plate, !!p);
  if (shown.braceBtn !== braceOn) { shown.braceBtn = braceOn; parts.brace.style.display = braceOn ? '' : 'none'; if (!braceOn) touchBrace = false; }
  cls('bracec', parts.brace, braceOn && touchBrace ? 'dfnaval-brace down' : 'dfnaval-brace');
  if (p) {
    put('name', parts.name, p.name);
    put('waters', parts.watersWord, p.waters);
    for (let i = 0; i < 4; i++) cls(`anchor${i}`, parts.anchors[i], i < p.anchors ? 'dfnaval-anchor on' : 'dfnaval-anchor');
    width('hull', parts.hull.fill, p.hull);
    cls('hullLow', parts.hull.track, p.hull <= 25 ? 'dfnaval-track hull low' : 'dfnaval-track hull');
    show('sailRow', parts.sail.row, p.sail != null);
    if (p.sail != null) width('sail', parts.sail.fill, p.sail);
    show('crewRow', parts.crew.row, p.crew != null);
    if (p.crew != null) width('crew', parts.crew.fill, p.crew);
    const chipKey = p.chips.join(',');
    if (shown.chips !== chipKey) {
      shown.chips = chipKey;
      parts.chips.textContent = '';
      for (const c of p.chips) parts.chips.append(el(doc, 'span', `dfnaval-chip ${c}`, CHIP_WORDS[c]));
    }
    for (const side of ['bow', 'port', 'starboard', 'stern']) {
      const g = parts.guns[side];
      const b = p.batteries.find((x) => x.side === side);
      show(`gun-${side}`, g.g, !!b);
      if (!b) continue;
      cls(`gunc-${side}`, g.g, `dfnaval-gun ${side}${b.ready ? ' ready' : ''}${b.fresh ? ' fresh' : ''}${b.active ? ' active' : ''}${b.empty ? ' gun-empty' : ''}`);
      put(`gunn-${side}`, g.count, b.count);
      if (shown[`gunf-${side}`] !== b.fill) { shown[`gunf-${side}`] = b.fill; g.fill.style.height = `${b.fill}%`; }
    }
    show('rose', parts.rose, p.batteries.length > 0);
    put('hint', parts.hint, p.hint);
  }
  if (due) placeParts({ key, W, H, scale, short, touch, bottom, vitals: compass ? null : vitals, quick, helm, p, braceOn, kc, colTop });
  // the aim - on a short screen its range and state alone (the rose's lit side is the battery)
  show('aim', parts.aim, !!t.aim);
  if (t.aim) {
    cls('aimc', parts.aim, t.aim.hot ? 'dfnaval-aim hot' : t.aim.dim ? 'dfnaval-aim dim' : 'dfnaval-aim');
    put('aimt', parts.aimText, short && t.aim.range ? '' : t.aim.text);
    put('aimr', parts.aimRange, t.aim.range);
    put('aimg', parts.aimTarget, t.aim.target);
  }
  // the warning, and the last volley's tally (under the aim's line while the aim is up - on a short screen it waits)
  show('warn', parts.warn, !!t.warn);
  if (t.warn) { put('warnt', parts.warnText, t.warn.text); put('warnk', parts.warnKey, t.warn.key); }
  show('tally', parts.tally, !!t.tally && !(short && t.aim));
  if (t.tally) {
    cls('tallyc', parts.tally, t.tally.miss ? 'dfnaval-tally miss' : 'dfnaval-tally');
    put('tallyh', parts.tallyHits, t.tally.hits);
    put('tallyr', parts.tallyRest, t.tally.rest);
  }
  // the card - under the compass by the sheet's law (--nc-top), under the helm panel's foot while it stands, at the
  // column's scale; aside, at the plate's foot (the sheet's .aside law)
  show('card', parts.card, !!c);
  if (c) {
    const top = !aside && foot > 0 ? `${colTop}px` : '';
    if (shown.cardTop !== top) { shown.cardTop = top; parts.card.style.top = top; }
    setVar('--nc-card-scale', aside ? '' : String(Math.round(kc * 1000) / 1000));
    const hit = t.card ? cardLoss(t.card, dt) : '';
    if (!t.card) { for (const x of parts.cardChunks) stowChunk(x); loss = null; }
    cls('cardc', parts.card, t.card ? `dfnaval-card ${t.card.faction}${t.card.hostile ? ' hostile' : ''}${t.card.friendly ? ' friendly' : ''}${hit}` : 'dfnaval-card fight');
    put('cardn', parts.cardName, c.name);
    put('cards', parts.cardSub, c.sub);
    show('cardhull', parts.cardHull, !!t.card);
    if (t.card) width('cardh', parts.cardHullFill, t.card.hull);
    show('cardsail', parts.cardSail, t.card?.sail != null);
    if (t.card?.sail != null) width('cardsl', parts.cardSailFill, t.card.sail);
    put('cardst', parts.cardState, t.card ? t.card.state : c.state);
    const kind = t.card ? t.card.stateKind : c.kind;
    cls('cardstc', parts.cardState, `dfnaval-card-state${kind ? ` ${kind}` : ''}`);
  }
}

// ── AUDIT NAV1 (the presentation, #14): THE SHIPS' TAGS ──────────────────────────────────────────────────────────
let tagRoot = null;
/** @type {any[]} */
let tagSlots = [];
/** SHIP-CLUTTER: the ids a frame's layout left out (TAG_HOLD). */
let tagHeld = new Set();
/** A tag's state in words - the card's for a ship out of reach (going down, taken, boarded, her colours struck) - and
 *  none while she sails: her red says hostile. */
export function tagState(t) {
  return t.state === 'afloat' && !t.boarded ? '' : cardState(t, null, '').text;
}
/** SHIP-TAGS (2026-10-02, Mac: "Improve the enemy and friendly UI substationally"): a tag's second line within
 *  TAG_DETAIL_M of the eye - her class (a crown's ship by her crown) and where she is bound - and none past it, where a
 *  name and a bar are what can be read. */
export const TAG_DETAIL_M = 400;
export function tagLine(t) {
  if (!((t.distance ?? Infinity) <= TAG_DETAIL_M)) return '';
  return [t.line, t.bound].filter(Boolean).join(' - ');
}
/** A tag's opacity by her distance: whole to `from` (TAG_FADE_FROM), TAG_FADE_TO at the tags' `reach`. */
export const tagAlpha = (d, reach, from = TAG_FADE_FROM) => 1 - (1 - TAG_FADE_TO) * Math.max(0, Math.min(1, ((d ?? 0) - from) / Math.max(1, reach - from)));
/** SHIP-CLUTTER (2026-10-02, Discord: "The sea screen shows an overabundance of ship text on the high seas"): every
 *  tag stood on its own spar with nothing between them, and each within TAG_DETAIL_M read its second line - off a
 *  harbour five ships' names and five "Wayrest Navy Cutter - patrolling off Joyous Light of Akatosh" ran through each
 *  other into one smear. `layoutNavalTags` now lays them:
 *   - ONE second line: the card's ship's, else the tag nearest the crosshair (`focus`) within TAG_FOCUS_PX - looked
 *     at, a ship says what she is; with no crosshair handed in, the nearest ship's;
 *   - NO TAG OVER ANOTHER: laid the line's ship first, then the hostile, then the nearest, a tag whose box would
 *     touch one already laid (TAG_CLEAR apart) is not drawn this frame; one left out last frame needs TAG_HOLD more
 *     room to come back, so a bobbing view never flickers it at the edge.
 *  A tag's box is read off its words (`navalTagBox`: the 11px face's advances measured on the game's own page in
 *  Chromium - an uppercase name 7.5 px a letter at its 0.08em, a line 7.3 at its 0.06em; a state the name's with its
 *  wider 0.1em - each rounded up), never off the page in a frame (the bubbles' law, crewSayBox). */
export const TAG_FOCUS_PX = 140;
export const TAG_NAME_CHAR_W = 7.6;
export const TAG_LINE_CHAR_W = 7.4;
export const TAG_STATE_CHAR_W = 7.9;
export const TAG_TEXT_H = 13;
export const TAG_ROW_GAP = 2;
export const TAG_BAR_H = 4;
export const TAG_CLEAR = 3;
export const TAG_HOLD = 8;
/** A tag's box in CSS px at the HUD's `scale`, her point at its foot's middle (the sheet's translate(-50%, -100%)):
 *  her name, her line when `detail`, her bar, her state. */
export function navalTagBox(t, detail = false, scale = 1) {
  const line = detail ? tagLine(t) : '', state = tagState(t);
  const w = Math.max(String(t.name ?? '').length * TAG_NAME_CHAR_W, line.length * TAG_LINE_CHAR_W, state.length * TAG_STATE_CHAR_W, NAVAL_TAG_BAR_W) * scale;
  const rows = 1 + (line ? 1 : 0) + (state ? 1 : 0);
  const h = (rows * (TAG_TEXT_H + TAG_ROW_GAP) + TAG_BAR_H) * scale;
  return { left: t.x - w / 2, right: t.x + w / 2, top: t.y - h, bottom: t.y };
}
/** The tags as drawn (SHIP-CLUTTER): the ones that stand clear of each other, in the order handed in, each with
 *  `detail` - whether her second line is read. `held` is the ids left out last frame (TAG_HOLD). */
export function layoutNavalTags(points, { scale = 1, focus = null, held = null } = {}) {
  const list = (points ?? []).filter(Boolean);
  let lead = list.find((t) => t.target) ?? null;
  if (!lead && focus) {
    let best = TAG_FOCUS_PX * scale;
    for (const t of list) {
      const d = Math.hypot(t.x - focus.x, t.y - focus.y);
      if (d <= best) { best = d; lead = t; }
    }
  } else if (!lead) {
    for (const t of list) if (!lead || (t.distance ?? Infinity) < (lead.distance ?? Infinity)) lead = t;
  }
  const rank = (t) => (t === lead ? 0 : t.hostile ? 1 : 2);
  const order = [...list].sort((a, b) => rank(a) - rank(b) || (a.distance ?? Infinity) - (b.distance ?? Infinity));
  const placed = [], keep = new Map();
  for (const t of order) {
    const detail = t === lead && tagLine(t) !== '';
    const b = navalTagBox(t, detail, scale);
    const pad = (TAG_CLEAR + (held?.has(t.id) ? TAG_HOLD : 0)) * scale;
    if (placed.some((q) => b.left - pad < q.right && b.right + pad > q.left && b.top - pad < q.bottom && b.bottom + pad > q.top)) continue;
    placed.push(b);
    keep.set(t, detail);
  }
  return list.filter((t) => keep.has(t)).map((t) => ({ ...t, detail: keep.get(t) }));
}
/**
 * The tags over the sea's ships (the host's `tags`, projected by the world onto the screen - `x`, `y` the point over
 * her highest spar in CSS px): her name in her trade's colour (a hostile ship's red), her hull, her state - the card's
 * ship ringed - at the HUD's `scale`, fading with her distance to the tags' `reach`. One node a slot, moved, never
 * rebuilt (the names' discipline); `covered` (a window, a pause, the HUD hidden) hides them all. SHIP-CLUTTER: laid
 * clear of each other first (layoutNavalTags), one second line, read for the ship nearest the crosshair at `focus`.
 */
export function drawNavalTags(points, { covered = false, doc = globalThis.document, scale = 1, reach = 700, focus = null } = {}) {
  const want = covered ? [] : layoutNavalTags(points, { scale, focus, held: tagHeld });
  const drawn = new Set(want.map((t) => t.id));
  tagHeld = new Set((covered ? [] : points ?? []).filter((t) => t && !drawn.has(t.id)).map((t) => t.id));
  if (!tagRoot) {
    if (!want.length || !doc?.createElement) return;
    injectSheets(doc);
    tagRoot = el(doc, 'div', 'dfnaval-tags');
    tagRoot.setAttribute?.('aria-hidden', 'true');
    (doc.body ?? doc.documentElement)?.append(tagRoot);
  }
  while (tagSlots.length < want.length) {
    const n = el(doc, 'div', 'dfnaval-tag');
    const name = el(doc, 'span', 'dfnaval-tag-name'), line = el(doc, 'span', 'dfnaval-tag-line'), bar = el(doc, 'span', 'dfnaval-tag-bar'), fill = el(doc, 'i'), state = el(doc, 'span', 'dfnaval-tag-state');
    bar.append(fill);
    n.append(name, line, bar, state);
    tagRoot.append(n);
    tagSlots.push({ n, name, line, fill, state, k: {} });
  }
  tagSlots.forEach((slot, i) => {
    const t = want[i];
    const on = !!t;
    if (slot.k.on !== on) { slot.k.on = on; slot.n.style.display = on ? '' : 'none'; }
    if (!t) return;
    const set = (key, v, write) => { if (slot.k[key] !== v) { slot.k[key] = v; write(v); } };
    set('cls', `dfnaval-tag ${t.faction}${t.hostile ? ' hostile' : ''}${t.friendly && !t.hostile ? ' friendly' : ''}${t.target ? ' target' : ''}`, (v) => { slot.n.className = v; });
    set('name', t.name, (v) => { slot.name.textContent = v; });
    set('line', t.detail ? tagLine(t) : '', (v) => { slot.line.textContent = v; });
    set('hull', pct(t.hull), (v) => { slot.fill.style.width = `${v}%`; });
    set('state', tagState(t), (v) => { slot.state.textContent = v; });
    set('at', `translate(${Math.round(t.x)}px, ${Math.round(t.y)}px) scale(${scale}) translate(-50%, -100%)`, (v) => { slot.n.style.transform = v; });
    set('a', String(Math.round(tagAlpha(t.distance, reach) * Math.max(0, Math.min(1, t.fade ?? 1)) * 100) / 100), (v) => { slot.n.style.opacity = v; });   // SHIP-FADE: with her
  });
}

/** SHIPMATES: the player's own crew's bars (the constants beside the ships' tags, whose sheet they share). COMPANION-KIT
 *  (2026-10-01, Mac: "improved detailed health bar with buffs and their name"): a companion's point carries `name`, `hp`
 *  and `hpMax` and `fx` (partyBuffs.js composePartyFx's - his live effects) - his bar is wider, his name and health over
 *  it and his effects' icons under it (the spell's icon, its first letters while the sheet is on its way).
 *  AUDIT WK-U8: `fxPicture(i, { box, dpr })` is an effect's picture fitted to its tile (`{ src, w, h, smooth }` or null) -
 *  spellIconPicture's own; a seam so the pins can hand one in without the sheet (the party card's `fxIcon` hands a URL). */
let crewSlots = [];
export function drawCrewBars(points, { covered = false, doc = globalThis.document, scale = 1, fxPicture = null } = {}) {
  const want = covered ? [] : points ?? [];
  if (!tagRoot) {
    if (!want.length || !doc?.createElement) return;
    injectSheets(doc);
    tagRoot = el(doc, 'div', 'dfnaval-tags');
    tagRoot.setAttribute?.('aria-hidden', 'true');
    (doc.body ?? doc.documentElement)?.append(tagRoot);
  }
  while (crewSlots.length < want.length) {
    const n = el(doc, 'div', 'dfnaval-crew'), fill = el(doc, 'i');
    const name = el(doc, 'span', 'dfnaval-crew-name'), word = el(doc, 'span'), hp = el(doc, 'span', 'dfnaval-crew-hp'), fx = el(doc, 'div', 'dfnaval-crew-fx');
    name.append(word, hp);
    n.append(fill, name, fx);
    tagRoot.append(n);
    crewSlots.push({ n, fill, word, hp, fx, k: {} });
  }
  // AUDIT WK-U8: the tiles' device pixels - the screen's times the HUD's scale, which the bar rides as its transform (the
  // HUD's spell chip reads its own so, ui/enhancedHud.js)
  const dpr = clampDpr(screenDpr() * scale);
  const iconOf = fxPicture ?? spellIconPicture;
  crewSlots.forEach((slot, i) => {
    const p = want[i];
    const on = !!p;
    if (slot.k.on !== on) { slot.k.on = on; slot.n.style.display = on ? '' : 'none'; }
    if (!p) return;
    const set = (key, v, write) => { if (slot.k[key] !== v) { slot.k[key] = v; write(v); } };
    set('share', pct(p.share), (v) => { slot.fill.style.width = `${v}%`; });
    // COMPANION-KIT: a companion's name, his health in digits and his effects; a deck hand's bar stays bare
    const mate = typeof p.name === 'string' && p.name.length > 0;
    set('cls', mate ? 'dfnaval-crew mate' : 'dfnaval-crew', (v) => { slot.n.className = v; });
    set('name', mate ? p.name : '', (v) => { slot.word.textContent = v; });
    set('hp', mate && Number.isFinite(p.hp) && Number.isFinite(p.hpMax) && p.hpMax > 0 ? `${Math.max(0, Math.round(p.hp))}/${Math.round(p.hpMax)}` : '', (v) => { slot.hp.textContent = v; });
    const fx = mate && Array.isArray(p.fx) ? p.fx.slice(0, MATE_FX_MAX) : [];
    // AUDIT WK-U8: THE FIT LAW (ui/iconFit.js) - the spell's 16px icon fitted to its tile at the tile's own device pixels:
    // whole ones where they keep the box, a smooth reduction under one, never a pixelated one. The bar drew the icon's
    // 2x cut squeezed into 12px under `pixelated` - 0.375 of the cut on a 1x screen, and of 16 columns a few stood.
    const pics = fx.map((e) => { try { return iconOf(e.i, { box: MATE_FX_BOX, dpr }); } catch { return null; } });
    set('fx', `${partyFxKey(fx)}#${pics.map((u) => (u ? 1 : 0)).join('')}@${dpr}`, () => {
      slot.fx.replaceChildren?.();
      fx.forEach((e, k) => {
        const tile = el(doc, 'span', `dfnaval-crew-fxe${e.d ? ' debuff' : ''}`);
        if (pics[k]) { const img = el(doc, 'img'); img.alt = ''; tile.append(showFitted(img, pics[k])); } else tile.textContent = partyFxAbbrev(e.n);
        tile.setAttribute?.('title', `${e.n || 'Spell'} - ${e.r} rounds`);
        slot.fx.append(tile);
      });
    });
    set('at', `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) scale(${scale}) translate(-50%, -100%)`, (v) => { slot.n.style.transform = v; });
    set('a', String(Math.round(tagAlpha(p.distance, CREW_BAR_RANGE, CREW_FADE_FROM) * 100) / 100), (v) => { slot.n.style.opacity = v; });
  });
}

/**
 * LIVING CREW: the lines over the crew's heads - `points` `[{ x, y, text, kind, distance }]` (the world's projection of
 * each head), the CREW_SAY_MAX nearest drawn: a bubble a line, moved and re-worded, never rebuilt, at the HUD's scale,
 * fading with the distance; a window over the world hides them all.
 */
let saySlots = [];
let sayMemory = crewSayMemory();   // FIELD BUGS 2026-10-02b CREW-SAY: the stacks' order and their lifts, frame to frame
export function drawCrewLines(points, { covered = false, doc = globalThis.document, scale = 1, dt = 0 } = {}) {
  const want = covered ? [] : layoutCrewLines(points, { scale, memory: sayMemory, dt, top: 0 });   // CREW-SAY: laid out, never over each other
  if (!tagRoot) {
    if (!want.length || !doc?.createElement) return;
    injectSheets(doc);
    tagRoot = el(doc, 'div', 'dfnaval-tags');
    tagRoot.setAttribute?.('aria-hidden', 'true');
    (doc.body ?? doc.documentElement)?.append(tagRoot);
  }
  while (saySlots.length < want.length) {
    const n = el(doc, 'div', 'dfnaval-say');
    tagRoot.append(n);
    saySlots.push({ n, k: {} });
  }
  saySlots.forEach((slot, i) => {
    const p = want[i];
    const on = !!p;
    if (slot.k.on !== on) { slot.k.on = on; slot.n.style.display = on ? '' : 'none'; }
    if (!p) return;
    const set = (key, v, write) => { if (slot.k[key] !== v) { slot.k[key] = v; write(v); } };
    set('text', p.text, (v) => { slot.n.textContent = v; });
    set('kind', p.kind === 'sing' || p.kind === 'shout' ? `dfnaval-say ${p.kind}` : 'dfnaval-say', (v) => { slot.n.className = v; });
    set('at', `translate(${Math.round(p.x)}px, ${Math.round(p.y - p.lift)}px) scale(${scale}) translate(-50%, calc(-100% - ${CREW_SAY_LIFT}px))`, (v) => { slot.n.style.transform = v; });
    set('a', String(Math.round(tagAlpha(p.distance, CREW_SAY_RANGE, CREW_SAY_FADE_FROM) * 100) / 100), (v) => { slot.n.style.opacity = v; });
    set('z', String(CREW_SAY_MAX - i), (v) => { slot.n.style.zIndex = v; });   // CREW-SAY: the nearest over the rest
  });
}

/** The page is going (a test's reset, the host's teardown): the node leaves with it. */
export function destroyNavalHud() {
  root?.remove?.();
  root = null; parts = null; shown = {}; touchBrace = false; loss = null; hudClock = 0;
  tagRoot?.remove?.();
  tagRoot = null; tagSlots = []; tagHeld = new Set(); crewSlots = []; saySlots = []; sayMemory = crewSayMemory();
}
