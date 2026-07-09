import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import AuthGuard from './AuthGuard';

function renderAuthGuard(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthGuard', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      configurable: true,
    });
  });

  it('redirects to login if no JWT is present', () => {
    renderAuthGuard('/');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders protected content when a JWT exists', () => {
    window.localStorage.setItem('anchor_jwt', 'test-token');

    renderAuthGuard('/');

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
