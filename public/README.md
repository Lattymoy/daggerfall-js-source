# public/ — the port's OWN assets

Vite serves this directory at the site root, so `public/logo.png` is
fetched as `logo.png`.

Nothing here is game data. Port-Doctrine keeps ARENA2 out of the repo
permanently: the readers load the user's own files at runtime (dev via
the vite middleware in `vite.config.js`, production via the folder
picker persisted in IndexedDB). What lives here is artwork that is
*ours*, which is a different thing entirely and does ship with the
build.

## logo.png — the title screen (U21c)

`src/ui/titleScreen.js` draws this ahead of the main menu. It is the
port's own branding, in the slot classic fills with TITL00I0.IMG —
which DFU does not draw either, having replaced classic's title with
its own. Recorded in Port-Ledger section A.

Any size or aspect works: `logoRect` centres it, preserves its aspect
against both axes and caps it at 86% of the canvas. Alpha is a 1-bit
cutout, not a blend — `drawScreenQuad` discards texels under 0.5 alpha,
which is the port's law for every screen quad — so a soft-edged logo
hardens at that threshold. A fully opaque banner is unaffected.

**The file is optional and its absence is not an error.** `loadLogo`
resolves null, `runTitle` returns before it touches the renderer, and
the boot goes straight to the menu. A missing asset costs a splash,
never a game. `node tools/titleProbe.mjs` shoots that arm live.
