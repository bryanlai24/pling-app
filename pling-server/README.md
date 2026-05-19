# Pling 🏆

Achievement and trophy tracking for serious hunters. Supports PSN, Xbox, Steam, and manual entries with deep sub-objective tracking.

## Features

- **Game library** — track your backlog and completion status per game
- **Achievement tracking** — mark trophies/achievements earned, with per-user progress
- **Nested objectives** — break each achievement into grouped steps with detailed methods. Two-level hierarchy: group headers (e.g. "Mos Eisley") → leaf steps (e.g. "Solve the cantina puzzle"). Each step is individually checkable.
- **PSN sync** — pull your real earned trophy data from PlayStation Network into your Pling progress
- **Genre system** — tag games with up to 14 genres, filter library by genre
- **Roles** — admin, contributor (can edit catalogue), and standard user
- **Guest mode** — browse the catalogue without an account

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 (async)
- **Database**: PostgreSQL
- **Migrations**: Alembic
- **Hosting**: Google Cloud Run + Cloud SQL

## Local setup

### 1. Clone and install

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your local DB credentials
```

### 3. Start PostgreSQL (Docker)

```bash
docker run --name pling-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pling \
  -p 5432:5432 \
  -d postgres:16
```

### 4. Run migrations

```bash
alembic upgrade head
```

### 5. Start the server

```bash
uvicorn app.main:app --reload
```

API docs available at: http://localhost:8000/docs

## Project structure

```
pling-server/
├── app/
│   ├── main.py              # Entry point, middleware, routers
│   ├── config.py            # Settings from .env
│   ├── database.py          # Async SQLAlchemy engine + session
│   ├── auth/
│   │   ├── dependencies.py  # require_user / require_admin / require_contributor
│   │   └── jwt.py           # Token creation and verification
│   ├── models/
│   │   ├── user.py          # User (roles, psn_npsso, psn_account_id)
│   │   ├── achievement.py   # Achievement, Objective, UserAchievement, UserObjective
│   │   ├── game.py          # Game, UserGame
│   │   ├── genre.py         # Genre, GameGenre
│   │   ├── trophy_set.py    # TrophySet (PSN trophy groups)
│   │   ├── psn_token.py     # PSN access token cache
│   │   └── xbox_token.py    # Xbox token storage
│   ├── schemas/
│   │   ├── objective.py     # ObjectiveCreate/Update/Response, UserObjectiveResponse
│   │   ├── achievement.py   # AchievementSummary, UserAchievementResponse
│   │   ├── game.py
│   │   └── user.py
│   ├── routers/
│   │   ├── achievements.py  # CRUD + progress tracking
│   │   ├── objectives.py    # CRUD + counter/tick progress
│   │   ├── games.py         # Library management
│   │   ├── users.py         # Auth (register, login, getMe)
│   │   ├── psn.py           # PSN connect + sync
│   │   ├── genres.py
│   │   └── admin.py         # Admin-only tools (PSN trophy lookup, etc.)
│   └── services/
│       ├── psn_service.py         # PSN trophy fetching via REST API
│       ├── psn_connect_service.py # Store NPSSO, resolve PSN account ID
│       ├── sync_service.py        # Sync earned trophies → UserAchievement records
│       ├── achievement_service.py
│       ├── game_service.py
│       └── xbox_service.py
├── alembic/
│   └── versions/            # Migration history (see below)
├── seed_*.py                # One-off seeding scripts (run locally against prod API)
├── Dockerfile
└── requirements.txt
```

## Deploying to Cloud Run

GCP project ID: `pling-app-alpha`
Cloud Run service: `pling-server` (us-central1)
Prod URL: `https://pling-server-997771527995.us-central1.run.app`

**Migrations run automatically on container startup** (`alembic upgrade head` is baked into the Dockerfile CMD). No separate migration step needed.

```bash
# 1. Build for linux/amd64 (required for Cloud Run) — always use --no-cache to ensure fresh code
docker build --no-cache --platform linux/amd64 -t gcr.io/pling-app-alpha/pling-server:v<N> .

# 2. Push to registry
docker push gcr.io/pling-app-alpha/pling-server:v<N>

# 3. Deploy the new image
gcloud run deploy pling-server \
  --image gcr.io/pling-app-alpha/pling-server:v<N> \
  --platform managed \
  --region us-central1

# 4. Verify the new revision is active and shift traffic to it
#    (Cloud Run sometimes deploys but doesn't auto-activate the new revision)
gcloud run revisions list --service pling-server --region us-central1
gcloud run services update-traffic pling-server \
  --to-revisions <revision-name>=100 \
  --region us-central1
```

> **Note:** Always increment the version tag (`:v1`, `:v2`, etc.) with each deploy. Using `:latest` causes Cloud Run to cache the old image digest and silently run stale code even after a push.

> **Note:** Do NOT run `gcloud run jobs execute migrate` separately — migrations are handled by the container startup script. Running a separate job will fail because it won't have the correct Cloud SQL connection context.

## Data Models

### UserStats (`GET /users/me/stats`)
Returns a structured stats object:
- `games_tracked` — total games in library
- `games_fully_completed` — games at `platinum` or `full_completion` status, cross-platform
- `psn` — `{ trophies_earned, platinums }` — null if no PSN games in library
- `xbox` — `{ gamerscore_earned, gamerscore_total }` — null if no Xbox games in library
- `steam` — `{ games_completed }` — null if no Steam completions

Platform blocks are only included when the user has relevant data, so the frontend can conditionally render per-platform rows. `recalculate_completion` (called after every sync and achievement tick) auto-promotes `UserGame.status` to `in_progress`, `platinum`, or `full_completion` based on completion percent and whether a platinum trophy exists.

### Objective
Belongs to an Achievement. Can be nested one level deep via `parent_objective_id` (group header → leaf steps).

Two types:
- **Checkbox** — user ticks it complete (`is_counter=False`)
- **Counter** — user increments toward a target (`is_counter=True`, `counter_target=N`)

Fields: `title`, `method` (text guide), `image_url`, `video_url`, `sort_order`, `parent_objective_id`

### UserObjective
Per-user progress row for an objective: `is_completed`, `counter_current`, `completed_at`

### UserAchievement
Per-user progress row for an achievement: `is_completed`, `is_pinned`, `progress_current/target`, `completed_at`

## Migration History

| Revision | Description |
|---|---|
| `a72551209ff7` | Initial schema |
| `a54759221c87` | User roles |
| `a9d49294645b` | PSN account ID on users |
| `c4e1f7b2a903` | Parent objective ID (nested objectives) |
| `b3f1a2c8d901` | Genres tables |
| `6657020f5036` | Trophy sets |
| `43b0d58c859e` | Icon URL on achievements |
| `1166c332f1d4` | Sort order on achievements |
| `d7e3f9a1b205` | PSN NPSSO token on users |
| `e8b2c4d6f901` | `is_pinned` on user_achievements |
| `f1a2b3c4d5e6` | `image_url` + `video_url` on objectives |
| `a1b2c3d4e5f6` | Create `xbox_tokens` table (backfill — original migration was a no-op) |

## PSN Sync Architecture

1. User connects PSN by supplying their **NPSSO token** — stored on the `User` record (`psn_npsso` column)
2. At sync time the NPSSO is exchanged for a short-lived **access token** via the PSN auth endpoint
3. Earned trophies are fetched from `https://m.np.playstation.com/api/trophy/v1/users/me/...` using that token
4. Results are matched against the local `Achievement` catalogue by `platform_achievement_id`

> **Why not use psnawp for the full sync?** psnawp re-authenticates (consuming the NPSSO session) on every library call. We use it only to exchange the NPSSO for an access token, then call the PSN REST API directly with that token.

## Known Gotchas

- **MissingGreenlet**: Pydantic's `model_validate` on SQLAlchemy ORM objects triggers lazy-loads outside the async context. Always construct response schemas manually rather than relying on `from_orm` / `model_validate` when returning nested relationships.
- **Alembic autogenerate** won't detect `server_default` changes — add those manually in the migration file.
- **Cloud Run image caching**: Always increment the version tag (`:v1`, `:v2`, etc.). Using `:latest` causes Cloud Run to cache the old image digest and silently run stale code.

## Contributor Seeding Scripts

`seed_*.py` scripts in the root bulk-import objectives for specific achievements. Run locally against the production API with a valid admin JWT:

```bash
BASE_URL=https://pling-server-997771527995.us-central1.run.app \
TOKEN=<your-admin-jwt> \
python seed_arkanis_sector.py
```

The in-app **Seed** tool (contributor role required) accepts the same format interactively:

```
Group Name
    Objective Title | Method text here
    Another Objective | More detail
Standalone Objective
```

- Non-indented lines → group parent (or standalone objective if no children follow)
- Indented lines → child of the preceding group
- `|` separates title from method text
