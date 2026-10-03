// DA8: THE LAUNCHER'S DRAW. It holds no state of its own: the shell sends
// the whole view (app/lib/launcherState.cjs viewOf) on every change, and
// this paints it. Every word reaches the page as TEXT - the patch notes
// included, which come from GitHub - through textContent and fresh
// elements, never markup.
//
// DA10: the front door's regions - the patch notes (or the first run's
// card), the options, the status bar and PLAY. A button says WHICH action
// it is (data-act, or its view entry); the shell decides what that does.
'use strict';

(() => {
  const bridge = window.daggerLauncher;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const button = (a, cls) => {
    const b = el('button', `${cls}${a.primary ? ' primary' : ''}`, a.label);
    b.type = 'button';
    if (a.name) b.setAttribute('aria-label', a.name);
    b.addEventListener('click', () => bridge.act(a.id, a.arg));
    return b;
  };
  /** Text written only when it changed: a screen reader re-reads a region
   *  whose text is replaced, even with the same words (AUDIT INSTALL L5-17). */
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  /** "a **b** c" as text nodes and <strong>, `code` and links as their text. */
  function inline(target, text) {
    const plain = String(text).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`([^`]*)`/g, '$1');
    plain.split('**').forEach((part, i) => {
      if (part) target.append(i % 2 ? el('strong', null, part) : document.createTextNode(part));
    });
  }

  const BADGE = { new: 'New', update: 'Update' };

  /** A release's patch notes - the markdown subset a pull request's
   *  "Patch notes" section is written in (scripts/desktopRelease.mjs):
   *  headings, bullets (nested by their indent), paragraphs. Anything
   *  else is a paragraph of its text. */
  function notesBlock(note) {
    const box = el('article', 'release');
    const head = el('div', 'head');
    head.append(el('span', 'ver', `v${note.version}`));
    if (note.date) head.append(el('span', 'date', note.date));
    if (Object.hasOwn(BADGE, note.badge)) head.append(el('span', `badge ${note.badge}`, BADGE[note.badge]));
    box.append(head);
    // the open lists, outermost first, each with the indent its bullets stand at (AUDIT INSTALL R2-E8: notes
    // nest their bullets, and flattened the sub-points read as points of their own)
    let lists = [];
    let para = null;
    for (const raw of String(note.text ?? '').split('\n')) {
      const line = raw.trim();
      const bullet = /^(\s*)[-*]\s+(.*)$/.exec(raw.replace(/\t/g, '  '));
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!line) { lists = []; para = null; continue; }
      if (heading) {
        lists = []; para = null;
        box.append(el(heading[1].length === 1 ? 'h4' : 'h5', null, heading[2].replace(/^Patch Notes:\s*/i, '')));
      } else if (bullet) {
        para = null;
        const indent = bullet[1].length;
        while (lists.length && lists[lists.length - 1].indent > indent) lists.pop();
        const top = lists[lists.length - 1];
        if (!top || indent > top.indent) {
          const ul = el('ul');
          (top?.ul.lastElementChild ?? box).append(ul);
          lists.push({ indent, ul });
        }
        const li = el('li');
        inline(li, bullet[2]);
        lists[lists.length - 1].ul.append(li);
      } else {
        lists = [];
        if (!para) { para = el('p'); box.append(para); } else para.append(document.createTextNode(' '));
        inline(para, line);
      }
    }
    return box;
  }

  /** Rebuild a region only when what it shows changed. A download sends a
   *  view many times a second, and a button rebuilt under the pointer
   *  between press and release is a click that never happens. */
  const drawn = new Map();
  const changed = (region, value) => {
    const key = JSON.stringify(value);
    if (drawn.get(region) === key) return false;
    drawn.set(region, key);
    return true;
  };

  /** A path, cut from the LEFT (right-to-left, in the stylesheet) so its end
   *  shows; the marks keep its slashes in order, or bidi moves an absolute
   *  path's leading "/" to the far end. */
  const pathLine = (dir) => {
    const p = el('span', 'path', `‎${dir}‎`);
    p.title = dir;
    return p;
  };

  function render(v) {
    document.body.toggleAttribute('data-busy', !!v.busy);
    document.body.dataset.panel = v.panel;
    setText($('version'), v.version);
    setText($('status'), v.status);
    setText($('detail'), v.detail);

    const progress = $('progress');
    progress.hidden = !v.progress;
    if (v.progress) {
      const track = progress.querySelector('.track');
      progress.querySelector('.track i').style.width = `${v.progress.percent}%`;
      track.setAttribute('aria-valuenow', String(Math.round(v.progress.percent)));
      track.setAttribute('aria-valuetext', v.progress.label);
      setText(progress.querySelector('.label'), v.progress.label);
    }
    if (changed('status-actions', v.statusActions)) {
      $('status-actions').replaceChildren(...v.statusActions.map((a) => button(a, 'plaque')));
    }

    const play = $('play');
    play.disabled = !v.play.enabled;
    play.textContent = v.play.label;

    $('news').hidden = v.panel !== 'news';
    $('setup').hidden = v.panel !== 'setup';
    if (v.setup && changed('setup', v.setup)) {
      $('setup-title').textContent = v.setup.title;
      $('setup-detail').textContent = v.setup.detail;
      const found = $('found');
      found.replaceChildren(...v.setup.found.map((f) => {
        const li = el('li');
        const where = el('span', 'where');
        where.append(el('span', 'from', f.from), pathLine(f.dir));
        const use = button({ id: 'use-found', arg: f.index, label: 'Use these files', name: `Use these files - ${f.from}: ${f.dir}`, primary: f.primary }, 'plaque small');
        li.append(where, use);
        return li;
      }));
      found.hidden = !v.setup.found.length;
      $('setup-actions').replaceChildren(...v.setup.actions.map((a) => button(a, 'plaque')));
    }
    if (changed('news', v.news)) {
      document.querySelector('#news .feed').replaceChildren(...v.news.items.map(notesBlock));
      const note = document.querySelector('#news .note');
      note.textContent = v.news.note;
      note.hidden = !v.news.note;
    }

    if (changed('files', v.options.files)) {
      $('files').replaceChildren(v.options.files.path ? pathLine(v.options.files.path) : document.createTextNode(v.options.files.note));
      document.querySelector('[data-act="choose-folder"]').textContent = v.options.files.label;
    }
    const check = $('update-check');
    if (check.checked !== v.options.checkOnLaunch) check.checked = v.options.checkOnLaunch;

    // Enter takes the screen's own answer - the first run's card's, or PLAY once it can be pressed -
    // and only that: "Play without updating" under a download is the way out, not the way on
    const focusKey = v.panel === 'setup' ? `setup:${JSON.stringify(v.setup)}` : `play:${v.play.enabled}`;
    if (changed('focus', focusKey)) {
      const at = document.activeElement;
      // AUDIT INSTALL R2-E1: a control inside a region just hidden (the card's answer, once the card gives way to the
      // news) is gone for the player - Chromium blurs it only later, after this view had used up its one focus move,
      // and Enter pressed nothing
      const idle = !at || at === document.body || at.disabled || !at.isConnected || !at.checkVisibility();
      if (v.panel === 'setup') document.querySelector('#setup .plaque.primary')?.focus({ preventScroll: true });
      else if (v.play.enabled && idle) play.focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act && !act.disabled) bridge.act(act.dataset.act);
    const link = e.target.closest('[data-open]');
    if (link) bridge.act('open', link.dataset.open);
  });
  $('update-check').addEventListener('change', (e) => bridge.act('set-update-check', e.target.checked));
  bridge.onView(render);
})();
