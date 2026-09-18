# `src/save` - persistence

Single autosave slot in `localStorage` (`cardillion.save.v1`) plus settings
(`cardillion.settings.v1`). Serialises the full run state including RNG state; versioned (a
save from another version is discarded with a notice — there are no migrations yet). Deleted
when a run ends (no save-scumming).
