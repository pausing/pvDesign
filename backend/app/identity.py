"""Read portal ForwardAuth identity headers (X-Powerlearn-*)."""

from __future__ import annotations

from typing import Optional

from starlette.requests import Request

HEADER_USER_ID = "X-Powerlearn-User-Id"
HEADER_EMAIL = "X-Powerlearn-Email"
HEADER_ADMIN = "X-Powerlearn-Admin"


def _header(request: Request, name: str) -> Optional[str]:
    value = request.headers.get(name)
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _parse_admin(raw: Optional[str]) -> Optional[bool]:
    if raw is None:
        return None
    value = raw.strip().lower()
    if value == "":
        return None
    if value in ("1", "true", "yes", "on"):
        return True
    if value in ("0", "false", "no", "off"):
        return False
    return None


def portal_identity(request: Request) -> dict[str, Optional[str] | Optional[bool]]:
    return {
        "id": _header(request, HEADER_USER_ID),
        "email": _header(request, HEADER_EMAIL),
        "admin": _parse_admin(request.headers.get(HEADER_ADMIN)),
    }


def owner_from_identity(
    request: Request,
    owner: Optional[str] = None,
    user_id: Optional[str] = None,
) -> tuple[str, str]:
    """Use explicit owner/user_id when provided; otherwise stamp from headers."""
    identity = portal_identity(request)
    stamped_owner = (owner or "").strip() or (identity.get("email") or "")
    stamped_user_id = (user_id or "").strip() or (identity.get("id") or "")
    return str(stamped_owner or ""), str(stamped_user_id or "")
