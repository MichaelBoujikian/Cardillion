---
status: accepted — the M1 look-prototype gate passed 2026-09-13
---

# Web + TypeScript + three.js, gated by a look prototype; Godot 4 is the fallback

The visual bar is Inscryption-grade (perspective table, fog, grain, vignette), and the game is
built almost entirely by AI agents that need to _see_ what they render. Web gives agents a
seconds-long edit/render/screenshot loop inside the coding tool, deploys anywhere, and reaches
mobile later for free; three.js covers every piece of the target look (perspective camera,
textured planes, point lights, `scene.fog`, post-processing passes). Godot 4 would give a
better editor for a human and a native Steam path, but every visual iteration would cost a
web export or an MCP round-trip.

**Gate:** milestone M1 is a throwaway three.js scene judged by the owner in the browser. If it
misses the bar, we switch to Godot 4 driven through Godot MCP Pro
(https://github.com/youichi-uda/godot-mcp-pro) _before_ any game logic exists; `spec.md` is
engine-agnostic so nothing is lost.

## Considered options

- **Godot 4 + Godot MCP Pro** — strongest fallback; kept warm, not chosen first because the
  web loop is faster and mobile is a stated goal.
- **PixiJS / Phaser** — 2D only; faux depth would need hand-built parallax and shaders.
- **CSS 3D transforms only** — cheap, but no lighting, fog or post-processing.
- **Python / pygame** — poor fit for UI-heavy card games and distribution.
