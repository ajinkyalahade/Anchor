import { api } from './api.js';

export type AccountDeletionMode = 'scheduled' | 'immediate';

export interface AccountDeletionResponse {
  status: 'pending' | 'completed';
  deletion_mode: AccountDeletionMode;
  deleted_now: boolean;
  scheduled_for: string | null;
  message: string;
}

/**
 * Log out: tell the backend to clear the session cookie, then drop all
 * client-side auth state. Best-effort on the network call — we always clear
 * local state so the user is logged out even if the request fails.
 */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignore — clearing local state below is what actually logs the user out.
  }
  api.setAuthToken(null);
  window.localStorage.removeItem('anchor_user_id');
  window.localStorage.removeItem('anchor_first_name');
}

export async function requestAccountDeletion(
  deletionMode: AccountDeletionMode,
): Promise<AccountDeletionResponse> {
  // The backend deletes the account of the authenticated user (bearer token).
  return api.post<AccountDeletionResponse>('/account/deletion', {
    deletion_mode: deletionMode,
    reason: 'user_requested',
  });
}
