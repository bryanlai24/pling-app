import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.xbox_token import XboxToken
from app.schemas.user import UserPublic
from app.services.xbox_service import generate_auth_url, exchange_code_for_user_tokens
from app.services.sync_service import sync_xbox_game
from app.config import get_settings

router = APIRouter()


@router.get("/auth-url")
async def get_xbox_auth_url(request: Request, current_user: User = Depends(get_current_user)):
    """Return the Microsoft OAuth URL for the user to open in a popup.
    Passes the user's JWT as the OAuth state param so the callback can
    identify the user without a session cookie.
    """
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    return {"auth_url": generate_auth_url(state=token)}


@router.get("/callback", response_class=HTMLResponse)
async def xbox_oauth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Microsoft redirects here after the user signs in. Exchanges the code for
    tokens, stores them, then closes the popup via postMessage to the opener.
    No JWT auth — user identity is carried in the 'state' query param (the JWT).
    """
    code = request.query_params.get("code")
    error = request.query_params.get("error")
    state = request.query_params.get("state", "")  # JWT passed through OAuth state param

    settings = get_settings()
    origin = settings.cors_origins_list[0] if settings.cors_origins_list else "*"

    def html_response(success: bool, message: str) -> HTMLResponse:
        event = "xbox_connected" if success else "xbox_error"
        return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head><title>Xbox Connect</title></head>
<body style="background:#0a0a0f;color:#f0ecff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <p>{"Connected! Closing..." if success else f"Error: {message}"}</p>
  <script>
    if (window.opener) {{
      window.opener.postMessage({{ type: '{event}', message: {repr(message)} }}, '*');
      window.close();
    }} else {{
      document.querySelector('p').textContent = '{"Connected! You can close this window." if success else f"Error: {message}"}';
    }}
  </script>
</body>
</html>""")

    if error:
        return html_response(False, f"Microsoft login failed: {error}")

    if not code:
        return html_response(False, "No auth code received from Microsoft")

    # Decode the JWT from state to get user identity
    if not state:
        return html_response(False, "Missing state — please try connecting again")

    from app.auth.jwt import decode_access_token
    user_id_str = decode_access_token(state)
    if not user_id_str:
        return html_response(False, "Session expired — please log in to Pling and try again")
    try:
        user_id = uuid.UUID(user_id_str)
    except Exception:
        return html_response(False, "Invalid session — please try again")

    try:
        result = await exchange_code_for_user_tokens(db, user_id, code)
    except Exception as e:
        return html_response(False, str(e))

    # Store gamertag on user row
    from app.models.user import User as UserModel
    from sqlalchemy import select as sa_select
    user_result = await db.execute(sa_select(UserModel).where(UserModel.id == user_id))
    user = user_result.scalar_one_or_none()
    if user and result.get("gamertag"):
        user.xbox_gamertag = result["gamertag"]
        await db.flush()

    return html_response(True, result.get("gamertag") or "Connected")


@router.post("/connect", response_model=UserPublic)
async def connect_xbox(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exchange an OAuth code for tokens and store them against the current user.

    The user opens the auth URL, signs in, and copies the 'code' parameter
    from the redirect URL (https://login.microsoftonline.com/...?code=XXXXX).
    """
    code = data.get("code", "").strip()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth code is required")

    try:
        result = await exchange_code_for_user_tokens(db, current_user.id, code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect Xbox account: {str(e)}",
        )

    # Store gamertag on user row for display
    if result.get("gamertag"):
        current_user.xbox_gamertag = result["gamertag"]
        await db.flush()
        await db.refresh(current_user)

    return UserPublic.model_validate(current_user)


@router.delete("/disconnect", response_model=UserPublic)
async def disconnect_xbox(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the user's Xbox token and clear their gamertag."""
    result = await db.execute(
        select(XboxToken).where(XboxToken.user_id == current_user.id).limit(1)
    )
    token = result.scalar_one_or_none()
    if token:
        await db.delete(token)

    current_user.xbox_gamertag = None
    await db.flush()
    await db.refresh(current_user)
    return UserPublic.model_validate(current_user)


@router.post("/sync/{game_id}")
async def sync_xbox_game_achievements(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync earned Xbox achievements for a specific game into the user's achievement progress."""
    if not current_user.xbox_gamertag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Xbox account connected. Connect your Xbox account in your profile first.",
        )
    result = await sync_xbox_game(db, current_user.id, game_id)
    return result
