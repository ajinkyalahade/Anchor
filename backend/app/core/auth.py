# SPDX-License-Identifier: MIT
"""Auth helpers — password hashing and JWT token management."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

MAGIC_LINK_TTL_SECONDS = 15 * 60
ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60


# ---------------------------------------------------------------------------
# Password hashing (scrypt — no extra deps needed)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a password using scrypt with a random salt. Returns 'salt$hash' hex string."""
    salt = os.urandom(16)
    derived = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        dklen=32,
    )
    return salt.hex() + "$" + derived.hex()


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored 'salt$hash' string."""
    try:
        salt_hex, hash_hex = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        derived = hashlib.scrypt(
            password.encode(),
            salt=salt,
            n=16384,
            r=8,
            p=1,
            dklen=32,
        )
        return hmac.compare_digest(derived, expected)
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Magic link helpers (kept for backwards compat)
# ---------------------------------------------------------------------------

def generate_magic_link_token() -> str:
    """Return a user-facing magic-link token."""
    return secrets.token_urlsafe(24)


def hash_magic_link_token(token: str, secret: str) -> str:
    """Hash a magic-link token with a server secret."""
    return hashlib.sha256(f"{secret}:{token}".encode()).hexdigest()


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def build_access_token(*, user_id: str, email: str | None, secret: str) -> tuple[str, int]:
    """Return a signed bearer token plus its expiry timestamp."""
    now = int(time.time())
    expires_at = now + ACCESS_TOKEN_TTL_SECONDS
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": expires_at,
    }
    return _encode_jwt(payload, secret), expires_at


def _encode_jwt(payload: dict[str, Any], secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _base64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_part = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_part}.{payload_part}".encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    signature_part = _base64url_encode(signature)
    return f"{header_part}.{payload_part}.{signature_part}"


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")
