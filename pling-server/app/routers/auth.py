"""Social OAuth endpoints — Google and Apple sign-in."""
import httpx
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.auth.jwt import create_access_token
from app.models.user import User
from app.models.email_token import EmailToken, EmailTokenType
from app.schemas.user import UserPublic, TokenResponse
from app.services import user_service
from app.services.email_service import send_merge_confirmation_email
from app.config import get_settings

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_username_from_email(email: str) -> str:
    """Derive a safe base username from an email address."""
    import re
    base = email.split("@")[0]
    base = re.sub(r"[^a-z0-9_-]", "", base.lower())[:30] or "user"
    return base


async def _ensure_unique_username(db: AsyncSession, base: str) -> str:
    """Append a number suffix until the username is unique."""
    import secrets
    candidate = base
    for _ in range(10):
        existing = await user_service.get_user_by_username(db, candidate)
        if not existing:
            return candidate
        candidate = f"{base}{secrets.randbelow(9000) + 1000}"
    return f"{base}{secrets.token_hex(3)}"


async def _social_login(
    db: AsyncSession,
    provider: str,          # "google" | "apple" | "discord"
    provider_id: str,       # unique user ID from the provider
    email: str,
    email_verified: bool,
    display_name: str | None,
) -> dict:
    """
    Core find-or-create-or-link logic shared by Google, Apple, and Discord flows.
    Returns a dict with 'token' + 'user', or 'merge_pending': True.
    """
    if provider == "google":
        id_field = User.google_id
    elif provider == "apple":
        id_field = User.apple_id
    else:
        id_field = User.discord_id

    # 1. Existing account already linked to this provider ID → straight in
    result = await db.execute(select(User).where(id_field == provider_id))
    user = result.scalar_one_or_none()
    if user:
        jwt = create_access_token(user.id)
        return {"access_token": jwt, "user": UserPublic.model_validate(user)}

    # 2. Existing account with matching email
    existing = await user_service.get_user_by_email(db, email)
    if existing:
        if existing.email_verified or email_verified:
            # Safe to auto-link
            if provider == "google":
                existing.google_id = provider_id
            elif provider == "apple":
                existing.apple_id = provider_id
            else:
                existing.discord_id = provider_id
            if not existing.email_verified and email_verified:
                existing.email_verified = True
            await db.flush()
            jwt = create_access_token(existing.id)
            return {"access_token": jwt, "user": UserPublic.model_validate(existing)}
        else:
            # Unverified existing account — send merge confirmation email
            token = await user_service.create_merge_token(db, existing, provider, provider_id)
            await send_merge_confirmation_email(existing.email, existing.username, provider, token)
            return {"merge_pending": True, "email": existing.email}

    # 3. Brand new user — ask them to pick a username first.
    # Derive a suggested username from their display name or email, but don't
    # create the account yet. Return a short-lived setup token they'll exchange
    # after confirming their username via POST /auth/complete-social-signup.
    import re
    username_base = _generate_username_from_email(email)
    if display_name:
        clean = re.sub(r"[^a-z0-9_-]", "", display_name.lower().replace(" ", "_"))[:30]
        if clean:
            username_base = clean
    suggested_username = await _ensure_unique_username(db, username_base)

    # Store provider details in a short-lived token so the frontend can
    # complete signup without re-authenticating with Google/Apple.
    import secrets as _secrets
    setup_token = _secrets.token_urlsafe(32)

    setup_record = EmailToken(
        user_id=None,  # no user yet
        token=setup_token,
        token_type=EmailTokenType.setup,
        provider=provider,
        provider_id=provider_id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        extra_json={"email": email, "email_verified": email_verified, "display_name": display_name},
    )
    db.add(setup_record)
    await db.flush()

    return {
        "username_required": True,
        "setup_token": setup_token,
        "suggested_username": suggested_username,
    }


# ── Google ─────────────────────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    access_token: str  # OAuth2 access token from the frontend SDK


@router.post("/google")
async def google_auth(data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    # Fetch user info using the access token
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {data.access_token}"},
        )
        if not resp.is_success:
            raise HTTPException(status_code=401, detail="Invalid Google access token")
        info = resp.json()

    provider_id = info.get("sub")
    email = info.get("email")
    email_verified = info.get("email_verified") in (True, "true", True)
    display_name = info.get("name")

    if not provider_id or not email:
        raise HTTPException(status_code=401, detail="Incomplete Google token payload")

    result = await _social_login(db, "google", provider_id, email, email_verified, display_name)

    if result.get("merge_pending"):
        return {"merge_pending": True, "email": result["email"]}

    return TokenResponse(access_token=result["access_token"], user=result["user"])


# ── Apple ──────────────────────────────────────────────────────────────────────

class AppleAuthRequest(BaseModel):
    identity_token: str   # JWT from Apple
    given_name: str | None = None
    family_name: str | None = None


@router.post("/apple")
async def apple_auth(data: AppleAuthRequest, db: AsyncSession = Depends(get_db)):
    # Fetch Apple's public keys
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get("https://appleid.apple.com/auth/keys")
        if not resp.is_success:
            raise HTTPException(status_code=502, detail="Could not fetch Apple public keys")
        jwks = resp.json()

    # Decode header to find the right key
    try:
        header = pyjwt.get_unverified_header(data.identity_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Apple identity token")

    kid = header.get("kid")
    matching_key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not matching_key:
        raise HTTPException(status_code=401, detail="Apple signing key not found")

    try:
        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(matching_key)
        settings = get_settings()
        payload = pyjwt.decode(
            data.identity_token,
            public_key,
            algorithms=["RS256"],
            audience=settings.apple_client_id or None,
            options={"verify_aud": bool(settings.apple_client_id)},
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Apple token verification failed: {e}")

    provider_id = payload.get("sub")
    email = payload.get("email")
    email_verified = payload.get("email_verified") in (True, "true")

    if not provider_id:
        raise HTTPException(status_code=401, detail="Incomplete Apple token payload")

    # Apple only sends email on first login — if missing, look up by provider_id
    if not email:
        result2 = await db.execute(select(User).where(User.apple_id == provider_id))
        existing = result2.scalar_one_or_none()
        if existing:
            jwt = create_access_token(existing.id)
            return TokenResponse(access_token=jwt, user=UserPublic.model_validate(existing))
        raise HTTPException(status_code=400, detail="Email not provided by Apple and no existing account found")

    display_name = " ".join(filter(None, [data.given_name, data.family_name])) or None
    result = await _social_login(db, "apple", provider_id, email, email_verified, display_name)

    if result.get("merge_pending"):
        return {"merge_pending": True, "email": result["email"]}

    return TokenResponse(access_token=result["access_token"], user=result["user"])


# ── Merge confirmation ─────────────────────────────────────────────────────────

@router.get("/confirm-merge")
async def confirm_merge(token: str, db: AsyncSession = Depends(get_db)):
    """Called when user clicks the merge link in their email."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token == token,
            EmailToken.token_type == EmailTokenType.merge,
            EmailToken.expires_at > now,
        )
    )
    email_token = result.scalar_one_or_none()
    if not email_token:
        raise HTTPException(status_code=400, detail="Invalid or expired merge link")

    user_result = await db.execute(select(User).where(User.id == email_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Link the provider
    if email_token.provider == "google":
        user.google_id = email_token.provider_id
    else:
        user.apple_id = email_token.provider_id
    user.email_verified = True

    await db.execute(delete(EmailToken).where(EmailToken.id == email_token.id))
    await db.flush()

    jwt = create_access_token(user.id)
    return TokenResponse(access_token=jwt, user=UserPublic.model_validate(user))


# ── Complete social signup (choose username) ────────────────────────────────────

class CompleteSocialSignupRequest(BaseModel):
    setup_token: str
    username: str


@router.post("/complete-social-signup")
async def complete_social_signup(data: CompleteSocialSignupRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a setup token + chosen username for a real JWT."""
    import re

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token == data.setup_token,
            EmailToken.token_type == EmailTokenType.setup,
            EmailToken.expires_at > now,
        )
    )
    setup = result.scalar_one_or_none()
    if not setup:
        raise HTTPException(status_code=400, detail="Setup session expired — please sign in with Google again")

    # Validate username
    username = data.username.strip()
    if not re.match(r'^[a-zA-Z0-9_-]{3,30}$', username):
        raise HTTPException(status_code=422, detail="Username must be 3–30 characters: letters, numbers, hyphens, underscores")

    existing = await user_service.get_user_by_username(db, username)
    if existing:
        raise HTTPException(status_code=409, detail="That username is already taken")

    payload = setup.extra_json or {}
    email = payload.get("email")
    email_verified = payload.get("email_verified", False)
    display_name = payload.get("display_name")

    if not email:
        raise HTTPException(status_code=400, detail="Setup session is missing email — please sign in again")

    user = User(
        username=username,
        email=email,
        password_hash=None,
        email_verified=email_verified,
    )
    if setup.provider == "google":
        user.google_id = setup.provider_id
    elif setup.provider == "apple":
        user.apple_id = setup.provider_id
    else:
        user.discord_id = setup.provider_id

    db.add(user)
    await db.execute(delete(EmailToken).where(EmailToken.id == setup.id))
    await db.flush()
    await db.refresh(user)

    jwt = create_access_token(user.id)
    return TokenResponse(access_token=jwt, user=UserPublic.model_validate(user))
