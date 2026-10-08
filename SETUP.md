# Idlewild Students Gear: going live with GitHub + Netlify

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The website |
| `netlify/functions/inventory.mjs` | The save function. It reads and writes the inventory in GitHub. |
| `data/inventory.json` | The inventory itself (110 items to start). Every save on the site updates this file. |
| `netlify.toml` | Tells Netlify where things are |

How it works: the team uses the site, and the site hands each change to the save function, which saves it to `data/inventory.json` in GitHub. The team never needs a GitHub or Netlify account. Only you do.

---

## Step 1: Put the files in GitHub (5 min)

1. In GitHub, click **New repository**. Name it something like `student-gear`. **Private** is fine.
2. On the new repository page, click **uploading an existing file**.
3. Drag in **everything inside this folder** (`index.html`, `netlify.toml`, `SETUP.md`, and the `data` and `netlify` folders). Keep the folders intact.
4. Click **Commit changes**.

## Step 2: Make a GitHub token for the site (3 min)

This lets the save function write to that one repository and nothing else.

1. GitHub → your profile picture → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Name:** Student Gear site
3. **Expiration:** the longest your account allows. Put a reminder on your calendar a week before it expires.
4. **Repository access:** *Only select repositories* → pick `student-gear`.
5. **Permissions** → Repository permissions → **Contents: Read and write**. Leave everything else alone.
6. Click **Generate token** and copy it. GitHub only shows it once.

## Step 3: Connect Netlify (3 min)

1. Netlify → **Add new site** → **Import an existing project** → **GitHub** → pick `student-gear`.
2. Leave the build command blank. Netlify reads the rest from `netlify.toml`.
3. Click **Deploy**.

## Step 4: Add the settings (3 min)

Netlify → your site → **Site configuration** → **Environment variables** → **Add a variable**. Add these:

| Key | Value |
|---|---|
| `GITHUB_TOKEN` | the token from Step 2 |
| `GITHUB_REPO` | your GitHub username or organization, a slash, and the repository name, like `aevans-idlewild/student-gear` |
| `TEAM_PASSWORD` | the password the team will use to save changes |
| `GITHUB_BRANCH` | only needed if your branch isn't called `main` |

Then go to **Deploys** → **Trigger deploy** → **Deploy site**. Settings take effect on the next deploy.

## Step 5: Test it (2 min)

1. Open the site's Netlify address.
2. Add a test item. When asked, enter the team password.
3. In GitHub, open `data/inventory.json`. The latest commit should say "Add (your test item)."
4. Delete the test item on the site.

Optional: in Netlify, go to **Domain management** to change the address to something like `idlewild-gear.netlify.app`.

---

## Good to know

- **Viewing is open, saving needs the password.** Anyone with the link can see the inventory. Each device asks for the team password once and then remembers it.
- **Changing the password:** update `TEAM_PASSWORD` in Netlify, then **Trigger deploy**. Everyone gets asked for the new one on their next save.
- **Undoing a mistake:** every save is a commit in GitHub. Open `data/inventory.json` → **History** to see who changed what and when, and copy back an older version if needed.
- **Updates appear within about 15 seconds.** Each person's own changes show right away. Other people's changes show up within about 15 seconds, or as soon as they reopen the page.
- **Several leaders checking items off at once works.** Each check is saved on top of the newest copy, so nobody's check gets lost.
- **Saves don't trigger rebuilds.** Saves are labeled `[skip netlify]`, so Netlify doesn't redeploy the site every time someone checks an item.
- **When the token expires,** saving will stop working. Make a new token (Step 2) and replace `GITHUB_TOKEN` in Netlify, then **Trigger deploy**.
- **Don't edit `data/inventory.json` by hand while people are using the site.** If you need to, do it when nobody is saving.
