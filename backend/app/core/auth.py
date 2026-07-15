# SPDX-License-Identifier: MIT
"""Auth helpers — password hashing and JWT token management."""

import hashlib
import hmac
import secrets
import time
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

MAGIC_LINK_TTL_SECONDS = 15 * 60
ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60


# ---------------------------------------------------------------------------
# Password hashing — argon2id (SEC-9). Hashes created before the switch used
# scrypt ('salt$hash' hex); they still verify, and login transparently
# re-hashes them (see password_needs_rehash).
# ---------------------------------------------------------------------------

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a password with argon2id (returns a self-describing '$argon2id$…')."""
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against an argon2 hash or a legacy scrypt hash."""
    if stored_hash.startswith("$argon2"):
        try:
            return _hasher.verify(stored_hash, password)
        except (VerificationError, InvalidHashError):
            return False
    return _verify_legacy_scrypt(password, stored_hash)


def password_needs_rehash(stored_hash: str) -> bool:
    """True when the stored hash should be upgraded on successful login —
    either legacy scrypt or an argon2 hash with outdated parameters."""
    if not stored_hash.startswith("$argon2"):
        return True
    return _hasher.check_needs_rehash(stored_hash)


def _verify_legacy_scrypt(password: str, stored_hash: str) -> bool:
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
    """Return a signed bearer token plus its expiry timestamp.

    Every token carries a unique ``jti`` so it can be individually revoked
    (see app.core.token_revocation).
    """
    now = int(time.time())
    expires_at = now + ACCESS_TOKEN_TTL_SECONDS
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": expires_at,
        "jti": secrets.token_urlsafe(16),
    }
    # PyJWT for encoding too (SEC-9) — deps.py already decodes with it;
    # two implementations of the same primitive invite drift.
    return jwt.encode(payload, secret, algorithm="HS256"), expires_at
