# Local Addons

Drop WoW 3.3.5a addon folders here.

Each addon must be a folder containing a `.toc` file with the same name as the folder, e.g.:

```
addons/
  Bagnon/
    Bagnon.toc
    ...
  Questie/
    Questie.toc
    ...
```

The app reads from this folder on startup and injects enabled local addons into the Lasthavens client (same technique as the Chrome addon manager).

Changes require a full app restart (or reload of the game page).

**Testing branch only** — experimental, compatibility not guaranteed.
