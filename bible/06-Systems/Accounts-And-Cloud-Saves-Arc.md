# Accounts and cloud saves (ACC)

ACC0 — the design record, 2026-09-21. ~~Nothing below has shipped.~~
**ACC1a, ACC1b, ACC1c and ACC1-CI have shipped since**, and AUDIT-ACC
has been over all of them; the sections below carry their own dated
headings and this line was left stale for half a day, which is the
exact failure DEPLOY-PROSE was opened for. ~~Nothing is DEPLOYED yet:
the deploy fires on merge to main.~~ **IT MERGED AND IT DEPLOYED**
(6743d3bdb, 2026-09-21): the account service is LIVE at
`https://daggerfall-accounts.mackcothran.workers.dev`, `/v1/health`
serves `acct1`, and `/v1/pubkey` publishes the signing pair's public
half. The first-ever run created the database, applied both migrations
through the ledger and minted the pair, with nobody touching a
Cloudflare dashboard — and the relay deploy on the same commit finished
having deployed nothing, because `RELAY_VERSION` was unchanged, so not
one player was dropped. That is the two-Worker split's central claim,
demonstrated rather than argued.

This page is the shape agreed with Mac before any code, and it says
what is decided, what is lifted from another repo, what is genuinely
new, and what is still open.

Mac (2026-09-21):

> I now want to talk about cloud storage and account creation needed for
> accessing online mode. We have a solid architecture built within my
> other repo, Fight Life, and I wondered if any of that is reusable

---

## THE FIRST THING THE ARC HAD TO LEARN: WE ALREADY HAVE ACCOUNTS

The question read like "add accounts", and the honest answer after
reading the tree is that **SOC1 built them five days ago** and nobody
called them that on this page.

`net/social.js` keeps `dagger.online.account` and
`dagger.online.accountSecret` in `appStorage` — a durable id the player
holds, deliberately durable (AUDIT SOC B10: "an account is a DURABLE
thing… every load would be a new permanent account" was a defect, and it
was fixed). The hub — the world channel's Durable Object, inside the
relay Worker — keeps `acct:<id>` (its last name, last-seen, friends,
requests, party) and `asecret:<id>`, minted by the first hello and
matched by every later one. Friends, requests and the four-seat party
all hang off that id.

So this arc is **not** "make accounts exist". It is two much smaller
sentences:

1. Give the account that already exists a way to be **PROVEN** — a
   provider link, so it survives a cleared browser and reaches a second
   device.
2. Give it somewhere to **KEEP THINGS** — the saves.

That reframing matters, because the version of this arc that does not
know about SOC1 stands a second account system up beside the first. Two
stores that both answer "who is this player" is the byte-groups bug of
EM7 at system scale, and it would be far harder to unpick.

---

## THE WALL, as Mac drew it

Mac, across three messages, and the third corrected the first two:

> let guest have access to chat also, but definitely a random name. I
> feel like accounts should only get cloud storage though

> the account name would be used for online.

| | guest | linked |
|---|---|---|
| connect, be seen, walk | yes | yes |
| chat | yes | yes |
| name | **generated, unchosen** | **the account's own name** |
| cloud saves | no | yes |

**THE WALL IS AT CLOUD SAVES AND NOWHERE ELSE.** Nothing a player can do
today is taken away, there is no sign-in dialog between anyone and the
game, and the account is a feature people want rather than a toll.

**AND THE NAME IS THE SECOND REASON TO LINK**, which is what makes the
moderation story work rather than a gate would. A guest may talk but may
not be anyone; a linked player may be someone but has a real provider
identity on the line. **The only people who can take a name are the
people who can be banned** — the impersonation vector and the
accountability arrive together, and neither exists without the other.

This was argued the other way first (this session, twice) and both
earlier positions were worse. Recorded because the reasoning is the
load-bearing part:

- "Accounts required for online" buys moderation and costs the thing
  that makes online worth opening. The population is small; an empty
  world is a worse problem than an occasional bad line.
- "Random names for everyone" removes impersonation permanently and
  leaves linking with nothing to offer but a backup.
- Mac's cut keeps the door open AND gives the name teeth. It is better
  than both.

The residue, stated plainly: a guest's bad behaviour is answerable only
by the word filter (NAME-F1/F2) and the rate gates (CHAT-G, per socket
and per room). A ban on a guest is one storage clear from undone. At
this scale that is accepted. One mitigation is free and does not touch
the wall: because a guest is a real account row, a mute can be a flag on
that row — it survives a refresh, not a storage clear.

---

## WHERE AN ACCOUNT LIVES, and the one thing that has to move

Today an account lives in the hub's Durable Object storage. That works
for friends, parties and presence: small, keyed, hot, and all within one
object. It cannot work for what this arc adds, for one reason that is
not a matter of taste:

**A PROVIDER LINK IS A LOOKUP BY SOMEBODY ELSE'S ID.** "Which account
belongs to this Google subject?" is an index over all players. A Durable
Object cannot answer it without becoming a single global object every
sign-in queues behind, which is a bottleneck deliberately avoided
everywhere else in `server/`.

So: **D1 owns identity. The hub keeps what it already keeps.**

| lives in | what |
|---|---|
| **D1** (new) | accounts, provider links, sessions, the save slot cards |
| **R2** (new) | the save blobs and their screenshots |
| **hub DO** (today) | friends, requests, parties, presence, last-seen |
| **room DO** (today) | poses, chat, the world's memory |

The hub stops MINTING accounts and stops holding `asecret:<id>`. It is
handed a verified identity instead. That is the one migration this arc
forces, and section *Carrying the existing players over* says how.

---

## THE TOKEN, which is the real new seam

Today the hello is `{ t: 'hello', id, secret, name, look, pose }` and
**the client asserts its own name**; the relay sanitises it and has no
idea whether it is yours. That is fine while a name means nothing. The
moment a name means "this is a linked account", a forged name is worth
forging — and every name on the roster becomes a claim nobody checked.

So the account service issues a **short-lived signed token**, the hello
carries it, and the relay verifies the signature and reads the name
**out of the token** rather than off the frame.

- The relay never touches D1 or R2. It checks a signature. That is all.
- **One mechanism covers both kinds of player**: a guest is issued a
  token too, carrying its generated name. The relay cannot tell them
  apart and does not need to.
- It closes a hole that exists today regardless of accounts.

The token is the reason the answer to "one Worker or two" is **two**.
Section *Two Workers* has the rest of that argument.

---

## TWO WORKERS, and the argument that settles it

The account service is its own Worker, not a route on the relay.

**A relay deploy restarts every Durable Object and drops every connected
player.** That is an acceptable price for changing the relay's own law.
It is not an acceptable price for fixing the wording on a sign-in
button.

And it is not hypothetical here. SLAM8 hashes the **raw bytes** of every
file the Worker bundles, comments included and deliberately so —
`/health` answers "is the Worker running the bundle I built?", and a
bundle whose comments differ is a different bundle. On 2026-09-21 a
one-comment correction to `src/net/wire.js` was abandoned for exactly
this reason (DEPLOY-PROSE; the stale sentence is still in the file and
the gate records why). Put accounts in that bundle and **every auth
tweak drops everyone mid-dungeon.**

The costs of two, stated so nobody re-litigates it cheaply: two URLs,
two CORS origins, two version stamps, and a token seam between them.
They are small, and the token seam has to exist anyway.

**THE HUB IS THE AWKWARD PART, and it is not resolved here.** The hub
lives *inside* the relay Worker today (the world channel's object). A
social change therefore already costs a player-dropping deploy, which is
a pre-existing cost this arc does not create and does not fix. Whether
the hub eventually moves is left open — see *Open*.

---

## WHAT COMES FROM FIGHT LIFE

`Lattymoy/fight-life-source`, read at `49f4ff4`. It is a Cloudflare
Worker over D1 **on the same Cloudflare account**, so this is a second
tenant rather than a port.

**Lifts close to as-is:**

- **`fight-life-source/server/src/auth.js`** — provider identity verification for Google,
  Apple and Play Games. Deliberately provider-agnostic: everything
  upstream operates on an opaque `{ providerId, email }`, so adding a
  provider is one branch and nothing else moves. Google and Apple verify
  RS256 signatures against published JWKS inside the Worker; Play Games
  exchanges a server auth code. **No client-asserted identity is ever
  trusted — only a token the provider signed.**
- **The three migrations** `account_links`, `sessions`, `player_state`.
- **`sessions` is the one to read first.** Fight Life originally had one
  secret per player and rotated it on sign-in, so signing in on a
  desktop silently 401'd the phone on every write — Mac hit it himself.
  A session is the credential now, one per device, and sign-out revokes
  only that device. Daggerfall would hit the identical bug on day one.
- **`fight-life-source/src/online/playerState.js`'s hydrated mirror** — synchronous reads
  off an in-memory mirror, writes update the mirror synchronously and
  push in the background, failed pushes retried. This matters more here
  than there: the port's save and load callers are synchronous and some
  sit in frame-timed paths, and making them async is how a game acquires
  stutter.
- **`fight-life-source/src/online/nameGen.js`** — generated names, which is exactly what a
  guest needs.

**Does not come across:** the ladder, Elo, the economy, the pass, the
challenge and fight-verification stack. None of it has a subject here.

### Two places Fight Life's schema is not enough

1. **`handle` is a bare `TEXT` column with no uniqueness constraint.**
   Defensible there — it is a display name beside a rating. Here the
   name *is* the identity, and two players called "Nystul" is the same
   defect as forging one, only slower. This arc wants a `handle_lc`
   column with a unique index, so casing cannot smuggle a duplicate
   past it. The port's own NAME-F1/F2 filter moves onto the handle
   endpoint — refuse at entry, which is what NAME-F2 was written to do.
2. **`player_state` is for small JSON blobs**, and its body cap is
   96 KB (`MAX_BODY_BYTES`). A Daggerfall save is a world state plus a
   screenshot. See below.

---

## THE SAVES: R2 for the blob, D1 for the card

A Daggerfall save already hits `QuotaExceededError` in `localStorage`
(`systems/save.js` handles it by name), which places its size class
above both D1's practical per-row ceiling and a Worker's body cap. R2
also has no egress fee, which matters for a game nobody pays for.

**The screenshot is its own object.** The slot list needs thumbnails,
and fetching a whole save to draw a slot card would be absurd.

    saves/{playerId}/{characterId}/{slot}/data
    saves/{playerId}/{characterId}/{slot}/shot

with D1 holding the card — `characterId`, save name, game time,
`updatedAt`, and the two keys.

**THE CLOUD IS A BACKUP AND A TRANSFER. THE LOCAL SAVE STAYS
AUTHORITATIVE.** This is the most important sentence on the page and it
is a deliberate limit rather than a first cut.

This repo has CHARID1 and SP1 *because players lost games* — one
overwrote a character by reusing a name, another installed the app and
found empty slots. A design where the cloud is the truth is one where a
sync bug is catastrophic; a design where the cloud is a copy is one
where the same bug is an inconvenience. The carrier already exists:
SP1's `systems/saveTransfer.js` defines a canonical portable layout
(`Saves/SAVE<n>/SaveData.txt`, `SaveInfo.txt`, `Screenshot.jpg`) and
moves slots between the browser's store and the desktop's files. **The
cloud is a third destination for a carrier that already works**, not a
new kind of save.

Two things already in the tree fit this seam exactly, and both landed
this week for unrelated reasons:

- **`systems/characterId.js`** (CHARID1) — a character is a stable id
  rather than a name. That is the key a cloud save is filed under, and
  it exists because a Discord player lost a character to a name clash.
- **`systems/appStorage.js`** — already the one door between the
  browser's storage and the desktop's files. A cloud backend belongs
  **behind that same door**, not beside it.

---

## CARRYING THE EXISTING PLAYERS OVER

Players already hold `dagger.online.account` ids, and the hub already
holds their friend lists against those ids. Nothing may orphan them.

**ACC0 SAID THE ACCOUNT SERVICE WOULD ADOPT THE EXISTING ID, AND THAT
WAS WRONG.** It is recorded here rather than quietly rewritten, because
the error is instructive and it was found by trying to build it (ACC1b).

The adoption story assumed the account service could verify an existing
`(id, secret)` pair. It cannot: **the hub minted that secret and the hub
is the only thing that holds it.** `asecret:<id>` lives in a Durable
Object's storage inside the relay Worker, and the account service is
deliberately unable to reach it. Every way of closing that gap is worse
than the gap:

- Adopt an id on sight, without checking the secret. Whoever presents it
  first owns it — a land-grab on every account that has not reconnected.
- Have the hub sign a voucher. Then the relay holds a signing key, and
  the one property that lets the relay be the bigger attack surface —
  **a public key cannot mint** — is gone.
- Let both hold the truth and reconcile. Two answers to "who is this".

**THE MERGE BELONGS AT THE HUB**, which is the one place that holds both
credentials at once. A socket that presents a verified identity token
AND the old `(id, secret)` the hub itself minted is a socket the hub can
see is the same person, so the hub moves the friend list across. The
account service never needs to know SOC1 existed.

That slice is built: FRIENDS-SYNC (2026-10-01, `01-Overview/Field-Bugs-2026-10-01.md` part five - "My friend list is
different between devices"; Mac: "Build it") keys the hub's account by the token's subject and merges a profile's
list into it once, on that profile's secret (relay world142). ACC1b mints its own ids and
knows nothing about the social arc. What survives from ACC0 is the
smaller and still-true half: the ids are the **same shape** at both
ends, which is what makes that merge possible at all, and a pin reads
`net/social.js` to keep it that way.

A player who never plays online never has any of this happen to them.

---

## THE ORDER TO BUILD IT

1. **Identity alone.** Guest rows, sessions, the token, and the adoption
   of existing SOC ids. No storage at all. Prove an account exists,
   survives a reinstall, and that two devices can hold sessions at once.
2. **The token at the relay.** The hello carries a token, the name comes
   out of it, the client stops asserting one. Guests get generated
   names. This is where the forged-name hole closes.
3. **Provider linking.** Google first — Apple needs a paid developer
   account and Play Games only earns its keep if an Android build
   exists.
4. **The card and the blob, backup only.** Upload on save, list on
   demand, download on request. Local unchanged, and a failure is a
   message rather than a lost game.
5. **Chosen names**, once linking exists to hang them on: the handle
   endpoint, `handle_lc` unique, NAME-F1/F2 at entry, a rename limit.

Cloud saves as the source of truth are **not** on this list. That would
be its own arc, after a long boring stretch of the backup path working.

**THIS ORDER CHANGED AT STEP 3, AND THE REASON IS MAC'S.** The list
above hung chosen names off provider linking (step 5, "once linking
exists to hang them on") because a provider was assumed to be how a
player proves who they are on the next device. Mac's *"Username and
Password will be the main thing for the account"* makes the handle the
identity itself and the password the proof, so ACC1c shipped both
straight after ACC1b and a provider is now an optional convenience
rather than the foundation. Steps 3 and 5 collapse into that; step 4
is unchanged and next.

---

## ACC1b — SHIPPED 2026-09-21: the account service

`server-account/` — a second Cloudflare Worker over D1. Identity alone:
guests, sessions and the token. No password yet (ACC1c), no provider
links, no saves (ACC2). ~~It is written and tested and it is not
deployed, because creating a D1 database and putting a secret on the
account are things only Mac's Cloudflare login can do.~~ **ACC1-CI
corrected that** — the same token that deploys the relay does both, so
the deploy stands the service up itself and the D1 binding is live. See
*ACC1-CI* below.

**A GUEST IS A REAL ROW FROM FIRST CONTACT.** Not a lesser kind of
account — an account with no provider attached yet, which is the whole
of ACC0's wall and is why linking will migrate nothing.

**A SESSION IS THE CREDENTIAL, one per device** — and **AUDIT-ACC F6
corrected what this paragraph used to claim about it.** It said Fight
Life "had one secret per player" and that "that bug is not being
ported", which reads as though the fault were still live over there and
this arc had stepped around it. Reading
`fight-life-source/server/schema.sql` shows the opposite: they hit it,
Mac found it by playing (farming on one device while playing on the
other), and their Account-First arc replaced it with a sessions table.

**So this is their FIX, carried over, not a bug of theirs avoided.**
The shape is theirs down to the reasoning — a row per device, sign-out
revoking *this* session because every account system a player has used
behaves that way, "everywhere" as a separate explicit act, one indexed
lookup on the hot path, and a device label that is never trusted for
anything but display. Under-crediting a source you lifted from is the
same class of error as any other false claim in a record, and it is
worse here because the source is Mac's own other repo.

What this arc adds is that the property is **driven** rather than
inherited on trust: the pin opens two sessions and uses both.

**THE GUEST NAMES COME FROM DAGGERFALL'S OWN BANKS** — the same
`nameGen.json` the chargen wizard and every townsperson draw from — so a
visitor is an inhabitant rather than an Ochre Fox. Mithriil Stormaire,
Erebain Avalul, Karodell Bluethorn.

**AND A GUEST NAME CANNOT COLLIDE WITH A HANDLE, STRUCTURALLY.** A
generated name carries exactly one space; a chosen handle carries none.
No lookup, so nothing can race a rename — the alternative, checking each
generated name against the handle table, answers "not taken YET".

That law was nearly written the wrong way, and the way it failed is the
point: **the first cut spelled the guest shape as `[A-Za-z]+ [A-Za-z]+`
and its own pin caught `Akh'ar Arabi` on the eighteenth draw.** DFU's
banks carry apostrophes and hyphens. Enumerating an alphabet is how a
rule comes to disagree with the data it is about, so the law rests on
the space alone now, and a pin derives the bank's whole alphabet and
asks the one question that would actually break it — does any part carry
whitespace?

**THE SQL IS THE REAL SQL.** D1 is SQLite, so the pins apply the real
migration to a real SQLite through a D1-shaped adapter. The schema, the
UNIQUE index and the foreign key under test are the ones that will be
live; a hand-rolled fake would have proved only that the fake agreed
with itself, and would have been green over a typo'd index. What it
does not prove is written into the file: no network, no Cloudflare, no
D1 limit.

`handle_lc` is UNIQUE, which is the gap in the schema this was lifted
from. Fight Life's `handle` has no constraint at all — defensible for a
name beside a ladder rating, and not where the name *is* the identity.

15 mutants, 13 dead, 2 recorded equivalent. **Both survivors were real
holes.** The modulo-bias pin could not see plain `% n` at all: over
exactly 255 accepted draws, the biased and unbiased spellings both come
out 85/85/85, so the rejection is now asked the one way that cannot be
faked — a generator offering only the value above the last whole
multiple must never answer. And nothing had ever *sent* a name in a
token request, so a client-asserted name could have come back signed,
which is worse than an unsigned one because the relay would believe it.

## ACC1c — SHIPPED 2026-09-21: the username, the password, and the one way back in

Mac: *"Also want to mention I want email completely optional. Username
and Password will be the main thing for the account"* — and, asked what
a player does who forgets one: *"Yes"* to a recovery code.

**EMAIL OPTIONAL MEANS PASSWORD RESET IS IMPOSSIBLE.** There is no
address to send a link to and no second fact about the player the
service holds, so a forgotten password would be a lost account — and
with it the cloud saves, which are the only reason the account exists.
A design whose failure mode is "your forty-hour character is gone" is
not one to ship quietly, so the recovery code is not a nicety here; it
is the whole of what email would otherwise have been.

The code is minted at registration, shown **once**, and stored exactly
as the password is: hashed, salted, unreadable on this side. Spending it
sets a new password **and mints a new one**, because a player left with
no way back in has simply had the same cliff moved one step away.

**REGISTERING IS AN UPGRADE IN PLACE.** The guest row *is* the account —
ACC0's wall again — so a handle and a password are two columns filling
in on a row that already exists, and the id, the sessions and (later)
the saves come along untouched. Nothing migrates.

**PBKDF2-SHA256 AT 210,000 ITERATIONS**, because it is what WebCrypto
gives a Worker. scrypt and argon2 are better and neither is available
without shipping WASM into a hot path; that trade is written in
`server-account/src/password.js` rather than pretended away. **The
stored form is self-describing** — `pbkdf2-sha256$<iters>$<salt>$<hash>`
— so the count can be raised in a year and every existing row still
verifies under the count it was written with, then gets rewritten at the
new one on its owner's next correct login. A bare hash column cannot be
upgraded without logging everybody out.

**THE RECOVERY CODE ROUND-TRIPS, AND THE PIN FOUND THE BUG THAT SAYS
WHY THAT IS WORTH PINNING.** The first cut folded Crockford's ambiguous
letters as `O→0`, `I/L→1`, **and `Q→0`, `U→V`**. But **Q is in the
alphabet** — so the very first code the generator printed,
`7GEPQ-47BS9-AYK70-QMWYW`, could never have been typed back in. A
generator and a reader that disagree about their own alphabet lock out
exactly the people who need the code, and nothing but a round trip
catches it. The folding is now the three letters Crockford actually
folds, and 2000 minted codes go back through the canonicaliser
lowercased, spaced and mis-typed.

**LOGGING IN COSTS THE SAME FOR A HANDLE NOBODY HOLDS.** A miss derives
against a dummy stored hash instead of returning early, because a fast
401 is a free enumeration of the whole player table. The pin measures
it rather than reading the code, which is the only way that claim means
anything.

**GUESSING IS THROTTLED PER HANDLE AND PER ADDRESS**, ten in fifteen
minutes, in a `rate_limits` row rather than in memory — a Worker isolate
is not a place to keep a counter, and one that lives there is reset by
the platform whenever it feels like it. The correct password is refused
too while the window holds (a throttle a right answer walks through is
not a throttle), and a successful login forgives the key, so somebody
who mistyped twice is not still on a countdown.

**A PASSWORD IS CHANGED WITH THE OLD ONE**, even from inside a live
session: a stolen phone should not be able to lock its owner out. That
act signs every *other* device out and keeps the one that proved the old
password. Recovery signs out *every* device including the one standing
there, because the reason somebody is recovering may be that another
person has their password.

**AND EMAIL IS COMPLETELY OPTIONAL AND MEANS IT.** The account
registers, logs in, recovers and changes its password with no address
ever set; an address a player never gave is not in the account view at
all; one that is given can be taken off again; and nothing anywhere is
gated behind having one.

`0002_passwords.sql` is a **separate migration and it is not
idempotent**, which 0001's note nearly got wrong for it: `ALTER TABLE
ADD COLUMN` has no `IF NOT EXISTS`, so applying 0002 twice errors with
`duplicate column`. That is a refusal rather than damage — nothing is
half-applied — and the migrations are applied once each, in order.

18 mutants, 16 dead, 2 recorded equivalent: the compare's short-circuit,
which is not measurable through a PBKDF2 derivation that dwarfs it, and
a refusal-naming mutation that moves both spellings together, so the
equality the pin actually asserts still holds.

## ~~WHAT MAC HAS TO DO BEFORE ANY OF THIS IS LIVE~~ — ACC1-CI, and there is nothing

~~None of it can come from CI; it creates resources rather than
deploying code.~~ **That was wrong, and it was wrong on the same day
DEPLOY-PROSE finished paying for the identical mistake on the relay.**

Mac, reading the four-step list:

> The token provided allows you to take this on yourself. I am not
> needed at all.

He was right. The reasoning behind the list — *CI can deploy code to
resources but cannot create them* — is simply false of the Cloudflare
API token that has been deploying the relay since SRV-N/CI. The same
token creates a D1 database and sets a Worker secret. Every one of the
four steps had an idempotent spelling, and nobody had looked for one.

`.github/workflows/account-deploy.yml` now does all four on every push
to main that touches the service, and `server-account/wrangler.toml`
says so instead of carrying the list.

**A LIST OF MANUAL STEPS IS A DEPENDENCY ON SOMEBODY'S ATTENTION**, and
this arc had written four of them into the one place a person looks
last. The failure mode is not that a step is hard; it is that the
service sits finished and undeployed for as long as nobody has an
afternoon.

### What changed to make each step automatic

| step | was | is |
|---|---|---|
| the database | `d1 create`, then paste the id into the toml | created if absent; the id is **resolved from Cloudflare** and written into the runner's copy, never committed |
| the migrations | two `d1 execute --file` lines, "in order and once each" | `d1 migrations apply`, which keeps a `d1_migrations` ledger **in the database** |
| the signing pair | mint, then `secret put`, then copy the public half into the relay | minted **only if absent**, both halves piped straight in, public half served at `/v1/pubkey` |
| the deploy | `npx wrangler deploy` | on push, then verified by content against `/v1/health` |

**THE MIGRATION CHANGE IS THE ONE THAT WAS ACTUALLY LOAD-BEARING.**
ACC1c had to write a warning that 0002 is not idempotent — `ALTER TABLE
ADD COLUMN` has no `IF NOT EXISTS` — and then trust a reader to apply
each file exactly once. Wrangler's ledger makes that a property of the
tool. *"Apply each one once, in order"* was never a law; it was a hope
addressed to whoever read the comment.

**AND THE PUBLIC KEY HAD TO STOP BEING A THING SOMEBODY CARRIES.** The
old step 3 ended "…and the PUBLIC half into the relay's config", which
is a copy-paste between two systems performed by a human once, at a
moment nobody records. Now the pair is minted by a job no person
watches — so the service **publishes its own public half** at
`/v1/pubkey`, openly and before any credential, because a public key
can verify and cannot mint. ACC1d reads it from there.

That also closes the hazard the automation introduced: a pair minted
where nobody can see it, in a service that could not hand the public
half back, would be a verifying key nobody can ever read — and the only
way to get one would be to re-mint, which invalidates every token
already issued. The deploy's last step asks `/v1/pubkey` for a key and
fails if it does not get one.

### What the gate's own mutants found

`test/accountdeploy.test.js`, 6 pins; `tools/mutants/acc1ci.json`, 18
mutants, 17 dead and 1 recorded equivalent. **Four survived the first
run and every one was a hole in the pins rather than a mutant worth
keeping:**

- The sentinel check asked whether the workflow *contained* the string.
  The workflow's own header comment quotes it while explaining what it
  is for, so the prose answered for the code and a drifted shell
  variable sailed through. It reads the **assignment** now.
- The re-mint guard was checked as "`exit 0` comes before `secret
  put`". A mutant that moved the whole guard *down past the minting
  call* satisfied that and still re-minted on every deploy. The pin
  reads four landmarks in order now — look, bail, mint, put.
- The derived-host check asked whether the workflow contained one
  `grep '^name'` **anywhere**. There are two steps that build a URL; a
  mutant that hardcoded the host in one survived on the other one's
  line. It is asked per step now, of every step that builds a URL.
- The comment-exemption controls carried **copies** of the assertion's
  regex, so blanking the assertion left the controls proving only that
  two throwaway literals still matched each other. One regex, used
  three times.

**AND THE CAMPAIGN'S FIRST RESULT WAS ITSELF A LIE.** A duplicate
`const mint` made the test file fail to *parse*, so every mutant came
back dead — 17 of 18 green with nothing being asked at all. A mutation
campaign is evidence only if the unmutated suite is known to run, and
that is now the order it is done in.

### The one thing that is still a person's

The **Cloudflare API token itself**, in `secrets.CLOUDFLARE_API_TOKEN`.
It was already there for the relay; nothing about this arc adds a
credential anywhere. If that secret is ever missing or under-scoped,
the workflow's first step says so in one line rather than letting
wrangler fail four steps later with an authentication error that reads
like a wrangler bug.

## AUDIT-ACC — 2026-09-21, Mac: "Let's do a proper audit on everything"

Four lenses over ACC0-ACC1c and ACC1-CI. **Six findings, and the two
that mattered were both invisible to a green suite** — they were found
by standing the Worker up in a real workerd, which nothing in this tree
had ever done.

### F2 — THE WORKER DID NOT BOOT. AT ALL.

```
Uncaught TypeError: Incorrect type for map entry 'ACCOUNT_VERSION':
the provided value is not of type 'function or ExportedHandler'.
```

In a module Worker **every named export of the entrypoint is read as an
entrypoint** — a WorkerEntrypoint, a Durable Object, a Workflow. A
plain string is not one, so it is a hard startup failure.
`server-account/src/index.js` exported four constants and a test hook. The first `wrangler deploy`
after merge would have produced a dead service.

**AND THE SUITE WAS GREEN BECAUSE OF THE BUG, NOT DESPITE IT.**
`test/accountworker.test.js` imported `ACCOUNT_VERSION`,
`MAX_BODY_BYTES` and `_resetKeyForTests` — so it proved those exports
existed, which was precisely what the runtime was refusing to start
over. **Importability is not deployability**, and nothing here had ever
asked the second question.

The relay is the control and the reason the rule is stated carefully:
`server/src/index.js` exports `default` and `export class Room`, and has
deployed for months. A class is a legal entrypoint; a constant is not.
So the law is *no named **value** exports*, not *no named exports*.

Fixed by giving the constants and the key cache their own homes
(`service.js`, `signing.js`) and leaving the entrypoint exporting only
a handler. The entrypoint had been doubling as a library.

### F1 — THE RE-MINT GUARD FAILED OPEN, AND READ CORRECTLY

ACC1-CI's proudest guard — *never re-mint, because that invalidates
every token in flight* — never fired. `wrangler secret list` has no
`--json` flag; it takes `--format json`. Given an unknown flag wrangler
printed its **help text** and exited 0, `jq` could not parse that, the
`if` went false, and the step fell straight through to minting.

**Every deploy would have signed out everybody online**, while the
guard sat there looking right.

The flag was only the trigger. **The fallback was the fault:** `|| echo
'[]'` turns *"I could not read the secrets"* into *"there are no
secrets"* — a destructive default reached by ignorance. The listing must
now succeed **and** parse as an array, or the step fails and mints
nothing.

### The other four

- **F3 — not a defect.** A verify failure against the live `/v1/pubkey`
  turned out to be the audit's own harness calling
  `importPublicKeyB64(key, subtle)` instead of `(key, { subtle })`.
  Checked before it was reported.
- **F4 — the player id under two names.** `id` from `/v1/auth/guest`
  and `/v1/auth/login`, `playerId` from `/v1/account`, and `playerId`
  in the comment documenting the *guest* response. ACC1d would have
  read `account.id` and got undefined. Settled on `id` while nothing
  consumes it.
- **F5 — `.wrangler/` was not ignored**, so the local D1 and the
  workerd build of the Worker were staged for commit the moment anybody
  ran the probe. `.dev.vars` is ignored now too: it is exactly the file
  a signing key gets pasted into by accident.
- **F6 — the record under-credited Fight Life.** See the session
  paragraph above: it said *"that bug is not being ported"*, implying
  the fault was still live over there. They hit it, fixed it, and this
  is their fix.

### What the audit MEASURED rather than assumed

`tools/accountProbe.mjs` (`npm run account`) now stands the service up
on every run. 21/21:

- **Ed25519 exists in workerd** at the committed compatibility date —
  48-byte PKCS8, 32-byte raw public, 64-byte signature, verify true.
  The entire token design rests on this and it had never been checked.
- **PBKDF2 at 210,000 costs 36 ms** there, which is the `~35 ms`
  `password.js` claims. The claim was right.
- **Both migrations apply in order** through wrangler's own ledger.
- **A token the Worker signs verifies against the key the Worker
  publishes** — the exact seam ACC1d needs, both ends live, with a
  stranger's key and a bent byte refused as controls.
- **Nothing in this arc is in the relay bundle.** `RELAY_GRAPH` is 5
  files and none of them is `identityToken.js` or anything under
  `server-account/`. The two-Worker split's central promise — *this
  deploy drops nobody* — is now measured rather than argued. **ACC1d
  changes that:** the moment the relay imports the token module, it
  joins the bundle and every edit to it costs a deploy.

### The probe's own two bugs, and one that was mine

Its first run scored 19/21, and both failures were the probe's: it
counted wrangler's repeated summary table as duplicate migrations, and
it read `account.id` (which was F4). Then it began hanging for ten
minutes at a time — because **its fail-fast port check treated a
TIMEOUT as "port is free"**, which is exactly backwards. An orphaned
workerd accepts a connection and never answers, so a timeout is the
strongest evidence the port is *held*. One orphan poisoned every later
run. It now kills the whole process group (`npx` → `wrangler` →
`workerd`; killing the pid `spawn` returns leaves the grandchild
holding the port) and refuses a busy port in seconds with the command
to clear it.

---

## AUDIT-ACC, PART TWO — "Take your time"

The first pass was scoped to the six slices in the PR and stopped at
four lenses. Asked whether that was everything, the honest answer was
no: the token had never been read adversarially, the port had never
been read against Fight Life member by member, the credential paths had
never been read for security, and DEPLOY-PROSE had been audited
*around* but never itself. Four more lenses. **Eight more findings,
five of them live defects.**

### F7 — the bank could spell a name the wire could not carry

`NAME_MAX` is 24. The longest name the generator can produce is **25**:
`Kelkemmelian Larethbinder`, and three siblings sharing that surname.
Four of the 173,330 names in the space — about **one guest in 43,000** —
made `createGuest` throw, which `index.js` turns into a **500**. That
player could not get an account at all until they tried again.

The comment at that throw said *"the bank is the game's own, so this
should never fire"*. **Nobody had multiplied the bank out and compared
it to the bound.** This audit did: the space is a product of four
part-lists, so it is 173,330 strings and entirely enumerable.

It survived ACC1b's own testing for a structural reason worth keeping:
**that pin sampled.** It drew eighteen names and checked their shape —
and four in 173,330 is invisible to eighteen draws, essentially always.
The new pin enumerates the whole space; a second drives the exact byte
sequence that produces the bad name and proves an account comes back.

**Raising `NAME_MAX` was not available.** It lives in `src/net/wire.js`,
which is in the relay bundle — SLAM8 hashes that bundle's raw bytes, so
touching it costs a `RELAY_VERSION` bump and drops every connected
player. A four-in-173,330 cosmetic bound is not worth a dungeon run. So
the generator rejects those draws instead, which is the same rejection
sampling `pick` already uses one function above it.

### F8 — the token is a bearer credential and nothing considers replay

Not the code, not the pins, not this page. `verifyToken` closes
**forgery**: without the private key nobody can invent a name. It does
not close **replay** — there is no nonce, no audience, and no binding to
a connection, so anyone who obtains a token can present it as that
player until it expires.

Bounded by `MAX_TTL_S` and by TLS, and the stakes today are a name on a
roster. But *"the only people who can take a name are the people who
can be banned"* is weaker if a name can be **borrowed** for five
minutes, and that is a decision rather than something to discover after
ACC1d ships.

**MAC SETTLED IT (2026-09-21).** Asked whether to close replay or accept
the five-minute window: *"Yes"*. **A token is spent once.** The relay
keeps the signatures it has verified and refuses a repeat; `e` bounds
how long it must remember, so the set sweeps itself. It is cheap
precisely because of how this token is used — a client mints one per
connection from its session secret, so nothing legitimate ever presents
the same token twice. Rejected alternatives: a nonce claim needs shared
state to check and buys nothing this does not, and binding to the socket
is awkward over a WebSocket upgrade. **And the TTL ceiling belongs in
the relay's config beside the public key**, not passed in at a call
site: the relay hands `maxTtlS` to `verifyToken`, so a generous value
typed at whichever call happens to be in front of somebody silently
grants long-lived tokens — the second-home shape SLAM13 burned the relay
on.

**NOTHING ENFORCES IT YET, AND THE RECORD SAYS SO.** The refusal lives
in the relay, which does not import the token module. What exists today
is the decision, written into `src/net/identityToken.js` while that file
is still outside the relay bundle and editing its comments is free — and
a gate in `test/identitytoken.test.js` that holds it against
`RELAY_GRAPH` and **fails the day ACC1d puts the module in the bundle**.

That gate's second arm is a **tripwire on purpose**, and two wrong cuts
got it there. It first asked whether anything in the bundle matched a
seen/replay pattern, and passed the instant the module joined — because
the module's own note says the relay *"keeps the signatures it has seen
and refuses a repeat"*, so the comment describing the work satisfied the
check for the work. That is ACC1-CI's sentinel survivor verbatim, found
the same way: by simulating the event rather than trusting the pin. With
comments stripped and the module excluded from its own population, it
then **refused a real refusal** — `seenTokens` and `isReplay`, because
`\breplay\b` does not match `isReplay`. A pattern guessing identifier
spellings is an enumeration, and an enumeration disagrees with the code
the day somebody names something reasonably. A static grep cannot tell a
relay that refuses a repeat from one that mentions refusing a repeat,
and inventing the relay's API from a test file would be designing ACC1d
before ACC1d is written. So the arm does not try to be satisfiable: it
fails, says what must be true, and names the pin that must replace it —
one that presents the same token twice and proves the second is
refused.

### F9 — a session never expired

`SESSION_IDLE_S` was declared, documented as the bound *"before a sweep
may take it"*, and **used by nothing**. There was no sweep. An abandoned
credential — a shared machine, an old phone, a leaked backup — worked
forever.

Fight Life enforces it on the auth path rather than in a scheduled job,
and **deletes the row** rather than refusing it, so a dead credential
stops existing instead of being rejected forever. That is what is
carried over; it needs no cron that can silently stop running.

### F10 — a failed cosmetic write failed the whole request

The two `last_seen` touches were unguarded, so a D1 hiccup on a
freshness update turned an **already authorised** request into a 500.
Fight Life wraps its own touch and says why. Driven here by a database
that answers reads and refuses every `UPDATE`.

### F11 — an observation, not a change

`players.last_seen` is **written on every authenticated request and read
nowhere**; `devicesOf` reads the sessions' column. A player's last-seen
is the max of their sessions', so the column is derivable. It is still
written, because a column that silently stops being maintained is worse
than one that costs a write, and dropping it is a migration rather than
an audit's business. Noted for ACC2.

### F12 — only strangers were rate-limited

The open routes were bounded per address, on the door. **Everything
behind a session was unbounded** — one valid secret could mint Ed25519
signatures and spend D1 as fast as the network allowed. A limit that
stops strangers and not members is a limit on the wrong axis. Bounded
per **account** now, at Fight Life's own figure, and the refusal is
**429 rather than 401**: telling a rate-limited player their credentials
are wrong sends them to reset a password that was never the problem.

**ACCT-RATE-MEM (2026-10-04, the login outage).** Mac: *"You log in and
it sends you straight to title screen"*, *"We have 300 people trying to
log in at once"*. F12 counted the bound with an `acct:` upsert in D1 on
**every** authenticated request, so every read the game makes - a
town's yards each minute, a home, a token - was also a write to the one
database. D1's own query insights on the day: **4,783,193** runs of that
upsert, the most time of any statement, beside the session and player
reads every request already makes. Two relay deploys (#578, #558) sent
every player back through the door at once; D1 answered *"overloaded.
Requests queued for too long"*, the session read failed under it, the
service said 500, the client went back to the title, and its retries
were more of the same load.

The bound is the same - `ACCOUNT_MAX` a window per account, 429 `rate` -
counted in the isolate's memory (`accounts.js overAccountRate`), so an
authenticated read writes nothing. **Per isolate**: a caller spread over
several isolates meets the ceiling in each, a looser cap by that factor,
which an abuse ceiling can afford and a write on every read could not.
The window only moves forward (AUDIT RENOWN1, as `overRate`); past
`ACCOUNT_RATE_KEYS` accounts the closed windows go, and if every one is
open all of them do - a count forgotten frees a caller early and never
refuses one. The open doors' `login:` and `ip:` keys stay in D1: they
are few, and must hold across isolates. Pinned by
`test/acctratemem.test.js`.

### F13 — the session secret rode in a URL

`/v1/account` read `?secret=`. The code excused it: *"it is read-only,
and a slice that makes it do more must move it."* **That answers the
wrong risk.** The hazard was never that the route mutates — it is that
a URL is written into Cloudflare's request logs, into any `Referer` the
page emits, and into browser history. Read-only or not, the credential
was in all three.

It is an `Authorization: Bearer` header now. The query-string door is
pinned **shut** rather than merely unused, the header wins when both
are present so two sources cannot disagree, and the CORS preflight is
checked to allow it — a header no browser is told it may send is a
header no browser sends.

### F14 — a claim in the pull request, not in the tree

DEPLOY-PROSE's description said the relay's deploy had been automatic
*"for fifteen weeks"*. `relay-deploy.yml` was added **2026-09-16**;
this is 2026-09-21. **Five days.** The tree itself never carried the
claim — it lived only in the PR body, which is to say in the one place
this project does not gate. Corrected there.

**And DEPLOY-PROSE is otherwise sound**, which is the other half of
auditing it: the two corrected files say true things, the gate holds its
derivation, and the `wire.js` exclusion's premise still stands — that
file still carries its stale sentence, so the gate still has something
to be honest about.

---

## AUDIT-ACC, PART THREE — "Before we merge. This is it?"

Asked a third time, with the merge in front of us. The honest answer
was again no, and the gap was specific: **the workflow that runs at
merge time has never run**, and several of its `jq` expressions were
guesses about wrangler's output. Those are checkable against wrangler's
own bundle rather than on main, and checking them found the worst
finding of the whole audit.

### F15 — the first run could not have succeeded

`wrangler secret list` asks Cloudflare for a Worker's secrets. On a
Worker that does not exist yet it does not answer empty — **it fails**:

```
Worker "daggerfall-accounts" not found.
If this is a new Worker, run `wrangler deploy` first to create it.
```

On the very first deploy that is the *expected* state. The minting step
ran **before** the deploy, so it would have aborted the job at that
listing and **nothing would ever have been deployed**. The first run of
this workflow was guaranteed to fail.

**And F1 is what made it fatal.** Before F1 the step swallowed the
failure with `|| echo '[]'` and blundered on into minting. F1 correctly
made an unreadable listing stop the job — and in doing so turned a
first-run certainty into a hard stop. **Both halves were right on their
own. The order was wrong**, which is why the pin now holds an *order*
rather than a line: migrations before deploy, deploy before mint, mint
before the pubkey check.

Deploying before the key is safe **because the service is built for
it** — a Worker with no signing key still hands out accounts and
answers `no-signing-key` rather than minting something the relay would
refuse. That arm has been pinned since ACC1b and this is the moment it
was for; the order pin names it, so deleting it is not a quiet change
to this order's safety.

### F16 — half the host was derived and half was typed

The verify steps built their URL from the worker **name** (read from
the config) plus a hardcoded account **subdomain** (typed beside it).
That is a second home for a fact, and it is the exact shape SLAM13
burned the relay on: a check pointed at a stale fact keeps passing, or
keeps failing, for reasons that have nothing to do with what it is
checking.

The deploy now publishes the URL wrangler says it landed on, and the
checks reach for that. The pin asserts **no `workers.dev` host appears
in any non-comment line** — which as a side effect makes the whole
workflow portable to any Cloudflare account.

### What was verified rather than assumed

Read out of wrangler's own bundle, because the alternative was finding
out on main:

| assumption | verdict |
|---|---|
| `d1 list --json` prints raw API records, no banner | **true** — `printBanner: (args) => !args.json` |
| the D1 id field is `uuid` | **true** — the raw `/d1/database` records |
| `secret list --format json` prints `[{name,type}]`, no banner | **true** — banner only for `pretty` |
| `secret list` on a missing Worker returns empty | **FALSE — it throws.** F15 |
| `secret put` reads a piped value | **true** — `process.stdin.isTTY ? prompt : readFromStdin()` |
| the host the checks reach | **was typed.** F16 |

---

## OPEN

- **Whether the hub moves out of the relay Worker.** It is in the
  bundle today, so a social change already drops every connected
  player. This arc does not create that and does not fix it.
- **Rename cost.** Fight Life gives one free rename and counts the rest.
  Whether a name is ever released back into the pool when an account
  goes quiet is undecided, and the answer decides whether `handle_lc`
  needs a tombstone.
- **What a guest's generated name looks like**, and whether it persists
  on the row across sessions. It should — "who was that?" is
  unanswerable otherwise, even inside one session.
- **Where the token is minted for the desktop app**, which has no
  browser origin to lean on.

## THE CREDENTIAL, and Mac's decision on it

The Cloudflare API token for this account was pasted into a chat and has
been live since. It was raised before this arc opened and raised again
when the arc did.

Mac, 2026-09-21: **"Im not rotating. Lets do this"**.

Recorded, and not re-argued. What it means in practice, so that a later
reader is not surprised by it: the same credential that can reach the
relay will be able to reach the account D1 and the save R2, and the
blast radius of this arc is therefore the whole of it rather than the
relay alone. The mitigations that do not need the token rotated are
still worth taking and are the ordinary ones — the token stays in the
repo's secrets and never in a file or on a command line (pinned by
`test/relaydeploy.test.js`), and the save blobs are a BACKUP, so the
worst case takes a copy rather than the original.

---

## ACC1a — SHIPPED 2026-09-21: the token

`src/net/identityToken.js` and `test/identitytoken.test.js`. The pure
law only: no Worker, no D1, nothing wired. Nothing imports it yet, so
the relay's bundle is unchanged and no deploy was forced.

**Ed25519, and no algorithm field.** A JWT names its own algorithm in a
header the verifier reads, which is the root of the whole `alg: none`
family — the attacker chooses how their signature is checked. The format
here is `v1.<payload>.<signature>` and **the version prefix IS the
algorithm**: the verifier knows exactly one version and refuses anything
else before parsing a byte. A pin holds the absence of `alg`, `typ`,
`kid`, `crv` and `jwk` from the payload, and holds at the source that
only one algorithm is named in the file at all.

**Every arm is a refusal, never a repair.** A token is the only evidence
there is, so a token that is not exactly right is not evidence. The
sharpest case is the name: `wire.js`'s `sanitizeName` falls back to a
safe string, which is right for a chat frame and wrong here — a fallback
would silently rename a player to something the account service never
issued. So the wire's law is asked as a QUESTION (`nameIsIssuable` is
"is this a fixed point of `sanitizeName`?"), and a signed token carrying
a name that is not is refused. **A key of ours signing a claim set we
would not have minted is a bug, and a bug is not an authorisation.**

**The lifetime is bounded by the VERIFIER**, not merely by the minter.
`exp` says when this token dies; `MAX_TTL_S` says no token may ever have
been issued for longer, which is what a token stolen off a client is
worth. A future slice that quietly raises the minter's own constant is
refused at the far end. Five minutes, because a token is spent ONCE on a
hello and the socket is the session from then on — it covers the walk
from "press Online" to "socket open" and does not need to cover a play
session.

**The relay holds a public key and a public key cannot mint**, which is
the whole reason the relay is allowed to be the bigger attack surface.
Driven rather than asserted: the pin imports the key the relay would
carry and proves `subtle.sign` rejects with it.

**The account id is SOC1's own shape**, and a pin reads
`net/social.js` to prove the two have not drifted — ACC0's adoption
depends on an id minted by the social arc being an id this token can
carry, so the day they part, this reddens.

16 mutants, 14 dead, 2 recorded equivalent. One survivor was a real
hole and is worth the sentence: removing the `try` around `JSON.parse`
survived the first pass, because the signature is checked FIRST and
every malformed body in the junk fixture died at `signature` without
ever reaching the parser. The only way there is a body that is
**correctly signed and is not JSON** — which means our own minter
shipped garbage — and the verifier must still refuse rather than throw,
because a throw out of a hello is ONCRASH1's lesson: it does not end
that socket, it ends the reader.


---

## ACC1e — the account creation screen (2026-09-21)

Mac: *"Should we go ahead and build the account creation screen"* — and,
told it was the right thing to do before ACC1d: *"Yes, please be
detailed and match the enhanced aesthetic."*

**IT WENT FIRST BECAUSE IT IS FREE.** The card talks to the account
service over HTTPS and touches nothing in the relay bundle, so no
`RELAY_VERSION` bump and nobody is dropped. ACC1d costs every connected
player their session, and spending that once — after the screen exists —
means one deploy delivers something a player can see.

**IT GATES NOTHING.** It sits at the head of the Online pane, above
ONLINE1's card, and every button below it works with no account at all.
ACC0's wall is at cloud saves and nowhere else.

### The split: the flow thinks, the card draws

`ui/accountFlow.js` holds every stage, every field, every refusal and
every rule about what may be pressed. `ui/enhancedAccount.js` walks what
the flow says and makes DOM. That is `ChargenFlow` / `enhancedChargen.js`
again, and `test/enhancedChargen.test.js` says why: *"node cannot draw
them; what IS testable is the part that does arithmetic."* Everything a
player can get **wrong** about an account is arithmetic.

`net/accountClient.js` is the third piece — one home for where the
service is, what its routes are, and **what its refusals mean**. The
translation table is keyed by exactly the words `server-account/src/`
emits, and a pin walks that source: a word the service can answer with
and this side has no sentence for reddens. That is how `not-found` and
`no-database` were found missing.

### What the card is careful about

- **One press is one account.** Registering is two calls — open a guest
  row, then upgrade it in place — and a press between them opens a
  second guest row with no handle, no password and nothing that will
  ever adopt it. The pin holds the first call open and presses again.
- **A failed upgrade keeps the session.** `handle-taken` leaves a real
  row this device owns; dropping the secret would strand it and make the
  next press open another.
- **A dead credential signs the device out; a blip does not.** `auth`
  means the service has stopped honouring the secret. `offline` says
  nothing about it, and a player signed out by a bad second is a bug.
- **The recovery code is a stage, not a line in a corner.** Email is
  completely optional, so there is no reset link and this code *is* the
  reset. It is never written to storage, the only way off that stage is
  an explicit *"I have written it down"*, and a second way off would be
  a way to lose an account by taking it.
- **A password is sent exactly as typed.** The handle is trimmed; a
  password is not. Trimming here while the service hashes what it was
  sent is a login that works from this client and fails from every other.

### ACC1e F1 — a rule in the skin read a token nothing declares

`.card label.field .fieldlabel` said `color: var(--ash)`, and **nothing
in the tree has ever declared `--ash`** — one use, no declaration. The
property was invalid at computed-value time, so every field label in the
enhanced skin inherited `--bone` instead of a quiet label colour:
ONLINE1's two fields, the save slot's name, and this arc's, since the day
the rule was written.

No source sweep sees that — the rule is present and spelled correctly.
`tools/accountCardProbe.mjs` stands the card up in a real Chromium and
reads the **computed** colour, which comes back as `--bone` exactly. Put
the bug back and the probe fails naming the colour. `--dim` is what it
wanted and what `.card .meta` one line up already uses.

### The probe was photographing the fallbacks

Mac, seeing the first sheet: *"Does this use the enhanced font"*.

It does — a heading takes `var(--display)` and everything else
`var(--data)`, inherited from the skin rather than declared locally, and
that was true from the first commit. **But the sheet was not showing
them.** The probe injected `ENHANCED_CSS` and never loaded a single font
file, so Georgia stood in for Cormorant and system-ui for Barlow Semi
Condensed, and the result was photographed and offered as the design.

Declaring a family and rendering in it are different claims, and no
source sweep can tell them apart — the CSS is correct either way. The
probe now fetches the faces in node from the skin's own
`ENHANCED_FONTS_URL` and inlines them as data URIs, so the page still
makes no network call, and three checks ask the question directly:
`document.fonts.check` for whether the file actually arrived, and the
computed family on a heading and on body copy.

The same class of error as ACC1e F1, one level up: F1 was a rule that
looked right and never applied, this was a *measurement* that looked
right and measured the wrong thing.

### And the shapes moved, because the direction of every import matters

`GUEST_NAME_RE` and `HANDLE_RE` were born in
`server-account/src/guestName.js`. The client now has a field to type a
handle into and has to ask the same question — but every import in this
repo runs one way, `server/` and `server-account/` taking from `src/` and
never the reverse. A client file reaching into `server-account/` would
have been the only edge going backwards, and an architecture with one
exception in it is an architecture nobody can state.

**Both halves moved together**, to `src/net/handleShape.js`, because
ACC1b's own comment says why: *"both halves of it are exported from here
so neither can drift from the other."* Taking `HANDLE_RE` alone would
have broken the property that sentence exists to hold. `guestName.js`
imports and re-exports them, so every existing reader is unchanged.

`test/mutantdrift.test.js` caught the move and demanded the two `acc1b`
mutants be re-aimed by content, which they were.

### What is pinned

`accountflow.test.js` 21, `enhancedaccount.test.js` 12, and
`npm run acctcard` — 9 checks in a real browser at every stage, desktop
and phone. Mutants: `tools/mutants/acc1e.json`, 12, **12 dead and 0
survived**.

One survived the first run and it was a real hole: the "a password is
not trimmed" law was stated in a comment above `pw()` and asked by
nothing, so a mutant that trimmed passwords walked straight through a
green suite. It has its own pin now.

### Still open after this

The card creates an account that changes nothing a player can see until
**ACC1d** reads the name off the token (the relay), or **ACC2** brings
the saves. That is stated plainly in the card's own copy rather than
oversold. And the client now holds two identities — SOC1's hub-minted
`dagger.online.account` and this service's session — which ACC1b already
settled: the merge belongs at the hub, the only thing holding both
credentials at once.


---

## ACC1f — the account moves to the front door (2026-09-22)

Mac: *"In my mind for the online mode panel. I want it reserved for a
detailed tile based design for your saves which will translate to the
load character pane also... The online details itself will live as a
popup on main menu startup and a new profile icon."*

So ACC1e's card leaves the Online pane, which is being reserved for the
character tiles, and becomes two things on the pixel door:

- **A window over the home screen**, offered once per visit to a device
  with nobody signed in. Mac: only when not signed in.
- **A profile mark, top-right** — the corner the foot's About box does
  not use. It reopens the window any time.

**IT IS AN OFFER, NOT A GATE.** ACC0's wall is at cloud saves; every
door on the screen works without an account. It closes on Escape, on
the Close button, and on a tap outside, exactly as the pause window
does.

**ONCE PER VISIT, NOT ONCE PER RENDER.** `renderHome` runs again on
every skin switch, every Escape and every repaint. A window that
reopened each time would be one a player cannot get past, so
`accountOffered` latches on the first offer while the mark can reopen
it freely.

### Three things the screenshot found that no test would have

The card looked right standing alone. In its real host it did not:

1. **No scrim.** The door's own menu — CONTINUE, NEW GAME, ONLINE —
   read straight through the window. A modal you can read the page
   through is not one anybody believes.
2. **The heading was Cormorant in a pixel window.** `.shell .card h3`
   forces the pixel face, and the door is `.px-home`, not `.shell`, so
   the rule never reached it. The card's heading was the one thing on
   the door not drawn in whole pixels. Same for `.shell .act`, which
   left the card's buttons lowercase beside a spaced, uppercase CLOSE.
   Both rules are widened to the door's window rather than copied.
3. The window had no floor of its own.

All three are host-integration faults, invisible to a card rendered on
its own page — which is what ACC1e's probe does, and the reason the
question *"are the screenshots of each popup"* was worth asking.

### And a pin that had become false

`test/outsideTap.test.js` asserted `closeOnOutsideTap` appears in the
menu exactly **once**, with the reason *"the pause face only - the
front door has no scrim"*. True until this slice; the door has a scrim
now, exactly when the account window is open. The pin names **both**
wirings rather than counting loosely, so a third scrim added without
its own outside-tap still reddens — and it checks the account one is
guarded by `accountOpen`, because a front door wired unconditionally
would close on every tap.


---

## ACC1d — the design, before the code (2026-09-22)

Mac: *"Go in order. Take your time."* So: ACC1d, then ACC2, then the
tile picker. This section is the record ACC0 set the precedent for —
what is decided and **why**, written before anything is built, because
this is the slice that costs every connected player their session.

### The seam, as it is today

```
client   net/online.js  _helloFrame()  { t:'hello', id, secret, name, look, pose }
wire     net/wire.js    parseClient()  name = sanitizeName(m.name)
relay    server/src/index.js           m.name -> the attachment, join, chat, roster, the hub's account record
```

**The client asserts its own name and nothing checks it.** That is the
hole ACC1a opened this arc to close.

### What ACC1d adds

The hello carries `tok`. `wire.js` validates its **shape** only — it is
sync and pure and must stay that way. The relay **verifies** it
(`verifyToken`, async, needs the public key) and, on success, takes the
name **out of the token** instead of off the frame.

### D1 — is the token REQUIRED? No, and that is deliberate

Three ways to go, and the two rejected ones are recorded because the
reasoning is the load-bearing part:

- **Required.** Every client without one is refused. It closes the hole
  completely and it makes the relay unusable whenever the account
  service is down — a second Worker's outage taking the game offline is
  exactly the coupling the two-Worker split (ACC0) exists to avoid. It
  also breaks every client that has not reloaded, and a relay deploy
  drops everyone at once, so that window is real.
- **Optional, name from the token when present.** Costs nothing and
  buys nothing: a forger omits the token and asserts whatever they
  like.
- **Optional, and the relay says which names it VOUCHES FOR.** Taken.

A verified hello carries its name from the token and the join and
roster frames mark it. An unverified one is admitted exactly as it is
today. Impersonation stops being invisible: a name nobody signed is a
name the client can show as unsigned.

**AND THE HONEST LIMIT, stated here rather than discovered later:** a
token makes a name TRUSTWORTHY, it does not yet make one MANDATORY.
Until the requirement flips, a client can still assert any name it
likes — it simply cannot get the relay to vouch for it. ACC0's wall
("the only people who can take a name are the people who can be
banned") is not fully standing until that flip, and the flip is its own
slice with its own deploy.

### D2 — where the public key lives: the relay's config

`server/wrangler.toml`, as a var rather than a secret — a public key can
verify and cannot mint, so there is nothing to hide. Fetching
`/v1/pubkey` at runtime instead would put the account service in the
relay's startup path, which is the coupling D1 just refused.

It is a second copy of a fact the service publishes, so the **deploy
checks them against each other**: `account-deploy.yml` already reads
`/v1/pubkey`, and a mismatch means every verify fails silently, which is
the worst possible failure mode and the easiest to catch at deploy.

### D3 — the TTL ceiling lives beside the key

F8's second half. `verifyToken` takes `maxTtlS` from the caller, so a
generous value typed at whichever call site happens to be in front of
somebody silently grants long-lived tokens. It is config, next to the
key, with `MAX_TTL_S` as the hard ceiling the module itself refuses
past.

### D4 — one-shot, and exactly what that does and does not close

F8, settled by Mac: **a token is spent once.** The relay keeps the
signatures it has verified and refuses a repeat; `e` bounds how long it
must remember, so the set sweeps itself.

**IT IS PER-ROOM, because the relay has no global state that a hello
could touch without becoming a bottleneck** — ACC0 refused exactly that
for provider links, and a hello is far hotter than a sign-in. So:

- A token captured and replayed **into the same room** is refused. That
  is where the victim is and where impersonation is worth doing.
- A token replayed into a **different room**, or after that room's
  object has been evicted, is not caught.

Closing the second case needs shared state on the hello path. It is not
worth that, and saying so here is better than a comment claiming the
replay window is shut.

### What this costs

`wire.js` gains a field and `server/src/index.js` gains an import, so
`RELAY_GRAPH` grows and SLAM8's hash changes. **`RELAY_VERSION` bumps
and the deploy drops every connected player.** That is the price this
arc has been saving up for since ACC0 chose two Workers, and it buys
the whole token seam in one drop rather than several.

`test/identitytoken.test.js`'s F8 gate fires the moment the module joins
the bundle and must be replaced by a pin that presents the same token
twice and proves the second is refused. That is the point of it.

### D5 — the mark is CARRIED and it is not DRAWN, and that is on purpose

D1 says impersonation "stops being invisible", and that sentence was
one step ahead of the code when it was written. The relay decides `v`;
the question nobody had answered is what a player SEES.

The answer this slice gives is: the fact travels all the way to the
client, and nothing new is drawn. `v` rides the join, the welcome's
roster, the `who` answer and every chat line; `net/online.js` keeps it
on the peer as a hard boolean, and `net/chat.js` keeps it on the line
the panel draws from. What is missing is exactly one thing — a mark
beside a name — and that is a DESIGN, on a surface Mac reviews.

Two reasons for the split, and the second is the load-bearing one:

- Mac has not seen a mark. This session already shipped a sign-in
  window he sent back twice ("What the hell is this design", "Nothing
  is centered"); inventing a badge at three in the morning and calling
  the arc finished is how that happens a third time.
- **A relay deploy drops every connected player, and a client build
  does not.** If the flag stopped at the relay, the day the mark is
  drawn would cost another drop. Carrying it now makes the UI slice a
  client build and nothing else.

So the honest state, stated here rather than discovered later: after
ACC1d the relay knows which names it vouches for, the client knows,
and the player does not. That last step is a UI slice.

### AND ONE THING THE FIRST CUT GOT WRONG, worth recording

`rosterFor` did not carry `v`. The join frame did, so every peer who
arrived AFTER you would have been marked and every peer already
standing in the room would not — a signal that is true half the time,
which is worse than no signal, and one that could only have been fixed
by a second relay deploy. It was found by asking what the WELCOME
carries rather than by reading the code that was just written, and it
is why the pins walk both doors.

### SHIPPED 2026-09-22

- `src/net/wire.js` — the hello's `tok`, shape only; `rosterFor` carries
  `v`. `RELAY_VERSION` world84 → **world85**.
- `server/src/index.js` — `_named` verifies, spends the signature once
  (`SPENT_MAX`, swept by `e`), and takes the name out of the token; the
  attachment, the join, the roster, the `who` answer, the chat line and
  the hub's record all carry the decided name and `v`.
- `server/wrangler.toml` — `IDENTITY_PUBLIC_KEY` and
  `IDENTITY_MAX_TTL_S`, as vars (D2, D3).
- Both deploy workflows — the relay's copy of the public key is checked
  against what the account service publishes, on the deploy that can
  mint a new pair AND before the relay's own wrangler run. An
  unreachable service warns; a real disagreement stops the deploy.
- `src/net/accountClient.js` — `mintIdentity` and `accountTokenMinter`:
  one fresh token per connection, `null` for every reason a player may
  have none, never a throw.
- `src/net/online.js` — `mintToken`, `TOKEN_WAIT_MS`, an async open that
  is bounded and swallowed and re-checks its socket; `v` kept on the
  peer and on the chat line.
- `src/scenes/world.js` — ONE minter, handed to the presence session and
  to every channel link.
- Pins: `test/acc1dclient.test.js` (15), four new arms in
  `test/identitytoken.test.js`, one each in `test/relaydeploy.test.js`
  and `test/accountdeploy.test.js`. Mutants:
  `tools/mutants/acc1d.json`, 22, **22 dead and 0 survived**.

**NOT DEPLOYED.** The relay deploy fires on merge to main and drops
every connected player when it does.

---

## ACC2 — the design, before the code (2026-09-22)

Mac: *"Go in order. Take your time."* ACC1d is done; this is step 4 of
*THE ORDER TO BUILD IT* — **the card and the blob, backup only**.

The page above already decided the shape (*THE SAVES: R2 for the blob,
D1 for the card*) and the limit (*THE CLOUD IS A BACKUP AND A TRANSFER.
THE LOCAL SAVE STAYS AUTHORITATIVE*). What follows is what that shape
runs into once it meets `systems/saveSlots.js` as it actually exists,
and the decisions nobody had made yet.

### D1 — cloud saves are for LINKED accounts, and a guest is refused

ACC0's table says it and nothing has enforced it, because until now
there was nothing to enforce it on. The service checks it, not the
client, and the reason is sharper than "the table says so":

**A guest account is one storage clear away from gone.** That is stated
plainly in ACC0 as the residue of the wall. A backup filed under a
credential the player can lose by clearing their browser is a backup
that cannot be restored — which is the one promise a backup may not
break. Offering it would be worse than refusing it.

It is also, as ACC0 argued, the second reason to link, and the one a
player actually wants: a name, and their saves on the next device.

The refusal word is `not-registered`, which `accountClient.js` already
translates ("This account has no password yet.").

### D2 — a cloud slot is keyed by (character, SAVE NAME), never by the local index

This is the decision the existing code forces, and it would have been
easy to get wrong.

`systems/saveSlots.js` keys a slot in storage by an INTEGER — SAV4's
`CreateNewSavePath`, *"a new pair takes the FIRST FREE integer key"*.
That integer is a fact about ONE store. Two devices that saved in a
different order hold the same character's "QuickSave" under different
numbers, and a cloud keyed by the number would file them as two saves
and then overwrite the wrong one.

The slot's IDENTITY is already written down and is not the integer:
SAV4 takes it from DFU's `FindSaveFolderByNames` and CHARID1 corrected
its first half — **a save is (characterId, saveName)**. So that is the
key here too:

    PRIMARY KEY (player_id, character_id, save_name)

and the R2 objects hang off the same triple. The local integer never
leaves the device that minted it, which is exactly what CHARID1 shipped
for.

### D3 — R2 keys are player-first, so a deleted account is one sweep

    saves/{playerId}/{characterId}/{saveName}/data
    saves/{playerId}/{characterId}/{saveName}/shot

Player first is not cosmetic: R2 lists by prefix, so "delete everything
this account holds" is a prefix walk rather than a join against D1. A
save name is a player-typed string, so it is encoded into the key
rather than pasted into it, and the service bounds its length.

### D4 — the bounds, and the one that would have been missed

`MAX_BODY_BYTES` in `service.js` is **4 KiB**, and `readBody` enforces
it before parsing. Every route this service has today is a small JSON
body, so that bound is right for all of them and WRONG for a save,
which is hundreds of kilobytes. A save route that went through
`readBody` would refuse every real save; one that quietly bypassed the
cap would have no cap at all. So the blob routes read a RAW body with
their own, named bound:

| | |
|---|---|
| `SAVE_MAX_BYTES` | 4 MiB — a Daggerfall envelope is a few hundred KB; this is headroom for a long game and a hard stop for anything else |
| `SHOT_MAX_BYTES` | 256 KiB — a 320x200 JPEG is ~20 KB |
| `SAVES_MAX` | 60 slots per account |
| `SAVE_NAME_MAX` | 64 characters |

An account at `SAVES_MAX` is refused with `too-many-saves` rather than
having its oldest slot silently taken: this is a BACKUP, and a backup
that deletes things to make room is not one.

### D5 — a download does not get a new merge rule; it reuses SP1's

The obvious thing to write is a sync: compare timestamps, take the
newer. That is the design ACC0 refused — *"a design where the cloud is
the truth is one where a sync bug is catastrophic"* — and it would also
be a SECOND answer to a question this repo has already answered.

`systems/saveTransfer.js` (SP1) defines what happens when a slot
arrives from elsewhere, and it was written because a player thought
they had lost their saves:

> a slot never overwrites another: it takes its own number when that
> number is free, the first free one when it is not, and a slot the
> store already holds (same character, same slot name, same game
> minute) is skipped rather than doubled.

A cloud download is a slot arriving from elsewhere. It goes through
that law, unchanged. **The cloud is a third destination for a carrier
that already works** — the page said so before any of this was built,
and the carrier is where the merge rule stays.

#### D5b — a NEWER backup is named, and restoring it is the player's press (FIELD 2026-09-27)

Masta_Fu backed up his PC's QuickSave, restored it on a fresh Mac, played on and backed up again. Back on the PC
nothing could bring the newer game down: the backup matched the PC's older slot by its identity, so it was never a
cloud-only tile with a Download, and the slot's line read **"Backed up"** with one upload button - which pushed the
PC's OLDER save over the Mac's newer one.

- **The fact is named, not acted on.** `ui/saveTile.js` `newerBackup`: the backup is a DIFFERENT save of the slot
  (another game minute - SP1's own identity) saved LATER (`realTime`). The line reads *"Newer backup · 12 minutes
  ago"* (`newer`). Nothing syncs: the refusal above stands.
- **Restore is the player's, on the Load pane, and it asks twice** (*"Restore backup"* → *"Replace with backup?"*).
  `pullSlot(…, { replaces })` brings the backup in by SP1's law unchanged - its own number, never over a slot - and
  only THEN removes the local copy it replaces, through the store's own delete, and only when that copy is the same
  slot at another game minute. A failed download removes nothing; the backup's own save is never the one removed.
  One QuickSave is left, so the quickload and the next save find the restored game.
- **Back up again asks twice there too** (*"Replace newer backup?"*): it is the one press that loses the newer game.

- **The pre-merge audit hardened it** (`01-Overview/Audit-PreMerge-0927b.md`): a failed restore's *Try again* is the
  restore again, never a push (the first cut left one press that put the older save over the newer backup); the
  arriving blob's own minute must be the card's, or the restore refuses `stale` and asks the listing again; the slot
  as DRAWN rides the restore, so a copy saved since is kept; a skipped arrival removes the older copy only when this
  character's own copy of the backup's save is here; the two-press arming is the LOCAL copy's and never outlives its
  pane; and `newer` is later by either clock - the devices' or the game's.

Pins: `test/cloudsaves.test.js` (his round trip through the real service, what a restore never removes, the menu's
wiring) and `test/savetile.test.js`; mutants `tools/mutants/backupnewer.json` (32).

### D6 — NOT automatic, and this is a narrowing of ACC0's step 4 with a reason

Step 4 says *"Upload on save"*. This slice does not do that, and the
departure is recorded rather than quietly taken:

- An upload inside the save path puts a NETWORK CALL in the one
  operation this game must never fail. `systems/save.js` handles
  `QuotaExceededError` by name today; it has no arm for "the account
  service was slow" and should not grow one.
- A backup that happens invisibly is a backup whose failure is also
  invisible. The whole point of ACC0's limit is that a failure here is
  *"a message rather than a lost game"* — and a message needs somewhere
  to appear.

So ACC2 builds the transport and the explicit push and pull. **The
trigger rides with the tile picker**, which is the next thing Mac asked
for and is the surface where a player can see a save go up and see it
fail. That keeps ACC0's promise rather than dropping it.

### D7 — the bucket is created by the deploy, like the database was

ACC1-CI's whole argument (Mac: *"The token provided allows you to take
this on yourself. I am not needed at all"*) applies unchanged: the same
API token that creates a D1 database creates an R2 bucket. So
`account-deploy.yml` creates it if absent, idempotently, before the
deploy — and the binding is in `wrangler.toml` where the D1 binding
already is. Nobody opens a dashboard.

### What this costs

**Nothing in the relay bundle, so NOBODY IS DROPPED.** `RELAY_GRAPH` is
unchanged by every line of ACC2 — which is the two-Worker split earning
its keep for the second time this week, and is why this slice can land
the day after one that dropped the whole room.

### ACC2a — SHIPPED 2026-09-22: the service half

- `server-account/migrations/0003_saves.sql` — the card, keyed
  `(player_id, character_id, save_name)`, with `bytes`/`shot_bytes`
  saying what R2 actually holds.
- `server-account/src/saves.js` — list, put the card, put a blob, get a
  blob, delete. Every statement binds the player the caller proved.
- `server-account/src/service.js` — `savePathOf`, `saveKey`,
  `savePrefix`, and the four bounds. `ACCOUNT_VERSION` acct1 → **acct2**.
- `server-account/src/index.js` — the seven routes and the wall.
- `server-account/wrangler.toml` — the `SAVES` R2 binding.
- `.github/workflows/account-deploy.yml` — creates the bucket if absent,
  before the deploy.
- `src/net/accountClient.js` — a sentence for each of the six new
  refusal words.

**Two pins fired on their own subject the moment this landed, and both
were right to.** `accountflow.test.js`'s refusal walk read three named
files and so missed every word `saves.js` returns — it walks the
service's whole `src/` directory now, because a three-file list is an
enumeration and an enumeration disagrees with the tree the day somebody
adds a file. And `accountworker.test.js`'s schema pin listed the tables;
`saves` arriving as its OWN table rather than as columns on `players` is
exactly what 0001's header promised would happen, so the list moved and
the promise is quoted beside it.

Mutants: `tools/mutants/acc2.json`, 14 at this slice, **14 dead and 0
survived** — ACC2b took the same file to 22, which is what it holds now.

**NOT DEPLOYED**, and when it is, it drops nobody: `RELAY_GRAPH` is
untouched by every line of it.

### ACC2b — SHIPPED 2026-09-22: the client half

`src/systems/cloudSaves.js`, pure over `{fetch, storage}` the way
`net/accountClient.js` is: push a slot, pull one, list, delete. No UI —
**the tile picker draws it**, which is the next thing Mac asked for and
the surface where a player can watch a backup succeed or fail (D6).

Three things it deliberately does NOT do, each because the answer
already exists somewhere:

- **It does not merge.** A download is a slot arriving from elsewhere,
  so it goes through SP1's `importSlots` unchanged. There is no
  timestamp comparison here and no conflict rule, because writing one
  would be a second answer to a question this repo answered when a
  player said "my saves its all gone".
- **It does not restate the size bound.** The service owns it and
  answers `too-large`; a copy of the number on this side is a second
  home for a fact, and the sentence a player needs is the same either
  way.
- **It does not own the service's words.** `CLOUD_REFUSALS` holds only
  the refusals this side can make, and a pin asserts the two tables are
  disjoint — one word, one sentence.

**The mutation campaign found a weak pin, which is what it is for.**
The encoding pin tested a save called `before the lich`, and a space
survives an unencoded path by accident because the URL constructor
escapes it — so the mutant that deleted every `encodeURIComponent`
walked through. It tests `a/b`, `danger#1`, `x?y` and `100%` now. The
hash is the sharp one: it truncates the path at the fragment, so
`danger#1` would have been filed and fetched as `danger`, and a player
would have restored the wrong game.

Mutants: `tools/mutants/acc2.json`, 22, **22 dead and 0 survived**.

### ACC2c — SHIPPED 2026-09-22: the surface, on the tiles

D6's trigger, where it belongs. The save tile (TILE1, recorded in
`bible/10-UI/UI-Arc.md`) carries ONE cloud line and at most one button:
*Not backed up* with **Back up**, *Backed up · 2 hours ago* with **Back
up again**, *Backing up…*, or the service's own refusal in ruby with
**Try again**.

**And nothing at all where there is no registered account.** ACC0's wall
is at cloud saves, and a player who has not asked for one is not told
about it on every tile they own — `off` is the state most players are
in, and it draws no line.

The listing is asked ONCE per visit to the menu and latches, because a
pane repaints on every press, every skin switch and every Escape; a push
clears the latch rather than patching the list, so what the tiles say
the cloud holds always came from the cloud.

**What is still not done, and is deliberately not:** nothing uploads by
itself, and a save that exists ONLY in the cloud is not drawn yet — the
tiles list what is on this device. Pulling a save down onto a second
device is `pullSlot`, it is pinned end to end against the real service,
and what it needs is a surface: a tile for a cloud-only save, with
**Download** where **Load** sits. That is the next slice, and it is
small.

(The DELETE was on that list too, silently — AUDIT-312 F1 found it and
paid it. See below.)

---

## AUDIT-312 — 2026-09-22, Mac: "Let's audit this"

The four slices on PR #312 that AUDIT-ACC had not seen, because they did
not exist when it ran: **ACC1d**, **ACC2a**, **ACC2b** and **TILE1/TILE2**
(the tile half is recorded in `bible/10-UI/UI-Arc.md`; the findings are
numbered once, here).

Five lenses, the arc's usual: does it RUN, is the service safe read
adversarially, what did it break, do the pins derive, and does the record
say true things. **Twelve adversarial mutants were written against laws
these slices claim**, and four survived. Everything below was driven, not
read.

### What held

- **The relay's token seam.** Four mutants at the sharp parts — a relay
  that vouches for names it cannot verify, a config var that loosens the
  module's hard TTL ceiling, a spend-set that sweeps itself empty before
  it is asked, and a client that puts `tok: null` in the hello (which
  `wire.js` refuses, so it would cost every signed-out player the room).
  All four died.
- **The save service's isolation.** A `DELETE` that reaches past its own
  account, a slot bound never counted, a thumbnail bounded by the save's
  4 MiB limit — all dead, and the announced-content-length check turned
  out to be pinned too (it was written off as un-pinnable and is not).
- **The recorded campaigns re-run honestly**: `acc1d.json` 22,
  `acc2.json` 22, `tile.json` 11 — **54 dead, 1 recorded equivalent, 0
  survived**, which is what the PR claims.
- **The Worker still boots** in workerd with ACC2's new R2 binding, and
  the migration ledger applies `0003_saves.sql` in order.

### F1 — THE DELETE HAD NO DOOR, and the refusal table already named it

`DELETE /v1/saves/{char}/{name}` existed. `removeCloudSlot` existed.
**Nothing called either**, and nothing in the record said so — ACC2c's
"what is still not done" listed the download and not this.

It is not a missing nicety. `SAVES_MAX` is 60, at the bound a new slot is
refused, and the sentence the player is handed is *"Your cloud backup is
full. Delete a save there to make room."* — an instruction to do
something **the game gave them no way to do**. An account that filled up
could never back up again.

Paid: the tile's cloud line carries **Delete backup** on a backed-up
slot. It says *backup* because the tile already has a **Delete**, the
pane's own, which removes the save from this device — two buttons reading
`Delete` one row apart, one destroying the game and one destroying the
copy, is the worst label this menu could carry. It **asks twice** (the
armed slot is cleared by the press, by arming another tile, and by the
next visit to the menu), and `removeCloudSlot` never touches the local
store, because the cloud is the copy.

### F2 — `no-character` was a sentence no surface could show

A card written before CHARID1 has no character id. `cloudFor` returned
`off` for it, which draws **no cloud line at all** — so a legacy save sat
in the list with no backup button and no reason, beside tiles that had
one, and the sentence ACC2b wrote for exactly this case could never
appear.

Paid: a sixth cloud state, `wait`, with the sentence and **no button** —
the act it needs is loading the save, which is the tile's own Load. The
table's sentence was **shortened** to suit the surface it now has
("Load this save once, then it can be backed up."), because Mac's rule
for a tile is facts and no prose.

### F3 — the menu's cloud arithmetic was where no pin could reach it

The decision about what a tile says — signed in, legacy, busy, refused,
backed up — lived inside `ui/enhancedMenu.js`, which is DOM and a boot
and which no node test in this tree can drive. Three mutants of it went
through **the whole suite** untouched:

| mutant | what a player would have seen |
|---|---|
| `card.bytes > 0` → `card` | an upload that died between the row and the blob reads as **Backed up** |
| the listing patched, not re-asked | a backup that lands never changes the tile until the menu is closed and reopened |
| the slot key drops the character | every character's QuickSave is one slot: one spinner, one error, one armed Delete on all of them |

Paid at the root: the decision is `ui/saveTile.js`'s `cloudStateOf`
(pure, beside the states it names, returning a refusal **word** and never
a sentence), and the slot key is `systems/cloudSaves.js`'s `slotKeyOf`,
which is the module that owns "a slot is (character, save name)". What
is left in the menu is the handlers, which is all a menu should hold.

### F4 — `tools/accountProbe.mjs` never saw ACC2

The probe exists because **importability is not deployability** — it was
written the day the Worker could not boot while the suite was green. ACC2
added a whole new binding (`SAVES`) and seven routes, and the probe never
touched them.

The gap is worse than it looks: **a binding that is absent does not
crash.** `env.SAVES` missing answers `no-storage`, which reaches a player
as "Cloud saves are unavailable right now" — with a green suite and a
green deploy behind it, for ever.

Paid: the probe drives a whole save round trip in workerd against its own
R2 — the guest wall, a blob refused without a card, the card, the bytes
back **byte for byte** as an octet-stream, the shot bounded apart from
the save, another account refused a read and a delete, and the player's
own delete taking the object as well as the row.

**And the probe was only ever correct once.** `wrangler --local` reuses
its state under `server-account/.wrangler`, so the second run registered
a username the first had taken and logged in with a password the first
run's recovery check had changed — six failures that were about the last
run rather than about the service, and a migration check that read "no
migrations to apply" as "no migrations". It stands on a fresh
`--persist-to` directory now, and two runs back to back are 36/36 twice.

### F5 — the extraction changed the ten heads' contract

TILE1 lifted the face drawing out of `systems/chargenSession.js` into
`ui/facePortrait.js`, which is right. But the new one ends
`.filter(Boolean)` and the old one did not.

`faceIndex` is on the save envelope and it addresses a **record number**.
`bitmapCanvas` returns null for a record with no data, so one bad record
shifted every later face down by one — while `ui/chargenArt.js`'s
`loadFaceSet`, the OTHER reader of the same ten records, pushes for every
index and never compacts. Two homes for the ten heads that disagree about
what index 5 means is precisely the drift the extraction says it exists
to prevent. Both readers already draw something where a face is missing,
so the hole is safe and it is kept.

### F6 — smaller, and recorded rather than paid

- **The cloud latch was per page load, not per visit.** ACC2c's record
  says "asked ONCE per visit to the menu"; the latch was module state and
  nothing cleared it, so a player who backed a save up on their phone and
  reopened this menu saw whatever listing was last fetched. A fresh mount
  clears it now (and the armed Delete with it — an armed destructive
  button must not outlive the screen it was armed on).
- **The spent-set's eviction comment claims more than it holds.** "past
  it the OLDEST goes, so a flood cannot evict the token somebody is about
  to present" — the set holds SPENT tokens, so what an eviction exposes
  is a replay of an already-presented one. The real bound is the 300 s
  TTL plus the mint rate (`ACCOUNT_MAX` 240/min per account), which makes
  4096 live entries in one room inside one token's life a deliberate act
  with several accounts, by somebody who already has the victim's token
  off the wire. Left as it is; the sentence is the thing that was wrong.
- **`encodeURIComponent` on the R2 key's player half is equivalent**, and
  that was DRIVEN rather than assumed: `accounts.js` mints ids base64url,
  so the call is a no-op over every id that can exist. Belt for the day
  that alphabet changes, recorded as equivalent in
  `tools/mutants/audit312.json`.
- **`pullSlot` is still the one live dead seam**, as ACC2c says — the
  cloud-only tile is the next slice.

Mutants: `tools/mutants/audit312.json`, 10, **9 dead and 1 recorded
equivalent**.

---

## AUDIT-PW — 2026-09-22, Mac: "Can you read those"

The two things AUDIT-ACC named as unexamined and never came back to:
`server-account/src/password.js` had never had the adversarial read the
token got, and `tools/accountProbe.mjs` had never been mutated. Both
were named again at the end of AUDIT-312, which is the second time a
record has said so — so they are done here rather than named a third
time.

### P1 — NOTHING MAY HASH AN EMPTY CREDENTIAL, and the hole was live

`codeForHashing` has **two contracts**. At the mint (`register`,
`recover`) a null is impossible; at the check a null is the ordinary
answer to a typo. **Nothing enforced the first.**

`normalise` answers `''` for anything that is not a string, so a minted
code that failed to canonicalise hashed the **empty string** into
`recovery_hash` — and `recover` compares `canon ?? ''` against that row.
Every account registered in such a window is opened by typing any string
that is not a code at all. Driven, before the fix:

```
codeForHashing('NOT-A-VALID-CODE!!')  -> null
hashPassword(null)                    -> pbkdf2-sha256$...   (of '')
verifyPassword(codeForHashing('total garbage') ?? '', that)  -> TRUE
```

**It has happened once.** password.js's own note records the Q fold
doing exactly this to `7GEPQ-47BS9-AYK70-QMWYW` — and the only thing
that caught it was a test over minted codes. Nothing in the code refused
to store the result, so the same shape would come back with the next
alphabet change.

Paid at the chokepoint: `hashPassword` refuses an empty normalised
input, because it is the one door every stored credential in this
service goes through. It **throws** rather than returning a refusal — a
caller that hands it nothing is a programming error, and the router
turns it into a logged 500 that stores nothing, which is the right
failure for this. Nothing legitimate is refused: `passwordRefusal`'s
floor is 8 and it runs first at all three password sites, and a minted
code is twenty characters.

### P2 — the constant-time compare failed OPEN

`timingSafeEqual` **coerced** anything that was not a `Uint8Array` to an
empty one. Two lengths of 0 XOR to 0, the loop never runs, and the one
primitive in this service whose whole job is to say NO said yes:

```
timingSafeEqual(null, null)      -> true
timingSafeEqual(undefined, {})   -> true
```

Unreachable today — `verifyPassword` is its only caller and always hands
it two real derivations — which is exactly why it could sit there. A
defensive default that defends in the wrong direction is worse than no
default, because it reads as care. Anything that is not a pair of byte
arrays is unequal now.

**And the campaign found this pin's own blind spot.** The loop reads
`x[i % x.length]` so that a byte is read on every iteration whichever
array is shorter — which means a short array that **repeats** into a
longer one matches it byte for byte, and the length XOR seeding `diff`
is the only thing that says no. A *prefix* dies without it; a *repeat*
does not, and the pin only tested a prefix. `[1,2]` against `[1,2,1,2]`
is held now.

### P3 — the mint's own guarantee, widened

What was P1's only guard is kept as a pin in its own right: 2,000 minted
codes must survive their own canonicalisation, and every letter the
alphabet **contains** must come back unchanged (the Q fold's shape,
stated as a law rather than as one remembered case).

### What held

PBKDF2-SHA256 at 210,000 with a per-account salt and a self-describing
stored form; NFKC before the KDF; the rehash-on-correct-login upgrade
path; `verifyPassword` deriving before it checks whether the row parsed,
so "no password" and "wrong password" cost the same; `parseStored`
refusing rather than throwing; the code alphabet a power of two with the
mask exact and a throw if it ever stops being one; and `needsRehash`
consulted only after a verified login.

Mutants: `tools/mutants/auditpw.json`, 6, **6 dead and 0 survived** (one
survived the first run — the repeat case above).

### And the probe has been mutated at last

`tools/accountProbe.mjs` was named never-mutated beside password.js. The
question a campaign asks of a PROBE is the inverse of the usual one:
**break the service, and does the probe go red?**

| mutant | the suite sees it |
|---|---|
| a named value export back on the entrypoint | **no** — workerd refuses to start over a constant while the suite stays green BECAUSE it imports those very names |
| the R2 binding renamed in `wrangler.toml` | **no** — the suite hands the Worker its own env and never reads that file |
| the hash cost raised out of a Worker's CPU budget | no — the suite gets slower and stays green |
| a migration that stops applying through wrangler's ledger | yes, but not through the ledger the deploy runs |

Mutants: `tools/mutants/acctprobe.json`, 4, **4 dead and 0 survived.**

---

## ACC1d-MARK — the mark over the head (2026-09-22)

Mac, asked where the relay's verdict should be drawn: *"Should be over
the head in online how it currently works."*

ACC1d ended by naming exactly one thing it had deliberately not done.
Its **D5** says it plainly: *"after ACC1d the relay knows which names it
vouches for, the client knows, and the player does not. That last step
is a UI slice."* This is that slice, and it is a **client build** —
which is the whole reason D5 carried `v` to the peer rather than
stopping it at the relay. No `RELAY_VERSION` bump, nobody dropped.

### THE POLARITY IS MAC'S, AND THE FIRST CUT HAD IT BACKWARDS

The first cut put a `?` on the names the relay could **not** vouch for,
reasoning that the useful signal is the missing one. Mac asked the
question that takes that apart:

> Why a question mark since even guests get a name?

He is right, and the answer is that **the verdict does not divide guest
from account.** A guest with a session mints a token like anybody else
and the relay vouches for the name inside it. What it actually divides
is **a name the player TYPED from a name the service ISSUED**:

- **No session.** The hello carries whatever stands in `onlineName` —
  the *"Name over your head"* field in `ui/enhancedMenu.js` — and the
  relay only sanitises it for length and for the word filter. It can be
  anybody's, which is the impersonation hole ACC1a opened this arc to
  close.
- **A session, guest or linked alike.** The account service signs a
  token and the relay takes the name **out of it**.

So the badge goes on the name that was **checked**. Three reasons, and
the third is the one that settles it:

1. It can only ever appear where the service issued the name, so it
   **never becomes wallpaper** — which the `?` would be today, with the
   account window an offer rather than a gate.
2. It is the shape every reader already knows: a mark you look *for*,
   not an accusation you have to learn to ignore.
3. **It fails safe.** A relay whose public key will not import vouches
   for nobody — so it badges nobody, where the old polarity would have
   accused every head in the room at once.

### Beside the name, never inside it

The name is centred on the skull. Prefixing a glyph into the string
moves the label off the head it belongs to — and only for the badged
peers, so it reads as *those* names drifting. So the badge is its own
draw in the classic face (`NAME_MARK_GAP_PX` to the left of the label's
left edge, measured off the name's own width) and its own `<span>` in
the DOM face, which also means `setText` on the name cannot wipe it
every frame.

### And the colour stays where it was

SOC4's party green says **who somebody is to you**. The badge says
**whether the service issued the name**. Two systems, one pixel, and the
colour belongs to the first — so the badge keeps the sheet's own ink and
the tint stays on the name element. Moving the colour up to the wrapper
to cover both is what the first cut did, and it broke two NAME1 pins,
which were right.

### ABSENT IS UNVOUCHED, and it is the relay's encoding that says so

The wire has **no `v: false`.** `server/src/index.js` sends
`v: who.verified || undefined` and omits the field otherwise, on the
join, the roster, the `who` answer and the chat line alike — a byte
saved on the frame every player sends. So the shape a real unvouched
peer arrives in is a peer with **no `v` at all**, and the client's read
is `e.peer.v === true` because that is the only reading that agrees with
the sender. `net/online.js` has normalised it to a hard boolean on the
peer since ACC1d, so the point sees one or the other and never the gap.

**The campaign found this one, not the reading.** MARK-7 flips the read
to `!== false`, and it *survived* the first run: every pin said `v:
false` out loud, which is a frame the relay never sends. Under this
polarity it is the worse bug of the two, because the badge is the thing
a player is asked to *trust* — so a mutant that badges the unchecked is
a lie rather than a missing warning. The pin holds the relay's own line
now, and a peer with the field missing entirely.

### ONE ASCII GLYPH, and ASCII is necessary rather than sufficient

The classic face draws through a Daggerfall bitmap font and can only put
on screen what that font has a record for — `drawText` draws **nothing
at all** for a glyph of zero width, so a badge the font lacks is one the
classic skin silently never shows while the DOM face shows it. A tick is
the obvious badge and is not in that font; `NAME_MARK` is `*`, the pin
holds it inside the font's own glyph range, and the mutant that swaps it
for `\u2713` is dead. **The limit, stated rather than left to be found:
this container has no ARENA2, so the real FONT0003 is not read here.**

### SHIPPED 2026-09-22

- `src/net/remotePlayers.js` — `NAME_MARK`, `NAME_MARK_GAP_PX`;
  `namePoints` carries `vouched` on the point (a fact about the PEER,
  unlike `colorOf`, which is the social system's knowledge asked for by
  id); `drawNamePoints` draws the badge beside the label.
- `src/ui/nameLayer.js` — the tag is a wrapper over a `.dfname-mark`
  span and a `.dfname-who` span; an empty badge takes no room
  (`:empty` drops its margin), so an unbadged label is exactly the
  element it was before this existed.
- Pins: `test/name1_bubbles.test.js` 20 → **21**. The fixture sets `v`
  EXPLICITLY and its default is **not vouched** — the plain label, which
  is what those pins are about and what an ordinary peer is today.
- Two neighbouring pins were re-aimed rather than worked around, and
  both got stronger for it. `test/soc4_partyhud.test.js` read the white
  fallback off the draw call; it reads it off the `tint` both draws take,
  so SOC4's law now covers the badge as well as the name — *SOC4 owns
  that colour and ACC1d-MARK does not get a second opinion on it.*
  `test/perfon_text_run.test.js` measured one draw per peer; it measures
  both cases, and a badged room is **2n draws and still nothing that
  scales with how long anybody's name is**, which is the whole of what
  PERF-ON was ever about.
- Mutants: acc1dmark.json, 8, **8 dead and 0 survived** (the file is
  gone with the slice - ACC1g retired it hours later, below).
  Two survived a first run. MARK-3: prefixing the badge INTO the name
  leaves the *run count* unchanged, so the pin read the badged peer's
  name draw as having the same glyph count as when nobody is badged.
  MARK-7 was the one above. MARK-8 held Mac's correction as a law
  rather than as a memory.

### AND THEN ACC1g RETIRED IT, hours later and for his own reason

The badge meant something only while a name could be VERIFIED **or**
TYPED. Mac closed the typed one the same night, so every name over
every head is a checked one and the badge appeared on all of them -
which is the wallpaper he named when he took the first polarity apart.
It is gone, with `NAME_MARK`, `NAME_MARK_GAP_PX`, the point's `vouched`,
the DOM layer's span, its pin and its campaign; `v` leaves the wire in
the same deploy, because the badge was its only reader.

**The mechanism is in the history and in this page, not in a dead
branch:** a mark beside a label, measured off the name's own width so
the label stays centred on the skull, drawn in both faces out of one
point, in the name's own colour. If a later slice needs one - a
moderator, a party leader, a mute - that is where to read how it was
done, and how not to do it (MARK-3 and MARK-7 both survived their first
run).

---

## ACC2c — the save that is only in the cloud (2026-09-22)

Mac, asked whether to build it: *"And yes."*

### ACC2 BUILT THE BACKUP AND NOTHING COULD READ ONE BACK

`pullSlot` was written, pinned end to end against the real service in a
real workerd, and had **zero callers.** Not a missing button — a missing
*surface*: a cloud card only ever reached a player as the cloud LINE on
a local tile, and a card with no local tile has no line to appear on.

So the one case cloud saves exist for did not work. A player who cleared
their browser, or sat down at a second machine, opened Load and saw
**"No saved games. Save a game and every slot of it appears here"**,
with their games three feet away in R2 and nothing on screen admitting
they existed. That sentence was the symptom and it is now one of the
things this slice deletes.

### The difference is a set difference, and it lives in `systems/`

`cloudOnly(cards, saves)` — the cards no local slot answers to, keyed by
`slotKeyOf`, the same key the cloud line is asked with. So a card gets
**a line on a tile or a tile of its own, never both and never neither**,
and the pin asserts exactly that, card by card.

It is not in the menu, and that is AUDIT-312 F3's finding taken
seriously rather than repeated: `ui/enhancedMenu.js` is DOM and a boot,
and the last copy of a slot key written there had **dropped the
character half** — which makes every character's QuickSave one slot —
and the mutant of it went through the whole suite untouched. Here, that
same mutant dies: one local QuickSave would otherwise hide *every* other
character's cloud QuickSave, and those saves would go on being invisible,
which is the failure this slice exists to end.

### The card is smaller than a save, so the tile says less

`server-account/src/saves.js` keeps eleven columns and **none of them is
a race, a class, a level, a health, a gold or a look.** None of it was
ever uploaded. So `saveFromCard` hands back a shape with those fields
**absent** — not zero, not a dash — and the tile degrades on its own:
`tileLine` joins nothing and is never appended, the stats list stays
empty and is never appended, and the well falls back to the character's
initial. **Not one special case in the drawing, and not one invented
fact.** Two mutants hold that line: a level read off `save_version`, and
the initial taken from the slot name so a tile reads `QuickSave` where
the character goes.

`gameTime` **is** classic minutes — `saveSlots.js`'s own `SaveInfo`
typedef says so of the very field `pushSlot` copies up — so the date and
hour are derived by the same two calls a local tile's are, rather than
by a second interpretation of one number.

### `only` is a seventh state, and its own whole ladder

Every rung of the local cloud ladder is a question about a *local* slot:
whether it predates CHARID1, whether its upload finished, whether it has
been backed up at all. **None is answerable about a save that is not
here** — a card with no `characterId` is still a card, not a `wait` — so
`local: false` is its own arm rather than a flag threaded through five
branches. What *is* still true of it is kept: a download in flight is
`busy`, and a refused one carries the service's own word.

The sentence is **"Only in your backup"**, not "Backed up". Under a tile
whose only copy *is* the backup, "Backed up" tells a player they have
two of something they have one of. It wears `is-only`, and the probe
reads it **brass** against the backed-up line's verdigris in a real
Chromium.

### One pane, and the delete that F1 half-finished

**Load, and no other.** Online brings a character in to play *now* and
cannot use a save that is not here, so offering it there is a two-step
act at a one-step door; Save writes rather than reads, and a cloud-only
slot in that grid would be an Overwrite target for a game this device
does not have. Load's whole job is getting a game back.

And the tile carries **Delete backup**, two presses, which is **the rest
of AUDIT-312 F1**: that slice gave a player the way to act on *"delete a
save there to make room"* and gave it to them on LOCAL tiles only — so a
cloud-only slot went on holding its share of `SAVES_MAX` with no surface
that could ever release it. Same word, same arm.

### SHIPPED 2026-09-22

- `src/systems/cloudSaves.js` — `cloudOnly`.
- `src/ui/saveTile.js` — `saveFromCard`; `CLOUD_STATES` gains `only`
  (appended, so nothing positional moves); `cloudStateOf` takes `local`,
  defaulting **true** so every caller written before this slice reads
  exactly what it read.
- `src/ui/enhancedMenu.js` — `download` (the caller `pullSlot` never
  had, through `runCloud`), `cloudForCard`, `cloudOnlyGrid`, and the
  narrowed empty case.
- `src/ui/enhancedStyle.js` — `.svcloudonly` and `.svcloud.is-only`.
- Pins: `test/cloudsaves.test.js` 19 → **21**, `test/savetile.test.js`
  11 → **13**. Probe: `npm run savetile` 18 → **29 checks**, which is
  where the heading's face, the brass, and a tile that could have
  collapsed to a strip were actually measured.
- Mutants: `tools/mutants/acc2c.json`, 10, **10 dead and 0 survived.**

---

## ACC1g — the wall moves to the door (2026-09-22)

> You shouldnt be able to just type a name and enter anymore.... this is
> what the account system is for

### THIS IS THE FLIP ACC1d NAMED AND DID NOT MAKE

ACC1d's own record says it out loud: *"a token makes a name TRUSTWORTHY,
it does not yet make one MANDATORY, and ACC0's wall is not fully
standing until that flip, which is its own slice with its own deploy."*
This is that slice.

Until here the hello carried a `name` **the client wrote** and the relay
only sanitised it. ACC1e put a text field in front of it — *"Name over
your head"* — and a URL could set it too. So anybody could type
anybody's name and walk in wearing it: the impersonation hole ACC1a
opened this arc to close, still open at the end of six slices about
closing it.

**ACC0's wall moves.** That page said *THE WALL IS AT CLOUD SAVES AND
NOWHERE ELSE*, and the argument was that a guest should be able to
connect, be seen, walk and chat under a generated name. **That argument
still holds and the wall still doesn't cost a guest anything** — a guest
session mints a token like anybody else, so the price of getting in is
one press of *Continue as guest* and no email. What changed is that
there is no longer a way to be in the room **unnamed by the service**.
Mac's own bargain from ACC0 — *the only people who can take a name are
the people who can be banned* — is the whole of it, and this is the line
where it becomes true.

### The relay refuses, and both arms are refusals

```
no token       -> 'sign in to play online'
no usable key  -> 'sign-ins cannot be checked right now'
token, bad     -> refused, loudly (unchanged)
token, good    -> the name out of the TOKEN (unchanged)
```

**The second arm changed direction.** While a token was optional, a
relay that could not verify admitted everybody unnamed, on the reasoning
that refusing the world over a mistyped config was the worse failure.
With the wall at the door that reading *is* the hole: a relay that
cannot verify cannot tell an issued name from a typed one. It fails
closed, and what keeps that from being how the game goes dark is at the
**deploy**, not here — both workflows check the relay's copy of the
public key against what the account service publishes, and a real
disagreement stops the deploy before a player sees it.

### What the player sees

The *"Name over your head"* field is **gone**, with the `onlineName`
pref and the `?name=` URL override behind it. In its place the Online
pane says who you are, read from the session on this device — a storage
read and no network, the same one the door's profile mark makes. Signed
out, it says why and offers the way in; **Play online** is a dead button
rather than a live one that fails at the relay.

**NAME-F2's entry half moved and did not disappear.** The filter that
refused `Cum` at that field now refuses it at **registration**, where a
name is chosen once instead of re-judged on every press:
`handleRefusal` ends in `nameIsIssuable`, which is
`sanitizeName(h) === h`, which is the very function carrying
`nameAllowed`. One filter, one home, asked earlier and asked once.

### `v` leaves the wire, and the mark with it

Every admitted socket is verified now, so the per-name verdict on the
join, the roster, the `who` answer and the chat line said the same thing
about everybody — a field carrying no information. It goes in **this**
deploy rather than a later one, because a wire change costs a drop and
this deploy is already paying for one. ACC1d-MARK, its only reader, is
retired above for the same reason: a badge on every head is no badge.

### What the fixtures learned, which is a finding about the tests

**Eighty-nine relay pins went red on the gate**, and that is the gate
telling the truth about what every one of them had been assuming. The
fix is not a back door in the room: `test/fakeRoom.mjs` mints a **real
Ed25519 token** against a real key and the room really verifies it, so
those pins now run through the door a player runs through rather than
around it. Three things fell out of it:

- **The token's name is the frame's**, because the relay takes the name
  out of the token and ignores the frame's. A harness that signed one
  name and typed another would be re-proving that the frame is ignored,
  in every pin that ever names a peer.
- **`n16` cannot be minted.** Two fixtures named their peers `n${i}` and
  `N${i}`, and the sixteenth folds to a slur under NAME-F1's leet
  normalisation — so `sanitizeName` answers `Traveller` and
  `nameIsIssuable` refuses. The old fixtures never noticed because
  nothing checked the name they typed. **A token has to be issuable to
  exist**, which is the filter reaching one layer further than it used
  to.
- **The harness's own uniqueness bug, found by the room.** The room
  spends a signature once and Ed25519 is deterministic, so two helloes
  for one identity need different claims. Counting mints and subtracting
  from the *current* clock cancels out the moment the clock moves: a
  test ticking its fake clock past a second boundary minted `nowS - 1`
  and then `(nowS + 1) - 2` — the same instant, the same bytes, refused
  as a replay. Each identity's issued-at is kept as a **value** now and
  only ever goes down.

Two pins were also measuring the wall clock without knowing it. WORLD1's
host tie-break gave the other three sockets a +10ms head start and
relied on the test reaching the hello inside that window; it freezes the
clock and sets three equal stamps now, which is what its own comment
always said the case was — *"the same-millisecond tie the smaller id
wins"*.

### SHIPPED 2026-09-22

- `server/src/index.js` — `_named` refuses both arms; the attachment,
  the join, the roster, the `who` answer and the chat line drop `v`.
- `src/net/wire.js` — `rosterFor` drops `v`; `RELAY_VERSION` world85 →
  **world86** (and ACC3 carried it on to world87 the same day, so both
  ride one drop).
- `src/net/online.js`, `src/net/chat.js` — no `v` on a peer or a line.
- `src/net/remotePlayers.js`, `src/ui/nameLayer.js` — the mark retired.
- `src/ui/enhancedMenu.js` — the name field replaced by who you are; the
  button gated on a session. `src/scenes/world.js` — the two typed name
  sources gone. `src/systems/uiPrefs.js` — `onlineName` gone.
- `test/fakeRoom.mjs` — `roomSigner`, shared with slam5's own harness.
- Pins: `test/identitytoken.test.js`'s two admit-arms rewritten as
  refusals; `test/acc1dclient.test.js`'s three verdict pins replaced by
  their inverse (no door may carry one, and a peer must not keep one a
  stale relay sends); NAME-F2, AUDIT-CHATR F2/F6 and SLOTS1 re-aimed to
  where the name is now judged.

**NOT DEPLOYED, and the price is the arc's largest yet.** The relay
deploy fires on merge to main: it drops every connected player, **and
from that moment nobody can join without a session.** Every player
online today is using a typed name.

**TOKEN-WAIT (FIELD BUGS 2026-09-29h, MD-Geist: "a perpetual 'World: Sign
in to play online' & 'World: Connecting' state").** The flip left ACC1d's
budget behind: `TOKEN_WAIT_MS` was 2.5 s because past it the hello went
unsigned and still got in. After ACC1g it is refused, so a token route
slower than 2.5 s refused every hello, and the World link's thirty-second
rejoin met the refusal again for as long as the page stood. The budget is
8 s now: the service's real answer, under the relay's `HELLO_WAIT_MS`. The
console says why a hello went unsigned (the minter's own word, or a late
token). `01-Overview/Field-Bugs-2026-09-29h.md`.

---

## ACC1h — the Online pane is the tiles (2026-09-22)

> So the online pane should just be the new save panels, correct?

He had said it once already, when ACC1f moved the account card off this
pane: *"I want [the Online pane] reserved for a detailed tile based
design for your saves."* It was not. Above the tiles stood a heading, a
paragraph about what a shared world shares, a text field for a name, a
Relay field and a line telling the player to pick a character. ACC1g
took the name field; this takes the rest.

**The pane opens as the characters.** One card above them only when
nobody is signed in — the reason the buttons are dead, and the way in —
because a player looking at their own characters with every button
greyed out and no reason on screen is the fault this pane would
otherwise have.

### Nothing was deleted for tidiness

**The shared-world promise moved BELOW the tiles, not out.** AUDIT
WORLD34 D5's law is that *what a player is told here is the law*, and
the pins that hold that sentence against the relay's own behaviour are
the reason it says true things — it once said *"Nothing else is shared
yet"*, which WORLD1 had already made false. Twelve pins went red when it
was cut, which is those pins doing their job. So the rules a player is
agreeing to are still on the surface they enter through, where a page in
the bible cannot reach them; they are simply no longer in the way.

**The Relay field went with it,** and that is a compromise stated as
one: Settings is where an override a player sets once belongs, but
`ui/settingsMap.js` has no free-text row kind yet, and inventing one
inside this change is how a diff stops being reviewable. It cannot just
go — `scenes/world.js` still reads `onlineServer`, and deleting the only
way to set it would leave a read nothing can answer. **Owed: a text row
kind in settingsMap, and this field moved into it.**

---

## ACC3 — titles and glyphs (2026-09-22)

> Next feature before this becomes a live addition.
>
> 1. Player titles and Name glyphs
> Players can tap the account icon to equip 1 feature along with signing
> out.
>
> Player titles appear above a player name. We will develop 2 titles to
> start out.
>
> 1st title is Founder with a gold color
> 2nd title is Developer with a red color
>
> All current players should be granted the founder title
>
> 2nd is name glyphs. These small glyphs appear on the right side of the
> player name. These are as follows
>
> Sprouting green plant. Attached to new accounts for 2 weeks
>
> Developer glyph specifficaly for developers

Two answers settled the open halves of it before any code: **Developer
is granted by a config list of handles**, and **Founder goes to
registered accounts only**.

### EVERY GRANT IS DERIVED, AND NOT ONE OF THEM IS A COLUMN

This is the whole design, and it is this repo's own **DERIVED OVER
ENUMERATED** applied to the one place a grant is usually a row:

| | held when |
|---|---|
| **Founder** | registered, and first played by `FOUNDER_UNTIL`: `min(created_at, registered_at, first_played_at) <= FOUNDER_UNTIL` - `first_played_at` since FOUNDER4 (the first contact of a row the account shares a character with, migration 0078), the two before it since FOUNDER3 (it read `registered_at` alone before; 1790294400 — 2026-09-25T00:00:00Z since FOUNDER2; it was 1790121600, 2026-09-23T00:00:00Z) |
| **Developer** | the handle is in `env.DEVELOPER_HANDLES` |
| **sprout** | `nowS - created_at < SPROUT_S` (two weeks) |
| **dev** | the same list as the Developer title |

**Mac asked that "all current players should be granted the founder
title", and the obvious migration is an `UPDATE` over every row.** There
is none, and that is the design rather than an omission. A walk records
a fact ONCE, at a moment nobody can re-derive: a row added by hand
afterwards has no flag and nothing says why, a row restored from a
backup has whatever the backup had, and *"who is a founder?"* can only
be answered by reading every row. A cutoff answers it in one line, gives
the same set today, and is still right tomorrow.

**The sprout is the same argument with teeth.** A glyph that expires
after two weeks, *stored*, needs something to come along and remove it.
That is a cron, and a cron is a thing that can stop running while
everything looks fine — **AUDIT-ACC F9 settled exactly this**, one
system over, for idle sessions. Derived from `created_at` it expires
because time passed, which is not a job anybody can forget to run.

**And a developer is a list in config** because granting one is a thing
a person does by editing a reviewed, deployed file — not by reaching
into a live database at three in the morning. Taking a handle back off
that list is the whole of revoking it: the title and the glyph both stop
being signed for on that player's next token, with nothing to clear.

### D1 — HOLDING IS NOT WEARING, and only the wearing is stored

A player may hold two titles and wears at most one — Mac: *"equip 1
feature"*. `players.title` is the **only** column ACC3 adds, because the
worn title is the only part of a wardrobe that is a **choice**.

Equipping validates against the set derived *now*, and `titleWorn` asks
the same question again on the way out — so a developer taken off the
list stops wearing the badge without anybody remembering to clear a
column, and a column somebody edits by hand is not a grant.

`migrations/0004_titles.sql` is one `ALTER TABLE` and a long note saying
why there is no walk beneath it.

### D2 — THE BADGE RIDES THE SIGNATURE, and this is ACC1g's law one field over

ACC1g shut this hole on the **name** hours earlier. A title is the
stronger claim of the two: *"Developer"* over somebody's head reads as
this project's own word about them, and if the hello carried
`title: 'developer'` the relay could only sanitise it — the first person
to open devtools would be a developer.

So the account service, the only thing that knows what a player was
granted, **signs** `t` and `g` into the token, and the relay reads them
**out** of the verified claims exactly as it reads the name. `TITLES`
and `GLYPHS` are closed lists in `src/net/identityToken.js` and
`claimsValid` checks both *before* `verifyToken` says ok — so an unknown
badge cannot have been signed for, and the relay never re-checks one.

**The token is derived at mint**, so both lapse on their own: a token
lives `MAX_TTL_S`, which makes a badge at most five minutes stale.

### D3 — absent, never null

`wire.js` `badged` puts the two keys on a row **only when there is a
badge**, the same discipline `look.class` keeps two hundred lines up.
Most players wear nothing, so `"title":null` on every row of a 64-peer
welcome is bytes paid for saying nothing — and a reader that has to tell
*"no title"* from *"this build has no such key"* has two answers where
one will do.

It is one function, used by the welcome's roster, the join, the channel
roster **and the `who` answer** — that last one is built by hand rather
than by `rosterFor`, and is exactly where one peer comes to be the only
unbadged one in a badged room. That is a signal true most of the time,
which is the shape **ACC1d-MARK was retired for being**.

### D4 — it costs nothing NOW and would cost a deploy later

Mac's own framing: *"Next feature before this becomes a live addition."*
`identityToken.js` is in the relay bundle, so a claim added to it bumps
`RELAY_VERSION` and drops every connected player. **The deployed relay
is still world84**; world86 (ACC1g) and world87 (this) are both on the
branch, so all of it rides ONE drop rather than three. After that merge
each would cost its own.

### SHIPPED 2026-09-22 — the service, the token and the relay

- `server-account/src/titles.js` — new. The four grants, the wardrobe,
  the equip refusal. Pure, and it takes `env` and `nowS` rather than
  reaching for either.
- `server-account/migrations/0004_titles.sql` — new. `title TEXT`, and
  no walk.
- `server-account/src/accounts.js` — `accountWardrobe`, `equipTitle`.
- `server-account/src/index.js` — `/v1/auth/token` mints with the
  wardrobe; `/v1/account` answers it beside the account view; the new
  `POST /v1/account/title` equips one, or none.
- `server-account/src/service.js` — `/v1/account/title` in `ROUTES`;
  `ACCOUNT_VERSION` acct2 → **acct3**.
- `server-account/wrangler.toml` — `DEVELOPER_HANDLES`, empty. **It
  ships empty on purpose: nobody holds the Developer title until a
  handle is written there.**
- `src/net/identityToken.js` — `TITLES`, `GLYPHS`, `GLYPHS_MAX`; the
  `t`/`g` claims, minted and validated.
- `src/net/wire.js` — `badged`; `rosterFor` carries it;
  `RELAY_VERSION` world86 → **world87**.
- `server/src/index.js` — `_named` returns the badge off the claims; the
  attachment holds it; the welcome, the join, the channel roster and the
  `who` answer carry it.
- `test/acc3titles.test.js` — 13 pins. `test/fakeRoom.mjs` mints a
  badged token, and a `title` on a hello frame is **deleted** rather
  than sent: the relay ignores it, and a harness that could set one
  would be testing the wrong half forever.
- `tools/mutants/acc3a.json` — 12, all dead.

**OWED, and it is the half a player can see: `ACC3b`.** The name layer
does not draw either yet, and the account icon has no equip control on
it. Nothing above reaches a screen until it does.

### ACC3b — SHIPPED 2026-09-22: over a head, in both faces

**`src/ui/playerBadge.js` is the one home, and it is deliberately NOT in
`identityToken.js`.** That module owns what EXISTS and is in the relay
bundle, where a word of presentation costs a `RELAY_VERSION` bump and
drops every connected player — and the relay has no opinion about gold.
So the vocabulary is imported from there and the appearance lives here,
where it can be changed for nothing. A pin WALKS `TITLES` and `GLYPHS`
and requires an entry for every member, so a third title added to the
token cannot reach a screen as a blank.

**A glyph has TWO spellings and it is written down.** The enhanced DOM
layer can draw a sprouting plant; the classic bitmap pass draws through
a Daggerfall font and puts *nothing* on screen for a glyph that font
lacks — ACC1d-MARK learned that with a tick, one slice earlier. So each
glyph carries an SVG `path` for the face that can, and a one-character
`mark` inside FONT0003's own range for the face that cannot. The limit
is stated rather than left to be found: **this container has no ARENA2,
so the real font is not read by any pin — the range is.**

A title has ONE spelling, because it is a word, and both faces draw a
word. Only its colour is spelled twice (an RGBA array, `cssRgba` for the
DOM), which is exactly how SOC4's party green already crosses that seam.

**The title's colour is not `colorOf`'s.** SOC4 owns the NAME's green;
gold IS the Founder title. Either painted over the other erases a
distinction somebody asked for, so they are two labels with two owners
and a mutant holds the line.

**`readBadge` is the inverse of `badged`, and lives beside it** in
`wire.js` — the client's half of one field, so a badge cannot be written
one way and understood another. The relay never calls it (it reads a
badge out of a verified token, never off the wire); it is there because
the alternative is a second spelling of one law in `net/online.js`. It
CHECKS the vocabulary, because what arrives is a stranger's word: the
relay only sends what a signature carried, so anything else is a relay
that is older, newer, or not ours.

- `src/ui/playerBadge.js` — new. The words, the colours, the marks, the
  paths; `titleBadge`, `glyphBadges`, `glyphMarks`.
- `src/net/wire.js` — `readBadge`; `RELAY_VERSION` world87 → **world88**.
- `src/net/online.js` — the peer carries the badge, wears the NEWEST
  hello's including none, and the remembered introduction keeps it so a
  socket blip does not strip every title in the room.
- `src/net/remotePlayers.js` — the badge rides the POINT (a fact about
  the peer, unlike `colorOf`); the classic pass draws the title on its
  own line above and the glyphs inside the centred run.
- `src/ui/nameLayer.js` — `.dfname-title` above the row, `.dfname-glyphs`
  after the name, the run rebuilt only when the badge changes.
- `test/acc3badge.test.js` — 8 pins. `tools/mutants/acc3b.json` — 12,
  11 dead and 1 recorded equivalent.

**THE CAMPAIGN CAUGHT THE PIN THAT WAS SUPPOSED TO HOLD THE DRIFT.** A
badge beside a name widens the run the label is centred on, and a run
measured without it walks every badged name half a badge off its own
skull — NAME1's entire complaint, re-made sideways by the feature meant
to decorate it. The first cut of that pin compared two centres with a
four-pixel tolerance and the mutant walked straight through: a pin about
drift that tolerated the drift. The left edge is DERIVED now, through
the same `measureText` the draw uses and at the point's own perspective
scale — half the WHOLE run left of the head, and demonstrably not half
the name.

**And the recorded equivalent is honest rather than convenient.** The
client's glyph bound (`glyphs.length >= GLYPHS_MAX`) is unreachable by
construction: the duplicate test over a closed vocabulary already
implies it, and `GLYPHS_MAX` is that vocabulary's own length. It stays
because it is the TOKEN's bound restated at the client's door, for the
day somebody relaxes the duplicate test — AUDIT-PW P2 is the standing
example of why keeping such a guard is right.

### ACC3c — SHIPPED 2026-09-22: the control, and the roster

> Players can tap the account icon to equip 1 feature along with
> signing out.

Where he put it. The signed-in card gains a **Title** row of the titles
this account holds, and a **Glyphs** row beside it that is not pressable.

**THE CLIENT DOES NOT DECIDE WHAT IS HELD.** The grant is derived at the
service and can lapse *between the card being drawn and the button being
pressed* — a handle taken off `DEVELOPER_HANDLES` is the real case — so
the flow asks and takes the service's answer **whole**, including a
`titles` list that shrank in the same breath as the write. A client that
patched its own copy would go on offering a title nobody grants any more.

**Pressing the one already worn takes it off**, because a picker whose
only route to wearing nothing is a second button is a button that does
nothing most of the time — and Mac asked for one control.

**And the glyphs are not buttons.** A glyph is *true* of an account —
the sprout is its age, the dev mark is a grant — so nothing equips one,
and a control that cannot be operated is worse than a fact that never
offered to be. A pin reads the source to hold that.

### The card almost broke ACC1e's own rule, and the pin caught it

`ui/enhancedAccount.js` **may not style itself** — enhancedStyle.js's
header says why: *two copies of a design language is how the front door
and the rooms behind it drift apart*. The first cut of this slice wrote
`style.color` straight off the badge table, and ACC1e's pin went red.

It was right, and the fix is better than what it refused: the card
writes a **class**, and `enhancedStyle.js` emits one rule per title and
per glyph from `badgeCss()`, **walked out of the vocabulary**. The gold
on this card and the gold over a head are now one fact, and a third
title gets a colour without anybody remembering to write one.

`cssRgba` moved to `ui/playerBadge.js` with `ui/nameLayer.js`
re-exporting it — three surfaces cross that seam now, and a stylesheet
may not import a layer that drags the whole remote-player pass in behind
it. SOC4's pin that the party green survives the trip is untouched,
deliberately: moving that import would be a change to SOC4's seam for a
reason that is not SOC4's.

### The roster wears it too, and MY OWN ROW is the one that mattered

A roster is a list of names, and a name wears a title everywhere else it
is drawn — a bare one here is the same name saying two things on one
screen. **The relay never sends me my own roster entry**, so my row is
built from the session, and without the badge there the one name a
player looks at most would be the only one in the list with no title on
it. That is ACC1d-MARK's shape a third time: a signal true for everybody
but you reads as a fault in your own account.

It goes through `readBadge`, not a second spelling of the check. And it
is **in the repaint key** — that list redraws only when the key moves
(SOC3 put the open menu there for the same reason), so a title equipped,
or a sprout aged past two weeks, would otherwise stay correct in the
model and wrong on screen until somebody else joined the room.

- `src/net/accountClient.js` — `equipTitle`; `not-held` and `no-title`
  in the refusal table, two sentences because they are two situations.
- `src/ui/accountFlow.js` — `wardrobe` beside `account`, and `equip`.
- `src/ui/enhancedAccount.js` — the picker, `GLYPH_LABEL`.
- `src/ui/enhancedStyle.js` — the wardrobe's rules, plus `badgeCss()`.
- `src/ui/playerBadge.js` — `cssRgba`, `badgeClass`, `badgeCss`.
- `src/net/roster.js`, `src/ui/chatPanel.js` — the badge on a row.
- `test/acc3wear.test.js` — 10 pins. `tools/mutants/acc3c.json` — 12,
  all dead.

**THE CAMPAIGN CAUGHT A FIXTURE THAT PROVED NOTHING.** The pin for *"the
flow takes the service's answer whole"* had the service answer exactly
what a local patch would have produced, so the mutant that patches
locally walked through it. The fixture now answers a wardrobe that
**shrank** — the developer grant gone, the dev glyph with it — which is
the real shape of the case and kills it.

**STILL OWED: `DEVELOPER_HANDLES` ships empty.** Nobody holds the
Developer title until a handle is written into it. Mac (2026-09-22):
*"Ill have provide developer names once all our accounts are created."*

---

## RED1 — the server speaking (2026-09-22)

> Before we merge after everything, I want to set up a red text system
> (kind of like warframe) where I can message chat as the server before
> we merge.

Warframe's red text: the developer says something to everybody at once,
and everybody can tell it is not a player saying it.

### D1 — A LINE THAT LOOKS OFFICIAL IS THE MOST VALUABLE FORGERY HERE

*"The relay is restarting in 5 minutes."* *"There is a duplication bug,
log out now."* *"The developers are giving away X — click this."* Every
one of them costs a player something, and every one is free to whoever
can make a line look like the server.

So the authority is **a signature and nothing else**, and it is a
signature this arc already mints: `a.glyphs` on the socket's attachment,
written by `_named` out of the verified token claims and writable by
nothing else on that socket.

**The right to speak as the server is the same fact as the dev mark
beside the name.** Granted by a handle in `DEVELOPER_HANDLES`, revoked
by taking it off — within one token's life, with nothing to clear
anywhere, because the grant was never stored.

### D2 — NO SECOND CREDENTIAL, and that is the point

An admin password, a `/v1/broadcast` route, a separate signing key —
each was available and each is **another thing that can leak and another
thing somebody has to remember to revoke**. The one already here is
audited, already signed, and already expires.

The client never asks whether it may. Whether a socket can do this is a
question about a signature and only the relay holds the key, so a check
in `scenes/world.js` would be a second copy of an authority this side
does not hold — wrong the moment a grant lapses or arrives, and
protecting nothing.

### D3 — its own frame type, and no speaker

```
client -> relay:  {t:'say',  text}        shape checked by wire.js, nothing more
relay  -> all:    {t:'red',  text, at}    no id, no name
```

`net/chat.js`'s note beside `system` says why a notice must not be
recognised by a **name**: the relay lets a player call themselves
anything the filter allows, so a notice known by the string *"Server"*
would be one rename away from a player announcing a fake restart.

This is one step stronger. A flag on a chat line would be a **field**,
and a player can put a field on a frame. Its own frame type is something
a player cannot send at all, so the client marks the line from the type
and **there is nothing on it to forge**. It carries no id and no name
because nobody is speaking it — and that makes it a system line by
construction, which keeps every reader that already understands system
lines correct without being told (`bubbleLineOk` would otherwise hang a
chat bubble over the head of a peer whose id is the empty string).

### D4 — rated, and refused in silence

`RED_HZ_MAX` is its own bucket, under `CHAT_HZ_MAX`: a player's line
reaches a room, this reaches **every player in the game**. The grant says
who may speak and the bucket says how often; an authority with no rate is
one careless account away from an outage.

A player who sends `say` is **ignored, not refused**. A refusal would
tell a stranger the frame exists and is worth attacking.

### THE PINS CAUGHT A FEATURE THAT WOULD HAVE SHIPPED DEAD

`RED_HZ_MAX` was first written as **0.5** — "one every two seconds",
which reads perfectly well. `tokenGate` starts a fresh bucket with
`rate` tokens and a pass costs a whole one, so **at any rate below 1 the
first frame is refused and so is every frame after it.** Red text would
have been silently non-functional, in a slice whose entire point is
being able to say something when it matters.

It is 1 now; a pin holds the floor with the reason on it; and the
constraint is written at **`tokenGate`'s own door**, so the next slice
that wants "one every ten seconds" meets it before shipping rather than
after. That needs a different shape — a stamp of the last pass, not a
bucket — and whoever needs one should write that rather than pass a
fraction.

### SHIPPED 2026-09-22

- `src/net/wire.js` — `RED_HZ_MAX`, `redGate`, the `say` frame;
  `RELAY_VERSION` world88 → **world89**.
- `server/src/index.js` — the grant, the bucket, the fan.
- `src/net/online.js` — `sendRed`, `onRed`, gated coming in (CHAT-G).
- `src/net/chat.js` — `red` on a line, and every red line a system line.
- `src/scenes/world.js` — `/red <text>`, parsed and never guarded.
- `src/ui/chatPanel.js` — `.dfchat-line.red`, not an italic aside: the
  system's notices are asides and this is an announcement.
- `test/red1_server_say.test.js` — 9 pins. `tools/mutants/red1.json` —
  12, all dead.

**It rides the ordinary log**, so `ChatLog.peek` draws it over the world
for a player who never opens the panel. A broadcast nobody sees is not
one.

**HOW MAC USES IT:** sign in on an account whose handle is in
`DEVELOPER_HANDLES`, open chat, type `/red <the announcement>`. It
reaches everyone in the world channel — which is the one room every
player is in (ROSTER-G), so it reaches everybody, including players
down a dungeon. Until a handle is written into that config **nobody can
send one, including Mac**.

---

## ACC-CAP — the outage the arc shipped, and why nothing caught it (2026-09-22)

> The account service had a problem. Try again.

Mac, minutes after the merge went live, trying to create the account he
needed in order to send red text. **Every password route on the deployed
service was answering 500** — register, login and recover — and had been
since the moment they first deployed.

### The cause

**Cloudflare Workers refuses PBKDF2 above 100,000 iterations.**

```
NotSupportedError: Pbkdf2 failed: iteration counts above 100000
are not supported
```

It is a DoS guard on their side. ACC1c chose **210,000** — OWASP's figure
for PBKDF2-SHA256 — so every call to `hashPassword` and `verifyPassword`
threw, the router's catch turned it into a logged 500, and the client
showed its `server` sentence.

Guest sign-in was fine throughout, which is the shape that gave it away:
guests are hashed with **SHA-256** and never touch PBKDF2.

### Why every gate was green — and this is the finding

| | sees the cap? |
|---|---|
| `test/accountworker.test.js` (node) | no — node has no cap |
| `tools/accountProbe.mjs` (**real workerd**) | **no — workerd has no cap either** |
| `/v1/health` after deploy | no — it hashes nothing |
| a human registering | **yes, immediately** |

The cap is **production-only**. `wrangler dev`, Miniflare and node all
run higher counts happily.

**AUDIT-ACC F2 built that probe on the lesson that IMPORTABILITY IS NOT
DEPLOYABILITY** — the suite was green over a Worker that could not boot,
because the tests imported the very names workerd rejected. The probe
answered that by standing the service up in a real workerd.

**This is the same lesson one rung further out: LOCAL WORKERD IS NOT
CLOUDFLARE.** A probe in workerd proves the code runs. It does not prove
the platform will *allow* it. And the probe did not merely miss this — it
**measured it and passed**, printing *"PBKDF2 at 210,000 costs 36ms
there"* against a runtime that was never going to enforce the limit.

**A pin was actively holding the broken value.** `accountworker.test.js`
asserted `PBKDF2_ITERS >= 210_000`, *"below OWASP's current figure for
this pairing"*. It now holds the **platform's** bound instead, because a
number the runtime will not execute protects nobody.

### What it costs, said plainly

100,000 is below OWASP's recommendation (600,000 for PBKDF2-SHA256) and
below the 210,000 this arc chose. It is the most Cloudflare will run, so
the honest options were this or a different KDF, and a different KDF is
not a thing to design during an outage.

**It is not stuck here.** The stored form is self-describing
(`pbkdf2-sha256$<iters>$<salt>$<derived>`) and `needsRehash` upgrades a
row on its owner's next correct login — ACC1c built for exactly this. The
work factor can be bought back later by **chaining two capped
derivations**, with nobody logged out. And there was nothing to migrate:
**register had never once succeeded**, so no row was ever written at the
old cost.

### The gate that would have caught it, now standing

`account-deploy.yml` verified `/v1/health`, which proves the Worker is up
and serving this version and **nothing about whether it works**. It now
makes the one request no local runtime can fake: **a real registration
against the deployed Worker on Cloudflare** — a throwaway handle and a
guest row that costs nothing. A 500 there fails the deploy instead of a
player.

- `server-account/src/password.js` — `PBKDF2_CAP`, and `PBKDF2_ITERS`
  set to it, with the whole story at the constant.
- `test/accountworker.test.js` — the pin re-aimed at the platform bound.
- `tools/accountProbe.mjs` — asserts the cap as well as the cost, and
  says out loud that it cannot see the ceiling.
- `.github/workflows/account-deploy.yml` — the registration smoke test.
- `tools/mutants/acc1c.json`, `acctprobe.json` — both anchors re-aimed.

**THE DEPLOY THAT FIXES THIS DROPS NOBODY.** It is `server-account/`
only — the two-Worker split earning its keep on the day after the one
that dropped the whole room.

---

## NAME-ADOPT — the one person who could not see their own name (2026-09-22)

> 1. The top right corner button doesnt update with name
> 2. Ingame your name shows for other people but you still see your
>    character name in the chat menu

The first hour the arc was live, and the first account anybody made.

### One cause, two symptoms — and a third nobody had reported

The account service **issues** a name. The relay takes it out of the
token and shows it to everybody **else**. And this device **never took it
in for itself**:

- **Bug 1.** `register` answers the handle and a recovery code — *not* a
  session. So the session this device keeps was still written with the
  **guest's** name, and the top-right button reads the stored session.
- **Bug 2.** The online session was built from the **character's** name,
  under a comment that said it *"is carried no further"*. It was carried
  further: into the session's own `name`, which the chat roster draws
  **my** row from.
- **Bug 3, unreported.** The same thing on the badge. ACC3c built my own
  roster row from the session, and nothing had ever put a title on the
  session — so the first developer to equip one would have seen it on
  every screen but their own.

So everybody in the room read `Lattymoy`, and the one person who did not
was Lattymoy.

**And the answer was in hand the whole time.** `accountTokenMinter` kept
`answer.data.token` and dropped `name`, `kind`, `title` and `glyphs`
lying right beside it.

### The law

**The issued identity is the service's answer, and this device adopts it
wherever the service states it** — `/v1/account` and every
`/v1/auth/token`. One door writes it back (`adoptIdentity`), and the live
sessions take it in the same breath.

The door **never creates a session** — an answer landing after a sign-out
must not resurrect one — never touches the secret or the id, and writes
nothing when nothing changed, because a mint happens on every connect and
a store write is an event every open tab hears.

A host whose display seam throws **does not cost the hello its token**.
Since ACC1g a tokenless hello is refused, so a bug in how a name is
*drawn* would otherwise be a player who cannot *connect*.

### And the comment that caused it

It read *"fills the frame's shape and is carried no further. ACC1g-b
takes the field off the wire, in this same deploy."* Both halves were
false: the name went into the session, and ACC1g-b never happened —
`wire.js` still requires a name on a hello and the relay still ignores
it. Corrected where it stood rather than left for the next reader to
believe.

- `src/net/accountClient.js` — `adoptIdentity`; the minter adopts and
  calls `onIssued`, still returning the token alone.
- `src/ui/accountFlow.js` — `start()` adopts what `/v1/account` says.
- `src/net/online.js` — `adoptIdentity` on the session, through
  `sanitizeName` and `readBadge`.
- `src/scenes/world.js` — the session starts from the stored issued
  name; every mint corrects the presence session and every chat link.
- `test/nameadopt.test.js` — 7 pins, **each bug reproduced before it is
  shown fixed**. `tools/mutants/nameadopt.json` — 11, all dead.

**Client-only — no relay change, no account-service change.** It ships
with the site build and drops nobody.

## ACC4 — registered date and time played on the profile card (2026-09-22)

> Lets add an account registered date and time played to the icon profile

### The registered date was already a column

`registered_at` has been stamped by `register` since 0002. `accountView`
now carries it as `registeredAt`, **null for a guest** — there is no date
to show, and a 0 would print as 1970. The card draws a `Registered` row
only when there is a date; a guest's `Kind` row already says why not.

### Time played is measured by the service's clock, never the client's

The obvious build is a counter in the tab that posts *"I played 300
seconds"*. That is a number the client **asserts**, and ACC1g and ACC3
settled what this project does with a client's word about itself.

So a tab in the world sends a **beat with no number in it** every
`PLAY_BEAT_S` (five minutes) while the page is visible
(`src/net/playClock.js`). The service credits the gap from the account's
last beat **by its own clock**, capped at `PLAY_GRACE_S` (two beats,
derived). A gap wider than that is a new sitting and credits nothing —
the tab was closed, the machine slept, the page sat hidden.

- **A forged beat cannot credit more than real time.** The route never
  reads the body.
- **Two tabs, or two devices, count the wall clock once.** Each beat
  measures from whichever beat really landed last. That is why
  `creditPlay` is **one `UPDATE … RETURNING`**, not read-then-write: two
  beats in flight together would both read the same last beat and both
  add it. The pin drives exactly that race.
- **A late, out-of-order beat credits nothing** and does not drag the
  clock back (`MAX`).
- **The cost, said plainly:** the tail of each sitting — under one beat —
  is not counted, and the first beat of a sitting opens it rather than
  crediting. That is the honest price of never believing a client about
  a duration.
- **Guest time counts.** Registering upgrades the same row, so every
  minute a guest played is kept.
- **Every existing row starts at zero.** Nothing counted time before
  0005, so there is no history to derive from, and a backfill would be a
  guess written down as a fact.

The world host starts the clock once per page (bootWorld runs once),
online or not — a signed-in player in a single-player world is still
playing. The session is read at each beat, so signing in mid-sitting
counts from the next knock. An `auth` answer to a beat is **left alone**:
forgetting a dead session is the minter's and the card's job, each of
which can say so on screen.

### And a hole found on the way

`account-deploy.yml` fires on a path filter, and that filter named
`src/net/identityToken.js` as the one file outside `server-account/` the
Worker bundles. It bundles **six**: the handle shape, the name filter,
the wire, mat4 and the name tables as well. A change to any of those five
shipped nowhere. The filter now lists all of them plus `playClock.js`,
and `test/accountdeploy.test.js` **walks the Worker's import graph** and
holds the filter to it, instead of naming one file. The walk moved from
`relayversion.test.js` into `test/importGraph.mjs` so both Workers are
read by the same law; the relay's hash is unchanged.

- `server-account/migrations/0005_played.sql` — `played_s`, `played_at`.
- `server-account/src/accounts.js` — `creditPlay`; `accountView` gains
  `registeredAt` and `playedS`.
- `server-account/src/index.js`, `service.js` — `POST
  /v1/account/played`; `ACCOUNT_VERSION` `acct4` (and wrangler.toml).
- `src/net/playClock.js` — `PLAY_BEAT_S`, `PLAY_GRACE_S`,
  `startPlayClock`.
- `src/net/accountClient.js` — `beatPlay`, `accountPlayBeat`.
- `src/scenes/world.js` — the clock starts, gated on visibility.
- `src/ui/enhancedAccount.js` — `registeredText`, `playedText`, the two
  rows. It still styles nothing.
- `.github/workflows/account-deploy.yml` — the filter; the smoke step
  now beats a throwaway guest on real D1 and requires `playedS: 0`,
  because `RETURNING` and numbered parameters are exactly the class of
  thing node runs and a platform might not.
- `test/acc4played.test.js` — 13 pins. `tools/mutants/acc4.json` — 15,
  all dead.

**Account service + site only.** The relay's bundle is untouched, so the
relay deploy is a no-op and **drops nobody**.

## MOD1 — the moderator shield, /mute and /unmute (2026-09-22)

> Next up I want a moderator glyph and moderator chat commands

Asked which: **/mute and /unmute**, and the **blue shield**.

### Who is a moderator

`MODERATOR_HANDLES` in the service's config — the same law as
`DEVELOPER_HANDLES`: a reviewed, deployed edit grants it, taking the
handle off revokes it on the next token and the next call, and nothing is
stored. **Asynian** is the first (Mac: "Username is Asynian"). A developer may moderate
without being listed (`canModerate`), but the **shield** is the
moderator list's alone — the dev mark already says more. A guest can be
neither: the list names people, and a guest row is a device.

### Where the authority lives — and where it does not

A mute is an authority, and the build that passes a naive test is the one
where a client says *"I am a moderator, mute Bob"* and something believes
it. So:

- **The service decides.** `POST /v1/mod/mute {target, minutes}` checks
  the caller against the lists, **refuses a moderator or developer as a
  target** (a mod-on-mod fight is Mac's to settle) and a self-mute, bounds
  it at a week (`MUTE_MAX_MIN`, one home in `src/net/moderation.js`), and
  writes `muted_until` — ACC0's own column — with **`muted_by`**
  (migration 0006), so the power leaves a record.
- **The row is the truth, and every later token carries it** as the `mu`
  claim. A reconnect cannot shed a mute; every room reads it at the hello.
- **Live rooms hear it through a signed ORDER.** The relay cannot read
  D1, so the service also signs `{o:'mute', s, mu}` — a minute-long token
  of a **different shape** from an identity. One key signs both, and the
  shapes keep them apart: an identity needs an issuable `n`, an order must
  carry none. The moderator's client carries the order into every room it
  holds; **the relay checks the signature and never asks who carried it.**
- **The newest order wins.** A replayed mute inside its minute cannot undo
  the unmute that followed it, and a hello whose token predates the room's
  newest order takes the order's word — so a token minted a moment before
  the mute cannot carry its holder past it.

A muted player's line goes nowhere — not even back to them — and they
alone are told `{t:'muted', until}`. They still read chat.

### A name is not an account

Two guests can share a generated name. So chat lines and a channel's
roster carry **`sub`**, the sender's verified account from their token
(not `acct`: that word is the social hub's own id, a different law). The
command resolves a typed name against the players the relay has named,
and **two matches is a refusal, never a guess**. A name may have a space
in it — every guest's does — so the minutes are the last word.

### What it costs

**A relay deploy — `world90` — which drops every connected player once.**
The token module and the wire are in the relay's bundle. The account
service deploys beside it and drops nobody.

**Honestly bounded:** a player muted while standing in a place room the
moderator is not in is muted there on their next connection to it (every
room change is one), not instantly; the world channel — where everyone is
— hears it at once.

- `src/net/identityToken.js` — `mod` glyph, `mu` claim, `ORDER_KINDS`,
  `mintOrder` / `verifyOrder` / `orderValid`, one shared verify ladder.
- `server-account/` — `canModerate`, `isModerator`, `muteAccount`,
  `/v1/mod/mute`, `acct5`, migration 0006, `MODERATOR_HANDLES`.
- `server/src/index.js` — `sub` and `mu` on the attachment, the muted
  refusal, the `mute` arm, `_orders`, `_loadKey`.
- `src/net/wire.js` — the frames, `MUTE_HZ_MAX`, `subOf`,
  `mutedUntilOf`. `src/net/online.js` — `sub` on peers and lines,
  `onMuted`, `sendMuteOrder`.
- `src/net/moderation.js` — the commands, the lookup, the words.
- `src/ui/playerBadge.js`, `enhancedAccount.js` — the blue shield.
- `test/mod1.test.js` — 15 pins. `tools/mutants/mod1.json` — 20, all dead.

## MAIL1 — letters, kept for a player who is away (2026-09-23)

Addison Knox, on Discord: "An in-game mail system where players can send messages to offline players". The full
record is `06-Systems/Community-Arc.md` (MAIL1). This is the service's part of it.

- `server-account/src/letters.js` provides `sendLetter`, `inboxOf`, `readLetter` and `deleteLetter`. Letters go
  between registered players only, and the function refuses a guest itself (`mail-needs-account`) as well as behind the
  route's wall. It also refuses a muted sender (`muted`, 403), an unknown handle (`no-reader`, 404), oneself
  (`to-self`), and an hour's letters to anyone or to one reader (`mail-rate`, 429, spent before the lookup). A full
  box (`inbox-full`, 409) is bounded inside the INSERT, so the check and the write are one statement.
- `/v1/mail/inbox` (GET), `/v1/mail/send`, `/v1/mail/read` and `/v1/mail/delete` (POST, the letter's id in the body,
  never the path) all sit behind a session; none is open. The service is `acct6`, and migration 0007 adds `letters`:
  `to_id` cascades, while `from_id` and `from_name` are what was sent.
- `src/net/letterLaw.js` is the letter's law for both ends. The worker bundles it, so it is in the deploy's paths.
- `src/net/accountClient.js`'s one table has a sentence for every new word, since ACC1e's walk reads letterLaw.js too.

## TITLE-N and TITLE-R — the Dungeon Master, the Patreon tiers, and a roster of glyphs (2026-09-24)

Mac: "Titles shouldnt show in the online panel. Only gyphs. Titles should remain over names and within chat itself.
Remove the founder title from being obtained. Current users keep their founder title", and "Add 4 new titles/glyphs -
Dungeon Master is an orange title with its own glyph. This title allows the user to use the /dm to message chat with
orange text (similar to /red). This goes strictly to the account SquidKamer. Disciple, Apostle, Hierophant are new
patreon titles. These also recieve their own unique glyphs. The account Dutchess will recieve the Disciple title/glyph".

- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): the titles are `dungeonmaster`, `disciple`,
  `apostle` and `hierophant`, and the glyphs are `dm`, `disciple`, `apostle` and `hierophant`. Each title carries its
  own glyph. `src/ui/playerBadge.js` gives each title its word and colour: the Dungeon Master is orange (#ff8c1a), and
  the tiers are teal, violet and rose, since Mac named no colours for them. Each glyph takes its title's colour, and
  has its own shape (a d20, a flame, an open book, a crown) and a classic mark. `src/ui/enhancedAccount.js` names each
  one on the card.
- **The grants** (`server-account/src/titles.js`, `TIER_LISTS`): each title is a handle list in `wrangler.toml`, which
  is the developers' own law. `DUNGEON_MASTER_HANDLES = "SquidKamer"` and `DISCIPLE_HANDLES = "Dutchess,Satranath,Skibbster"` (Mac added Satranath the same day, and Skibbster after it: "Skibbster needs to be a disciple ingame"); `APOSTLE_HANDLES = "SirMcMobdon"`
  (2026-09-25, Mac: "Add SirMcMobdon as an Apostle ingame title/glyph"), and Hierophant is empty. A list grants its title and its glyph, and never to a guest. A lapsed Patreon tier is a
  handle taken off the list, and it disappears from that player's next token. The service is `acct7`.
- **/dm** is RED1's law, one glyph over. The client sends `{t:'narrate', text}` on the World link, and only from a
  world104 relay (`DM_RELAY_MIN`, since an older one closes the socket on the frame).
  - The relay accepts it only from a socket whose signed token carried `dm`. A developer, a player or a typed glyph is
    ignored in silence.
  - It is metered on its own bucket (`DM_HZ_MAX`) and fanned as `{t:'dm', text, at}`, with no speaker.
  - The client gates it coming in and keeps it as a system line on every tab, drawn in the title's orange.
  - The host parses it before /red and never guards it.
- **The roster** (the chat's online column) shows glyphs only. The title stays over the name (`ui/nameLayer.js`,
  `net/remotePlayers.js`) and on a chat line (`badgeNodes`).
- **Founder** is closed. It was already derived from `registered_at <= FOUNDER_UNTIL` (2026-09-23T00:00Z), so no
  account registered since then could obtain it, and every account that holds it keeps it, both held and worn. A pin
  now holds both halves.
- **FOUNDER2 (2026-09-24, Mac: "I want to grant all current accounts the founder title if they dont have it
  already").** The same derived grant, asked again at a later moment: `FOUNDER_UNTIL` moves to the end of the day it
  was asked, 2026-09-25T00:00Z, so every account registered since TITLE-R closed it holds Founder too - no row is
  written, as ACC3 designed - and past the new cutoff the title is closed again. Guests still hold none. The account
  service is `acct9` (acct8 on its branch; DUEL1 took acct8 first), and it takes effect on that deploy. `test/founder2.test.js`, `tools/mutants/founder2.json`
  (2 dead); TITLE-R's and ACC3's pins read the new date.
- `test/titlen.test.js` has 8 pins. `tools/mutants/titlen.json` has 17 mutants, all dead. The relay is world104.

## DUEL1 — the duelling record (2026-09-24)

Mac: "Add a dueling K/D to the profile menu and player inspect profile", kept per account. The full record is
`06-Systems/Community-Arc.md` (DUEL1). This is the service's part of it.

- **Whose word it is.** The LOSER's. A duel is fought between two clients over the relay; the side whose health a duel
  blow took to the floor, or who yielded, reports the loss from its own signed-in client, naming the winner by the
  account the relay stamped on the winner's frames (`sub`, off the identity token - never a client's own word). So the
  service is told a loss by the account that took it and never a win by the account that claims one; the most a lying
  client can do is hand somebody else wins at the cost of its own losses.
- **One statement is the write.** Migration 0008 adds `duel_results` (loser, winner, at - both ends cascade) and no
  counter columns: an account's wins are the rows naming it the winner and its losses the rows naming it the loser.
  `server-account/src/accounts.js reportDuelLoss` is ONE INSERT that lands only when the winner exists, the loser's last
  report is DUEL_REPORT_GAP_S (15 s) behind, and the pair has fewer than DUEL_PAIR_DAY_MAX (10) results in the last day -
  all measured inside the statement, so two tabs cannot both slip under a bound. A refused report is `recorded: false`,
  not an error (the duel was fought; it does not count again). A self-duel is `self` (400), a winner who is no account
  `no-player` (404).
- **The routes.** `POST /v1/duel/loss { winner }` (the session is the loser, whatever the body says) and `POST
  /v1/duel/record { id }` (any account's two counts, the id in the body), both behind a session; `GET /v1/account`
  carries the caller's own as `account.duels`. The service is `acct8`.
- **The client** (`src/net/accountClient.js accountDuels`): the loss and the ask go only with a stored session, the
  bearer in the header. `src/net/duelRecord.js` says a record ("3 won, 1 lost (K/D 3.00)"; no losses reads the wins)
  and keeps the Inspect card's reads a minute. The main menu's account card has a Duels row.

## DEV2 — two more developers (2026-09-24)

Mac: "Give trashBattery, LostMyLeg the developer title/glyph".

- `server-account/wrangler.toml` now reads `DEVELOPER_HANDLES = "Lattymoy,trashBattery,LostMyLeg"`. The list is
  case-folded (`titles.js handleList`), so either spelling of a handle matches.
- The list grants the whole developer set, not the badge alone: the Developer title (held, and wearable), the red `dev`
  glyph, RED1's /red (the relay reads the glyph off the signed token), MOD1's /mute and /unmute (`canModerate` is a
  moderator OR a developer), and protection from being muted.
- It reaches each player on their next token, after the account worker deploys. Nothing else changes, and no
  migration runs.
- Pinned in `test/titlen.test.js`: the list's value, and that both handles hold the title and the glyph in any case.

## AUDIT DUEL1 — the record, between registered accounts (2026-09-24)

The audit found that any session could post a loss naming any account the winner, and guests are free to make:
five guests gave one account fifty wins in a quarter of an hour, with no duel.

- `reportDuelLoss` (`server-account/src/accounts.js`) now counts a duel only when the loser's session and the winner's
  row both have a handle. A guest's report, or a report naming a guest, answers `{ recorded: false, why: 'guest' }`.
- One winner counts at most `DUEL_WINNER_DAY_MAX` (20) results a rolling day, from anyone, inside the same INSERT;
  migration 0008's winner index is `(winner, at)` for it (0008 is unreleased, so it is edited in place).
- A DOUBLE KNOCKOUT is a draw: a report whose winner reported a loss to this loser within `DUEL_MUTUAL_S` (4 s)
  removes that row and counts nothing (`why: 'draw'`). The DELETE is keyed on the caller as the WINNER, so a report can
  only ever remove a win of its own.
- A refused report says which bound: `why` is 'guest', 'draw', 'gap', 'pair' or 'winner', and the client's line says
  it (`net/duelRecord.js duelUncountedText`; a draw says nothing more, the duel said it).
- Pinned in `test/duel_record.test.js` over the real migrations; `tools/mutants/auditduel1.json` A1/B5.

## PROFILE1 — the profile mark is a portrait (2026-09-25)

Mac: *"I kinda wanna make the menu profile icon more relevant, more like
a profile icon less like a button"*. Asked what its picture should be
(your worn skin, the last character's face, or the title glyph as a
crest), he chose **the last character's face**.

ACC1f drew the door's top-right mark as a bordered box holding a gem and
a word. In the corner of a menu of buttons it read as one more button.

- **A portrait** (`ui/profileBadge.js`, called by `enhancedMenu.js`
  `profileMark`):
  - a round well rimmed in brass over the iron ring;
  - the face drawn at its own pixels (the save tiles' law);
  - no panel and no box around it.
- **The face** is the most recent FINISHED character's (`portraitSave`),
  drawn through TILE1's `loadFace`, the save tiles' one home:
  - it skips a save still in chargen, which has no face chosen yet;
  - it skips a save from before S3c/U9, which stored no race.
    `loadFace` would draw a Breton default for it, a stranger's face.
  - it asks for a COPY, because the Continue pane's tile may draw the
    same face on the same screen.
- **Never traps:**
  - the face is a promise, and the portrait is on screen before it lands;
  - a hooded silhouette stands in until then;
  - the silhouette stays for good with no character yet, no game data,
    or a face that would not draw.
- **The gem stays**, as a jewel on the rim: filled with a session, hollow
  without. This keeps ACC1f's at-a-glance "am I signed in".
- **The caption** sits beside the portrait:
  - the account's name, or "Sign in";
  - under it, whose face it is ("Mithriil · level 5"), or "No character
    yet".
  - On a phone the caption goes and the portrait (48px) keeps the target.
- The window it opens is unchanged.

Pinned in `test/profile1_badge.test.js` (4):
- the pick;
- the face replacing the silhouette;
- the signed-out, null-face and refused-face arms;
- the frame's cascade and the door's read.

`test/nameadopt.test.js`'s pin on the mark reading the store is re-aimed
at the session the door hands the badge. Mutants:
`tools/mutants/profile1.json`, 13, all dead.

## PROFILE2 — the profile on the pause menu, and a change that reaches the room (2026-09-25)

Mac: *"Go ahead and make the profile icon visible somehow on the pause
menu and allow changes"*.

**The mark over the game** (`ui/enhancedMenu.js` renderHome's pause
branch):
- The pause screen wears PROFILE1's portrait top-right, a size smaller
  (48px, `.px-over .px-profile`) so it stands above the pause window.
- It shows the character being PLAYED (`liveCharacter(playerEntity)`,
  `ui/profileBadge.js`), not the newest save. Paused, the newest save may
  be another character's.
- A press opens the same window the door opens: the account card and the
  Skin card, centred over the pause window (no wordmark to sit under).
- The window is innermost:
  - a tap outside it closes it and leaves the pause window standing (its
    own `closeOnOutsideTap`, `.px-acctwin`);
  - Escape closes it first, through the one back stack;
  - otherwise the scrim resumes as before, with the mark counted inside.
- It is a visit's: `mountEnhancedMenu` closes it, so a window left open on
  the door does not stand over the next pause.
- The classic (canvas) pause window is DFU's OPTN00I0 panel and is not
  changed.

**The change reaches your own body at once.** The Skin card writes the
mod's store, which the body re-reads. A changed set is now fetched whole
(`player/eotbBody.js` reload -> `preload`), as the mod's LoadSettings ->
Initialize -> InitializeTextures does. Before, each new frame was fetched
when first drawn and its slot drew the old set's frame meanwhile, so a
skin changed mid-walk showed two people for a second.

**The change reaches the room.** This was the real gap. A look rode the
HELLO alone (`net/online.js` `_member` already said so), so a skin chosen
mid-session stayed on this screen and nobody else's until the next room.
- **The `look` frame** (`net/wire.js`):
  - it is the hello's look without the hello: after a hello only, through
    `validLook`;
  - per socket it is gated at `LOOK_HZ_MAX` (0.5 a second, one whole
    token);
  - clients send it only to a relay at `LOOK_RELAY_MIN` (world109) or
    later, since an older relay closes the socket on an unknown frame.
- **The relay** (`server/src/index.js`, the look arm):
  - stores the look where the hello did, so a later welcome's roster and a
    `who` answer say the new one;
  - fans the hello's JOIN to everyone else in the room, which every
    client already reads as "this peer's look is now this" (`_refresh`);
  - sends no pose with it, because the join goes to the whole room and
    the pose fan is the ranged one;
  - skips channels, which keep no look;
  - spends the room's hello budget, since the fan is a hello's fan. Past
    that budget the socket is refused busy, as a hello is, and its
    reconnect's hello carries the look.
- **The session** (`OnlineSession.setLook`):
  - keeps the new look, so every later hello carries it;
  - sends it down every socket already hello'd that knows the frame: the
    primary and each open halo (`h.lookOk`, from the halo's own welcome);
  - holds it while the gate is shut and flushes it on the tick, sending
    the LATEST, so trying skin after skin sends one frame;
  - with nothing open, owes nothing.
- **The host** (`scenes/world.js`):
  - hands the session `composeLook(playerEntity)` once a second
    (`ONLINE_LOOK_CHECK_MS`);
  - also hands it at every join and halo it opens. Those two sites used to
    write `online.look` directly, which told no socket already open,
    including a halo a crossing promotes (it sends no hello of its own).
  - A coat put on reaches the room the same way.
- RELAY_VERSION stays world109 (SKIN2's deploy, not yet shipped); its law
  row is re-hashed.

Pinned in `test/profile2_pause_profile.test.js` (9):
- the live character;
- the pause face's wiring and cascade;
- the wire door;
- the relay's store, fan, meter, busy refusal and channel;
- the session's primary, halo, gate, latest-wins and old relay;
- a session drawing the new look through the real relay;
- the hosts.

`test/outsideTap.test.js` names the third scrim;
`test/profile1_badge.test.js` reads the door's paused arm. Mutants:
`tools/mutants/profile2.json`, 22, all dead. Not verified in a browser
(no probes).

## WB5b — the gates closed (2026-09-25)

Mac: "a gate of oblivion which takes place in a large boss arena with an oversized enemy", and Option B - the relay's
object is the authority over the boss and signs a receipt for each account that earned the kill. The full design is
`11-Multiplayer/World-Bosses.md` (sections 6 and 7). This is the service's part of it.

- **Whose word it is.** The RELAY's - the one party that saw the kill. The relay signs with its own key
  (`GATE_SIGNING_KEY`, a relay secret); this service holds only the public half (`GATE_PUBLIC_KEY`, a var in
  `server-account/wrangler.toml`, because a public key verifies and cannot sign) and verifies every receipt with it -
  the version, the signature, the claims, the week (`src/net/gateReceipt.js verifyReceipt`). The identity pair runs the
  other way (this service signs, the relay verifies), and neither can pass for the other.
- **One statement is the write.** Migration 0014 (0009 on its branch - RENOWN1 took 0009 first) adds `gate_kills` (day, account, boss, earned, at), primary key
  (day, account), cascading with the account, no counter column. `claimGate` is one `INSERT OR IGNORE`: a second
  claim of the same day's kill lands nothing and is answered `recorded: false, why: 'claimed'`. The receipt must name the
  session's account (`not-yours`, 403); a receipt the relay did not sign is `receipt` (400); no public half is
  `no-gate-key` (503). A guest is answered `guest` and not counted - AUDIT DUEL1 A1's law - and counts once it registers
  under the same id.
- **The routes.** `POST /v1/gate/claim { receipt }` behind a session; `GET /v1/account` carries `account.gates` and
  `POST /v1/duel/record` answers `gates` beside the duels. The service is `acct11` (`acct10` on its branch - RENOWN1, HOME1, DECOR1 and GUILD1 took `acct10` first).
- **The client** (`src/net/accountClient.js accountGates`, `src/net/gateClaims.js`): no session, no knock; the device
  keeps each receipt until an answer settles it. The account card has a *Gates closed* row; the Inspect card a line.
- **The keys.** `node tools/mintGateKeys.mjs` mints the pair in one run and writes nothing to disk. GATE-KEYS
  (2026-09-26): the account deploy runs it, once - `.github/workflows/account-deploy.yml`, "Mint the gate receipt pair":
  when either Worker lacks its half, one pair is minted and put as two Worker secrets, `GATE_SIGNING_KEY` on the relay
  and `GATE_PUBLIC_KEY` here (a secret, never a var: every deploy rewrites a var, and Cloudflare refuses a secret the
  name of a bound one). The run that mints redeploys the relay and drops every connected player once. A later step
  proves the service holds its half (a claim with an unsigned receipt answers 400 `receipt`, never 503). Before it the
  pair was left to a person, nobody minted it, and every receipt went out unsigned and was dropped.

## RENOWN1 — Renown, the level that exists only online (2026-09-24)

**Since RENOWN-ACCOUNT (2026-09-28, below), every source pays three quarters. RENOWN-ACCOUNT also made Renown the
ACCOUNT's for a day; RENOWN-CHAR (2026-09-29, below) made it each character's again.** What follows is RENOWN1 as it was
built.

Mac, bringing a friend's MMORPG pillars ("The Hybrid Leveling System ... a traditional EverQuest-style Adventuring
Level ... which dictates total health, magicka"): "What if the leveling system was something seperate unique to online
but compatible". Asked three things, Mac answered: the online health and magicka go "On top" of Daggerfall's, the curve
is a long "Grind", and offline play earns "No" XP - "Plus having their level appear on the left side of character name
and profile main menu + ingame profile". Built as the Adventuring Level, then named: "Lets officially call this
Renown" - every name in the code, on the wire and on screen says Renown now. A character's Renown is a level: "Renown
12" in words, and beside a name the number alone in a box, left of the name where it always stood (Mac: "Just have it
read 12 inside a box").

- **What it is.** A second level PER CHARACTER that exists only online. The Daggerfall character - its level, skills,
  health, magicka and the save file - is untouched offline and online, so a character goes back and forth freely. The
  track is kept by the account service under the id the character's own save carries (`systems/characterId.js`, the
  id the cloud saves are filed under), never in the save.
- **The curve** (`src/net/renown.js`, which both ends import). EverQuest's shape in integer arithmetic, so the service,
  the relay and every browser agree on every boundary: the total to reach level L is
  `10 * floor((n^3 * (n + 10) + 300n) / 30)` with n = L - 1. Level 2 at 100, 10 at 5,510, 20 at 68,200, 30 at 319,950,
  50 (the cap) at 2,318,660 - the first levels in minutes, level 50 in hundreds of hours.
- **What earns it, online only.** A foe is worth ten to its own level (clamped 1..30); a quest that ends in success is
  worth 100 + 40 a Daggerfall level (clamped at 30), once per quest - both read no higher than three levels above the
  character's Renown since RENOWN3. A party earns MORE a head, never a share: every
  partymate in the room earns the whole kill plus 10% a head beyond the first, up to the party's eight seats (the
  pillar's "Group play is the prime source"). The city watch and townspeople pay nothing - a kill the law calls murder
  earns nothing - and since AUDIT RENOWN1 neither does another player's watch, my own summoned ally, or a quest's
  scripted kill.
- **A foe you fought** (`src/net/renownTracker.js`). A foe pays every player who struck it in the last 30 s
  (`RENOWN_ASSIST_MS`) when it dies, whoever struck the last blow. One rule for every door a kill comes through, because the
  doors do not agree on who killed what: a dungeon's host never tells a joiner whose blow was last, so "the killing
  blow" would have paid no joiner anything in the one place parties fight most. Both foe pools stamp the player's own
  blows (`exteriorFoes.js`/`dungeonContext.js` `damageFoe`, before a puppet's divert) and every death asks - the
  local death arm, an outdoor copy's `puppetDie`, a dungeon joiner's stream death. The stamps live in a WeakMap, never
  on a foe record, so nothing streams or saves them.
- **Whose word it is.** XP is the client's word - there is no clock that could measure a kill - so the SERVICE holds
  the bounds (`server-account/src/renownTracks.js reportRenownXp`): a report carries 1..5,000, an ACCOUNT earns at most
  20,000 a clock hour across all its characters (a second character is not a second allowance), and an account keeps
  at most 60 tracks. The hour is spent by ONE `UPDATE ... RETURNING` that also writes what it credited
  (`renown_last_credit`), so two reports in flight never spend the same remainder (ACC4's `creditPlay` law). A report
  the hour spent is credited 0 and answered, never refused; a track at the cap spends none of the hour. The honest
  cost, said plainly: a modified client can report XP it did not earn, up to the hourly bound - about five days of
  doing nothing else to reach the cap (true since AUDIT RENOWN1, which made the hour's window move only forward and
  the whole report one transaction).
- **The level is the service's.** It is never a column - derived from the total wherever it is read - and it rides
  the identity token: `/v1/auth/token { character }` signs that character's level in as `lv` (1 before it earns
  anything; none when the mint names no character, as every older build's does). The relay stamps it beside the
  title and glyphs (`net/wire.js badged`) on every welcome row, join and roster, so nobody's level over their head is
  their own word. A level that RISES mid-session comes back from `/v1/renown/xp` with a signed RENOWN ORDER
  (`mintRenownOrder`, `{o:'renown', s, lv}`); the client carries it into every room it is in (`{t:'renown', order}`,
  world108), and the relay takes it only from a socket whose verified account it names and fans `{t:'renown', id, lv}`.
  The one thing the client chooses is WHICH of its own characters it names at the mint - the relay cannot see which
  character is being played, so a player with two characters could show the other's level. `verifyOrder` now asks for
  an order's KIND by name: a player's own renown order carried to the mute arm would otherwise have verified and read as
  `mu` undefined - an unmute.
- **"On top" of Daggerfall's** (`src/systems/renownLayer.js`). The level adds 3 health and 2 magicka a level past the
  first (level 50: +147 and +98), as two plain entity fields the live maximums read over everything they already sum
  (`systems/chargen.js` `defineLiveMaxHealth`/`defineLiveMaxMagicka`) - so every heal, rest, bar and clamp reads the
  online value, a Daggerfall level-up adds to the stored health and never to the layer, the lycanthrope's limiter caps
  Daggerfall's own maximum with the layer above it (AUDIT RENOWN1 GAME-4 - it capped the whole, and took the layer
  away), and a magery that makes the character unable still leaves 0. Current health and magicka keep their
  FRACTION as the layer goes on or rises. A save written online keeps the vitals as they would stand without the layer,
  each at its fraction (`save.js snapshotPlayer` through `offlineVitals`); neither field is on the save's whitelist.
  The layer is only ever put on on the online page, by the level the token or the service answered, and only upward.
- **The level left of the name, the number in a box.** Over a head, "12" in a small square amber box ahead of the
  name in the name row (`ui/nameLayer.js .dfname-renown`, empty and taking no room for a peer with no level), and "[12]"
  leading the bitmap face's run, the one box a bitmap line can draw. The plaque over a player boxes it the same way on
  its title's first line: the namer hands the Renown BESIDE the name (`renown`), the hover frame carries it
  (`systems/worldHover.js`, and the repaint guard signs it) and `ui/worldPlaque.js` draws the box, so it is never text in
  a title. The Inspect card puts the box left of the name with
  "Renown N" on hover (the card's own "Level N" line is still their Daggerfall level); the main menu's
  account card puts the level of the character most recently played online left of the account name and adds a
  Renown row for each of the five most recently played characters, with how far into its level it is ("Mara Venn -
  Renown 10, 490 / 2,150 XP to Renown 11").
  There is no in-game profile of oneself (the Inspect card is only for others), so a rise is said on the HUD: "Your
  Renown is now N."
- **Not in this slice:** gear tiers gated by the level (there is no elite gear yet), elite packs and dungeons, and a
  bar for the XP in the world.
- `server-account/migrations/0009_renown.sql` (`renown_tracks`; the account's hour on `players`), `renownTracks.js`,
  `/v1/renown/xp`, the token's `level`, `account.renown` on `/v1/account`; the service is `acct9`. `src/net/identityToken.js`
  (`RENOWN_MAX`, `lv`, the renown order, `verifyOrder`'s kind), `net/wire.js` (`badged`'s `lv`, `readRenown`, the
  renown frame, world108), `server/src/index.js` (the stamp and the renown arm), `net/online.js` (`renownOf`,
  `sendRenownOrder`), `net/accountClient.js` (the minter names the character; `accountRenown`), `scenes/world.js` (the
  tracker, the layer, the plaque). Pinned: `test/renown1.test.js` (18). `tools/mutants/renown1.json` (40, all dead;
  47 since AUDIT RENOWN1 - the seven its test titles named and the file never had).

## AUDIT RENOWN1 — before anything is built on it (2026-09-25)

Mac: "Lets audit this before we continue to build on it". Five lenses over RENOWN1 and RENOWN2 - security and trust,
the game's hooks, the wire and the session, the data and the numbers, the displays and the records - each finding
reproduced against the real modules (the service over the real migrations, the relay through `test/fakeRoom.mjs`, the
session and tracker driven) before it was fixed. Nothing here changes what Renown is; it makes what RENOWN1 promised
true.

**The service** (`server-account/src/renownTracks.js reportRenownXp`, `accounts.js overRate`):

- **SEC-1/DATA-1 (the worst): the hourly bound could be walked through.** The window was `renown_hour = ?`, and the
  clock is read when a request ARRIVES, before its body - so a report that arrived at 00:59:59 and landed after a
  01:00 report reopened the window that report had just opened, and the next one reopened it again. Driven through the
  real worker with held bodies: 1,500,000 XP in under a minute, Renown 44 against "about five days". Now the window
  only moves FORWARD (`MAX(renown_hour, ?)`), and a report stamped with an hour already past is charged to the window
  that is open - an honest late report still counts. `overRate` had the same equality reset (its `acct:` row stayed at
  1 through 300 requests), and the `login:` and `ip:` doors share that statement, so the limiter moves forward too.
- **DATA-3, DATA-4, DATA-5, DATA-7: one transaction.** The report was five statements committed one by one, with the
  decisions taken from reads made before the writes: fifty new characters at once all fit under the 60-track bound
  (109 tracks); an error between the hour and the track spent the hour for nothing; two reports near the cap were both
  charged in full and both said `rose`; and a report the hour had spent still made an empty track that took one of the
  sixty places for good. Now ONE `db.batch` (D1 runs a batch as one transaction) whose first statement decides
  everything in SQL against the rows as they stand inside it and says what it decided with `RETURNING`.
- **DATA-4/GAME-9: a report's own id.** A report the service took whose answer was lost was sent again and credited
  twice (3,000 earned, 6,000 kept). The client draws an id per report (`rid`, sixteen hex digits) and sends the same
  report under the same id until it is answered; the track keeps the last id it took (`last_rid`, migration 0009,
  unshipped and so changed in place), and a repeat is answered - `repeat: true`, credited nothing, with a signed order
  if the level is past 1, since the lost answer may have been the one with the rise in it.
- **DATA-2: the deploy asks D1.** The report's statements (an `UPDATE ... RETURNING` with subqueries, an
  `INSERT ... SELECT`, a batch) ran only on node:sqlite; `account-deploy.yml` now reports 1 XP to the real D1 and sends
  it again, and a deploy that cannot credit it and answer the repeat fails.

**The relay** (`server/src/index.js`, the renown arm):

- **SEC-2/SEC-3/WIRE-1: only a rise.** Any valid order inside its minute was taken and fanned when it "changed" the
  level, so a player holding two of their own (level 2 and 3) flapped them - ten sockets of one account made a room of
  sixty hear 600 frames a second, with no strike ever counted - and an older order replayed pulled the level shown DOWN.
  Now an order that does not raise the socket's level is answered to its carrier alone (the level the room holds) and
  fans nothing; a renown order in a channel or the hub is nothing at all (no client sends one there, and the world
  channel is two thousand sockets); and the room has its own budget (`RENOWN_ROOM_HZ_MAX`, four a second) - over it a
  rise is dropped unanswered and its carrier sends it again.

**The session and the tracker** (`net/online.js`, `net/renownTracker.js`, `scenes/world.js`):

- **WIRE-2/WIRE-3: a rise reaches every room.** The order was sent once, down the sockets open at that moment, behind
  one gate for the session, and on the LAST relay's word about the frame: two rises inside a second lost the second (the
  room stayed at 9 while the page said 11), a halo still minting its token was skipped and said hello with the old
  level, and a relay a version behind could be sent the frame and close the socket. Now the page keeps the newest order
  for its life (`RENOWN_ORDER_KEEP_MS`), and each socket is its own - sent the order once ITS OWN welcome names a relay
  that knows the frame, on its own gate, and again every `RENOWN_RESEND_MS` until its room answers with the level (the
  echo, or the relay's word that the room already holds it). A level heard on a renown frame only ever rises, mine and a
  peer's.
- **WIRE-2c/UI-5: the order whenever it is signed.** The order and "Your Renown is now N." were gated on the answer's
  level beating the page's - and every socket mints a token, whose level the page adopts, so a token minted between the
  report's commit and its answer swallowed both. `renownAnswer` is now one pure plan: the order carried whenever the
  service signed one, the rise announced against what was SAID, the hour's line never at the cap or for a repeat.
- **GAME-2: a refused report waits.** A report's worth piled up skipped the minute's wait, so against a service having
  a bad minute the same report went every frame, each spending the account's limiter until every token mint on the
  account failed with it. The minute is skipped only after an answer now, and each refusal in a row doubles the wait to
  fifteen minutes (`RENOWN_BACKOFF_MAX_MS`).
- **GAME-8: the page's last word.** The pagehide report was a plain fetch the browser drops with the page; `leave` sends
  the held report through `keepalive` (the one credential door, the header) under its id, and clears nothing, so a page
  the back-forward cache brings back sends it again and is answered a repeat.
- **UI-4:** a refusal that ends reporting (a sixty-first character) is said, where it was dead text.

**The hooks** (`net/renownTracker.js`, `exteriorFoes.js`, `dungeonContext.js`):

- **GAME-1:** another player's city watch, stood here as puppets, paid - a partymate could farm the watch a criminal
  friend kept summoning. The watch never pays, whoever's. **GAME-7:** my own summoned ally (the Sanguine Rose's, the
  Skull of Corruption's clone) turned when struck and then paid; a foe that is my ally when my blow lands never pays.
  **GAME-6:** a quest's `kill foe` (the SetHealth(0) door) was the player's blow - it paid, and woke the area as an
  attack, as it had since before RENOWN1; it is nobody's blow now.
- **GAME-3:** a dungeon joiner builds the layout's class foes at ITS OWN level, so a level-30 joiner earned 300 for the
  host's level-3 knight (the host 30). The host streams a class foe's level (`l`, the exterior stream's field, which
  `validFoeRecord` already bounds) and the joiner's kill is worth it.
- **GAME-10:** a foe stood again as a new record (the Wabbajack's change, a joiner's rebuild as the host's species)
  keeps my blows; a foe that stands up again forgets them and can pay again (it kept `paid` for ever).

**The layer** (`systems/chargen.js`, `lycanthropy.js`, `passiveSpecials.js`, `renownLayer.js`):

- **GAME-4:** the limiter is computed off the raw maximum, and capping raw + layer with it took the whole layer away the
  minute the urge began (a Renown 50 werewolf at 247 of 247 fell to 100 of 100), and the cure's full heal left 100 of
  247. The limiter caps Daggerfall's own maximum and the layer rides above it; the urge's clamp, every full heal and the
  cure read the same ceiling.
- **GAME-5:** the reduced magery's third was taken of the layer too, and the save then took off the whole layer - a save
  at full magicka came back with 2 of 34. The magery reads Daggerfall's own maximum; and a maximum of 0 holds nothing
  (`keepFraction` answered 1).

**The displays** (`ui/enhancedAccount.js`, `enhancedStyle.js`, `profileWindow.js`, `world.js`):

- **UI-1:** the account card's values could not shrink, and the Renown rows ran off both sides of a phone's window (the
  key and the start of the name cut away where nothing could scroll to them); they shrink and wrap now. **UI-6:** a
  capped row read "Renown 50, Renown 50 - the highest"; it says the level once. **UI-10:** the chip names whose Renown
  it is, and the card says what it measures - the character most recently PLAYED online (a report the hour spent still
  marks its character played). **UI-8:** an empty box is never drawn (`:empty` on the card's and the Inspect card's
  box, as the name layer's had). **UI-3:** an open Inspect card follows the level the session knows.

**Tests the audit added where the suite was blind** (UI-2, UI-3, UI-7, UI-9, WIRE-4): the relay's level on the who
answer and a channel's join, and the relay test moved to a place room (it drove the world channel, where no name is
drawn); a re-introduced peer's level; the box over a head across a rise; the bitmap face centred on its whole run; the
answer's plan; and AUDIT ATTACH's closed lists, which never counted the attachment's `lv` or the duel's and the
renown's meters.

**Known, and left as they are:**

- A foe that dies of POISON more than 30 s after the player's last blow pays nothing: a poison round carries no striker,
  and a peer's dose rides into the owner's copy of a foe, so a round cannot be read as mine.
- An account keeps at most 60 tracks and a track is never removed; no track is made any more until a character is
  credited XP, and a sixty-first character is told why it earns nothing.
- Over a head a character with no track yet wears 1 (the mint signs level 1 for a named character); the account card
  shows no chip until a track exists.
- The numbers, stated honestly (DATA-6): the hourly bound never meets a solo character or a small party, but a full
  party of eight against the fiercest foes meets it (510 XP a kill at level 30 with the whole party's bonus, about forty
  kills an hour). And XP follows the level of what was fought - a class foe stands at the character's OWN Daggerfall
  level - so a character that levelled offline climbed ten times faster online: at Daggerfall level 30, Renown 10 was
  19 kills and Renown 20 was 228. Offline play itself still earns nothing. Both were Mac's to tune, not the audit's -
  and Mac answered the second (RENOWN3, below).

**At the merge:** main took `acct9` (FOUNDER2) and `world108` (HT-WAIST-NET) while this was on its branch, so this
deploy is `acct10` and `world109` - the RELAY_VERSION row rewritten with the merged bundle's hash, `RENOWN_RELAY_MIN`
109 - or the deploy's "names this deploy" check would pass on the old Worker.

Pinned: `test/auditrenown1.test.js` (19), and the RENOWN1 pins the fixes moved. `tools/mutants/auditrenown1.json`
(60, all dead - the one survivor of the first run, the tracker's early report after a refusal, killed by a pin added
with RENOWN3); thirteen older records re-aimed by content (twelve in `renown1.json`, one in `disc10.json`).

## RENOWN3 — a foe pays by your Renown (2026-09-25)

Mac, told the audit's number (a character that levelled offline took Renown 10 in 19 kills, ten times a new one's
pace): "Whats the solution to this? Like a high level character shouldnt blow through online levels". Offered a foe
read at most three levels above the character's Renown, Mac said "Yes".

- **The ceiling** (`src/net/renown.js renownCeiling`, `RENOWN_OVER_MAX` 3). A kill and a quest are read no higher than
  three levels above the character's Renown - a Renown the page does not know yet is Renown 1, the strictest. At Renown
  1 a level-30 knight pays like a level-4 foe (40, not 300) and a quest sized to Daggerfall level 30 pays 260, not 1,300;
  the ceiling rises with every level, and from Renown 27 no foe is cut. The party's bonus rides on top, unchanged.
- **Why it answers the question.** Renown was paced by the Daggerfall character, because a career foe stands at the
  character's own level and a quest is sized to it; now it is paced by Renown itself. A character new to Daggerfall
  fights foes at or under the ceiling almost from its first kill and earns what it did (level-5 foes: 111 kills to
  Renown 10 and 1,365 to Renown 20 - one more than before, a level-5 foe being one over the ceiling at Renown 1). A
  Daggerfall level-30 character takes 59 kills to Renown 10 and 398 to Renown 20, where it took 19 and 228 - still
  faster, since a harder fight is worth more up to the ceiling, but not ten times.
- **Where it is read.** On the client, at the kill and at the quest's end, against the page's own Renown
  (`scenes/world.js renownNow` - the token's word and the service's since). XP is the client's word in any case (the
  service bounds it by the report and the hour); the ceiling is the pace an honest client keeps.
- Pinned: `test/renown3.test.js` (2), the RENOWN1 rules and wiring pins it moved. `tools/mutants/renown3.json`.

## RENOWN4 — your Renown on your own HUD, with its bar (2026-09-25)

Mac: "Also why is there no way to view my renown ingame?" - and "Plus XP bar". RENOWN1 put the level in the box
beside every name, on the main menu, the profile and Inspect, and the account card's row said how far the track had
come; the one face that never showed it was the player's own while playing.

- **The row** (`src/ui/hudRenown.js renownHudView`, drawn by `src/ui/enhancedHud.js`). Under the three vitals and as
  wide as them: the box every name wears ("12", in the name's gold), a thin bar to the next level, and "490 / 2,150
  XP" into the level ("Highest" at the cap). Online only - the online lane is the enhanced lane, so the classic HUD
  never needs one - and only once the page knows the level. The bar draws only for a total that is that level's; a
  total a level behind is one the service has moved on from, and the box stands alone until the next word.
- **The fill is the service's, the ghost is the page's.** The fill is what the service has credited. A report goes
  once a minute, so what is earned and not yet answered (the tracker's `pending`) is drawn faint after the fill: a
  kill shows at once, and the report turns it solid. It never pushes the fill, so a report the hour's bound cut short
  takes the ghost back and never the bar; in an hour the page was told is spent, no ghost is drawn at all.
- **Where the total comes from.** The mint's answer carries the named character's track total beside its level
  (`xp`: 0 before it earns; none for a mint naming no character) - beside the token and never in it, since a room
  needs the level alone (the minter signs a fixed claim list). The minter hands it on (`who.xp`), and every report's
  answer carries it through `renownAnswer`'s `xp`. The page (`scenes/world.js renownXpAdopt`) takes it only upward and
  only online, and from a mint before the level, so no frame draws the new level over the old total.
- **The service is acct13** (the mint's answer; acct11, then acct12, on its branch - main's WB5b took acct11 first and BASE-HIDE acct12, so the merges renumbered it; AUDIT MERGE-PLUS E2). A service before it answers no total: the box alone until the page's
  first report is answered.
- Pinned: `test/renown4.test.js` (7). `tools/mutants/renown4.json` (28, all dead; a total signed into the token was
  dropped as equivalent - `mintToken` signs a fixed claim list).

## RENOWN4b — the XP bar overlaps nothing (2026-09-25)

Mac: "ensure the new xp bar doesnt overlap anything"; asked whether to measure the page in a headless browser, "No,
CSS math only". So the check is arithmetic over the sheet's own numbers (`test/renown4b.test.js` - the model, and pins
holding the sheet to every number it reads), and it found two things:

- **The quickslot block stood in the vitals.** Its bottom is fixed at the vitals' top line (22 + 32 x scale, QS3) -
  and the Renown row, under the vitals, lifts that line by its own 22px and the gap. On a 1024px screen at scale 1 (on
  a 1280px one past 1.16, on a phone past about 1.2) the magicka bar stood in the diamond. While the row is lit the
  block now goes up by the same amount (`.hud:has(.hud-renown.on) .hud-quick`: 32 x scale on a desk, 30 on a phone).
- **On a touch screen the row stood in the touch buttons.** The bottom-right from 16 to 64px up is `ui/touch.js`'s
  (jump, sheathe, the mode, the social door). There the row stands ABOVE the vitals and never lower than 68px (a
  margin divided by the scale, so it holds at every scale, with the safe area), and the block rides two pixels above
  it - by a row of effect or need chips more when there are chips.
- **Under Enhanced Plus** the row is as wide as Plus's vitals (16px gaps), and the model runs both dresses.

The model covers 13 widths from 360 to 2560px, HUD scales 0.5 to 2, both dresses, mouse and touch, a phone's safe area,
the touch stick's corner, and a row of chips - 1,820 cases (910 since UI3, which took the chip row off the HUD's foot
for the status widget - test/renown4b.test.js): the row never meets the block or the buttons, never runs
past the vitals' own span, and never pushes the vitals into the block where they stood clear without it. **Found
while doing it and not the row's doing:** on a touch screen the vitals' own strip already reaches into the
touch buttons' rows (the column stands 12px up, the buttons from 16), and chips under the vitals already lift them
into the block wherever the two stand side by side (at scale 1 on a 1024px screen); both stand as they were. Not measured in a browser, by Mac's call.
Pinned: `test/renown4b.test.js` (2); `tools/mutants/renown4b.json` (9, all dead, PLUS-DEFAULT's among them).

## RENOWN-BAR — no numbers on the HUD, the bar on the middle (2026-09-26)

Mac: "with the new renown xp bar, I want to remove the xp amount on the lefthand side and integrate it into the bar
itself, then center the bar properly". The amount stood on the RIGHT and the level's box on the left, so it was asked
which: the amount ("1,453 / 3,460 XP") into the bar, the box kept. Measured first (`tools/renownBarProbe.mjs`, the real
HUD in Chromium): the bar's middle stood 42px left of the vitals' at a level part-way and 57px at the widest numbers -
the box on one side, the wider readout on the other. The first cut drew the numbers in a 16px bar; having seen it, Mac:
"Actually lets just keep the other bar and remove the xp. Just have it visible in the player profile".

- **No numbers on the HUD** (`src/ui/enhancedHud.js`, `src/ui/hudRenown.js`): the row is the box and RENOWN4's thin 8px
  bar - the fill and the ghost - and nothing else; `renownHudView` answers no words.
- **The numbers are the profile menu's** - the account card the pause screen's portrait opens, where the duels and the
  gates closed are (`src/ui/enhancedAccount.js`): its Renown row already said them for each of the five characters most
  recently played ("Mara Venn - Renown 10, 490 / 2,150 XP to Renown 11", `net/renown.js renownProgressText`; RENOWN1),
  so nothing there changed; `test/renownbar.test.js` now holds the row to its numbers.
- **The bar is on the middle** (`src/ui/enhancedStyle.js`): the row lit is a grid of three columns - the box (36px, its
  own width: 1.6em of 13px, 5px of padding and a 2px frame a side), the bar, and an empty column as wide as the box - so
  the bar's middle is the row's, and the row is as wide as the vitals' and centred under them. Its 22px height is
  RENOWN4b's, so the lifts and their model stand unchanged.
- **Measured after**, over the real faces: the bar's middle 0.0px off the vitals' at 1440 and 1024px, on a 390px phone
  and a phone on its side; no words in the row; the bar 8px. 128 checks, 20 shots. **Seen while doing it and not this
  row's:** on a 390px phone the vitals' own labels already run into their percentages ("MAGICKA" into "70%").
- Pinned: `test/renownbar.test.js` (3); `tools/mutants/renownbar.json` (6, all dead). RENOWN4's pins re-aimed at a row
  with no words (and the cap held with nothing pending, where the words had been the only thing telling a 0 / 0 ghost);
  its words' mutant retired with the words, the cap's and the row's re-aimed (renown4 + renown4b: 37, all dead).
- **UI3 (2026-09-27) put the numbers back IN the bar** (Mac, the Plus UI pass: the effects to a widget of their own,
  "which then gives more space for the XP bar and being able to fit the XP amounts inside"). With the status row gone
  from under it (the effects are the status widget's tiles now, at the left edge), the bar is the vitals' own 20px and
  says the level's credit over its span inside it ("5,420 / 13,800 XP"; "Highest" at the cap; `renownHudView`'s
  `text`); the three columns, the 22px row and the profile's numbers stand. The phone's vitals, seen here, now say
  their numbers alone. `10-UI/Slots-Hotbar-Status.md` UI3; `tools/renownBarProbe.mjs` re-aimed (160 checks, 0.0px off).

## GUILD1c — a guild on the token (2026-09-25, acct13)

Mac: "Do guild1c" - the guild tag beside names, and the guild's chat (`06-Systems/Online-Arc.md` GUILD1c). The token grows
three OPTIONAL claims, all three or none (`net/identityToken.js` guildClaimsValid): `gi` the guild's id, `gt` its tag,
`gm` the character's member row - each a string of the guild law's own shape (`net/guildLaw.js`, which joins the relay's
bundle; it imports nothing). The mint reads them off the roster for the character the client named, as it reads the
Renown level, and answers the tag beside the level - for a mint that asks (`guild: true`; AUDIT MERGE-PLUS A6: a build
from before GUILD1c names its character too, and knows no guild channel); a character in none, and a mint naming none,
carry none. Two ORDER
kinds join `mute` and `renown`, each carrying its own fields and no other's: `guild` (the carrier's character's guild now,
or none) and `guildout` (a member row, or a guild whole, gone). Every guild act that moves a membership answers the order
that says so, signed in place of what it says (`guildOrdersOf`); a service with no key still acts and answers null.
Pinned: `test/guild1c.test.js`; `tools/mutants/guild1c.json`.

## BASE-HIDE — what an online home's owner took out of the room (2026-09-26)

Mac: *"Remove bought houses decor - the base game decor isnt easy to decorate around when u want more in depth
house"*. The room's own furniture - Daggerfall's prop models and flats - may be taken out by its owner and put back,
free (`01-Overview/Field-Bugs-2026-09-26.md` BASE-HIDE). An online home's list of what is out lives here, so every
visitor walks into the room its owner cleared.

- **One row a home.** Migration 0015 adds `home_hidden` (map_id, building_key, keys), the home its primary key,
  cascading with `homes` - a home released takes the list with it, and the next owner walks into the room as
  Daggerfall furnished it. `keys` is a JSON array of the built-in pieces' names (`src/net/decorLaw.js decorHiddenOf`:
  `m<placement>:<model>`, `f<flat>:<archive>.<record>`, none twice, at most 200 - one write at its widest under the
  4 KiB body).
- **The routes.** `/v1/homes/decor` answers `hidden` beside `pieces`, to every session. `POST /v1/homes/decor/hidden
  { mapId, buildingKey, character, keys }` writes the list WHOLE, the owner's character alone (in the same statement,
  as a placement is), on the decor writes' own hour; a list the law refuses is `bad-decor` (400), no such home of the
  caller's `no-home` (404).
- **The version.** `acct12`.
- Pinned: `test/basehide.test.js` (the service over the real Worker and node:sqlite). `tools/mutants/basehide.json`.

## DEV3, a fourth Disciple, and SHADOW-FANG — SirMcMobdon's own (2026-09-26)

Mac: "grant Tabby the developer title/glyph. Grant Flylighter the disciple title/glyph", then "SirMcMobdon gets a brand
new title/glyph. Remove them from Apostle. The glyph needs to be like the reference shown" (a snarling wolf's head in
profile, black, with a red eye), "Black and crimson graident for the title/glyph with the title name being Shadow
Fang", and a Morrowind werewolf skin of their own (with the werewolf body it needs - WEREWOLF1 imports it).

- **The grants** (`server-account/wrangler.toml`): `DEVELOPER_HANDLES` gains Tabby (DEV3: the whole developer set, as
  DEV2's), `DISCIPLE_HANDLES` gains Flylighter, `APOSTLE_HANDLES` is empty again, and `SHADOW_FANG_HANDLES =
  "SirMcMobdon"` is new - TITLE-N's law, a handle list that grants the title and its glyph together and never to a
  guest (`titles.js TIER_LISTS.shadowfang`). The Apostle title SirMcMobdon wore lapses off their next token, because a
  stored title is worn only while it is held - and nothing wears the new one for them: Shadow Fang is HELD, and worn
  once they press it on the account card (AUDIT B3; the patch note says so).
- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): `shadowfang` joins TITLES and GLYPHS, last. An
  older relay refuses a token carrying it (`claimsValid`), so the relay is **world117** and the account service
  **acct14** (world114 and acct12 on this branch - renumbered at the merge past the Enhanced Plus patch's world114,
  GUILD1c's world115 and the services' acct12 and acct13; world116 at that merge, then past the Oblivion Gate's WBX,
  which took world116 on main while this branch was never opened as a pull request - the second merge, 2026-09-27); both deploy themselves off main, and the service's deploy
  WAITS until the relay's /health serves the version wire.js names (AUDIT B1 - the two workflows started on one push
  with nothing ordering them).
- **The face** (`src/ui/playerBadge.js`): the word "Shadow Fang"; a black-to-crimson gradient (`TITLE_GRADIENT`,
  #0d0709 to #d3193c) - "Shadow" in the black, "Fang" in the crimson; the glyph a wolf's head in profile facing right,
  filled with the SAME stops turned round (`GLYPH_GRADIENT`, read from the title's) so the mane is crimson and the
  face black, edged in the crimson and with a red eye over it (`GLYPH_DETAIL`); `>` for the classic face.
- **The paint, one law on every face.** A gradient title is `titlePaint`: the gradient clipped to the letters, in the
  loaded 500 face, the text shadow off (under a clipped background a text shadow paints over the letters), and an
  edge OUTSIDE each letter - a crimson pixel right and below and a black one under (AUDIT A4: a crimson stroke ON the
  letters with a synthesised bold read crimson in the world). A crimson halo round the word was tried first and lost
  "Shadow" on every dark ground. The name over a
  head writes it when the title CHANGES, not every frame (a browser reads colours back normalised, so the diffing door
  would have rewritten it for ever); the chat line and the profile card paint through `paintTitle`; the account card's
  button keeps the plain crimson and its word (`.acttitleword`) wears the same paint from the skin; the classic face
  draws the word a letter at a time along the gradient over one crimson run a pixel down and right. A gradient glyph
  is drawn by `glyphArtNode` - its own `linearGradient` (an id per node), the edge in `currentColor`, the eye on top -
  which the account card now uses too, so the card has no svg door of its own.
- **The skin** (WEREWOLF1, `04-Characters/Werewolf-Body.md`): the Shadow Fang glyph also dresses its holder's
  Morrowind werewolf. A peer's comes off the glyphs their token carried; the player's own off the stored session -
  `adoptIdentity` now keeps a token's or a wardrobe's `glyphs` there (strings, bounded; an unchanged list is not
  written; only into the session that asked - AUDIT B4), read by `systems/ownGlyphs.js`, so it is theirs offline too
  once the service has stated them to this device (a mint or the account card since this update).
- Pinned: `test/shadowfang.test.js` (9); DEV3 and Flylighter in `test/titlen.test.js`.
  `tools/mutants/shadowfang.json` (20, all dead) and two grant mutants in `titlen.json`; four older records re-aimed
  by content (acc3b 2, acc3c 1, inspect1 1).
- **AUDIT (2026-09-26, before the merge; `04-Characters/Werewolf-Body.md` has the werewolf's and the skin's).** Fixed:
  **B1** the deploy race above - the last three paired deploys landed either way round, and SirMcMobdon's hello at a
  world113 relay was refused whole; the step is pinned in `test/accountdeploy.test.js`. The relay's verifier stays
  strict (its own law: it never repairs a claim set) - the race is fixed where it is, in the order. **B4** a late
  identity answer was adopted into whichever session signed in after it asked (a name and glyphs - and a werewolf's
  skin - on another account's device). **B7** a letter's glyphs were cut at a typed 8 (SHADOW-FANG made it eight of
  eight - `GLYPHS_MAX` now), and a letter named its sender's title by its key ("shadowfang"). **B8** the tier lists
  pinned whole and inside the vocabulary, and the widest possible token pinned inside the hello's 512-character body.
  **A1** the profile card spread the gradient over the whole card (the word in its middle fifth - a flat maroon); the
  title is the word's width. **A2** a closing window's ghost stripped its ids, so the wolf's gradient dangled - hollow
  for the fold; renamed with the ghost now (`windowMotion.js renameGhostIds`). **A3** the classic face advanced its
  letters by the MEASURED space, so the edge sat a pixel off under "Fang". **A7** the wolf's nose edge was cut at the
  box. **A10** (the title's own bug, found on the name) a party mate's colour was rewritten every frame. Declined:
  **A9** the account card's "the skin carries the colour" no longer holds for the wolf - its stops and its eye ARE the
  glyph, and a skin recolouring them would be another glyph. **B2** world114 and acct12 were claimed by other open
  branches too; busy-fermat (PEERLIGHT, GUILD1c) landed first, so the merge took the next free numbers - world116
  with a NEW LAW row (this branch's never-deployed world114 row dropped, no deployed row rewritten) and acct14; and
  again at the second merge (2026-09-27): WBX had taken world116, so world117 with its own row, the never-deployed
  world116 row dropped the same way. Told
  to Mac, not the code's: **B5** DEV3's developer glyph carries /red, /stage and /mute to whoever holds the handle
  "Tabby".

## FOUNDER3 — Founder by when an account first played (2026-09-27, acct15)

Mac: "we still need to grant everyone the founder title befire the original cut off date. A lot of people are missing
it".

- **The cause.** Founder was read off `registered_at`, and registering is only the moment a player chose a name. Guests
  had been playing since before any account could register (ACC1c, 2026-09-21), so a player here as a guest before the
  cutoff who registered after it held nothing. That was Field-Bugs 2026-09-26b's open question (report 3,
  DragynDance).
- **The rule** (`server-account/src/titles.js` `firstPlayed`): a registered account holds Founder when it FIRST PLAYED
  by `FOUNDER_UNTIL`. That is the row's `created_at`, stamped at first contact, guest or not, and kept through
  registration's upgrade in place (0002). A row without one is judged by its registration, as before.
  - Still derived: no row is written, as ACC3 designed.
  - The instant does not move (2026-09-25T00:00Z, FOUNDER2's), so everyone before the original 2026-09-23 cutoff is
    inside it and nobody who held Founder loses it.
  - Still registered accounts only. A guest from before the cutoff holds it the moment it registers.
  - The guard on `registered_at` stays first, because D1 gives a guest a NULL `registered_at`, which `Math.min` reads as 0.
- **Not reached.** A player who played as a guest in one browser and registered in another has two rows and nothing
  linking them. The account's row was first seen when it registered. FOUNDER4 (2026-10-04) reaches it where the two
  rows share a character; two rows that share none are still not linked.
- The account service is `acct15`, and the rule takes effect on that deploy.
- Pins: `test/founder3.test.js` (4), including the service end to end (a guest first seen before the cutoff, registered
  through the Worker after it, wears Founder on its signed token). ACC3's, TITLE-N's and SHADOW-FANG's non-founder
  fixtures now first played after the cutoff too. `tools/mutants/founder3.json` has 6 mutants, all dead, and
  ACC3a's founder mutants were re-aimed at the new line (all dead).

## RECOVER-OP — a new recovery code, issued by the operator (2026-09-27)

Twoddle, to Mac: "i did a stupid and have lost my password plus the code thing it gave ... is there anyway this can be
fixed without starting a new account as i would like to keep the founders badge? I am still signed in atm". He had kept
both in a text file in the game's folder, and an update replaced the folder.

ACC1c has no way back for a player who lost both, and on purpose. Email is optional, so there is nothing to reset
against, and a signed-in device may not change the password without the old one: a stolen device must not lock its
owner out. So the way back is the operator's, and it is the player's own recovery with a fresh code.

1. **Verify the owner.** Ask the player to send an in-game letter from the account, to the operator's account, with a
   word the operator chose over Discord. Only a device signed in as that account can send it (MAIL1 stamps the sender
   from the session).
2. **Mint the code.** `node tools/reissueRecoveryCode.mjs <handle>` prints the code (for the player, privately) and its
   hash.
3. **Set it.** Actions, then "Account recovery" (`.github/workflows/account-recovery.yml`), then Run workflow with the
   handle and the HASH. The code is never an input, because inputs show on the run's page. The workflow writes
   `recovery_hash` on that one registered account and nothing else: the password, the sessions, the saves and the
   Founder (`created_at`) are untouched. A handle that matches no account fails the run and changes nothing. It shares
   the deploy's queue, so it never runs beside a migration.
4. **The player recovers.** In "Forgot password", the player enters the handle and the code, then picks a new password.
   `recover` mints a new code that only the player sees, and signs every device out. That spends the code the operator
   saw.

- The inputs reach the scripts as environment, never pasted into a `run:` line. The statement is the tool's own, and
  the tool refuses anything that is not a username or not a hash exactly as it wrote one. A quote in a username is
  doubled, and the account is found by `handle_lc`.
- Pins: `test/recoverop.test.js` (4). One drives the service end to end: the operator's statement, the game's own
  recovery with the code typed without dashes, a new code, the operator's copy dead, every earlier device signed out,
  and the same account with its Founder. `tools/mutants/recoverop.json` has 7 mutants, all dead.

## GUILD-GRANT — gold into a guild's treasury, awarded by the operator (2026-10-03)

Mac: "Can we award the empire of tamriel guild 1.6mil gold". No route mints gold into a treasury, and on purpose: every
gold piece in one was carried in by a member (GUILD1), and only what realm characters carried in (`realm_gold`, AUDIT
REALM L1-F3) buys a hall or comes back out (HALL-GOLD). So an award is the operator's, written by hand, like RECOVER-OP.

1. **The dry run.** Actions, then "Guild gold grant" (`.github/workflows/guild-grant.yml`), then Run workflow with the
   guild's name, the gold (digits only: `1600000`) and apply OFF, the default. The run's summary names the guild the
   name found - its tag, its members, its treasury and the part of it that buys a hall - and both as the award would
   leave them. Nothing is written.
2. **The award.** Read the summary; run again with apply on. One statement (`tools/grantGuildGold.mjs`) adds the gold
   to the treasury AND to `realm_gold`, so it buys a hall and comes back out to a realm character like any other, and
   the ledger's trigger (0046) writes the line in the same statement: the Guild tab reads "The developers awarded the
   guild 1,600,000" (`GUILD_LEDGER_WORDS.grant`).

- The guild is found by its name key (`guildNameKey`: case, spaces and punctuation aside), the key the service holds
  unique. The tool takes only a name a guild could be founded with and a whole award from 1 to the treasury's cap
  (`GUILD_TREASURY_MAX`); the award is not held to one move's cap (`GUILD_MOVE_MAX`), which is a player's. An award that
  would take the treasury past its cap, or a name that finds no guild, fails the run and writes nothing.
- The inputs reach the scripts as environment, never pasted into a `run:` line, and the run shares the deploy's queue,
  so it never runs beside a migration. It creates, migrates and deploys nothing.
- Pins: `test/guildgrant.test.js` (4). One drives the service end to end: the dry run, the award, the ledger's line, a
  realm character's withdrawal of it. Another runs the workflow's own steps in bash over D1's answer.
  `tools/mutants/guildgrant.json` has 11 mutants, all dead.


## RAID4 — the towns defended (2026-09-28, acct17)

Mac, on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric + armor sets". The relay
keeps a town raid's ledger and signs a receipt (`w1`, `src/net/raidReceipt.js`, under the gate's GATE_SIGNING_KEY) for
each account that struck a raider and stood in the town at its cleanse (RAID3, `03-World/Raiding-Parties.md`). This
service honours it:

- **`POST /v1/raid/claim { receipt, character, name }`**, behind a session whose account is the receipt's `s`
  (`server-account/src/raids.js claimRaid`), verified with the relay's public half (GATE_PUBLIC_KEY - the gate's pair
  signs both receipts; the version inside the signed bytes keeps them apart). Migration 0016 `raid_cleanses (raid,
  account, day, party, char_id, xp, nonce, at)`, primary key `(raid, account)`: a receipt counts once whatever happens
  to it. An account is counted at most `RAID_CLAIMS_DAY_MAX` (6) raids a game day - the relay holds no copy of the
  day's schedule, so this is the record's bound. A guest fights and is not counted until it registers (the same id).
- **Renown.** The character that fought it (the client names it; its own save's id) is paid `renownRaidXp` - three
  quests' worth at the top quest level, read no higher than its Renown allows (`src/net/renown.js`: 780 at Renown 1,
  1,860 at 10, 3,900 from 27) - OUTSIDE the hour's bound: the receipt is the relay's word, not the client's. One
  `db.batch` writes the row (under the day's bound, stamped with the claim's own nonce) and credits the track only
  where THAT row exists, so the same receipt claimed from two devices at once pays once. A rise comes back with a
  signed renown order, as a report's does. A new character past RENOWN_TRACKS_MAX is counted and paid nothing.
- **The record.** `/v1/account` and the Inspect record carry `raids: { defended }`: the account card says *Towns
  defended: 3*, the Inspect card *Towns defended: 3* once there is one.
- **The device** (`src/net/raidClaims.js`, the gate's carrier's twin) keeps each receipt with the character that fought
  it until the service settles it, offering the signed-in account's alone; a counted raid's Renown is the page's at once
  when that character is the one playing.
- `ACCOUNT_VERSION` acct17; the account deploy's path filter carries `src/net/raidReceipt.js` (and RAID3's
  `src/net/raidLaw.js`). No relay change. Pins: `test/raid4_rewards.test.js`; `tools/mutants/raid4.json`.

## AUDIT RAID — a town's thanks once, a raid's Renown the hour's (2026-09-28, acct18)

Mac: "1. Audit this properly 2. Ensure online functionality is perfect". Two findings of the raid's audit were the
service's (`03-World/Raiding-Parties.md` "AUDIT RAID"):
- **A town's thanks once a (raid, account).** The thanks were rolled on the device the moment a receipt came, marked
  spent on that device alone - and the relay hands an account's receipt to every socket of it. `/v1/raid/claim` now
  takes the device's claim id (`cid`, sixteen hex digits); the first claim of a (raid, account) - a guest's too -
  writes the thanks row with it (`raid_spoils`, migration 0017, CASCADE with the account) and is answered
  `spoils: true`; the same device asking again is answered the same (an answer it lost), any other never. No count
  reads the row: a guest's is no town defended, and a guest who registers later is counted without being thanked again.
- **A raid's Renown is the account's hour's.** It was credited outside the hour's bound; six raids a game day at up to
  3,900 each was 11,700 an hour more for a modified client naming raids the day never rolled. The claim is charged to
  the hour as a report is (renownTracks.js's window, in the same batch): counted whatever the hour has left, paid what
  it has left, the row saying what it paid; a new character past the tracks' bound spends nothing of it.
- `ACCOUNT_VERSION` acct18. Pins: `test/auditraid.test.js`; `tools/mutants/auditraid.json`.

## REALM P1.1 — 2026-09-28: the realm's characters, service side

Mac: "A true separation while allowing people to still play offline". Asked where an online character's save lives,
he answered "Account service". The plan is `06-Systems/Realm-Arc.md`, sections 1 and 2. This is the other lane
from ACC2: there the local save is the truth and the cloud a backup, here the service holds the truth.

- **The row and the objects.** Migration 0016 adds `realm_characters`: one row a character. Its `id` is minted by
  the service (`r` and twenty hex digits, nothing a client mints looks like one). The save sits in R2 under
  `realm/<player>/<id>/<seq % 2>`, two objects alternating, so the one before the last checkpoint always survives.
  (REALM P2.1 replaced the alternation: see below.)
- **The lease and the sequence** (`server-account/src/realm.js`). A join mints a new lease and so takes the character
  from any tab that held it (ONE-SEAT's own rule, newest wins), and it frees the account's other characters: one
  account plays one character. A checkpoint lands only under the current lease and only at `seq + 1`. A stale lease is
  refused before a byte lands, and the row moves only if the lease still holds.
- **The routes** (`service.js` ROUTES, `realmPathOf`), behind a session, a guest's too:
  - `GET /v1/realm` lists the account's characters (the lease is never listed);
  - `POST /v1/realm/create` makes a character born online;
  - `POST /v1/realm/customs` brings in an offline character once, only if it has a Renown track (it played online
    before the realm);
  - `POST /v1/realm/join`, `/leave` and `/delete`;
  - `PUT /v1/realm/<id>/data` is a checkpoint, with the lease, sequence and tile in `x-realm-*` headers;
  - `GET /v1/realm/<id>/data` reads the save back for a join's load or a copy to offline, with the sequence in an
    exposed header.
- **Bounds.** Six characters an account; the save's own 4 MiB; a tile's summary projected and bounded. `acct17`.
- **Customs carries a character's online life in** (REALM P1.5): its Renown track is re-keyed from the offline id to
  the realm's (`realm.js` `customsCarry`, `CHARACTER_TABLES`), inside the census batch (AUDIT REALM2 S6). Its homes
  and guild membership stay behind (AUDIT REALM2 S2). A second try is asked first, since the track has moved.
- **A `seq` refusal says the service's own sequence** (REALM P1.2), so a tab whose last checkpoint landed with its
  answer lost resyncs. It is never a way in: the write still needs the lease.
- Pins: `test/realm1.test.js` (8), driving the Worker over the real migrations. `tools/mutants/realm1.json` has 21
  mutants, all dead (REALM P2.1 re-aimed three to the new objects and added the delete's prefix walk).

## REALM P2.1 — 2026-09-28: a trade between realm characters, settled here

Mac: "eliminate duping". The plan is `06-Systems/Realm-Arc.md` section 3; the client's half is TRADE1's state machine
handing its commit to the realm (`net/tradeSession.js` `escrow`, `systems/realmSaves.js` `realmTradeEscrow`).

- **`POST /v1/realm/trade`** (`server-account/src/realmTrade.js`), behind a session. A half carries the trade's sid, the
  character, its lease and the sequence of the checkpoint it made the moment both sides confirmed, and what it gives
  and takes. Its body may reach 32 KiB (`REALM_TRADE_BODY_MAX`), the one JSON route past 4 KiB.
- **Migration 0017.** `realm_trades` keeps one row a trade: the first half waits there (`REALM_TRADE_TTL_S`, a
  minute), and the outcome stays for a side asking again, `done` with each side's result or `refused` with its word.
  `realm_tx_guard` never holds a row: a settling batch ends with an insert that happens only when a record it moved
  did not move, and the table's CHECK refuses it, so D1 rolls the batch back whole.
- **The settle.** Each record is read as its own last checkpoint left it. The goods move by the shared law
  (`src/net/realmTradeLaw.js`): what the giver's record holds, never what a client says. Both records land one
  sequence on as new objects, and one guarded batch moves both rows to them and seals the trade.
- **Every write of a realm character is a new object.** `realm_characters` gains `obj` and `prev`: a checkpoint or a
  settle writes a key of its own (`realm.js` `mintObjectKey`) and the row then names it. A write that loses its race
  drops its own object and never touches the current save; the save two back goes. The P1 alternation could put a
  losing write on the current object.
- **The Worker bundles the law.** `src/net/realmTradeLaw.js` and `src/net/canon.js` (TRADE1's comparison, lifted out
  of `net/tradeSession.js` into a leaf so the Worker does not bundle the client's trade machine) join the deploy's
  path filter (`.github/workflows/account-deploy.yml`, held to the import graph by `test/accountdeploy.test.js`).
- `acct17` still (it has not shipped). Pins: `test/realm4.test.js` (14) and `test/realm1.test.js`;
  `tools/mutants/realm4.json` has 31 mutants, all dead.

## REALM P2.2a — 2026-09-28: a guild's gold moves on the realm character's record

- **`prepareRealmRecord`** (`realm.js`): the record read where the tab says it stands (`{ id, lease, seq }` - the tab
  checkpoints just before and holds), changed by the act (`src/net/realmGoldLaw.js`: the wallet's own order - coins,
  letters of credit, then the region's account - or a credit), and written one sequence on as a new object. The row's
  move and its guard go into the act's OWN batch, so the gold and the act land together or not at all.
- **`mustChange`**: the batch step's guard. An insert into `realm_tx_guard` right after an UPDATE that must change a row,
  made only when `changes()` says it did not; the table's CHECK refuses it and D1 rolls the batch back.
- **The guild routes** (`guilds.js`): `/v1/guilds/found`, `/deposit` and `/withdraw` take `realm` (and `region` for what
  pays). A realm character (its id the service's shape) must name its record, or `realm-needed`; no other character
  may. New refusals: `realm-needed`, `realm-gold` (the record cannot pay), and the checkpoint's own `lease` and `seq`
  (with the service's sequence). The guild routes now get the bucket.
- The Worker bundles `src/net/realmGoldLaw.js`, listed in the deploy's path filter. Pins: `test/realm5.test.js` (7);
  `tools/mutants/realm5.json`.

## REALM P2.2b — 2026-09-28: a home's and its decor's gold moves on the realm character's record

- **The homes** (`homes.js`): `/v1/homes/claim` takes `realm`; a realm character's claim pays its price off the record
  (the wallet's order, the claim's region's account last) in the claim's own batch. `/v1/homes/release` takes `realm`
  and requires it for a realm character's home: the deed share (`homeLaw.js` `homeSaleRefund`) and half of what its
  pieces cost go into the house's region's account on the record, in the release's own batch.
- **The decor** (`decor.js`): `/place`, `/move` and `/remove` take `realm`. What a change costs (`decorGoldDelta`: the
  price, a resize's difference or half back, a station's licence, a removal's half) moves on the record with the
  piece's own write, guarded (`realmDecorWrite`). A write that moves no gold names no record.
- Each act asks where the record stands first (`recordMovedOf`), so one sent again after it landed is told `seq`.
  The homes and decor routes get the bucket and answer `seq` with the service's sequence, and `lease` and `realm-gold`
  as 409s. Pins: `test/realm6.test.js` (7); `tools/mutants/realm6.json`.

## RENOWN-ACCOUNT — one Renown an account, every source at three quarters (2026-09-28, acct19)

**Half of this stands.** The three quarters and the hour's 15,000 stand. The one Renown an account was undone the next
day by RENOWN-CHAR (below): Renown is each character's again, and `renown_accounts` is history.

Mac: "Btw can you make sure renown is account based and not character based? Along with reducing the accumulation of
renown from resources a bit. Want some more oomph to the grind".

- **One Renown an account.** `renown_accounts` (migration 0021: `player` the key, `xp`, `last_rid`) holds it, keyed by
  the account alone. No customs, no character's delete and no realm table names it. `renown_tracks` stays as each
  character's history (what the census counted, and what customs carries), and is no longer written. The migration
  starts each account at its best character's total, the MAX and never the sum, and carries that track's `last_rid`,
  so a report sent again across the deploy is answered as a repeat. An account with nothing earned gets no row.
  `RENOWN_TRACKS_MAX` is gone: the key holds one track an account.
- **Read as the account's everywhere:**
  - the token's `lv`, whichever character the mint names (one never played starts at the account's Renown);
  - `/v1/account`'s `renown`, now `{ xp, level }` or null. Older clients' account cards show no Renown, since the field was a list;
  - a raid's pay (`raids.js`; the character that fought is kept on the claim's row);
  - a founding's Renown check (`guilds.js`).

  A report's `character` and `name` are taken and ignored.
- **Three quarters from every source** (`src/net/renown.js` `RENOWN_RATE_PCT` 75, `renownRate`, the one floor), with the
  hour's bound 15,000 (was 20,000). The curve is unchanged.

  | Source | Now | Was |
  |---|---|---|
  | A kill, foe level 1 / 3 / 10 / 20 / 30 | 7 / 22 / 75 / 150 / 225 | 10 / 30 / 100 / 200 / 300 |
  | A quest, level 1 / 10 / 30 | 105 / 375 / 975 | 140 / 500 / 1,300 |
  | A raid defended, at Renown 1 / 10 / 27+ | 585 / 1,395 / 2,925 | 780 / 1,860 / 3,900 |
  | A party of eight, a level-30 kill | 383 | 510 |
  | Level-30 kills to Renown 10 / 20 | 79 / 531 | 59 / 398 |

  Gates pay no Renown of their own (the gate's claim records the kill), so theirs follows the kill's rate. The weapon
  and armour sigils feed on Renown XP, so they grow a quarter slower too.
- Rides REALM's undeployed `acct19`. Pinned: `test/renown_account.test.js` (8); `tools/mutants/renown_account.json`
  (23, all dead). The pins of RENOWN1, RENOWN3, RENOWN4, RENOWN-BAR, AUDIT RENOWN1, RAID4, AUDIT RAID, the guild pins and
  realm5 were rewritten to the account's Renown.

## AUDIT REALM2 — the realm service's audit (2026-09-28, acct19)

The service lane of `06-Systems/Realm-Arc.md` AUDIT REALM2 (S1-S8):
- **A first save is read** (`realm.js` `firstSaveRefusal`, before a byte lands):
  - one born online is level 1 within `REALM_BIRTH_WEALTH_MAX`, or it is refused `realm-birth` (403);
  - a customs character is within its level's allowance, or it is refused `customs-allowance` (403);
  - both are measured by the one measure customs caps with (`src/net/realmGoldLaw.js`), its constants pinned to the game's.
- **A house, a piece and a founding are a realm character's alone** (`realm-only`, 400). The two-write lane any id had
  is gone.
- **A batch that landed keeps its save** (`dropIfUnnamed` in every catch).
- **An offer matches its record in every field**, and a traded record is at most `REALM_TRADE_RECORD_MAX` (4,096)
  characters.
- **A character's new waiting trade half replaces its old one**, in the insert's batch.
- **The customs carry rides the census batch** (`UPDATE OR IGNORE`), and a resumed customs carries again.
- **A checkpoint that moved nothing reads the row again**, and answers `seq` or `lease`.
- **A lone guildmaster is deleted only once the treasury is empty** (`guild-treasury`, 409).

`ACCOUNT_VERSION` stays `acct19`. Pinned: `test/auditrealm2_service.test.js` (11), over `test/realmSeat.mjs`, which
seats a realm character the realm's way for every realm pin; `tools/mutants/auditrealm2_service.json` (16, all dead).

## TERMS1 — the Terms of Service and the Privacy Policy, ticked before an account exists (2026-09-28)

"Here is our terms of service and privacy policy. I wanna make sure these need to be reviewed and checked off by players
before creating an account". Four answers settled the rest: the documents say Daggerfall Online (the draft used the
project's name from before BR4), their three contact placeholders are the Discord server, each box sits beside a link to
its document, and new accounts only are asked.

**The documents.** `terms/index.html` and `privacy/index.html`, served at `/terms/` and `/privacy/` beside the landing
page, whose foot links them. The words are the project's own, carried over whole: a script converted the draft, and a
word-for-word comparison against it, with only the name, the date and the contact filled in, came back identical (1,189
and 1,297 words). They are documents in the landing page's sense - no script, no file of their own - so
`scripts/landingHtml.mjs` dresses them (`DOCUMENT_PATHS`, `transformDocument`): the skin's tokens, the five from
`src/ui/pixelifyFive.js`, one rule set for both, the fonts request and the icon, and no night sky behind a document read
to the end.

**A version is a document's Last Updated date**, because that is how the Terms say a revision is marked (section 15).
`src/net/legalLaw.js` holds `TERMS_VERSION` and `PRIVACY_VERSION` for both ends. Each page carries its date as
`<time datetime>`, pinned equal to its version, and its words are pinned to a hash, so the text cannot change without
somebody deciding whether that is a new version. To revise a document: edit the page, move its Last Updated date and its
version together, and re-hash. The site and the account Worker deploy separately, and the site's deploy waits for the
account service to serve the version the tree names (AUDIT PRE-MERGE 0929 T2), so the form never meets a Worker older
than itself; a desktop build older than the service is told the documents changed, and to reload the game or update
the app.

**The form.** Only `register` asks (`AGREEMENTS` in `src/ui/accountFlow.js`): two boxes under the fields, "I have read and
agree to the Terms of Service" and the same for the Privacy Policy, each document's name a link that opens outside the
game - a new tab on the web, the system browser from the desktop app, whose `dagger://` pages cannot reach the site by a
relative link (so the URLs are absolute). The boxes start unticked, a move wipes them, and a refused name keeps them.
Nothing leaves the device until both are ticked: the guest row the flow opens first IS an account (0001's own words), so
it is not opened either. Both requests then carry the versions ticked. A guest from before the boxes, giving itself a
username, meets the same form.

**The service.** `legalRefusal` (`server-account/src/accounts.js`) is asked by the only two routes that make an account,
`/v1/auth/guest` and `/v1/auth/register`, before anything is written: `not-found` for a body that names neither
document - a game from before the boxes, which renders it "The game may need updating" (AUDIT PRE-MERGE 0929 T1; the
form never sends one) - `terms-unaccepted` for one named and not the other, `terms-stale` for dated versions that are
not these. The row records `terms_version`,
`privacy_version` and `legal_accepted_at` (migration 0023 - 0022 until main's CUSTOMS-CARRY took that number). Only the current versions are ever written, and naming an
account never erases the agreement its row already holds. Signing in and recovering ask nothing: those accounts exist.
Every account made before TERMS1 keeps NULL - it was never asked, and a default would invent that it was. The recorded
version is what a later revision would ask again against; asking again is not built.

- `acct20` (acct17 and migration 0016, then acct19 and migration 0018, on its branch - renumbered past RAID4's and AUDIT RAID's, then REALM's and RENOWN-ACCOUNT's, at the merges).
  `tools/accountProbe.mjs` sends the versions, and checks that the deployed Worker refuses a request without
  them.
- `tools/accountCardProbe.mjs` runs again. It served the card from a hand-kept map of four modules with their imports
  rewritten, and ACC3c, DUEL1, RENOWN1 and WB5b each gave the card an import the map never learned, so it had stopped
  loading at all. It now serves `src/` at its own paths and lets the browser resolve the imports, and it measures the
  boxes as drawn: two, unticked, rows at a thumb's 44px, the box and the link in brass, each link opening outside the
  game at the site, and none on any other stage (17/17). The unticked box is told the page is dark (`color-scheme`), or
  it is the browser's white square.
- Pins: `test/terms1.test.js` (19) - the documents, the build seam, the form, the card, and the Worker end to end on
  node:sqlite. The 19 account suites that make accounts through a route now send the versions, and `accountflow`'s and
  `nameadopt`'s registering flows tick both boxes. `tools/mutants/terms1.json`: 28 mutants, all dead. The three records
  the change moved (ACC1c-16, ACC1e-7, GATEKEYS-the-empty-var-back) are re-aimed by content, and dead. Every other
  committed record the change could reach - the 922 that target a changed file or are killed by a changed suite - was
  run again: 916 dead, 6 equivalent as recorded, none surviving.

**What the Privacy Policy does not say yet**, noted here for the project rather than written into its text: the service
also stores an optional email (ACC1c), cloud save backups with a screenshot each (ACC2), and letters between players
(MAIL1).

**AUDIT PRE-MERGE 0929** (`01-Overview/Audit-PreMerge-0929.md`, lens T), each red first:
- **T-CI - the account deploy's own smoke.** It opened a throwaway guest and named one with `{"label":"deploy-smoke"}`
  alone, which TERMS1 refuses: `curl -f` would have failed the job the moment the Worker went live, and every check
  after it - the gate's public half, the registration on Cloudflare (the PBKDF2 outage's own detector), the public key,
  the relay's copy of it - with it, on this deploy and every one after. One step reads both versions off
  `src/net/legalLaw.js` (never typed) into the job's environment, and all three calls agree as a player does.
- **T1** - a game from before the boxes was told `terms-unaccepted`, a word it has no sentence for ("The account service
  had a problem" at every press, for ever - the desktop app's reload brings back the same game): a body naming neither
  document is answered `not-found`, and `terms-stale` says "Reload the game (or update the app)". The real-workerd probe
  (`tools/accountProbe.mjs`) asks the runtime both: the bare body `not-found`, one document ticked `terms-unaccepted`.
- **T2** - the site's deploy waited for nothing: live before the account service, the form ticked both boxes against
  the old Worker, which named the account and recorded no agreement. `deploy.yml` publishes only once the service's
  `/v1/health` serves the version the tree names (or a later one), up to thirty minutes, and not at all if it never
  does - AUDIT B1's law, the account service's own for the relay.
- **T3** - the card's redraw took the keyboard: a refusal is cleared by the first keystroke or tick that answers it,
  and that repaint rebuilt the card under the player's fingers (after "Type your username" the rest of "Nystul" went
  nowhere but its N; a Space on the Terms box left the next Tab on Username). Every control is built under a name, and
  the one the keyboard was on - with its caret - has it back after the redraw, on a card of the same stage
  (`src/ui/enhancedAccount.js`); pre-existing since ACC1e for the fields, every tick since TERMS1.
- **T4** - the route table's `{ label? }` body and legalLaw.js's "a relative link would open nothing" said what the
  code does not; corrected.
Pinned: `test/audit0929_terms.test.js` (6), `test/terms1.test.js`'s refusals; `tools/mutants/audit0929_terms.json` (14,
all dead).

## PENITENT, and a fifth Disciple — Diggleborf's own (2026-09-29, acct21)

Mac: "This new custom title/glyph is for the user Diggleborf" and "Add valenvalarys as a disciple ingame". The ask is
Diggleborf's, on the Discord: "Looking to do a Trinimac themed one, so maybe "Penitent" for the title starting gold and
ending a sky blue", with a rough sketch for the glyph ("Something like this or similar would be great!") - a tall
lozenge with a sword inside it, the sword's point at the lozenge's lowest corner.

- **The grants** (`server-account/wrangler.toml`): `DISCIPLE_HANDLES` gains valenvalarys, and `PENITENT_HANDLES =
  "Diggleborf"` is new. It is TITLE-N's law, as SHADOW-FANG's: a handle list grants the title and its glyph together,
  never to a guest (`titles.js TIER_LISTS.penitent`). Penitent is HELD, and worn once Diggleborf presses it on the
  account card; a Founder title they wear stays worn until then. It is a title and a glyph only. The staff's commands
  stay STAFF1's three (Mac's own choice), and no werewolf skin rides it.
- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): `penitent` joins TITLES and GLYPHS, last. An
  older relay refuses a token carrying it (`claimsValid`), so the relay is **world129** and the account service
  **acct21**. The account deploy waits for the relay's `/health` (SHADOW-FANG's AUDIT B1). CUSTOMS-GRANT's branch
  (PR #433, not merged) also names acct20, which main's TERMS1 already holds; whichever of the two lands second takes
  the next free number. (CUSTOMS-GRANT's branch landed after both, as acct23: REALM-DOOR took acct22 first.)
- **The face** (`src/ui/playerBadge.js`): the word "Penitent" and a gradient from CSS's own `gold` (#ffd700) to its
  `skyblue` (#87ceeb), with a warm light between them (#fff3d6). A gold and a sky blue both lean green, so a straight
  mix of the two is sage: with two stops the word read gold, lime, blue. With the light between, it reads gold into
  light into sky, and it still starts gold and ends sky blue.
- **The edge** (`TITLE_EDGE`, new): the colour a gradient title's letters are edged in, where it is not the title's own.
  Shadow Fang's edge stays its crimson, because its black half needs a bright edge over a night sky. Penitent's ends
  are both bright, and edged in its own gold the sky half was lost: the word read gold on every ground. So it is edged
  in black, as every one-colour title's text shadow is. `titleBadge` carries it as `edge`, and `titlePaint` and the
  classic face's edge run read it there.
- **The glyph**: Diggleborf's sketch, drawn the way the tiers draw theirs - a stroked outline in one colour
  (`GLYPH_STROKE`) - with a detail of its own (`GLYPH_DETAIL`, the door SHADOW-FANG's eye opened). The lozenge is in
  the title's gold and the sword over it in the title's sky, both read from the title's stops. The sword is point
  down, the arms reversed as a penitent carries them: a small diamond pommel, the grip, the guard, and a blade more than
  twice the hilt, tapering to the lozenge's lowest corner where the sketch's meets it. The sketch's own short sword
  read as a cross at a name's size, so the blade is longer. The glyph is not a gradient: at a name's size (11 to 28
  px) a gold-to-blue stroke reads as one lime line. `|` for the classic face.
- **Seen**: rendered in the name layer's own sheet (Playwright) over a night sky, a day sky, stone, grass and snow, at
  15 and 24 px, before the colours and the shapes were chosen; then the shipped code - the real name layer, and the
  glyph at the chat's 11, the card's 15 and the profile's 16 px beside the Disciple's and Shadow Fang's.
- Pinned: `test/penitent.test.js` (8); valenvalarys in `test/titlen.test.js`. `tools/mutants/penitent.json` (24, all
  dead), and two grant mutants in `titlen.json` (21, all dead). Three older records in `shadowfang.json` were re-aimed
  by content, and the version mutants in `soc1.json` and `gatekeys.json` moved with the versions (all dead).

## REALM-DOOR and CUSTOMS-PASS — the mint's realm word, and a developer's pass through customs (2026-09-29, acct22)

From the field (`01-Overview/Field-Bugs-2026-09-29b.md`): Gryphoth made and played a character online on a build from
before the realm, after the census froze - the relay still admitted such a build - and Bring online refused it.

- **REALM-DOOR: every identity token says whether its character is the realm's.** `/v1/auth/token` stamps `rc`: 1 when
  the character the mint names is one of the account's realm characters (`realm.js` `realmCharacterHeld` - a realm id,
  the caller's own, standing), else 0 - an offline id, another account's character, one deleted, none. The relay
  refuses a 0 at its door (`06-Systems/Online-Arc.md` REALM-DOOR, world130).
- **CUSTOMS-PASS (Mac: "Staff customs pass"): `POST /v1/mod/customs-pass { name | account, revoke? }`**, a developer's
  alone (`DEVELOPER_HANDLES`; a moderator's mute is not enough to let a character into the realm's economy). The account
  is named as the game shows it - a handle, case-folded, or a guest's two-word name when one account without a handle
  wears it (`ambiguous`, 409, when two do) - or by its id. It holds one open pass (`realm_passes`, migration 0024: a row
  a grant, `granted_by` and `granted_at`; a partial unique index keeps one open an account), and customs spends it on the
  account's next character its census does not count, inside `customsRealm`'s own guarded batch, writing that
  character's id and the moment (`origin_id`, `spent_at`). Never spent on a character the census admits anyway; never
  lets in one already brought in from any account. A revoke takes back an open pass only. `tools/customsPass.mjs` is the
  developer's end of it.
- `acct22`. Pins: `test/realmdoor.test.js` (6), `test/customspass.test.js` (6); `test/accountworker.test.js` names the
  new table.

## RENOWN-CHAR — Renown a character's again (2026-09-29, acct31)

Mac: "Can we make renown per character again". Asked how each character should start, Mac chose **"Own + recent
gains"**: each character goes back to its own track from before RENOWN-ACCOUNT, plus everything the account earned while
Renown was the account's.

- **A track a character, as RENOWN1 built it.** `renownTracks.js`, `raids.js` and the client's tracker, raid queue and
  bar are RENOWN1's again, byte for byte:
  - a report names its character (`renown-character` without one), and its answer names it back;
  - the token's `lv` and the mint's total are the named character's (1 and 0 for one that never earned);
  - `/v1/account`'s `renown` is the list of tracks again, the `RENOWN_CARD_TRACKS` (five) most recently earned;
  - a raid is paid to the character that fought it, at its own Renown;
  - a guild is founded on the founding character's own Renown;
  - a Court writ pays the delivering character's track (`professions.js`; MERGE 2 had moved it to the account's).
- **What stays from RENOWN-ACCOUNT:** every source at three quarters (`RENOWN_RATE_PCT` 75, `renownRate`), and the
  hour's bound, 15,000, still the ACCOUNT's across all its characters. A second character is not a second allowance.
- **The tracks' bound is back:** `RENOWN_TRACKS_MAX`, 60 an account. A 61st character is refused `renown-full` (409);
  a raid for one is still counted, and a writ still filled and paid its Marks, with no Renown.
- **Migration 0035 (`0035_renown_characters.sql`)** gives each track what it is owed:
  - its own XP, plus the account's gains: `renown_accounts.xp` less the best track it began from (0021 began every
    account at its best track, and no track's XP was written since). The gains were never recorded by character, so
    every character of the account takes them. Nobody loses a level, and an alt takes only the gains.
  - a realm character with no track (made since) gets the gains alone, only when there are gains, only into the room
    the tracks' bound leaves, the most recently played first.
  - never past the cap's total.
  - every track takes the account's `last_rid`, so a report in flight across the deploy is answered as a repeat.
  - a realm character's track is stamped with the later of its own time and its record's last move, so the card leads
    with the character played last.
  - one known over-payment: where a realm character holding the account's best track was deleted while Renown was the
    account's, the gains are read against the best that remains. That is more than was earned, never less.
  - `renown_accounts` stays as it stood, as history nothing writes.
- **The client:** the account card's chip is the level of the character played last, named in its title, with a row a
  character. The page takes a raid's credit only for the character that fought it. The realm delete dialog says the
  Renown goes with the character again.
- `acct31`. Pins: `test/renown_char.test.js` (7); `test/renown_account.test.js` now holds only what stands of
  RENOWN-ACCOUNT (3: the rate, 0021 as it ran, the relay untouched); `test/prof1_service.test.js` a writ's Renown per
  character. The pins RENOWN-ACCOUNT had rewritten were put back to the character's: RENOWN1, RENOWN4, RENOWN-BAR,
  AUDIT RENOWN1, RAID4, AUDIT RAID, the guild pins, realm5 and auditrealm. Mutants: `tools/mutants/renown_char.json`
  (18: 17 dead, 1 recorded equivalent - the migration's cap, which no row can reach); `renown_account.json` keeps its
  8 that still apply (the rate, 0021), all dead; the records RENOWN-ACCOUNT had re-aimed were re-aimed back by content.

## PATREON-LINK — a patron's title follows their pledge (2026-10-01, acct45)

Mac: "With patron and having to manually hand out titles. Im running into a workflow where its really hard to keep up
with it." Asked whether patrons should link their own Patreon or he should press a grant button per patron: "Patreon
auto-link".

TITLE-N granted the three Patreon tiers by handle lists in `server-account/wrangler.toml`, so every new patron was a
message to Mac, an edit, a review and a deploy - DEV3, PENITENT and the four Disciples after Dutchess were exactly that -
and a lapsed pledge was the same again, or nothing at all. Now a registered player presses **Link Patreon** on the
account card, says yes on Patreon and once more on a page of the service's, and the tier their pledge pays for is a
title they hold: upgraded, downgraded and lapsed by Patreon's own webhook, with nobody in the loop.

- **Still derived.** ACC3's law holds: what a player HOLDS is read at every ask, never a column that grants. What is
  stored is the one thing this service cannot derive - Patreon's last word on the membership, as WB9g stores a sale.
  Migration 0045 adds `players.patreon_user` (UNIQUE), `patreon_tiers`, `patreon_status` and `patreon_at`.
  `titles.js holdsTier` reads the tiers against `PATREON_TIERS` (`"<tier id>:<title>,..."`, the three Patreon titles
  only) beside the handle list, so a tier holds its title AND its glyph, as a list does. Held only while Patreon says
  `active_patron` and the tier is in `currently_entitled_tiers`: a declined card lapses the title until the payment goes
  through, and a deleted pledge lapses it at once. A worn title that lapses stops being worn on the next token, with
  nothing cleared (`titleWorn`).
- **The link is a link.** `/v1/account` answers `patreon: { on, linked, titles, link }` - `link` the authorize URL with
  the one scope a title needs (`identity`) and a STATE the service SEALED for that account (an hour; AES-GCM under a key
  HKDF derives from the client secret, one key a kind, so it names nobody to Patreon or a browser's history and opens
  as nothing but a state). The card's press opens it at once - a new tab, the system browser
  from the desktop app - as TERMS1's document links do; a window opened after an await is a popup a phone blocks. The
  redirect is `<the origin that served the read>/v1/patreon/callback`, read off the request, never typed.
- **It asks before it links.** A state is a bearer: whoever opens the URL finishes the link for the account it names, so
  a player could send a patron their own link and take the patron's title. There is no cookie to bind it to (the app
  finishes in the system browser), so `/v1/patreon/callback` spends Patreon's code, asks Patreon who the player is, and
  WRITES NOTHING: it answers a page naming the Patreon account, the GAME account the state named, and what the pledge
  holds, with one button. The button posts a TICKET (fifteen minutes, sealed at the callback, carrying the patron's own
  access token) to `/v1/patreon/confirm`, the one write of a link - and THE YES ASKS PATREON AGAIN and writes what it
  says NOW. A ticket that carried the page's word was a hole: pledge, open the page, cancel, press - and the row said
  `active_patron` with no webhook left to lapse it. Now a pledge cancelled between the page and the press holds
  nothing, a yes pressed twice is Patreon asked twice, and a token that answers for another Patreon account links
  nothing.
- **One pledge, one account.** Linking a Patreon account another game account holds MOVES it, in one batch guarded on
  the account being registered, and the page says from where - a patron who made a new account takes their title along.
- **The webhook** (`/v1/patreon/webhook`) is Patreon's word on a member: the HMAC-MD5 of the exact bytes under
  `PATREON_WEBHOOK_SECRET` (`X-Patreon-Signature`). WebCrypto has no MD5, so `patreon.js` computes it (RFC 1321/2104),
  pinned against node's own at every block boundary. Then one UPDATE keyed on the Patreon user: the tiers and the status
  as stated, a field the payload leaves out left standing, and `members:delete` / `members:pledge:delete` holding
  nothing whatever the payload's figures say. A member nobody linked is acknowledged and changes nothing - the link
  reads Patreon afresh when it is made.
- **Unlink** (`/v1/patreon/unlink`, behind a session) clears all four columns, and answers the wardrobe after it, as an
  equip does.
- **The pages** are HTML a person reads, in the game's dark and brass: every word of a player's escaped, no script, a
  policy that lets the one form post here and nothing frame it, never cached, no Referer.
- **The card** (`ui/enhancedAccount.js`, `ui/accountFlow.js`): a Patreon row for a registered account while linking is
  on - Link Patreon, or "Linked - Disciple" with Refresh (the same link: Patreon asked again) and Unlink. When the window
  has the focus again the card reads the account again (`flow.refresh`), so the player comes back to the link that
  landed. Nothing for a guest, nothing while linking is off, nothing from a service before acct45.
- **Off until the secrets are in.** The toml carries the client's id (public - it rides every authorize URL) and the
  tier map; the two secrets are repository secrets the deploy puts on every run through one pipe (`secret bulk`,
  `.github/workflows/account-deploy.yml` 4c), and its summary names the redirect URI and the webhook URL read off the
  deploy. Unset is a legal state: the card offers nothing and the webhook answers `patreon-closed`.
- **Mac's tiers** (2026-10-01: "some titles dont have titles/glyphs ingame. Heriophant is custom and Herald doesnt
  exist ingame yet. Supporter doesnt recieve a title/glyph"): `PATREON_TIERS = "29666211:disciple,29666234:herald"` -
  Disciple, and Herald since HERALD (below) gave it its title in the game. Supporter (29701293) holds none and
  Hierophant (29666221) is custom, granted by name. Apostle has no tier now.
- **The handle lists stand.** A list still grants on its own, for the titles Mac grants by name (a comp, a patron who
  will not link); the two never hold one title twice.

### What Mac does, once

1. **Patreon's client.** On https://www.patreon.com/portal/registration/register-clients, create a client (API version
   2) with the redirect URI the deploy summary names:
   `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/callback`. Keep its Client ID and Client Secret.
2. **Patreon's webhook.** On https://www.patreon.com/portal/registration/register-webhooks, add
   `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/webhook` with the member triggers
   (`members:create`, `members:update`, `members:delete`, `members:pledge:create`, `members:pledge:update`,
   `members:pledge:delete`). Keep its secret.
3. **The repository's secrets** (Settings, Secrets and variables, Actions): `PATREON_CLIENT_SECRET` and
   `PATREON_WEBHOOK_SECRET`.
4. **The two lines** in `server-account/wrangler.toml`: `PATREON_CLIENT_ID` (the Client ID) and `PATREON_TIERS` - each
   tier's id is the number after `rid=` in its Join link on the Patreon page. Done 2026-10-01 from Mac's client id and
   tiers (above). The push deploys it; from then on a patron links themselves.

- The account service is `acct45`, and none of it touches the relay: no claim is new (the tiers' titles and glyphs are
  TITLE-N's), so no relay deploy.
- Pins: `test/patreon_link.test.js` (17) - the law, the MD5 and the signature, the sealed state and ticket, Patreon's
  shapes, the Worker end to end with Patreon's two OAuth endpoints stood in for (the yes's own read among them), the
  card and its flow, the config and the deploy. `tools/mutants/patreonlink.json` (47, all dead). `test/accountworker.test.js` holds the four columns; the
  version pins moved to acct45 (and `gatekeys.json`'s record with them).

## HERALD — the Patreon tier between Disciple and Hierophant (2026-10-01, world138, acct45)

Mac, sending his Patreon tiers for PATREON-LINK: "Herald doesnt exist ingame yet", then "you'll need to develop the
herald title/glyph". No colour or shape was named, so it is the tiers' kind - TITLE-N's law, one flat colour and a
stroked glyph in it.

- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): `herald` joins TITLES and GLYPHS, last. A relay
  from before it refuses a token carrying it (`claimsValid`), so the relay is **world138**; the account service rides
  acct45 with PATREON-LINK (both undeployed), and its deploy waits for the relay's `/health` to serve world138
  (SHADOW-FANG's AUDIT B1) - or world139, the Loot arc's merge, which carries the word too.
- **The grant** (`server-account/src/titles.js`): `TIER_LISTS.herald = 'HERALD_HANDLES'` (empty - nobody by name yet)
  and `TIER_GLYPH.herald`, so the list and the pledge each grant the title and its glyph together. `herald` is a
  Patreon title (`patreon.js PATREON_TITLES`), and Mac's Herald tier (29666234) is mapped to it in `PATREON_TIERS`.
- **The face** (`src/ui/playerBadge.js`): the word "Herald" in AZURE (#4f7dff), heraldry's own blue - a herald wears
  the arms he cries - between the Disciple's teal and the Apostle's violet on the tiers' rise. The glyph is the herald's
  trumpet, level, its bell flaring right, with a swallowtail banner hanging from the tube, stroked in the title's azure;
  `<` (the bell's flare) for the classic face; "Herald" on the account card.
- **Seen** before it was chosen: the real name sheet in Chromium over a night sky, a day sky, stone, grass and snow,
  at 13, 15, 20 and 40 px, beside the Disciple's, the Apostle's and the Hierophant's and the moderator's shield. A
  periwinkle was lost on the day sky, a silver read as a bare name, and a purple as the Apostle's; a raised trumpet
  read as a pick and a trumpet alone as a megaphone - the banner is what makes it a herald's.
- Pins: `test/herald.test.js` (6); the vocabulary's exact lists in `acc3titles.test.js`, `titlen.test.js` and
  `penitent.test.js`, and PATREON-LINK's tier map, moved with it; the relay's pins moved to world138, crediting HERALD
  (`auditbounty1.test.js` holds the credit). `tools/mutants/herald.json` (12, all dead); seven older records re-aimed
  by content (`penitent.json` 4, `shadowfang.json` 2, `soc1.json`'s version record) and PATREON-LINK's two config
  records, all dead.

## MOD2 and GLYPH-WEAR — a second moderator, and glyphs a player can take off (2026-10-02, acct50, world143)

Mac: "Please give tabbyvish the moderator title/glyph for ingame", then "Before we merge this, can we make it where
players can also equip/unequip their glyphs".

- **MOD2, MOD3**: `MODERATOR_HANDLES = "Asynian,tabbyvish,Starempire42"` (MOD3, Mac: "Also add Starempire42 as a
  moderator") - MOD1's grant (the blue shield, `/mute` and `/unmute`). There is
  no moderator title in `TITLES`, only the glyph.
- **A glyph is still TRUE of a player** (ACC3) and still derived at every read. The one stored thing is the choice:
  `players.glyphs_off` (migration 0068), the glyphs taken off, space-separated. `titles.js` `glyphsHidden` reads it
  against `glyphsOf` now, so a lapsed glyph is not "hidden" and a newly granted one shows until taken off;
  `glyphsShown` is the rest. `POST /v1/account/glyph { glyph, on }` shows or hides one (`not-held` 403, `no-glyph` 400)
  and answers the wardrobe, which carries `glyphsOff` beside `glyphs`.
- **HIDING IS PAINT ALONE.** The token still signs every true glyph as `g`, because rights ride glyphs: the relay's
  `/red`, `/dm` and live events read `dev`/`dm` off the attachment, and the client's staff commands read the mint's
  `glyphs`. The hidden ones ride beside as `gx` (`claimsValid`: a non-empty list of `g`'s own, absent for none).
  `badged` (wire.js) leaves `gx` out of every row the relay stamps, so a roster, a join and a traveller are shown only
  what the player shows. The board's and the letters' badges read `glyphsShown`.
- **My own screen**: the mint answers `glyphsOff`; `adoptIssued` (world.js) hands my name the shown glyphs and the
  staff rights the whole list; `adoptIdentity` stores the shown glyphs, so a hidden Shadow Fang is no wolf skin on my
  screen, as it is none on anybody else's.
- **The card**: each glyph on the account card is a button now - full strength while shown, faded while hidden.
  Others see the change from the next hello, as a title. A relay before world143 shows every glyph.
- Pins: `test/glyphwear.test.js`; `test/titlen.test.js` (MOD2's list).

## AEGIS — Sureme's own: the Aegis of Oblivion, its glyph and the Oblivion Ward (2026-10-03, world160, acct73)

The owner: "For the account named Sureme ... We are going to develop a title, glyph and new custom aura for this user.
Title: Aegis of Oblivion. Theme: Purple. The references posted are for the glyph design and the aura design." Sureme's
three references, all from Path of Exile: a sigil for the glyph ("this symble is from path of exile, i play that game
alot" - a tall pillar and two short ones through a ring, over a black splash), and two ground marks for the aura ("i
want one that is a full circle" - a whole violet circle with four small marks; "but with some stuff like this one" -
broken arcs of violet runic script: beads on the line, curled ends, combs and a cross).

- **The grant** (`server-account/wrangler.toml`, `server-account/src/titles.js`): `AEGIS_HANDLES = "Sureme"`, TITLE-N's
  handle-list law (`TIER_LISTS.aegis`, `TIER_GLYPH.aegis`), and the FIRST list that grants an aura too:
  `TIER_AURA = { aegis: 'oblivionward' }`. Until now an aura was only ever BOUGHT (WB9g's insignia, a sale recorded on
  the row); this one is DERIVED, as a glyph is - held while the handle is listed and gone from the next token once it
  is not, nothing written to the row. So `aurasHeld`, `auraWorn` and `auraRefusal` take the config (`env`) as
  `titlesHeld` does, and every caller passes it: the wardrobe (`wardrobeOf`), the aura door (`accounts.js equipAura`)
  and the mint's `au` (`index.js`). A list's aura is offered before any the Broker sold. A caller without the config
  reads the Broker's alone, exactly as before. Never a guest's. No staff command rides it.
- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): `aegis` joins TITLES and GLYPHS last, and
  `oblivionward` joins AURAS after `dagonfire`. A relay before it refuses a token carrying any of the three
  (`claimsValid`), so the relay is **world160** and the account service **acct73**; the account deploy waits for the
  relay's `/health` to serve world160 (SHADOW-FANG's AUDIT B1). No frame changes shape.
- **The title** (`src/ui/playerBadge.js`): "Aegis of Oblivion" in a gradient out of the void into the ward's light -
  #7030e0, #b24dff, #ecdcff, every stop a violet - edged in black (`TITLE_EDGE`), its middle stop the colour a face
  without gradients uses (the card's button, the classic face) and the glyph's. Chosen over a night sky, a day sky,
  stone, grass and snow at 13 to 64 px beside the Apostle's periwinkle and the Protector's royal purple: the reverse
  (light into the void) read as a bare name over a night sky and was lost on snow; a paler run lost its light end on
  snow; a near-black start edged in violet was lost on the night sky. This one reads violet on all five.
- **The glyph**: the reference drawn after it, not traced - a pillar risen up the middle, a short pillar each side, and a
  wide ring lying across all three below the middle with the side pillars at its two ends ("I O I", the middle risen),
  stroked in the title's violet; and the reference's black splash as `GLYPH_DETAIL` - five tendrils hung from the ring's
  foot, mirrored, the outer two swept out past the pillars, filled in the abyss's violet (#4d1a94, darker than any stop
  of the word). The reference's squared spiral read as a flag at a name's size and is left out; a skirt of straight
  spikes read as an upside-down crown, and the tendrils in the title's lilac as a crown again. `O` on the classic face
  (the ring, and Oblivion's initial); "Aegis of Oblivion" on the account card.
- **The Oblivion Ward** (`src/render/auraRing.js`, the aura pass WB9g built): the same program draws both auras, the
  aura picked per wearer (`uAura`, AURA_LOOK - its kind, its ring's radius 0.95 m against the fire's 0.85, its wall's
  height 0.42 m). THE GROUND: the ring WHOLE - one line of light, lilac-white at its heart and violet round it,
  breathing, two scribes of brighter light running round it - with a bezel of 48 fine ticks outside it turning the other
  way; within it a ring of twelve runes in the second reference's script (`WARD_SCRIPT`: each a baseline along the ring
  with a bead or a serif at each end, beads on the line, a comb or a chevron outward, a cross inward - no two alike),
  turning slowly against the ring and lit one after another as if being written; four claws hung inward from the ring
  at the diagonals (the first reference's marks), clear of the runes as they turn beneath; the abyss's violet mist
  turning inside, gone under the feet. THE WALL: a veil of light to the shins in streaks that climb, and fourteen motes
  rising off the ring. As it kindles it is drawn round from behind the wearer.
- **The floating symbols** (the owner, after the first push: "Can you add like symbols that float and dissipate"): a
  third draw, the ward's alone (`AURA_LOOK.glyphs` - the fire has none). Nine cards, each a rune of the ward's script
  stood on end, lift off the ring and float up to the chest (WARD_GLYPH_RISE, 1.3 m), slowing toward the top, swaying,
  drifting outward and tilting a little, always turned round the vertical to face the eye. As each climbs its strokes
  blur and break into dust from the noise's low places up, and it fades in as it lifts off and out as it goes; then it
  lifts again from a new place round the ring with a new rune. A flight lasts 3, 4 or 5 s (each dividing the clock, and
  which flight it is wraps with it, so the wrap is whole); the nine are staggered, so some are always rising and some
  always going. The flight is the vertex half's (`wardFlight`), the light the fragment half's (`wardSymbol`). Every rate is a whole number of cycles
  over the clock, written as a division by its whole period, never a rounded decimal. THE FOUR HOSTS, untouched:
  `scenes/world.js` owns the pass and gathers each wearer with their `aura` (auraFrame), drawing it on the street;
  `scenes/worldModes.js` calls the same hook (`host.drawVeiledPeerBodies`) in a building and hands it to the dungeon as
  `lateWorldDraw`, which `scenes/dungeonContext.js` calls; `scenes/exterior.js` (the fixed city) draws no peers and no
  aura, as before WB9g - FLAGGED, unchanged.
- **Seen**: the title and glyph in Chromium on the real name layer's sheet over the five grounds (13 to 64 px) beside
  the Apostle, the Protector, Shadow Fang and Penitent; the ward in a real WebGL2 from above, from a third-person camera
  and from low, at kindle 0, 0.5 and 1, and the symbols at several moments of their flights. `tools/auraProbe.mjs` now
  draws both auras: 22/22 (the fire's 11 unchanged; the symbols lit over the ward to the chest, nothing over the fire).
- Pins: `test/aegis.test.js` (12). `tools/mutants/aegis.json` (38, all dead). The vocabulary's exact lists in
  `acc3titles.test.js` moved; the relay's pins moved to world160 crediting AEGIS (`auditbounty1.test.js` holds the
  credit) and the account's to acct73. Seven older records re-aimed by content (`herald.json`, `penitent.json`,
  `shadowfang.json`, `ribbon.json`, `wb9g.json` 3) and the version records in `soc1.json` and `gatekeys.json`.

## PRIMARCH — GA00250's own: the Primarch, its glyph and the Golden Radiance (2026-10-04, world162, acct76)

The owner: "The details here are for a custom title, glyph, and aura for ga00250", over GA00250's own words: "the title
will be Primarch, the color will be that light gold color that you guys use in some places in the game menu" - with a
screenshot of their name in the pause menu's pixel face ("that color") and a swatch - and "can the aura be a golden
light around the character? like i've seen some rare mobs with it" (the elite foes' glow, `systems/hitFlash.js`
ELITE_GLOW_GLSL: the sprite warmed toward gold, an edge of light round the silhouette, embers rising off it). No glyph
was described at first; after the first push GA00250 sent a picture of a three-barred cross: "i'd like to that be the
glyph design if possible. with the same color of the name".

- **The grant** (`server-account/wrangler.toml`, `server-account/src/titles.js`): `PRIMARCH_HANDLES = "GA00250"`,
  TITLE-N's handle-list law (`TIER_LISTS.primarch`, `TIER_GLYPH.primarch`) and AEGIS's: the second list that grants an
  aura (`TIER_AURA.primarch = 'radiance'`), derived from the config at every ask as the Oblivion Ward is - held while the
  handle is listed, gone from the next token once it is not, case-folded, never a guest's. Nothing else had to move:
  AEGIS already made `aurasHeld`, `auraWorn` and `auraRefusal` read the config at every caller. No staff command rides it.
- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): `primarch` joins TITLES and GLYPHS last, and
  `radiance` joins AURAS after `oblivionward`. A relay before it refuses a token carrying any of the three
  (`claimsValid`), so the relay is **world162** and the account service **acct76** (acct75 here until HOME-PRICE took it); the account deploy waits for the
  relay's `/health` to serve world162. No frame changes shape.
- **The title** (`src/ui/playerBadge.js`): "Primarch" in ONE colour, as asked - #d8cfae, the pixel menu's text
  (`ui/enhancedStyle.js .px-mname`, the very rule the screenshot's name is drawn by; the screenshot's letters sample at
  #d4ccb0 through its JPEG, the swatch at #e5e09e). A pin holds the title to that rule, so the two cannot drift. A
  one-colour title wears every face's black text shadow (no gradient, no `TITLE_EDGE`); it read on all five grounds - a
  night sky, a day sky, stone, grass and snow - in Chromium at 13 to 64 px. It is paler and greyer than the Founder's
  and the Crowned's golds and warmer than the Champion's silver. (The name under it is drawn in `--bone`, #e9e4d9: the
  two are near, which is the colour GA00250 chose.)
- **The glyph** (GA00250's reference, drawn after it): THE THREE-BARRED CROSS - the shaft the full height up the
  middle, a short bar near its head, the long crossbar under it (the glyph's widest), and low down a footrest as wide as
  the head bar, slanting down to the right as the reference's does. Its widths and heights are the reference's, measured
  off it; the shaft and bars are a little thicker (1.6 units against its 1.35) so the footrest's slant still reads at a
  name's 13 px - chosen in Chromium over the reference's own thickness and a wider-barred one on the five grounds at 13
  to 64 px. Filled, in "the same color of the name": the Primarch's gold, #d8cfae, the colour GA00250's name wears in
  the menu they pointed at (the title's, as every grant's glyph is). Every bar is wound the shaft's way round, so the
  fill is whole where they cross it. `t` on the classic face (a cross with its foot turned); "Primarch" on the account
  card. (The first push drew the port's own glyph, a sword raised between two feathered wings; GA00250's cross replaced
  it before merge, and world162's undeployed row was re-hashed in place for its word's comment.)
- **The Golden Radiance** (`src/render/auraRing.js`, the aura pass WB9g built): the third look of the same program
  (`uAura` 2, AURA_LOOK - its column's radius 0.6 m and height 2.2 m, no symbols). Light ABOUT THE BODY rather than a
  mark at the feet. THE WALL: a column the body's width standing past the crown (the walking body is 1.8 m), lit as a
  glowing shell is - faint where the eye looks through it across the body, brightest at its two edges where the eye
  looks along it (the horizontal facing of its surface to the eye) - so it reads as a halo up the silhouette, never a
  gold wash over the wearer; shafts of noise climbing it, whole to the chest and gone at its top, breathing; eighteen
  golden motes rising its height at their own places and paces (the elite's embers). Seen from inside it - the wearer's
  own first person - the column is not drawn (the fragment half reads the feet, `uAt`, beside the eye) and its motes are
  dimmer: the wearer's own view is never veiled in gold. THE GROUND: a pool of the light, brightest at the feet and gone
  before the quad's edge; a white-gold ring at the column's foot; twelve rays across the pool, turning a turn in 30 s.
  It kindles up: the ground lights as the others' do and the column rises from the feet to past the crown. Its glow is a
  gold a step paler than the elite's (#ffbd47) and its heart the title's own #d8cfae. Every rate is a whole number of
  cycles over the clock (`radianceRatesWhole`), every pattern round a whole number, so no seam and no jump at the wrap.
  THE FOUR HOSTS, untouched: the pass's hosts are AEGIS's (`scenes/world.js`, `scenes/worldModes.js`,
  `scenes/dungeonContext.js`; `scenes/exterior.js` draws no aura - FLAGGED, unchanged).
- **Seen**: the title and glyph in Chromium over the five grounds at 13 to 64 px; the radiance in a real WebGL2 round a
  stand-in body from a third-person camera, from low, from above, from far, close, at half kindled, and from the
  wearer's own eye looking level and looking down. `tools/auraProbe.mjs` now draws all three auras: 33/33 (the ring
  whole and golden, the pool, no seam, no jump at the wrap, the column bright at its edges and faint across, dark beside
  it and over the crown, nothing unkindled, risen to the waist at half kindled, no veil from inside).
- Pins: `test/primarch.test.js` (11). `tools/mutants/primarch.json` (34, all dead). The vocabulary's exact lists in
  `acc3titles.test.js` and `titlen.test.js` moved, and `aegis.test.js`'s newest-word and one-list pins (PIN MOVED); the
  relay's pins moved to world162 crediting PRIMARCH (`auditbounty1.test.js` holds the credit), the account's to acct76.
  Seven older records re-aimed by content, all dead (`aegis.json` 4, `herald.json`, `penitent.json`,
  `shadowfang.json`), and the version records in `soc1.json` and `gatekeys.json`.

## FOUNDER4 — Founder through a shared character (2026-10-04, acct76, migration 0078)

Mac: "Before we merge this. We need to find a way to grant the founder title to everyone before the previous cut off
date. Since people are still missing their founders title". Asked which ways (carry over a held guest session at
sign-in; link shared characters; grant by name; move the cutoff later), Mac chose one: "Link shared characters".

- **The cause.** FOUNDER3 reads Founder off when an account first played, its row's `created_at`, and said what it
  could not reach: a player who played as a guest in one place and registered in another has two rows and nothing
  linking them. The desktop app made that common. It is its own origin (`dagger://game`, `app/main.cjs`), so its
  storage is not the browser's: a browser guest from before the cutoff who installed it and registered there has an
  account first seen after the cutoff, and their play before it on a guest row nothing names. Signing in does not help
  after the fact either - a device that signs in keeps only the new session (`ui/accountFlow.js doLogin`), and the
  guest's secret is gone.
- **The link** (`server-account/migrations/0078_founder_links.sql`): a CHARACTER both rows hold. A character's id is
  minted on the player's own machine (`systems/characterId.js`, a UUID or a stamp and a random tail) and never told to
  another player - the relay keys what it shares by a hash of the account and the id (`net/wire.js parkKeyOf`) - so a
  character on two rows is one player's save on both. A row holds a character when the service recorded it there: a
  cloud save of it (`saves.character_id`), its Renown track (`renown_tracks.char_id`), the realm's census of it
  (`realm_census.char_id`), a realm character brought in from it (`realm_characters.origin_id`) or a customs pass spent
  on it (`realm_passes.origin_id`). A realm character's own id is minted by the service for one account and links
  nothing.
- **The fact** (`players.first_played_at`): the earliest first play (FOUNDER3's: `created_at`, or `registered_at` where
  earlier) of a row the account shares a character with, written only where it is EARLIER than the account's own, NULL
  everywhere else. One hop - the row that holds the character, never a row linked through a row in between. Guests are
  filled too, so a desktop guest linked to a browser guest from before the cutoff holds Founder the moment it registers.
  It is a fact about when the player played, as `created_at` is, and grants nothing: `titles.js firstPlayed` reads it
  beside the two it read, and Founder is still that against FOUNDER_UNTIL at every ask. The instant does not move and
  nobody who holds Founder loses it. The players-column pin (`accountworker.test.js`) carries it.
- **Once, at the deploy.** The migration gathers the holdings into a table of its own, indexed both ways, fills the
  column in one statement and drops the table (0035's precedent). A character carried onto a new account after the
  deploy is not linked by it; the statement can be run again by hand against the live database to count late arrivals.
- **Not reached.** Two rows that share no character: a player who played before the cutoff and has not brought a single
  character's save, track or realm character onto the new account, or whose old storage is gone with the characters in
  it. Moving the cutoff, a by-name list and a sign-in carry-over were offered and not chosen.
- The account service is still `acct76` - PRIMARCH's, undeployed, one deploy for both - and the rule takes effect when
  that deploy applies 0078. No relay change: Founder is already in the token's vocabulary.
- Pins: `test/founder4.test.js` (5) - the law; the migration run over a seeded database (each of the five records, the
  earliest of several linked rows, nothing without a shared character or without an earlier one, one hop, guests
  filled); its shape (the five sources, no table left behind); and the real Worker before and after 0078 (Founder in
  the wardrobe and on the signed token). `tools/mutants/founder4.json` (12, all dead); three of `founder3.json`'s
  re-aimed by content at the new `firstPlayed` (6, all dead). The acct76 pins credit FOUNDER4 beside PRIMARCH.

## KNIGHT-HOUSE — a deed the realm gave, held off its character's record (2026-10-04, acct77)

FIELD BUGS 2026-10-04d (`01-Overview/Field-Bugs-2026-10-04d.md`; the law is `06-Systems/Online-Arc.md` KNIGHT-HOUSE).
A Knightly Order's house was Daggerfall's deed in the save and nothing on this service, so every other player's claim
on it landed and the knight's own claim paid for it again. Migration `0079_home_deed.sql` adds `homes.deed`;
`POST /v1/homes/deed` (`server-account/src/homes.js` holdDeed) reads the character's realm record and refuses `no-deed` unless the
record holds that deed (`src/net/homeLaw.js` homeDeedOf, which the client's door reads too) in the layout the hold names;
otherwise it writes the building's row marked `deed` (price and paid 0) in the town's one layout, counted against the
hour's claims. Every other claim on it answers 409 `home-taken`; the owner's is a repeat that pays nothing; the town's
answer leaves the row out for its own character and marks it `deed` for everyone else; the cap of three counts the
homes bought (`deed = 0`); `/v1/homes/release` with `deed: true` removes only the caller's own deed row, and a deed's row
is never sold as a home. `HOME_MOVE_CARRIED` carries `deed`. `ACCOUNT_VERSION` acct77 in both the Worker and
`wrangler.toml`; twelve version pins moved. Deploy order: the service (0079, then acct77), then the client.

## SHADOW-CLOAK — SirMcMobdon's own: the Holo Shadow Cloak (2026-10-04, world167, acct80)

Mac: "So for SirMcMobdon, I want to build a new unique AURA specifically for his account. A holo shadow cloak with red
accents. Extremely detailed". (Its name keeps the owner's word "Holo"; after the revision below nothing holographic is
left in it.) SirMcMobdon already holds SHADOW-FANG's title and glyph (black #0d0709 to crimson
#d3193c), so the cloak is drawn in that paint: the cloth is shadow, its light is red.

- **The grant** (`server-account/wrangler.toml`, `server-account/src/titles.js`): no new list. `TIER_AURA.shadowfang =
  'shadowcloak'` - SHADOW_FANG_HANDLES, the list that grants Shadow Fang, is the third to grant an aura with its title
  (AEGIS's law, PRIMARCH's after it): held while the handle is listed, gone from the next token once it is not,
  case-folded, never a guest's. Held is not worn: SirMcMobdon wears it from the account card's Aura row (`player.aura`),
  as every aura is.
- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): `shadowcloak` joins AURAS last. A relay before it
  refuses a token carrying it (`claimsValid`), so the relay is **world167** and the account service **acct80** (world165 and acct78 on its branch, both renumbered
  past main's SERPENT1, then the relay past SERPENT2 and the account past GLOBAL-MARKET, at the merges); the account deploy waits on the relay's `/health` to serve world167 (SHADOW-FANG's
  AUDIT B1). No frame changes shape.
- **The face** (`src/ui/playerBadge.js`): "Holo Shadow Cloak" (`AURA_TEXT`), its button on the account card in the
  Shadow Fang's own paint (`AURA_PAINT.shadowcloak = 'shadowfang'`).
- **The cloak** (`src/render/auraRing.js`, the aura pass WB9g built): the fourth look of the same program (`uAura` 3,
  AURA_LOOK). Not a mark on the ground nor light round the body but a CLOAK ON IT, as Mac revised it after the first
  push: "less digital, adjust hood since it's at a weird orientation, not as tall, more cape like, change the floating
  elements to be more emblem like"; "For the emblems have it use that user's glyph"; "and when the user transforms into
  a werewolf have this rip apart with fragments floating around". (The first push was a hooded robe to 1.97 m, its
  hood a tall tube leaning back, with a scan line, a hex lattice, a rain of script, glitches, flicker, a HUD of
  dashes, ticks, brackets and a radar sweep on the ground, and burning wisps; all of that is gone.)
  - THE CAPE: its own mesh (`mesh: 'cloak'`, CLOAK_ROUND 48 round by CLOAK_ROWS 48 up, `auraCloakGrid`) shaped in the
    vertex half - hung from the shoulders (1.42 m up, 0.27 m out from the body's axis at the sides - 0.54 m across - narrower front to back), falling and flaring to its
    hem (0.4 m), its back hanging further out and trailing longest (the hem 0.1 m off the ground down the back, 0.26 m
    at the front edges), fourteen folds deepening to the hem, the hem billowing and a wave running down the back.
    Clasped at the throat (CLOAK_CLASP_Y 1.43): open below it, wider to the hem; the collar whole round the neck.
  - THE HOOD, up round the head: its middle at the eye (CLOAK_HOOD_Y 1.68 m, EYE_HEIGHT 1.7), every bearing clear of the
    head, sitting 3.5 cm behind the body's middle with its peak fallen 5 cm further back; its peak 1.88 m, 8 cm over
    the 1.8 m crown ("not as tall"); narrower across than deep; its face open from 1.53 to 1.80 m, a brow over it.
  - IT FACES ITS WEARER'S WAY: the wearers carry `yaw` (`scenes/world.js auraFrame` - one's own body's facing,
    `player.bodyYawFor`, as the third person draws it; a peer's from `net/peerClimb.js peerBodyYaw`); `uYaw` turns the
    mesh, and the mesh's seam (u 0 = 1) lies inside the opening or under the clasp.
  - IT SHADES: the only look drawn premultiplied (`shade`, ONE / ONE_MINUS_SRC_ALPHA) where the others add, so the
    cloth darkens what is behind it. ITS TWO SIDES ARE TWO DRAWS (`uSide`): its lining first (the faces turned from
    the eye - front faces culled) and its outside over it (back faces culled), so one row's far cloth never lies over
    the next row's near (drawn in one, the hood striped). The BENT mesh's own winding names each side - the frame's
    front face is the game's: `world/mat4.js` HANDEDNESS mirrors the projection and the renderer winds CW, which the
    probe draws too - and a pin holds every cell wound outward and unfolded at rest and under the strongest poses. (The
    first cut named the sides by the rest pose's normal: posed, up to a quarter of the cloth was misnamed - AUDIT.)
    The cloth's own normal against the eye now only lights it.
  - THE CLOTH: its outside a dense shadow (#0d0709), stirring, its fold ridges catching a crimson sheen and a crimson
    rim where it turns away; its LINING a deep red, seen through the opening; a mantle over the shoulders with a
    scalloped edge stitched in crimson; embroidery - an edge line, a band of wolf's teeth and a fine inner line - down
    both edges of the opening, round the hood's face (none down the closed collar, none on the frayed hem); the hem ragged,
    its last hand's breadth coming apart into smoke that trails a hand below it, smouldering where it tears.
  - THE EMBLEM - "that user's glyph": the badge's own path (`ui/playerBadge.js GLYPH_PATH.shadowfang`, SirMcMobdon's
    wolf's head, and its eye, `GLYPH_DETAIL`) cut into straight edges (`glyphEdges`: M, L, Q and Z, each curve in four
    chords; any other command refused) and filled even-odd in the shader (the badge fills nonzero - the same for a path that never crosses itself, which a pin
    checks over the glyph's whole box) - crimson deepening
    down to its mane, its outline lit, its eye an ember - inside a ring and a fine ring on a disc of shadow. On the
    cape's back (0.98 m up, 0.15 m), as its clasp (4 cm) and rising off it. Its x is the frame's own right (world/
    mat4.js HANDEDNESS: world +x on screen right), so the wolf faces the way the badge's does - from behind on the back,
    from the front at the clasp, on every floating card.
  - THE EMBLEMS ALOFT, its third draw: five, each rising 0.75 m off the back between the shoulder blades and the
    shoulders and drifting out behind, turning a little either way as a medal on a thread, drawn in out of smoke and
    falling back to smoke with embers where they form and break (lives of 5, 6 and 8 s, each dividing the clock); none
    while the cloak is still forming.
  - THE GROUND: a pool of shadow to 0.85 m, mist turning in it and drawn in, a dull crimson in the mist under the hem.
  - TORN, when its wearer turns beast (Mac: "rip apart with fragments floating around"): `auraBeastStep` keeps each
    wearer's `torn` - the seconds since the turn (mine, `liveLycanthropy(playerEntity).isTransformed`; a peer's, the
    pose's `wb`), wrapped whole past the tear so the shreds' flights meet themselves, -1 while not turned. Over
    CLOAK_RIP_S (1.2 s) the cape bursts outward, seams split across it on a warped grid and its pieces go one after
    another, embers along every tear; torn through, no cloth is drawn at all. CLOAK_SHREDS (14) scraps of it - shadow
    with smouldering torn edges, half of them with a strip of the opening's wolf's teeth - fly from their places on the
    cape out to float round the beast (0.7 to 1.15 m out, 0.3 to 2.1 m up), going round either way at their own
    paces, bobbing, turning and tumbling; dimmer to the beast's own eye. The emblems fade with the tear. A wearer first
    seen already turned is already torn (no tear replayed); turned back, the cloak kindles again from nothing. Any
    beast form tears it (the wereboar's too - neither body wears a cape).
  - KINDLED: drawn in out of smoke from the hem up, embers along the line it has reached; the ground out from the feet.
    Never seen from inside it: an eye within 0.3 m of the hood's middle (CLOAK_INSIDE_M - the wearer's own first person)
    sees no shadow over the view, the cloth fading in over the next 0.15 m out; a camera over the wearer or a peer at
    their shoulder sees it whole (AUDIT 2). Every rate whole over the
    clock (`cloakRatesWhole`, the shreds' among them), every pattern round a whole number, so no seam and no jump at
    the wrap. THE FOUR HOSTS: `scenes/world.js` WIRED (`auraFrame` hands each wearer's yaw, beast form and saddle;
    `drawAuras` hangs and swings each cape - below); `scenes/worldModes.js` and `scenes/dungeonContext.js` draw through
    world.js's pass, unchanged; `scenes/exterior.js` draws no aura - FLAGGED, unchanged).
  - IT MOVES WITH THE BODY (Mac: "Does this work with the paper doll animations? Like the aura flows with it?", then
    "Tie the cape to animations"). Two halves, both per wearer:
    - THE POSE, off the body's own skeleton: `drawAuras` (after every body is posed and drawn this frame) reads the
      third-person Morrowind body's bones - mine through `player/mwView.js mwViewBodyBones` (`combat/fpArm.js
      thirdBones` / `armBonesInBody`: a bone's posed origin through `rigPointToBody`, the very frame drawThird places
      by its feet and yaw, the race's weight across and height up), a peer's through `net/peerBodies.js bonesOf` (its
      standing body, at the feet and EASED yaw it is drawn at). `auraCapePose` (CLOAK_BONES: both shoulder joints, the
      neck, the head, both knees) gives the shoulders' middle and breadth (CLOAK_SHOULDER_HALF 0.2 m at rest, bounded
      CLOAK_ACROSS 0.8-1.25), the head's middle (CLOAK_HEAD_ABOVE 9 cm past its joint along the neck) and the knees.
      The vertex half hangs the cape from the shoulders where they stand - scaled between the feet and them, so a
      crouch, a stride's bob and a taller or shorter race carry it, gathering out as it is pressed down; the collar
      with the shoulders and the hem half as far; the hood with the head; the cloth as broad as the shoulders (the hood
      the head's own size); and a knee carried past the cloth presses it out round it. `auraCapeStep` places each cape
      where its body is DRAWN (its feet and yaw - mine `player.bodyFeetAt()`, not the camera's smoothed feet), from the
      pose that body was DRAWN in (`fpArm` keeps it: the dungeon poses again before its auras are drawn - AUDIT).
    - THE SWING, off how the wearer moves: `auraMotionStep`, stepped in `drawAuras` for every cloak drawn, whatever
      its body (a rig or a sprite, mine or a peer's), from the feet and facing it is DRAWN at frame to frame - velocity and turning smoothed
      (0.1 s), set where the hem would hang (CLOAK_SWING: 0.05 s of speed behind them up to 0.42 m - a walk's 4 m/s a
      hand and a half; lifted 0.04 m per m/s of fall up to 0.25 m; lagging 0.12 s of turn up to 0.6 rad) and carried
      there on a damped spring (1.2 Hz, damping 0.45: it swings past when they stop and settles). The vertex half
      trails the cloth the more the lower, rising as a pendulum does; lifts and fills it in a fall; lags it round on a
      turn below the shoulders (the fragment half's facing turned with it). A jump of more than 0.5 m in a frame and
      faster than 30 m/s (a door, a teleport, a snapped step, the floating origin moving the world) is no motion:
      nothing is read off it and the swing carries on as it was going (AUDIT 2: first it reset, then it zeroed the
      speed - a sag and a swing back at every floating-origin crossing). A frame on the clock's same tick (a coarsened
      clock) reads nothing; back after more than half a second (a death, the travel view) it hangs still; the spring is
      stepped in sixtieths of a second, so a long frame never blows it up. It never hangs through the legs (below the
      shoulders the cloth is pushed out along its own bearing to 0.15-0.22 m off the body's axis - AUDIT 2: pushed
      along its own direction, a strafe reversed parted neighbours across the axis into a sheet across the legs),
      never swings past 0.7 of its hang (so the pendulum never folds the hem over), swings shorter crouched, and a rise
      never drops it below the feet; a knee's tent is 0.2 m at most.
    - ON A BEHOLDER SPRITE (the EOTB lane, mine or a peer's walker or beast) it hangs from the sprite's figure since
      SERAPH-WINGS v2, as the wings do - its shoulders by the pixel, facing as the sprite faces, folded when sunk to
      the neck (SERAPH-WINGS, AUDIT 3). WITHOUT BONES - first person (which poses no third-person body; nor is the cape
      drawn over one's own view), a peer with no body standing (building, past BODY_RANGE, a doll), the wolf's
      skeleton - it hangs at rest (CLOAK_REST_POSE), my own pressed down to my body's height (`player.height` over
      CAPSULE_HEIGHT - a crouch, a swim - to 0.4 at the least), and swings all the same. Off the bones the shoulders
      stand no lower than that floor and the head 0.18 m over them at least (AUDIT 2: nearer, the collar folds). The head's turn (`uCapeH` w) is carried by the shader
      and pinned, but nothing sets it yet: the head bone's axes in the retail skeleton are not verified here. The
      inventory's paper doll draws no aura. A RIDER's cape is folded away (mine `player.riding`, a peer's pose `rd`):
      its cloth and its emblems not drawn, its pool kept - a cape hung from a standing body would stand through the
      horse.
- **Seen**: in a real WebGL2 - through a scratch preview, not committed: the pass round a stand-in body (a lit floor,
  so the shadow reads; mirrored as the game's projection is) from a third-person camera, behind, in front, beside, at
  three-quarters, close on the hood, half kindled, through the tear and torn, posed (a run's trail, a turn's lag, a
  crouch, a head turned, a stride's knee, a fall's lift), and from the wearer's own eye - and through the committed
  `tools/auraProbe.mjs`, which draws all four auras with no body: 53/53, the cloak's 20 - no GL error; the floor past
  its pool untouched and the pool round the hem; the cloth shading the floor behind it; nothing over the hood's
  peak; the glyph on its back (the wolf lit, beside it dark, in red); the opening's embroidery either side, none
  across its middle and its lining seen through it; the clasp lit; turned with its wearer; no jump at the wrap;
  nothing unkindled against the frame with NO aura; drawn to the waist and not the hood at half, the hood read against
  the lit floor; the emblems aloft; torn (splitting with embers mid-tear, no cloth once through); its shreds round the
  beast; a run's swing; nothing over the wearer's own view (every point read in the frame: an off-canvas read now
  throws); and its two sides by its own winding, unmirrored and as the game mirrors it. (AUDIT: four of its first
  checks could not fail - three own-eye points read off the canvas, "unkindled" compared a frame with itself, the hood
  was read against the black sky, and "open" passed with the opening gone.) NOT SEEN: in a real game client on a real
  body (ARENA2's, the Morrowind rig's or Bloodmoon's wolf).
- Pins: `test/shadowcloak.test.js` (19) - the vocabulary; the grant; the real service end to end (wardrobe and signed
  token); the account card's note (the aura's name, never its key); the token (one carrying every glyph and the cloak
  inside the relay's own bound) and the relay at world167; the law's measures (the hood's height and place, the
  cape's, the opening, nothing of the projection left, the mesh's every cell two triangles tiling it); the emblem as
  the badge's own path (the edges closed; the shader's inside the path's; nonzero and even-odd agreeing; a cubic, a
  line or curve before a move and an edge that rounds to nothing refused); the vertex half (facing, back drape,
  squash, the hood round the head, folds, the emblems rising and their cards' handedness, the burst, the shreds'
  flights and their wrap); the cloth (the opening and the collar, its sides by the bent mesh's winding, outside and
  lining, rim, the glyph on its back and its eye, the clasp, the mantle, the embroidery and none down the collar, the
  torn hem's trailing smoke, the back trailing longest, the first person, the kindling and its embers, the wrap); the
  tear (seams first, pieces by three quarters, none through, and `auraBeastStep`); the ground; the emblems and
  shreds (the opening's teeth on half the shreds); the draw (farthest first; premultiplied; the lining with front faces
  culled, then the outside with back faces culled; the emblems before the cloth for an eye in front, the shreds after it
  always, none of it with the ground's depth offset; no cloth round the wearer's own eye; the shreds' cards only once
  torn and alone once through; a rider's cape folded; the frame's
  state handed back on a throw); the hosts; the pose (crouch, lean, head and its turn, breadth, trail, pendulum,
  twist, lift, knee, the billow, the vertices' wrap, never below the feet, a knee's tent capped); the winding (every
  cell outward and unfolded at rest and under the strongest poses; a strafe never through the legs); no `pow` of a
  negative base anywhere the cloak's shader runs; and the swing and the pose from the body (the spring, the rig's
  frame against drawThird's own model, the bones, the placing, the crouch, a peer's bones off its standing body).
  All of the shader RUN in `test/glsl.mjs`. `tools/mutants/shadowcloak.json` (150, all dead). The vocabulary's
  newest-word and one-list pins in `aegis.test.js` and `primarch.test.js` moved (PIN MOVED), `shadowfang.test.js`'s
  wardrobe holds the cloak; the relay's pins moved to world167 crediting SHADOW-CLOAK (`auditbounty1.test.js` holds the
  credit), the account's to acct80 (past SERPENT1's world165 and acct78, then the relay past SERPENT2's world166 and the account past GLOBAL-MARKET's acct79, at the merges of main). Re-aimed by
  content, all dead: `aegis.json` (4), `primarch.json` (4), `wb9g.json` (1) and the version records in `soc1.json`,
  `gatekeys.json` and `fb1004d_knight_house.json`. The revisions changed nothing on the wire: the relay and the account
  are world167 and acct80.
- **AUDIT** (Mac: "Tie the cape to animations and also perform a comprehensive audit"): four read-only lenses over the
  whole of it - the grant, the wire and the deploy; the frame's wiring in its hosts; the shader and the draw; the pins,
  the mutants, the probe and the docs. Found and fixed:
  - BLOCKER: the aura draw call had landed after a `//` on its own line in `drawAuras` when the cape's pose was wired
    in - no aura of any kind would have been drawn - and the hosts pin's `[^\n]*` read through the comment. Moved out;
    the pin now reads the line's code half and a mutant comments the call out.
  - The version: main's SERPENT1 took world165 and acct78 first - renumbered to world166 and acct79 at the merge; then main's SERPENT2 took world166 - the relay renumbered to world167 at the next; then main's GLOBAL-MARKET took acct79 - the account renumbered to acct80 at the merge before the pull request.
  - The side split (above), the farthest-first order (a farther cloak's shadow or a farther aura's light used to lie
    over a nearer cloak), the emblems before the cloth for an eye in front of the wearer, no cloth worked out round
    the wearer's own eye, the shreds' cards alone once torn through, the frame's state handed back in a `finally`.
  - `pow` of a maybe-negative base (the cloth's radius at its back half took one - undefined in GLSL; a driver's
    exp2/log2 answers NaN): squares written as squares, the rim's base clamped, and a pin over every pow the cloak's
    shader takes. The ground's quad answers nothing past its pool, no `atan(0,0)`; an emblem card works nothing out
    past its disc or while it shows nothing.
  - The swing's floating-origin pop, the trail through the legs, the crouched fold, the hem below the feet, an
    unbounded knee tent, the dungeon's one-frame pose lead, the rider's cape, the swing read off a raw yaw while the
    body turns on an eased one (now stepped where the cape is drawn).
  - The account card said "Wearing shadowcloak." - its key (`ui/accountFlow.js`, every aura); now its name. The
    `aurasHeld` comment named the wrong order. The hem's embroidery band lay wholly inside the hem's fray and was never
    seen: removed.
  - Pins that could not fail (the hosts regex, "the mesh whole", "just below the hem, smoke", four probe checks) made to
    fail; laws with no pin or mutant (the billow, the kindle's embers, the shreds' teeth, the back trailing longest,
    first-seen-already-torn, the fog on the shadow) pinned.
  - The neighbours' pins, run after: the yaw's step had its own whole-turn wrap (ONCRASH1 C2's one home is
    `world/mat4.js` wrapAngle - now used, with a pin turning across the half turn and a mutant taking the long way);
    a `peerBodies.js` comment naming the rig's singleton tripped MWBODY1's "never the instance" (reworded); PRIMARCH's
    draw pin read the old nearest-first order (now farthest first). The shader's trail cap had no pin a clamped swing
    could reach: the winding pin now flings it past its reach.
  - Left as they are, said here: the fragment half measures the cloth in its rest-pose metres, so a crouch squashes
    the back's emblem to the crouch's height; an off-screen peer body keeps its last pose (as its skin does); a gear
    rebuild hangs the cape at rest for those frames; the head's turn is carried but unset.
- **AUDIT 2** (Mac: "Audit everything"): five read-only lenses over the whole branch - the shader and the draw (in real
  WebGL: transform feedback, a half-float NaN scan, A/B renders); the runtime that feeds the cape; the grant, the wire,
  the deploy and both merges of main; the safety net (hand mutations in a copy); the docs and the process. Found and
  fixed:
  - The cloth's "inside" was the eye's distance from the wearer's AXIS, flat: a third-person camera looking down from
    past about 70 degrees ghosted its own cape (none at all close in), a peer within 1 m faded and within 0.55 m was
    gone, a peer below the eye was never drawn. Now the eye's distance from the HOOD'S MIDDLE, in three dimensions (0.3
    m, fading over 0.15 m) - in the draw and in the fragment half alike.
  - The fragment half read `uCapeH`, which only the vertex half declared - a stage a driver refuses, and the one program
    is all four auras (caught by the new eager compile below before it shipped; declared).
  - The swing: a coarsened clock's repeated tick zeroed the speed every other frame (a run trailed a tenth of its
    trail); a floating-origin crossing sagged and swung back; a 1-3 m placement read as 60-175 m/s and flicked the hem;
    back after a gap the old trail swung on. All as above.
  - The legs' push along the cloth's own direction (above); the pose off the bones floored (above) and the shader's
    hang never negative (0/0 at a pose at the feet).
  - The cloth and its cards drew with the ground's depth offset (-1, -4): slivers over a body before it. Off for them.
    Tearing, the shreds were laid before the cloth for an eye in front and lay under its shade: now after it.
  - `peerBodies.bonesOf` called the rig unguarded, the one rig call there without AUDIT MWBODY A1's catch: caught.
    The swim's height now presses the sprite body's cape too (it read `player.crouching`). No pose object per drawn
    body per frame, no closure per cloak.
  - The first merge of main had kept the account's whole version history twice (107 KB on the line): once now. The arc
    said the account renumbered past SERPENT2: the relay alone did.
  - The net: nothing compiled each stage whole - `test/glsl.mjs` compiles a body on its first call, with the test's
    bindings standing in for any name, so a stage reading another's uniform passed; `eager` now compiles every body at
    load and the cloak's stages are compiled bare, and the evaluator refuses a keyword or reserved word as a name (the
    fix above first named a variable `out`). The shared rest pose's two guards, the spring's substeps, the swing's
    three caps, the floors, the opening's narrowing, the swim's floor were unpinned - pinned; the host pins matched
    through a leading `//` - they read code now; three probe checks could not fail (over the hood's peak against black
    sky, an unkindled point in the sky, the shreds counted off the ground's pool) - read against the lit floor and off
    the pool. 24 mutants added, 19 re-aimed: `shadowcloak.json` 150, all dead.
  - Docs: the hem's teeth (the band is the opening's), "THE FOUR HOSTS, untouched" (world.js is wired), far/near for
    the culled sides, world165 in the Testing row, a pronoun in `shadowfang.test.js`, five cites main already had wrong
    (`fpArm.js` drawThird and its refold, `mwView.js` mwViewDrawBody and its drawThird, `world.js` the two body calls,
    `fpArm.js` clipSweepTimes).
  - Left as they are, said here: a compile failure or a slow compile of the one program takes all four auras with it
    (the eager compile and the probe are the guard); the off-screen peer's pose, the gear rebuild's rest frames, the
    emblem's crouch squash and the unset head turn as above.

## SERAPH-WINGS — the developers' own: the Seraph Wings (2026-10-05, world168, acct81)

Mac, sending a painted angel whose wings are long ribbons of golden light: "So I want to build an aura for the
developers. These are based off this image above. Golden Angel wings that flow"; then "Just want to make sure this
properly attachs to the back of the eye of the Beholder skins + morrowind skins" and "I want this to be insane". The
wings are drawn from that idea - plumes of flowing light out of the back - in the pass's own shader; nothing of the
painting is used.

- **The grant** (`server-account/src/titles.js`): `DEVELOPER_AURA = 'seraphwings'`, held while the handle is in
  DEVELOPER_HANDLES - the developer title and glyph's own list, read off the config at every ask as they are -
  case-folded, never a guest's, gone from the next token once the handle is off it. `aurasHeld` gives the listed
  titles' auras first (TIER_AURA), then the wings, then what the Broker sold. Held is not worn: a developer wears them
  from the account card's Aura row, as every aura is.
- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): `seraphwings` joins AURAS last. A relay before it
  refuses a token carrying it (`claimsValid`), so the relay is **world168** and the account service **acct81**; the
  account deploy waits on the relay's `/health` to serve world168 (SHADOW-FANG's AUDIT B1). No frame changes shape. A
  token with every glyph and the wings stays inside the relay's 640.
- **The face** (`src/ui/playerBadge.js`): "Seraph Wings" (`AURA_TEXT`); the button in the Founder's gold (`AURA_PAINT
  seraphwings: 'founder'`) - the wings' own colour, where the developer title's paint is a red.
- **The look** (`src/render/auraRing.js`, the fifth: `AURA_LOOK.seraphwings`, kind 4, its own mesh `wings`, added whole -
  light, never a shadow):
  - THE WINGS: two layers a side - WING_PLUMES (8; 9 before WINGS-FIT) long primaries fanned from below level (-0.7
    rad) to high over the head (1.25 rad), the high ones long (WING_REACH 0.6 - 1.3 m; were 0.95 - 2.2), and inside
    them WING_COVERTS (4; was 6) short coverts (WING_COVERT: 0.28 - 0.5 m; were 0.45 - 0.8) that give a wing its
    body, softer. Each plume a broad strand
    (0.12 m with its glow's sheath; was 0.34) and two fine ones (0.035 m; were four, 0.08) bundled about it as a
    feather's barbs; ribbons of WING_SEGS (32) segments (`auraWingsGrid`, 72 strands; were 150), laid along a curve
    out of the upper back - rising first, then out along the
    plume's angle, the tips drooping as a long feather's do - turned to the eye along their length.
  - THEY FLOW: waves run out along each strand (1/4 Hz, and a flutter at 1/2 Hz on every strand); the fan breathes (1/6 Hz);
    and every eight seconds THE BEAT (`wingBeat`, WING_BEAT): a slow stroke, the fan swept down and its tips forward,
    fast down and slow back up, the tips after the roots - the light flaring with it. In the fragment half noise and a
    pulse of light run out along each strand; gold (WING_RGB), white-hot at the heart, amber at a frayed edge, the tips
    burning as they fray; faint where they leave the back.
  - THE BACKLIGHT: one card of radiance behind the upper back (WING_HALO_M 1.2 m; 2.6 before WINGS-FIT), square to the eye - a soft gold glow,
    white at its heart, rays turning slowly in it (1/30 Hz and 1/15 Hz), flaring with the beat.
  - THE SPARKS (WING_MOTES 24; 0.04 by 0.18 m since WINGS-FIT, were 0.05 by 0.26): streaks of light riding a strand out and past its tip, long along their way as the eye
    sees it and brightest at their head; their lives (3, 4, 5 s) dividing the clock.
  - THE GROUND: a faint pool of gold beneath (WING_POOL_R 1.0 m; was 1.3).
  - THE LIGHT ON THE WORLD (`auraWingLights`, WING_LIGHT): a gold carried light behind the shoulders of the nearest
    three wearers within 40 m of the eye (4.5 m as kindled, at seven tenths - WINGS-FIT; was 7 m), fed into every host's light list through world.js
    `peerTorchLights` - the open world's (where the city's light colour stands for every carried light) and the
    dungeon's and the building's (where it is gold: the light is tagged `aura`, and the dungeon's flame tint,
    worldModes.js `_dgTint`, passes it by - AUDIT 3; in the abyss with its torches out it stays, halved by the
    candle's law, as an aura is no torch). None while the wings are closed (below).
  - Unfurling from the root as they kindle (the backlight and the sparks after them); nothing laid over an eye standing
    among them (the wearer's own first person); drawn without the ground's depth offset. Every rate whole over the
    clock (`wingRatesWhole`).
- **On the back, both bodies:**
  - THE TORSO: every point is laid along the torso's own axes (`uTorsoU`, `uTorsoF` - `auraTorso`, carried on the pose
    as `torso`): up the spine (`bip01 spine2` to the neck, joined to CLOAK_BONES; the neck to the head without it),
    across the shoulders, forward out of the chest square to both - so the wings lean as the back leans and turn as
    the shoulders turn. Upright where the bones cannot say, or where a back would be upside down.
  - A MORROWIND BODY: its posed bones as drawn (fpArm.thirdBones mine, peerBodies.bonesOf a peer's) - the shoulders'
    middle (`uCapeS`, its breadth setting the roots apart), the torso above.
  - AN EYE OF THE BEHOLDER SPRITE has no bones: what stands for them is read off the frame drawn (`auraSpriteBones`,
    EOTB_FIGURE) - its base over the feet, its metres a pixel, its form and its facing (player/eotbBody.js `figure()`,
    handed to player/mwView.js through the sprite's door and kept as `mwViewSpriteFigure()`; a peer's walker's or, on
    foot, a beast's `figureOf`, net/peerRiders.js). AUDIT 3: BY THE PIXEL - the shoulder line 86 px over the frame's
    foot (the sets' own measure 78 - 88 px whatever the frame holds: Idle 88, IdleMelee 80, IdleSpell 84, IdleRanged
    87 - about 1.63 m at 0.019 m a pixel), the neck 91, the head's joint 96 and the upper spine 75; a beast's frames
    at 0.68 of that (1.70 m at 0.029 m a pixel, measured 1.65 - 1.74); as broad as its metres a pixel are to 0.019 m
    (within bounds). The first cut put the shoulders at 0.8 of the frame's HEIGHT, and a frame is as tall as what it
    holds - a sword up, a staff, a hand raised to cast (to 174 px): with a weapon out they hung 0.3 - 1 m over the head
    and jumped as it was drawn or sheathed. A crouch sinks them with the sprite. None read off a rider's frame (the
    horse's too) nor the first-person billboard's (it stands on the camera: its figure lifted the cloak's hood off the
    eye and the cloth was drawn round it - AUDIT 3). FACING: my own sprite's - eotbBody's UpdateOrientation facing,
    `figure().yaw` - not the camera's (AUDIT 3: walking back, the sprite showed its face and the cloak and the wings
    faced away over it; strafing they were a quarter turn off); a peer's walker and their aura already read the same
    `peerBodyYaw`. SUNK: a figure whose shoulders fall below the crouch's floor (swimming, the quad's top at the
    waterline) is `sunk` - the cloak folds and the wings close, unlit, as on a rider (AUDIT 3: hung at the floor, they
    floated over the swimmer).
  - A RIDER WITHOUT BONES hangs them from the rest pose lifted by the saddle (AURA_SADDLE_M 0.81 m: RIDE_EYE_HEIGHT less
    EYE_HEIGHT).
  - And swung as the cape is (`auraMotionStep` - `uSwing`: a run's trail sweeping them back the further out, a fall
    lifting them, the roots where they were).
- **The hosts** - THE FOUR HOSTS: `scenes/world.js` WIRED - the draw hangs and swings every look with a mesh of its own
  (`auraLookOf(w.aura).mesh`), mine off my rig else my sprite's figure, a peer's off their rig else their walker's
  figure (a walker's, or a beast's on foot); the wings' light rides `peerTorchLights`; `scenes/worldModes.js` WIRED
  (AUDIT 3) - it builds the dungeon's light list from `host.peerLights` and its flame tint now passes an aura's light
  by; `scenes/dungeonContext.js` draws through world.js's pass, unchanged; `scenes/exterior.js` draws no aura -
  FLAGGED, unchanged.
- **Seen**, in headless Chromium's WebGL2 through the pass itself over a stand-in body: behind, in front,
  three-quarters, beside, from above, half kindled, running, mid-beat, on a 2.09 m Beholder frame and on a Morrowind
  torso leaning into a run; and through the committed `tools/auraProbe.mjs`: 62/62, the wings' 9.
- Pins: `test/seraphwings.test.js` (19 since AUDIT 3) - the vocabulary; the grant; the service end to end; the account card's note;
  the token and the relay; the law (rates whole, the mesh, the fan); the vertex half RUN (roots, sides, the fan's order,
  none in front, the facing, ribbons turned to the eye, waves beyond the breath and along each strand, the breath, the
  roots still, the wrap); on the body (pose, breadth, trail, lift); the light RUN; the ground and the sparks; no pow of a
  negative and no NaN; the draw (the mesh, farthest first, added whole, the offset, the wings' own mesh, each wearer's
  torso); the hosts (mine off my rig else my sprite, a peer's likewise); the Morrowind back (the torso's axes, a lean, a
  turn, its guards, the wings along it); the Beholder back (the figure's shoulders, a crouch, a beast, a peer's, the
  sprite's own `figure()`, the plumbing, the saddle); the coverts and the beat; the backlight and the sparks; the light
  on the world. `tools/mutants/seraphwings.json` (75, all dead; 93 since AUDIT 3). The relay's and the account's pins moved to world168
  and acct81 crediting SERAPH-WINGS; the vocabulary, paint, flames, version and host-line records re-aimed by content.
- Left as they are, said here: not seen in a running game client with a real body (the probe and the previews draw a
  stand-in); the wings stay on a wearer turned beast (a beast's sprite frame carries them higher) and on a rider;
  from first person, looking to the side or behind, the wearer sees their own wings - only what stands in front of
  the eye is spared; the sprite figure's shoulder line is one measure for every set and every frame (within a hand of
  each - AUDIT 3); outdoors the wings' light takes the city's light colour; one program draws all five auras, so a
  compile failure would take them all (the eager compile and the probe are the guard).

### AUDIT 3 (2026-10-05, Mac: "1. Audit this 2. Ensure Sir Mcmobdens new aura also appears on the eye of the Beholder 3. Ensure other players can sew all auras")

Five lenses: the shader and the draw, the attachment and the cloak on a Beholder sprite, the peers, the test net, and
the grant, versions and docs. What they found, and what was done:

- **OTHERS SEE AN AURA WORN NOW, NOT AT THE NEXT AREA (AURA-LIVE, `src/net/online.js` `rehello`).** The relay reads a
  badge - the aura, the title, the glyphs - off the token alone, and a token rides a hello, so an aura put on at the
  account card or the Broker lit at the wearer's own feet at once and at nobody else's until they changed area (the
  Broker even said so: "Others see it once you change area."). Now each open socket - the room's and every halo's -
  says hello again on a fresh token, through a NEW socket of the same id: the relay already takes that as a reconnect
  (the old socket loses the id and is closed CLOSE_REPLACED with no leave said, the first hello's stamp is kept so a
  host keeps its seat, and the new hello's join is fanned - every peer reads it as the badge now, `_refresh`). The old
  socket speaks for the room until the new one's token is minted (`_promote`), so nothing goes unsaid but a hello's
  round trip; its replaced close is ignored (it is no room's by then), so it is never the one-seat verdict; a
  replacement whose room went while it minted is closed, one the relay refuses takes the old socket with it and the
  ordinary retry says hello, one that never opens is dropped past the longest backoff. At most once a REHELLO_GAP_MS
  (3 s), the latest badge. No relay change, no version: the relay's own reconnect law does it. `scenes/world.js`
  asks for it when my aura (`ownAura`) differs from the one the last minted token said (`_auraHeard`, set by the
  minter's hook) - so a mint, which said it already, asks nothing. Pinned end to end through the real Room
  (`test/auralive.test.js`, 6): a peer draws it, no leave, the host's seat kept, not superseded, taken off the same
  way; a run of changes one hello; a halo's socket too; the refusals.
- **The draw cap 32** (AURA_DRAW_MAX, was 16 - a hub's crowd is more than sixteen, and the seventeenth wearer in reach
  was drawn by nobody); **a peer who blinks out of the list keeps their kindling** for AURA_FORGET_S (2 s) - it was lit
  again from nothing at every frame without their pose.
- **The Beholder sprite** (the cloak and the wings alike - the cloak hangs from the same figure since v2, and its
  record in SHADOW-CLOAK now says so): BY THE PIXEL, not the frame's height; my own sprite's FACING; none in FIRST
  PERSON; SUNK in water folded and closed; a beast's figure on foot, mine and a peer's (above).
- **The radiance's inside fade is 3D** (`outside` - out of the column, over or under it too: a camera high over a
  wearer saw no column, judged by the distance across the ground alone).
- **The wings' light in a dungeon is gold** (tagged `aura`, passed by the flame tint) and none while closed.
- **The net:** a crouched or mounted wearer's upright back (a zeroed torso collapsed every strand onto the shoulder,
  unpinned); a back laid flat; a peer's figure driven through the real layers; the light off the pose's shoulders; the
  saddle pinned to the motor's (RIDE_EYE_HEIGHT less EYE_HEIGHT). `tools/mutants/seraphwings.json` 93 (18 new),
  `tools/mutants/auralive.json` 12, `primarch.json` one more (the inside fade by the ground alone); records re-aimed
  by content (the shoulder line, the frame's height, the crouch, the light's aura, the symbols, my facing, the flames);
  ACC1d's late token recorded equivalent - the promotion's own guard (`_promote`) refuses a replaced socket's hello too.
- **Docs:** the cloak on a sprite (SHADOW-CLOAK and Rendering.md no longer say it hangs at rest there), the probe's
  count (the wings' 9), the flutter (every strand's), the header of `auraRing.js`.
- **Left as they are, said:** a rider's cloak stays folded (v1's own law - "It folds away while you ride"), the wings
  over the saddle; the sprite's cloak is centred on the feet, and some frames draw the torso up to 0.2 - 0.4 m aside;
  the hood's radius does not scale with BillboardScale; my own cloak and wings are drawn whole while I am concealed
  (a peer's are hidden with them); the sprite figure's objects are made each frame (a handful of small objects per
  wearer); an old relay that does not know an aura refuses the whole token (the deploy order - the relay first -
  keeps that from happening); a client older than an aura draws none for it.

### AUDIT 4 (2026-10-05) - the shader and draw lens, landed after the merge of AUDIT 3

- **THE BACKLIGHT OVER THE WEARER'S OWN EYE.** The card is 2.6 m across and square to the eye, its middle about 0.36 m
  from the first-person eye; looking down, its lower half hung in front of the feet and washed the view gold (measured
  in a real WebGL: 41% of the frame brighter at 85 degrees down) - `wingNear` spared only what lay within 0.9 m. It now
  fades by the eye's distance from its middle (WING_HALO_NEAR 0.9 - 1.6 m, carried to the fragment half in `vS.x`):
  gone from the wearer's own eye, whole from a third-person camera's or a peer's at arm's length.
- **A STALE `sunk`** (AUDIT 3's): the rest, crouch and saddle path reused the pose and never cleared it - a swim and
  then a ride kept the wings closed and unlit, and the cloak folded, for the whole ride. Cleared there.
- **THE TIP'S BOWTIE:** the last segment's tangent was taken backward, so its across flipped at the tip and its two
  triangles crossed (faint - 7% of a strand's peak at most). Forward at the tip too.
- **HARDENING:** no `pow` of a negative in the backlight's rays (a cos a hair under -1); the strand's index math kept
  whole (`floor((k + 0.5) / n)`, no `mod`) for a GPU that divides through a reciprocal.
- **Checked clean:** both stages compile and link; no NaN or Inf over 564 scenes into a float target; the draw ranges
  exact; the GL state handed back the same for all five auras; every rate whole; the other four auras bit-identical
  to main over 80 frames; the cloak right on the taller sprite poses.
- **Left as it is, said:** the wings are the heaviest look per wearer after the cloak (about 1.9 screens of fragments
  for one wearer 3 m from the camera; estimated about 1 ms on a mid-range desktop GPU and 4 - 6 ms on an integrated
  one at 1080p, close up) - only the developers wear them. Cheaper ways are recorded for a later pass: the broad
  strands' noise per vertex, a smaller backlight, an indexed mesh, broad strands alone past 12 m. The sin hash's large
  arguments (the sparks') hash coarsely on some mobile GPUs.
- Pins: `test/seraphwings.test.js` 20 (the backlight's fade from the eye; a swim then a ride or a crouch, open and lit;
  no strand twisted at its tip); `tools/mutants/seraphwings.json` 97 (four new, one re-aimed). The probe 62/62.

### WINGS-FIT (2026-10-05, Mac: "the wings should sit farther back on the eye of the beholder skin. Currently it attachs way to close and clips on certain rotational directions instead of moving with rotation. Also, the aura itself is WAY too bright. It really needs to match this and the slimness of the wings"; then "I also think theyre way to long, too large and overbearing")

Sent with the reference painting again: slim ribbons of pale gold, apart, with dark between them, and a faint glow
behind the head.

- **WHY A BEHOLDER'S WINGS CLIPPED.** The sprite is a flat card through its feet, square to the eye, and it writes
  depth over its whole figure. The wings rooted a hand (WING_ROOT.back 0.12 m) behind the card's axis - inside the
  body as it stands - so seen from a side or a three-quarter the near wing's root stood inside the body's outline on
  the screen and nearer the eye than the card: laid over the body with a hard edge where the strand passed through
  the card. Measured through the vertex half (the shader RUN, 40 points a strand, every strand): from 45 degrees off
  the front round to the side, 7 - 981 points of a wing nearer the eye than the card and inside the body's outline
  (0.25 m of the axis, under the head); rooted deeper, none from the front round to 97.5 degrees (the nearest 0.31 m
  from the axis) - past that the eye is behind the wearer and the near wing nearer it than the body. Seen in headless Chromium's WebGL2 over a stand-in flat card from eight
  bearings, before and after.
- **THE FIX** (`render/auraRing.js`): a sprite's wings root WING_SPRITE_BACK (0.25 m, as big as the sprite is drawn)
  further back - `auraSpriteBones` gives it as `wingBack`, `auraCapePose` carries it on the pose (0 for a rig's bones,
  which have a back of their own; a pose reused from a sprite drops it, and the rest, crouch and saddle path clears
  it), the pass uploads it (`uWingBack`) and the vertex half roots every strand and the backlight that much deeper;
  the light on the world sits behind the roots where they are. A wing crosses the card no nearer the axis, as the eye
  sees it, than its own depth behind the axis (`|z| / sin` of the bearing) - past the body's outline. A Morrowind body
  is unchanged.
- **AND TURNING WITH IT** (`player/eotbBody.js` `figureYaw`): a sprite facing nowhere yet (Vector3.zero - before a
  first walk or placing) shows the eye its FRONT (ARENA-FIX 14), but its figure answered no facing and the camera's yaw
  stood in: the wings hung on the eye's side, over the sprite's face, and turned with the camera round it. It now
  faces the eye there, so the wings hang behind it.
- **SLIM, SHORT AND SOFT, to the painting:** about six tenths as long - the primaries 0.6 - 1.3 m (were 0.95 - 2.2,
  a span of four metres over a two-metre body; now about the body's height), the coverts 0.28 - 0.5 m (were 0.45 -
  0.8), the pool 1.0 m (was 1.3), the sparks 0.04 by 0.18 m (were 0.05 by 0.26); three strands a plume (one broad, two fine; were five), a third as broad (0.12 m
  and 0.035 m; were 0.34 and 0.08), eight primaries and four coverts a side (were nine and six) - 72 strands, 13,824
  vertices (were 150, 28,800); each strand's light about half (its sheath 0.1, its glow 0.32, its heart 0.42 - 0.70 with
  the pulse; were 0.22, 0.55, 0.6 - 1.2) and the beat's flare 0.25 (was 0.4); the backlight 1.2 m (was 2.6) and about a
  third as bright; the pool under half (0.07); the sparks softer; the light on the world 4.5 m at seven tenths (was 7 m
  at full). A strand's heart at its brightest over the clock 1.34 (was 2.70), the backlight's 0.96 (was 3.65), the pool
  0.15 (was 0.33).
- Pins: `test/seraphwings.test.js` 21 - WINGS-FIT's own (the depth carried, dropped and uploaded, the roots there, THE
  LAW from the front round to either side and many at the old depth, the backlight and the world's light behind the
  roots, the slimness, the length and the light's caps; the low plumes short in the shape);
  the figure facing nowhere facing the eye; the pool and the world's light re-pinned dimmer; a turn's sweep of the
  shorter tip (0.15 m for half a radian; was 0.3). `tools/auraProbe.mjs`: the wings' grid every 0.1 m (slim strands
  fell between a 0.2 m grid's points), out either side and over the rest pose's crown, and nothing past 1.6 - 1.8 m
  (their reach; at 2.2 m those points lay inside it). `tools/mutants/seraphwings.json` 115,
  all dead (eighteen new; eight re-aimed by content - the root, the heart, the figure, the backlight's place, rays and
  heart, my facing, the light's pose). One older record, every plume as long as the highest, survived the shorter wings
  (its only killer was the lowest tip's height, off the ground at 2.2 m but not at 1.3) - pinned now in the shape:
  the lowest primary under seven tenths of the highest. The backlight and the light on the world behind a sprite's
  roots, pinned. The probe 62/62.
- **Left as it is, said:** from the side a Beholder's wings now start a hand behind its back, where a Morrowind body's
  leave the back itself (the card cannot hide a root nearer it); from a back three-quarter the near wing still lies
  over the body - it is nearer the eye than the body there, as it would be; at the beat's height the tips sweep
  forward and from the side the near one passes in front of the body - it is in front of it; the body's outline in
  the law is one measure (0.25 m either side) for every set, not read off the frames; not seen in a running game
  client with a real sprite.
