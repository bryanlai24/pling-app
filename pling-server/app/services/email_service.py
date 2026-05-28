"""Email delivery via Resend API."""
import httpx
from app.config import get_settings


async def _send(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    if not settings.resend_api_key:
        # Dev fallback — just log
        print(f"[email] To: {to} | Subject: {subject}")
        return

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        if not resp.is_success:
            print(f"[email] Resend error {resp.status_code}: {resp.text}")
            resp.raise_for_status()


def _base_template(title: str, body: str) -> str:
    return f"""
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 24px;color:#e2e8f0;background:#0a0a12;border-radius:16px;">
      <div style="padding:32px 0 24px;">
        <h1 style="font-size:1.5rem;font-weight:800;margin:0 0 4px;">Pling<span style="color:#a78bfa;">.</span></h1>
        <p style="font-size:0.75rem;color:#6b6b8a;margin:0;">Track every achievement. Miss nothing.</p>
      </div>
      <hr style="border:none;border-top:0.5px solid #1e1e2e;margin:0 0 28px;" />
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 12px;">{title}</h2>
      {body}
      <hr style="border:none;border-top:0.5px solid #1e1e2e;margin:32px 0 20px;" />
      <p style="font-size:0.7rem;color:#6b6b8a;margin:0;">
        You received this email because an account action was performed on Pling.
        If this wasn't you, you can safely ignore this email.
      </p>
    </div>
    """


async def send_verification_email(to: str, username: str, token: str) -> None:
    settings = get_settings()
    url = f"{settings.app_base_url}/verify-email?token={token}"
    body = f"""
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
      Hey <strong style="color:#f0ecff;">{username}</strong>, thanks for signing up!
      Click the button below to verify your email address.
    </p>
    <a href="{url}"
       style="display:inline-block;background:#7c3aed;color:#fff;font-weight:600;
              font-size:0.9rem;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:20px;">
      Verify email
    </a>
    <p style="font-size:0.75rem;color:#6b6b8a;margin:8px 0 0;">
      This link expires in 24 hours. If the button doesn't work, copy this URL:<br/>
      <span style="color:#a78bfa;">{url}</span>
    </p>
    """
    await _send(to, "Verify your Pling email", _base_template("Verify your email", body))


async def send_merge_confirmation_email(to: str, username: str, provider: str, token: str) -> None:
    settings = get_settings()
    url = f"{settings.app_base_url}/confirm-merge?token={token}"
    provider_label = "Google" if provider == "google" else "Apple"
    body = f"""
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
      Hey <strong style="color:#f0ecff;">{username}</strong>, we received a request to link
      your <strong style="color:#f0ecff;">{provider_label}</strong> account to your existing Pling account.
    </p>
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
      Click below to confirm the merge. After linking, you'll be able to sign in with either
      your password or {provider_label}.
    </p>
    <a href="{url}"
       style="display:inline-block;background:#7c3aed;color:#fff;font-weight:600;
              font-size:0.9rem;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:20px;">
      Link {provider_label} account
    </a>
    <p style="font-size:0.75rem;color:#6b6b8a;margin:8px 0 0;">
      This link expires in 1 hour. If you didn't request this, ignore this email — your account is safe.
    </p>
    """
    await _send(
        to,
        f"Link your {provider_label} account to Pling",
        _base_template(f"Link your {provider_label} account", body),
    )
