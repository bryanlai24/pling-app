import asyncio, inspect, uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from xbox.webapi.authentication.manager import AuthenticationManager
from xbox.webapi.authentication.models import OAuth2TokenResponse
from xbox.webapi.api.client import XboxLiveClient
from xbox.webapi.common.signed_session import SignedSession
from app.config import get_settings
from app.models.xbox_token import XboxToken


def _make_auth_manager(session, settings) -> AuthenticationManager:
    return AuthenticationManager(
        session,
        settings.xbox_client_id,
        settings.xbox_client_secret,
        settings.xbox_redirect_uri,
    )


def generate_auth_url(state: str = "") -> str:
    settings = get_settings()
    url = (
        "https://login.live.com/oauth20_authorize.srf"
        f"?client_id={settings.xbox_client_id}"
        "&response_type=code"
        "&approval_prompt=auto"
        "&scope=XboxLive.signin+XboxLive.offline_access"
        f"&redirect_uri={quote(settings.xbox_redirect_uri, safe='')}"
    )
    if state:
        url += f"&state={quote(state, safe='')}"
    return url


async def exchange_code_for_tokens(db: AsyncSession, code: str) -> dict:
    settings = get_settings()
    async with SignedSession() as session:
        auth_mgr = _make_auth_manager(session, settings)

        oauth_response = await auth_mgr.request_oauth_token(code)
        auth_mgr.oauth = oauth_response

        # Refresh OAuth then XSTS to get XUID
        auth_mgr.oauth = await auth_mgr.refresh_oauth_token()
        await auth_mgr.refresh_tokens()

        oauth = auth_mgr.oauth
        xuid = str(auth_mgr.xsts_token.xuid)
        now = datetime.now(timezone.utc)
        expires_in = getattr(oauth, 'expires_in', None) or 3600
        refresh_expires_in = 1209600

        # Get gamertag
        gamertag = None
        try:
            xbl_client = XboxLiveClient(auth_mgr)
            profile = await xbl_client.profile.get_profile_by_xuid(xuid)
            if profile.profile_users:
                for setting in profile.profile_users[0].settings:
                    if setting.id == "Gamertag":
                        gamertag = setting.value
                        break
        except Exception as e:
            print(f"Could not fetch gamertag: {e}")

        # Store tokens
        result = await db.execute(select(XboxToken).limit(1))
        token_record = result.scalar_one_or_none()

        if token_record:
            token_record.access_token = oauth.access_token
            token_record.refresh_token = oauth.refresh_token
            token_record.access_token_expires_at = now + timedelta(seconds=expires_in)
            token_record.refresh_token_expires_at = now + timedelta(seconds=refresh_expires_in)
            token_record.gamertag = gamertag
            token_record.xuid = xuid
        else:
            token_record = XboxToken(
                access_token=oauth.access_token,
                refresh_token=oauth.refresh_token,
                access_token_expires_at=now + timedelta(seconds=expires_in),
                refresh_token_expires_at=now + timedelta(seconds=refresh_expires_in),
                gamertag=gamertag,
                xuid=xuid,
            )
            db.add(token_record)

        await db.flush()
        return {"gamertag": gamertag, "xuid": xuid}


async def get_xbox_client(db: AsyncSession) -> XboxLiveClient:
    """Get an authenticated XboxLiveClient using stored tokens."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(XboxToken).order_by(XboxToken.updated_at.desc()).limit(1)
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise Exception("No Xbox tokens stored — authenticate first via /admin/xbox/auth-url")

    if token_record.refresh_token_expires_at < now:
        raise Exception("Xbox refresh token expired — re-authenticate via /admin/xbox/auth-url")

    # Build OAuth2TokenResponse from stored tokens
    oauth = OAuth2TokenResponse.parse_raw('{}')
    oauth.access_token = token_record.access_token
    oauth.refresh_token = token_record.refresh_token

    async with SignedSession() as session:
        auth_mgr = get_auth_manager(session)
        auth_mgr.oauth = oauth

        # Refresh if access token expired
        if token_record.access_token_expires_at < now:
            await auth_mgr.refresh_tokens()
            new_oauth = auth_mgr.oauth
            token_record.access_token = new_oauth.access_token
            token_record.refresh_token = new_oauth.refresh_token
            token_record.access_token_expires_at = now + timedelta(seconds=new_oauth.expires_in or 3600)
            await db.flush()

        return XboxLiveClient(auth_mgr)


async def _get_authenticated_client(db: AsyncSession):
    """Get a fully authenticated XboxLiveClient from stored tokens."""
    result = await db.execute(
        select(XboxToken).order_by(XboxToken.updated_at.desc()).limit(1)
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        raise Exception("No Xbox tokens — authenticate first via /admin/xbox/auth-url")

    settings = get_settings()
    session = SignedSession()
    await session.__aenter__()

    auth_mgr = _make_auth_manager(session, settings)
    auth_mgr.oauth = OAuth2TokenResponse(
        token_type="bearer",
        expires_in=3600,
        scope="XboxLive.signin XboxLive.offline_access",
        access_token=token_record.access_token,
        refresh_token=token_record.refresh_token,
        user_id="",
    )

    # Refresh OAuth token first, then XSTS
    auth_mgr.oauth = await auth_mgr.refresh_oauth_token()
    await auth_mgr.refresh_tokens()

    # Update stored tokens
    now = datetime.now(timezone.utc)
    token_record.access_token = auth_mgr.oauth.access_token
    token_record.refresh_token = auth_mgr.oauth.refresh_token
    token_record.access_token_expires_at = now + timedelta(seconds=auth_mgr.oauth.expires_in or 3600)
    if not token_record.xuid:
        token_record.xuid = str(auth_mgr.xsts_token.xuid)
    if not token_record.gamertag:
        try:
            xbl_client = XboxLiveClient(auth_mgr)
            profile = await xbl_client.profile.get_profile_by_xuid(
                str(auth_mgr.xsts_token.xuid)
            )
            if profile.profile_users:
                for setting in profile.profile_users[0].settings:
                    if setting.id == "Gamertag":
                        token_record.gamertag = setting.value
                        break
        except Exception as e:
            print(f"Could not fetch gamertag: {e}")
    await db.flush()

    return XboxLiveClient(auth_mgr), token_record, session

def _is_public_client(settings) -> bool:
    """Public client = mobile/desktop redirect URI (http://). No client_secret allowed."""
    return settings.xbox_redirect_uri.startswith("http://")


async def _live_token_request(data: dict, settings) -> "OAuth2TokenResponse":
    """POST to Microsoft's token endpoint, omitting client_secret for public clients."""
    import httpx
    data["client_id"] = settings.xbox_client_id
    if not _is_public_client(settings) and settings.xbox_client_secret:
        data["client_secret"] = settings.xbox_client_secret

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://login.live.com/oauth20_token.srf", data=data)
        if not resp.is_success:
            print(f"[xbox] Token request failed {resp.status_code}: {resp.text}")
            resp.raise_for_status()

    return OAuth2TokenResponse(**resp.json())


async def _exchange_code_directly(code: str, settings) -> "OAuth2TokenResponse":
    return await _live_token_request({
        "grant_type": "authorization_code",
        "code": code,
        "scope": "XboxLive.signin XboxLive.offline_access",
        "redirect_uri": settings.xbox_redirect_uri,
    }, settings)


async def _refresh_token_directly(refresh_token: str, settings) -> "OAuth2TokenResponse":
    return await _live_token_request({
        "grant_type": "refresh_token",
        "scope": "XboxLive.signin XboxLive.offline_access",
        "refresh_token": refresh_token,
    }, settings)


async def exchange_code_for_user_tokens(db: AsyncSession, user_id: uuid.UUID, code: str) -> dict:
    """Exchange an OAuth code for tokens and store them against a specific user."""
    import uuid as _uuid
    settings = get_settings()
    async with SignedSession() as session:
        auth_mgr = _make_auth_manager(session, settings)

        # Use direct HTTP calls to control exactly what's sent to Microsoft.
        # Public clients (http:// redirect URIs) must NOT send client_secret.
        oauth_response = await _exchange_code_directly(code, settings)
        auth_mgr.oauth = oauth_response
        # Skip refresh_oauth_token — the code exchange already gave us valid tokens.
        # Just get the XSTS token chain (user token → XSTS).
        auth_mgr.user_token = await auth_mgr.request_user_token()
        auth_mgr.xsts_token = await auth_mgr.request_xsts_token()

        oauth = auth_mgr.oauth
        xuid = str(auth_mgr.xsts_token.xuid)
        now = datetime.now(timezone.utc)
        expires_in = getattr(oauth, 'expires_in', None) or 3600
        refresh_expires_in = 1209600

        gamertag = None
        try:
            xbl_client = XboxLiveClient(auth_mgr)
            profile = await xbl_client.profile.get_profile_by_xuid(xuid)
            if profile.profile_users:
                for setting in profile.profile_users[0].settings:
                    if setting.id == "Gamertag":
                        gamertag = setting.value
                        break
        except Exception as e:
            print(f"Could not fetch gamertag: {e}")

        # Upsert per-user token row
        result = await db.execute(
            select(XboxToken).where(XboxToken.user_id == user_id).limit(1)
        )
        token_record = result.scalar_one_or_none()

        if token_record:
            token_record.access_token = oauth.access_token
            token_record.refresh_token = oauth.refresh_token
            token_record.access_token_expires_at = now + timedelta(seconds=expires_in)
            token_record.refresh_token_expires_at = now + timedelta(seconds=refresh_expires_in)
            token_record.gamertag = gamertag
            token_record.xuid = xuid
        else:
            token_record = XboxToken(
                user_id=user_id,
                access_token=oauth.access_token,
                refresh_token=oauth.refresh_token,
                access_token_expires_at=now + timedelta(seconds=expires_in),
                refresh_token_expires_at=now + timedelta(seconds=refresh_expires_in),
                gamertag=gamertag,
                xuid=xuid,
            )
            db.add(token_record)

        await db.flush()
        return {"gamertag": gamertag, "xuid": xuid}


async def _get_user_xbox_client(db: AsyncSession, user_id: uuid.UUID):
    """Get an authenticated XboxLiveClient for a specific user."""
    result = await db.execute(
        select(XboxToken).where(XboxToken.user_id == user_id).limit(1)
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise Exception("No Xbox account connected. Connect your Xbox account in your profile first.")

    now = datetime.now(timezone.utc)
    if token_record.refresh_token_expires_at < now:
        raise Exception("Xbox session expired — please reconnect your Xbox account in your profile.")

    settings = get_settings()
    session = SignedSession()
    await session.__aenter__()

    auth_mgr = _make_auth_manager(session, settings)
    auth_mgr.oauth = OAuth2TokenResponse(
        token_type="bearer",
        expires_in=3600,
        scope="XboxLive.signin XboxLive.offline_access",
        access_token=token_record.access_token,
        refresh_token=token_record.refresh_token,
        user_id="",
    )

    auth_mgr.oauth = await auth_mgr.refresh_oauth_token()
    await auth_mgr.refresh_tokens()

    now = datetime.now(timezone.utc)
    token_record.access_token = auth_mgr.oauth.access_token
    token_record.refresh_token = auth_mgr.oauth.refresh_token
    token_record.access_token_expires_at = now + timedelta(seconds=auth_mgr.oauth.expires_in or 3600)
    if not token_record.xuid:
        token_record.xuid = str(auth_mgr.xsts_token.xuid)
    await db.flush()

    return XboxLiveClient(auth_mgr), token_record, session


async def fetch_user_xbox_achievements(db: AsyncSession, user_id: uuid.UUID, title_id: str) -> list[dict]:
    """Fetch earned achievements for a specific user + title."""
    client, token_record, session = await _get_user_xbox_client(db, user_id)
    try:
        response = await client.achievements.get_achievements_xboxone_gameprogress(
            xuid=token_record.xuid,
            title_id=title_id,
        )
        XBOX_ZERO_DATE = "0001-01-01"  # .NET epoch — means "not unlocked"

        earned = []
        for a in (response.achievements or []):
            # progress_state is the authoritative earned signal.
            # "Achieved" = earned; "NotStarted" / "InProgress" = not earned.
            if getattr(a, 'progress_state', None) != "Achieved":
                continue

            # Grab unlock time from progression, guard against .NET zero datetime
            unlock_time = None
            prog = getattr(a, 'progression', None)
            if prog:
                t = getattr(prog, 'time_unlocked', None)
                if t and str(t)[:10] != XBOX_ZERO_DATE:
                    unlock_time = t

            earned.append({
                "platform_achievement_id": str(a.id),
                "time_unlocked": unlock_time or datetime.now(timezone.utc),
            })
        return earned
    finally:
        await session.__aexit__(None, None, None)


async def search_xbox_titles(db: AsyncSession, query: str) -> list[dict]:
    client, token_record, session = await _get_authenticated_client(db)
    
    try:
        import re
        def normalize(text):
          return re.sub(r'[^\w\s]', '', text).lower()

        normalized_query = normalize(query)

        # Search played titles for numeric IDs
        played_response = await client.achievements.get_achievements_xboxone_recent_progress_and_info(
            token_record.xuid
        )
        played_map = {}
        for title in (played_response.titles or []):
            played_map[normalize(title.name)] = {
                "title_id": str(title.title_id),
                "max_gamerscore": title.max_gamerscore,
                "platform": title.platform,
            }

        # Search catalog for cover art and full results
        catalog_response = await client.catalog.product_search(query)
        
        games = []
        seen_ids = set()

        for item in (catalog_response.results or []):
            for product in (item.products or []):
                if product.product_id in seen_ids:
                    continue
                seen_ids.add(product.product_id)

                # Get cover art
                cover_url = None
                if hasattr(product, 'icon') and product.icon:
                    cover_url = f"https:{product.icon}" if product.icon.startswith('//') else product.icon

                # Try to match with played titles to get numeric ID
                product_name_normalized = normalize(product.title)
                played_info = None

                if product_name_normalized in played_map:
                    # Exact normalized match — most reliable
                    played_info = played_map[product_name_normalized]
                else:
                    # Strict substring match: only use if the full played title
                    # is contained within the product name (not just the query).
                    # This avoids cross-franchise collisions (e.g. Gears 2 vs Gears 4).
                    for played_name, info in played_map.items():
                        if played_name in product_name_normalized and len(played_name) > 5:
                            played_info = info
                            break

                games.append({
                    "title": product.title,
                    "title_id": played_info["title_id"] if played_info else None,
                    "store_id": product.product_id,
                    "cover_url": cover_url,
                    "max_gamerscore": played_info["max_gamerscore"] if played_info else None,
                    "platform": played_info["platform"] if played_info else "XboxOne",
                    "can_import": played_info is not None,
                })

        return games
    finally:
        await session.__aexit__(None, None, None)


async def fetch_xbox_achievements(db: AsyncSession, title_id: str, xuid: str) -> dict:
    client, _, session = await _get_authenticated_client(db)
    try:
        response = await client.achievements.get_achievements_xboxone_gameprogress(
            xuid=xuid,
            title_id=title_id,
        )

        achievements = []
        gamerscore_total = 0

        for a in (response.achievements or []):
            gamerscore = 0
            for reward in (a.rewards or []):
                if hasattr(reward, 'type') and reward.type == "Gamerscore":
                    try:
                        gamerscore = int(reward.value or 0)
                        gamerscore_total += gamerscore
                    except (ValueError, TypeError):
                        pass

            icon_url = None
            for asset in (a.media_assets or []):
                if hasattr(asset, 'type') and asset.type == "Icon":
                    icon_url = getattr(asset, 'url', None)
                    break

            achievements.append({
                "title": a.name,
                "description": a.description,
                "gamerscore": gamerscore,
                "icon_url": icon_url,
                "platform_achievement_id": str(a.id),
                "is_secret": getattr(a, 'is_secret', False),
            })

        return {
            "title_id": title_id,
            "gamerscore_total": gamerscore_total,
            "achievements": achievements,
        }

    except Exception as e:
        print(f"Achievement fetch error: {e}")
        if hasattr(e, 'response'):
            print(f"Response body: {e.response.text}")
        raise
    finally:
        await session.__aexit__(None, None, None)

