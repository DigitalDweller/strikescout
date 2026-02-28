# Running StrikeScout on Your Computer

This guide covers running the app **locally on Windows** (or any machine) and how to **port it back to Replit** when you have credits again.

---

## What StrikeScout Is

StrikeScout is a **FIRST Robotics Competition (FRC) scouting web app** for the 2026 "Rebuilt" season. It includes:

- **Frontend:** React + Vite + Tailwind + Shadcn UI (runs in the browser)
- **Backend:** Express.js API (single server serves both API and frontend)
- **Database:** PostgreSQL (required)
- **Optional:** The Blue Alliance (TBA) integration for schedule sync, OPRs, rankings, videos

The app runs on **one port** (default **5000**). In development, the server starts Vite’s dev server so you get hot reload.

---

## Prerequisites

1. **Node.js 20** (or 18+)  
   - Download: https://nodejs.org/  
   - Confirm: `node -v` and `npm -v`

2. **PostgreSQL**  
   You need a running Postgres database and a connection URL.

   - **Option A – Local install**  
     - Windows: https://www.postgresql.org/download/windows/  
     - Create a database, e.g. `strikescout`, and note username/password/host/port.

   - **Option B – Cloud (free tier)**  
     - [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app)  
     - Create a project and copy the **connection string** (e.g. `postgresql://user:pass@host:5432/dbname`).

3. **TBA API key (optional)**  
   Only needed if you use TBA features (schedule sync, OPRs, etc.).  
   Get one: https://www.thebluealliance.com/account

---

## Setup Steps

### 1. Install dependencies

In the project root (`Strikescout`):

```bash
npm install
```

### 2. Configure environment

Copy the example env file and edit it:

```bash
copy .env.example .env
```

Edit `.env` and set at least:

- **`DATABASE_URL`** (required)  
  Example: `postgresql://postgres:yourpassword@localhost:5432/strikescout`  
  Use your real host, user, password, and database name.

- **`TBA_API_KEY`** (optional)  
  Uncomment and set if you want TBA sync.

### 3. Create database tables

Sync the Drizzle schema to your Postgres database:

```bash
npm run db:push
```

### 4. Start the app

```bash
npm run dev
```

You should see something like:

```
serving on port 5000
```

Open in your browser: **http://localhost:5000**

- First run: the app seeds a default event (“2026 Houston Regional”) if the DB is empty.
- Use the UI to add events, scout matches, manage picklist, etc.

---

## Using the Website

- **Home:** List of events; use **+** to add an event.
- **Event:** Click an event to open its **Overview** (leaderboards, teams, schedule).
- **Sidebar:**  
  - **Overview** → Leaderboards, Teams, Schedule  
  - **Scouting** → Scouting form, Form history, Picklist  
  - **Manage** → Data management (CSV export), Settings (e.g. TBA config)
- **TBA:** In Event Settings, set the TBA event key and (if configured) use sync for schedule, OPRs, rankings, videos.
- **Dark mode:** Toggle in the sidebar (moon/sun icon).

No login is required; the app is open access for your scouting team.

---

## Porting Back to Replit

When you have Replit credits again, you can move this project back with minimal changes.

1. **Push your code to GitHub** (or another git host) from this folder, then **import the repo** into a new Replit project, or use Replit’s Git sync if you already have the project there.

2. **In Replit:**  
   - Add the **Postgres** resource (Database) from the Tools/Services panel.  
   - Replit will set **`DATABASE_URL`** for you; you don’t need to copy `.env` from your computer.

3. **Optional:**  
   - Add **Secrets** for `TBA_API_KEY` if you use TBA.  
   - The run command is already **`npm run dev`** (see `.replit`).  
   - Port is **5000** (Replit maps it to port 80 externally).

4. **After opening the project on Replit:**  
   - Run `npm install` (if Replit doesn’t do it).  
   - Run `npm run db:push` once to create/update tables in the Replit Postgres DB.

5. **Keep Replit-friendly behavior:**  
   - The project already uses `cross-env` for `NODE_ENV`, so **`npm run dev`** works on both Windows and Replit (Linux).  
   - Don’t remove the `@replit/*` Vite plugins from `package.json`; they’re only used in development and won’t affect local runs.

You can develop locally (with your own `.env` and Postgres) and periodically push to Git, then run the same repo on Replit with Replit’s Postgres and secrets.

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| `DATABASE_URL must be set` | Create `.env` from `.env.example` and set `DATABASE_URL`. |
| `ECONNREFUSED` or DB errors | Check Postgres is running and the URL (host, port, user, password, DB name) is correct. |
| Port 5000 in use | Set `PORT=5001` (or another port) in `.env`. |
| TBA sync fails | Ensure `TBA_API_KEY` is set in `.env` and the event key in Event Settings is valid. |
| `npm run dev` fails on Windows | Ensure you have `cross-env` installed (`npm install`). If you still see `NODE_ENV` errors, run: `npx cross-env NODE_ENV=development npx tsx server/index.ts` |

---

## Scripts Reference

| Command | Purpose |
|--------|--------|
| `npm run dev` | Start backend + Vite dev server (hot reload). |
| `npm run build` | Production build (output in `dist/`). |
| `npm run start` | Run production build (after `npm run build`). |
| `npm run db:push` | Sync Drizzle schema to Postgres (create/update tables). |
| `npm run check` | TypeScript check. |
