"""AES-256-GCM field-level encryption for sensitive database columns."""

import base64
import os
from functools import lru_cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings

_NONCE_BYTES = 12
_KEY_BYTES = 32


@lru_cache(maxsize=1)
def _get_key() -> bytes:
    settings = get_settings()
    raw = settings.field_encryption_key
    key_bytes = base64.b64decode(raw) if raw else b""
    if len(key_bytes) != _KEY_BYTES:
        # Dev fallback: deterministic zero key — never use in prod
        key_bytes = b"\x00" * _KEY_BYTES
    return key_bytes


def encrypt_text(plaintext: str) -> str:
    """Encrypt plaintext → base64(nonce + ciphertext)."""
    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(_NONCE_BYTES)
    ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt_text(ciphertext_b64: str) -> str:
    """Decrypt base64(nonce + ciphertext) → plaintext."""
    key = _get_key()
    aesgcm = AESGCM(key)
    raw = base64.b64decode(ciphertext_b64)
    nonce, ct = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
    return aesgcm.decrypt(nonce, ct, None).decode()
