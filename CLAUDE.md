# Dream Journal: guide for coding agents

A personal app that turns the owner's day into a short dream story, written by OpenAI. Modelled on the owner's language app (`../language`).

## The owner and how to work with them
- The owner is a **beginner programmer**. Explain changes in plain words, keep code simple, and give step-by-step instructions when they need to do something themselves.
- They test on a Mac browser **and an iPhone** (often from the Home Screen). Everything must work on touch screens: safe areas, inputs at 16px or larger so iPhone doesn't zoom, tap targets at least 44px.
- Comments are written for a beginner: friendly, short, and explaining *why*. Match that style.
- After finishing, tell them which files changed so they can upload those, and remind them to bump `CACHE` in `sw.js`.

## Hard constraints
- **Static site, no server, no build step, no npm, no database.** Plain HTML, CSS and JS, hosted on **GitHub Pages** with files uploaded by hand.
- **Never put an API key in any file.** The OpenAI key is pasted into Settings and stored in `localStorage` (`openaiKey`) only. Exports leave it out.
- All data lives in `localStorage` (keys: `entries`, `people`, `threads`, `settings`, `draft`, `dreamTimes`, `lastExport`, `theme`, `openaiKey`, `openaiModel`). Devices don't sync; export and import move data.
- Build page content with the `el()` helper (plain text only, never `innerHTML` with user or model text).
- Keep the importer able to read old exports: `dream-journal` v2 and `lanternwood` v1 from the previous app, and this app's v3 backups.

## Files
- `index.html`: markup for all tabs. Pages are switched by the URL hash (`#journal`, `#dream/<id>`, `#person/<id>`) in `showPage()`.
- `app.js`: all logic in `// ===== Name =====` sections. Start-up calls are at the end.
- `prompt.js`: `SYSTEM_PROMPT`, the dream-writer's instructions. It asks for a JSON reply.
- `style.css`: theme variables (`:root` = night, `[data-theme="day"]` = pale dawn), then layout.
- `sw.js`: offline cache. Bump `CACHE` whenever files change.
