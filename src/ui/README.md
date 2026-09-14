# `src/ui` - DOM overlay

Hand, HUD (HP, Charge, crumbs, deck piles), map overlay, shop, cocoon, rewards, settings,
title screen. Plain DOM + CSS layered over the three.js canvas. Dispatches actions to the
engine via `src/app`; never mutates engine state directly.
