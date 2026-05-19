from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.routers import users, games, achievements, objectives, admin, psn, genres, game_requests, steam, xbox

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.is_production:
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


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "app": "Pling", "version": "0.1.0"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}