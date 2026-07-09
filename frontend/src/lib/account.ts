import { api } from './api.js';

export type AccountDeletionMode = 'scheduled' | 'immediate';

export interface AccountDeletionResponse {
  status: 'pending' | 'completed';
  deletion_mode: AccountDeletionMode;
  deleted_now: boolean;
  scheduled_for: string | null;
  message: string;
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
