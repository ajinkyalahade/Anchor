"""Tests for email/password auth endpoints."""

import base64
import hashlib
import hmac as hmac_lib
import json
import time
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import User
from app.main import app


class ScalarResult:
    def __init__(self, value: object | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object | None:
        return self._value


class FakeSession:
    def __init__(self) -> None:
        self.users: dict[uuid.UUID, User] = {}

    def add(self, obj: object) -> None:
        if isinstance(obj, User):
            if obj.id is None:
                obj.id = uuid.uuid4()
            self.users[obj.id] = obj

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: object) -> None:
        return None

    async def get(self, model: type[object], key: uuid.UUID) -> object | None:
        if model is User:
            return self.users.get(key)
        return None

    async def execute(self, statement):
        where_clause = list(statement._where_criteria)[0]
        value = where_clause.right.value
        for user in self.users.values():
            if user.email == value:
                return ScalarResult(user)
        return ScalarResult(None)


@pytest.mark.asyncio
async def test_register_creates_user_with_names_and_token() -> None:
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/register",
                json={
                    "email": "new@example.com",
                    "first_name": "New",
                    "last_name": "User",
                    "password": "secret123",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "registered"
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
    assert response.headers["Cache-Control"] == "no-store"
    assert len(fake_session.users) == 1
    created = next(iter(fake_session.users.values()))
    assert created.email == "new@example.com"
    assert created.first_name == "New"
    assert created.last_name == "User"
    assert created.password_hash is not None


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email() -> None:
    fake_session = FakeSession()
    fake_session.add(
        User(
            id=uuid.uuid4(),
            email="dupe@example.com",
            first_name="Dupe",
            last_name="User",
            password_hash="salt$hash",
        )
    )

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/register",
                json={
                    "email": "dupe@example.com",
                    "first_name": "New",
                    "last_name": "Person",
                    "password": "secret123",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login_success_with_email_and_password() -> None:
    fake_session = FakeSession()
    from app.core.auth import hash_password

    fake_session.add(
        User(
            id=uuid.uuid4(),
            email="login@example.com",
            first_name="Log",
            last_name="In",
            password_hash=hash_password("goodpass"),
        )
    )

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/login",
                json={"email": "login@example.com", "password": "goodpass"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "authenticated"
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
    assert response.headers["Cache-Control"] == "no-store"


@pytest.mark.asyncio
async def test_login_rejects_bad_password() -> None:
    fake_session = FakeSession()
    from app.core.auth import hash_password

    fake_session.add(
        User(
            id=uuid.uuid4(),
            email="login@example.com",
            first_name="Log",
            last_name="In",
            password_hash=hash_password("goodpass"),
        )
    )

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/login",
                json={"email": "login@example.com", "password": "wrongpass"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_email", ["notanemail", "no@tld", "@example.com", "a b@x.com"])
async def test_register_rejects_malformed_email(bad_email: str) -> None:
    """SEC-6: registration now validates email syntax via EmailStr instead of
    the old ``"@" in value`` check, so obvious garbage is a 422."""
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/register",
                json={
                    "email": bad_email,
                    "first_name": "New",
                    "last_name": "User",
                    "password": "secret123",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422, response.text
    assert len(fake_session.users) == 0


@pytest.mark.asyncio
async def test_register_normalizes_email_case() -> None:
    """Mixed-case emails are lowercased so the uniqueness check is case-insensitive."""
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/register",
                json={
                    "email": "Mixed.Case@Example.COM",
                    "first_name": "New",
                    "last_name": "User",
                    "password": "secret123",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201, response.text
    created = next(iter(fake_session.users.values()))
    assert created.email == "mixed.case@example.com"


@pytest.mark.asyncio
async def test_register_anonymous_creates_token() -> None:
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/v1/auth/register-anonymous")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "anonymous"
    assert payload["access_token"]
    assert len(fake_session.users) == 1


@pytest.mark.asyncio
async def test_login_rejects_unknown_email() -> None:
    fake_session = FakeSession()  # no users

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/login",
                json={"email": "nobody@example.com", "password": "anypass"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_returns_401() -> None:
    def _b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode().rstrip("=")

    secret = get_settings().jwt_secret
    payload = {
        "sub": str(uuid.uuid4()),
        "email": "test@example.com",
        "iat": int(time.time()) - 3600,
        "exp": int(time.time()) - 1800,
    }
    header_part = _b64url(
        json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode()
    )
    payload_part = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_part}.{payload_part}".encode()
    sig = hmac_lib.new(secret.encode(), signing_input, hashlib.sha256).digest()
    expired_token = f"{header_part}.{payload_part}.{_b64url(sig)}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/v1/rewards/summary",
            headers={"Authorization": f"Bearer {expired_token}"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "token_expired"


@pytest.mark.asyncio
async def test_invalid_token_returns_401() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/v1/rewards/summary",
            headers={"Authorization": "Bearer not.a.valid.token"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "token_invalid"


@pytest.mark.asyncio
async def test_me_returns_authenticated_identity() -> None:
    """FE-2: /auth/me is the canonical source for the greeting name
    (clients previously relied on localStorage). Real-DB test."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"me-{uuid.uuid4().hex[:10]}@example.com"
        reg = await client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "first_name": "Alai",
                "last_name": "Tester",
                "password": "Str0ngPass!x",
            },
        )
        assert reg.status_code == 201, reg.text
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        me = await client.get("/v1/auth/me", headers=headers)
        assert me.status_code == 200
        body = me.json()
        assert body["email"] == email
        assert body["first_name"] == "Alai"
        assert body["last_name"] == "Tester"

        anon = await client.get("/v1/auth/me")
        assert anon.status_code == 401
