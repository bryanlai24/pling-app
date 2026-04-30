import asyncio
from psnawp_api import PSNAWP
from app.config import get_settings

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


def get_psnawp() -> PSNAWP:
    return PSNAWP(settings.psn_npsso_token)


async def fetch_trophies(
    np_communication_id: str,
    account_id: str,
    platform: str = "PS5",
) -> dict:
    def _fetch():
        psnawp = get_psnawp()
        auth = psnawp.me().authenticator
        np_service = NP_SERVICE_MAP.get(platform.upper(), "trophy2")

        # Fetch trophies
        response = auth.get(
            url=f"https://m.np.playstation.com/api/trophy/v1/npCommunicationIds/{np_communication_id}/trophyGroups/all/trophies",
            params={"npServiceName": np_service}
        )
        data = response.json()

        # Fetch cover art from trophy titles
        cover_image_url = None
        user = psnawp.user(account_id=account_id)
        for title in user.trophy_titles():
            if title.np_communication_id == np_communication_id:
                cover_image_url = title.title_icon_url
                break

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
            "cover_image_url": cover_image_url,
            "trophies": trophies,
            "total": data.get("totalItemCount", 0),
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)