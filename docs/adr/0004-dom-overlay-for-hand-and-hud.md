# The hand and HUD are DOM elements layered over the three.js canvas

Card text must be crisp and cheap to lay out, and hover/drag interactions are far simpler in the
DOM than in WebGL picking. So the hand, HUD, map overlay, shop and menus are HTML/CSS on top of
the canvas; a played card is handed to the 3D scene as a textured plane for its flight and
impact, then disappears. The alternative — cards as meshes with text rendered to canvas
textures — was rejected as more work for a worse result at this scale. Trade-off: a card
visually "crosses" from DOM to WebGL when played, which the transition must hide.
