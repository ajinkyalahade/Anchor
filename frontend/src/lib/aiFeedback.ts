/**
 * AI feedback loop (Phase 1F.4).
 * Call recordAIFeedback after any AI-generated response is shown to the user.
 * Helpful: 1 | neutral: 0 | unhelpful: -1
 */

import { api } from './api';

function sha256hex(text: string): string {
  // Simple non-crypto hash for content fingerprinting (privacy-safe)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function recordAIFeedback(opts: {
  task: string;
  promptId: string;
  content: string;
  latencyMs: number;
  helpful: 1 | 0 | -1;
  model?: string;
}): Promise<void> {
  try {
    await api.post('/ai/feedback', {
      task: opts.task,
      prompt_id: opts.promptId,
      content_hash: sha256hex(opts.content),
      latency_ms: opts.latencyMs,
      helpful: opts.helpful,
      model: opts.model ?? 'unknown',
    });
  } catch {
    // Non-fatal — feedback loss is acceptable
  }
}
