# The Raum book - project-raum's animated journal (vendored, Mac's own)

The files beside this note are **project-raum**'s physical book
(github.com/Lattymoy/project-raum, `src/ui/book.js`, `src/ui/paper.js`
and the one hash `src/engine/core/rng.js` seeds the paper from, at
commit `7fa7119e`, 2026-09-12): a leather cover that flips open, two-page
spreads rendered to offscreen canvases, leaves that turn as a CLOTH FOLD
about the spine with the crest's highlight and the sweeping shadow, the
closed pages' fore-edge stack, and the slide up from below the screen
and back down. It is Mac's own work, brought over at his word
(2026-09-12: "For the book reader, I was wondering if we could use the
animated book in my repo project-raum").

**What changed, and it is marked `PORT` in the files:**

- `book.js` imported Raum's hand-drawn journal face (`journalFont.js`,
  an uppercase hand). This book's words are Daggerfall's, in
  Daggerfall's FNT faces, so every inscription the book makes (the
  cover's title and subtitle, a page number, BLANK) goes through
  `BOOK.inscribe`, a seam the port points at its own glyph painter
  (`src/ui/enhancedBook.js`). `BOOK.cover` carries the cover's words.
- `book.js` gains `resizeBook(book, pw, ph)`, a sizing seam beside
  `layoutBook`: the port sizes the leaf off the view's height where
  Raum keys off the short edge, and the cover is cleared with it.
- `paper.js` imports `mix32` from `./rng.js` here instead of Raum's
  engine core.

Nothing else is edited: the fold, the paint, the navigation and the
paper are Raum's line for line, so a fix in either repo ports by copy.
