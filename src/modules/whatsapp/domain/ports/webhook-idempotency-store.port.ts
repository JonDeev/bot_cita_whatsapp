export interface WebhookIdempotencyStorePort {
  tryAcquire(key: string, ttlSeconds: number): Promise<boolean>;
}
