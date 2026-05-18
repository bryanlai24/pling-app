import uuid
from app.schemas import PlingBase
from app.models.genre import BaseGenre


# ── Request schemas ────────────────────────────────────────────────────────────

class GenreCreate(PlingBase):
    genre: BaseGenre


class GameGenresUpdate(PlingBase):
    genre_ids: list[uuid.UUID]


# ── Response schemas ───────────────────────────────────────────────────────────

class GenreResponse(PlingBase):
    id: uuid.UUID
    genre: BaseGenre
