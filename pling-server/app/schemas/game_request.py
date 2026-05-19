import uuid
from datetime import datetime
from pydantic import BaseModel


class PlingBase(BaseModel):
    model_config = {"from_attributes": True}


class GameRequestCreate(PlingBase):
    title: str
    platform: str | None = None
    notes: str | None = None


class RequesterSummary(PlingBase):
    id: uuid.UUID
    username: str


class GameRequestResponse(PlingBase):
    id: uuid.UUID
    title: str
    platform: str | None
    notes: str | None
    status: str
    vote_count: int
    has_voted: bool  # whether the current user has voted
    requested_by: RequesterSummary | None
    created_at: datetime


class GameRequestVoteResponse(PlingBase):
    request_id: uuid.UUID
    vote_count: int
    has_voted: bool
