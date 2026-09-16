# SRV-N — the notice that says we pushed, 2026-09-17

Mac:

> One thing I want to add is a server restart notice whenever we push
> server updates. Like a notice that pushes in the chat window.

## "Server" is two things, and only one of them is the server

This port pushes two different things at a player, on two completely
different rhythms. A notice that knew only one of them would have been
wrong about the other, and the one it would have been wrong about is the
one that actually happens.

| | what it is | how often | what a player sees |
|---|---|---|---|
| **the relay** | `server/`, a Cloudflare Worker and its Durable Objects | **by hand** — `npx wrangler deploy`, nothing in CI does it | every socket drops at once: peers vanish, chat goes quiet |
| **the build** | the client, on GitHub Pages | **every merge to main**, several times a day | nothing — they keep running code we replaced |

Mac's words name the first. Mac's *situation* is the second: "whenever
we push" is, for this project, a CI deploy of the client, and the relay
had not moved in days.

So both, and the honest reason for both is in the second row's last
cell. A tab held open across a client deploy eventually asks for a
hashed chunk that has been **deleted** — that is the whole of
`systems/staleChunk.js`, which exists because a player hit it. The build
notice is the same event caught *before* it breaks in their hands, and
the player chooses the moment instead of the browser choosing it for
them.

## The relay could not tell you which relay it was

`RELAY_VERSION` has named the deploy since AUDIT WORLD34 D4 — and only
to `/health`. **Nothing on the wire carried it.** The welcome is the one
frame every socket gets, and it carried `id`, `peers`, `host`, `world`
and `now`; a client had no way at all to tell one deploy from another.

It carries `v` now, on **both** welcomes. The second one is the arm
worth naming: the channel welcome is a different line in the same
handler and it returns early, and it is the **only** welcome a chat link
ever sees. A version on the full welcome alone would have left the chat's
own sessions blind to the restart that had just dropped them.

`world66` → `world67`, because a new welcome field is a relay change.

## Many arms, one answer — for the third time

A player in the enhanced skin holds a **presence** socket plus **one
chat socket per tab**. A hand deploy drops and re-welcomes all of them,
and each one's welcome names the new version. A single "last seen" slot
would have pushed the same notice two, three, four times in a row.

So the detector remembers in a **Set** — the same shape `unloadGuard.js`
arrived at from the other direction two days ago, and the same shape
AUDIT-MACL F3 was about. It buys a second property a slot cannot have:
**a flip-flop cannot double-notify.** A rollback, or one edge still
serving the old Worker while another serves the new, would otherwise
ping-pong a notice on every reconnect for as long as the disagreement
lasted.

## The two detectors are deliberately not the same shape

They are asked different questions, and making them one function would
have made one of them lie:

- The relay's version is a name **we have never seen before** at the
  moment we first hear it. There is no correct value to compare against,
  so the first one heard is a *baseline* and only the second, different
  one is news. A ladder: `unknown` / `first` / `same` / `changed`.
- The build's tag is one **we already know** — `BUILD_TAG` is stamped
  into this very bundle, and vite stamps the same sha into every built
  page's `<meta name="build-tag">`. Compared directly, no baseline:
  `unknown` / `current` / `told` / `changed`.

`buildTagOf` is now one home. `tools/verify-deploy.mjs` asks the same
question of the same tag from node and carried its own copy of the
regex; it imports this one. Two spellings of one rule is two answers to
"has the site moved?", and the one that matters is the one nobody is
watching.

## A notice is a line nobody sent

`ChatLog.push` gained `system: true`, and the panel draws such a line
with **no name and no `#tag`**.

That is not decoration. A **name is forgeable** — `net/nameFilter.js`
guards the words a player may call themselves, not the impersonation —
so a notice recognised by the string `Server` would be one name change
away from a player announcing a fake restart. And `tagOf('')` is a
perfectly real-looking four-character hash, identical on every notice,
which is exactly the mark a player learns to trust.

A flag is not forgeable, because it **never travels on the wire**:
`online.js` builds the object it hands to `onChat` field by field, and
`system` is not one of the fields. The pin drives a relay frame that
tries it anyway.

The notice goes on **every tab**, not the active one. A relay restart
and a new build did not happen to a room; they happened to the game.
Today that is the World tab alone, and a later row in `CHAT_TABS` gets
it for free.

## Nine pins that had to be retyped every time

Bumping `world66` to `world67` reddened **nine** separate assertions of
the form `RELAY_VERSION === 'world66'`, spread across nine suites. Each
was written by the slice that had just bumped the relay and each meant
*"my slice bumped it"* — which stops being true the moment the next
slice bumps it again.

The count is itself the finding. Five showed up on the first run; the
other four only on the next, because their suites had already passed
before the first five were fixed. Nobody knew there were nine, and the
drift was already visible: one test's NAME still said "the relay says
world64" over an assertion that had been retyped to `world66` twice.

They ask monotonically now — `relayVersionAtLeast(66)`, in
`test/relayVersion.mjs`. That is permanently true once true, fails on a
downgrade, on a deleted constant and on a name that stops being a deploy
name, and needs no retyping ever again. It is deliberately *not*
`=== RELAY_VERSION`, which would pass under every mutation; a slice that
needs to prove **it** bumped the relay asserts against the version that
is LIVE, which is what this one does.

## What it does not do

It does not reload for the player. A reload mid-dungeon costs whatever
is not saved, and the build notice says *save first* precisely because
the automatic version of this would be the same class of mistake as an
automatic save on `beforeunload` (`unloadGuard.js` declines that one for
the same reason).

The build poll rides the chat frame, so there is no notice where there
is no chat window — the classic skin has nowhere to put it. The first
poll waits a full `BUILD_POLL_MS` (10 minutes), because a tab that has
just loaded is by definition current and asking at boot would put every
page load on the CDN twice for an answer we already have.

## The thing that must happen before any of this works

**The relay half is inert until the relay is hand-deployed.** The live
Worker is `world66`, its welcomes carry no `v`, and the client reads a
missing version as `unknown` and stays silent — which is correct, and is
also why nothing will be seen until someone runs `npx wrangler deploy`.

And the deploy that lands it is **itself silent**, which follows from the
ladder rather than working around it: a player connected across the
`world66` → `world67` deploy heard no version at all from `world66`, so
`world67` is the first version their page has ever heard — a baseline,
not news. The first notice anybody sees is on the deploy *after* this
one. That is the correct answer and not a gap: "the version changed" is
the only thing that can be honestly claimed, and it cannot be claimed
about a version nothing was known before.

The build half needs no deploy but its own: the first merge *after* this
one is the first tag a running tab can notice.

## AUDIT-SRVN (2026-09-17) — four findings, all against this slice

Mac: *"Audit this"*. Every one of the four sat in what the slice did
**not** think about rather than in what it did, and three of the four are
the same omission: **`v` was written as if the relay were ours.**

### F1 — the only field on this wire with no law

`?server=` and the enhanced menu's **Relay** field both point a client at
an arbitrary relay. That is why `wire.js` holds a law for every other
field a welcome carries — `validPose`, `validLook`, `sanitizeName`,
`sanitizeChat`, `hitOwnerOf`'s 64-character id bound — and every one of
them is *one home, both ends*, because `server/src/relay.js` re-exports
the file whole.

`v` was gated on `typeof m.v === 'string' && m.v`, in `online.js`, and
nowhere else. A **200 KB deploy name was accepted and held** (driven, not
read). It goes through `relayVersionOf` now, `RELAY_VERSION_MAX = 32`,
and a pin asserts the relay's own `RELAY_VERSION` passes the law it
ships — a relay that could mint a name its clients silently refuse is the
same bug from the other end.

### F2 — the one unbounded accumulator the slice added

A welcome is **not once per connection**: `_receive` takes one whenever
the relay sends one. Driven on a single open socket, 5000 welcomes
carrying 5000 fresh names pushed **5000 notices** — `CHAT_KEEP`
twenty-five times over, so a player's entire chat history was replaced by
fake restarts — and `_relaySeen` kept every name for ever.

Everything else in this area is bounded: the chat log at `CHAT_KEEP`,
`online.js`'s `_threwKinds` at `THREW_KINDS_MAX`, with a clear. This was
the exception. It is bounded the same way now, and the bound **fails
towards silence**: an emptied set re-baselines, and a re-baseline says
nothing. Losing a notice is the correct way for this to break; inventing
one is not.

The other half is a minimum interval, and it is not really a rate limit —
it is the physical fact. A relay cannot restart twice in thirty seconds,
so a second "it restarted" inside one is not news about the world,
whoever sent it. `'flood'` is its own verdict rather than `'same'`
because they are different facts.

**Honest scope:** a hostile relay already has an *ungated inbound `chat`
firehose* — `_receive`'s chat arm has no rate gate at all — so this
finding does not widen the attack surface so much as decline to add to
it. That pre-existing gap is flagged below, not fixed here.

### F3 — two gates where one heals and the spare latches

`buildPoll` carried both an interval stamp and a `_buildPolling` boolean.
The boolean was **redundant** — the stamp is taken when the poll *starts*,
so it already refuses a second one for a full interval — and it was a
**hazard**: a request that never settled left the flag raised and the
poll dead for the rest of the session. There was no timeout.

The boolean is gone and the request is cancelled on a deadline
(`AbortSignal.timeout`, guarded for hosts without it). One gate that
heals itself beats two where the spare can stick.

### F4 — a field written on every welcome and read by nobody

`session.relayVersion` had exactly one reader: its own test. Which relay
this socket is on is a question `updateNotice.js` already owns, and a
second copy of it is a second source of truth — the shape AUDIT-CHATR
deleted `whoRows()` for. Deleted. The hook is the whole seam.

### What the audit did NOT find

The notice **does** reach a player: `onlineFrame` → `chatFrame` →
`buildPoll` is a live path, `online.onRelay` is assigned once and never
clobbered, and this is genuinely **not a FOUR HOSTS seam** — the chat is
created and framed in `world.js` alone, by CHAT1's design, so there is no
fourth host to have forgotten. That last one was checked rather than
assumed, because four consecutive slices found their bug there.

## The campaigns

**18 mutants, 18 killed** on the slice. — including the two that are "notify on the
first version heard" and "notify once per socket" (a slot in place of
the Set), the one that reads `v` below the primary gate, which silently
blinds every chat link, the one that drops `v` from the channel welcome
alone, the one that lets a wire frame set `system`, the one that draws a
notice with a name and a tag, the one that puts the notice on the active
tab only, the one that polls every frame, the one that drops
`cache: 'no-store'` (which would have compared the cached page's tag
against itself for ever), and the one that ships the client against the
name of the deploy that is live.

**14 mutants against the audit's own fixes, and the first pass killed
only 10.** The four survivors were each a real hole:

- `String(v ?? '').length > 0` in place of the `typeof` passed every
  scalar case I had written, because a number has no `.length` and fails
  the cap test *by accident*. What it lets through is anything wearing a
  length — and `JSON.parse` of a hostile frame hands back exactly that.
  The pin asks about arrays now.
- The detector's own use of the wire law was unpinned: every case I had
  written agreed with a local `String(v).trim()`. The cases that part
  them are the ones only the wire knows.
- **The bound itself had no assertion.** The flood test passed unbounded,
  because the rate gate alone explains it. Telling a bounded set from an
  unbounded one needs a behavioural question — a name from the *start* of
  a long walk, which an unbounded set would still answer `'same'` to.
- Deleting the stamp alone left the gate reading a number nothing ever
  wrote, so after one interval the poll ran every frame. A gate whose
  state is never written is not a gate.

All 14 killed on the second pass. **The lesson is the third one: a guard
I added in this very audit was, for an hour, exactly the kind of
unfalsifiable line the audit existed to find.**

## Flagged, not fixed

`online.js`'s inbound `chat` arm has **no rate gate**. The relay gates
what it *accepts* (`chatGate`, `CHAT_HZ_MAX`), and the client gates what
it *sends*, but a relay can push unlimited `{t:'chat'}` frames at a
client and nothing counts them. That is older than this slice and wider
than it, so it is not fixed here — widening a notice PR into a wire
hardening PR is the author's call, not mine. It is the natural companion
to F2.

## Not seen on a GPU

Two notices, one chat panel, driven in node. **Nobody has watched a line
arrive.** Worth a pass after the relay deploy: open the chat, redeploy
the relay, and watch for one notice rather than three.
