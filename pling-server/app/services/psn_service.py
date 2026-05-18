import asyncio
import time
import httpx
from datetime import datetime, timezone, timedelta
from psnawp_api import PSNAWP
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.models.psn_token import PSNToken

settings = get_settings()

TROPHY_TYPE_MAP = {
    "bronze": "bronze",
    "silver": "silver",
    "gold": "gold",
    "platinum": "platinum",
}

NP_SERVICE_MAP = {
    "PS5": "trophy2",
    "PS4": "trophy",
}

PSN_AUTH_HEADER = {
    "Authorization": "Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "com.sony.snei.np.android.sso.share.oauth.versa.USER_AGENT",
}


def get_psnawp() -> PSNAWP:
    return PSNAWP(settings.psn_npsso_token)


def _extract_tokens_from_auth(auth) -> dict | None:
    """Extract token data after a real API call has been made."""
    if not auth.token_response:
        return None
    return {
        "access_token": auth.token_response.get("access_token", ""),
        "refresh_token": auth.token_response.get("refresh_token", ""),
        "access_token_expires_at": datetime.fromtimestamp(
            auth.access_token_expiration_time, tz=timezone.utc
        ),
        "refresh_token_expires_at": datetime.fromtimestamp(
            auth.refresh_token_expiration_time, tz=timezone.utc
        ),
    }


def _refresh_access_token(refresh_token: str) -> dict:
    """Use refresh token to get a new access token directly via PSN API."""
    response = httpx.post(
        "https://ca.account.sony.com/api/authz/v3/oauth/token",
        headers=PSN_AUTH_HEADER,
        data={
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": "psn:mobile.v2.core psn:clientapp",
            "token_format": "jwt",
        },
    )
    response.raise_for_status()
    data = response.json()
    now = datetime.now(timezone.utc)
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token", refresh_token),
        "access_token_expires_at": now + timedelta(seconds=data.get("expires_in", 3600)),
        "refresh_token_expires_at": now + timedelta(seconds=data.get("refresh_token_expires_in", 5184000)),
    }


async def get_valid_access_token(db: AsyncSession) -> str:
    """Get a valid PSN access token, refreshing or re-authenticating as needed."""
    now = datetime.now(timezone.utc)

    # Check DB for stored tokens
    result = await db.execute(
        select(PSNToken).order_by(PSNToken.updated_at.desc()).limit(1)
    )
    token_record = result.scalar_one_or_none()

    # Valid access token — use it directly
    if token_record and token_record.access_token_expires_at > now:
        return token_record.access_token

    # Expired access token but valid refresh token — refresh it
    if token_record and token_record.refresh_token_expires_at > now:
        try:
            def _do_refresh():
                return _refresh_access_token(token_record.refresh_token)

            new_tokens = await asyncio.get_event_loop().run_in_executor(None, _do_refresh)

            token_record.access_token = new_tokens["access_token"]
            token_record.refresh_token = new_tokens["refresh_token"]
            token_record.access_token_expires_at = new_tokens["access_token_expires_at"]
            token_record.refresh_token_expires_at = new_tokens["refresh_token_expires_at"]
            await db.flush()

            return token_record.access_token
        except Exception as e:
            print(f"Token refresh failed: {e}, falling back to NPSSO")

    # No valid tokens — authenticate fresh with NPSSO
    def _auth_with_npsso():
        psnawp = get_psnawp()
        # Trigger a real API call to populate token_response
        me = psnawp.me()
        _ = me.online_id  # forces auth
        auth = me.authenticator
        return _extract_tokens_from_auth(auth), auth

    token_data, auth = await asyncio.get_event_loop().run_in_executor(None, _auth_with_npsso)

    if token_data:
        if token_record:
            token_record.access_token = token_data["access_token"]
            token_record.refresh_token = token_data["refresh_token"]
            token_record.access_token_expires_at = token_data["access_token_expires_at"]
            token_record.refresh_token_expires_at = token_data["refresh_token_expires_at"]
        else:
            token_record = PSNToken(**token_data)
            db.add(token_record)
        await db.flush()
        return token_data["access_token"]

    raise Exception("Failed to obtain PSN access token")


def _get_access_token_from_npsso(npsso_token: str) -> str:
    """Exchange a user's NPSSO token for a PSN access token."""
    psnawp = PSNAWP(npsso_token)
    me = psnawp.me()
    _ = me.online_id  # force auth
    return me.authenticator.token_response.get("access_token", "")


async def fetch_earned_trophies(
    np_communication_id: str,
    platform: str = "PS5",
    db: AsyncSession | None = None,
    user_npsso: str | None = None,
) -> list[dict]:
    """Fetch earned trophy progress for a user for a specific game.

    Uses the user's own NPSSO token (stored at PSN connect time) to get a
    per-user access token, so we fetch *their* earned trophies, not the server account's.

    Returns a list of dicts with:
        platform_achievement_id, earned, earned_date_time, progress, progress_rate
    """
    np_service = NP_SERVICE_MAP.get(platform.upper(), "trophy2")

    if not user_npsso:
        raise Exception("No NPSSO token available for this user — cannot fetch earned trophies")

    access_token = await asyncio.get_event_loop().run_in_executor(
        None, _get_access_token_from_npsso, user_npsso
    )

    def _fetch(token: str):
        headers = {"Authorization": f"Bearer {token}"}
        response = httpx.get(
            f"https://m.np.playstation.com/api/trophy/v1/users/me/npCommunicationIds/{np_communication_id}/trophyGroups/all/trophies",
            headers=headers,
            params={"npServiceName": np_service},
        )
        response.raise_for_status()
        data = response.json()

        results = []
        for t in data.get("trophies", []):
            earned_dt = t.get("earnedDateTime")
            results.append({
                "platform_achievement_id": str(t["trophyId"]),
                "earned": t.get("earned", False),
                "earned_date_time": datetime.fromisoformat(earned_dt.replace("Z", "+00:00")) if earned_dt else None,
                "progress": t.get("progress"),
                "progress_rate": t.get("progressRate"),
            })
        return results

    return await asyncio.get_event_loop().run_in_executor(None, _fetch, access_token)


async def fetch_trophies(
    np_communication_id: str,
    account_id: str,
    platform: str = "PS5",
    db: AsyncSession | None = None,
) -> dict:
    def _fetch(access_token: str):
        np_service = NP_SERVICE_MAP.get(platform.upper(), "trophy2")

        # Use access token directly for trophy fetch
        headers = {"Authorization": f"Bearer {access_token}"}

        response = httpx.get(
            f"https://m.np.playstation.com/api/trophy/v1/npCommunicationIds/{np_communication_id}/trophyGroups/all/trophies",
            headers=headers,
            params={"npServiceName": np_service}
        )
        response.raise_for_status()
        data = response.json()

        trophies = []
        for trophy in data.get("trophies", []):
            trophies.append({
                "title": trophy.get("trophyName"),
                "description": trophy.get("trophyDetail"),
                "trophy_type": TROPHY_TYPE_MAP.get(trophy.get("trophyType", "").lower()),
                "platform_achievement_id": str(trophy.get("trophyId")),
                "rarity": None,
                "icon_url": trophy.get("trophyIconUrl"),
                "trophy_group_id": trophy.get("trophyGroupId"),
            })

        return {
            "platform": "psn",
            "np_communication_id": np_communication_id,
            "trophies": trophies,
            "total": data.get("totalItemCount", 0),
        }

    def _fetch_cover(access_token: str):
        """Fetch cover art using psnawp user lookup."""
        psnawp = get_psnawp()
        user = psnawp.user(account_id=account_id)
        for title in user.trophy_titles():
            if title.np_communication_id == np_communication_id:
                return title.title_icon_url
        return None

    # Get valid access token
    if db:
        access_token = await get_valid_access_token(db)
    else:
        def _get_token():
            psnawp = get_psnawp()
            me = psnawp.me()
            _ = me.online_id
            return me.authenticator.token_response.get("access_token", "")
        access_token = await asyncio.get_event_loop().run_in_executor(None, _get_token)

    trophy_data = await asyncio.get_event_loop().run_in_executor(None, _fetch, access_token)
    cover_url = await asyncio.get_event_loop().run_in_executor(None, _fetch_cover, access_token)
    trophy_data["cover_image_url"] = cover_url

    return trophy_data