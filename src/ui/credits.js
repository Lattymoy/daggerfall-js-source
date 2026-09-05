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
    Object.freeze({
      title: 'Basic Roads',
      version: '1.3.1',
      author: 'Hazelnut',
      what: 'The roads and tracks of the Iliac Bay: the hand-drawn network of which pixels carry a road or a track and which way each leaves, and the painter that lays them into the terrain. Both skins; the map draws them too.',
      terms: 'Vendored with the author\'s permission (2026-09-02). The painter is MIT (Copyright (C) 2020 Hazelnut).',
      contact: 'DFU forums',
      vendor: Object.freeze(['roads-hazelnut']),
      link: 'https://github.com/ajrb/dfunity-mods',
    }),
    Object.freeze({
      title: 'Dynamic Skies',
      version: '2.3.4',
      author: 'BadLuckBurt and carademono',
      what: 'The sky under the enhanced environments: a procedural skybox (built on Feral Pug\'s extension of Unity\'s procedural sky) with its sun and atmosphere, two textured cloud layers per weather, twinkling stars, Masser and Secunda on their orbits and DFU\'s phases, its own fog colours and distances, a longer sunrise and sunset, a lightning flash under thunder, and pixel snow. Carried 1:1 - the shader, the presets and the textures are the mod\'s own. The classic lane keeps Daggerfall\'s painted sky.',
      terms: 'Vendored with the authors\' permission (2026-09-04); see vendor/dynamic-skies/README.md.',
      contact: "Lysandus' Tomb Discord server",
      vendor: Object.freeze(['dynamic-skies']),
      link: 'https://github.com/drcarademono/dynamic-skies',
    }),
    Object.freeze({
      title: 'Seasons of the Iliac Bay',
      version: '1.1',
      author: 'RosyTheRascal',
      what: 'The turning of the year on the woodland, hills, haunted and mountain flats: autumn, spring and winter repaints of the trees, rocks and plants, drawn at the mod\'s own size. The mod\'s script (its seasons, archives and checks) is ported; its textures are read from your own copy of the mod at play time and are not in this repository.',
      terms: 'Ported with the author\'s permission (2026-09-05); see vendor/seasons-iliac-bay/README.md.',
      contact: "Lysandus' Tomb Discord server",
      vendor: Object.freeze(['seasons-iliac-bay']),
    }),
  ]),
});
