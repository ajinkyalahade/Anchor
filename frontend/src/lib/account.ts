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
  const userId = window.localStorage.getItem('anchor_user_id');
  if (!userId) {
    throw new Error('No active account');
  }

  return api.post<AccountDeletionResponse>('/account/deletion', {
    user_id: userId,
    deletion_mode: deletionMode,
    reason: 'user_requested',
  });
}
