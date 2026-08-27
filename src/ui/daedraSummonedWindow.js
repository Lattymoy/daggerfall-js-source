// G7b - THE DAEDRA SUMMONED WINDOW (DaggerfallDaedraSummonedWindow,
// MIT Daggerfall Workshop): the prince's own .FLC playing fullscreen
// (320x200, looping - FLCPlayer's default) with the quest offer read
// over it in FOUR-LINE CHUNKS, a click (or any key) turning the page,
// and the LAST chunk waiting on Yes/No: accept starts the quest,
// refuse looses 3-5 daedra on the summoner's floor (:83-88 - FLAGGED
// through the host door, the interior foe pool's standing gap). The
// answer's own message then reads through the same chunks and the
// last click closes.
//
// The port's window consumes the offer-flow STEP directly
// ({ kind:'offer', prompt, respond }) - the same machinery the
// ServiceFlowWindow boxes wrap - so accept/refuse run the machine's
// real arms (startQuestImmediate, the rumor/topic sweeps) and this
// window is presentation alone. The host falls back to the box chain
// when the FLC cannot load - the never-traps rule.
//
// TextLinesPerChunk = 4 (:26): DFU steps TOKENS by eight (four
// text+newline pairs); the port flattens tokens to LINES first (the
// same pairing tokensToRows reads) and steps four at a time - one
// law, two spellings, recorded.

import { FlcFile } from '../formats/flcFile.js';
import { FlcPlayer } from './flcPlayer.js';
import { nativeMetrics, shadowText } from './nativePanel.js';
import { measureText } from './text.js';

export const TEXT_LINES_PER_CHUNK = 4;   // :26
/** daedricFoes[Random.Range(0,5)], Random.Range(3,6) foes at 8..64
 *  units (:86-87) - the SUMMONED window's own refusal spawn, distinct
 *  from the quest popup's 1-3 at 4..64. */
export const REFUSAL_FOE_COUNT = [3, 5];

/** Message tokens -> plain lines: text tokens append, every
 *  formatting token breaks - the pairing loadMessage emits (the same
 *  law scenes/questBridge.tokensToRows applies; re-spelled here
 *  because ui must not import a scene). */
export function tokensToLines(tokens) {
  const lines = [];
  let line = '';
  let sawText = false;
  for (const t of tokens ?? []) {
    if (t.formatting === 'text') { line += t.text; sawText = true; continue; }
    lines.push(line);
    line = '';
    sawText = false;
  }
  if (sawText) lines.push(line);
  return lines;
}

export class DaedraSummonedWindow {
  /**
   * hooks:
   *   flcBytes        - the loaded .FLC file bytes (host fetches; a
   *                     failed fetch never reaches this window)
   *   offerStep       - { kind:'offer', prompt, respond } from the
   *                     offer flow (offerNamedQuest)
   *   spawnRefusalFoes() - optional; the daedric punishment (FLAGGED:
   *                     no host mounts it - the interior has no pool)
   *   onClose()
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;
    this.answerGiven = false;
    this.lastChunk = false;
    this.idx = 0;
    this._texKey = null;
    this._frameRef = null;
    this._tex = null;
    this._cursorT = 0;
    // the FLC: loaded synchronously off the fetched bytes; ready or
    // this window should not have been mounted
    this.flc = new FlcFile();
    try { this.flc.load(hooks.flcBytes, hooks.flcName ?? 'SUMMON.FLC'); } catch { /* readyToPlay stays false */ }
    this.player = new FlcPlayer(this.flc, { loop: true });   // FLCPlayer.Loop defaults true (:38)
    if (this.flc.readyToPlay) this.player.start();
    this.lines = tokensToLines(hooks.offerStep?.prompt?.tokens ?? []);
    this._advanceChunk();   // DisplayNextTextChunk at Setup (:112)
  }

  /** DisplayNextTextChunk (:118-131): the next four lines; reaching
   *  the tail sets lastChunk. */
  _advanceChunk() {
    this.chunk = this.lines.slice(this.idx, this.idx + TEXT_LINES_PER_CHUNK);
    this.idx += TEXT_LINES_PER_CHUNK;
    if (this.idx >= this.lines.length) this.lastChunk = true;
  }

  _close() {
    if (this.done) return;   // one close, however many keys land on the tail
    this.done = true;
    this.player.stop();
    this.hooks.onClose?.();
  }

  /** HandleAnswer (:139-151) + the Update answer keys (:75-89): the
   *  machine's real respond, then the ANSWER's message through the
   *  same chunks. */
  _answer(yes) {
    if (this.answerGiven) return;
    this.answerGiven = true;
    const r = this.hooks.offerStep?.respond?.(yes) ?? null;
    if (!yes) this.hooks.spawnRefusalFoes?.();
    this.lines = tokensToLines(r?.popup?.tokens ?? []);
    this.idx = 0;
    this.lastChunk = false;
    if (!this.lines.length) { this._close(); return; }
    this._advanceChunk();
  }

  /** A click anywhere: next chunk, or (past the answer's last chunk)
   *  the close - PlayerPanel_OnMouseClick (:154-160). Before the
   *  answer the LAST chunk waits on Yes/No and a click does nothing,
   *  exactly as DFU's click handler returns on lastChunk. */
  _page() {
    if (this.lastChunk) {
      if (this.answerGiven) this._close();
      return;
    }
    this._advanceChunk();
  }

  click() { this._page(); return true; }

  input(code) {
    if (this.lastChunk && !this.answerGiven) {
      if (code === 'KeyY' || code === 'Enter') { this._answer(true); return; }
      if (code === 'KeyN' || code === 'Escape') { this._answer(false); return; }
      return;   // the last offer chunk answers to Y/N alone
    }
    this._page();
  }

  tick(dt) {
    this.player.tick(dt);
    this._cursorT += dt;
  }

  draw(renderer, canvas, font) {
    this._renderer = renderer;   // the drain calls dispose() bare
    const m = nativeMetrics(canvas);
    // the FLC frame, fullscreen 320x200 (Setup :103-108), under the
    // chargen release-then-upload law so a tick cannot leak a texture
    const frame = this.player.frame;
    if (frame && this._frameRef !== frame) {
      if (this._texKey) renderer.releaseTexture('img', this._texKey);
      this._texKey = 'daedraSummon:flc';
      this._tex = renderer.uploadTexture('img', this._texKey, frame);
      this._frameRef = frame;
    }
    if (this._tex && frame) {
      renderer.drawScreenQuad(this._tex, { x: m.ox, y: m.oy, w: 320 * m.s, h: 200 * m.s });
    } else {
      renderer.drawScreenQuad(null, { x: m.ox, y: m.oy, w: 320 * m.s, h: 200 * m.s }, undefined, [0, 0, 0, 1]);
    }
    // the text chunk at the bottom (VerticalAlignment.Bottom with the
    // player's 13-pixel BottomMargin, :106)
    const lineH = 8;
    const baseY = 200 - 13 - this.chunk.length * lineH;
    this.chunk.forEach((text, i) => {
      const w = font?.fnt ? measureText(font.fnt, text) : text.length * 6;
      shadowText(renderer, font, text, m, Math.round((320 - w) / 2), baseY + i * lineH);
    });
    // the blinking cursor under the chunk (TextCursor, enabled while
    // more text or an answer waits)
    if (!(this.lastChunk && this.answerGiven) && Math.floor(this._cursorT * 2) % 2 === 0) {
      shadowText(renderer, font, '_', m, 158, baseY + this.chunk.length * lineH);
    }
  }

  dispose() {
    if (this._texKey && this._renderer) this._renderer.releaseTexture('img', this._texKey);
    this._texKey = null;
  }
}
