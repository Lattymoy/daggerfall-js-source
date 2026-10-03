# Translations

Each folder is one language, named by its BCP 47 tag (`fr`, `pt-BR`, `zh-Hant`). Its files are string tables in
Daggerfall Unity's own format, so a DFU translation pack's files work beside them.

- **`Port_Strings.csv`** holds the game's own words: menus, the online game, the enhanced interface, and everything
  Daggerfall Unity does not have.
- **`Internal_Strings.csv`, `Internal_RSC.csv`** and DFU's other tables hold Daggerfall's own text, keyed as DFU keys
  it. They arrive with the L10N3 slice.

`en/Port_Strings.csv` is the English catalog. It is generated from the source by `node tools/l10nExtract.mjs`; do not
edit it by hand, because the English the game shows is written in the code.

## The format

Each file is UTF-8 with two columns, `Key,Value`, and every value quoted with any quote doubled (`""`). Keep the key
exactly as it is.

`Port_Strings` values use a small ICU MessageFormat subset:
- `{name}` puts an argument in place.
- `{n, number}` is a number in your language's separators.
- `{n, plural, one {# item} other {# items}}` picks by your language's plural rules (`zero`, `one`, `two`, `few`,
  `many`, `other` - use the ones your language has, and always `other`).
- `{n, selectordinal, ...}` does the same for ordinals.
- `{x, select, male {...} female {...} other {...}}` picks by a word.

Keep every argument name; translate only the words around them. A lone apostrophe is plain text; write `'{'` for a
literal brace.

## Machine drafts

Where no human translation exists, the text is a draft by Claude, and the game says so. A fix is a change to the
value, sent as a pull request. Name the language in the title, and a native speaker's review is always welcome.

## The pipeline

`tools/translate.mjs` drafts a language's table on the Claude API:

    ANTHROPIC_API_KEY=... node tools/translate.mjs --lang fr --table Port_Strings
    node tools/translate.mjs --lang ja --table Internal_RSC --dry-run

It drafts only the rows a language lacks, and the rows whose English changed. A row a person wrote or edited is theirs:
`<table>.meta.json` records what the pipeline wrote, so the pipeline sees the edit and never overwrites it. A draft that
loses a placeholder is asked for again, then left out. `locales/<tag>/glossary.json` (`{ "English": "yours" }`) keeps
a language's names the same across a run. Options: `--model`, `--batch`, `--jobs`, `--limit`, `--retranslate`,
`--dry-run`.
