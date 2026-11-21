# Dream Journal

A calm personal app that turns your real day into a short dream story.
It runs online, so your laptop and iPhone share the same journal.

- **Next.js** for the app (pages + server routes)
- **Supabase** for the database and login (free tier)
- **Vercel** for hosting (free Hobby plan)
- **Claude** writes the dreams. It's called only from the server, so your API key never reaches the browser.

## How the code is organized

| Where | What |
|---|---|
| `app/(app)/page.tsx` | Tonight: check-in → breathing → dream streams in |
| `app/(app)/journal` | Calendar, search, On this day, Dream / Real day toggle |
| `app/(app)/people` | People cards and Threads; `[id]` is one person (edit, merge, remove) |
| `app/(app)/fragments` | The Fragments shelf |
| `app/(app)/settings` | Settings, export/import, old-journal importer, delete all |
| `app/api/dream/route.ts` | The only server route: checks login and the daily limit, calls Claude, saves the result |
| `components/DreamReader.tsx` | Reading view: read-aloud, ambient sound, rituals |
| `lib/prompt.ts` | The dream-writer's system prompt |
| `lib/backup.ts` | Export, import, old-format importer, delete all |
| `lib/config.ts` | App name, model, default daily limit, hemisphere |
| `supabase/schema.sql` | Database tables + Row Level Security |
| `public/sw.js` | Offline support |

## Setup

You need **Node.js 20+** and a free **GitHub** account.

### 1. Supabase: database and your account
1. Go to [supabase.com](https://supabase.com), sign up, and click **New project**. Pick a name, set a database password (save it somewhere), and choose the region nearest you. Wait about a minute.
2. Open **SQL Editor → New query**. Paste in the whole of `supabase/schema.sql` and click **Run**. You should see "Success. No rows returned".
3. Create your account: **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
4. Turn off public sign-ups: **Authentication → Sign In / Providers**, then switch off **Allow new users to sign up** and save. The app has no sign-up form anyway. This switch makes sure nobody can create an account through the API either.
5. Get your keys: open **Project Settings → API** (or the **Connect** button at the top). Copy the **Project URL** and the **anon / publishable key**.

You stay signed in for months: the app refreshes your login automatically every time you open it.

### 2. Run it on your laptop (optional, for testing)
```bash
cd dream-journal
npm install
cp .env.example .env.local     # then fill in the values
npm run dev
```
Open <http://localhost:3000> and log in.

### 3. Put the code on GitHub
1. On github.com click **New repository**, name it `dream-journal`, keep it **Private**, and don't add a README.
2. In the terminal:
   ```bash
   git remote add origin https://github.com/YOUR-NAME/dream-journal.git
   git push -u origin main
   ```
   (`.env.local` is never uploaded. `.gitignore` blocks it.)

### 4. Vercel: hosting
1. Go to [vercel.com](https://vercel.com) and **Sign up with GitHub**. Choose the free **Hobby** plan.
2. Click **Add New → Project**, find `dream-journal`, and click **Import**.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon / publishable key |
   | `ANTHROPIC_API_KEY` | your key from console.anthropic.com |
   | `ALLOWED_EMAIL` | the email you log in with (extra safety) |
   | `CLAUDE_MODEL` | optional, defaults to `claude-sonnet-5-5` |

4. Click **Deploy**. After about a minute you get an address like `https://dream-journal-xyz.vercel.app`.
5. If you change an environment variable later, go to **Deployments → ⋯ → Redeploy** so it takes effect.

Every `git push` to `main` updates the live app automatically.

### 5. Open it on your laptop and iPhone
- **Laptop:** open your Vercel address and log in.
- **iPhone:** open the same address in **Safari** and tap **Share → Add to Home Screen → Add**. Open it from the new icon. It runs full screen like an app. **Log in once inside the Home Screen app**: iPhone keeps its login separate from Safari's.

### 6. Import your old journal
1. In the old app, go to **Settings → Export** to get a `.json` file. (Either the "Lanternwood" or the "Dream Journal" format works.)
2. In the new app, open **Settings → Import a backup or old journal** and choose that file.
3. You'll see a summary of what was imported. Keepsakes become fragments, reflections become waking thoughts, and village characters become people under their real names. Anything it can't read is skipped and counted. Importing the same file twice won't create duplicates.

### 7. Cap your Anthropic spending
1. Open [console.anthropic.com](https://console.anthropic.com) → **Settings → Limits** (or **Billing**).
2. Set a **monthly spend limit**, for example $10. When it's reached, the API stops until next month and the app shows a friendly error.
3. The app's own **Daily dream limit** in Settings (20 by default) is a second safety net.

A medium dream costs roughly 2–4 cents with Claude Sonnet 5.5.

## Free-tier limits to know about

- **Supabase pauses free projects after about 7 days with no activity.** The app then can't log in or load dreams. To fix it, open the Supabase dashboard, select the project, and click **Restore project**. It takes a few minutes and your data is kept. Using the app at least once a week prevents this. The free tier also allows 500 MB of database storage, which is many years of dreams.
- **Vercel Hobby** is free for personal, non-commercial use. It doesn't sleep, and its limits are far beyond what one person uses.
- **Anthropic** has no free tier. You pay per use, so set the spending limit above.

## Privacy and security
- Every table has Row Level Security: only your logged-in account can read or write your rows.
- Dream generation requires login, and only `ALLOWED_EMAIL` if you set it.
- The server never logs the text of your check-ins or dreams. It only logs error types.
- Unsent check-in drafts and up to 60 recent dreams are cached on each device for offline reading. Signing out clears the cache.
