// MENU: THE SETTINGS SCREEN.
//
// Replaces the first launcher, which listed 171 raw ini keys in ini
// order and shipped keyboard-only. What that screen taught, and what
// this one is built around:
//
//   ONE LAYOUT. draw(), click() and the probe all read the value of a
//   single layout(canvas) call. The old launcher held two copies of
//   its coordinates, which is why its first touch fix "worked" while
//   still drawing PLAY where no finger could reach. That is not a
//   style preference here; it is the audit's own law.
//
//   TIER IS A GROUP, NOT A FILTER. Every category is three groups -
//   WORKS NOW / SAVED FOR LATER / NOT AVAILABLE HERE - each with its
//   count in the heading. Nothing is ever hidden (a player can always
//   see that Video has 61 saved settings), but a beginner meets a
//   short list because the last two ship folded. This is what lets an
//   honest screen sit over a store that is 8 live, 145 stored and 18
//   unavailable without either lying or overwhelming.
//
//   NEVER A RAW VALUE. `True` reads On, `4` reads Beautiful, `0.5`
//   reads 50%. The ini key appears in one place only: the detail
//   dialog, for the player who wants it.
import { settingsMetrics, pointToPage, tapMin } from './settingsMetrics.js';
import { CATEGORIES, keysOf } from './settingsMap.js';
import { labelOf, helpOf, TIER_TEXT, INSTEAD } from './settingsCopy.js';
import { widgetFor, formatValue, stepValue, blockedReason } from './settingsLaw.js';
import { effectiveSettings, setValue, saveSettings, resetToDefaults, tierOf, DEFAULTS } from '../systems/settings.js';
import { getPref, setPref, isOpen, setOpen } from '../systems/uiPrefs.js';
import { measureText, drawText } from './text.js';
import { drawRect, shadowText } from './nativePanel.js';
import { wrapText } from './talkWindow.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

// ---- palette. Every pair carries its contrast; nothing is signalled
// by colour alone (a focused row also gets a tick and a bracket). ----
export const INK = [0.04, 0.04, 0.05, 1];
export const PANEL = [0.14, 0.13, 0.12, 1];
export const PANEL_DEEP = [0.09, 0.085, 0.08, 1];
export const RULE = [0.30, 0.28, 0.24, 1];
export const TEXT = [0.92, 0.89, 0.80, 1];
export const TEXT_SOFT = [0.72, 0.69, 0.60, 1];
export const HEADING = [1.0, 0.86, 0.45, 1];
export const FOCUS = [0.95, 0.78, 0.32, 1];
export const OKAY = [0.62, 0.85, 0.55, 1];
export const WARN = [1.0, 0.55, 0.40, 1];

const LINE_H = 9;
const TITLE_H = 11;
const GROUPS = [
  { id: 'live', title: 'WORKS NOW', tier: 'live' },
  { id: 'stored', title: 'SAVED FOR LATER', tier: 'stored' },
  { id: 'na', title: 'NOT AVAILABLE HERE', tier: 'unavailable' },
];

const inRect = ([x, y, w, h], px, py) => px >= x && py >= y && px < x + w && py < y + h;

export class SettingsWindow {
  constructor({ onLaunch = () => {}, dataSourceLabel = '' } = {}) {
    this.onLaunch = onLaunch;
    this.dataSourceLabel = dataSourceLabel;
    this.done = false;
    this.isChoiceWindow = true;
    this.category = getPref('category');
    if (!CATEGORIES.some((c) => c.id === this.category)) this.category = 'game';
    this.focus = 0;          // index into the flat item list
    this.scroll = 0;
    this.saveFailed = false;
    this.dialog = null;      // { title, lines, buttons }
    this._font = null;
  }

  get textScale() { return getPref('textScale'); }

  /** How many of this category's keys sit in each tier - computed,
   *  never typed, so the header tally cannot drift from the store. */
  tally(catId = this.category) {
    const t = { live: 0, stored: 0, unavailable: 0 };
    for (const k of keysOf(catId)) t[tierOf(k)]++;
    return t;
  }

  /** THE ONE LAYOUT. Everything that draws, everything that can be
   *  clicked, and everything the probe reports comes from here. */
  layout(canvas, font = this._font) {
    const m = settingsMetrics(canvas, { textScale: this.textScale });
    const P = m.pageW;
    const H = m.pageH;
    const TAP = tapMin(m);
    const wide = P >= 260;
    const ROW_BASE = Math.max(18, TAP);
    const GROUP_H = Math.max(13, TAP);
    const CAT_H = Math.max(14, TAP);
    const FOOT_H = TAP + 2;
    const HELP_LINES = wide ? 3 : 4;
    const HELP_H = (HELP_LINES + 1) * LINE_H + 3;

    const hit = [];
    const push = (id, rect, kind) => { hit.push({ id, rect, kind }); return rect; };

    // --- chrome ---
    const titlebar = [0, 0, P, TITLE_H];
    const footY = H - FOOT_H;
    const helpY = footY - HELP_H;

    let rail = null;
    let catbar = null;
    let paneX = 0;
    let paneY = TITLE_H;
    if (wide) {
      const railW = 84;
      const railH = helpY - TITLE_H;
      const plateH = Math.max(TAP, Math.floor((railH - 6) / CATEGORIES.length));
      rail = { rect: [0, TITLE_H, railW, railH], plates: [] };
      CATEGORIES.forEach((c, i) => {
        const r = [1, TITLE_H + i * (plateH + 1), railW - 2, plateH];
        rail.plates.push({ id: c.id, title: c.title, rect: r, selected: c.id === this.category });
        push(`cat:${c.id}`, r, 'category');
      });
      paneX = railW + 1;
    } else {
      const arrowW = CAT_H + 6;
      catbar = {
        rect: [0, TITLE_H, P, CAT_H],
        prev: push('cat:prev', [0, TITLE_H, arrowW, CAT_H], 'button'),
        next: push('cat:next', [P - arrowW, TITLE_H, arrowW, CAT_H], 'button'),
        name: push('cat:pick', [arrowW, TITLE_H, P - 2 * arrowW, CAT_H], 'button'),
        title: CATEGORIES.find((c) => c.id === this.category)?.title ?? '',
      };
      paneY = TITLE_H + CAT_H;
    }

    const paneW = P - paneX;
    const headerH = wide ? TITLE_H : 0;
    const listRect = [paneX, paneY + headerH, paneW - 5, helpY - (paneY + headerH)];
    const scrollRect = [P - 5, listRect[1], 4, listRect[3]];

    // --- the item list: three groups, folded by default except live ---
    const eff = effectiveSettings();
    const items = [];
    const labelW = (wide ? paneW - 8 : P - 8) - 96;
    for (const g of GROUPS) {
      const keys = keysOf(this.category).filter((k) => tierOf(k) === g.tier);
      if (!keys.length) continue;
      const open = g.id === 'live' ? isOpenOr(this.category, g.id, true) : isOpenOr(this.category, g.id, this.category === 'mods' && g.id === 'na');
      items.push({ kind: 'group', id: g.id, title: g.title, count: keys.length, open });
      if (!open) continue;
      for (const key of keys) {
        const [sec, k] = key.split('/');
        const raw = eff[sec][k];
        const label = labelOf(key);
        const lines = font ? wrapText(font.fnt, label, Math.max(40, labelW)).slice(0, 3) : [label];
        items.push({
          kind: 'row', key, tier: g.tier, widget: widgetFor(key),
          value: raw, display: formatValue(key, raw),
          changed: String(raw) !== String(DEFAULTS[sec][k]),
          labelLines: lines,
        });
      }
    }

    // --- place them, emitting only rows that fit WHOLLY (the renderer
    //     has no scissor, so a half-drawn row would spill) ---
    const placed = [];
    let y = listRect[1];
    const bottom = listRect[1] + listRect[3];
    if (this.scroll > Math.max(0, items.length - 1)) this.scroll = Math.max(0, items.length - 1);
    for (let i = this.scroll; i < items.length; i++) {
      const it = items[i];
      const h = it.kind === 'group' ? GROUP_H : ROW_BASE + (it.labelLines.length - 1) * LINE_H;
      if (y + h > bottom) break;
      const rect = [listRect[0], y, listRect[2], h];
      const entry = { ...it, index: i, rect, focused: i === this.focus };
      if (it.kind === 'group') {
        push(`group:${it.id}`, rect, 'group');
      } else {
        const ctrlW = Math.min(96, Math.floor(rect[2] * 0.42));
        const ctrlH = Math.max(11, TAP - 4);
        const ctrlX = rect[0] + rect[2] - ctrlW - 2;
        entry.labelRect = [rect[0] + 3, rect[1], rect[2] - ctrlW - 6, h];
        // the PILL is drawn compact so a row still reads as one line;
        // the TARGET is the whole row-height column behind it. Inset a
        // 44px finger by 4 and it is 36px again - the probe caught
        // exactly that, so the two rects are deliberately not one rect.
        entry.ctrlRect = [ctrlX, rect[1] + Math.floor((h - ctrlH) / 2), ctrlW, ctrlH];
        entry.ctrlHit = [ctrlX, rect[1], ctrlW, h];
        push(`row:${it.key}`, rect, 'row');
        if (it.widget !== 'blocked' && it.widget !== 'text' && it.widget !== 'colour') {
          push(`ctrl:${it.key}`, entry.ctrlHit, 'control');
        }
      }
      placed.push(entry);
      y += h;
    }

    // --- help panel: the focused item explained, always present ---
    const focused = items[this.focus] ?? null;
    let helpLines = [];
    let status = '';
    if (focused?.kind === 'row') {
      const h = helpOf(focused.key);
      helpLines = font ? wrapText(font.fnt, h || labelOf(focused.key), P - 8).slice(0, HELP_LINES) : [h];
      status = focused.tier === 'unavailable'
        ? `${TIER_TEXT.unavailable} ${blockedReason(focused.key)}`
        : TIER_TEXT[focused.tier];
    } else if (focused?.kind === 'group') {
      helpLines = [`${focused.count} settings in this group.`];
      status = focused.open ? 'Open - press Enter to fold it away.' : 'Folded - press Enter to open it.';
    } else {
      const cat = CATEGORIES.find((c) => c.id === this.category);
      helpLines = font ? wrapText(font.fnt, cat?.blurb ?? '', P - 8).slice(0, HELP_LINES) : [cat?.blurb ?? ''];
    }
    if (font) status = wrapText(font.fnt, status, P - 8)[0] ?? status;

    // --- footer ---
    const playW = Math.max(40, Math.min(78, P - 84));
    const footer = {
      rect: [0, footY, P, FOOT_H],
      help: push('btn:help', [3, footY + 1, 26, FOOT_H - 2], 'button'),
      reset: push('btn:reset', [32, footY + 1, 44, FOOT_H - 2], 'button'),
      play: push('btn:play', [P - 3 - playW, footY + 1, playW, FOOT_H - 2], 'button'),
    };

    const t = this.tally();
    return {
      m, wide, page: [0, 0, P, H], titlebar, rail, catbar,
      pane: { rect: [paneX, paneY, paneW, helpY - paneY], headerH },
      list: { rect: listRect, items, placed, scroll: this.scroll },
      scrollbar: scrollRect,
      help: { rect: [0, helpY, P, HELP_H], lines: helpLines, status },
      footer, hit,
      tally: t,
      tallyText: `${CATEGORIES.find((c) => c.id === this.category)?.title} - ${t.live} work now, ${t.stored} saved, ${t.unavailable} not here`,
      saveFailed: this.saveFailed,
      dialog: this.dialog,
    };
  }

  hitTest(L, vx, vy) {
    for (let i = L.hit.length - 1; i >= 0; i--) if (inRect(L.hit[i].rect, vx, vy)) return L.hit[i];
    return null;
  }
  // ---------------- interaction ----------------

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  _commit(key, next) {
    if (next === null) return;
    const [sec, k] = key.split('/');
    setValue(sec, k, next);
    if (!saveSettings()) this.saveFailed = true;
    this._click();
    // SoundVolume is the one control you should be able to HEAR: the
    // master bus re-reads the setting on every connection, so this
    // one-shot really demonstrates the value just chosen.
    if (key === 'Controls/SoundVolume') audio.playOneShot(SOUND.DungeonDoorOpen, 1);
  }

  /** Move the value of the focused row, or fold a group. */
  _nudge(L, dir, coarse = false) {
    const it = L.list.items[this.focus];
    if (!it) return;
    if (it.kind === 'group') { this._toggleGroup(it.id); return; }
    if (it.widget === 'blocked') { this.dialog = this._detail(it.key); return; }
    if (it.widget === 'text' || it.widget === 'colour') { this.dialog = this._detail(it.key); return; }
    // the lock-out decision keeps its confirm rather than silently hiding the screen
    if (it.key === 'GUI/ShowOptionsAtStart' && it.value === 'True') {
      this.dialog = {
        title: labelOf(it.key), key: it.key,
        lines: ['Turn this off and the settings screen will not open',
          'again on its own. You can still reach it by adding',
          '?launcher to the address.'],
        buttons: [{ id: 'yes', label: 'Turn Off' }, { id: 'no', label: 'Keep It' }],
      };
      return;
    }
    this._commit(it.key, stepValue(it.key, it.value, dir, coarse));
  }

  _toggleGroup(id) {
    const cur = isOpenOr(this.category, id, id === 'live' || (this.category === 'mods' && id === 'na'));
    setOpen(this.category, id, !cur);
    this._click();
  }

  _setCategory(id) {
    this.category = id;
    setPref('category', id);
    this.focus = 0;
    this.scroll = 0;
    this._click();
  }

  _stepCategory(dir) {
    const i = CATEGORIES.findIndex((c) => c.id === this.category);
    this._setCategory(CATEGORIES[(i + dir + CATEGORIES.length) % CATEGORIES.length].id);
  }

  /** The ONE place a raw ini key is shown, and the only consumer of
   *  DFU's own strings (settingsText had none before this screen). */
  _detail(key) {
    const [sec, k] = key.split('/');
    const eff = effectiveSettings();
    const lines = [];
    const h = helpOf(key);
    if (h) lines.push(h);
    lines.push(`Now: ${formatValue(key, eff[sec][k])}    Default: ${formatValue(key, DEFAULTS[sec][k])}`);
    const tier = tierOf(key);
    lines.push(TIER_TEXT[tier]);
    if (tier === 'unavailable') {
      lines.push(`Fixed here - ${blockedReason(key)}`);
      const inst = INSTEAD[key];
      if (inst) lines.push(inst);
    }
    lines.push(`Saved as [${sec}] ${k}`);
    return { title: labelOf(key), key, lines, buttons: [{ id: 'close', label: 'Close' }] };
  }

  _focusMove(L, delta) {
    const n = L.list.items.length;
    if (!n) return;
    this.focus = Math.max(0, Math.min(n - 1, this.focus + delta));
    // keep the focused item wholly visible
    if (this.focus < this.scroll) this.scroll = this.focus;
    const shown = L.list.placed.length;
    if (this.focus >= this.scroll + shown) this.scroll = Math.max(0, this.focus - shown + 1);
  }

  _launch() {
    saveSettings();
    this.done = true;
    this.onLaunch();
  }

  /** Raw key codes, the overlay contract every window here follows. */
  input(code, e = null, canvas = null) {
    const L = this.layout(canvas ?? { width: 1280, height: 800 });
    if (this.dialog) {
      if (code === 'Escape' || code === 'Enter' || code === 'Space') {
        const d = this.dialog;
        this.dialog = null;
        if (code !== 'Escape' && d.buttons?.[0]?.id === 'yes') this._commit(d.key, 'False');
        this._click();
      }
      return;
    }
    const ch = (e?.key ?? '').toLowerCase();
    switch (code) {
      case 'ArrowUp': this._focusMove(L, -1); return;
      case 'ArrowDown': this._focusMove(L, +1); return;
      case 'ArrowLeft': this._nudge(L, -1, !!e?.shiftKey); return;
      case 'ArrowRight': this._nudge(L, +1, !!e?.shiftKey); return;
      case 'PageUp': this._focusMove(L, -L.list.placed.length || -5); return;
      case 'PageDown': this._focusMove(L, L.list.placed.length || 5); return;
      case 'Tab': this._stepCategory(e?.shiftKey ? -1 : +1); return;
      case 'Enter': {
        const it = L.list.items[this.focus];
        if (it?.kind === 'group') this._toggleGroup(it.id);
        else if (it?.kind === 'row') this.dialog = this._detail(it.key);
        return;
      }
      case 'Escape': this._launch(); return;
      default: break;
    }
    if (ch === '[') this._stepCategory(-1);
    else if (ch === ']') this._stepCategory(+1);
    else if (ch === 'r') {
      this.dialog = {
        title: 'Reset Everything', key: null,
        lines: ['Put every setting back the way Daggerfall Unity',
          'ships it. This also clears this screen\'s own',
          'preferences, like Text Size.'],
        buttons: [{ id: 'yes', label: 'Reset' }, { id: 'no', label: 'Cancel' }],
        onYes: () => { resetToDefaults(); },
      };
    }
  }

  /** PAGE coordinates. Returns true when the click was consumed. */
  click(vx, vy, canvas = null) {
    const L = this.layout(canvas ?? { width: 1280, height: 800 });
    if (this.dialog) {
      const d = this.dialog;
      this.dialog = null;
      if (d.onYes) d.onYes();
      else if (d.buttons?.[0]?.id === 'yes') this._commit(d.key, 'False');
      this._click();
      return true;
    }
    const h = this.hitTest(L, vx, vy);
    if (!h) return false;
    const [kind, arg] = h.id.split(':');
    if (kind === 'cat') {
      if (arg === 'prev') this._stepCategory(-1);
      else if (arg === 'next') this._stepCategory(+1);
      else if (arg !== 'pick') this._setCategory(arg);
      return true;
    }
    if (kind === 'group') { this.focus = L.list.items.findIndex((i) => i.kind === 'group' && i.id === arg); this._toggleGroup(arg); return true; }
    if (kind === 'row' || kind === 'ctrl') {
      const idx = L.list.items.findIndex((i) => i.kind === 'row' && i.key === arg);
      if (idx < 0) return true;
      // a tap on the CONTROL changes it; a tap on the row selects it,
      // and a second tap on an already-selected row changes it too -
      // one finger, no modifier, the phone equivalent of Right
      if (kind === 'ctrl' || this.focus === idx) { this.focus = idx; this._nudge(this.layout(canvas ?? { width: 1280, height: 800 }), +1); }
      else this.focus = idx;
      return true;
    }
    if (kind === 'btn') {
      if (arg === 'play') this._launch();
      else if (arg === 'reset') this.input('KeyR', { key: 'r' }, canvas);
      else if (arg === 'help') {
        const it = L.list.items[this.focus];
        if (it?.kind === 'row') this.dialog = this._detail(it.key);
      }
      return true;
    }
    return false;
  }

  wheel(dir) { this.scroll = Math.max(0, this.scroll + (dir > 0 ? 1 : -1)); }

  // ---------------- drawing ----------------
  // Reads the SAME layout() the clicks read. Nothing here computes a
  // coordinate of its own.

  draw(renderer, canvas, font) {
    this._font = font;
    const L = this.layout(canvas, font);
    const m = L.m;
    const [, , P, H] = L.page;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, INK);
    drawRect(renderer, m, 0, 0, P, H, PANEL);

    // title bar
    drawRect(renderer, m, 0, 0, P, TITLE_H, PANEL_DEEP);
    drawRect(renderer, m, 0, TITLE_H - 1, P, 1, RULE);
    shadowText(renderer, font, 'SETTINGS', m, 4, 2, { color: HEADING });
    if (L.saveFailed) shadowText(renderer, font, 'NOT SAVED', m, P - 4 - measureText(font.fnt, 'NOT SAVED'), 2, { color: WARN });

    // category rail (wide) or bar (narrow)
    if (L.rail) {
      for (const p of L.rail.plates) {
        drawRect(renderer, m, p.rect[0], p.rect[1], p.rect[2], p.rect[3], p.selected ? FOCUS : PANEL_DEEP);
        if (p.selected) drawRect(renderer, m, 0, p.rect[1], 2, p.rect[3], HEADING);
        const ty = p.rect[1] + Math.floor((p.rect[3] - 7) / 2);
        if (p.selected) drawText(renderer, font, p.title, m.ox + (p.rect[0] + 5) * m.s, m.oy + ty * m.s, m.s, INK);
        else shadowText(renderer, font, p.title, m, p.rect[0] + 5, ty, { color: TEXT_SOFT });
      }
      drawRect(renderer, m, L.rail.rect[2], L.rail.rect[1], 1, L.rail.rect[3], RULE);
    } else if (L.catbar) {
      const c = L.catbar;
      drawRect(renderer, m, c.rect[0], c.rect[1], c.rect[2], c.rect[3], PANEL_DEEP);
      drawRect(renderer, m, c.rect[0], c.rect[1] + c.rect[3] - 1, c.rect[2], 1, RULE);
      const ty = c.rect[1] + Math.floor((c.rect[3] - 7) / 2);
      shadowText(renderer, font, '<', m, c.prev[0] + Math.floor(c.prev[2] / 2) - 2, ty, { color: HEADING });
      shadowText(renderer, font, '>', m, c.next[0] + Math.floor(c.next[2] / 2) - 2, ty, { color: HEADING });
      shadowText(renderer, font, c.title, m, c.name[0], ty, { color: HEADING, align: 'center', w: c.name[2] });
    }

    // pane header: the computed tally
    if (L.pane.headerH) {
      shadowText(renderer, font, L.tallyText, m, L.pane.rect[0] + 4, L.pane.rect[1] + 2, { color: TEXT_SOFT });
      drawRect(renderer, m, L.pane.rect[0], L.pane.rect[1] + L.pane.headerH - 1, L.pane.rect[2], 1, RULE);
    }

    // the list
    for (const it of L.list.placed) {
      const [rx, ry, rw, rh] = it.rect;
      if (it.kind === 'group') {
        drawRect(renderer, m, rx, ry, rw, rh, PANEL_DEEP);
        const ty = ry + Math.floor((rh - 7) / 2);
        shadowText(renderer, font, `${it.open ? '-' : '+'} ${it.title} (${it.count})`, m, rx + 4, ty, { color: it.focused ? FOCUS : TEXT_SOFT });
        continue;
      }
      if (it.focused) {
        drawRect(renderer, m, rx, ry, rw, rh, PANEL_DEEP);
        drawRect(renderer, m, rx, ry, 2, rh, FOCUS);         // a tick, so focus is not colour alone
      }
      const dim = it.tier === 'unavailable';
      const labelCol = dim ? TEXT_SOFT : TEXT;
      it.labelLines.forEach((ln, i) => {
        shadowText(renderer, font, ln, m, it.labelRect[0] + 3, ry + 3 + i * LINE_H, { color: labelCol });
      });
      // the value, as a WORD, right-aligned in the control column
      const [cx, cy, cw, chh] = it.ctrlRect;
      if (!dim && it.widget !== 'text') {
        drawRect(renderer, m, cx, cy, cw, chh, PANEL_DEEP);
        drawRect(renderer, m, cx, cy, cw, 1, RULE);
        drawRect(renderer, m, cx, cy + chh - 1, cw, 1, RULE);
      }
      const vcol = dim ? TEXT_SOFT : (it.tier === 'live' ? OKAY : TEXT);
      const vy = cy + Math.floor((chh - 7) / 2);
      shadowText(renderer, font, it.display, m, cx, vy, { color: vcol, align: 'center', w: cw });
      if (it.changed && !dim) shadowText(renderer, font, '*', m, cx - 5, vy, { color: HEADING });
    }

    // scrollbar
    const total = L.list.items.length;
    const shown = L.list.placed.length;
    if (total > shown && shown > 0) {
      const [sx, sy, sw, sh] = L.scrollbar;
      drawRect(renderer, m, sx, sy, sw, sh, PANEL_DEEP);
      const th = Math.max(6, Math.round((sh * shown) / total));
      const ty = sy + Math.round((sh * L.list.scroll) / total);
      drawRect(renderer, m, sx, Math.min(ty, sy + sh - th), sw, th, TEXT_SOFT);
    }

    // help panel - always present, never truncated
    drawRect(renderer, m, L.help.rect[0], L.help.rect[1], L.help.rect[2], L.help.rect[3], PANEL_DEEP);
    drawRect(renderer, m, L.help.rect[0], L.help.rect[1], L.help.rect[2], 1, RULE);
    L.help.lines.forEach((ln, i) => shadowText(renderer, font, ln, m, 4, L.help.rect[1] + 3 + i * LINE_H, { color: TEXT }));
    if (L.help.status) {
      shadowText(renderer, font, L.help.status, m, 4, L.help.rect[1] + L.help.rect[3] - 10, { color: TEXT_SOFT });
    }

    // footer
    drawRect(renderer, m, L.footer.rect[0], L.footer.rect[1], L.footer.rect[2], L.footer.rect[3], PANEL_DEEP);
    drawRect(renderer, m, L.footer.rect[0], L.footer.rect[1], L.footer.rect[2], 1, RULE);
    const btn = (rect, label, hot) => {
      drawRect(renderer, m, rect[0], rect[1], rect[2], rect[3], hot ? FOCUS : PANEL);
      drawRect(renderer, m, rect[0], rect[1], rect[2], 1, RULE);
      const ty = rect[1] + Math.floor((rect[3] - 7) / 2);
      if (hot) drawText(renderer, font, label, m.ox + (rect[0] + Math.floor((rect[2] - measureText(font.fnt, label)) / 2)) * m.s, m.oy + ty * m.s, m.s, INK);
      else shadowText(renderer, font, label, m, rect[0], ty, { color: TEXT, align: 'center', w: rect[2] });
    };
    btn(L.footer.help, '?', false);
    btn(L.footer.reset, 'Reset', false);
    btn(L.footer.play, 'PLAY', true);

    if (this.dialog) this._drawDialog(renderer, m, font, L);
  }

  _drawDialog(renderer, m, font, L) {
    const [, , P, H] = L.page;
    const d = this.dialog;
    const w = Math.min(P - 16, 260);
    const lines = d.lines.flatMap((ln) => wrapText(font.fnt, ln, w - 12));
    const h = 16 + lines.length * LINE_H + 16;
    const x = Math.floor((P - w) / 2);
    const y = Math.floor((H - h) / 2);
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: 4096, h: 4096 }, undefined, [0, 0, 0, 0.55]);
    drawRect(renderer, m, x, y, w, h, PANEL);
    drawRect(renderer, m, x, y, w, 1, RULE);
    drawRect(renderer, m, x, y + h - 1, w, 1, RULE);
    shadowText(renderer, font, d.title, m, x + 6, y + 4, { color: HEADING });
    lines.forEach((ln, i) => shadowText(renderer, font, ln, m, x + 6, y + 15 + i * LINE_H, { color: TEXT }));
    const by = y + h - 12;
    (d.buttons ?? []).forEach((b, i) => {
      const bw = 54;
      const bx = x + w - 6 - (d.buttons.length - i) * (bw + 4);
      drawRect(renderer, m, bx, by, bw, 10, i === 0 ? FOCUS : PANEL_DEEP);
      const col = i === 0 ? INK : TEXT;
      if (i === 0) drawText(renderer, font, b.label, m.ox + (bx + Math.floor((bw - measureText(font.fnt, b.label)) / 2)) * m.s, m.oy + (by + 2) * m.s, m.s, col);
      else shadowText(renderer, font, b.label, m, bx, by + 2, { color: col, align: 'center', w: bw });
    });
  }

  /** What tools/settingsProbe.mjs serialises - the SAME layout the
   *  draw uses, so a probe taps what a finger taps. */
  probe(canvas) {
    const L = this.layout(canvas);
    return {
      up: !this.done, category: this.category, mode: L.m.mode, scale: L.m.s,
      page: L.page, tally: L.tally, tallyText: L.tallyText,
      focus: this.focus, dialog: this.dialog ? this.dialog.title : null,
      canvas: { w: canvas.width, h: canvas.height },
      metric: { ox: L.m.ox, oy: L.m.oy, s: L.m.s },
      hit: L.hit.map((h) => ({ id: h.id, kind: h.kind, rect: h.rect })),
      rows: L.list.placed.filter((p) => p.kind === 'row')
        .map((p) => ({ key: p.key, label: p.labelLines.join(' '), value: p.display, tier: p.tier, widget: p.widget, focused: p.focused })),
      groups: L.list.placed.filter((p) => p.kind === 'group').map((p) => ({ id: p.id, title: p.title, count: p.count, open: p.open })),
      help: L.help.lines, status: L.help.status,
    };
  }
}

function isOpenOr(cat, group, dflt) {
  const store = getPref('open');
  const k = `${cat}:${group}`;
  return k in store ? !!store[k] : dflt;
}
