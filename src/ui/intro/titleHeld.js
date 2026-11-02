// @ts-check
// TITLE-DOOR (2026-10-27, bible/10-UI/UI-Arc.md TITLE-DOOR): THE PAGE'S MARK WHILE THE FILM'S TITLE STANDS UNDER THE MENU.
// The film (introScreen.js) writes it when its title lands and takes it away when it is let go; the menu
// (ui/enhanced/enhancedMenu.js renderHome) reads it, and draws its home over the film instead of its own sky. One small
// module so the menu - which a running game mounts too - never imports the film to ask.

/** `<html data-intro-title="held">` */
export const TITLE_HELD = 'held';

/** @param {Document | undefined} [doc] */
export const titleHeld = (doc = globalThis.document) => doc?.documentElement?.dataset?.introTitle === TITLE_HELD;

/** @param {boolean} on @param {Document | undefined} [doc] */
export function holdTitle(on, doc = globalThis.document) {
  const data = doc?.documentElement?.dataset;
  if (!data) return;
  if (on) data.introTitle = TITLE_HELD;
  else delete data.introTitle;
}
