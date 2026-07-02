# Deploying to Vercel

Vercel doesn't run PHP or MySQL, so the original `api/*.php` + MySQL backend
was ported to **Node.js serverless functions** (`api/api.js`, `api/_db.js`)
talking to **Postgres**. The frontend (`index.html`, `css/`, `js/`) is
unchanged except one line in `js/app.js` pointing at the new API path.

Everything else — every action name, every request/response shape, the exact
calculation formulas — is identical to the original, so the UI works exactly
the same.

## 1. Create a Postgres database (2 minutes)

1. Push this folder to a GitHub repo (see step 2), or open the project once
   imported into Vercel.
2. In the Vercel dashboard, open your project → **Storage** tab → **Create
   Database** → choose **Postgres** (Neon, powered).
3. Click **Connect** to your project. This automatically adds a
   `POSTGRES_URL` environment variable — no manual copying needed.

## 2. Push the code to GitHub

```bash
cd mess-web-vercel
git init
git add .
git commit -m "Mess web — Vercel ready"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 3. Import into Vercel

1. Go to https://vercel.com/new
2. Import the GitHub repo you just pushed.
3. Framework preset: **Other** (it's auto-detected — no build command needed).
4. Click **Deploy**.

## 4. Create the database tables

Once the Postgres database is connected, run `schema.sql` against it once.
Easiest way: in the Vercel dashboard → **Storage** → your database → **Query**
tab, paste the entire contents of `schema.sql` and run it.

(Alternative: use `psql "$POSTGRES_URL" -f schema.sql` from your machine if
you have `psql` installed and the connection string from Storage → `.env.local` tab.)

If you don't want the sample seed data (জয়, অনিক দেবনাথ, etc.), delete the
`DO $$ ... END $$;` block at the bottom of `schema.sql` before running it.

## 5. Redeploy

After the tables exist, trigger a redeploy (Vercel dashboard → Deployments →
**Redeploy**, or just push a new commit) so the app picks up the database.
Then open your `*.vercel.app` URL — it should work exactly like the PHP
version did locally.

## Local testing (optional)

```bash
npm install -g vercel
cd mess-web-vercel
npm install
vercel dev
```

`vercel dev` reads `POSTGRES_URL` from `.env.local` (pull it with
`vercel env pull .env.local` after linking the project) and serves both the
static files and the `/api/api` function locally.

## Notes

- **No login/authentication** — same as the original: anyone with the URL
  can edit data. Add Vercel's password-protection (Pro plan) or a simple
  login gate before sharing the URL publicly.
- The API keeps the exact same contract as `api.php` (`?action=...`, same
  field names, same error messages in Bengali), so if you ever want to swap
  the backend again, only `api/api.js` and `api/_db.js` need to change.
- If you'd rather use MySQL instead of Postgres (e.g. PlanetScale), the
  `mysql2` package + minor syntax tweaks (`?` placeholders, `ON DUPLICATE KEY
  UPDATE`, `AUTO_INCREMENT`) in `api/_db.js` / `api/api.js` would need to be
  swapped back in — ask me and I can prepare that variant instead.
