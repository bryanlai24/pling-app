# Pling — Tech Stack Cheatsheet

A lightweight, modern full-stack web app foundation. Fast to build, cheap to run, easy to scale.

---

## Architecture Overview

```
pling-app/                    ← monorepo root
├── pling-server/             ← Python FastAPI backend
└── pling-client/             ← React frontend
```

```
Browser → Firebase Hosting (CDN)
              ↓ /api/** proxy
         Google Cloud Run (FastAPI)
              ↓
         Google Cloud SQL (PostgreSQL)
```

---

## Backend — pling-server

### Core stack
| Layer | Technology | Why |
|---|---|---|
| Language | Python 3.12 | Fast to write, huge ecosystem |
| Framework | FastAPI | Async, auto Swagger docs, Pydantic built-in |
| ORM | SQLAlchemy 2.0 (async) | Type-safe, powerful, async-native |
| Database | PostgreSQL 16 | Relational, battle-tested, great with SQLAlchemy |
| Migrations | Alembic | Schema versioning, autogenerate from models |
| Auth | JWT (python-jose) + bcrypt | Stateless, simple, standard |
| Validation | Pydantic v2 | Request/response validation, settings management |
| Server | Uvicorn | ASGI, fast, production-ready |

### Key patterns
**Three-layer architecture:**
```
routers/    ← HTTP endpoints, request/response only
services/   ← Business logic
models/     ← SQLAlchemy ORM (database schema)
schemas/    ← Pydantic (API input/output shapes)
```

**Async everywhere:**
```python
async def get_game(db: AsyncSession, game_id: uuid.UUID) -> Game:
    result = await db.execute(select(Game).where(Game.id == game_id))
    return result.scalar_one_or_none()
```

**Dependency injection:**
```python
@router.get("/games")
async def list_games(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

**Settings from environment:**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    class Config:
        env_file = ".env"
```

### Project structure
```
pling-server/
├── app/
│   ├── main.py              # FastAPI app, middleware, routers
│   ├── config.py            # Pydantic settings
│   ├── database.py          # Async engine, session, Base
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── routers/             # Route handlers
│   ├── services/            # Business logic
│   └── auth/                # JWT + bcrypt
├── alembic/                 # Database migrations
├── Dockerfile               # Production image
├── Dockerfile.dev           # Development image (hot reload)
└── requirements.txt
```

### Key dependencies (pinned versions)
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
alembic==1.13.3
asyncpg==0.29.0
pydantic==2.9.2
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==4.0.1          ← must pin this version
email-validator==2.2.0
httpx==0.27.0
psnawp==3.0.3          ← must pin this version
```

---

## Frontend — pling-client

### Core stack
| Layer | Technology | Why |
|---|---|---|
| Framework | React 18 | Component-based, huge ecosystem, path to React Native |
| Build tool | Vite 8 | Extremely fast HMR, modern tooling |
| Styling | Tailwind CSS v4 | Utility-first, responsive by default, no CSS files |
| Server state | TanStack Query (React Query) | Caching, loading states, refetching |
| Client state | Zustand | Tiny, simple, no boilerplate |
| Routing | React Router v6 | File-based routing, nested routes |
| HTTP client | Axios | Interceptors for auth token injection |

### Key patterns
**API client with auto-auth:**
```js
const client = axios.create({ baseURL: '/api' })
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pling_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

**Server state with React Query:**
```js
const { data: library, isLoading } = useQuery({
  queryKey: ['library'],
  queryFn: () => getLibrary().then(r => r.data),
})

const mutation = useMutation({
  mutationFn: (data) => createGame(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
})
```

**Global auth state with Zustand:**
```js
export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('pling_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('pling_token', token)
    set({ user, token })
  },
  clearAuth: () => {
    localStorage.removeItem('pling_token')
    set({ user: null, token: null })
  },
}))
```

**Protected routes:**
```jsx
function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}
```

### Project structure
```
pling-client/
├── src/
│   ├── api/                 # Axios calls (auth, games, achievements, objectives)
│   ├── components/          # Reusable UI components
│   │   ├── layout/          # Nav, Layout wrapper
│   │   ├── games/           # Game-specific components
│   │   ├── achievements/    # Achievement components
│   │   └── objectives/      # Objective components
│   ├── pages/               # Route-level page components
│   ├── store/               # Zustand stores (auth, UI)
│   └── main.jsx             # Entry point, providers
├── vite.config.js           # Vite + Tailwind + dev proxy
├── Dockerfile.dev           # Development container
└── firebase.json            # Firebase Hosting config
```

### Tailwind v4 setup
```js
// vite.config.js
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```
```css
/* index.css */
@import "tailwindcss";
```
No `tailwind.config.js` needed in v4.

---

## Infrastructure

### Local development
```
Docker Compose
├── pling-db     (postgres:16)
├── pling-server (FastAPI + hot reload)
└── pling-client (Vite + hot reload)
```

One command to start everything:
```bash
docker compose up
```

### Production (GCP)
```
Google Cloud Run          ← Backend (scales to zero, pay per request)
Google Cloud SQL          ← PostgreSQL (managed, automatic backups)
Google Artifact Registry  ← Docker image storage
Google Secret Manager     ← Credentials (DATABASE_URL, SECRET_KEY, etc.)
Firebase Hosting          ← Frontend (CDN, free tier, instant deploys)
```

**Cost profile for solo/small use:** Near zero when idle. Cloud Run scales to zero, Firebase Hosting is free tier, Cloud SQL is the main cost (~$10-15/month for db-g1-small).

### CI/CD flow

GCP project: `pling-app-alpha` | Cloud Run service: `pling-server` | Region: `us-central1`
Prod backend URL: `https://pling-server-997771527995.us-central1.run.app`

```bash
# Backend deploy (from pling-server/)
# Increment version tag each deploy — :latest causes Cloud Run to silently run stale code
docker build --no-cache --platform linux/amd64 -t gcr.io/pling-app-alpha/pling-server:v<N> .
docker push gcr.io/pling-app-alpha/pling-server:v<N>
gcloud run deploy pling-server \
  --image gcr.io/pling-app-alpha/pling-server:v<N> \
  --platform managed \
  --region us-central1
# Verify new revision is active and receiving traffic
gcloud run revisions list --service pling-server --region us-central1
gcloud run services update-traffic pling-server --to-revisions <revision-name>=100 --region us-central1

# Frontend deploy (from pling-client/)
npm run build
firebase deploy --only hosting
```

**Migrations:** `alembic upgrade head` runs automatically on container startup (baked into Dockerfile CMD). No separate step needed — do NOT use `gcloud run jobs execute migrate`.

**Firebase → Cloud Run routing:** `firebase.json` routes `/api/**` to the `pling-server` service by service ID, so the frontend automatically picks up new backend URLs without config changes.

### Secrets management
All secrets stored in GCP Secret Manager, injected into Cloud Run at runtime:
```bash
gcloud secrets create MY_SECRET --data-file=-
gcloud run deploy ... --set-secrets="ENV_VAR=MY_SECRET:latest"
```

---

## Database Schema Pattern

**Canonical data vs. user data** — the core design principle:

```
games, achievements, objectives    ← shared catalogue (everyone sees)
user_games, user_achievements,
user_objectives                    ← personal progress (per user)
```

This means curators populate the catalogue once and all users track progress against it.

**Trophy set hierarchy:**
```
Game
 └── TrophySet (Base Game, DLC, Expansion)
      └── Achievement (trophy)
           └── Objective (group header or leaf step)
                └── Objective (leaf step, child of group)
```

Objectives support two levels of nesting via a self-referential `parent_objective_id` FK. Group headers have `method: null` and `children: [...]`. Leaf steps have `method` text and `children: []`. The frontend renders group headers as dividers with a completion count, and leaf steps as checkable items. User progress is only tracked on leaf nodes.

**User progress hierarchy:**
```
User
 └── UserGame (library entry, completion %)
      └── UserAchievement (earned/not earned)
           └── UserObjective (ticked/counter progress — leaf objectives only)
```

---

## Genre System

Games have a many-to-many relationship with genres via a `game_genres` join table. The `Genre` model uses a `BaseGenre` PostgreSQL enum with 14 values. The `Game` model exposes genres via a SQLAlchemy `association_proxy` for clean access.

Genres are contributor/admin only to set. The frontend renders genre chips on `GamePage` and `LibraryPage`, with an inline editor for contributors.

---

## PSN Integration

**Trophy catalogue import** (`GET /api/admin/import/psn`) — uses a server-level NPSSO token stored in GCP Secret Manager. Fetches the full trophy list for a game using the `psnawp` library and populates `achievements` + `trophy_sets`.

**Trophy sync** (`POST /api/users/me/psn/sync/{game_id}`) — syncs a specific user's earned trophies from PSN into their `user_achievements`. Uses the same server-level token. Tries PS5 first, falls back to PS4.

**Important NPSSO limitations:**
- NPSSO is a session cookie, not a proper OAuth token — Sony only allows one active session per account
- Dev and prod share the same server-level token, so using PSN locally will invalidate prod's session
- Rule of thumb: **do all PSN imports and syncs on prod only**
- The user-level connect/disconnect endpoints (`POST /api/psn/connect`) exist for future per-user OAuth, but sync currently still uses the server token

**Token storage:** Access + refresh tokens are persisted in the `psn_tokens` table and auto-refreshed when expired. Full re-auth from NPSSO only happens if the refresh token is also expired.

---

## Auth Flow

```
1. Register → bcrypt hash password → store user → return JWT
2. Login → verify bcrypt → return JWT
3. Every request → JWT in Authorization header → decode → get user
4. Protected endpoints → Depends(get_current_user)
5. Role-protected endpoints → Depends(require_admin) or Depends(require_contributor)
```

**JWT payload:**
```json
{ "sub": "user-uuid", "exp": 1234567890, "iat": 1234567890 }
```

---

## Why This Stack

**For solo/small projects:**
- Near-zero idle costs on GCP
- One command local development with Docker Compose
- Fast iteration — Python + React are quick to write
- Auto-generated API docs with FastAPI/Swagger
- Type safety end-to-end (Pydantic + SQLAlchemy typed columns)

**For scaling:**
- Cloud Run auto-scales horizontally
- PostgreSQL handles millions of rows
- React → React Native for mobile (shared logic)
- Async FastAPI handles high concurrency efficiently

**For maintainability:**
- Clean separation of concerns (models/schemas/routers/services)
- Alembic migrations keep schema changes versioned
- Environment-based config (dev/prod parity)
- Monorepo keeps everything together
