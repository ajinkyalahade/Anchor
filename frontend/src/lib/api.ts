// SPDX-License-Identifier: MIT
/**
 * API client — thin wrapper for backend calls.
 * All requests go through the Vite proxy (/v1 → localhost:8000).
 */

const BASE_URL = '/v1';

/** Dispatched when the session is no longer valid (expired/revoked token).
 * The router listens and performs an in-app redirect to /login — a full
 * page reload here would destroy in-progress state (mid-breathing-exercise,
 * mid-focus-session), which is a jarring failure mode for this audience. */
export const SESSION_EXPIRED_EVENT = 'anchor:session-expired';

interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  params?: Record<string, string>;
}

/** Non-sensitive marker that a session exists. The session itself lives in
 * the httpOnly anchor_session cookie (SEC-5) — unreadable by JS, so XSS
 * can't exfiltrate it. This flag only routes the UI (AuthGuard). */
const AUTH_FLAG = 'anchor_authed';
/** Pre-cookie-migration key: the raw JWT used to be persisted here. */
const LEGACY_JWT_KEY = 'anchor_jwt';

class ApiClient {
  private baseUrl: string;
  // Held in memory for the lifetime of the tab; across reloads the
  // httpOnly cookie authenticates requests instead.
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // One-time migration: adopt a legacy localStorage token into memory and
    // scrub it. The backend has been setting the session cookie alongside
    // every login, so the cookie takes over from the next reload.
    const legacy = localStorage.getItem(LEGACY_JWT_KEY);
    if (legacy) {
      this.authToken = legacy;
      localStorage.removeItem(LEGACY_JWT_KEY);
      localStorage.setItem(AUTH_FLAG, '1');
    }
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem(AUTH_FLAG, '1');
    } else {
      localStorage.removeItem(AUTH_FLAG);
    }
  }

  /** Whether a session is believed to exist (UI routing only — the server
   * remains the authority via 401s). */
  isAuthenticated(): boolean {
    return localStorage.getItem(AUTH_FLAG) === '1';
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }

  private buildHeaders(custom?: HeadersInit, idempotencyKey?: string): Headers {
    const headers = new Headers(custom);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.authToken) {
      headers.set('Authorization', `Bearer ${this.authToken}`);
    }
    if (idempotencyKey) {
      headers.set('Idempotency-Key', idempotencyKey);
    }
    return headers;
  }

  private isTokenExpired(): boolean {
    if (!this.authToken) return false;
    try {
      const parts = this.authToken.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp;
    } catch {
      return true;
    }
  }

  private expireSession() {
    this.setAuthToken(null);
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (this.isTokenExpired()) {
      this.expireSession();
      throw new ApiError(401, 'token_expired', {});
    }

    const { idempotencyKey, params, ...fetchOptions } = options;
    const headers = this.buildHeaders(fetchOptions.headers, idempotencyKey);
    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      // A 401 from /auth/* is a failed login/registration, not an expired
      // session — only non-auth endpoints signal session expiry.
      if (response.status === 401 && !path.startsWith('/auth/')) {
        this.expireSession();
      }
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, error.detail || 'Request could not be completed right now.', error);
    }

    return response.json();
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>(path, { method: 'GET', params });
  }

  post<T>(path: string, body?: unknown, options: Pick<RequestOptions, 'idempotencyKey'> = {}) {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  status: number;
  detail: string;
  body: unknown;

  constructor(status: number, detail: string, body: unknown) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

export const api = new ApiClient(BASE_URL);

/** Rotate the session token on app start (SEC-5). Best-effort: a 401 means
 * the session is truly gone (expired/revoked) and ends it; network errors
 * are ignored so being offline never logs anyone out. */
export async function refreshSession(): Promise<void> {
  if (!api.isAuthenticated()) return;
  try {
    const r = await api.post<{ access_token: string }>('/auth/refresh');
    api.setAuthToken(r.access_token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      api.setAuthToken(null);
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
  }
}
