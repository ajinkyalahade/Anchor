import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import LoginPage from './LoginPage';

const { navigateMock, postMock, setAuthTokenMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  postMock: vi.fn(),
  setAuthTokenMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../lib/api', () => ({
  api: {
    post: postMock,
    setAuthToken: setAuthTokenMock,
  },
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;

    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('submits login credentials and navigates on success', async () => {
    postMock.mockResolvedValue({
      user_id: 'user-123',
      access_token: 'jwt-token',
      status: 'authenticated',
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/auth/login', {
        email: 'user@example.com',
        password: 'secret123',
      });
    });
    expect(setAuthTokenMock).toHaveBeenCalledWith('jwt-token');
    expect(window.localStorage.getItem('anchor_user_id')).toBe('user-123');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('shows the backend error state', async () => {
    postMock.mockRejectedValue(new Error('Incorrect email or password.'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('We hit a snag. Please try again in a moment.')).toBeInTheDocument();
  });
});
