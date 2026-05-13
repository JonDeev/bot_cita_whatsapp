export const WEBHOOK_PROCESSING_STATUSES = {
  RECEIVED: 'RECEIVED',
  PROCESSED: 'PROCESSED',
  SKIPPED_STALE: 'SKIPPED_STALE',
  SKIPPED_INVALID_CONTEXT: 'SKIPPED_INVALID_CONTEXT',
  FAILED: 'FAILED',
} as const;

export type WebhookProcessingStatus =
  (typeof WEBHOOK_PROCESSING_STATUSES)[keyof typeof WEBHOOK_PROCESSING_STATUSES];

export interface SaveWebhookInboxEventInput {
  deduplicationKey: string;
  providerMessageId: string;
  eventKind: string;
  phoneNumberId: string | null;
  participantPhone: string | null;
  messageType: string | null;
  interactiveReplyId: string | null;
  contextMessageId: string | null;
  providerOccurredAt: string;
  receivedAt: string;
  signatureValid: boolean;
  payloadHash: string;
  payload: unknown | null;
}

export interface SaveWebhookInboxEventResult {
  created: boolean;
}

export interface UpdateWebhookInboxEventInput {
  deduplicationKey: string;
  processingStatus: WebhookProcessingStatus;
  processedAt: string;
  rejectionReason?: string | null;
  errorMessage?: string | null;
}

export interface WebhookInboxRepositoryPort {
  saveIfFirstSeen(
    input: SaveWebhookInboxEventInput,
  ): Promise<SaveWebhookInboxEventResult>;
  updateStatus(input: UpdateWebhookInboxEventInput): Promise<void>;
}
