# `src/render` - three.js scene

Battle scene only (the map is DOM in `src/ui`): table, fog, lights, enemy billboards with
keyframe poses and clip frames, the card-flight plane, hit feedback, post-processing (vignette,
grain, bloom). Textures, the art loader and the eye/ground-line finders are in `textures.ts`.
Reads engine state and events; never mutates engine state.
