import asyncio
import httpx
from app.config import get_settings

settings = get_settings()

STEAM_API_BASE = "https://api.steampowered.com"
STEAM_STORE_BASE = "https://store.steampowered.com/api"


async def resolve_steam_id(input_str: str) -> str:
    """Resolve a Steam input to a steamID64.

    Accepts:
    - steamID64 directly (17-digit number) → returned as-is
    - Vanity URL name (e.g. "gabelogannewell")
    - Full profile URL (e.g. "https://steamcommunity.com/id/gabelogannewell")
    - /profiles/ URL with steamID64 already in it

    Raises ValueError if resolution fails.
    """
    import re

    raw = input_str.strip().rstrip("/")

    # Extract from full /profiles/ URL — already a steamID64
    profiles_match = re.search(r"/profiles/(\d{17})", raw)
    if profiles_match:
        return profiles_match.group(1)

    # Extract vanity name from /id/ URL
    id_match = re.search(r"/id/([^/]+)", raw)
    if id_match:
        raw = id_match.group(1)

    # If it's already a 17-digit number, return directly
    if re.fullmatch(r"\d{17}", raw):
        return raw

    # Otherwise treat as vanity URL and resolve via Steam API
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/",
            params={"key": settings.steam_api_key, "vanityurl": raw},
        )
        response.raise_for_status()
        data = response.json()

    result = data.get("response", {})
    if result.get("success") == 1:
        return result["steamid"]

    raise ValueError(f"Could not resolve Steam ID from '{input_str}' — check the URL or username and try again.")


async def get_owned_games(steam_id: str) -> list[dict]:
    """Get all games owned by a Steam user."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/",
            params={
                "key": settings.steam_api_key,
                "steamid": steam_id,
                "include_appinfo": True,
                "include_played_free_games": True,
            }
        )
        response.raise_for_status()
        data = response.json()
        games = data.get("response", {}).get("games", [])
        return [
            {
                "app_id": str(g["appid"]),
                "title": g.get("name", "Unknown"),
                "playtime_hours": round(g.get("playtime_forever", 0) / 60, 1),
                "cover_url": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{g['appid']}/library_600x900.jpg",
            }
            for g in games
        ]


async def search_owned_games(steam_id: str, query: str) -> list[dict]:
    """Search owned games by name."""
    import re
    def normalize(text):
        return re.sub(r'[^\w\s]', '', text).lower()

    all_games = await get_owned_games(steam_id)
    normalized_query = normalize(query)
    
    return [
        g for g in all_games
        if normalized_query in normalize(g["title"])
    ]


async def fetch_steam_achievements(steam_id: str, app_id: str) -> dict:
    """Fetch all achievements for a Steam game."""
    async with httpx.AsyncClient() as client:
        # Get achievement schema (names, descriptions, icons)
        schema_response = await client.get(
            f"{STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/",
            params={
                "key": settings.steam_api_key,
                "appid": app_id,
            }
        )
        schema_response.raise_for_status()
        schema_data = schema_response.json()

        achievements_schema = (
            schema_data
            .get("game", {})
            .get("availableGameStats", {})
            .get("achievements", [])
        )

        if not achievements_schema:
            return {
                "app_id": app_id,
                "achievements": [],
                "total": 0,
            }

        # Get global achievement percentages for rarity
        try:
            percent_response = await client.get(
                f"{STEAM_API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/",
                params={"gameid": app_id}
            )
            percent_data = percent_response.json()
            percentages = {
                a["name"]: float(a["percent"])  # cast to float
                for a in percent_data.get("achievementpercentages", {}).get("achievements", [])
            }
        except Exception:
            percentages = {}

        achievements = []
        for index, a in enumerate(achievements_schema):
            api_name = a.get("name", "")
            percent = percentages.get(api_name)
            
            rarity = None
            if percent is not None:
                percent = float(percent)
                if percent < 5:
                    rarity = "Ultra Rare"
                elif percent < 15:
                    rarity = "Rare"
                elif percent < 35:
                    rarity = "Uncommon"
                else:
                    rarity = "Common"

            achievements.append({
                "title": a.get("displayName", api_name),
                "description": a.get("description", ""),
                "platform_achievement_id": api_name,
                "icon_url": a.get("icon", None),
                "rarity": rarity,
                "rarity_percent": percent,
                "sort_order": index,  # add this
            })

        return {
            "app_id": app_id,
            "achievements": achievements,
            "total": len(achievements),
        }


async def get_game_details(app_id: str) -> dict:
    """Get game details from Steam store for cover art."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{STEAM_STORE_BASE}/appdetails",
                params={"appids": app_id, "filters": "basic"}
            )
            data = response.json()
            game_data = data.get(str(app_id), {}).get("data", {})
            return {
                "cover_url": game_data.get("header_image"),
                "genre": ", ".join(
                    g["description"] for g in game_data.get("genres", [])[:2]
                ) or None,
            }
        except Exception:
            return {"cover_url": None, "genre": None}