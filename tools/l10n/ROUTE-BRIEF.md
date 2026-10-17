# Routing the port's own strings (L10N4)

The brief a routing batch follows. The port's own words - the enhanced interface, the online game, the port's
systems, every notice Daggerfall Unity does not have - reach a player in their language only through the text core:
`t(key, en, args)` (`src/systems/textManager.js`), whose English lands in `locales/en/Port_Strings.csv`
(`node tools/l10nExtract.mjs`) and is drafted into every language (`tools/l10n/TRANSLATE-BRIEF.md`). English must stay
byte for byte what it was: `t` answers the English pattern while no table has the key. Worked example:
`src/ui/statsCard.js` (the pilot).

## What to route

- Everything `node tools/l10nHardcoded.mjs <file>` lists that a player reads, AND the one-word labels, buttons,
  headings, tooltips and aria-labels it cannot see (it counts two words or more).
- Daggerfall's own words that Daggerfall Unity keys in `vendor/dfu-text/Internal_Strings.csv` with the SAME English
  (attribute and skill names, "Health", "Gold"...) go through DFU's key instead: `localizedText('strength', 'Strength')`,
  `SKILL_NAMES[SKILLS.Dodging]`. Grep the CSV before adding a port key for a word Daggerfall already has.

## What not to route

- Identity: a string that is saved, sent over the wire, compared (`if (label === 'Save')`), used as a key, an id, a
  CSS class, a file name, a log or a thrown error. If a shown string is ALSO stored or compared, show `t(...)` and keep
  the English for the store/compare (record it under "Left" in your report - L10N5 owes ids in saves).
- Names a player gave, mod titles and author names, credits' personal names, Daggerfall's canonical item/place/enemy
  names (L10N3e shows those through DFU's own name tables already).
- Dev-only surfaces no player reaches in play (render labs, `src/tools/`, probe hooks, debug overlays). Leave them;
  say which in your report.

## How

1. **The call.** `t('area.module.name', 'English')`. A key is dotted, lowercase-first segments
   (`^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$`); prefix with the area your batch was given, then the module, then a short
   name. One key, one English (the extractor refuses a key with two). Reuse a key only for the same words in the same
   role.
2. **Arguments, never concatenation.** `` `You have ${n} gold.` `` -> `t('x.gold', 'You have {n} gold.', { n })`. Make
   the whole sentence ONE pattern; never glue translated fragments together, and never `.toLowerCase()` a translated
   word into a sentence (give the embedded form its own key, or pass the canonical value as an argument).
   `${n}` -> `{n}` (prints the plain number, as before). `n.toLocaleString('en-US')` -> `{n, number}` with the raw
   number (English prints the same). An English plural spelled out in code (`n === 1 ? 'day' : 'days'`) ->
   `{n, plural, one {# day} other {# days}}`. A literal brace is `'{'`.
3. **Never at module load.** Static imports evaluate before the boot chooses the language, so a `t()` in a top-level
   `const` freezes English. Read lazily:
   - an exported English constant the tests compare against stays as the English identity, and a reader goes beside
     it: `export const NO_PARTY_TEXT = 'You are not in a party.';` + `export const noPartyText = () => t('social.party.none', NO_PARTY_TEXT);`
     (the extractor reads the module's own constant as the English) - then switch EVERY site that shows it, in every
     file, to the reader;
   - a frozen table of words: getters (`Object.freeze({ get title() { return t('k', 'English'); } })`), or
     `localizedTable({ name: () => t('k', 'English') })` beside DFU rows;
   - a template built at load from other constants: a function.
4. **Pins.** Source-regex pins (`assert.match(src, /townTalk\.say\('Game saved\.'\)/)`) and mutant records
   (`tools/mutants/*.json`, held by `test/tooling/mutantdrift.test.js`) that quote a line you changed are re-aimed to the new
   form; English assertions stay exactly as they were. Never skip, delete or weaken a test.
5. **Counts.** After a file: `node tools/l10nHardcoded.mjs` and write its count into `test/systems/l10n4_hardcoded.test.js`
   HARDCODED (a count only falls); a DFU word you routed through `localizedText` is counted in
   `test/systems/l10n3d_sites.test.js` ROUTED (`node tools/l10nRouted.mjs` lists them). `node tools/l10nExtract.mjs`
   regenerates the English catalog.
6. **Run.** The tests that read your files (`grep -rl <basename> test --include=*.test.js`), every `test/**/l10n4_*.test.js`,
   `test/systems/l10n3d_sites.test.js`, `test/tooling/mutantdrift.test.js`, and `npx eslint <your files>`. `test/systems/l10n1b.test.js`'s
   "every language's file" test fails until the drafts land - that one failure is expected; every other must pass.
