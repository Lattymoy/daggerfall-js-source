# Localization

The game can be played in other languages. Daggerfall Unity's text system is ported 1:1, so any DFU translation pack
works as it stands, and the port goes further: real locales with fallback, switching in play, plurals and selects,
any script on the classic screens, and the port's own strings in a catalog. The player meets it as a language picker on
the front door's Settings and a first-run offer, and installs a DFU pack from their own disk. English is the default and
stays byte-identical.

## How it works

### The text core

`src/systems/textManager.js` ports DFU's `TextManager`: the string-table collections and their lookups, the id-keyed
name helpers (region, location, spell, item, magic item, faction, enemy), the CSV parser and patcher, and the grammar
rules. Departures:

- A table set per locale; a lookup walks the tag, each shorter tag, then `en`.
- English stays in the code: `localizedText(key, en)` answers the table's word or the English constant.
- `Port_Strings` and `t(key, en, args)` carry the port's own words, in an ICU MessageFormat subset (`{x}`, number,
  plural, selectordinal, select) with plural categories from `Intl.PluralRules`. A malformed pattern is answered as it
  stands, never thrown.
- The pseudo-locale `qps-ploc` (`?lang=` only) accents and lengthens routed text, to find unrouted strings.

### Languages and data

`src/systems/localeCatalog.js` lists the languages with tag, own name, English name, script and source. Thirteen are
whole: Bulgarian, Czech, Danish, French, German, Indonesian, Italian, Korean, Norwegian, Brazilian Portuguese,
Romanian, Russian and Spanish. Twelve are `drafting` (both Chinese, Dutch, Finnish, Greek, Hungarian, Japanese,
Polish, Swedish, Turkish, Ukrainian, Vietnamese) and are not offered unless the player installs a pack for one.
`resolveLocale` and `localeForBrowser` pick a language; a browser that lists English first is offered nothing.

`src/scenes/localeData.js` loads each `locales/<tag>/<table>.csv` as a lazy chunk and patches it into its locale's
table, so a DFU pack's CSVs and the port's drafts are the same kind of file.

### What is translated

- **DFU content**: TEXT.RSC, the `Internal_Strings` keys, the names of things (shown names only; the canonical name
  stays the key that saves and quests read), quests through their `-LOC` files (`src/systems/quest/localizedQuest.js`),
  books (`src/systems/localizedBook.js`), name banks and text databases.
- **DFU packs** installed from disk, zip or folder, read by the folder DFU reads (`src/systems/translationPacks.js`).
  Nothing of a pack is committed or uploaded.
- **Any script**: for every language but English a face over the system's fonts for its script is registered for the
  five classic fonts (`src/ui/localeFaces.js`), drawn through the SDF arm. A pack's own face wins.
- **Saves hold ids**: a notebook header records the minute and the place as ids, so a load draws it in the current
  language.

### The tools

- `tools/translate.mjs` - the pipeline on the Claude API for the game's bulk text, run by Mac with his key.
- `tools/l10nInSession.mjs` - merges in-session drafts through the placeholder law and records their source; `--owed`
  lists what a language still owes.
- `tools/l10nExtract.mjs` - builds the catalog from `t()` calls.
- `tools/l10nHardcoded.mjs` - the ratchet: counts prose still hardcoded, file by file; a count may only fall.
- `tools/l10nReview.mjs` - a speaker's review file, the way a fix comes in.
- `tools/l10n/ROUTE-BRIEF.md`, `tools/l10n/TRANSLATE-BRIEF.md` - the routing and drafting laws.

## Rules

- Community packs: install and bundle allowed. A player installs any DFU pack from their own disk; the port bundles a
  pack only when its terms allow (Mac). Its translators stay in the language's record (`locales/<tag>/translators.json`,
  a bundled pack's `PACK.json`), and no screen credits them (CREDITS-OUT, the owner).
- No string a player reads names Daggerfall Unity, DFU, Interkarma or Nexus, in any language
  (`test/systems/credits.test.js`).
- AI translation: AI drafts, labelled. A machine language says so, and a human pack always outranks a draft (Mac).
- The bulk runs both ways: the port's strings in-session, the game's text through the pipeline (Mac).
- Routing (`tools/l10n/ROUTE-BRIEF.md`): route what a player reads; use DFU's own key where DFU has the same English;
  read lazily, never at module load; build one pattern with arguments, never glued fragments; keep identity strings
  (saved, sent, compared) English and show a routed form beside them.
- Every batch of new keys lands with drafts in every machine language, so the catalog stays covered.
- A language half in English is not offered.

## Daggerfall Unity

DFU ships English and lets a pack overwrite it in place (`TextManager`, `StringTableCSVParser`, `Parser.ParseLocalized`,
`LocalizedBook`, `TextManager.RegisterLocalizedFont`). All of that is ported 1:1, including DFU's missing `TextFlats`
case in `GetDefaultCollectionName`. The locale chain, `Port_Strings`, plurals, the pseudo-locale, system-font faces and
saved ids are the port's own.

## Code and tests

- `src/systems/textManager.js` - the text core, `t()`, `localizedText`
- `src/systems/localeCatalog.js`, `src/scenes/localeData.js` - languages and their tables
- `src/systems/translationPacks.js` - installed DFU packs
- `src/systems/quest/localizedQuest.js`, `src/systems/localizedBook.js` - quests and books
- `src/ui/localeFaces.js` - faces for any script
- `test/systems/l10n1.test.js` - the core against DFU's masters
- `test/systems/l10n1b.test.js` - whole and drafting languages against the catalog
- `test/systems/l10n6b.test.js` - every row a language has is the machine's or a person's
- `test/systems/l10n6_credits.test.js` - the translators' record
- `test/systems/l10n4_hardcoded.test.js` - the ratchet
- `test/tooling/l10n4_insession.test.js`, `test/tooling/l10n4_routing.test.js` - the drafting door and routing

## Open

- Twelve languages are still drafting.
- Right-to-left and complex scripts, the UI images with English painted in, and Unicode player names online are not
  done.
- The ratchet still counts thousands of hardcoded literals.
