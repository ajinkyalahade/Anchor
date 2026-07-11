"""Security header middleware for the API."""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

# The API serves JSON only, so the CSP can forbid everything. The Swagger UI
# page (/v1/docs) is the one HTML surface and loads its assets from a CDN,
# so it is exempted rather than weakening the policy for every response.
_API_CSP = "default-src 'none'; frame-ancestors 'none'"
_DOCS_PATH = "/v1/docs"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, enable_hsts: bool = False) -> None:
        super().__init__(app)
        self._enable_hsts = enable_hsts

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        if request.url.path != _DOCS_PATH:
            response.headers.setdefault("Content-Security-Policy", _API_CSP)
        if self._enable_hsts:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response
