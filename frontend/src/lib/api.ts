// SPDX-License-Identifier: MIT
/**
 * API client — thin wrapper for backend calls.
 * All requests go through the Vite proxy (/v1 → localhost:8000).
 */

const BASE_URL = '/v1';

interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = localStorage.getItem('anchor_jwt');

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('anchor_jwt', token);
    } else {
      localStorage.removeItem('anchor_jwt');
    }
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

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (this.isTokenExpired()) {
      this.setAuthToken(null);
      window.location.href = '/login';
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
      if (response.status === 401) {
        this.setAuthToken(null);
        window.location.href = '/login';
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
