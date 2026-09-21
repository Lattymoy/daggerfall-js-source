# Accounts and cloud saves (ACC)

ACC0 — the design record, 2026-09-21. **Nothing below has shipped.** This
page is the shape agreed with Mac before any code, and it says what is
decided, what is lifted from another repo, what is genuinely new, and
what is still open.

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

**The account service ADOPTS the existing id.** It is already durable,
already the player's, and already has a secret only they hold — which is
precisely the state `/v1/auth/guest` leaves a new Fight Life player in.
A first contact that presents a known `(id, secret)` pair becomes that
account's first session rather than minting a new row, so friend lists
and parties survive untouched.

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

## BEFORE ANY OF IT

The Cloudflare API token for this account **has still not been
rotated.** It was pasted into a chat and has been live since. This arc
puts D1 and R2 on that same account; standing up more behind a
credential that is known to be exposed is the wrong order of work.
