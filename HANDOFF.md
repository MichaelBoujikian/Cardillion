# Handoff — Cardillion

For an agent picking this project up cold. Read this, then `CLAUDE.md` (the standing rules),
then the `spec.md` section for whatever you build next. Written 2026-09-15 at commit `e9b0540`.

## What this is

A single-player card-battler roguelike in the browser: cheerful cyborg garden bugs (cards) versus
grim, realistic vermin (enemies). Slay-the-Spire bones; an Inscryption-dark far side of the screen
fading into a Diceomancer-bright near side. Owner: Michael (`MichaelBoujikian` on GitHub). He
directs, agents build; he judges results by eye and approves art in batches.

- **Play it:** https://michaelboujikian.github.io/Cardillion/ — deployed from `main` on every
  push by `.github/workflows/deploy.yml`. Repo is **public** (Pages needs it on his plan).
- **Design source of truth:** `spec.md`. Vocabulary: `CONTEXT.md`. Why-decisions: `docs/adr/`.
- **Stack:** TypeScript · Vite · three.js · Vitest. Node 24 on Windows 11, Git Bash.

## Where things stand

| Milestone (spec §13)    | Status                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| M0 scaffold             | done                                                                  |
| M1 look prototype       | done — owner passed the engine gate; web + three.js is settled        |
| M2 first playable fight | done                                                                  |
| M3 run loop             | done — title → map → fights/rewards/shops/cocoons → the Bear → result |
| M4 content              | done — 14 cards, titled unlocks, upgrades, Wormillionaire, markers    |
| **M5 systems**          | **next** — save/resume, seed entry, settings, reduce-motion (§10)     |
| M6 art                  | effectively done early: all 31 assets generated and approved          |

87 tests pass; `npm run check` is green; CI and the Pages deploy are green.

Nothing has been balanced. Every number in the spec is a first guess marked _(tuning)_. The
owner has played the live link but has not yet given balance notes.

## What M5 needs (spec §10)

- Single autosave slot in `localStorage` (`cardillion.save.v1`), written after every engine
  action, deleted on death/victory/abandon. `RunState` is already plain JSON with every RNG
  stream's state inside it, so a save is `JSON.stringify(run)` — the work is in `src/save`
  (empty layer, see its README), a **Continue** button on the title, and versioning so an old
  save is discarded with a notice rather than crashing.
- Seed entry already exists on the title screen (`?seed=` also works); show the seed in
  settings with a copy button.
- Settings (`cardillion.settings.v1`): screen shake, reduce motion/flashing (disable grain,
  shake, Greeble shimmer; keep vignette), fullscreen, show seed, abandon run, reset save.
- Build it engine-first like everything else: the save adapter and settings store are pure and
  testable; the UI is thin.

## How to work here (the parts CLAUDE.md doesn't say)

**Owner's style.** He answers rounds of questions with "go with your recommendation", so offer
one clear recommendation per question. When he asks _what the next step is_, answer — don't
start building. He wants generated art shown to him (contact sheet) before it is committed, and
wants to be walked through any account/API step. His messages are often speech-to-text; ask
when a word doesn't parse.

**Pushing.** `gh` is authenticated but configured for SSH, and github.com's host key isn't
trusted on this machine. Push with:

```bash
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
```

Commits go straight to `main` with the attribution line the session gives you.

**The Bash tool truncates long commands** (~8 KB); the failure looks like an unterminated
quote and nothing in the command runs. Use the Write tool for big files and keep heredocs
small. Three agents lost time to this in one day.

**Verifying visuals.** Start the `dev` launch config (`.claude/launch.json`), open the Browser
pane, screenshot. URL overrides for a run: `?seed=` `?deck=cat,cat,roly-poly` `?hp=999`
`?crumbs=500`. In dev, `window.__cardillion` exposes `controller`, `screens`, `autoFight()` and
`autoRun(stopAt?)` (plays a whole run from the console; `autoRun('shop')` stops at the first
shop). `controller.run` is a plain object you can replace from the console to stage a
situation, e.g. `c.run = {...c.current, snailNode: nextId}` before dispatching a travel.
The browser JS tool times out at 45 s — poll long runs with waits. The console shows a few
stale errors from old HMR loads (`glow before initialization`, `faces.face`) — ignore them; a
fresh navigation clears them.

Useful seeds: `g52` (trail 0 is fight, fight, shop, cocoon; a strong deck wins it in ~2 min of
autoplay), `s0` spider, `s5` scorpion, `s3` possum, `garden1` two rats plus a Greeble.

**Art.** `docs/art-pipeline.md` is complete. What you need to know beyond it: the owner's
OpenAI key is in the gitignored `.env` on his machine (never print it); the Cat cards portray
**his real cat** from `art/refs/owner-cat.png` (gitignored — without it those two cards can't
be regenerated on another machine); every asset renders on a chroma screen and is keyed out
by the tool because the API's transparent mode drops thin dark limbs; `npm run art:optimize`
must run after new PNGs so `public/art/*.webp` (what the game loads) is current. Total spend
so far ≈ $10.

## Architecture in one screen

```
src/engine/   pure rules. rng.ts (seeded, forkable) · types.ts · combat.ts (fight reducer,
              CombatMods carry upgrade effects) · map.ts (three signposted trails, two
              crossings, fog) · run.ts (run reducer: travel, rewards, shops, upgrades, the
              roaming Greeble and wandering Snail markers)
src/content/  data tables: cards.ts (14 + Cobweb) · enemies.ts · encounters.ts · trails.ts ·
              upgrades.ts (titled unlocks, general upgrades, Wormillionaire)
src/render/battle/  three.js table scene (scene.ts), post-processing (post.ts), textures and
              card faces (textures.ts — also finds enemies' glowing eyes in the art)
src/ui/       battle-ui.ts (hand, HUD, drag/click targeting) · run-screens.ts (title, map,
              reward, shop, cocoon, result, deck list) · card-faces.ts (shared face cache)
src/app/      index.ts (boot, dev hooks) · run-controller.ts (dispatch → animate → screen)
              · animate.ts (plays combat events as animations with a running ledger)
src/save/     empty — M5 lives here
tools/        gen-art.mjs (OpenAI Images + chroma key) · art-preview.mjs (checkerboard
              previews + alpha stats) · art-optimize.mjs (PNG masters → WebP)
```

Rules that matter when you touch it: the engine emits **events** and the renderer only
animates from them (ADR 0003); content names every image it uses (`art`, plus `upgradedArt`
on Cat/Wormillion and `deadArt` on the Possum) and `src/app/index.ts` collects those ids for
the loader — a new image means a new field or list entry, never a naming convention the
loader guesses; randomness only from `Rng` streams (`map`, `encounters`,
`combat`, `rewards`, `shop`, `markers`); `run.ts` keeps `lastCombat` so a fight's closing
events can still animate after `combat` is nulled; `returnToMap()` in `run.ts` is where a
node hands control back and where deferred content (Greeble-ambushed Shop/Cocoon, the
Snail's cart) is intercepted — route new "after this node" behaviour through it.

## Known issues and loose ends

- **One unexplained one-off:** on the very first drag of one session, three cards were spent
  from a single gesture. Instrumented, never reproduced across many drags. Watch for it.
- `card-cobweb` has no art yet; the loader 404s once per load and falls back to the drawn
  placeholder. Harmless, but it's the one "error" you'll see in production. It's a card the
  player holds among painted ones, so it belongs in the next art batch.
- Desktop-only layout. The page loads on phones but the title overflows and touch is untested;
  spec lists touch as roadmap. Share the desktop link.
- GitHub Pages URLs are case-sensitive: `/Cardillion/` works, `/cardillion/` 404s. Renaming
  the repo to lowercase was offered to the owner and not decided.
- Both spider sprites keep a faint half-keyed shadow under the body; the owner accepted them.

## How we got here (for context, not action)

The design came out of a `grilling` session on 2026-09-13 (four rounds, every decision in
`spec.md` and the ADRs). The engine choice was gated on a look prototype the owner judged in
the browser. The owner later asked for enemies "more realistic and gross, like Inscryption";
that's baked into the thicket prompt prefix. The session ran across three models; a lower-
effort model began M4 when the owner had only asked what the next step was — its engine work
was sound, its big-file write hit the Bash limit, and one bug (a Greeble-only ambush that the
engine refuses) was fixed before the tests were written. Ask before starting a milestone.
