# `src/app` - orchestration

Screen router (title, map, node screens, result), the render loop, wiring between engine,
render, ui and save. The only layer allowed to import all the others.
RunController: dispatch → save → animate → screen.
