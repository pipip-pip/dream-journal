# Dream Journal

A calm personal app that turns your real day into a short dream story.

It's a **static website**: plain HTML, CSS and JavaScript with no server, no database and no build step. It's hosted on GitHub Pages, like the language app.

- Your journal is saved **in your browser only** (`localStorage`). Your laptop and iPhone each keep their own journal.
- Dreams are written by **OpenAI**. You paste your API key into ⚙️ Settings on each device, and it's stored only in that browser, never in the website's files.
- Use **Settings → Export** for backups and to move your journal between devices.

## Files

| File | What it is |
|---|---|
| `index.html` | All the screens: Tonight, Journal, People, Fragments, Settings |
| `style.css` | Night and pale-dawn colours, then layout |
| `app.js` | All the app logic, in sections marked `// ===== Name =====` |
| `prompt.js` | The dream-writer's instructions sent to OpenAI |
| `sw.js` | Offline support (keeps the app's files so it opens without internet) |
| `manifest.json`, `icons/` | What makes it installable on the iPhone Home Screen |

## Try it on your laptop

Open Terminal in this folder and run:
```bash
python3 -m http.server 8000
```
Then open <http://localhost:8000>. (Opening `index.html` directly also mostly works, but offline support only runs from a web address.)

## Put it online (GitHub Pages)

1. On github.com, create a new repository, for example `dream-journal`.
2. Click **Add file → Upload files** and drag in everything in this folder: `index.html`, `style.css`, `app.js`, `prompt.js`, `sw.js`, `manifest.json`, and the `icons` folder. Then click **Commit changes**.
3. Go to **Settings → Pages**. Under *Branch*, choose `main` and `/ (root)`, then **Save**.
4. After a minute your app is at `https://YOUR-NAME.github.io/dream-journal/`.

**When you change files later:** upload the changed files the same way. Also open `sw.js`, raise the number in `const CACHE = "dream-journal-v1"` (for example to `v2`), and upload it too, so phones fetch the new version.

## On your iPhone

1. Open your GitHub Pages address in **Safari**.
2. Tap **Share → Add to Home Screen → Add**. Open the app from the new icon.
3. In ⚙️ Settings, paste your OpenAI API key and tap **Save**. The Home Screen app has its own storage, separate from Safari's, so add the key there.

## Moving your journal between devices

On one device, go to **Settings → Export everything** to get a `.json` file. On the other device, choose **Import** and pick that file (AirDrop or iCloud Drive work well for moving it). Dreams already there are skipped, so importing twice is safe. Your API key is never included in exports.

## Importing your old journal

In the old app, export your journal from Settings. In this app, go to **Settings → Import a backup or old journal** and pick the file. Both old formats work:
- **Dream Journal** export: dreams, people, threads and settings.
- **Lanternwood** export: keepsakes become fragments, reflections become waking thoughts, and village characters become people under their real names.

You'll see a summary of what was imported. Anything it couldn't understand is skipped and counted.

## OpenAI key and costs

1. Create a key at <https://platform.openai.com/api-keys>.
2. Set a monthly budget at <https://platform.openai.com/settings/organization/limits> so the bill can't surprise you.
3. The app's **Daily dream limit** in Settings (20 by default) is a second safety net.

The default model is `gpt-4.1`. You can change it in Settings. A dream costs about a cent or two.

## Good to know

- **Back up now and then.** If you clear Safari's website data, or don't open the app for a long time, iPhone may delete its storage. Adding the app to the Home Screen makes that much less likely, but exports are your real backup. Settings shows when you last exported.
- Browser storage holds about 5 MB, which is roughly 1,000 dreams. If it ever fills, the app tells you. Export, then delete old dreams.
- Your API key lives in the browser. Anyone using your unlocked device could find it, so keep the OpenAI budget limit set.
