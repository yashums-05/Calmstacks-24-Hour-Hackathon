# Event Participant ID System

A deployable web app that registers event participants, generates a unique ID for each, and provides a shareable public profile URL — no QR codes, just a clean URL.

## Stack
- **Runtime**: Node.js 22.5+ (uses built-in `node:sqlite` — zero native compilation)
- **Framework**: Express.js
- **Database**: SQLite (via Node.js built-in `node:sqlite`, stored in `data/app.db`)
- **Frontend**: Vanilla HTML/CSS/JS (served as static files)

---

## Getting Started (Local)

```bash
# 1. Install dependencies (only express!)
npm install

# 2. Start the server
npm start

# 3. Open the app
# Admin dashboard: http://localhost:3000
# API health:      http://localhost:3000/health
```

---

## How It Works

1. **Set up your event** → Go to ⚙ Event Setup, fill in event name, dates, venue, organizer
2. **Add participants** → Go to ➕ Add Participant, fill in details, click **Generate ID & Register**
3. **Share the URL** → Every participant gets a unique URL like:
   ```
   https://yourapp.com/p/a3f2c1d0-7b2e-4f1a-9c3e-b8d2e5f6a7c1
   ```
4. **Open the URL** → Shows the participant's full profile + event details (GET request, no login needed)

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/`   | Admin dashboard |
| `GET`  | `/p/:id` | **Public participant profile page** (shareable URL) |
| `GET`  | `/api/event` | Get event config |
| `POST` | `/api/event` | Save event config |
| `GET`  | `/api/participants` | List all participants (`?search=` supported) |
| `POST` | `/api/participants` | Register participant → returns `id` + `profile_url` |
| `GET`  | `/api/participants/:id` | Get participant + event JSON |
| `DELETE` | `/api/participants/:id` | Remove participant |
| `GET`  | `/api/export` | Download all data as JSON |
| `GET`  | `/health` | Health check |

---

## Deploy to Railway (Free)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and init
railway login
railway init

# 3. Deploy
railway up

# Your app will be live at https://yourapp.up.railway.app
```

## Deploy to Render (Free)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add Environment Variable: `DB_PATH=/data/app.db`
6. Add a **Disk** (mount at `/data`) to persist the SQLite file

## Deploy to Fly.io

```bash
fly launch
fly deploy
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/app.db` | Path to SQLite database file |

---

## Project Structure

```
event-id-system/
├── server.js          ← Express app + REST API
├── db.js              ← SQLite database (node:sqlite built-in)
├── package.json
├── Procfile           ← Railway/Heroku
├── railway.json       ← Railway config
├── .env.example
├── .gitignore
└── public/
    ├── index.html     ← Admin dashboard
    └── profile.html   ← Public participant profile page
```
