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
export function repaintKeepingScroll(host, rebuild) {
  const saved = [];
  if (host) {
    for (const el of host.querySelectorAll('*')) {
      if (el.scrollTop > 0 || el.scrollLeft > 0) {
        saved.push([pathOf(host, el), el.scrollTop, el.scrollLeft]);
      }
    }
  }
  rebuild();
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
