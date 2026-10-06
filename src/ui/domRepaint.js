// A REPAINT MUST NOT MOVE THE PAGE UNDER THE PLAYER.
//
// Mac, playing the deployed build: on the skills screen every tap on a
// stepper threw the list back to the top. The enhanced screens rebuild
// their whole DOM on every state change - which is what makes them
// simple, and what makes them forget everything the DOM was holding.
// Scroll position is the first thing you notice; the hover bug that
// cost the province map its clicks was the same fault one layer down,
// where the node under the pointer was the thing destroyed.
//
// So a repaint is wrapped rather than rewritten: read every scroll
// offset, rebuild, put them back. One helper, used by both enhanced
// screens, because the settings list has exactly the same steppers and
// exactly the same bug waiting in it.
//
// THE KEY HAS TO SURVIVE THE REBUILD, and an element reference cannot -
// the old nodes are gone. A path of class names and sibling positions
// does: the same state paints the same tree, so `shell/pane/list` finds
// the same list it did a moment ago. When the tree genuinely differs -
// a different stage, a sheet that opened - the path simply misses and
// the new element starts at the top, which is what it should do.

/** The path from the host to one element: each step is a tag plus the
 *  element's index among its siblings. Cheap, and stable for a tree
 *  that is rebuilt the same way. */
function pathOf(host, el) {
  const parts = [];
  let n = el;
  while (n && n !== host) {
    const parent = n.parentNode;
    if (!parent) break;
    parts.push(`${n.tagName}.${n.className || ''}:${[...parent.children].indexOf(n)}`);
    n = parent;
  }
  return parts.reverse().join('>');
}

/**
 * Rebuild `host` through `rebuild`, keeping whatever was scrolled.
 *
 * Only elements actually scrolled away from the top are recorded: a
 * list sitting at 0 has nothing to restore, and restoring it anyway
 * would fight a screen that meant to start at the top.
 */
export function repaintKeepingScroll(host, rebuild, { focus = false } = {}) {
  const kept = focus ? focusOf(host) : null;
  const saved = [];
  if (host) {
    for (const el of host.querySelectorAll('*')) {
      if (el.scrollTop > 0 || el.scrollLeft > 0) {
        saved.push([pathOf(host, el), el.scrollTop, el.scrollLeft]);
      }
    }
  }
  rebuild();
  if (kept) giveFocus(host, kept);
  if (!saved.length || !host) return;
  const byPath = new Map();
  for (const el of host.querySelectorAll('*')) byPath.set(pathOf(host, el), el);
  for (const [path, top, left] of saved) {
    const el = byPath.get(path);
    if (!el) continue;   // the tree changed shape - the new element starts fresh
    if (top) el.scrollTop = top;
    if (left) el.scrollLeft = left;
  }
}

/**
 * AUDIT 32 P3: THE FOCUS AND THE CARET, kept the same way (`focus: true`) - AUDIT 31 U1's law for the notice window, which
 * the pause window never kept: a field typed in lost its focus on the answer that redrew the page (the next digit went
 * nowhere) and a keyboard's button fell to the page (the next Tab went back to the rail). The control is found again by
 * its `data-focus` key, else its path - the same tag, a button its same words (a Craft that became a Stitch is not it) -
 * and a field's caret given back.
 * @param {any} host
 */
function focusOf(host) {
  const a = host?.ownerDocument?.activeElement ?? globalThis.document?.activeElement;
  if (!host || !a || a === host || !host.contains?.(a)) return null;
  let at = null;
  try { if (typeof a.selectionStart === 'number') at = [a.selectionStart, a.selectionEnd]; } catch { /* a number field has none */ }
  return { key: a.getAttribute?.('data-focus') ?? null, place: placeOf(host, a), tag: a.tagName, words: a.tagName === 'BUTTON' ? a.textContent : null, at };
}
/** A control's place for the focus: tag and sibling index alone - a picked button's class changes (`on`) as the same
 *  button is drawn again. */
function placeOf(host, el) {
  const parts = [];
  for (let n = el; n && n !== host && n.parentNode; n = n.parentNode) parts.push(`${n.tagName}:${[...n.parentNode.children].indexOf(n)}`);
  return parts.reverse().join('>');
}
/** @param {any} host @param {any} k */
function giveFocus(host, k) {
  let n = k.key ? [...host.querySelectorAll('*')].find((x) => x.getAttribute?.('data-focus') === k.key) ?? null : null;
  // AUDIT LEGACY II U6: a control found by its KEY is it, whatever it says now - an armed act's words change ("Play as"
  // becomes "Yes - play as"), and the words' check below threw the keyed button away and dropped the focus to the page
  if (!n) {
    n = [...host.querySelectorAll(k.tag)].find((x) => placeOf(host, x) === k.place) ?? null;
    // a button is its words: at its place, or - the page's shape moved - the one that says them
    if (k.words != null && (!n || n.textContent !== k.words)) n = [...host.querySelectorAll(k.tag)].find((x) => x.textContent === k.words) ?? null;
  }
  if (!n || n.disabled) return;
  try { n.focus({ preventScroll: true }); } catch { n.focus?.(); }
  if (k.at) { try { n.setSelectionRange(k.at[0], k.at[1]); } catch { /* none to set */ } }
}
