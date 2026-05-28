from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.routers import users, games, achievements, objectives, admin, psn, genres, game_requests, steam, xbox, public, auth
from app.routers import discord_auth

settings = get_settings()


def run_migrations():
    """Run alembic upgrade head on startup. Safe to call repeatedly — alembic is idempotent."""
    import subprocess, sys
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"[startup] Migration failed:\n{result.stderr}", file=sys.stderr)
        raise RuntimeError("Database migration failed — aborting startup")
    if result.stdout.strip():
        print(f"[startup] Migration output:\n{result.stdout}")
    else:
        print("[startup] Database schema up to date")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_production:
        run_migrations()
    else:
        await init_db()
    yield


app = FastAPI(
    title="Pling",
    description="Achievement and trophy tracking for serious hunters.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(games.router, prefix="/api/games", tags=["games"])
app.include_router(achievements.router, prefix="/api/achievements", tags=["achievements"])
app.include_router(objectives.router, prefix="/api/objectives", tags=["objectives"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(psn.router, prefix="/api/users/me/psn", tags=["psn"])
app.include_router(genres.router, prefix="/api/genres", tags=["genres"])
app.include_router(game_requests.router, prefix="/api/game-requests", tags=["game-requests"])
app.include_router(steam.router, prefix="/api/users/me/steam", tags=["steam"])
app.include_router(xbox.router, prefix="/api/users/me/xbox", tags=["xbox"])
app.include_router(public.router, prefix="/api/public", tags=["public"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(discord_auth.router, prefix="/api/auth/discord", tags=["discord-auth"])


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "app": "Pling", "version": "0.1.0"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}