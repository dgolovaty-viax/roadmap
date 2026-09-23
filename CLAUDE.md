# viax Roadmap — Claude Context

## What this app is
A product roadmap tool for the viax team. It has five main sections:
- **Planning** — epics with status, owner, and AI-generated descriptions. Includes voting sessions to prioritize epics.
- **Roadmap** — visual timeline of epics by quarter.
- **North Star** — vision and OKR tracking.
- **Ideas** — idea cards with tags, tag filtering, and a structured voting system to promote ideas into planning epics.
- **Sessions** — meeting/session notes.
- **Press Releases** — a swimlane board tracking each press release or customer case study from candidate through to LinkedIn amplification. Steps run across the top (defined in `PR_STEPS` in `src/pages/PressReleasesPage.jsx`), one lane per release, and each card holds content, links, file attachments and comments.
- **Marketing Blitz** — a reusable launch-campaign template. One page renders any blitz (`/blitz/:slug`); the first is **Blitz: RMB** at `/blitz/rmb`. Six phases from concepts to implementation showcase, with dates, owners' commitments, audience decks and LinkedIn post review all persisted to Supabase.

Live at: **https://roadmap-viax.vercel.app**

---

## Tech stack

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | React + Vite, React Router, Tailwind CSS, shadcn/ui | Vercel (auto-deploys from `main`) |
| Backend | Flask (Python) | Railway (auto-deploys from `main`) |
| Database | Supabase (PostgreSQL) | Supabase free tier |

**Backend URL:** `https://roadmap-production-2306.up.railway.app`  
**Supabase project ID:** `fsiyiyamxerpwooutriq`  
**GitHub repo:** `dgolovaty-viax/roadmap`

---

## Project structure

```
/
├── src/
│   ├── pages/          # One file per page/route
│   │   ├── PlanningPage.jsx
│   │   ├── IdeasPage.jsx
│   │   ├── IdeaVotePage.jsx   # Participant vote page
│   │   ├── RoadmapPage.jsx
│   │   ├── NorthStarPage.jsx
│   │   └── SessionPage.jsx
│   ├── components/
│   │   └── Nav.jsx
│   ├── lib/
│   │   ├── api.js       # All backend API calls (single source of truth)
│   │   ├── supabase.js  # Supabase client (frontend direct access if needed)
│   │   └── utils.js
│   └── App.jsx          # Routes defined here
├── backend/
│   ├── app.py           # All Flask routes
│   └── requirements.txt
├── CLAUDE.md            # This file
└── vercel.json          # Frontend routing config
```

---

## Database schema (Supabase)

### `epics`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| title | text | |
| description | text | |
| status | text | `Draft`, `In Progress`, `Done` |
| owner | text | |
| quarter | text | e.g. `Q2 2026` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `votes` (voting sessions for epics)
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| epic_id | uuid | FK → epics |
| voter_email | text | |
| created_at | timestamptz | |

### `ideas`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| title | text | |
| description | text | |
| tag_id | uuid | FK → idea_tags |
| for_another_day | bool | default `false`. When true, idea sits on the "For another day" tab and is excluded from voting. |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `idea_tags`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| name | text | unique |

### `idea_vote_sessions`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| status | text | `open`, `closed` |
| created_at | timestamptz | |
| closed_at | timestamptz | nullable |

### `idea_votes`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK → idea_vote_sessions |
| voter_email | text | |
| idea_ids | uuid[] | array of up to 5 idea IDs |
| created_at | timestamptz | |


### `press_releases` (Press Releases board)
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| client | text | company the release is about — the lane title |
| topic | text | what the release is about |
| viax_owners | text | who owns it on our side |
| client_owners | text | who signs off on theirs |
| step_key | text | matches a key in `PR_STEPS`; moving the card updates this |
| expected_date | date | nullable; drives the date pill and the late/soon colouring |
| position | integer | lane order top to bottom |
| archived | boolean | hidden from the board when true |

Seeded from `SEED` in the page on first load (`/api/press-releases/init`, idempotent).

### `pr_items`
Everything hanging off a release card, discriminated by `kind`:
`content` (the body, one per release), `link`, `attachment`, `comment`.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| release_id | uuid | FK → press_releases, cascades on delete |
| kind | text | `content` \| `link` \| `attachment` \| `comment` |
| title / url | text | links |
| body | text | content and comments |
| file_name / mime_type / size_bytes / data | text/int | attachments; `data` is base64, capped at 3MB by the backend |
| author | text | comments |

---

### `blitzes` (Marketing Blitz)
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| slug | text | unique — the URL segment, e.g. `rmb` for `/blitz/rmb` |
| name | text | e.g. `Blitz: RMB` |
| feature | text | the feature being launched |
| status | text | default `active` |
| created_at / updated_at | timestamptz | |

### `blitz_fields`
Key/value store for every free-text, date and choice input on a blitz page. Keyed by the field ids
used in `BLITZ_CONTENT`, so adding an input to the page needs no schema change.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| blitz_id | uuid | FK → blitzes |
| field_key | text | unique together with `blitz_id` |
| value | text | |
| updated_at | timestamptz | |

### `blitz_meetings`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| blitz_id | uuid | FK → blitzes |
| phase | text | `field` (phase 3), `analyst` (phase 4), `qbr` (already-held accounts) |
| name | text | company name |
| audience | text | `client`, `partner`, `analyst`, `qbr` |
| angle | text | the talk-track note shown on the card |
| meet_at | timestamptz | nullable |
| sharers | text | who committed to share the LinkedIn posts |
| position | integer | order within the phase |

Seeded from `meetingSeeds` in the page config the first time a blitz loads, then fully editable.

### `blitz_decks`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| blitz_id | uuid | FK → blitzes |
| audience | text | `client`, `partner`, `agency` — unique with `blitz_id` |
| file_name | text | |
| link | text | optional shared link instead of an upload |
| content | text | the deck's raw HTML (capped at 4MB by the backend) |

---

## Running locally

### Frontend
```bash
npm install
npm run dev        # runs on http://localhost:5173
```

### Backend
```bash
cd backend
pip install -r requirements.txt
# Create backend/.env with:
# SUPABASE_URL=...
# SUPABASE_KEY=...
python app.py      # runs on http://localhost:5000
```

Set `VITE_API_BASE_URL=http://localhost:5000` in a root `.env` file to point the frontend at the local backend.

---

## Deployment

Both services auto-deploy when you push to `main`.

- **Frontend (Vercel):** push to `main` → Vercel picks it up automatically.
- **Backend (Railway):** push to `main` → Railway picks it up automatically.

To deploy:
```bash
git add .
git commit -m "your message"
git push origin main
```

If you need to push and don't have GitHub credentials, the token is stored at `/sessions/.../mnt/outputs/.deploy-env`. Set the remote with:
```bash
git remote set-url origin https://<token>@github.com/dgolovaty-viax/roadmap.git
```

---

## Environment variables

### Backend (set in Railway dashboard)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase service role or anon key
- `ANTHROPIC_API_KEY` — for AI-generated epic descriptions
- `ALLOWED_ORIGINS` — CORS origins (defaults to `*`)

### Frontend (set in Vercel dashboard)
- `VITE_API_BASE_URL` — Railway backend URL (already set)

---

## Key conventions

- All backend API calls go through `src/lib/api.js` — don't call the backend directly from components.
- New pages go in `src/pages/`, new routes get added to `src/App.jsx`.
- New backend endpoints go in `backend/app.py`.
- Use Tailwind for styling. shadcn/ui components are available (see `components.json`).
- The frontend uses path alias `@/` pointing to `src/`.
- **Adding a new Marketing Blitz campaign:** add an entry to `BLITZ_CONTENT` in `src/pages/BlitzPage.jsx` keyed by its slug, then add the item to `BLITZ_ITEMS` in `src/components/Nav.jsx`. The `/blitz/:slug` route and the `blitzes` row are handled automatically — the backend's `/api/blitz/<slug>/init` creates the row and seeds its meetings on first load.

---

## Known gotchas

- **Supabase free tier pauses after 7 days of inactivity.** A keepalive ping runs every 3 days via Cowork Scheduled Tasks. If the app is returning 500 errors on all DB endpoints but `/api/health` returns OK, check if the Supabase project is paused at https://supabase.com/dashboard/project/fsiyiyamxerpwooutriq.
- **Railway cold starts** — the backend may take 5–10 seconds to wake up on the first request after inactivity.
- Idea voting: participants get a shareable link at `/ideas/vote/:sessionId`. Only one vote session can be open at a time.
