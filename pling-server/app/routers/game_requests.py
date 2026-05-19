import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth.dependencies import get_current_user as require_user, get_optional_user
from app.models.game_request import GameRequest, GameRequestVote, RequestStatus
from app.models.user import User
from app.schemas.game_request import GameRequestCreate, GameRequestResponse, GameRequestVoteResponse

router = APIRouter()


def _build_response(request: GameRequest, current_user_id: uuid.UUID | None, vote_count: int, has_voted: bool) -> GameRequestResponse:
    requested_by = None
    if request.requested_by:
        requested_by = {"id": request.requested_by.id, "username": request.requested_by.username}
    return GameRequestResponse(
        id=request.id,
        title=request.title,
        platform=request.platform,
        notes=request.notes,
        status=request.status,
        vote_count=vote_count,
        has_voted=has_voted,
        requested_by=requested_by,
        created_at=request.created_at,
    )


@router.get("", response_model=list[GameRequestResponse])
async def list_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """List all open game requests, sorted by vote count descending."""
    result = await db.execute(
        select(GameRequest)
        .options(selectinload(GameRequest.requested_by), selectinload(GameRequest.votes))
        .where(GameRequest.status == RequestStatus.open)
        .order_by(GameRequest.created_at.desc())
    )
    requests = result.scalars().all()

    out = []
    for req in requests:
        vote_count = len(req.votes)
        has_voted = any(v.user_id == current_user.id for v in req.votes) if current_user else False
        out.append(_build_response(req, current_user.id if current_user else None, vote_count, has_voted))

    # Sort by vote count descending
    out.sort(key=lambda r: r.vote_count, reverse=True)
    return out


@router.post("", response_model=GameRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    body: GameRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
):
    """Submit a new game request. Any logged-in user can request."""
    req = GameRequest(
        title=body.title.strip(),
        platform=body.platform,
        notes=body.notes,
        requested_by_id=current_user.id,
    )
    db.add(req)
    # Auto-vote for your own request
    await db.flush()
    vote = GameRequestVote(request_id=req.id, user_id=current_user.id)
    db.add(vote)
    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(GameRequest)
        .options(selectinload(GameRequest.requested_by), selectinload(GameRequest.votes))
        .where(GameRequest.id == req.id)
    )
    req = result.scalar_one()
    return _build_response(req, current_user.id, len(req.votes), True)


@router.post("/{request_id}/vote", response_model=GameRequestVoteResponse)
async def vote(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
):
    """Upvote a game request. Idempotent — voting twice is a no-op."""
    result = await db.execute(
        select(GameRequest)
        .options(selectinload(GameRequest.votes))
        .where(GameRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != RequestStatus.open:
        raise HTTPException(status_code=400, detail="Request is already fulfilled")

    already_voted = any(v.user_id == current_user.id for v in req.votes)
    if not already_voted:
        db.add(GameRequestVote(request_id=req.id, user_id=current_user.id))
        await db.commit()
        await db.refresh(req)
        # reload votes
        result = await db.execute(
            select(GameRequest)
            .options(selectinload(GameRequest.votes))
            .where(GameRequest.id == request_id)
        )
        req = result.scalar_one()

    return GameRequestVoteResponse(
        request_id=req.id,
        vote_count=len(req.votes),
        has_voted=True,
    )


@router.delete("/{request_id}/vote", response_model=GameRequestVoteResponse)
async def unvote(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
):
    """Remove your vote from a game request."""
    result = await db.execute(
        select(GameRequestVote).where(
            GameRequestVote.request_id == request_id,
            GameRequestVote.user_id == current_user.id,
        )
    )
    vote = result.scalar_one_or_none()
    if vote:
        await db.delete(vote)
        await db.commit()

    # Return updated count
    result = await db.execute(
        select(GameRequest)
        .options(selectinload(GameRequest.votes))
        .where(GameRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    return GameRequestVoteResponse(
        request_id=req.id,
        vote_count=len(req.votes),
        has_voted=False,
    )


@router.patch("/{request_id}/fulfill", response_model=GameRequestResponse)
async def fulfill_request(
    request_id: uuid.UUID,
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
):
    """Mark a request as fulfilled (contributor/admin only)."""
    if current_user.role not in ("contributor", "admin"):
        raise HTTPException(status_code=403, detail="Contributor or admin role required")

    result = await db.execute(
        select(GameRequest)
        .options(selectinload(GameRequest.requested_by), selectinload(GameRequest.votes))
        .where(GameRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = RequestStatus.fulfilled
    req.fulfilled_game_id = game_id
    await db.commit()
    await db.refresh(req)

    return _build_response(req, current_user.id, len(req.votes), any(v.user_id == current_user.id for v in req.votes))
