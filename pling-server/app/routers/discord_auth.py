"""Discord OAuth2 sign-in endpoints."""
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.routers.auth import _social_login

router = APIRouter()

DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_USER_URL = "https://discord.com/api/users/@me"


@router.get("/url")
async def discord_auth_url():
    """Return the Discord OAuth2 authorization URL for the frontend to open."""
    settings = get_settings()
    if not settings.discord_client_id:
        return {"error": "Discord sign-in is not configured"}

    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": "identify email",
    }
    return {"auth_url": f"{DISCORD_AUTH_URL}?{urlencode(params)}"}


@router.get("/callback", response_class=HTMLResponse)
async def discord_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Discord redirects here after the user authorizes.
    This page lives in a popup — it completes the OAuth flow, then
    postMessages the result (JWT, username_required, or merge_pending)
    back to the opener and closes itself.
    """
    settings = get_settings()
    # Use the request's Origin header if present, otherwise fall back to '*'.
    # This ensures postMessage reaches the opener regardless of environment
    # (localhost dev vs production Firebase Hosting vs any future domain).
    origin = request.headers.get("origin") or "*"

    def html_close(payload_js: str) -> HTMLResponse:
        """Return an HTML page that postMessages payload_js to the opener then closes."""
        return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head><title>Discord Sign In</title></head>
<body style="background:#0a0a0f;color:#f0ecff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <p>Connecting with Discord…</p>
  <script>
    try {{
      const payload = {payload_js};
      if (window.opener) {{
        window.opener.postMessage({{ type: 'discord_auth', ...payload }}, '{origin}');
        window.close();
      }} else {{
        document.querySelector('p').textContent = payload.error || 'Done! You can close this window.';
      }}
    }} catch(e) {{
      if (window.opener) {{
        window.opener.postMessage({{ type: 'discord_auth', error: 'Unexpected error: ' + e.message }}, '{origin}');
        window.close();
      }}
    }}
  </script>
</body>
</html>""")

    code = request.query_params.get("code")
    error = request.query_params.get("error")

    if error or not code:
        return html_close('{ "error": "Discord sign-in was cancelled or failed" }')

    # Exchange code for access token
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_resp = await client.post(
                DISCORD_TOKEN_URL,
                data={
                    "client_id": settings.discord_client_id,
                    "client_secret": settings.discord_client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.discord_redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if not token_resp.is_success:
                return html_close('{ "error": "Failed to exchange Discord auth code" }')
            token_data = token_resp.json()

        access_token = token_data.get("access_token")
        if not access_token:
            return html_close('{ "error": "No access token from Discord" }')

        # Fetch user info
        async with httpx.AsyncClient(timeout=10) as client:
            user_resp = await client.get(
                DISCORD_USER_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if not user_resp.is_success:
                return html_close('{ "error": "Failed to fetch Discord user info" }')
            info = user_resp.json()

    except Exception as e:
        return html_close(f'{{ "error": "Discord auth error: {str(e)}" }}')

    provider_id = info.get("id")
    email = info.get("email")
    email_verified = info.get("verified", False)
    username = info.get("username") or info.get("global_name")
    display_name = info.get("global_name") or info.get("username")

    if not provider_id:
        return html_close('{ "error": "Discord did not return a user ID" }')

    if not email:
        return html_close('{ "error": "Discord did not return an email. Make sure your Discord account has an email address." }')

    try:
        result = await _social_login(db, "discord", provider_id, email, email_verified, display_name)
    except Exception as e:
        return html_close(f'{{ "error": "Sign-in failed: {str(e)}" }}')

    if result.get("merge_pending"):
        import json
        payload = json.dumps({"merge_pending": True, "email": result["email"]})
        return html_close(payload)

    if result.get("username_required"):
        import json
        payload = json.dumps({
            "username_required": True,
            "setup_token": result["setup_token"],
            "suggested_username": result["suggested_username"],
        })
        return html_close(payload)

    # Success — send JWT
    # Use mode='json' so Pydantic handles datetimes, UUIDs, and enums for us
    import json
    user_data = result["user"].model_dump(mode='json')
    payload = json.dumps({
        "access_token": result["access_token"],
        "user": user_data,
    })
    return html_close(payload)
