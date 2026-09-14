# Art pipeline

How generated art gets into the game, and how to set it up. Background: ADR 0006.

## The contract

- Every asset has an **id** that matches its content entry (`card-wormillion`, `enemy-rat`,
  `boss-bear`, `npc-snail`, `bg-battle`…). Sizes and kinds are in `spec.md` §11.4.
- The game loads `assets/art/<id>.png` if it exists, otherwise `assets/placeholders/<id>.svg`.
  Placeholders are generated procedurally, so the game never depends on generated art.
- Prompts live in `art/manifest.json`: two style blocks (`garden`, `thicket`, plus `scene` for
  backgrounds) and one entry per asset. Change a prompt there, never in code.
- `assets/art/` is committed only once a batch is approved by the owner.

## One-time setup (owner does this — about five minutes)

1. Go to https://platform.openai.com and sign in (or create an account). The API is billed
   separately from ChatGPT: under **Billing**, add a payment method and buy a small amount of
   credit ($10 covers the whole v1 art set with room for re-rolls).
2. Under **API keys**, create a new secret key. Copy it once — it is only shown once.
3. In the repo root, copy `.env.example` to `.env` and paste the key after `OPENAI_API_KEY=`.
   `.env` is gitignored; never paste the key anywhere else (not in chat, not in a commit).
4. Verify without spending anything: `npm run art -- --dry-run` prints every prompt.

That is the entire setup. From here the agent runs the pipeline.

## Generating (agent workflow)

1. **Style anchors first.** `npm run art -- --only style-anchor-garden,style-anchor-thicket`.
   Look at both. Re-prompt until each one _is_ the look (spec §11.1). Show the owner; iterate
   until approved. Every other image is generated with the approved anchor as a reference, so
   this step decides the whole set's coherence.
2. **Generate a batch** (e.g. the seven base cards, or all common vermin):
   `npm run art -- --only card-wormillion,card-roly-poly,...`. Open each PNG and check:
   subject reads at card size, silhouette is clean, palette matches the world, no text or
   border, background is actually transparent.
3. **Re-roll misses.** Edit the prompt in the manifest, then `npm run art -- --only <id> --force`.
4. **Contact sheet for approval.** Assemble the batch into one image (`art/out/` is gitignored
   scratch space), send it to the owner, and record approved ids in the commit message.
5. **Commit approved PNGs** to `assets/art/`. Placeholders for those ids become unused.

Costs: roughly $0.02 / $0.07 / $0.19 per image at low / medium / high quality. Use
`--quality medium` while iterating on prompts, `high` for the final render.

## Flags

```
npm run art                          generate every missing asset
npm run art -- --only a,b,c          only these ids
npm run art -- --force               regenerate even if the PNG exists
npm run art -- --quality medium      low | medium | high
npm run art -- --dry-run             print prompts, call nothing
```

## Post-processing

Card art is generated at 1024×1536 and shown through a 5:7 window; keep the subject centred
with margin. Enemy sprites are generated on a transparent background and displayed as
billboards; if an image comes back with a baked-in background, re-roll rather than masking.
