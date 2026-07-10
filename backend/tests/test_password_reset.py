"""Tests for the password-reset flow and email sender (SEC-5)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import hash_magic_link_token, hash_password, verify_password
from app.core.config import Settings, get_settings
from app.core.email import ConsoleEmailSender, SMTPEmailSender, get_email_sender
from app.db.database import get_db
from app.db.models import AuthMagicLink, User
from app.main import app
from tests.helpers import FakeResult


class FakeSession:
    def __init__(self, user: User | None = None) -> None:
        self.user = user
        self.links: list[AuthMagicLink] = []

    def add(self, obj: object) -> None:
        if isinstance(obj, AuthMagicLink):
            if obj.id is None:
                obj.id = uuid.uuid4()
            self.links.append(obj)

    async def flush(self) -> None:
        return None

    async def get(self, model, key):  # noqa: ANN001
        return self.user if (model is User and self.user and self.user.id == key) else None

    async def execute(self, statement):  # noqa: ANN001
        # Emulate both lookups: by email (User) and by token_hash (AuthMagicLink).
        sql = str(statement).lower()
        if "auth_magic_links" in sql:
            return FakeResult(list(self.links))
        return FakeResult([self.user] if self.user else [])


# ── Email sender ──────────────────────────────────────────────────────────────

def test_get_email_sender_defaults_to_console() -> None:
    sender = get_email_sender(Settings(smtp_host=""))
    assert isinstance(sender, ConsoleEmailSender)


def test_get_email_sender_uses_smtp_when_configured() -> None:
    sender = get_email_sender(Settings(smtp_host="smtp.example.com"))
    assert isinstance(sender, SMTPEmailSender)


@pytest.mark.asyncio
async def test_console_sender_does_not_raise() -> None:
    await ConsoleEmailSender().send(to="a@b.com", subject="hi", body="there")


# ── Request endpoint ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reset_request_is_non_enumerating_for_unknown_email() -> None:
    fake = FakeSession(user=None)

    async def override_get_db():
        yield fake

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/v1/auth/password-reset/request", json={"email": "ghost@example.com"}
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 202
    # No token was created for a non-existent account…
    assert fake.links == []
    # …but the response is identical to the account-exists case (below).
    assert resp.json() == {"status": "if_the_account_exists_an_email_was_sent"}


@pytest.mark.asyncio
async def test_reset_request_creates_token_for_real_account() -> None:
    user = User(id=uuid.uuid4(), email="real@example.com", password_hash="salt$hash")
    fake = FakeSession(user=user)

    async def override_get_db():
        yield fake

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/v1/auth/password-reset/request", json={"email": "real@example.com"}
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 202
    assert len(fake.links) == 1
    assert fake.links[0].email == "real@example.com"


# ── Confirm endpoint ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reset_confirm_sets_new_password() -> None:
    user = User(
        id=uuid.uuid4(), email="real@example.com", password_hash=hash_password("oldpass12")
    )
    raw_token = "reset-token-xyz"
    link = AuthMagicLink(
        id=uuid.uuid4(),
        user_id=user.id,
        email=user.email,
        token_hash=hash_magic_link_token(raw_token, get_settings().magic_link_secret),
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
        consumed_at=None,
    )
    fake = FakeSession(user=user)
    fake.links.append(link)

    async def override_get_db():
        yield fake

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/v1/auth/password-reset/confirm",
                json={"token": raw_token, "new_password": "brandnew99"},
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert verify_password("brandnew99", user.password_hash)
    assert link.consumed_at is not None


@pytest.mark.asyncio
async def test_reset_confirm_rejects_bad_token() -> None:
    fake = FakeSession(user=None)

    async def override_get_db():
        yield fake

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/v1/auth/password-reset/confirm",
                json={"token": "not-a-real-token", "new_password": "brandnew99"},
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_confirm_rejects_expired_token() -> None:
    user = User(id=uuid.uuid4(), email="real@example.com", password_hash="salt$hash")
    raw_token = "expired-token"
    link = AuthMagicLink(
        id=uuid.uuid4(),
        user_id=user.id,
        email=user.email,
        token_hash=hash_magic_link_token(raw_token, get_settings().magic_link_secret),
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
        consumed_at=None,
    )
    fake = FakeSession(user=user)
    fake.links.append(link)

    async def override_get_db():
        yield fake

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/v1/auth/password-reset/confirm",
                json={"token": raw_token, "new_password": "brandnew99"},
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 400
