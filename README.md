# Pling

A community-driven game achievement and trophy tracker. Users track their progress on PlayStation, Xbox, and Steam. Contributors enrich the shared catalogue with step-by-step objectives, methods, images, and videos.

## Architecture

```
pling-app/
├── pling-server/   # FastAPI backend — Google Cloud Run
└── pling-client/   # React frontend — Firebase Hosting
```

**Backend**: Python 3.12 + FastAPI + SQLAlchemy (async) + PostgreSQL (Cloud SQL). Migrations run automatically on container startup via Alembic.

**Frontend**: React 18 + Vite + TanStack Query + Zustand + Tailwind CSS.

## Features

### For Users
- Browse a shared game catalogue and track your library
- Mark achievements/trophies complete with per-user progress
- Check off individual objectives, or use counter objectives (e.g. "47/100 collectibles")
- Sync earned trophies automatically from PSN
- Pin achievements to the top of a game page
- Filter achievements: Incomplete / Complete / Game Order

### For Contributors
- Add and edit objectives with method text, image URLs, and YouTube video embeds
- Bulk-seed objectives via the Seed tool using a structured text format
- Nest objectives under group parents for multi-step guides

### Platform Integrations
- **PSN** — connect via NPSSO token, sync earned trophies per game
- **Xbox** — connect via Xbox token
- **Steam** — basic integration

## User Roles

| Role | Can Do |
|---|---|
| `guest` | Browse catalogue, view objectives |
| `user` | Track progress, sync platforms |
| `contributor` | Create and edit objectives |
| `admin` | Full access including admin panel |

## Docs

- **[pling-server/README.md](pling-server/README.md)** — backend setup, deployment, data models, PSN sync architecture, migration history
- **[pling-client/README.md](pling-client/README.md)** — frontend setup, deployment, component guide, auth patterns
