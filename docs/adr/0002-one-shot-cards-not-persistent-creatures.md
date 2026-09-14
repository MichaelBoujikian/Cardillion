# Cards are one-shot actions (Slay the Spire), not persistent creatures (Inscryption)

The art references Inscryption, so a reader may expect lanes and creatures that stay on the
board. We chose the Slay the Spire model instead: playing a bug resolves an immediate effect and
the card goes to discard. It matches the owner's description ("cards directly attack the bad
animals", "cheapest to play", "Mr. Wormsley makes worms free"), it is roughly a third of the
scope of a board-state model (no lanes, no creature HP, no enemy creature roster), and it is a
battle-tested loop. A persistent-creature mode remains possible as a later variant; the engine's
event-driven design does not preclude it.
