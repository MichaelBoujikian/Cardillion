# Art is AI-generated through a script, behind an id-keyed asset contract with procedural placeholders

The owner wants decent, coherent art without an artist on hand. Every content entry has a stable
id; the loader tries `assets/art/<id>.png` and falls back to a generated
`assets/placeholders/<id>.svg`, so the game is always playable and art can be swapped without
code changes. Generation is a repo script (`tools/gen-art.mjs`) driven by `art/manifest.json`
and the OpenAI Images API (`gpt-image-1`), so an agent can generate, look, re-prompt and present
contact sheets for approval without a human relaying files. Style coherence across ~40 images
comes from two approved **style anchor** images passed as references, not from prompt wording
alone. The API key lives only in a gitignored `.env` that the owner creates.

## Considered options

- **Owner generates in Midjourney/ChatGPT and drops files in** — keeps a human in every loop.
- **Hand-authored SVG as final art** — the placeholder path; not the target look.
