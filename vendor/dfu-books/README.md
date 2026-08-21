# DFU book-id mapping (vendored)

`books.txt` - Daggerfall Unity's classic book id -> title mapping
(`Assets/Resources/books.txt`, MIT License, Interkarma and
contributors), vendored VERBATIM including its trailing comma (Unity's
deserializer tolerates it; the port's loader must too, bug-for-bug).

ItemHelper.SetupBookIDNameMapping loads this list to know which ids
are real classic books: GetRandomBookID draws from its keys and
GetBookFileName answers `BOK%05d.TXT` only for mapped ids. The book
FILES themselves are ARENA2 data (`ARENA2/BOOKS/BOK*.TXT`) and never
enter the repo - only this DFU-authored index does, by the same route
as vendor/dfu-quests (Port-Ledger route (a)).

Provenance: https://github.com/Interkarma/daggerfall-unity
`Assets/Resources/books.txt` at commit
`81e89e90c27bc3c1a7a61871e545fad129174dec`.
