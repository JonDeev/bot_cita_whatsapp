import { apiRequest } from '../../shared/http/api-client';
import type { AdminLiveFeedResponse, AdminOverviewSnapshot } from './overview.types';

export function getOverview() {
  return apiRequest<AdminOverviewSnapshot>('/api/admin/overview');
}

export function getLiveFeed() {
  return apiRequest<AdminLiveFeedResponse>('/api/admin/live-feed');
}
