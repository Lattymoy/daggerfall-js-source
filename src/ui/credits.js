// ═══════════════════════════════════════════════════════════════════
// CREDITS - who made what the port carries (CR1, Mac's call 2026-08-30:
// "as we integrate these I really want to give credit to the mod
// developer who created it").
//
// ONE TABLE, ON THE SCREEN. Every third-party work in the tree has a
// row here, and the About pane renders the rows; a README in vendor/
// credits the author to whoever reads the repo, and this credits them
// to whoever plays the game, which is the audience that matters to a
// modder. test/credits.test.js sweeps vendor/ against this list both
// ways, so a work cannot be vendored without a row and a row cannot
// name a folder that is gone.
//
// Two kinds of row, kept apart on the screen because they are owed
// differently:
//   - BUILT ON: the game itself and the source the port is a 1:1 of.
//   - MODS: a modder's own work, carried with the author's permission
//     (never without - the roads were removed whole for exactly that).
//     `vendor` names the folder whose README records the permission.
//
// No URLs are invented: a contact is what the author's own manifest
// says it is.
// ═══════════════════════════════════════════════════════════════════

export const CREDITS = Object.freeze({
  builtOn: Object.freeze([
    Object.freeze({
      title: 'The Elder Scrolls II: Daggerfall',
      author: 'Bethesda Softworks',
      what: 'The game. Every byte of art, sound, text and world data comes from the ARENA2 folder the player supplies; none ships with the port.',
    }),
    Object.freeze({
      title: 'Daggerfall Unity',
      author: 'Gavin Clayton (Interkarma) and contributors',
      what: 'The source this port is a 1:1 translation of. Its quest scripts, book index and settings tables are vendored verbatim (MIT License).',
      vendor: Object.freeze(['dfu-quests', 'dfu-books', 'dfu-settings']),
      link: 'https://github.com/Interkarma/daggerfall-unity',
    }),
  ]),
  mods: Object.freeze([
    Object.freeze({
      title: 'Windmills of Daggerfall',
      version: '2.0',
      author: 'Kamer',
      what: 'The windmill: the tower and its sails, the machinery inside with its turning gear and roller, the seventeen climate and season skins, and the seven farms he chose to stand them on. Enhanced skin only; the classic lane sees Daggerfall\'s own farms.',
      terms: 'Vendored with the author\'s permission (2026-08-29).',
      contact: 'DFU Discord',
      vendor: Object.freeze(['windmills-kamer']),
    }),
  ]),
});
