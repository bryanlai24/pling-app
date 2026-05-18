from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from psnawp_api import PSNAWP
from psnawp_api.core.psnawp_exceptions import PSNAWPAuthenticationError
import asyncio

from app.models.user import User


async def connect_psn_account(
    db: AsyncSession,
    user: User,
    npsso_token: str,
) -> User:
    """Validate NPSSO token, fetch PSN account info, save to user."""

    def _fetch():
        try:
            psnawp = PSNAWP(npsso_token)
            me = psnawp.me()
            return {
                "online_id": me.online_id,
                "account_id": str(me.account_id),
            }
        except PSNAWPAuthenticationError:
            return None
        except Exception as e:
            raise e

    result = await asyncio.get_event_loop().run_in_executor(None, _fetch)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid NPSSO token — make sure you copied it correctly from PlayStation",
        )

    user.psn_id = result["online_id"]
    user.psn_account_id = result["account_id"]
    user.psn_npsso = npsso_token
    await db.flush()
    await db.refresh(user)
    return user